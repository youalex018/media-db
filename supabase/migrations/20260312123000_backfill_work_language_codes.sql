-- Backfill works.language_code from cached sources payloads (best-effort).
-- TMDb: payload.original_language (ISO 639-1)
-- Open Library: payload.language (search docs) OR payload.languages (detail payloads)

-- TMDb backfill
UPDATE works w
SET language_code = NULLIF(lower(s.payload->>'original_language'), '')
FROM sources s
WHERE s.provider = 'tmdb'
  AND w.tmdb_id IS NOT NULL
  AND s.external_id = w.tmdb_id::text
  AND (w.language_code IS NULL OR w.language_code = '');

-- Open Library backfill from search-doc cached payload: payload.language[0] (e.g. ["eng"])
UPDATE works w
SET language_code = NULLIF(lower((s.payload->'language'->>0)), '')
FROM sources s
WHERE s.provider = 'openlibrary'
  AND w.openlibrary_id IS NOT NULL
  AND s.external_id = w.openlibrary_id
  AND (w.language_code IS NULL OR w.language_code = '')
  AND jsonb_typeof(s.payload->'language') = 'array';

-- Open Library backfill from detail payload: payload.languages[0].key (e.g. "/languages/eng")
UPDATE works w
SET language_code = NULLIF(
  lower(
    split_part(coalesce((s.payload->'languages'->0->>'key'), (s.payload->'languages'->>0)), '/languages/', 2)
  ),
  ''
)
FROM sources s
WHERE s.provider = 'openlibrary'
  AND w.openlibrary_id IS NOT NULL
  AND s.external_id = w.openlibrary_id
  AND (w.language_code IS NULL OR w.language_code = '')
  AND (s.payload ? 'languages');

-- Optional index for filtering.
CREATE INDEX IF NOT EXISTS idx_works_language_code ON works (language_code) WHERE language_code IS NOT NULL;

