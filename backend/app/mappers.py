from __future__ import annotations

from typing import Any, Dict, Optional


TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w500"
OPENLIBRARY_COVER_BASE = "https://covers.openlibrary.org/b"

TMDB_MOVIE_GENRE_MAP = {
    12: "Adventure",
    14: "Fantasy",
    16: "Animation",
    18: "Drama",
    27: "Horror",
    28: "Action",
    35: "Comedy",
    36: "History",
    37: "Western",
    53: "Thriller",
    80: "Crime",
    99: "Documentary",
    878: "Science Fiction",
    9648: "Mystery",
    10402: "Music",
    10749: "Romance",
    10751: "Family",
    10752: "War",
    10770: "TV Movie",
}

TMDB_TV_GENRE_MAP = {
    16: "Animation",
    18: "Drama",
    35: "Comedy",
    37: "Western",
    80: "Crime",
    99: "Documentary",
    9648: "Mystery",
    10402: "Music",
    10751: "Family",
    10759: "Action & Adventure",
    10762: "Kids",
    10763: "News",
    10764: "Reality",
    10765: "Sci-Fi & Fantasy",
    10766: "Soap",
    10767: "Talk",
    10768: "War & Politics",
}


def _parse_year(value: Optional[str]) -> Optional[int]:
    if not value:
        return None
    for token in value.split("-"):
        if token.isdigit() and len(token) == 4:
            try:
                return int(token)
            except ValueError:
                return None
    digits = "".join([c for c in value if c.isdigit()])
    if len(digits) >= 4:
        try:
            return int(digits[:4])
        except ValueError:
            return None
    return None


def _tmdb_poster_url(path: Optional[str]) -> Optional[str]:
    if not path:
        return None
    return f"{TMDB_IMAGE_BASE}{path}"


def _openlibrary_cover_url(cover_id: Optional[int] = None, olid: Optional[str] = None) -> Optional[str]:
    if cover_id:
        return f"{OPENLIBRARY_COVER_BASE}/id/{cover_id}-L.jpg"
    if olid:
        return f"{OPENLIBRARY_COVER_BASE}/olid/{olid}-L.jpg"
    return None


def normalize_tmdb_search_item(item: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    media_type = item.get("media_type")
    if media_type not in ("movie", "tv"):
        return None

    title = item.get("title") if media_type == "movie" else item.get("name")
    release_date = item.get("release_date") if media_type == "movie" else item.get("first_air_date")
    year = _parse_year(release_date)

    return {
        "type": "movie" if media_type == "movie" else "show",
        "title": title,
        "year": year,
        "genre_names": _tmdb_search_genre_names(item, media_type),
        "overview": item.get("overview"),
        "poster_url": _tmdb_poster_url(item.get("poster_path")),
        "language_code": item.get("original_language"),
        "source": {
            "provider": "tmdb",
            "external_id": str(item.get("id")) if item.get("id") is not None else None,
            "source_type": "movie" if media_type == "movie" else "show",
        },
    }


def map_tmdb_payload_to_work(payload: Dict[str, Any], source_type: str) -> Dict[str, Any]:
    media_type = "movie" if source_type == "movie" else "tv"
    title = payload.get("title") if media_type == "movie" else payload.get("name")
    release_date = payload.get("release_date") if media_type == "movie" else payload.get("first_air_date")
    year = _parse_year(release_date)

    runtime = None
    if media_type == "movie":
        runtime = payload.get("runtime")
    else:
        runtimes = payload.get("episode_run_time") or []
        if runtimes:
            runtime = runtimes[0]

    return {
        "type": "movie" if media_type == "movie" else "show",
        "title": title,
        "year": year,
        "overview": payload.get("overview"),
        "poster_url": _tmdb_poster_url(payload.get("poster_path")),
        "language_code": payload.get("original_language"),
        "runtime_minutes": runtime,
        "tmdb_id": payload.get("id"),
        # Keep genre names alongside canonical work fields so the caller can sync work_genres.
        "genre_names": _extract_tmdb_genre_names(payload),
    }


def _extract_tmdb_genre_names(payload: Dict[str, Any]) -> list[str]:
    raw_genres = payload.get("genres") or []
    if not isinstance(raw_genres, list):
        return []

    names: list[str] = []
    for item in raw_genres:
        if isinstance(item, dict):
            name = item.get("name")
        elif isinstance(item, str):
            name = item
        else:
            name = None
        if isinstance(name, str):
            normalized = name.strip()
            if normalized:
                names.append(normalized)
    return names


def _tmdb_search_genre_names(item: Dict[str, Any], media_type: str) -> list[str]:
    genre_ids = item.get("genre_ids") or []
    if not isinstance(genre_ids, list):
        return []
    genre_map = TMDB_MOVIE_GENRE_MAP if media_type == "movie" else TMDB_TV_GENRE_MAP
    names: list[str] = []
    for genre_id in genre_ids:
        if not isinstance(genre_id, int):
            continue
        name = genre_map.get(genre_id)
        if name and name not in names:
            names.append(name)
    return names


def normalize_openlibrary_search_doc(doc: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    key = doc.get("key") or ""
    if not key.startswith("/works/"):
        return None

    work_id = key.split("/")[-1]
    year = doc.get("first_publish_year")
    if isinstance(year, str):
        year = _parse_year(year)

    cover_id = doc.get("cover_i")
    cover_edition = doc.get("cover_edition_key")

    language_code = None
    raw_langs = doc.get("language")
    if isinstance(raw_langs, list) and raw_langs:
        first = raw_langs[0]
        if isinstance(first, str) and first.strip():
            language_code = first.strip().lower()

    return {
        "type": "book",
        "title": doc.get("title"),
        "year": year,
        "overview": None,
        "poster_url": _openlibrary_cover_url(cover_id=cover_id, olid=cover_edition),
        "language_code": language_code,
        "source": {
            "provider": "openlibrary",
            "external_id": work_id,
            "source_type": "book",
        },
    }


def map_openlibrary_payload_to_work(payload: Dict[str, Any]) -> Dict[str, Any]:
    description = payload.get("description")
    if isinstance(description, dict):
        description = description.get("value")

    openlibrary_id = None
    key = payload.get("key")
    if isinstance(key, str) and key.startswith("/works/"):
        openlibrary_id = key.split("/")[-1]

    cover_ids = payload.get("covers") or []
    cover_id = cover_ids[0] if cover_ids else None

    year = _parse_year(payload.get("first_publish_date"))

    language_code = None
    raw_langs = payload.get("languages")
    if isinstance(raw_langs, list) and raw_langs:
        first = raw_langs[0]
        # Common shapes:
        # - {"key": "/languages/eng"}
        # - "/languages/eng"
        # - "eng"
        if isinstance(first, dict):
            key = first.get("key")
            if isinstance(key, str) and key.strip():
                language_code = key.strip().split("/")[-1].lower()
        elif isinstance(first, str) and first.strip():
            language_code = first.strip().split("/")[-1].lower()

    return {
        "type": "book",
        "title": payload.get("title"),
        "year": year,
        "overview": description,
        "poster_url": _openlibrary_cover_url(cover_id=cover_id),
        "language_code": language_code,
        "pages": payload.get("number_of_pages"),
        "openlibrary_id": openlibrary_id,
        "isbn13": _pick_isbn13(payload.get("isbn_13")),
    }


def _pick_isbn13(value: Any) -> Optional[str]:
    if isinstance(value, list):
        for isbn in value:
            if isinstance(isbn, str) and len(isbn) == 13:
                return isbn
        return value[0] if value else None
    if isinstance(value, str):
        return value
    return None

