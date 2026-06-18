# File: app/services/context_builder.py
"""
Context Builder — Contextual Compression + Citation Grounding.

This is the final stage of the advanced RAG pipeline.  After retrieval
and re-ranking, this module:

1. **Contextual Compression** — Removes irrelevant sentences from each
   chunk, keeping only the parts that directly answer the query.  This
   reduces noise and lets the LLM focus on what matters.

2. **Deduplication** — Detects and removes near-duplicate chunks (common
   when parent-child retrieval + multi-query retrieval overlaps).

3. **Source Attribution** — Tags every chunk with a citation ID so the
   generated content can reference specific sources.  This is how
   NotebookLM achieves its "grounded in your sources" guarantee.

4. **Context Assembly** — Builds the final context string with clear
   section markers, priority ordering, and token budget management.
"""
import re
import hashlib
from typing import List, Dict, Any, Optional, Set, Tuple
from dataclasses import dataclass, field

from app.core.logger import get_logger

logger = get_logger("TAP.ContextBuilder")


# ---------------------------------------------------------------------------
# Data structures
# ---------------------------------------------------------------------------

@dataclass
class CitedChunk:
    """A chunk with citation metadata for grounded generation."""
    citation_id: str       # e.g. "[S1]", "[S2]"
    text: str
    source_type: str       # "teacher_material", "transcript", "knowledge_base"
    section_heading: str
    relevance_score: float
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class BuiltContext:
    """Final assembled context for LLM consumption."""
    context_text: str               # The full context string
    citations: List[CitedChunk]     # All cited chunks with IDs
    citation_map: Dict[str, str]    # citation_id → source text
    total_tokens_estimate: int      # Approximate token count
    chunks_used: int
    chunks_deduplicated: int
    chunks_compressed: int
    retrieval_metadata: Dict[str, Any] = field(default_factory=dict)


# ---------------------------------------------------------------------------
# Deduplication
# ---------------------------------------------------------------------------

def _compute_fingerprint(text: str) -> str:
    """Create a normalized fingerprint for dedup comparison."""
    # Normalize: lowercase, remove extra whitespace, remove punctuation
    normalized = re.sub(r"[^\w\s]", "", text.lower())
    normalized = re.sub(r"\s+", " ", normalized).strip()
    return hashlib.md5(normalized.encode()).hexdigest()


def _is_near_duplicate(
    text_a: str, text_b: str, threshold: float = 0.7
) -> bool:
    """
    Check if two texts are near-duplicates using word overlap.

    Args:
        text_a: First text.
        text_b: Second text.
        threshold: Jaccard similarity threshold for duplicate detection.

    Returns:
        True if texts are near-duplicates.
    """
    words_a = set(text_a.lower().split())
    words_b = set(text_b.lower().split())

    if not words_a or not words_b:
        return False

    intersection = words_a & words_b
    union = words_a | words_b
    similarity = len(intersection) / len(union)

    return similarity >= threshold


def deduplicate_chunks(
    chunks: List[Dict[str, Any]],
    similarity_threshold: float = 0.7,
) -> Tuple[List[Dict[str, Any]], int]:
    """
    Remove near-duplicate chunks, keeping the highest-scored version.

    Args:
        chunks:               List of chunk dicts with 'text' and 'score'.
        similarity_threshold: Overlap threshold for dedup.

    Returns:
        Tuple of (deduplicated chunks, number removed).
    """
    if not chunks:
        return [], 0

    # Sort by score descending — keep the best version of each duplicate
    sorted_chunks = sorted(
        chunks, key=lambda x: x.get("combined_score", x.get("score", 0)),
        reverse=True,
    )

    deduplicated: List[Dict[str, Any]] = []
    seen_fingerprints: Set[str] = set()
    removed = 0

    for chunk in sorted_chunks:
        text = chunk.get("text", "")
        if not text:
            continue

        fp = _compute_fingerprint(text)

        # Check exact duplicate
        if fp in seen_fingerprints:
            removed += 1
            continue

        # Check near-duplicate against all kept chunks
        is_dup = False
        for kept in deduplicated:
            if _is_near_duplicate(text, kept.get("text", ""), similarity_threshold):
                is_dup = True
                break

        if is_dup:
            removed += 1
            continue

        seen_fingerprints.add(fp)
        deduplicated.append(chunk)

    if removed > 0:
        logger.info(
            f"Deduplication: {len(chunks)} → {len(deduplicated)} "
            f"({removed} near-duplicates removed)"
        )

    return deduplicated, removed


# ---------------------------------------------------------------------------
# Contextual Compression
# ---------------------------------------------------------------------------

def compress_chunk(
    text: str,
    query: str,
    min_sentence_relevance: float = 0.1,
) -> str:
    """
    Compress a chunk by removing sentences that are irrelevant to the query.

    Uses keyword overlap as a fast relevance proxy.  Sentences with very
    low overlap with the query are dropped.

    Args:
        text:                    The chunk text.
        query:                   The search query.
        min_sentence_relevance:  Min keyword overlap to keep a sentence.

    Returns:
        Compressed text with only relevant sentences.
    """
    if not text or not query:
        return text

    query_words = set(query.lower().split())
    # Remove very common words from query
    stop_words = {
        "the", "a", "an", "in", "of", "and", "or", "is", "are",
        "was", "were", "for", "to", "with", "on", "at", "by",
        "it", "this", "that", "as", "be", "has", "have", "had",
        "not", "but", "from", "they", "we", "can", "will",
    }
    query_keywords = query_words - stop_words

    if not query_keywords:
        return text

    # Split into sentences
    sentences = re.split(r"(?<=[.!?])\s+", text)

    kept_sentences: List[str] = []
    for sentence in sentences:
        sentence = sentence.strip()
        if not sentence:
            continue

        # Short sentences: keep (likely definitions or key terms)
        if len(sentence) < 40:
            kept_sentences.append(sentence)
            continue

        # Check keyword overlap
        sent_words = set(sentence.lower().split()) - stop_words
        if not sent_words:
            kept_sentences.append(sentence)
            continue

        overlap = len(query_keywords & sent_words) / len(query_keywords)

        if overlap >= min_sentence_relevance:
            kept_sentences.append(sentence)

    compressed = " ".join(kept_sentences)

    # If compression removed too much (>70%), return original
    if len(compressed) < len(text) * 0.3:
        return text

    return compressed


# ---------------------------------------------------------------------------
# Parent chunk resolution
# ---------------------------------------------------------------------------

async def resolve_parent_chunks(
    child_results: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    """
    For child chunks, fetch their parent chunks to provide richer context.

    This implements the "small-to-big" retrieval pattern:
    - Search was done over small, precise child chunks.
    - Now we retrieve the full parent section for context.

    Args:
        child_results: List of search results (may include parent_id in metadata).

    Returns:
        Results with parent text appended where available.
    """
    from app.services.vector_store import _get_collection

    parent_ids: Set[str] = set()
    for r in child_results:
        pid = r.get("metadata", {}).get("parent_id")
        if pid:
            parent_ids.add(pid)

    if not parent_ids:
        return child_results

    # Fetch parent documents from MongoDB
    collection = _get_collection()
    parent_docs: Dict[str, str] = {}

    try:
        cursor = collection.find(
            {"_id": {"$in": list(parent_ids)}},
            {"_id": 1, "text": 1},
        )
        async for doc in cursor:
            parent_docs[doc["_id"]] = doc.get("text", "")
    except Exception as e:
        logger.warning(f"Parent chunk resolution failed: {e}")
        return child_results

    # Enrich results with parent context
    enriched = []
    for r in child_results:
        r_copy = dict(r)
        pid = r.get("metadata", {}).get("parent_id")
        if pid and pid in parent_docs:
            parent_text = parent_docs[pid]
            # Use parent text as the context (richer than child alone)
            r_copy["parent_text"] = parent_text
            r_copy["text"] = parent_text  # Replace child with parent for LLM
            r_copy["child_text"] = r.get("text", "")  # Keep child for reference
        enriched.append(r_copy)

    resolved_count = sum(
        1 for r in enriched if r.get("parent_text")
    )
    logger.info(
        f"Parent resolution: {resolved_count}/{len(child_results)} "
        f"chunks enriched with parent context"
    )

    return enriched


# ---------------------------------------------------------------------------
# Context Assembly
# ---------------------------------------------------------------------------

def build_context(
    teacher_material_chunks: List[Dict[str, Any]],
    transcript_chunks: List[Dict[str, Any]],
    kb_chunks: List[Dict[str, Any]],
    external_knowledge: str = "",
    query: str = "",
    max_context_tokens: int = 8000,
    enable_compression: bool = True,
) -> BuiltContext:
    """
    Build the final context string for LLM consumption.

    Assembles chunks from all sources with:
    - Priority ordering (teacher > KB > transcript > external)
    - Citation IDs for grounded generation
    - Token budget management
    - Contextual compression
    - Deduplication

    Args:
        teacher_material_chunks: Chunks from teacher-uploaded materials.
        transcript_chunks:       Chunks from lecture transcript.
        kb_chunks:              Chunks from unit knowledge base.
        external_knowledge:     Pre-formatted external knowledge string.
        query:                  The search query (for compression).
        max_context_tokens:     Maximum token budget for context.
        enable_compression:     Whether to compress chunks.

    Returns:
        BuiltContext with assembled context, citations, and metadata.
    """
    citations: List[CitedChunk] = []
    citation_map: Dict[str, str] = {}
    citation_counter = 1
    total_chars = 0
    max_chars = max_context_tokens * 4  # Rough token-to-char conversion
    chunks_compressed = 0

    # --- Deduplicate each source ---
    all_chunks = teacher_material_chunks + kb_chunks + transcript_chunks
    deduped, dedup_count = deduplicate_chunks(all_chunks)

    # Re-separate by source
    deduped_teacher = [c for c in deduped if c.get("source") == "teacher_material"]
    deduped_kb = [c for c in deduped if c.get("source") in ("knowledge_base", "teacher_material")
                  and c not in deduped_teacher]
    deduped_transcript = [c for c in deduped if c.get("source") == "lecture_transcript"]

    # If re-separation lost some, put them in transcript
    accounted = set(id(c) for c in deduped_teacher + deduped_kb + deduped_transcript)
    for c in deduped:
        if id(c) not in accounted:
            deduped_transcript.append(c)

    # --- Build context sections ---
    context_parts: List[str] = []

    def _add_source_section(
        section_label: str,
        chunks: List[Dict[str, Any]],
        source_type: str,
        priority_budget_pct: float,
    ):
        nonlocal citation_counter, total_chars, chunks_compressed

        if not chunks:
            return

        section_budget = int(max_chars * priority_budget_pct)
        section_chars = 0
        section_parts: List[str] = [f"=== {section_label} ==="]

        for chunk in chunks:
            text = chunk.get("text", "")
            if not text:
                continue

            # Contextual compression
            if enable_compression and query:
                original_len = len(text)
                text = compress_chunk(text, query)
                if len(text) < original_len:
                    chunks_compressed += 1

            # Token budget check
            if section_chars + len(text) > section_budget:
                break
            if total_chars + len(text) > max_chars:
                break

            # Assign citation ID
            cid = f"[S{citation_counter}]"
            citation_counter += 1

            heading = chunk.get("metadata", {}).get("section_heading", "")
            score = chunk.get("combined_score", chunk.get("score", 0.0))

            cited = CitedChunk(
                citation_id=cid,
                text=text,
                source_type=source_type,
                section_heading=heading,
                relevance_score=score,
                metadata=chunk.get("metadata", {}),
            )
            citations.append(cited)
            citation_map[cid] = text

            # Format chunk with citation marker
            header = f"{cid}"
            if heading:
                header += f" ({heading})"
            section_parts.append(f"{header}:\n{text}")

            section_chars += len(text)
            total_chars += len(text)

        if len(section_parts) > 1:  # More than just the header
            context_parts.append("\n\n".join(section_parts))

    # Add sections in priority order
    _add_source_section(
        "TEACHER-PROVIDED MATERIALS (PRIMARY AUTHORITY)",
        deduped_teacher,
        "teacher_material",
        priority_budget_pct=0.40,
    )

    _add_source_section(
        "UNIT KNOWLEDGE BASE MATERIALS",
        deduped_kb,
        "knowledge_base",
        priority_budget_pct=0.20,
    )

    _add_source_section(
        "LECTURE TRANSCRIPT EXCERPTS",
        deduped_transcript,
        "lecture_transcript",
        priority_budget_pct=0.25,
    )

    # External knowledge (pre-formatted, no citation tracking)
    if external_knowledge:
        ext_budget = int(max_chars * 0.15)
        ext_text = external_knowledge[:ext_budget]
        context_parts.append(ext_text)
        total_chars += len(ext_text)

    # --- Assemble final context ---
    if not context_parts:
        context_text = "No additional context available."
    else:
        # Add citation usage instructions at the top
        citation_header = (
            "CONTEXT SOURCES (use citation IDs like [S1], [S2] for grounding):\n"
            "Each source is marked with a citation ID. Ground your output in "
            "these specific sources.\n\n"
        )
        context_text = citation_header + "\n\n".join(context_parts)

    token_estimate = len(context_text) // 4

    logger.info(
        f"Context built: {len(citations)} cited chunks, "
        f"~{token_estimate} tokens, "
        f"{dedup_count} deduplicated, "
        f"{chunks_compressed} compressed"
    )

    return BuiltContext(
        context_text=context_text,
        citations=citations,
        citation_map=citation_map,
        total_tokens_estimate=token_estimate,
        chunks_used=len(citations),
        chunks_deduplicated=dedup_count,
        chunks_compressed=chunks_compressed,
        retrieval_metadata={
            "teacher_chunks": len(deduped_teacher),
            "kb_chunks": len(deduped_kb),
            "transcript_chunks": len(deduped_transcript),
            "has_external_knowledge": bool(external_knowledge),
        },
    )
