import json
import os
import subprocess
import sys
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Request, status

from .auth import get_current_user
from .db import get_supabase_client
from .external_sources import (
    normalize_errors,
    openlibrary_detail,
    openlibrary_search,
    tmdb_detail,
    tmdb_search,
)
from .embeddings import backfill_embeddings, circuit_breaker_status, compute_work_embedding
from .library_service import (
    get_cached_source,
    sync_work_genres,
    upsert_source,
    upsert_user_item,
    upsert_work,
)
from .mappers import (
    map_openlibrary_payload_to_work,
    map_tmdb_payload_to_work,
    normalize_openlibrary_search_doc,
    normalize_tmdb_search_item,
)
from .recommendations import recommend_for_seed, tonight_picks

router = APIRouter()
RATINGS_STATS_TIMEOUT_SECONDS = 2
RATINGS_STATS_MAX_ITEMS = 1000


@router.get('/health')
async def health():
    """Health check endpoint."""
    return {'status': 'ok'}


@router.get('/me')
async def me(user=Depends(get_current_user)):
    """Get current user information (protected endpoint)."""
    return {
        'user_id': user['user_id'],
        'email': user.get('email')
    }


@router.get('/public/profile/{username}')
async def public_profile(username: str):
    """Get a public profile by username (no auth required)."""
    supabase = get_supabase_client()
    result = (
        supabase.table('profiles')
        .select('username,avatar_url,is_public,show_username,show_avatar')
        .eq('username', username)
        .limit(1)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail={'error': 'profile_not_found'})

    profile = result.data[0]
    if not profile.get('is_public'):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail={'error': 'profile_not_found'})

    response = {
        'username': profile.get('username') if profile.get('show_username') else None,
        'avatar_url': profile.get('avatar_url') if profile.get('show_avatar') else None,
    }
    return response


@router.get('/search')
async def search(request: Request, _user=Depends(get_current_user)):
    """Search external sources (TMDb + Open Library)."""
    query = request.query_params.get('q', '')
    if not query:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={'error': 'Query parameter "q" is required'}
        )
    raw_types = request.query_params.get('types') or request.query_params.get('type') or ''
    requested_types = {t.strip().lower() for t in raw_types.split(',') if t.strip()}

    results = []
    warnings = []

    try:
        tmdb_results = tmdb_search(query, limit=10)
        for item in tmdb_results:
            normalized = normalize_tmdb_search_item(item)
            if not normalized:
                continue
            if requested_types and normalized["type"] not in requested_types:
                continue
            source = normalized.get("source") or {}
            external_id = source.get("external_id")
            if external_id:
                upsert_source("tmdb", external_id, item)
            results.append(normalized)
    except Exception as exc:
        warnings.append({"source": "tmdb", **normalize_errors(exc)})

    try:
        ol_results = openlibrary_search(query, limit=10)
        for doc in ol_results:
            normalized = normalize_openlibrary_search_doc(doc)
            if not normalized:
                continue
            if requested_types and normalized["type"] not in requested_types:
                continue
            source = normalized.get("source") or {}
            external_id = source.get("external_id")
            if external_id:
                upsert_source("openlibrary", external_id, doc)
            results.append(normalized)
    except Exception as exc:
        warnings.append({"source": "openlibrary", **normalize_errors(exc)})

    response = {'query': query, 'results': results}
    if warnings:
        response['warnings'] = warnings
    return response


@router.post('/library/add')
async def add_to_library(request: Request, user=Depends(get_current_user)):
    """Add item to user's library from a cached or fetched source."""
    data = await request.json()
    if not data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={'error': 'JSON body required'}
        )

    source = data.get('source') or {}
    provider = source.get('provider')
    external_id = source.get('external_id')
    source_type = source.get('source_type')

    if not provider or not external_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={'error': 'source.provider and source.external_id are required'}
        )

    if provider == 'tmdb' and source_type not in ('movie', 'show', 'tv'):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={'error': 'source.source_type must be movie or show for TMDb items'}
        )

    cached_payload = get_cached_source(provider, str(external_id))
    payload = cached_payload

    try:
        if provider == 'tmdb':
            normalized_type = 'movie' if source_type == 'movie' else 'show'
            # Search payloads cached from /search may not include full genre objects.
            # Ensure detail payload is used so genre_names can be extracted reliably.
            needs_detail = (
                not payload
                or not isinstance(payload, dict)
                or not isinstance(payload.get("genres"), list)
            )
            if needs_detail:
                payload = tmdb_detail(int(external_id), normalized_type)
                upsert_source('tmdb', str(external_id), payload)
            work_payload = map_tmdb_payload_to_work(payload, normalized_type)
        elif provider == 'openlibrary':
            if not payload:
                payload = openlibrary_detail(str(external_id))
                upsert_source('openlibrary', str(external_id), payload)
            work_payload = map_openlibrary_payload_to_work(payload)
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={'error': f'Unsupported source provider: {provider}'}
            )
    except HTTPException:
        raise
    except Exception as exc:
        error = normalize_errors(exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail={'error': 'upstream_error', 'details': error}
        )

    if not work_payload.get('title') or not work_payload.get('type'):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={'error': 'Source payload missing required fields'}
        )

    try:
        work = upsert_work(work_payload)
        if "genre_names" in work_payload:
            genre_names = work_payload.get("genre_names") or []
            sync_work_genres(work["id"], genre_names)
        user_item = upsert_user_item(
            user_id=user['user_id'],
            work_id=work['id'],
            status=data.get('status'),
            rating=data.get('rating'),
            notes=data.get('notes'),
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={'error': str(exc)}
        )

    return {
        'work': work,
        'user_item': user_item
    }


def _stats_binary_path() -> Path:
    env_path = os.getenv("RATINGS_STATS_BIN")
    if env_path:
        return Path(env_path)
    repo_root = Path(__file__).resolve().parents[2]
    binary_name = "ratings_stats.exe" if os.name == "nt" else "ratings_stats"
    build_dir = repo_root / "tools" / "cpp" / "build"
    candidates = [
        build_dir / binary_name,
        build_dir / "Release" / binary_name,
        build_dir / "Debug" / binary_name,
    ]
    for candidate in candidates:
        if candidate.exists():
            return candidate
    return candidates[0]


def _stats_command(binary_path: Path) -> list[str]:
    if binary_path.suffix.lower() == ".py":
        return [sys.executable, str(binary_path)]
    return [str(binary_path)]


def _fetch_user_library_for_stats(user_id: str) -> list[dict]:
    """Fetch the user's library with genres, formatted for the C++ stats tool."""
    supabase = get_supabase_client()
    result = (
        supabase.table("user_items")
        .select("status, rating, works(id, title, type, work_genres(genres(name)))")
        .eq("user_id", user_id)
        .execute()
    )
    items = []
    for row in result.data or []:
        work = row.get("works")
        if not work:
            continue
        if isinstance(work, list):
            work = work[0] if work else None
        if not work:
            continue
        genres = []
        for wg in work.get("work_genres") or []:
            g = wg.get("genres")
            if isinstance(g, dict) and g.get("name"):
                genres.append(g["name"])
            elif isinstance(g, list):
                for gi in g:
                    if isinstance(gi, dict) and gi.get("name"):
                        genres.append(gi["name"])
        items.append({
            "title": work.get("title", ""),
            "type": work.get("type", ""),
            "status": row.get("status", ""),
            "rating": row.get("rating", 0),
            "genres": genres,
        })
    return items


@router.get('/profile/stats')
async def profile_stats(user=Depends(get_current_user)):
    """Compute library statistics by reading the user's library and piping it through the C++ tool."""
    library = _fetch_user_library_for_stats(user['user_id'])
    if not library:
        return {'stats': {
            'types': {},
            'statuses': {},
            'top_genres': [],
            'overall': {'count': 0, 'rated_count': 0, 'average_rating': 0, 'highest_rating': 0, 'highest_rated': ''},
        }}

    binary_path = _stats_binary_path()
    if not binary_path.exists():
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={'error': 'stats_binary_unavailable'},
        )
    try:
        result = subprocess.run(
            _stats_command(binary_path),
            input=json.dumps(library),
            capture_output=True,
            text=True,
            timeout=RATINGS_STATS_TIMEOUT_SECONDS,
            check=False,
        )
    except subprocess.TimeoutExpired:
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail={'error': 'stats_timeout'},
        )
    if result.returncode != 0:
        details = (result.stderr.strip() or "")[:200]
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={'error': 'stats_failed', 'details': details or None},
        )
    try:
        stats = json.loads(result.stdout)
    except json.JSONDecodeError:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={'error': 'stats_invalid_output'},
        )
    return {'stats': stats}


GEMINI_GENERATE_BASE = "https://generativelanguage.googleapis.com/v1beta/models"
GEMINI_GENERATE_MODELS = ["gemini-2.5-flash-lite", "gemini-2.0-flash"]
INSIGHTS_TIMEOUT_SECONDS = 15


@router.post('/profile/insights')
async def profile_insights(user=Depends(get_current_user)):
    """Generate AI-powered insights about the user's media habits using Gemini."""
    from .config import get_config
    import requests as http_requests

    config = get_config()
    api_key = config.GEMINI_API_KEY
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={'error': 'gemini_not_configured'},
        )

    library = _fetch_user_library_for_stats(user['user_id'])
    if not library:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={'error': 'empty_library', 'message': 'Add items to your library first.'},
        )

    titles_by_type: dict[str, list[str]] = {}
    genres_set: set[str] = set()
    rated_items: list[dict] = []
    status_counts: dict[str, int] = {}

    for item in library:
        t = item.get("type", "unknown")
        titles_by_type.setdefault(t, []).append(item.get("title", "Untitled"))
        for g in item.get("genres", []):
            genres_set.add(g)
        if item.get("rating", 0) > 0:
            rated_items.append(item)
        s = item.get("status", "")
        if s:
            status_counts[s] = status_counts.get(s, 0) + 1

    rated_items.sort(key=lambda x: x.get("rating", 0), reverse=True)
    top_rated = rated_items[:5]

    summary_lines = [f"Total items: {len(library)}"]
    for t, titles in titles_by_type.items():
        summary_lines.append(f"  {t}s: {len(titles)} — {', '.join(titles[:8])}")
    if genres_set:
        summary_lines.append(f"Genres: {', '.join(sorted(genres_set))}")
    if top_rated:
        summary_lines.append("Top rated: " + ", ".join(
            f"{i['title']} ({i['rating']}/100)" for i in top_rated
        ))
    for s, c in status_counts.items():
        summary_lines.append(f"Status '{s}': {c}")

    prompt = (
        "You are a media analyst. Based on this user's library data, write a short, "
        "friendly 3-4 paragraph analysis of their media tastes and habits. "
        "Mention patterns you notice (genre preferences, rating tendencies, "
        "types of media they gravitate toward). Keep it conversational and specific "
        "to their actual data. Do not use bullet points or headers.\n\n"
        "Library summary:\n" + "\n".join(summary_lines)
    )

    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"maxOutputTokens": 512, "temperature": 0.7},
    }

    last_error: Exception | None = None
    text = ""
    for model in GEMINI_GENERATE_MODELS:
        url = f"{GEMINI_GENERATE_BASE}/{model}:generateContent?key={api_key}"
        try:
            resp = http_requests.post(url, json=payload, timeout=INSIGHTS_TIMEOUT_SECONDS)
            if resp.status_code == 429:
                last_error = Exception(f"{model}: quota exceeded")
                continue
            resp.raise_for_status()
            data = resp.json()
            text = (
                data.get("candidates", [{}])[0]
                .get("content", {})
                .get("parts", [{}])[0]
                .get("text", "")
            )
            if text:
                break
            last_error = ValueError(f"{model}: empty response")
        except Exception as exc:
            last_error = exc
            continue

    if not text:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail={'error': 'insights_generation_failed', 'details': str(last_error)[:200]},
        )

    return {'insights': text}


@router.get('/recommendations')
async def get_recommendations(request: Request, user=Depends(get_current_user)):
    """Get recommendations seeded by a specific work."""
    seed = request.query_params.get('seed')
    if not seed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={'error': 'Query parameter "seed" (work_id) is required'},
        )

    try:
        seed_id = int(seed)
    except (ValueError, TypeError):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={'error': 'seed must be a valid integer work_id'},
        )

    limit = min(int(request.query_params.get('limit', '10')), 30)
    mode = request.query_params.get('mode', 'hybrid')
    if mode not in ('hybrid', 'vector', 'heuristic'):
        mode = 'hybrid'

    exclude_raw = request.query_params.get('exclude', '')
    exclude_ids = []
    if exclude_raw:
        for part in exclude_raw.split(','):
            part = part.strip()
            if part.isdigit():
                exclude_ids.append(int(part))

    include_ids = None
    library_only = request.query_params.get('library_only', '').lower() in ('true', '1')
    if library_only:
        supabase = get_supabase_client()
        user_items = (
            supabase.table("user_items")
            .select("work_id")
            .eq("user_id", user['user_id'])
            .execute()
        )
        include_ids = [row["work_id"] for row in (user_items.data or [])]

    try:
        results = recommend_for_seed(
            seed_work_id=seed_id,
            limit=limit,
            exclude_ids=exclude_ids or None,
            include_ids=include_ids,
            mode=mode,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={'error': 'recommendation_failed', 'details': str(exc)[:200]},
        )

    return {
        'seed_work_id': seed_id,
        'mode': mode,
        'results': results,
        'circuit_breaker': circuit_breaker_status(),
    }


@router.get('/recommendations/tonight')
async def get_tonight_picks(request: Request, user=Depends(get_current_user)):
    """Personalised "Tonight" recommendations based on user taste profile."""
    limit = min(int(request.query_params.get('limit', '5')), 20)
    max_duration = request.query_params.get('max_duration')
    language = request.query_params.get('language')
    work_type = request.query_params.get('type')

    if max_duration:
        try:
            max_duration = int(max_duration)
        except (ValueError, TypeError):
            max_duration = None

    if work_type and work_type not in ('movie', 'show', 'book'):
        work_type = None

    try:
        results = tonight_picks(
            user_id=user['user_id'],
            limit=limit,
            max_duration=max_duration,
            language=language,
            work_type=work_type,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={'error': 'tonight_picks_failed', 'details': str(exc)[:200]},
        )

    return {
        'results': results,
        'filters': {
            'max_duration': max_duration,
            'language': language,
            'type': work_type,
        },
        'circuit_breaker': circuit_breaker_status(),
    }


@router.post('/embeddings/backfill')
async def trigger_backfill(request: Request, user=Depends(get_current_user)):
    """Trigger embedding backfill for works missing embeddings."""
    body = {}
    try:
        body = await request.json()
    except Exception:
        pass

    batch_size = min(int(body.get('batch_size', 50)), 200)

    try:
        result = backfill_embeddings(batch_size=batch_size)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={'error': 'backfill_failed', 'details': str(exc)[:200]},
        )

    return {
        'result': result,
        'circuit_breaker': circuit_breaker_status(),
    }


@router.post('/embeddings/compute/{work_id}')
async def trigger_compute_embedding(work_id: int, _user=Depends(get_current_user)):
    """Compute embedding for a single work."""
    success = compute_work_embedding(work_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={'error': 'embedding_computation_failed', 'work_id': work_id},
        )
    return {'success': True, 'work_id': work_id}


@router.get('/library')
async def get_library(user=Depends(get_current_user)):
    """Get user's library (placeholder)."""
    # TODO: Implement user library retrieval
    return {
        'message': 'Library endpoint not yet implemented',
        'user_id': user['user_id']
    }
