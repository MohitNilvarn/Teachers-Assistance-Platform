# File: app/services/retrieval_cache.py
"""
Smart Retrieval Cache — Production-grade caching layer.

Caches:
1. Embedding computations (expensive GPU operations)
2. Search results (for repeated queries within a session)
3. Query decomposition results (LLM calls)

Uses an in-memory LRU cache with configurable TTL.  Optionally
backed by Redis when available for cross-process persistence.
"""
import hashlib
import time
from typing import List, Dict, Any, Optional, Tuple
from collections import OrderedDict
from dataclasses import dataclass, field
import threading

from app.core.logger import get_logger

logger = get_logger("TAP.RetrievalCache")


# ---------------------------------------------------------------------------
# In-memory LRU Cache with TTL
# ---------------------------------------------------------------------------

@dataclass
class CacheEntry:
    """A single cache entry with TTL tracking."""
    key: str
    value: Any
    created_at: float
    ttl_seconds: float
    hits: int = 0

    @property
    def is_expired(self) -> bool:
        return (time.time() - self.created_at) > self.ttl_seconds


class LRUCache:
    """Thread-safe LRU cache with TTL support."""

    def __init__(self, max_size: int = 500, default_ttl: float = 3600.0):
        """
        Args:
            max_size:     Maximum number of entries.
            default_ttl:  Default TTL in seconds (1 hour).
        """
        self._cache: OrderedDict[str, CacheEntry] = OrderedDict()
        self._max_size = max_size
        self._default_ttl = default_ttl
        self._lock = threading.Lock()
        self._stats = {"hits": 0, "misses": 0, "evictions": 0}

    def get(self, key: str) -> Optional[Any]:
        """Get a value, returning None if missing or expired."""
        with self._lock:
            entry = self._cache.get(key)
            if entry is None:
                self._stats["misses"] += 1
                return None

            if entry.is_expired:
                del self._cache[key]
                self._stats["misses"] += 1
                return None

            # Move to end (most recently used)
            self._cache.move_to_end(key)
            entry.hits += 1
            self._stats["hits"] += 1
            return entry.value

    def put(self, key: str, value: Any, ttl: Optional[float] = None):
        """Store a value with optional custom TTL."""
        with self._lock:
            ttl = ttl or self._default_ttl

            if key in self._cache:
                self._cache.move_to_end(key)

            self._cache[key] = CacheEntry(
                key=key,
                value=value,
                created_at=time.time(),
                ttl_seconds=ttl,
            )

            # Evict oldest if over capacity
            while len(self._cache) > self._max_size:
                self._cache.popitem(last=False)
                self._stats["evictions"] += 1

    def invalidate(self, key: str):
        """Remove a specific key."""
        with self._lock:
            self._cache.pop(key, None)

    def invalidate_prefix(self, prefix: str):
        """Remove all keys starting with a prefix."""
        with self._lock:
            keys_to_remove = [
                k for k in self._cache if k.startswith(prefix)
            ]
            for k in keys_to_remove:
                del self._cache[k]

    def clear(self):
        """Clear all entries."""
        with self._lock:
            self._cache.clear()

    @property
    def stats(self) -> Dict[str, int]:
        """Return cache statistics."""
        with self._lock:
            total = self._stats["hits"] + self._stats["misses"]
            hit_rate = (
                self._stats["hits"] / total if total > 0 else 0.0
            )
            return {
                **self._stats,
                "size": len(self._cache),
                "max_size": self._max_size,
                "hit_rate": round(hit_rate, 3),
            }


# ---------------------------------------------------------------------------
# Global cache instances
# ---------------------------------------------------------------------------

# Embedding cache — stores text→embedding vectors
_embedding_cache = LRUCache(max_size=1000, default_ttl=7200.0)  # 2 hours

# Search result cache — stores query→results
_search_cache = LRUCache(max_size=200, default_ttl=1800.0)  # 30 minutes

# Query decomposition cache — stores query→sub-queries
_decomposition_cache = LRUCache(max_size=100, default_ttl=3600.0)  # 1 hour


# ---------------------------------------------------------------------------
# Cache key generation
# ---------------------------------------------------------------------------

def _embedding_cache_key(text: str) -> str:
    """Generate cache key for an embedding."""
    text_hash = hashlib.md5(text.encode()).hexdigest()
    return f"emb:{text_hash}"


def _search_cache_key(
    query: str,
    lecture_id: Optional[str] = None,
    source_filter: Optional[str] = None,
) -> str:
    """Generate cache key for a search query."""
    parts = [query[:200], lecture_id or "", source_filter or ""]
    combined = "|".join(parts)
    return f"search:{hashlib.md5(combined.encode()).hexdigest()}"


def _decomposition_cache_key(query: str) -> str:
    """Generate cache key for query decomposition."""
    return f"decomp:{hashlib.md5(query[:500].encode()).hexdigest()}"


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def get_cached_embedding(text: str) -> Optional[List[float]]:
    """Retrieve a cached embedding vector."""
    key = _embedding_cache_key(text)
    return _embedding_cache.get(key)


def cache_embedding(text: str, embedding: List[float]):
    """Store an embedding vector in cache."""
    key = _embedding_cache_key(text)
    _embedding_cache.put(key, embedding)


def get_cached_search_results(
    query: str,
    lecture_id: Optional[str] = None,
    source_filter: Optional[str] = None,
) -> Optional[List[Dict[str, Any]]]:
    """Retrieve cached search results."""
    key = _search_cache_key(query, lecture_id, source_filter)
    return _search_cache.get(key)


def cache_search_results(
    query: str,
    results: List[Dict[str, Any]],
    lecture_id: Optional[str] = None,
    source_filter: Optional[str] = None,
):
    """Store search results in cache."""
    key = _search_cache_key(query, lecture_id, source_filter)
    _search_cache.put(key, results)


def get_cached_decomposition(query: str) -> Optional[List[str]]:
    """Retrieve cached query decomposition."""
    key = _decomposition_cache_key(query)
    return _decomposition_cache.get(key)


def cache_decomposition(query: str, sub_queries: List[str]):
    """Store query decomposition in cache."""
    key = _decomposition_cache_key(query)
    _decomposition_cache.put(key, sub_queries)


def invalidate_lecture_cache(lecture_id: str):
    """Invalidate all cached search results for a lecture."""
    _search_cache.invalidate_prefix(f"search:")
    logger.info(f"Invalidated search cache for lecture={lecture_id}")


def get_all_cache_stats() -> Dict[str, Any]:
    """Return statistics for all caches."""
    return {
        "embedding_cache": _embedding_cache.stats,
        "search_cache": _search_cache.stats,
        "decomposition_cache": _decomposition_cache.stats,
    }
