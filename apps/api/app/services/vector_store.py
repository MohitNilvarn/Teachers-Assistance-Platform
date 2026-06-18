# File: app/services/vector_store.py
"""
Vector store service using MongoDB Atlas Vector Search.

Stores document embeddings directly in MongoDB, enabling lecture-scoped
vector similarity search without external dependencies like ChromaDB.

Each document chunk is stored in the `vector_embeddings` collection with:
- The embedding vector
- Source metadata (lecture_id, course_id, source type)
- The original text chunk
- chunk_type: "parent" or "child" (for parent-child hierarchy)
- parent_id: reference to parent chunk (for child chunks)

A MongoDB Atlas Vector Search index named "vector_index" must be created
on the `embedding` field. This is handled automatically at startup via
`ensure_vector_search_index()`.

A MongoDB text index on the `text` field supports BM25 keyword search
for hybrid retrieval.
"""
from typing import List, Dict, Any, Optional
from datetime import datetime

from motor.motor_asyncio import AsyncIOMotorCollection
from pymongo import InsertOne

from app.core.config import settings
from app.core.logger import get_logger
from app.services.embedding_service import generate_embedding, generate_embeddings

logger = get_logger("TAP.VectorStore")

# ---------------------------------------------------------------------------
# Collection name constant
# ---------------------------------------------------------------------------
VECTOR_COLLECTION = "vector_embeddings"

# Embedding dimension for sentence-transformers/all-MiniLM-L6-v2
EMBEDDING_DIMENSION = 384


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _get_collection() -> AsyncIOMotorCollection:
    """Return the Motor collection for vector embeddings."""
    from app.db.mongodb import get_database
    db = get_database()
    return db[VECTOR_COLLECTION]


# ---------------------------------------------------------------------------
# Index management
# ---------------------------------------------------------------------------

async def ensure_vector_search_index() -> None:
    """
    Create the required indexes on the vector_embeddings collection.

    1. Standard compound indexes on (lecture_id, course_id) for fast filtering.
    2. Text index on `text` field for BM25 keyword search (hybrid retrieval).
    3. Index on chunk_type and parent_id for parent-child hierarchy.
    4. A MongoDB Atlas Vector Search index for $vectorSearch aggregation.

    The vector search index is created via the Atlas `createSearchIndex` API.
    On local / community editions this call is skipped gracefully so dev
    environments still work.
    """
    collection = _get_collection()

    # --- Standard indexes (always supported) ---
    await collection.create_index(
        [("lecture_id", 1), ("course_id", 1)],
        name="idx_lecture_course",
        background=True,
    )
    await collection.create_index(
        [("course_id", 1), ("source", 1)],
        name="idx_course_source",
        background=True,
    )
    # Index for parent-child hierarchy
    await collection.create_index(
        [("chunk_type", 1), ("parent_id", 1)],
        name="idx_chunk_hierarchy",
        background=True,
    )
    logger.info("Standard indexes ensured on vector_embeddings collection.")

    # --- Text index for BM25 keyword search ---
    try:
        await collection.create_index(
            [("text", "text")],
            name="idx_text_search",
            background=True,
            default_language="english",
        )
        logger.info("Text index created for BM25 keyword search.")
    except Exception as exc:
        # Text index may already exist or conflict
        logger.debug(f"Text index creation note: {exc}")

    # --- Atlas Vector Search index ---
    try:
        from pymongo.operations import SearchIndexModel

        vector_index_definition = {
            "fields": [
                {
                    "type": "vector",
                    "path": "embedding",
                    "numDimensions": EMBEDDING_DIMENSION,
                    "similarity": "cosine",
                },
                {
                    "type": "filter",
                    "path": "lecture_id",
                },
                {
                    "type": "filter",
                    "path": "course_id",
                },
                {
                    "type": "filter",
                    "path": "source",
                },
                {
                    "type": "filter",
                    "path": "chunk_type",
                },
            ],
        }

        search_index = SearchIndexModel(
            definition=vector_index_definition,
            name="vector_index",
            type="vectorSearch",
        )

        # Check if index already exists
        existing_names: List[str] = []
        async for idx in collection.list_search_indexes():
            existing_names.append(idx.get("name", ""))

        if "vector_index" not in existing_names:
            await collection.create_search_index(search_index)
            logger.info("Atlas Vector Search index 'vector_index' created.")
        else:
            logger.info("Atlas Vector Search index 'vector_index' already exists.")

    except Exception as exc:
        logger.warning(
            f"Could not create Atlas Vector Search index "
            f"(expected on non-Atlas environments): {exc}"
        )


# ---------------------------------------------------------------------------
# CRUD operations
# ---------------------------------------------------------------------------

async def add_documents(
    course_id: str,
    lecture_id: str,
    documents: List[str],
    metadatas: List[Dict[str, Any]],
    ids: List[str],
) -> List[str]:
    """
    Embed and insert document chunks into MongoDB.

    Supports parent-child hierarchy via metadata fields:
    - metadata.chunk_type: "parent" or "child"
    - metadata.parent_id:  reference to parent chunk ID

    Args:
        course_id:  Owning course ID.
        lecture_id: Owning lecture ID – every document is scoped to a lecture.
        documents:  Raw text chunks.
        metadatas:  Per-chunk metadata dicts.
        ids:        Unique string IDs for each chunk.

    Returns:
        The list of chunk IDs that were inserted.
    """
    if not documents:
        return []

    collection = _get_collection()

    logger.info(
        f"Embedding {len(documents)} chunks for lecture={lecture_id}, "
        f"course={course_id}"
    )

    # Generate embeddings in one batch
    embeddings = generate_embeddings(documents)
    now = datetime.utcnow()

    # Build bulk-write operations
    operations = []
    for doc_text, emb, meta, chunk_id in zip(documents, embeddings, metadatas, ids):
        record = {
            "_id": chunk_id,
            "course_id": course_id,
            "lecture_id": lecture_id,
            "source": meta.get("source", "unknown"),
            "text": doc_text,
            "embedding": emb,
            "metadata": meta,
            "chunk_type": meta.get("chunk_type", "flat"),
            "parent_id": meta.get("parent_id"),
            "created_at": now,
        }
        operations.append(InsertOne(record))

    if operations:
        # ordered=False: one duplicate _id won't abort the entire batch
        result = await collection.bulk_write(operations, ordered=False)
        logger.info(
            f"Inserted {result.inserted_count} embedding documents "
            f"(lecture={lecture_id})."
        )

    return ids


async def upsert_documents(
    course_id: str,
    lecture_id: str,
    documents: List[str],
    metadatas: List[Dict[str, Any]],
    ids: List[str],
) -> List[str]:
    """
    Upsert (insert-or-replace) document chunks.

    Useful when re-transcribing a lecture — old chunks are replaced atomically.

    Args:
        course_id:  Owning course ID.
        lecture_id: Owning lecture ID.
        documents:  Raw text chunks.
        metadatas:  Per-chunk metadata dicts.
        ids:        Unique string IDs for each chunk.

    Returns:
        The list of chunk IDs that were upserted.
    """
    if not documents:
        return []

    collection = _get_collection()
    embeddings = generate_embeddings(documents)
    now = datetime.utcnow()

    from pymongo import ReplaceOne

    operations = []
    for doc_text, emb, meta, chunk_id in zip(documents, embeddings, metadatas, ids):
        record = {
            "_id": chunk_id,
            "course_id": course_id,
            "lecture_id": lecture_id,
            "source": meta.get("source", "unknown"),
            "text": doc_text,
            "embedding": emb,
            "metadata": meta,
            "chunk_type": meta.get("chunk_type", "flat"),
            "parent_id": meta.get("parent_id"),
            "created_at": now,
        }
        operations.append(
            ReplaceOne({"_id": chunk_id}, record, upsert=True)
        )

    if operations:
        result = await collection.bulk_write(operations, ordered=False)
        logger.info(
            f"Upserted {result.upserted_count + result.modified_count} "
            f"embedding documents (lecture={lecture_id})."
        )

    return ids


async def add_semantic_chunks(
    course_id: str,
    lecture_id: str,
    chunked_document,
) -> List[str]:
    """
    Store semantically chunked documents (parent + child hierarchy).

    Accepts a ChunkedDocument from the semantic chunking engine and
    stores all parent and child chunks with their hierarchy metadata.

    Args:
        course_id:          Owning course ID.
        lecture_id:         Owning lecture ID.
        chunked_document:   ChunkedDocument from app.services.chunking.

    Returns:
        List of all chunk IDs that were inserted.
    """
    all_texts = []
    all_metas = []
    all_ids = []

    for chunk in chunked_document.all_chunks:
        meta = {
            **chunk.metadata,
            "chunk_type": chunk.chunk_type,
            "parent_id": chunk.parent_id,
        }
        all_texts.append(chunk.text)
        all_metas.append(meta)
        all_ids.append(chunk.chunk_id)

    if not all_texts:
        return []

    logger.info(
        f"Storing {len(chunked_document.parents)} parent + "
        f"{len(chunked_document.children)} child chunks "
        f"(lecture={lecture_id})"
    )

    return await add_documents(
        course_id=course_id,
        lecture_id=lecture_id,
        documents=all_texts,
        metadatas=all_metas,
        ids=all_ids,
    )


# ---------------------------------------------------------------------------
# Search operations
# ---------------------------------------------------------------------------

async def search_documents(
    course_id: str,
    query: str,
    n_results: int = 5,
    lecture_id: Optional[str] = None,
    source_filter: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """
    Vector similarity search scoped to a course (and optionally a lecture).

    Uses MongoDB Atlas `$vectorSearch` aggregation stage.  Falls back to a
    brute-force cosine scan when Atlas Vector Search is unavailable (dev).

    Args:
        course_id:     Restrict results to this course.
        query:         Natural-language search query.
        n_results:     Maximum number of results.
        lecture_id:    (Optional) Restrict to a specific lecture.
        source_filter: (Optional) e.g. "lecture_transcript", "material".

    Returns:
        Ranked list of dicts with keys: id, text, metadata, score.
    """
    collection = _get_collection()
    query_embedding = generate_embedding(query)

    pre_filter: Dict[str, Any] = {"course_id": course_id}
    if lecture_id:
        pre_filter["lecture_id"] = lecture_id
    if source_filter:
        pre_filter["source"] = source_filter

    try:
        return await _atlas_vector_search(
            collection, query_embedding, pre_filter, n_results
        )
    except Exception as exc:
        logger.warning(f"Atlas $vectorSearch unavailable, using fallback: {exc}")
        return await _fallback_cosine_search(
            collection, query_embedding, pre_filter, n_results
        )


async def search_by_lecture(
    lecture_id: str,
    query: str,
    n_results: int = 5,
    source_filter: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """
    Search vector embeddings scoped to a **single lecture**.

    Primary search entry point for lecture-specific retrieval (e.g. when
    generating notes/assignments/flashcards for a particular lecture).

    Args:
        lecture_id:    The lecture to search within.
        query:         Natural-language query.
        n_results:     Max results to return.
        source_filter: Optional source type filter.

    Returns:
        Ranked list of dicts with keys: id, text, metadata, score.
    """
    collection = _get_collection()
    query_embedding = generate_embedding(query)

    pre_filter: Dict[str, Any] = {"lecture_id": lecture_id}
    if source_filter:
        pre_filter["source"] = source_filter

    try:
        return await _atlas_vector_search(
            collection, query_embedding, pre_filter, n_results
        )
    except Exception:
        return await _fallback_cosine_search(
            collection, query_embedding, pre_filter, n_results
        )


# ---------------------------------------------------------------------------
# Deletion operations
# ---------------------------------------------------------------------------

async def delete_lecture_embeddings(lecture_id: str) -> int:
    """
    Delete **all** vector embeddings associated with a lecture.

    Args:
        lecture_id: The lecture whose embeddings should be removed.

    Returns:
        Number of deleted documents.
    """
    collection = _get_collection()
    result = await collection.delete_many({"lecture_id": lecture_id})
    logger.info(f"Deleted {result.deleted_count} embeddings for lecture={lecture_id}")
    return result.deleted_count


async def delete_documents(course_id: str, ids: List[str]) -> bool:
    """
    Delete specific embedding documents by their IDs.

    Args:
        course_id: Course ID (logged for tracing).
        ids:       List of document `_id` values to remove.

    Returns:
        True on success.
    """
    if not ids:
        return True

    collection = _get_collection()
    result = await collection.delete_many({"_id": {"$in": ids}})
    logger.info(
        f"Deleted {result.deleted_count}/{len(ids)} embeddings (course={course_id})"
    )
    return True


async def delete_course_embeddings(course_id: str) -> int:
    """
    Delete all vector embeddings for an entire course.

    Args:
        course_id: The course whose embeddings should be removed.

    Returns:
        Number of deleted documents.
    """
    collection = _get_collection()
    result = await collection.delete_many({"course_id": course_id})
    logger.info(f"Deleted {result.deleted_count} embeddings for course={course_id}")
    return result.deleted_count


# ---------------------------------------------------------------------------
# Statistics
# ---------------------------------------------------------------------------

async def get_lecture_embedding_count(lecture_id: str) -> int:
    """Return the number of stored embedding chunks for a lecture."""
    collection = _get_collection()
    return await collection.count_documents({"lecture_id": lecture_id})


async def get_collection_stats(course_id: str) -> Dict[str, Any]:
    """
    Aggregate statistics for embeddings within a course.

    Returns:
        Dict with total count, per-source breakdown, and lecture list.
    """
    collection = _get_collection()

    pipeline = [
        {"$match": {"course_id": course_id}},
        {
            "$group": {
                "_id": {
                    "lecture_id": "$lecture_id",
                    "source": "$source",
                },
                "count": {"$sum": 1},
            }
        },
    ]

    stats: Dict[str, Any] = {
        "course_id": course_id,
        "total_embeddings": 0,
        "lectures": {},
        "sources": {},
    }

    async for doc in collection.aggregate(pipeline):
        lecture = doc["_id"]["lecture_id"]
        source = doc["_id"]["source"]
        count = doc["count"]

        stats["total_embeddings"] += count
        stats["lectures"].setdefault(lecture, 0)
        stats["lectures"][lecture] += count
        stats["sources"].setdefault(source, 0)
        stats["sources"][source] += count

    return stats


# ---------------------------------------------------------------------------
# Search implementations (private)
# ---------------------------------------------------------------------------

async def _atlas_vector_search(
    collection: AsyncIOMotorCollection,
    query_embedding: List[float],
    pre_filter: Dict[str, Any],
    n_results: int,
) -> List[Dict[str, Any]]:
    """
    Use MongoDB Atlas `$vectorSearch` aggregation stage.

    Requires a vector search index named "vector_index" on the `embedding` field.
    """
    pipeline = [
        {
            "$vectorSearch": {
                "index": "vector_index",
                "path": "embedding",
                "queryVector": query_embedding,
                "numCandidates": max(n_results * 10, 100),
                "limit": n_results,
                "filter": pre_filter,
            }
        },
        {
            "$project": {
                "_id": 1,
                "text": 1,
                "metadata": 1,
                "lecture_id": 1,
                "course_id": 1,
                "source": 1,
                "score": {"$meta": "vectorSearchScore"},
            }
        },
    ]

    results: List[Dict[str, Any]] = []
    async for doc in collection.aggregate(pipeline):
        results.append(
            {
                "id": doc["_id"],
                "text": doc.get("text", ""),
                "metadata": doc.get("metadata", {}),
                "score": doc.get("score", 0.0),
                "lecture_id": doc.get("lecture_id"),
                "source": doc.get("source"),
            }
        )

    logger.info(f"Atlas vector search returned {len(results)} results.")
    return results


async def _fallback_cosine_search(
    collection: AsyncIOMotorCollection,
    query_embedding: List[float],
    pre_filter: Dict[str, Any],
    n_results: int,
) -> List[Dict[str, Any]]:
    """
    Brute-force cosine similarity fallback for non-Atlas environments.

    Loads matching documents into memory and computes cosine similarity.
    Suitable for dev / small datasets only.
    """
    import numpy as np

    query_vec = np.array(query_embedding, dtype=np.float32)
    query_norm = np.linalg.norm(query_vec)
    if query_norm == 0:
        return []

    cursor = collection.find(
        pre_filter,
        {
            "_id": 1, "text": 1, "metadata": 1, "embedding": 1,
            "lecture_id": 1, "course_id": 1, "source": 1,
        },
    )

    scored: List[Dict[str, Any]] = []
    async for doc in cursor:
        doc_vec = np.array(doc["embedding"], dtype=np.float32)
        doc_norm = np.linalg.norm(doc_vec)
        if doc_norm == 0:
            continue
        similarity = float(np.dot(query_vec, doc_vec) / (query_norm * doc_norm))
        scored.append(
            {
                "id": doc["_id"],
                "text": doc.get("text", ""),
                "metadata": doc.get("metadata", {}),
                "score": similarity,
                "lecture_id": doc.get("lecture_id"),
                "source": doc.get("source"),
            }
        )

    scored.sort(key=lambda x: x["score"], reverse=True)
    results = scored[:n_results]
    logger.info(f"Fallback cosine search returned {len(results)} results.")
    return results
