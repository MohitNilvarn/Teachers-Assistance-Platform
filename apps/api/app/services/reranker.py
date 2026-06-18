# File: app/services/reranker.py
"""
Cross-encoder Re-ranking Service — Production-grade.

After initial retrieval (vector search + BM25), the results often contain
chunks that are superficially similar but not truly relevant.  A cross-encoder
re-ranker evaluates each (query, chunk) pair jointly, producing a much more
accurate relevance score than bi-encoder similarity alone.

This is the exact approach used by NotebookLM, Perplexity, and every
production RAG system that needs precision.

Architecture:
    1. Initial retrieval returns ~20-40 candidate chunks.
    2. Cross-encoder scores each (query, chunk) pair → relevance score.
    3. Top-K most relevant chunks (after re-ranking) are returned.
    4. Low-relevance chunks are filtered out via a configurable threshold.

Model:
    Uses `cross-encoder/ms-marco-MiniLM-L-6-v2` — a lightweight but
    effective re-ranker that runs locally (no API costs).
"""
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass
import numpy as np

from app.core.logger import get_logger

logger = get_logger("TAP.Reranker")

# ---------------------------------------------------------------------------
# Global model instance (lazy-loaded)
# ---------------------------------------------------------------------------
_cross_encoder = None
_RERANKER_MODEL_NAME = "cross-encoder/ms-marco-MiniLM-L-6-v2"


def _get_cross_encoder():
    """Lazy-load the cross-encoder model."""
    global _cross_encoder
    if _cross_encoder is None:
        try:
            from sentence_transformers import CrossEncoder

            logger.info(f"Loading cross-encoder model: {_RERANKER_MODEL_NAME}")
            _cross_encoder = CrossEncoder(
                _RERANKER_MODEL_NAME,
                max_length=512,
            )
            logger.info("Cross-encoder loaded successfully.")
        except ImportError:
            logger.warning(
                "sentence-transformers CrossEncoder not available. "
                "Re-ranking will use fallback scoring."
            )
            _cross_encoder = "unavailable"
        except Exception as e:
            logger.warning(f"Failed to load cross-encoder: {e}")
            _cross_encoder = "unavailable"

    return _cross_encoder


# ---------------------------------------------------------------------------
# Data structures
# ---------------------------------------------------------------------------

@dataclass
class RerankedResult:
    """A search result after re-ranking."""
    chunk_id: str
    text: str
    metadata: Dict[str, Any]
    initial_score: float       # Score from vector/BM25 search
    rerank_score: float        # Score from cross-encoder
    combined_score: float      # Weighted combination
    source: str
    lecture_id: Optional[str] = None
    parent_id: Optional[str] = None


# ---------------------------------------------------------------------------
# Re-ranking functions
# ---------------------------------------------------------------------------

def rerank_results(
    query: str,
    results: List[Dict[str, Any]],
    top_k: int = 10,
    relevance_threshold: float = 0.1,
    initial_weight: float = 0.3,
    rerank_weight: float = 0.7,
) -> List[RerankedResult]:
    """
    Re-rank search results using a cross-encoder.

    Args:
        query:                The search query string.
        results:              List of initial search results (dicts with
                              'text', 'score', 'id', 'metadata' keys).
        top_k:                Maximum results to return after re-ranking.
        relevance_threshold:  Minimum rerank score to include a result.
        initial_weight:       Weight for initial retrieval score (0-1).
        rerank_weight:        Weight for cross-encoder score (0-1).

    Returns:
        Top-K re-ranked results, sorted by combined score.
    """
    if not results:
        return []

    encoder = _get_cross_encoder()

    if encoder == "unavailable" or encoder is None:
        # Fallback: just return results sorted by initial score
        logger.debug("Cross-encoder unavailable, using initial scores only")
        return _fallback_rerank(results, top_k)

    # Prepare pairs for cross-encoder
    pairs = [(query, r.get("text", "")) for r in results]

    try:
        # Cross-encoder scoring — batch predict
        scores = encoder.predict(pairs, show_progress_bar=False)

        # Normalize cross-encoder scores to [0, 1]
        scores = np.array(scores, dtype=np.float64)
        score_min = scores.min()
        score_max = scores.max()
        if score_max > score_min:
            normalized = (scores - score_min) / (score_max - score_min)
        else:
            normalized = np.ones_like(scores) * 0.5

        # Build re-ranked results
        reranked: List[RerankedResult] = []
        for i, result in enumerate(results):
            initial_score = float(result.get("score", 0.0))
            rerank_score = float(normalized[i])

            # Skip below threshold
            if rerank_score < relevance_threshold:
                continue

            combined = (
                initial_weight * initial_score
                + rerank_weight * rerank_score
            )

            reranked.append(RerankedResult(
                chunk_id=result.get("id", ""),
                text=result.get("text", ""),
                metadata=result.get("metadata", {}),
                initial_score=initial_score,
                rerank_score=rerank_score,
                combined_score=combined,
                source=result.get("source", "unknown"),
                lecture_id=result.get("lecture_id"),
                parent_id=result.get("metadata", {}).get("parent_id"),
            ))

        # Sort by combined score (descending)
        reranked.sort(key=lambda x: x.combined_score, reverse=True)

        logger.info(
            f"Re-ranking: {len(results)} candidates → {min(top_k, len(reranked))} "
            f"results (threshold={relevance_threshold})"
        )

        return reranked[:top_k]

    except Exception as e:
        logger.warning(f"Cross-encoder re-ranking failed: {e}")
        return _fallback_rerank(results, top_k)


def _fallback_rerank(
    results: List[Dict[str, Any]], top_k: int
) -> List[RerankedResult]:
    """Fallback when cross-encoder is unavailable: use initial scores."""
    reranked = []
    for r in results:
        score = float(r.get("score", 0.0))
        reranked.append(RerankedResult(
            chunk_id=r.get("id", ""),
            text=r.get("text", ""),
            metadata=r.get("metadata", {}),
            initial_score=score,
            rerank_score=score,
            combined_score=score,
            source=r.get("source", "unknown"),
            lecture_id=r.get("lecture_id"),
            parent_id=r.get("metadata", {}).get("parent_id"),
        ))

    reranked.sort(key=lambda x: x.combined_score, reverse=True)
    return reranked[:top_k]


# ---------------------------------------------------------------------------
# Diversity-aware re-ranking
# ---------------------------------------------------------------------------

def rerank_with_diversity(
    query: str,
    results: List[Dict[str, Any]],
    top_k: int = 10,
    relevance_threshold: float = 0.1,
    diversity_penalty: float = 0.1,
) -> List[RerankedResult]:
    """
    Re-rank with Maximal Marginal Relevance (MMR) to ensure diversity.

    Prevents the top results from all coming from the same section or
    covering the same narrow subtopic.  Critical for comprehensive
    content generation.

    Args:
        query:              Search query.
        results:            Initial search results.
        top_k:              Max results to return.
        relevance_threshold: Min cross-encoder score.
        diversity_penalty:  Penalty for similarity to already-selected results.

    Returns:
        Diverse, re-ranked results.
    """
    # First, do standard re-ranking
    candidates = rerank_results(
        query, results,
        top_k=min(top_k * 3, len(results)),  # Get more candidates
        relevance_threshold=relevance_threshold,
    )

    if len(candidates) <= top_k:
        return candidates

    # MMR selection
    selected: List[RerankedResult] = []
    remaining = list(candidates)

    while remaining and len(selected) < top_k:
        best_idx = 0
        best_mmr_score = -float("inf")

        for i, candidate in enumerate(remaining):
            # Relevance component
            relevance = candidate.combined_score

            # Diversity component: penalize similarity to already selected
            max_sim_to_selected = 0.0
            for sel in selected:
                sim = _compute_text_similarity(candidate.text, sel.text)
                max_sim_to_selected = max(max_sim_to_selected, sim)

            # Also penalize same section
            if selected:
                for sel in selected:
                    if (candidate.metadata.get("section_index")
                            == sel.metadata.get("section_index")
                            and candidate.metadata.get("section_index") is not None):
                        max_sim_to_selected = max(max_sim_to_selected, 0.5)

            mmr_score = relevance - diversity_penalty * max_sim_to_selected

            if mmr_score > best_mmr_score:
                best_mmr_score = mmr_score
                best_idx = i

        selected.append(remaining.pop(best_idx))

    logger.info(
        f"Diversity re-ranking: {len(candidates)} candidates → "
        f"{len(selected)} diverse results"
    )

    return selected


def _compute_text_similarity(text_a: str, text_b: str) -> float:
    """Quick Jaccard similarity for MMR diversity check."""
    words_a = set(text_a.lower().split())
    words_b = set(text_b.lower().split())
    if not words_a or not words_b:
        return 0.0
    intersection = words_a & words_b
    union = words_a | words_b
    return len(intersection) / len(union)
