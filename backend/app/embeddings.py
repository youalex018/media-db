"""Embedding service with circuit breaker for resilient vector generation.

Uses Google Gemini text-embedding-004 (768 dimensions) via the free-tier API.
Falls back gracefully when the embedding provider is unreachable or unconfigured.
"""
from __future__ import annotations

import logging
import time
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import requests

from .config import get_config
from .db import get_supabase_client

logger = logging.getLogger(__name__)

EMBEDDING_MODEL = "gemini-embedding-001"
EMBEDDING_DIMENSIONS = 768
GEMINI_EMBED_URL = (
    "https://generativelanguage.googleapis.com/v1beta"
    f"/models/{EMBEDDING_MODEL}:embedContent"
)

# ---------------------------------------------------------------------------
# Circuit Breaker
# ---------------------------------------------------------------------------

CIRCUIT_FAILURE_THRESHOLD = 3
CIRCUIT_COOLDOWN_SECONDS = 60

_circuit_state: Dict[str, Any] = {
    "consecutive_failures": 0,
    "opened_at": None,
}


def _circuit_is_open() -> bool:
    if _circuit_state["opened_at"] is None:
        return False
    elapsed = time.monotonic() - _circuit_state["opened_at"]
    if elapsed > CIRCUIT_COOLDOWN_SECONDS:
        _circuit_state["opened_at"] = None
        _circuit_state["consecutive_failures"] = 0
        logger.info("Circuit breaker closed (cooldown elapsed)")
        return False
    return True


def _record_success() -> None:
    _circuit_state["consecutive_failures"] = 0
    _circuit_state["opened_at"] = None


def _record_failure() -> None:
    _circuit_state["consecutive_failures"] += 1
    if _circuit_state["consecutive_failures"] >= CIRCUIT_FAILURE_THRESHOLD:
        _circuit_state["opened_at"] = time.monotonic()
        logger.warning(
            "Circuit breaker opened after %d consecutive failures",
            _circuit_state["consecutive_failures"],
        )


def circuit_breaker_status() -> Dict[str, Any]:
    return {
        "is_open": _circuit_is_open(),
        "consecutive_failures": _circuit_state["consecutive_failures"],
        "cooldown_seconds": CIRCUIT_COOLDOWN_SECONDS,
    }


# ---------------------------------------------------------------------------
# Embedding generation (Gemini)
# ---------------------------------------------------------------------------


def generate_embedding(text: str) -> Optional[List[float]]:
    """Generate a 768-dim embedding via Gemini. Returns None on failure."""
    config = get_config()
    if not config.GEMINI_API_KEY:
        logger.debug("GEMINI_API_KEY not configured; skipping embedding")
        return None

    if _circuit_is_open():
        logger.debug("Circuit breaker open; skipping embedding call")
        return None

    try:
        resp = requests.post(
            GEMINI_EMBED_URL,
            params={"key": config.GEMINI_API_KEY},
            headers={"Content-Type": "application/json"},
            json={
                "content": {
                    "parts": [{"text": text[:8000]}],
                },
                "outputDimensionality": EMBEDDING_DIMENSIONS,
            },
            timeout=15,
        )
        resp.raise_for_status()
        data = resp.json()
        embedding = data["embedding"]["values"]
        _record_success()
        return embedding
    except Exception as exc:
        _record_failure()
        logger.warning("Embedding generation failed: %s", exc)
        return None


# ---------------------------------------------------------------------------
# Work embedding computation
# ---------------------------------------------------------------------------


def _build_embedding_text(work: Dict[str, Any], genres: List[str], people: List[Dict[str, Any]]) -> str:
    """Compose a rich text representation of a work for embedding."""
    parts = []
    if work.get("title"):
        parts.append(work["title"])
    if work.get("year"):
        parts.append(f"({work['year']})")
    if work.get("type"):
        parts.append(f"[{work['type']}]")
    if genres:
        parts.append("Genres: " + ", ".join(genres))
    directors = [p["name"] for p in people if p.get("role") in ("director", "author")]
    if directors:
        parts.append("By: " + ", ".join(directors))
    cast = [p["name"] for p in people if p.get("role") == "cast"]
    if cast:
        parts.append("Cast: " + ", ".join(cast[:5]))
    if work.get("overview"):
        parts.append(work["overview"])
    return " | ".join(parts)


def compute_work_embedding(work_id: int) -> bool:
    """Compute and store embedding for a single work. Returns True on success."""
    supabase = get_supabase_client()

    work_result = supabase.table("works").select("*").eq("id", work_id).limit(1).execute()
    if not work_result.data:
        logger.warning("Work %d not found", work_id)
        return False
    work = work_result.data[0]

    genre_result = (
        supabase.table("work_genres")
        .select("genres(name)")
        .eq("work_id", work_id)
        .execute()
    )
    genres = [
        row["genres"]["name"]
        for row in (genre_result.data or [])
        if row.get("genres") and row["genres"].get("name")
    ]

    people_result = (
        supabase.table("work_people")
        .select("role, people(name)")
        .eq("work_id", work_id)
        .execute()
    )
    people = [
        {"name": row["people"]["name"], "role": row["role"]}
        for row in (people_result.data or [])
        if row.get("people") and row["people"].get("name")
    ]

    text = _build_embedding_text(work, genres, people)
    embedding = generate_embedding(text)
    if embedding is None:
        return False

    embedding_str = "[" + ",".join(str(x) for x in embedding) + "]"
    supabase.table("work_embeddings").upsert(
        {
            "work_id": work_id,
            "embedding": embedding_str,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        },
        on_conflict="work_id",
    ).execute()

    logger.info("Stored embedding for work %d (%d chars input)", work_id, len(text))
    return True


def backfill_embeddings(batch_size: int = 50) -> Dict[str, int]:
    """Compute embeddings for works that don't have one yet.

    Returns counts of processed, succeeded, and failed.
    """
    supabase = get_supabase_client()

    existing = supabase.table("work_embeddings").select("work_id").execute()
    existing_ids = {row["work_id"] for row in (existing.data or [])}

    all_works = supabase.table("works").select("id").order("id").execute()
    missing_ids = [row["id"] for row in (all_works.data or []) if row["id"] not in existing_ids]

    processed = 0
    succeeded = 0
    failed = 0

    for work_id in missing_ids[:batch_size]:
        processed += 1
        if compute_work_embedding(work_id):
            succeeded += 1
        else:
            failed += 1
        if _circuit_is_open():
            logger.warning("Circuit breaker open; stopping backfill early")
            break

    return {"processed": processed, "succeeded": succeeded, "failed": failed, "remaining": len(missing_ids) - processed}
