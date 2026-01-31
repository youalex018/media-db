#!/usr/bin/env python3
"""
Unit tests for TMDb cache TTL logic.
Run with: python test_cache.py

Expected output: standard unittest summary with 3 passing tests.
"""

import unittest
from datetime import datetime, timedelta, timezone

from app.library_service import TMDB_CACHE_TTL, is_tmdb_cache_fresh


class CacheTTLTests(unittest.TestCase):
    def test_tmdb_cache_fresh(self):
        now = datetime(2026, 1, 1, tzinfo=timezone.utc)
        fetched_at = now - (TMDB_CACHE_TTL - timedelta(days=1))
        self.assertTrue(is_tmdb_cache_fresh(fetched_at, now=now))

    def test_tmdb_cache_stale(self):
        now = datetime(2026, 1, 1, tzinfo=timezone.utc)
        fetched_at = now - (TMDB_CACHE_TTL + timedelta(days=1))
        self.assertFalse(is_tmdb_cache_fresh(fetched_at, now=now))

    def test_tmdb_cache_parses_iso_string(self):
        now = datetime(2026, 1, 1, tzinfo=timezone.utc)
        fetched_at = (now - timedelta(days=10)).isoformat().replace("+00:00", "Z")
        self.assertTrue(is_tmdb_cache_fresh(fetched_at, now=now))


if __name__ == "__main__":
    unittest.main()
