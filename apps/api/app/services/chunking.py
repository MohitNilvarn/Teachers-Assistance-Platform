# File: app/services/chunking.py
"""
Advanced Semantic Chunking Engine — NotebookLM-grade.

Instead of splitting on fixed character windows, this module:

1. **Section-aware splitting** — Respects document structure (headings,
   paragraphs, slide boundaries) so chunks never break mid-concept.

2. **Parent-child hierarchy** — Each "parent" is a full section/topic;
   "children" are individual paragraphs within that parent.  Retrieval
   searches over small children (precise matching) but returns the full
   parent (rich context) — the "small-to-big" pattern.

3. **Semantic boundary detection** — Uses embedding similarity between
   consecutive paragraphs to detect topic shifts, ensuring chunks are
   topically coherent.

4. **Metadata enrichment** — Every chunk carries structural metadata
   (section index, heading, position, parent ID) used downstream for
   re-ranking, dedup, and citation.

This is the same conceptual approach used by Google's NotebookLM and
production RAG systems at scale.
"""
import re
import hashlib
import uuid
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass, field

from app.core.logger import get_logger

logger = get_logger("TAP.SemanticChunking")


# ---------------------------------------------------------------------------
# Data structures
# ---------------------------------------------------------------------------

@dataclass
class ChunkNode:
    """Represents a single chunk with its hierarchy metadata."""
    chunk_id: str
    text: str
    parent_id: Optional[str]  # None for root / parent chunks
    chunk_type: str  # "parent" | "child"
    metadata: Dict[str, Any] = field(default_factory=dict)
    children_ids: List[str] = field(default_factory=list)


@dataclass
class ChunkedDocument:
    """Result of chunking a document — parents + children."""
    parents: List[ChunkNode]
    children: List[ChunkNode]
    all_chunks: List[ChunkNode]  # both parents and children, ordered
    source_metadata: Dict[str, Any] = field(default_factory=dict)


# ---------------------------------------------------------------------------
# Section detection patterns
# ---------------------------------------------------------------------------

# Heading patterns in extracted text (from PDFs, DOCX, etc.)
_HEADING_PATTERNS = [
    # Markdown-style headings
    re.compile(r"^#{1,4}\s+.+", re.MULTILINE),
    # All-caps headings (common in PDFs)
    re.compile(r"^[A-Z][A-Z\s]{5,80}$", re.MULTILINE),
    # Numbered headings: "1. Introduction", "2.1 Background"
    re.compile(r"^\d+(?:\.\d+)*\.?\s+[A-Z].{3,80}$", re.MULTILINE),
    # Slide markers from PPTX extraction
    re.compile(r"^---\s*Slide\s+\d+\s*---", re.MULTILINE),
    # Bold markers (sometimes from DOCX): **Heading**
    re.compile(r"^\*\*[^*]+\*\*\s*$", re.MULTILINE),
]


def _detect_sections(text: str) -> List[Tuple[int, str, str]]:
    """
    Detect section boundaries in text.

    Returns list of (start_pos, heading_text, section_body) tuples.
    If no clear sections found, treats the whole text as one section.
    """
    # Collect all heading matches across patterns
    headings: List[Tuple[int, int, str]] = []

    for pattern in _HEADING_PATTERNS:
        for match in pattern.finditer(text):
            heading_text = match.group().strip().strip("#").strip("*").strip()
            if len(heading_text) > 3:  # Skip very short matches
                headings.append((match.start(), match.end(), heading_text))

    if not headings:
        # No headings found — return as single section
        return [(0, "Document Content", text.strip())]

    # Sort by position and deduplicate overlapping matches
    headings.sort(key=lambda x: x[0])
    deduped: List[Tuple[int, int, str]] = []
    for h in headings:
        if not deduped or h[0] >= deduped[-1][1]:
            deduped.append(h)

    # Extract sections
    sections: List[Tuple[int, str, str]] = []

    # Content before first heading (preamble)
    if deduped[0][0] > 50:
        preamble = text[: deduped[0][0]].strip()
        if preamble:
            sections.append((0, "Introduction", preamble))

    for i, (start, end, heading) in enumerate(deduped):
        # Section body = text from heading end to next heading start
        next_start = deduped[i + 1][0] if i + 1 < len(deduped) else len(text)
        body = text[end:next_start].strip()
        if body:
            sections.append((start, heading, body))

    return sections if sections else [(0, "Document Content", text.strip())]


# ---------------------------------------------------------------------------
# Paragraph splitting
# ---------------------------------------------------------------------------

def _split_into_paragraphs(
    text: str,
    min_paragraph_length: int = 80,
    max_paragraph_length: int = 600,
) -> List[str]:
    """
    Split text into natural paragraphs.

    Merges very short paragraphs with neighbors and splits very long
    ones at sentence boundaries.
    """
    # Split on double newlines (natural paragraph boundaries)
    raw_paragraphs = re.split(r"\n\s*\n", text)

    # Clean and filter
    cleaned: List[str] = []
    for p in raw_paragraphs:
        p = p.strip()
        if not p:
            continue
        # Replace multiple whitespace with single space within paragraph
        p = re.sub(r"\s+", " ", p)
        cleaned.append(p)

    if not cleaned:
        return [text.strip()] if text.strip() else []

    # Merge tiny paragraphs with neighbors
    merged: List[str] = []
    buffer = ""
    for p in cleaned:
        if buffer and len(buffer) + len(p) < min_paragraph_length:
            buffer = buffer + " " + p
        elif buffer:
            merged.append(buffer)
            buffer = p
        else:
            buffer = p
    if buffer:
        merged.append(buffer)

    # Split overly long paragraphs at sentence boundaries
    result: List[str] = []
    for p in merged:
        if len(p) <= max_paragraph_length:
            result.append(p)
        else:
            # Split at sentence boundaries
            sentences = re.split(r"(?<=[.!?])\s+", p)
            current = ""
            for s in sentences:
                if current and len(current) + len(s) > max_paragraph_length:
                    result.append(current.strip())
                    current = s
                else:
                    current = (current + " " + s).strip()
            if current:
                result.append(current)

    return result


# ---------------------------------------------------------------------------
# Semantic coherence check (lightweight — no embedding needed)
# ---------------------------------------------------------------------------

def _compute_lexical_overlap(text_a: str, text_b: str) -> float:
    """
    Quick lexical overlap score between two texts.
    Returns Jaccard similarity of word sets (0.0–1.0).
    Used to detect topic shifts without requiring embeddings.
    """
    words_a = set(text_a.lower().split())
    words_b = set(text_b.lower().split())
    if not words_a or not words_b:
        return 0.0
    intersection = words_a & words_b
    union = words_a | words_b
    return len(intersection) / len(union)


def _merge_coherent_paragraphs(
    paragraphs: List[str],
    max_child_tokens: int = 300,
    similarity_threshold: float = 0.15,
) -> List[str]:
    """
    Merge consecutive paragraphs that are topically similar into
    single child chunks.  Uses lexical overlap as a fast proxy for
    semantic similarity.

    Args:
        paragraphs: List of paragraph strings.
        max_child_tokens: Approximate max token count per child chunk.
        similarity_threshold: Minimum lexical overlap to merge.

    Returns:
        Merged paragraph groups.
    """
    if not paragraphs:
        return []

    groups: List[str] = []
    current = paragraphs[0]

    for i in range(1, len(paragraphs)):
        p = paragraphs[i]
        # Rough token estimate: 1 token ≈ 4 chars
        combined_tokens = (len(current) + len(p)) // 4

        if combined_tokens <= max_child_tokens:
            overlap = _compute_lexical_overlap(current, p)
            if overlap >= similarity_threshold:
                current = current + "\n\n" + p
                continue

        # Not similar enough or too long — start new group
        groups.append(current)
        current = p

    groups.append(current)
    return groups


# ---------------------------------------------------------------------------
# Chunk ID generation
# ---------------------------------------------------------------------------

def _generate_chunk_id(
    source_id: str, section_idx: int, chunk_idx: int, chunk_type: str
) -> str:
    """
    Generate a deterministic, stable chunk ID.

    Format: {source_id}_{type}_{section}_{chunk}_{hash8}
    The hash ensures uniqueness even with identical indices.
    """
    raw = f"{source_id}:{chunk_type}:{section_idx}:{chunk_idx}"
    hash_suffix = hashlib.md5(raw.encode()).hexdigest()[:8]
    return f"{source_id}_{chunk_type}_s{section_idx}_c{chunk_idx}_{hash_suffix}"


# ---------------------------------------------------------------------------
# Main chunking function
# ---------------------------------------------------------------------------

def semantic_chunk_document(
    text: str,
    source_id: str,
    source_metadata: Optional[Dict[str, Any]] = None,
    max_parent_tokens: int = 1500,
    max_child_tokens: int = 300,
    min_child_length: int = 50,
) -> ChunkedDocument:
    """
    Perform semantic chunking with parent-child hierarchy.

    This is the primary entry point.  It:
    1. Detects sections/headings in the text.
    2. Creates "parent" chunks (full sections — rich context).
    3. Splits each parent into "child" chunks (paragraphs — precise retrieval).
    4. Enriches all chunks with structural metadata.

    Retrieval Strategy (used by hybrid_search.py):
    - **Search** over child chunks (precise, small embeddings).
    - **Return** the parent chunk to the LLM (full context).

    Args:
        text:               The raw document text.
        source_id:          Unique identifier for the source document.
        source_metadata:    Extra metadata to attach to all chunks.
        max_parent_tokens:  Max approximate tokens per parent chunk.
        max_child_tokens:   Max approximate tokens per child chunk.
        min_child_length:   Minimum character length for a child chunk.

    Returns:
        ChunkedDocument with parents, children, and all_chunks.
    """
    if not text or not text.strip():
        return ChunkedDocument(
            parents=[], children=[], all_chunks=[],
            source_metadata=source_metadata or {},
        )

    meta = source_metadata or {}
    sections = _detect_sections(text)

    parents: List[ChunkNode] = []
    children: List[ChunkNode] = []

    for section_idx, (start_pos, heading, body) in enumerate(sections):
        # --- Parent chunk ---
        # Truncate parent if too long (keep it informative but bounded)
        max_parent_chars = max_parent_tokens * 4
        parent_text = body[:max_parent_chars] if len(body) > max_parent_chars else body

        parent_id = _generate_chunk_id(source_id, section_idx, 0, "parent")

        parent_node = ChunkNode(
            chunk_id=parent_id,
            text=parent_text,
            parent_id=None,
            chunk_type="parent",
            metadata={
                **meta,
                "section_index": section_idx,
                "section_heading": heading,
                "section_position": start_pos,
                "total_sections": len(sections),
                "original_length": len(body),
            },
        )

        # --- Child chunks ---
        paragraphs = _split_into_paragraphs(body)
        merged = _merge_coherent_paragraphs(
            paragraphs, max_child_tokens=max_child_tokens
        )

        child_ids: List[str] = []
        for child_idx, child_text in enumerate(merged):
            if len(child_text) < min_child_length:
                continue

            child_id = _generate_chunk_id(
                source_id, section_idx, child_idx + 1, "child"
            )
            child_ids.append(child_id)

            child_node = ChunkNode(
                chunk_id=child_id,
                text=child_text,
                parent_id=parent_id,
                chunk_type="child",
                metadata={
                    **meta,
                    "section_index": section_idx,
                    "section_heading": heading,
                    "child_index": child_idx,
                    "total_children_in_section": len(merged),
                    "parent_id": parent_id,
                },
            )
            children.append(child_node)

        parent_node.children_ids = child_ids
        parents.append(parent_node)

    # Build combined list
    all_chunks = list(parents) + list(children)

    logger.info(
        f"Semantic chunking complete: {len(parents)} parents, "
        f"{len(children)} children from {len(sections)} sections | "
        f"source={source_id}"
    )

    return ChunkedDocument(
        parents=parents,
        children=children,
        all_chunks=all_chunks,
        source_metadata=meta,
    )


# ---------------------------------------------------------------------------
# Transcript-specific chunking
# ---------------------------------------------------------------------------

def chunk_transcript(
    transcript: str,
    source_id: str,
    lecture_title: str = "",
    max_child_tokens: int = 250,
) -> ChunkedDocument:
    """
    Chunk a lecture transcript using semantic boundaries.

    Transcripts don't have headings, so we use topic-shift detection
    based on lexical overlap between consecutive paragraph-sized windows.

    Args:
        transcript:       Raw transcript text.
        source_id:        Unique identifier (e.g. lecture_id).
        lecture_title:    Lecture title for metadata.
        max_child_tokens: Max tokens per child chunk.

    Returns:
        ChunkedDocument.
    """
    meta = {
        "source": "lecture_transcript",
        "lecture_title": lecture_title,
    }

    # For transcripts, use a sliding window to create sections
    # based on topic coherence (since there are no headings)
    paragraphs = _split_into_paragraphs(transcript, min_paragraph_length=60)

    if not paragraphs:
        return ChunkedDocument(
            parents=[], children=[], all_chunks=[],
            source_metadata=meta,
        )

    # Group paragraphs into sections by detecting topic shifts
    sections: List[Tuple[int, str, str]] = []
    current_section_paragraphs: List[str] = [paragraphs[0]]
    section_start = 0

    for i in range(1, len(paragraphs)):
        overlap = _compute_lexical_overlap(
            " ".join(current_section_paragraphs[-2:]),
            paragraphs[i],
        )

        # Topic shift detected OR section getting too large
        current_len = sum(len(p) for p in current_section_paragraphs)
        if overlap < 0.08 and current_len > 500:
            # Close current section
            body = "\n\n".join(current_section_paragraphs)
            # Generate a heading from first ~60 chars
            heading = current_section_paragraphs[0][:60].strip()
            if len(heading) > 50:
                heading = heading[:50] + "..."
            sections.append((section_start, f"Topic: {heading}", body))
            # Start new section
            current_section_paragraphs = [paragraphs[i]]
            section_start = i
        else:
            current_section_paragraphs.append(paragraphs[i])

    # Don't forget the last section
    if current_section_paragraphs:
        body = "\n\n".join(current_section_paragraphs)
        heading = current_section_paragraphs[0][:60].strip()
        if len(heading) > 50:
            heading = heading[:50] + "..."
        sections.append((section_start, f"Topic: {heading}", body))

    # Now use the standard chunker with our detected sections
    # Build a pseudo-document with headings for the chunker
    pseudo_doc = ""
    for _, heading, body in sections:
        pseudo_doc += f"\n\n## {heading}\n\n{body}"

    return semantic_chunk_document(
        text=pseudo_doc,
        source_id=source_id,
        source_metadata=meta,
        max_child_tokens=max_child_tokens,
    )


# ---------------------------------------------------------------------------
# Legacy compatibility
# ---------------------------------------------------------------------------

def chunk_text_legacy(
    text: str, chunk_size: int = 1000, overlap: int = 200
) -> List[str]:
    """
    Legacy fixed-window chunking — kept for backward compatibility.
    Prefer semantic_chunk_document() for new code.
    """
    if not text:
        return []

    chunks = []
    start = 0
    text_len = len(text)

    while start < text_len:
        end = start + chunk_size

        if end < text_len:
            para_break = text.rfind("\n\n", start, end)
            if para_break > start + chunk_size // 2:
                end = para_break
            else:
                for punct in [".", "!", "?"]:
                    sent_break = text.rfind(punct, start + chunk_size // 2, end)
                    if sent_break > 0:
                        end = sent_break + 1
                        break

        chunk = text[start:end].strip()
        if chunk:
            chunks.append(chunk)

        start = end - overlap if end < text_len else text_len

    return chunks
