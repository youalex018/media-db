from __future__ import annotations

from typing import Any, Dict, List, Optional

import requests

from .config import get_config


TMDB_BASE_URL = "https://api.themoviedb.org/3"
OPENLIBRARY_BASE_URL = "https://openlibrary.org"


def tmdb_search(query: str, limit: int = 10) -> List[Dict[str, Any]]:
    config = get_config()
    if not config.TMDB_API_KEY:
        return []

    url = f"{TMDB_BASE_URL}/search/multi"
    params = {
        "api_key": config.TMDB_API_KEY,
        "query": query,
        "include_adult": "false",
        "page": 1,
    }
    response = requests.get(url, params=params, timeout=10)
    response.raise_for_status()
    payload = response.json()
    results = payload.get("results", [])
    return results[:limit]


def tmdb_detail(tmdb_id: int, source_type: str) -> Dict[str, Any]:
    config = get_config()
    if not config.TMDB_API_KEY:
        raise ValueError("TMDB_API_KEY is not configured")

    if source_type not in ("movie", "show"):
        raise ValueError("source_type must be 'movie' or 'show'")

    tmdb_type = "movie" if source_type == "movie" else "tv"
    url = f"{TMDB_BASE_URL}/{tmdb_type}/{tmdb_id}"
    params = {"api_key": config.TMDB_API_KEY}
    response = requests.get(url, params=params, timeout=10)
    response.raise_for_status()
    return response.json()


def openlibrary_search(query: str, limit: int = 10) -> List[Dict[str, Any]]:
    url = f"{OPENLIBRARY_BASE_URL}/search.json"
    params = {"q": query, "limit": limit}
    response = requests.get(url, params=params, timeout=10)
    response.raise_for_status()
    payload = response.json()
    return payload.get("docs", [])[:limit]


def openlibrary_detail(openlibrary_id: str) -> Dict[str, Any]:
    url = f"{OPENLIBRARY_BASE_URL}/works/{openlibrary_id}.json"
    response = requests.get(url, timeout=10)
    response.raise_for_status()
    return response.json()


def normalize_errors(exc: Exception) -> Optional[Dict[str, Any]]:
    if isinstance(exc, requests.HTTPError):
        response = exc.response
        return {
            "status_code": response.status_code if response else None,
            "message": "upstream_request_failed",
        }
    return {"status_code": None, "message": "request_failed"}

