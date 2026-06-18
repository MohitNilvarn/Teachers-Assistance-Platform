# File: app/services/hybrid_search.py
"""
Hybrid Search Engine — Dense Vectors + BM25 + Re-ranking.

This is the core retrieval orchestrator for the advanced RAG pipeline.
It combines multiple retrieval strategies to maximize recall and precision:

1. **Dense Vector Search** — MongoDB Atlas $vectorSearch (semantic similarity).
2. **BM25 Keyword Search** — Text-based search using MongoDB $text index
   (exact keyword matching that embeddings sometimes miss).
3. **Multi-Query Retrieval** — Uses query decomposition + HyDE to search
   with multiple embeddings, catching different facets of the query.
4. **Reciprocal Rank Fusion (RRF)** — Merges ranked results from all
   retrieval methods into a single ranking.
5. **Cross-Encoder Re-ranking** — Final precision pass using a
   cross-encoder model.
6. **Parent Chunk Resolution** — Expands child chunks to their parent
   sections for richer context.

This is the same multi-stage retrieval architecture used by NotebookLM,
Perplexity, and Google's production RAG systems.
"""
import asyncio
from typing import List, Dict, Any, Optional, Set
from collections import defaultdict

from motor.motor_asyncio import AsyncIOMotorCollection

from app.core.logger import get_logger
from app.services.embedding_service import generate_embedding
from app.services.reranker import rerank_with_diversity
from app.services.context_builder import resolve_parent_chunks, deduplicate_chunks

logger = get_logger("TAP.HybridSearch")


# ---------------------------------------------------------------------------
# BM25-style keyword search via MongoDB $text
# ---------------------------------------------------------------------------

async def _bm25_text_search(
    collection: AsyncIOMotorCollection,
    query: str,
    pre_filter: Dict[str, Any],
    n_results: int = 15,
) -> List[Dict[str, Any]]:
    """
    Keyword search using MongoDB's built-in $text search.

    Falls back gracefully if no text index exists.

    Args:
        collection:  MongoDB collection.
        query:       The search query string.
        pre_filter:  Filter conditions (lecture_id, course_id, etc.).
        n_results:   Max results.

    Returns:
        List of result dicts with text, score, metadata.
    """
    try:
        # Build the filter with $text search
        text_filter = {
            **pre_filter,
            "$text": {"$search": query},
        }

        cursor = collection.find(
            text_filter,
            {
                "_id": 1,
                "text": 1,
                "metadata": 1,
                "lecture_id": 1,
                "course_id": 1,
                "source": 1,
                "chunk_type": 1,
                "parent_id": 1,
                "score": {"$meta": "textScore"},
            },
        ).sort([("score", {"$meta": "textScore"})]).limit(n_results)

        results: List[Dict[str, Any]] = []
        async for doc in cursor:
            results.append({
                "id": doc["_id"],
                "text": doc.get("text", ""),
                "metadata": doc.get("metadata", {}),
                "score": doc.get("score", 0.0),
                "lecture_id": doc.get("lecture_id"),
                "source": doc.get("source", "unknown"),
                "retrieval_method": "bm25",
            })

        logger.debug(f"BM25 search returned {len(results)} results")
        return results

    except Exception as e:
        # $text search requires a text index — may not exist
        logger.debug(f"BM25 text search unavailable: {e}")
        return []


# ---------------------------------------------------------------------------
# Dense vector search (reused from vector_store.py)
# ---------------------------------------------------------------------------

async def _dense_vector_search(
    collection: AsyncIOMotorCollection,
    query_embedding: List[float],
    pre_filter: Dict[str, Any],
    n_results: int = 15,
) -> List[Dict[str, Any]]:
    """
    Dense vector search using MongoDB Atlas $vectorSearch.

    Falls back to brute-force cosine if Atlas search is unavailable.
    """
    try:
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
                    "chunk_type": 1,
                    "parent_id": 1,
                    "score": {"$meta": "vectorSearchScore"},
                }
            },
        ]

        results: List[Dict[str, Any]] = []
        async for doc in collection.aggregate(pipeline):
            results.append({
                "id": doc["_id"],
                "text": doc.get("text", ""),
                "metadata": doc.get("metadata", {}),
                "score": doc.get("score", 0.0),
                "lecture_id": doc.get("lecture_id"),
                "source": doc.get("source", "unknown"),
                "retrieval_method": "dense_vector",
            })

        return results

    except Exception:
        # Fallback to brute-force cosine
        return await _fallback_cosine(
            collection, query_embedding, pre_filter, n_results
        )


async def _fallback_cosine(
    collection: AsyncIOMotorCollection,
    query_embedding: List[float],
    pre_filter: Dict[str, Any],
    n_results: int,
) -> List[Dict[str, Any]]:
    """Brute-force cosine similarity fallback for non-Atlas environments."""
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
            "chunk_type": 1, "parent_id": 1,
        },
    )

    scored: List[Dict[str, Any]] = []
    async for doc in cursor:
        doc_vec = np.array(doc.get("embedding", []), dtype=np.float32)
        doc_norm = np.linalg.norm(doc_vec)
        if doc_norm == 0:
            continue
        similarity = float(np.dot(query_vec, doc_vec) / (query_norm * doc_norm))
        scored.append({
            "id": doc["_id"],
            "text": doc.get("text", ""),
            "metadata": doc.get("metadata", {}),
            "score": similarity,
            "lecture_id": doc.get("lecture_id"),
            "source": doc.get("source", "unknown"),
            "retrieval_method": "cosine_fallback",
        })

    scored.sort(key=lambda x: x["score"], reverse=True)
    return scored[:n_results]


# ---------------------------------------------------------------------------
# Reciprocal Rank Fusion (RRF)
# ---------------------------------------------------------------------------

def reciprocal_rank_fusion(
    *result_lists: List[Dict[str, Any]],
    k: int = 60,
) -> List[Dict[str, Any]]:
    """
    Merge multiple ranked result lists using Reciprocal Rank Fusion.

    RRF is a robust rank aggregation method that:
    - Does NOT require score normalization across methods
    - Naturally balances relevance signals from different retrievers
    - Is the standard fusion method in production hybrid search systems

    Formula: RRF_score(d) = Σ 1/(k + rank_i(d))

    Args:
        result_lists: Multiple ranked result lists.
        k:           RRF parameter (typically 60).

    Returns:
        Merged and re-ranked result list.
    """
    doc_scores: Dict[str, float] = defaultdict(float)
    doc_data: Dict[str, Dict[str, Any]] = {}

    for result_list in result_lists:
        for rank, result in enumerate(result_list):
            doc_id = result.get("id", "")
            if not doc_id:
                continue

            rrf_score = 1.0 / (k + rank + 1)
            doc_scores[doc_id] += rrf_score

            # Keep the result data from the highest-scoring occurrence
            if doc_id not in doc_data or rrf_score > doc_data[doc_id].get("_best_rrf", 0):
                doc_data[doc_id] = {**result, "_best_rrf": rrf_score}

    # Build merged results
    merged: List[Dict[str, Any]] = []
    for doc_id, rrf_total in sorted(
        doc_scores.items(), key=lambda x: x[1], reverse=True
    ):
        result = doc_data[doc_id]
        result["rrf_score"] = rrf_total
        result["combined_score"] = rrf_total  # Alias for downstream
        result.pop("_best_rrf", None)
        merged.append(result)

    return merged


# ---------------------------------------------------------------------------
# Main hybrid search function
# ---------------------------------------------------------------------------

async def hybrid_search(
    query: str,
    lecture_id: Optional[str] = None,
    course_id: Optional[str] = None,
    source_filter: Optional[str] = None,
    n_results: int = 10,
    use_bm25: bool = True,
    use_reranking: bool = True,
    use_multi_query: bool = True,
    use_parent_resolution: bool = True,
    query_embeddings: Optional[List[Dict[str, Any]]] = None,
) -> List[Dict[str, Any]]:
    """
    Perform hybrid search combining dense vectors, BM25, and re-ranking.

    This is the primary retrieval entry point for the advanced RAG pipeline.

    Args:
        query:               Natural language search query.
        lecture_id:          Filter to a specific lecture.
        course_id:           Filter to a specific course.
        source_filter:       Filter by source type (e.g. "teacher_material").
        n_results:           Max final results to return.
        use_bm25:            Whether to include BM25 keyword search.
        use_reranking:       Whether to apply cross-encoder re-ranking.
        use_multi_query:     Whether to use pre-computed multi-query embeddings.
        use_parent_resolution: Whether to resolve child→parent chunks.
        query_embeddings:    Pre-computed query embeddings from query_engine.
                             If None, generates a single raw embedding.

    Returns:
        List of result dicts, ranked by combined relevance.
    """
    from app.services.vector_store import _get_collection

    collection = _get_collection()

    # Build pre-filter
    pre_filter: Dict[str, Any] = {}
    if lecture_id:
        pre_filter["lecture_id"] = lecture_id
    if course_id:
        pre_filter["course_id"] = course_id
    if source_filter:
        pre_filter["source"] = source_filter

    # Determine how many candidates to fetch per method
    candidates_per_method = max(n_results * 3, 20)

    all_result_lists: List[List[Dict[str, Any]]] = []

    # --- Dense vector search ---
    if query_embeddings and use_multi_query:
        # Multi-query: search with each embedding
        dense_tasks = []
        for qe in query_embeddings:
            dense_tasks.append(
                _dense_vector_search(
                    collection, qe["embedding"],
                    pre_filter, candidates_per_method,
                )
            )
        dense_results = await asyncio.gather(*dense_tasks, return_exceptions=True)
        for dr in dense_results:
            if isinstance(dr, list):
                all_result_lists.append(dr)
    else:
        # Single query
        raw_embedding = generate_embedding(query[:500])
        dense_results = await _dense_vector_search(
            collection, raw_embedding, pre_filter, candidates_per_method,
        )
        all_result_lists.append(dense_results)

    # --- BM25 keyword search ---
    if use_bm25:
        # Use a condensed query for BM25 (keywords work better short)
        bm25_query = query[:200]
        bm25_results = await _bm25_text_search(
            collection, bm25_query, pre_filter, candidates_per_method,
        )
        if bm25_results:
            all_result_lists.append(bm25_results)

    # --- Reciprocal Rank Fusion ---
    if len(all_result_lists) > 1:
        fused = reciprocal_rank_fusion(*all_result_lists)
    elif all_result_lists:
        fused = all_result_lists[0]
        # Add combined_score alias
        for r in fused:
            r["combined_score"] = r.get("score", 0.0)
    else:
        fused = []

    logger.info(
        f"Hybrid search: {sum(len(r) for r in all_result_lists)} raw candidates "
        f"→ {len(fused)} after RRF fusion "
        f"(methods: dense={'multi' if use_multi_query else 'single'}, "
        f"bm25={'yes' if use_bm25 else 'no'})"
    )

    # --- Cross-encoder re-ranking ---
    if use_reranking and fused:
        reranked = rerank_with_diversity(
            query=query[:500],
            results=fused,
            top_k=n_results * 2,  # Get extra for parent resolution
            relevance_threshold=0.05,
            diversity_penalty=0.1,
        )
        # Convert RerankedResult objects back to dicts
        final_results = []
        for rr in reranked:
            final_results.append({
                "id": rr.chunk_id,
                "text": rr.text,
                "metadata": rr.metadata,
                "score": rr.combined_score,
                "combined_score": rr.combined_score,
                "rerank_score": rr.rerank_score,
                "source": rr.source,
                "lecture_id": rr.lecture_id,
            })
    else:
        final_results = fused[:n_results * 2]

    # --- Parent chunk resolution ---
    if use_parent_resolution and final_results:
        try:
            final_results = await resolve_parent_chunks(final_results)
        except Exception as e:
            logger.warning(f"Parent resolution failed: {e}")

    # --- Final dedup and trim ---
    final_results, _ = deduplicate_chunks(final_results)
    final_results = final_results[:n_results]

    logger.info(
        f"Hybrid search complete: {len(final_results)} final results "
        f"for query='{query[:80]}...'"
    )

    return final_results


# ---------------------------------------------------------------------------
# Convenience functions (drop-in replacements for vector_store.py)
# ---------------------------------------------------------------------------

async def advanced_search_by_lecture(
    lecture_id: str,
    query: str,
    n_results: int = 8,
    source_filter: Optional[str] = None,
    query_embeddings: Optional[List[Dict[str, Any]]] = None,
) -> List[Dict[str, Any]]:
    """
    Advanced hybrid search scoped to a specific lecture.

    Drop-in replacement for vector_store.search_by_lecture() but
    with hybrid search + re-ranking.
    """
    return await hybrid_search(
        query=query,
        lecture_id=lecture_id,
        source_filter=source_filter,
        n_results=n_results,
        query_embeddings=query_embeddings,
    )


async def advanced_search_documents(
    course_id: str,
    query: str,
    n_results: int = 8,
    lecture_id: Optional[str] = None,
    source_filter: Optional[str] = None,
    query_embeddings: Optional[List[Dict[str, Any]]] = None,
) -> List[Dict[str, Any]]:
    """
    Advanced hybrid search scoped to a course.

    Drop-in replacement for vector_store.search_documents() but
    with hybrid search + re-ranking.
    """
    return await hybrid_search(
        query=query,
        course_id=course_id,
        lecture_id=lecture_id,
        source_filter=source_filter,
        n_results=n_results,
        query_embeddings=query_embeddings,
    )
