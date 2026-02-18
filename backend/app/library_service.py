from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional

from .db import get_supabase_client


TMDB_CACHE_TTL = timedelta(days=183)


def _parse_fetched_at(value: Any) -> Optional[datetime]:
    if isinstance(value, datetime):
        return value
    if isinstance(value, str):
        normalized = value.replace("Z", "+00:00")
        try:
            return datetime.fromisoformat(normalized)
        except ValueError:
            return None
    return None


def is_tmdb_cache_fresh(
    fetched_at: Any, now: Optional[datetime] = None
) -> bool:
    if now is None:
        now = datetime.now(timezone.utc)
    fetched_dt = _parse_fetched_at(fetched_at)
    if not fetched_dt:
        return False
    if fetched_dt.tzinfo is None:
        fetched_dt = fetched_dt.replace(tzinfo=timezone.utc)
    return now - fetched_dt <= TMDB_CACHE_TTL


def get_cached_source(provider: str, external_id: str) -> Optional[Dict[str, Any]]:
    supabase = get_supabase_client()
    result = (
        supabase.table("sources")
        .select("payload,fetched_at")
        .eq("provider", provider)
        .eq("external_id", external_id)
        .limit(1)
        .execute()
    )
    if result.data:
        row = result.data[0]
        if provider == "tmdb" and not is_tmdb_cache_fresh(row.get("fetched_at")):
            supabase.table("sources").delete().eq("provider", provider).eq(
                "external_id", external_id
            ).execute()
            return None
        return row.get("payload")
    return None


def upsert_source(provider: str, external_id: str, payload: Dict[str, Any]) -> None:
    supabase = get_supabase_client()
    supabase.table("sources").upsert(
        {
            "provider": provider,
            "external_id": external_id,
            "payload": payload,
            "fetched_at": datetime.now(timezone.utc).isoformat(),
        },
        on_conflict="provider,external_id",
    ).execute()


def upsert_work(work_payload: Dict[str, Any]) -> Dict[str, Any]:
    supabase = get_supabase_client()
    # Metadata fields used by the service layer should not be written into works.
    db_payload = {k: v for k, v in work_payload.items() if k != "genre_names"}
    conflict_field = _work_conflict_field(work_payload)
    result = supabase.table("works").upsert(
        db_payload, on_conflict=conflict_field
    ).execute()
    if not result.data:
        lookup_value = db_payload.get(conflict_field)
        if lookup_value is None:
            raise ValueError("work_upsert_failed")
        lookup = (
            supabase.table("works")
            .select("*")
            .eq(conflict_field, lookup_value)
            .limit(1)
            .execute()
        )
        if lookup.data:
            return lookup.data[0]
        raise ValueError("work_upsert_failed")
    return result.data[0]


def sync_work_genres(work_id: int, genre_names: list[str]) -> None:
    if work_id <= 0:
        raise ValueError("invalid_work_id")
    unique_names = sorted({name.strip() for name in genre_names if isinstance(name, str) and name.strip()})

    supabase = get_supabase_client()
    if not unique_names:
        supabase.table("work_genres").delete().eq("work_id", work_id).execute()
        return

    upsert_rows = [{"name": name} for name in unique_names]
    supabase.table("genres").upsert(upsert_rows, on_conflict="name").execute()

    genre_rows = (
        supabase.table("genres")
        .select("id,name")
        .in_("name", unique_names)
        .execute()
    )
    genre_ids = [row["id"] for row in (genre_rows.data or []) if row.get("id") is not None]

    supabase.table("work_genres").delete().eq("work_id", work_id).execute()
    if genre_ids:
        link_rows = [{"work_id": work_id, "genre_id": genre_id} for genre_id in genre_ids]
        supabase.table("work_genres").insert(link_rows).execute()


def upsert_user_item(
    user_id: str,
    work_id: int,
    status: Optional[str] = None,
    rating: Optional[int] = None,
    notes: Optional[str] = None,
) -> Dict[str, Any]:
    supabase = get_supabase_client()
    payload: Dict[str, Any] = {"user_id": user_id, "work_id": work_id}
    if status is not None:
        payload["status"] = status
    if rating is not None:
        payload["rating"] = rating
    if notes is not None:
        payload["notes"] = notes

    result = supabase.table("user_items").upsert(
        payload, on_conflict="user_id,work_id"
    ).execute()
    if result.data:
        return result.data[0]

    lookup = (
        supabase.table("user_items")
        .select("*")
        .eq("user_id", user_id)
        .eq("work_id", work_id)
        .limit(1)
        .execute()
    )
    if lookup.data:
        return lookup.data[0]
    raise ValueError("user_item_upsert_failed")


def _work_conflict_field(work_payload: Dict[str, Any]) -> str:
    if work_payload.get("tmdb_id") is not None:
        return "tmdb_id"
    if work_payload.get("openlibrary_id") is not None:
        return "openlibrary_id"
    if work_payload.get("isbn13") is not None:
        return "isbn13"
    raise ValueError("work_conflict_key_missing")

