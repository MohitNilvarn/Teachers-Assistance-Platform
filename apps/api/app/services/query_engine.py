# File: app/services/query_engine.py
"""
Advanced Query Engine — Query Decomposition + HyDE.

This module implements two critical advanced RAG techniques:

1. **Query Decomposition** — Breaks a complex query into focused sub-queries,
   each targeting a specific aspect.  This ensures comprehensive retrieval
   across all relevant topics, not just the dominant keyword.

2. **HyDE (Hypothetical Document Embeddings)** — Instead of embedding the
   raw query, generates a *hypothetical answer* and embeds that.  This
   bridges the vocabulary gap between questions and answers, dramatically
   improving retrieval recall.

Together, these techniques are how NotebookLM and other production RAG
systems achieve near-perfect retrieval coverage.
"""
import asyncio
import re
from typing import List, Dict, Any, Optional, Tuple

from app.core.logger import get_logger
from app.ai.llm import generate_text
from app.services.embedding_service import generate_embedding, generate_embeddings

logger = get_logger("TAP.QueryEngine")


# ---------------------------------------------------------------------------
# Query Decomposition
# ---------------------------------------------------------------------------

async def decompose_query(
    query: str,
    lecture_title: str = "",
    max_sub_queries: int = 4,
) -> List[str]:
    """
    Decompose a complex query into focused sub-queries.

    For content generation, the "query" is typically the transcript
    summary.  This function extracts the distinct topics/concepts
    that need separate retrieval passes.

    Args:
        query:           The original query or transcript summary.
        lecture_title:   Lecture title for context.
        max_sub_queries: Maximum number of sub-queries to generate.

    Returns:
        List of sub-query strings.  Always includes the original
        query as the first element.
    """
    # If query is short, no decomposition needed
    if len(query) < 200:
        return [query]

    try:
        prompt = f"""You are a search query optimizer for an educational content retrieval system.

Given the following lecture summary, extract {max_sub_queries} distinct, focused search queries that together cover ALL the key topics, concepts, definitions, and techniques mentioned.

Each query should:
- Target a SPECIFIC concept or topic (not the whole lecture)
- Be 10-30 words long
- Use the exact technical terminology from the summary
- Be different from other queries (minimal overlap)

Lecture Title: {lecture_title}

Summary:
{query[:2000]}

Return ONLY the queries, one per line, numbered 1-{max_sub_queries}. No explanations."""

        response = await generate_text(
            prompt=prompt,
            system_prompt="You are a precise search query generator. Output only numbered queries.",
            temperature=0.2,
            max_tokens=500,
        )

        # Parse numbered queries
        sub_queries = []
        for line in response.strip().split("\n"):
            line = line.strip()
            # Remove numbering: "1. ", "1) ", "1: "
            cleaned = re.sub(r"^\d+[.):\-]\s*", "", line).strip()
            if cleaned and len(cleaned) > 10:
                sub_queries.append(cleaned)

        if not sub_queries:
            return [query[:500]]

        # Always include a condensed version of the original query
        sub_queries.insert(0, query[:500])

        logger.info(
            f"Query decomposition: 1 query → {len(sub_queries)} sub-queries"
        )

        return sub_queries[:max_sub_queries + 1]

    except Exception as e:
        logger.warning(f"Query decomposition failed, using original: {e}")
        return [query[:500]]


# ---------------------------------------------------------------------------
# HyDE — Hypothetical Document Embeddings
# ---------------------------------------------------------------------------

async def generate_hyde_embedding(
    query: str,
    lecture_title: str = "",
    subject_nature: str = "theoretical",
) -> List[float]:
    """
    Generate a Hypothetical Document Embedding (HyDE).

    Instead of embedding the raw query, this:
    1. Asks the LLM to write a hypothetical passage that WOULD answer
       the query (as if it were in the source material).
    2. Embeds that hypothetical passage.

    The resulting embedding is much closer in vector space to actual
    relevant documents than a raw query embedding would be.

    Args:
        query:           The search query or topic.
        lecture_title:   Lecture title for context.
        subject_nature:  "mathematical" or "theoretical" for tone matching.

    Returns:
        Embedding vector for the hypothetical document.
    """
    try:
        if subject_nature == "mathematical":
            style_hint = (
                "Include relevant formulas, equations, and technical definitions. "
                "Use precise engineering terminology."
            )
        else:
            style_hint = (
                "Include clear definitions, explanations, examples, and comparisons. "
                "Use precise domain-specific terminology."
            )

        prompt = f"""Write a detailed, factual passage (150-250 words) that would appear in lecture notes covering the following topic. Write as if this is directly from a university textbook or lecture handout.

{style_hint}

Topic: {lecture_title} — {query[:300]}

Write ONLY the passage, no preamble or metadata:"""

        hypothetical_doc = await generate_text(
            prompt=prompt,
            system_prompt="You are a university textbook author. Write factual, precise content.",
            temperature=0.3,
            max_tokens=400,
        )

        if not hypothetical_doc or len(hypothetical_doc.strip()) < 50:
            logger.warning("HyDE generation produced short output, using raw query")
            return generate_embedding(query[:500])

        # Embed the hypothetical document (not the raw query)
        hyde_embedding = generate_embedding(hypothetical_doc)

        logger.info(
            f"HyDE embedding generated: {len(hypothetical_doc)} char "
            f"hypothetical doc → {len(hyde_embedding)}-dim vector"
        )

        return hyde_embedding

    except Exception as e:
        logger.warning(f"HyDE generation failed, using raw query embedding: {e}")
        return generate_embedding(query[:500])


# ---------------------------------------------------------------------------
# Multi-query retrieval orchestrator
# ---------------------------------------------------------------------------

async def generate_multi_query_embeddings(
    query: str,
    lecture_title: str = "",
    subject_nature: str = "theoretical",
    use_hyde: bool = True,
    use_decomposition: bool = True,
    max_sub_queries: int = 4,
) -> List[Dict[str, Any]]:
    """
    Generate multiple query embeddings for comprehensive retrieval.

    Combines:
    1. Raw query embedding (baseline)
    2. HyDE embedding (hypothetical document)
    3. Sub-query embeddings (decomposed topics)

    Each embedding is tagged with its source for downstream fusion.

    Args:
        query:              Original query / transcript summary.
        lecture_title:      Lecture title.
        subject_nature:     "mathematical" or "theoretical".
        use_hyde:           Whether to generate HyDE embedding.
        use_decomposition:  Whether to decompose query.
        max_sub_queries:    Max sub-queries to generate.

    Returns:
        List of dicts: {"embedding": [...], "query_text": "...", "source": "..."}
    """
    results: List[Dict[str, Any]] = []

    # 1. Raw query embedding (always)
    raw_embedding = generate_embedding(query[:500])
    results.append({
        "embedding": raw_embedding,
        "query_text": query[:500],
        "source": "raw_query",
    })

    # Prepare async tasks
    tasks = []

    # 2. HyDE embedding
    if use_hyde:
        tasks.append(("hyde", generate_hyde_embedding(
            query=query[:500],
            lecture_title=lecture_title,
            subject_nature=subject_nature,
        )))

    # 3. Query decomposition
    if use_decomposition and len(query) > 200:
        tasks.append(("decompose", decompose_query(
            query=query,
            lecture_title=lecture_title,
            max_sub_queries=max_sub_queries,
        )))

    # Execute tasks in parallel
    if tasks:
        async_tasks = [t[1] for t in tasks]
        task_names = [t[0] for t in tasks]

        task_results = await asyncio.gather(*async_tasks, return_exceptions=True)

        for name, result in zip(task_names, task_results):
            if isinstance(result, Exception):
                logger.warning(f"Query engine task '{name}' failed: {result}")
                continue

            if name == "hyde":
                results.append({
                    "embedding": result,
                    "query_text": "(HyDE hypothetical document)",
                    "source": "hyde",
                })

            elif name == "decompose":
                # Generate embeddings for sub-queries (skip first, it's the original)
                sub_queries = result[1:]  # Skip original query
                if sub_queries:
                    sub_embeddings = generate_embeddings(sub_queries)
                    for sq, se in zip(sub_queries, sub_embeddings):
                        results.append({
                            "embedding": se,
                            "query_text": sq,
                            "source": "decomposed",
                        })

    logger.info(
        f"Multi-query engine produced {len(results)} query embeddings "
        f"(raw=1, hyde={'yes' if use_hyde else 'no'}, "
        f"decomposed={'yes' if use_decomposition else 'no'})"
    )

    return results
