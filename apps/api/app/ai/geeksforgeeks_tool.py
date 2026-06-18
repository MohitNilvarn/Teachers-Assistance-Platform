# File: app/ai/geeksforgeeks_tool.py
"""
GeeksForGeeks knowledge retrieval tool for LangGraph.

Scrapes GeeksForGeeks articles for CS/engineering topics to provide
factually accurate reference material. Like the Wikipedia tool, GFG
content is used to *supplement and fact-check* — the teacher's material
and lecture transcript remain the primary source.

GFG is particularly useful for:
  - Data structures & algorithms
  - Programming concepts (OOP, design patterns)
  - Operating systems, DBMS, computer networks
  - System design and software engineering
"""
import httpx
import re
from typing import List, Dict, Optional
from app.core.logger import get_logger

logger = get_logger("TAP.GeeksForGeeks")

GFG_SEARCH_URL = "https://www.googleapis.com/customsearch/v1"
GFG_SITE = "geeksforgeeks.org"

# We use a lightweight HTML-to-text approach via GFG's own API-like
# page structure.  No JavaScript rendering needed — GFG articles are
# server-rendered with clean <article> tags.


async def search_geeksforgeeks(
    query: str,
    num_results: int = 3,
) -> List[Dict[str, str]]:
    """
    Search GeeksForGeeks for articles matching the query.
    
    Uses Google Custom Search (free tier: 100 queries/day) with
    site:geeksforgeeks.org restriction, then fetches article text.
    
    Falls back to direct GFG URL guessing if no API key is configured.
    
    Args:
        query: Search query derived from lecture content
        num_results: Max number of articles to return
    
    Returns:
        List of dicts with 'title', 'url', and 'content' keys
    """
    results: List[Dict[str, str]] = []

    try:
        # Strategy: Try fetching GFG articles by constructing likely URLs
        # from the query terms (GFG uses slug-style URLs like
        # geeksforgeeks.org/topic-name/)
        slugs = _generate_gfg_slugs(query)

        headers = {
            "User-Agent": (
                "TAP-EducationPlatform/1.0 "
                "(Teacher Assistance Platform; educational use)"
            ),
            "Accept": "text/html,application/xhtml+xml",
        }

        async with httpx.AsyncClient(
            timeout=12.0, headers=headers, follow_redirects=True
        ) as client:
            for slug in slugs[:num_results + 2]:  # Try a few extra in case some 404
                if len(results) >= num_results:
                    break

                url = f"https://www.geeksforgeeks.org/{slug}/"
                try:
                    resp = await client.get(url)
                    if resp.status_code == 200:
                        content = _extract_gfg_article_text(resp.text)
                        title = _extract_gfg_title(resp.text)
                        if content and len(content) > 100:
                            # Truncate long articles to keep context manageable
                            if len(content) > 3000:
                                content = content[:3000] + "..."
                            results.append({
                                "title": title or slug.replace("-", " ").title(),
                                "url": str(resp.url),
                                "content": content,
                            })
                            logger.info(
                                f"GFG: fetched '{title}' ({len(content)} chars)"
                            )
                except httpx.HTTPError as e:
                    logger.debug(f"GFG: failed to fetch {url}: {e}")
                    continue

        # If slug-based approach yielded nothing, try a DuckDuckGo-lite
        # search for site:geeksforgeeks.org
        if not results:
            results = await _search_gfg_via_duckduckgo(
                query, num_results, headers, 
            )

        logger.info(
            f"GFG: found {len(results)} articles for '{query}'"
        )

    except Exception as e:
        logger.warning(f"GFG search failed for '{query}': {e}")

    return results


def _generate_gfg_slugs(query: str) -> List[str]:
    """
    Generate candidate GFG URL slugs from a search query.
    
    GFG URLs follow the pattern: geeksforgeeks.org/topic-name/
    e.g. geeksforgeeks.org/cloud-computing/
         geeksforgeeks.org/binary-search-tree/
    """
    # Clean up the query
    query_clean = re.sub(r"[^a-zA-Z0-9\s]", "", query.lower()).strip()
    words = query_clean.split()

    slugs = []

    # Full query as slug
    if len(words) <= 6:
        slugs.append("-".join(words))

    # Remove common filler words for a tighter slug
    stop_words = {
        "the", "a", "an", "in", "of", "and", "or", "is", "are",
        "was", "were", "for", "to", "with", "on", "at", "by",
        "about", "what", "how", "why", "when", "which", "that",
        "this", "using", "used", "based",
    }
    filtered = [w for w in words if w not in stop_words]
    if filtered and filtered != words:
        slugs.append("-".join(filtered))

    # First 3 significant words
    if len(filtered) > 3:
        slugs.append("-".join(filtered[:3]))

    # Try with common GFG prefixes
    topic = "-".join(filtered[:4]) if filtered else "-".join(words[:4])
    for prefix in [
        f"{topic}-in-computer-science",
        f"introduction-to-{topic}",
        f"{topic}-in-operating-system",
        f"{topic}-in-dbms",
        f"{topic}-in-computer-networks",
    ]:
        if len(prefix) <= 60:
            slugs.append(prefix)

    return slugs


def _extract_gfg_title(html: str) -> str:
    """Extract the article title from a GFG page."""
    # GFG uses <h1> for the main title
    match = re.search(r"<h1[^>]*>(.*?)</h1>", html, re.DOTALL)
    if match:
        title = re.sub(r"<[^>]+>", "", match.group(1)).strip()
        return title
    
    # Fallback: <title> tag
    match = re.search(r"<title>(.*?)</title>", html)
    if match:
        title = match.group(1).split(" - ")[0].strip()
        return title

    return ""


def _extract_gfg_article_text(html: str) -> str:
    """
    Extract the main article text from a GFG HTML page.
    
    GFG articles use <article> or <div class="article-body"> as
    the main content container.  We strip all HTML tags and normalize
    whitespace.
    """
    # Try <article> tag first
    article_match = re.search(
        r"<article[^>]*>(.*?)</article>", html, re.DOTALL
    )
    if not article_match:
        # Fallback: div with text-container class
        article_match = re.search(
            r'<div[^>]*class="[^"]*text[^"]*"[^>]*>(.*?)</div>\s*</div>',
            html,
            re.DOTALL,
        )

    if not article_match:
        # Last resort: look for the main content area
        article_match = re.search(
            r'<div[^>]*id="[^"]*content[^"]*"[^>]*>(.*?)</div>',
            html,
            re.DOTALL,
        )

    if not article_match:
        return ""

    content = article_match.group(1)

    # Remove script and style tags entirely
    content = re.sub(r"<script[^>]*>.*?</script>", "", content, flags=re.DOTALL)
    content = re.sub(r"<style[^>]*>.*?</style>", "", content, flags=re.DOTALL)

    # Remove navigation, ads, and related articles sections
    content = re.sub(
        r"<div[^>]*class=\"[^\"]*(?:related|recommended|ad-|sidebar)[^\"]*\"[^>]*>.*?</div>",
        "",
        content,
        flags=re.DOTALL,
    )

    # Convert <br>, <p>, <li>, <h2>, <h3> to newlines for readability
    content = re.sub(r"<br\s*/?>", "\n", content)
    content = re.sub(r"</p>", "\n\n", content)
    content = re.sub(r"</li>", "\n", content)
    content = re.sub(r"<h[2-6][^>]*>", "\n\n## ", content)
    content = re.sub(r"</h[2-6]>", "\n", content)

    # Strip remaining HTML tags
    content = re.sub(r"<[^>]+>", "", content)

    # Decode HTML entities
    content = (
        content.replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&nbsp;", " ")
        .replace("&quot;", '"')
        .replace("&#39;", "'")
    )

    # Normalize whitespace
    content = re.sub(r"\n{3,}", "\n\n", content)
    content = re.sub(r"[ \t]+", " ", content)
    content = content.strip()

    return content


async def _search_gfg_via_duckduckgo(
    query: str,
    num_results: int,
    headers: dict,
) -> List[Dict[str, str]]:
    """
    Fallback: use DuckDuckGo HTML search to find GFG articles.
    """
    results: List[Dict[str, str]] = []
    try:
        search_query = f"site:geeksforgeeks.org {query}"
        async with httpx.AsyncClient(
            timeout=10.0, headers=headers, follow_redirects=True
        ) as client:
            resp = await client.get(
                "https://html.duckduckgo.com/html/",
                params={"q": search_query},
            )
            if resp.status_code != 200:
                return results

            # Extract URLs from DuckDuckGo results
            urls = re.findall(
                r'href="(https?://(?:www\.)?geeksforgeeks\.org/[^"]+)"',
                resp.text,
            )
            seen_urls = set()
            for url in urls:
                if url in seen_urls or len(results) >= num_results:
                    break
                seen_urls.add(url)

                # Fetch the actual GFG page
                try:
                    page_resp = await client.get(url)
                    if page_resp.status_code == 200:
                        content = _extract_gfg_article_text(page_resp.text)
                        title = _extract_gfg_title(page_resp.text)
                        if content and len(content) > 100:
                            if len(content) > 3000:
                                content = content[:3000] + "..."
                            results.append({
                                "title": title or "GeeksForGeeks Article",
                                "url": url,
                                "content": content,
                            })
                except httpx.HTTPError:
                    continue

    except Exception as e:
        logger.debug(f"DuckDuckGo GFG search failed: {e}")

    return results


async def get_geeksforgeeks_context(
    lecture_title: str,
    key_topics: Optional[List[str]] = None,
) -> str:
    """
    Build a GFG reference context block from lecture topics.
    
    Searches GeeksForGeeks for the lecture title and any explicitly
    identified key topics, then returns a combined text block.
    
    Args:
        lecture_title: The title of the lecture
        key_topics: Optional list of specific topics to look up
    
    Returns:
        Formatted GFG context string, or empty string if nothing found
    """
    all_results: List[Dict[str, str]] = []
    seen_urls: set = set()

    # Search for the lecture title itself
    title_results = await search_geeksforgeeks(lecture_title, num_results=2)
    for r in title_results:
        if r.get("url") not in seen_urls:
            all_results.append(r)
            seen_urls.add(r.get("url", ""))

    # Search for each key topic
    if key_topics:
        for topic in key_topics[:4]:  # Limit to 4 topics
            topic_results = await search_geeksforgeeks(topic, num_results=1)
            for r in topic_results:
                if r.get("url") not in seen_urls:
                    all_results.append(r)
                    seen_urls.add(r.get("url", ""))

    if not all_results:
        return ""

    # Format as context block
    parts = ["=== GEEKSFORGEEKS REFERENCE CONTEXT ==="]
    parts.append(
        "(Use this ONLY to verify facts, supplement definitions, and improve "
        "accuracy. Teacher materials and lecture transcript remain the "
        "primary sources.)\n"
    )
    for r in all_results:
        parts.append(
            f"--- {r['title']} ---\n"
            f"Source: {r.get('url', 'geeksforgeeks.org')}\n"
            f"{r['content']}\n"
        )

    return "\n".join(parts)
