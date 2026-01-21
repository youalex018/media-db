#!/usr/bin/env python3
"""
Tiny seed script to populate a couple of works and cached sources.
Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in backend/.env.
Run with: python seed_demo.py
"""

from app.config import get_config
from app.db import get_supabase_client


def seed_demo():
    config = get_config()
    if not config.SUPABASE_URL or not config.SUPABASE_SERVICE_ROLE_KEY:
        raise RuntimeError("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")

    supabase = get_supabase_client()

    works = [
        {
            "type": "movie",
            "title": "The Matrix",
            "year": 1999,
            "overview": "A computer hacker learns the truth about reality.",
            "tmdb_id": 603,
            "poster_url": "https://image.tmdb.org/t/p/w500/abcd.jpg",
        },
        {
            "type": "book",
            "title": "Dune",
            "year": 1965,
            "overview": "Epic science fiction novel.",
            "openlibrary_id": "OL123W",
            "isbn13": "9780441013593",
        },
    ]

    for work in works:
        conflict = "tmdb_id" if work.get("tmdb_id") else "openlibrary_id"
        supabase.table("works").upsert(work, on_conflict=conflict).execute()

    sources = [
        {
            "provider": "tmdb",
            "external_id": "603",
            "payload": {
                "id": 603,
                "title": "The Matrix",
                "release_date": "1999-03-30",
                "overview": "A computer hacker learns the truth about reality.",
                "poster_path": "/abcd.jpg",
                "original_language": "en",
            },
        },
        {
            "provider": "openlibrary",
            "external_id": "OL123W",
            "payload": {
                "key": "/works/OL123W",
                "title": "Dune",
                "first_publish_date": "1965",
                "description": {"value": "Epic science fiction novel."},
            },
        },
    ]

    for source in sources:
        supabase.table("sources").upsert(
            source, on_conflict="provider,external_id"
        ).execute()

    print("[SUCCESS] Demo seed completed")


if __name__ == "__main__":
    seed_demo()

