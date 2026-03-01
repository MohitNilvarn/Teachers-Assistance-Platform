# File: app/ai/wikipedia_tool.py
"""
Wikipedia fact-checking tool for LangGraph.

Provides a fallback knowledge source when teacher-provided materials and
lecture transcript are insufficient. Wikipedia content is used ONLY to
fact-check and supplement accuracy — never as the primary source.
"""
import httpx
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
        async with httpx.AsyncClient(timeout=10.0) as client:
            # Step 1: Search for matching pages
            search_params = {
                "action": "query",
                "list": "search",
                "srsearch": query,
                "srlimit": num_results,
                "format": "json",
            }
            search_resp = await client.get(WIKIPEDIA_API_URL, params=search_params)
            search_data = search_resp.json()

            page_titles = [
                r["title"]
                for r in search_data.get("query", {}).get("search", [])
            ]

            if not page_titles:
                logger.info(f"Wikipedia: no results for '{query}'")
                return results

            # Step 2: Get extracts for matched pages
            extract_params = {
                "action": "query",
                "titles": "|".join(page_titles),
                "prop": "extracts",
                "exintro": True,
                "explaintext": True,
                "exlimit": num_results,
                "format": "json",
            }
            extract_resp = await client.get(WIKIPEDIA_API_URL, params=extract_params)
            extract_data = extract_resp.json()

            pages = extract_data.get("query", {}).get("pages", {})
            for page in pages.values():
                title = page.get("title", "")
                extract = page.get("extract", "")
                if title and extract:
                    # Truncate long extracts to keep context manageable
                    if len(extract) > 2000:
                        extract = extract[:2000] + "..."
                    results.append({"title": title, "extract": extract})

            logger.info(
                f"Wikipedia: found {len(results)} articles for '{query}'"
            )

    except Exception as e:
        logger.warning(f"Wikipedia search failed for '{query}': {e}")

    return results


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
    parts = ["=== WIKIPEDIA FACT-CHECK CONTEXT ==="]
    parts.append(
        "(Use this ONLY to verify facts and improve accuracy. "
        "Teacher materials remain the primary source.)\n"
    )
    for r in all_results:
        parts.append(f"--- {r['title']} ---\n{r['extract']}\n")

    return "\n".join(parts)
