# File: app/ai/wikipedia_tool.py
"""
Wikipedia knowledge retrieval tool for LangGraph.

Provides a fallback knowledge source when teacher-provided materials and
lecture transcript are insufficient. Wikipedia content is used to
fact-check AND supplement accuracy — the teacher's material and lecture
transcript always remain the primary sources.

Upgraded to fetch richer article content (not just intro extracts) so the
LLM has more substantive reference material for cross-validation.
"""
import httpx
import re
from typing import List, Dict, Optional
from app.core.logger import get_logger

logger = get_logger("TAP.Wikipedia")

WIKIPEDIA_API_URL = "https://en.wikipedia.org/w/api.php"


async def search_wikipedia(query: str, num_results: int = 3) -> List[Dict[str, str]]:
    """
    Search Wikipedia for articles matching the query.
    
    Args:
        query: Search query derived from lecture content
        num_results: Max number of articles to return
    
    Returns:
        List of dicts with 'title' and 'extract' keys
    """
    results: List[Dict[str, str]] = []
    
    try:
        headers = {
            # Wikipedia API policy requires User-Agent with contact info
            # See: https://meta.wikimedia.org/wiki/User-Agent_policy
            "User-Agent": (
                "TAP-EducationPlatform/1.0 "
                "(https://github.com/TAP-Education; tap.education.platform@gmail.com) "
                "python-httpx"
            ),
            "Accept": "application/json",
        }
        async with httpx.AsyncClient(timeout=10.0, headers=headers) as client:
            # Step 1: Search for matching pages
            search_params = {
                "action": "query",
                "list": "search",
                "srsearch": query,
                "srlimit": num_results,
                "format": "json",
            }
            search_resp = await client.get(WIKIPEDIA_API_URL, params=search_params)
            if search_resp.status_code != 200:
                logger.warning(
                    f"Wikipedia search HTTP {search_resp.status_code} for '{query}'"
                )
                return results
            search_data = search_resp.json()

            page_titles = [
                r["title"]
                for r in search_data.get("query", {}).get("search", [])
            ]

            if not page_titles:
                logger.info(f"Wikipedia: no results for '{query}'")
                return results

            # Step 2: Get FULL extracts (not just intro) for matched pages
            extract_params = {
                "action": "query",
                "titles": "|".join(page_titles),
                "prop": "extracts",
                "explaintext": True,
                "exlimit": num_results,
                "format": "json",
                # Removed "exintro: True" to get FULL article content
            }
            extract_resp = await client.get(WIKIPEDIA_API_URL, params=extract_params)
            if extract_resp.status_code != 200:
                logger.warning(
                    f"Wikipedia extract HTTP {extract_resp.status_code}"
                )
                return results
            extract_data = extract_resp.json()

            pages = extract_data.get("query", {}).get("pages", {})
            for page in pages.values():
                title = page.get("title", "")
                extract = page.get("extract", "")
                if title and extract:
                    # Clean up the extract — remove very short sections and
                    # the "See also", "References", "External links" cruft
                    extract = _clean_wikipedia_extract(extract)
                    # Truncate long extracts to keep context manageable
                    if len(extract) > 4000:
                        extract = extract[:4000] + "..."
                    results.append({"title": title, "extract": extract})

            logger.info(
                f"Wikipedia: found {len(results)} articles for '{query}'"
            )

    except Exception as e:
        logger.warning(f"Wikipedia search failed for '{query}': {e}")

    return results


def _clean_wikipedia_extract(text: str) -> str:
    """
    Clean a Wikipedia extract by removing non-useful trailing sections
    like 'See also', 'References', 'External links', 'Further reading',
    and 'Notes'.
    """
    # Remove everything after these headings
    for heading in [
        "== See also ==",
        "== References ==",
        "== External links ==",
        "== Further reading ==",
        "== Notes ==",
        "== Sources ==",
        "== Bibliography ==",
    ]:
        idx = text.find(heading)
        if idx != -1:
            text = text[:idx]

    # Also handle the plain-text equivalent (no == markers)
    for heading in [
        "\nSee also\n",
        "\nReferences\n",
        "\nExternal links\n",
        "\nFurther reading\n",
    ]:
        idx = text.find(heading)
        if idx != -1:
            text = text[:idx]

    return text.strip()


async def get_wikipedia_context(
    lecture_title: str,
    key_topics: Optional[List[str]] = None,
) -> str:
    """
    Build a Wikipedia fact-check context block from lecture topics.
    
    Searches Wikipedia for the lecture title and any explicitly identified
    key topics, then returns a combined text block.
    
    Args:
        lecture_title: The title of the lecture
        key_topics: Optional list of specific topics to look up
    
    Returns:
        Formatted Wikipedia context string, or empty string if nothing found
    """
    all_results: List[Dict[str, str]] = []
    seen_titles: set = set()

    # Search for the lecture title itself
    title_results = await search_wikipedia(lecture_title, num_results=2)
    for r in title_results:
        if r["title"] not in seen_titles:
            all_results.append(r)
            seen_titles.add(r["title"])

    # Search for each key topic
    if key_topics:
        for topic in key_topics[:5]:  # Limit to 5 topics
            topic_results = await search_wikipedia(topic, num_results=1)
            for r in topic_results:
                if r["title"] not in seen_titles:
                    all_results.append(r)
                    seen_titles.add(r["title"])

    if not all_results:
        return ""

    # Format as context block
    parts = ["=== WIKIPEDIA REFERENCE CONTEXT ==="]
    parts.append(
        "(Use this to verify facts, supplement definitions, and improve "
        "accuracy. Teacher materials and lecture transcript remain the "
        "primary sources.)\n"
    )
    for r in all_results:
        parts.append(f"--- {r['title']} ---\n{r['extract']}\n")

    return "\n".join(parts)
