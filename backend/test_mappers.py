#!/usr/bin/env python3
"""
Unit tests for external source mappers.
Run with: python test_mappers.py
"""

import unittest

from app.mappers import (
    map_openlibrary_payload_to_work,
    map_tmdb_payload_to_work,
    normalize_openlibrary_search_doc,
    normalize_tmdb_search_item,
)


class MapperTests(unittest.TestCase):
    def test_normalize_tmdb_search_item_movie(self):
        item = {
            "id": 603,
            "media_type": "movie",
            "title": "The Matrix",
            "release_date": "1999-03-30",
            "overview": "A computer hacker learns about the true nature of reality.",
            "poster_path": "/poster.jpg",
            "original_language": "en",
        }
        normalized = normalize_tmdb_search_item(item)
        self.assertEqual(normalized["type"], "movie")
        self.assertEqual(normalized["title"], "The Matrix")
        self.assertEqual(normalized["year"], 1999)
        self.assertEqual(normalized["source"]["provider"], "tmdb")

    def test_map_tmdb_payload_to_work_tv(self):
        payload = {
            "id": 1399,
            "name": "Game of Thrones",
            "first_air_date": "2011-04-17",
            "overview": "Nine noble families fight for control over the lands.",
            "poster_path": "/poster.jpg",
            "original_language": "en",
            "episode_run_time": [55],
        }
        work = map_tmdb_payload_to_work(payload, "show")
        self.assertEqual(work["type"], "show")
        self.assertEqual(work["year"], 2011)
        self.assertEqual(work["runtime_minutes"], 55)
        self.assertEqual(work["tmdb_id"], 1399)

    def test_normalize_openlibrary_search_doc(self):
        doc = {
            "key": "/works/OL123W",
            "title": "Dune",
            "first_publish_year": 1965,
            "cover_i": 12345,
        }
        normalized = normalize_openlibrary_search_doc(doc)
        self.assertEqual(normalized["type"], "book")
        self.assertEqual(normalized["year"], 1965)
        self.assertEqual(normalized["source"]["external_id"], "OL123W")

    def test_map_openlibrary_payload_to_work(self):
        payload = {
            "key": "/works/OL123W",
            "title": "Dune",
            "first_publish_date": "1965",
            "description": {"value": "Epic science fiction novel."},
            "covers": [9876],
            "isbn_13": ["9780441013593"],
        }
        work = map_openlibrary_payload_to_work(payload)
        self.assertEqual(work["type"], "book")
        self.assertEqual(work["title"], "Dune")
        self.assertEqual(work["year"], 1965)
        self.assertEqual(work["openlibrary_id"], "OL123W")
        self.assertEqual(work["isbn13"], "9780441013593")


if __name__ == "__main__":
    unittest.main()

