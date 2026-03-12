"""Hybrid recommendation engine: vector (v1) + metadata heuristic (v0) with RRF fusion.

Supports:
- Seed-based recommendations ("More like this")
- Personalised "Tonight" picker with hard filters
- Explainability strings for every recommendation
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

from .db import get_supabase_client
from .embeddings import compute_work_embedding

logger = logging.getLogger(__name__)

RRF_K = 60  # Reciprocal Rank Fusion constant
VECTOR_WEIGHT = 0.55
HEURISTIC_WEIGHT = 0.45
MAX_TONIGHT_SEEDS = 8


@dataclass
class ScoredWork:
    work_id: int
    vector_rank: Optional[int] = None
    vector_similarity: float = 0.0
    heuristic_rank: Optional[int] = None
    genre_jaccard: float = 0.0
    people_overlap: float = 0.0
    shared_genres: List[str] = field(default_factory=list)
    shared_people: List[str] = field(default_factory=list)
    rrf_score: float = 0.0
    reasons: List[str] = field(default_factory=list)
    work: Optional[Dict[str, Any]] = None


# ---------------------------------------------------------------------------
# Vector path (v1)
# ---------------------------------------------------------------------------


def _vector_candidates(
    seed_work_id: int,
    limit: int = 30,
    exclude_ids: Optional[List[int]] = None,
) -> List[ScoredWork]:
    """Get candidates via pgvector cosine similarity."""
    supabase = get_supabase_client()

    emb_row = (
        supabase.table("work_embeddings")
        .select("embedding")
        .eq("work_id", seed_work_id)
        .limit(1)
        .execute()
    )
    if not emb_row.data or not emb_row.data[0].get("embedding"):
        seed_work = supabase.table("works").select("*").eq("id", seed_work_id).limit(1).execute()
        if not seed_work.data:
            return []
        if not compute_work_embedding(seed_work_id):
            return []
        emb_row = (
            supabase.table("work_embeddings")
            .select("embedding")
            .eq("work_id", seed_work_id)
            .limit(1)
            .execute()
        )
        if not emb_row.data:
            return []

    embedding_str = emb_row.data[0]["embedding"]

    try:
        result = supabase.rpc(
            "match_works_by_embedding",
            {
                "query_embedding": embedding_str,
                "match_count": limit,
                "exclude_ids": exclude_ids or [],
            },
        ).execute()
    except Exception as exc:
        logger.warning("Vector search RPC failed: %s", exc)
        return []

    candidates = []
    for rank, row in enumerate(result.data or [], start=1):
        candidates.append(
            ScoredWork(
                work_id=row["work_id"],
                vector_rank=rank,
                vector_similarity=row.get("similarity", 0.0),
            )
        )
    return candidates


# ---------------------------------------------------------------------------
# Heuristic path (v0)
# ---------------------------------------------------------------------------


def _heuristic_candidates(
    seed_work_id: int,
    limit: int = 30,
    exclude_ids: Optional[List[int]] = None,
) -> List[ScoredWork]:
    """Get candidates via genre Jaccard + people overlap heuristics."""
    supabase = get_supabase_client()
    excl = exclude_ids or []

    try:
        genre_result = supabase.rpc(
            "genre_jaccard_candidates",
            {"seed_work_id": seed_work_id, "max_results": limit, "exclude_ids": excl},
        ).execute()
    except Exception as exc:
        logger.warning("Genre Jaccard RPC failed: %s", exc)
        genre_result = type("R", (), {"data": []})()

    try:
        people_result = supabase.rpc(
            "people_overlap_candidates",
            {"seed_work_id": seed_work_id, "max_results": limit, "exclude_ids": excl},
        ).execute()
    except Exception as exc:
        logger.warning("People overlap RPC failed: %s", exc)
        people_result = type("R", (), {"data": []})()

    by_id: Dict[int, ScoredWork] = {}

    for row in genre_result.data or []:
        wid = row["work_id"]
        if wid not in by_id:
            by_id[wid] = ScoredWork(work_id=wid)
        by_id[wid].genre_jaccard = row.get("jaccard", 0.0)
        by_id[wid].shared_genres = row.get("shared_genres") or []

    for row in people_result.data or []:
        wid = row["work_id"]
        if wid not in by_id:
            by_id[wid] = ScoredWork(work_id=wid)
        by_id[wid].people_overlap = row.get("overlap_score", 0.0)
        by_id[wid].shared_people = row.get("shared_people") or []

    combined = list(by_id.values())
    for sw in combined:
        sw.rrf_score = 0.6 * sw.genre_jaccard + 0.4 * sw.people_overlap

    combined.sort(key=lambda s: s.rrf_score, reverse=True)

    for rank, sw in enumerate(combined, start=1):
        sw.heuristic_rank = rank

    return combined[:limit]


# ---------------------------------------------------------------------------
# Reciprocal Rank Fusion
# ---------------------------------------------------------------------------


def _fuse_results(
    vector_candidates: List[ScoredWork],
    heuristic_candidates: List[ScoredWork],
    limit: int = 20,
) -> List[ScoredWork]:
    """Merge vector and heuristic candidate lists using Reciprocal Rank Fusion."""
    by_id: Dict[int, ScoredWork] = {}

    for sw in vector_candidates:
        by_id[sw.work_id] = ScoredWork(
            work_id=sw.work_id,
            vector_rank=sw.vector_rank,
            vector_similarity=sw.vector_similarity,
        )

    for sw in heuristic_candidates:
        if sw.work_id in by_id:
            merged = by_id[sw.work_id]
            merged.heuristic_rank = sw.heuristic_rank
            merged.genre_jaccard = sw.genre_jaccard
            merged.people_overlap = sw.people_overlap
            merged.shared_genres = sw.shared_genres
            merged.shared_people = sw.shared_people
        else:
            by_id[sw.work_id] = ScoredWork(
                work_id=sw.work_id,
                heuristic_rank=sw.heuristic_rank,
                genre_jaccard=sw.genre_jaccard,
                people_overlap=sw.people_overlap,
                shared_genres=sw.shared_genres,
                shared_people=sw.shared_people,
            )

    for sw in by_id.values():
        score = 0.0
        if sw.vector_rank is not None:
            score += VECTOR_WEIGHT * (1.0 / (RRF_K + sw.vector_rank))
        if sw.heuristic_rank is not None:
            score += HEURISTIC_WEIGHT * (1.0 / (RRF_K + sw.heuristic_rank))
        sw.rrf_score = score

    results = sorted(by_id.values(), key=lambda s: s.rrf_score, reverse=True)
    return results[:limit]


# ---------------------------------------------------------------------------
# Explainability
# ---------------------------------------------------------------------------


def _generate_reasons(sw: ScoredWork) -> List[str]:
    """Build human-readable explanation strings for a recommendation."""
    reasons: List[str] = []

    if sw.shared_people:
        directors = [p for p in sw.shared_people if p]
        if len(directors) == 1:
            reasons.append(f"Features {directors[0]}")
        elif len(directors) > 1:
            reasons.append(f"Features {directors[0]} and {len(directors) - 1} other{'s' if len(directors) > 2 else ''}")

    if sw.shared_genres:
        if len(sw.shared_genres) <= 3:
            reasons.append(f"Shared genres: {', '.join(sw.shared_genres)}")
        else:
            reasons.append(f"Shared genres: {', '.join(sw.shared_genres[:3])} +{len(sw.shared_genres) - 3} more")

    if sw.vector_similarity > 0.75:
        reasons.append("Very similar themes and storyline")
    elif sw.vector_similarity > 0.5:
        reasons.append("Similar themes")

    if not reasons:
        if sw.vector_rank is not None:
            reasons.append("Semantic similarity")
        else:
            reasons.append("Related content")

    return reasons


def _enrich_works(scored: List[ScoredWork]) -> List[ScoredWork]:
    """Fetch full work data and attach explanation strings."""
    if not scored:
        return scored

    supabase = get_supabase_client()
    work_ids = [sw.work_id for sw in scored]

    works_result = (
        supabase.table("works")
        .select("id, type, title, year, overview, poster_url, language_code, runtime_minutes, pages")
        .in_("id", work_ids)
        .execute()
    )
    works_by_id = {w["id"]: w for w in (works_result.data or [])}

    genres_result = (
        supabase.table("work_genres")
        .select("work_id, genres(name)")
        .in_("work_id", work_ids)
        .execute()
    )
    genres_by_work: Dict[int, List[str]] = {}
    for row in genres_result.data or []:
        wid = row.get("work_id")
        gname = row.get("genres", {}).get("name") if isinstance(row.get("genres"), dict) else None
        if wid and gname:
            genres_by_work.setdefault(wid, []).append(gname)

    for sw in scored:
        sw.work = works_by_id.get(sw.work_id)
        if sw.work:
            sw.work["genres"] = genres_by_work.get(sw.work_id, [])
        sw.reasons = _generate_reasons(sw)

    return [sw for sw in scored if sw.work is not None]


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def recommend_for_seed(
    seed_work_id: int,
    limit: int = 10,
    exclude_ids: Optional[List[int]] = None,
    include_ids: Optional[List[int]] = None,
    mode: str = "hybrid",
) -> List[Dict[str, Any]]:
    """Get recommendations seeded by a specific work.

    Args:
        seed_work_id: The work to base recommendations on.
        limit: Max results to return.
        exclude_ids: Work IDs to exclude (e.g., already in user's library).
        include_ids: If set, only return works whose ID is in this list.
        mode: 'hybrid', 'vector', or 'heuristic'.

    Returns:
        List of recommendation dicts with work data, scores, and reasons.
    """
    excl = list(set((exclude_ids or []) + [seed_work_id]))
    fetch_limit = limit * 3

    vector_results: List[ScoredWork] = []
    heuristic_results: List[ScoredWork] = []

    if mode in ("hybrid", "vector"):
        vector_results = _vector_candidates(seed_work_id, fetch_limit, excl)

    if mode in ("hybrid", "heuristic"):
        heuristic_results = _heuristic_candidates(seed_work_id, fetch_limit, excl)

    if mode == "hybrid":
        if not vector_results:
            fused = heuristic_results
        elif not heuristic_results:
            for rank, sw in enumerate(vector_results, 1):
                sw.rrf_score = 1.0 / (RRF_K + rank)
            fused = vector_results
        else:
            fused = _fuse_results(vector_results, heuristic_results, limit * 3)
    elif mode == "vector":
        for rank, sw in enumerate(vector_results, 1):
            sw.rrf_score = 1.0 / (RRF_K + rank)
        fused = vector_results
    else:
        fused = heuristic_results

    if include_ids is not None:
        include_set = set(include_ids)
        fused = [sw for sw in fused if sw.work_id in include_set]

    fused = fused[:limit]

    enriched = _enrich_works(fused)
    return [_scored_to_dict(sw) for sw in enriched]


def tonight_picks(
    user_id: str,
    limit: int = 3,
    max_duration: Optional[int] = None,
    language: Optional[str] = None,
    work_type: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """Personalised "Tonight" recommendations from the user's own backlog.

    Finds items in the user's wishlist/in-progress that are most similar
    to their top-rated finished items, helping them decide what to
    watch/read next from their own collection.
    """
    supabase = get_supabase_client()

    backlog_result = (
        supabase.table("user_items")
        .select("work_id")
        .eq("user_id", user_id)
        .in_("status", ["wishlist", "in_progress"])
        .execute()
    )
    backlog_ids = [row["work_id"] for row in (backlog_result.data or [])]

    if not backlog_ids:
        return []

    seed_ids: List[int] = []
    seen: set = set()

    for query_fn in [
        lambda: (
            supabase.table("user_items")
            .select("work_id")
            .eq("user_id", user_id)
            .eq("status", "finished")
            .not_.is_("rating", "null")
            .order("rating", desc=True)
            .limit(MAX_TONIGHT_SEEDS)
            .execute()
        ),
        lambda: (
            supabase.table("user_items")
            .select("work_id")
            .eq("user_id", user_id)
            .not_.is_("rating", "null")
            .order("rating", desc=True)
            .limit(MAX_TONIGHT_SEEDS)
            .execute()
        ),
        lambda: (
            supabase.table("user_items")
            .select("work_id")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .limit(MAX_TONIGHT_SEEDS)
            .execute()
        ),
    ]:
        if len(seed_ids) >= MAX_TONIGHT_SEEDS:
            break
        result = query_fn()
        for row in result.data or []:
            wid = row["work_id"]
            if wid not in seen:
                seen.add(wid)
                seed_ids.append(wid)

    if not seed_ids:
        return []

    all_candidates: Dict[int, ScoredWork] = {}

    for seed_id in seed_ids:
        recs = recommend_for_seed(
            seed_work_id=seed_id,
            limit=limit * 3,
            include_ids=backlog_ids,
            mode="hybrid",
        )
        for rec in recs:
            wid = rec["work_id"]
            if wid not in all_candidates:
                all_candidates[wid] = ScoredWork(
                    work_id=wid,
                    rrf_score=rec.get("score", 0),
                    reasons=rec.get("reasons", []),
                    work=rec.get("work"),
                    shared_genres=rec.get("shared_genres", []),
                    shared_people=rec.get("shared_people", []),
                )
            else:
                all_candidates[wid].rrf_score += rec.get("score", 0)
                for reason in rec.get("reasons", []):
                    if reason not in all_candidates[wid].reasons:
                        all_candidates[wid].reasons.append(reason)

    ranked = sorted(all_candidates.values(), key=lambda s: s.rrf_score, reverse=True)

    filtered: List[ScoredWork] = []
    for sw in ranked:
        w = sw.work
        if not w:
            continue
        if work_type and w.get("type") != work_type:
            continue
        if max_duration and w.get("runtime_minutes") and w["runtime_minutes"] > max_duration:
            continue
        if language and w.get("language_code") != language:
            continue
        filtered.append(sw)
        if len(filtered) >= limit:
            break

    return [_scored_to_dict(sw) for sw in filtered]


# ---------------------------------------------------------------------------
# Serialization
# ---------------------------------------------------------------------------


def _scored_to_dict(sw: ScoredWork) -> Dict[str, Any]:
    return {
        "work_id": sw.work_id,
        "score": round(sw.rrf_score, 6),
        "vector_similarity": round(sw.vector_similarity, 4) if sw.vector_similarity else None,
        "genre_jaccard": round(sw.genre_jaccard, 4) if sw.genre_jaccard else None,
        "people_overlap": round(sw.people_overlap, 4) if sw.people_overlap else None,
        "shared_genres": sw.shared_genres or [],
        "shared_people": sw.shared_people or [],
        "reasons": sw.reasons or [],
        "engine": _engine_label(sw),
        "work": sw.work,
    }


def _engine_label(sw: ScoredWork) -> str:
    if sw.vector_rank is not None and sw.heuristic_rank is not None:
        return "hybrid"
    if sw.vector_rank is not None:
        return "vector"
    return "heuristic"
