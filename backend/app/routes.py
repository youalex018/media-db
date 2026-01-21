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
from .library_service import get_cached_source, upsert_source, upsert_user_item, upsert_work
from .mappers import (
    map_openlibrary_payload_to_work,
    map_tmdb_payload_to_work,
    normalize_openlibrary_search_doc,
    normalize_tmdb_search_item,
)

router = APIRouter()


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
async def search(request: Request, user=Depends(get_current_user)):
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
            if not payload:
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


@router.get('/library')
async def get_library(user=Depends(get_current_user)):
    """Get user's library (placeholder)."""
    # TODO: Implement user library retrieval
    return {
        'message': 'Library endpoint not yet implemented',
        'user_id': user['user_id']
    }
