# File: app/ai/external_knowledge.py
"""
Unified external knowledge retrieval for LangGraph.

Orchestrates Wikipedia and GeeksForGeeks lookups to build a
fact-checked, topic-rich reference context that the LLM uses
*alongside* the transcript summary and teacher materials.

Key design decisions:
  1. Topics are intelligently extracted from the transcript summary
     (not raw transcript) so searches are precise.
  2. Both sources are queried in parallel for speed.
  3. Results are deduplicated and merged into a single context block
     with clear source attribution.
  4. The context block includes explicit instructions to the LLM about
     how to use external knowledge (verify, not invent).
  5. A "confidence markers" section is appended: key facts from
     external sources are listed so the evaluation engine can
     cross-check them against the generated content.
"""
import asyncio
import re
from typing import List, Dict, Any, Optional, Tuple

from app.core.logger import get_logger
from app.ai.wikipedia_tool import get_wikipedia_context, search_wikipedia
from app.ai.geeksforgeeks_tool import (
    get_geeksforgeeks_context,
    search_geeksforgeeks,
)

logger = get_logger("TAP.ExternalKnowledge")


def extract_key_topics(
    transcript_summary: str,
    lecture_title: str,
    max_topics: int = 6,
) -> List[str]:
    """
    Extract the most important topics from a transcript summary and
    lecture title for external knowledge lookup.
    
    Uses multiple heuristics:
      1. Capitalised multi-word terms (e.g. "Binary Search Tree")
      2. Technical terms from the title
      3. Key phrases that appear multiple times
    
    Args:
        transcript_summary: The cleaned transcript summary
        lecture_title: The lecture title
        max_topics: Maximum number of topics to extract
    
    Returns:
        List of topic strings, ordered by importance
    """
    topics: List[str] = []
    seen: set = set()

    def _add(topic: str):
        t = topic.strip()
        t_lower = t.lower()
        if t and len(t) > 3 and t_lower not in seen:
            seen.add(t_lower)
            topics.append(t)

    # 1. The lecture title itself (most important)
    _add(lecture_title)

    # 2. Capitalised multi-word technical terms from the summary
    # e.g. "Binary Search Tree", "Cloud Computing", "Operating System"
    cap_terms = re.findall(
        r"\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\b",
        transcript_summary,
    )
    for term in cap_terms:
        _add(term)

    # 3. Terms in quotes or bold (markdown-like patterns)
    quoted = re.findall(r'["\']([^"\']{4,40})["\']', transcript_summary)
    for q in quoted:
        _add(q)

    # 4. Technical terms from the title — split on common delimiters
    title_parts = re.split(r"[:\-–—,/|]", lecture_title)
    for part in title_parts:
        part = part.strip()
        if len(part) > 3:
            _add(part)

    # 5. Frequently mentioned terms (appear 3+ times in summary)
    # Extract significant 2-3 word phrases
    words = transcript_summary.lower().split()
    for n in [3, 2]:
        ngrams: Dict[str, int] = {}
        for i in range(len(words) - n + 1):
            phrase = " ".join(words[i : i + n])
            # Skip if mostly stop words
            stop_words = {
                "the", "a", "an", "in", "of", "and", "or", "is", "are",
                "was", "were", "for", "to", "with", "on", "at", "by",
                "it", "this", "that", "as", "be", "has", "have", "had",
                "not", "but", "from", "they", "we", "can", "will",
            }
            phrase_words = phrase.split()
            non_stop = [w for w in phrase_words if w not in stop_words]
            if len(non_stop) >= (n - 1):  # at least n-1 non-stop words
                ngrams[phrase] = ngrams.get(phrase, 0) + 1
        
        for phrase, count in sorted(
            ngrams.items(), key=lambda x: x[1], reverse=True
        ):
            if count >= 3:
                _add(phrase.title())

    return topics[:max_topics]


async def fetch_external_knowledge(
    lecture_title: str,
    transcript_summary: str,
    key_topics: Optional[List[str]] = None,
) -> Tuple[str, List[Dict[str, str]]]:
    """
    Fetch and merge knowledge from Wikipedia and GeeksForGeeks.
    
    Runs both sources in parallel for speed. Returns a formatted
    context block and a list of verified facts for cross-validation.
    
    Args:
        lecture_title: The lecture title
        transcript_summary: The cleaned transcript summary
        key_topics: Optional pre-extracted topics (if None, auto-extracted)
    
    Returns:
        Tuple of:
          - Combined external knowledge context string
          - List of fact dicts for cross-validation
    """
    if key_topics is None:
        key_topics = extract_key_topics(
            transcript_summary=transcript_summary,
            lecture_title=lecture_title,
        )

    logger.info(
        f"Fetching external knowledge for '{lecture_title}' | "
        f"topics: {key_topics[:5]}"
    )

    # Run Wikipedia and GFG lookups in parallel
    wiki_task = get_wikipedia_context(
        lecture_title=lecture_title,
        key_topics=key_topics[:5],
    )
    gfg_task = get_geeksforgeeks_context(
        lecture_title=lecture_title,
        key_topics=key_topics[:4],
    )

    wiki_context, gfg_context = await asyncio.gather(
        wiki_task, gfg_task, return_exceptions=True
    )

    # Handle exceptions gracefully
    if isinstance(wiki_context, Exception):
        logger.warning(f"Wikipedia fetch failed: {wiki_context}")
        wiki_context = ""
    if isinstance(gfg_context, Exception):
        logger.warning(f"GFG fetch failed: {gfg_context}")
        gfg_context = ""

    # Build combined context
    parts: List[str] = []
    verified_facts: List[Dict[str, str]] = []

    # Header with instructions
    parts.append(
        "╔══════════════════════════════════════════════════════════════╗\n"
        "║         EXTERNAL REFERENCE KNOWLEDGE (FACT-CHECK)          ║\n"
        "╚══════════════════════════════════════════════════════════════╝\n"
        "\n"
        "INSTRUCTIONS FOR USING THIS SECTION:\n"
        "1. This external knowledge is from Wikipedia and GeeksForGeeks.\n"
        "2. Use it to VERIFY facts, CORRECT inaccuracies, and SUPPLEMENT\n"
        "   definitions that appear in the transcript/teacher materials.\n"
        "3. NEVER use this as a substitute for the teacher's material —\n"
        "   the teacher's content is always the primary authority.\n"
        "4. If external sources CONTRADICT the teacher's material,\n"
        "   follow the teacher's version but you may note that\n"
        "   alternative views exist.\n"
        "5. You MAY use external definitions and explanations to\n"
        "   ENRICH content that the transcript mentions but doesn't\n"
        "   explain fully — but ONLY for topics the teacher actually\n"
        "   covered. Do NOT introduce entirely new topics.\n"
        "6. Always write content as your own explanation — NEVER cite\n"
        "   'according to Wikipedia' or 'as per GeeksForGeeks'.\n"
    )

    if wiki_context:
        parts.append(wiki_context)
        # Extract key facts for cross-validation
        wiki_facts = _extract_key_facts(wiki_context, source="Wikipedia")
        verified_facts.extend(wiki_facts)

    if gfg_context:
        parts.append(gfg_context)
        gfg_facts = _extract_key_facts(gfg_context, source="GeeksForGeeks")
        verified_facts.extend(gfg_facts)

    if not wiki_context and not gfg_context:
        logger.info("No external knowledge found (proceeding without)")
        return "", []

    # Add cross-validation markers
    if verified_facts:
        parts.append("\n=== VERIFIED KEY FACTS (for accuracy reference) ===")
        for i, fact in enumerate(verified_facts[:15], 1):
            parts.append(
                f"{i}. [{fact['source']}] {fact['fact']}"
            )

    combined = "\n\n".join(parts)
    logger.info(
        f"External knowledge assembled: "
        f"wiki={'yes' if wiki_context else 'no'}, "
        f"gfg={'yes' if gfg_context else 'no'}, "
        f"verified_facts={len(verified_facts)}, "
        f"total_chars={len(combined)}"
    )

    return combined, verified_facts


def _extract_key_facts(
    context: str, source: str, max_facts: int = 8
) -> List[Dict[str, str]]:
    """
    Extract key factual statements from external knowledge context.
    
    These are used by the evaluation engine to cross-validate that
    generated content is consistent with verified sources.
    
    Heuristic: extract sentences that contain definitions
    (identified by patterns like "X is a", "X refers to", "defined as").
    """
    facts: List[Dict[str, str]] = []

    # Split into sentences
    sentences = re.split(r"(?<=[.!?])\s+", context)

    definition_patterns = [
        r"\bis\s+(?:a|an|the|defined\s+as)",
        r"\brefers?\s+to",
        r"\bis\s+(?:called|known\s+as|termed)",
        r"\bcan\s+be\s+defined",
        r"\bmeans\s+that",
        r"\bconsists?\s+of",
        r"\binvolves?\s+",
        r"\bprovides?\s+",
        r"\benables?\s+",
        r"\ballows?\s+",
    ]
    pattern = re.compile("|".join(definition_patterns), re.IGNORECASE)

    for sentence in sentences:
        sentence = sentence.strip()
        if len(sentence) < 20 or len(sentence) > 300:
            continue
        # Skip headings and metadata lines
        if sentence.startswith("===") or sentence.startswith("---"):
            continue
        if sentence.startswith("Source:") or sentence.startswith("(Use this"):
            continue

        if pattern.search(sentence):
            facts.append({"source": source, "fact": sentence})
            if len(facts) >= max_facts:
                break

    return facts
