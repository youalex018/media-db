-- HNSW index for sub-100ms cosine similarity lookups on work embeddings.
-- m=16, ef_construction=64 balances build speed vs recall for catalogs <100k works.
CREATE INDEX IF NOT EXISTS idx_work_embeddings_hnsw
    ON work_embeddings USING hnsw (embedding extensions.vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);

-- Index on work_people(person_id) for efficient reverse lookups (find works by person).
CREATE INDEX IF NOT EXISTS idx_work_people_person_id
    ON work_people (person_id);

-- Composite index for work_people role-based lookups (e.g., find all directors for a work).
CREATE INDEX IF NOT EXISTS idx_work_people_role
    ON work_people (work_id, role);

-- Vector similarity search via cosine distance.
-- Returns work_ids ranked by similarity to a query embedding.
-- Callable via Supabase RPC: supabase.rpc('match_works_by_embedding', {...})
CREATE OR REPLACE FUNCTION match_works_by_embedding(
    query_embedding text,
    match_count int DEFAULT 20,
    exclude_ids bigint[] DEFAULT '{}'
)
RETURNS TABLE (work_id bigint, similarity float)
LANGUAGE sql STABLE
SET search_path = public, extensions
AS $$
    SELECT
        we.work_id,
        1 - (we.embedding <=> query_embedding::vector(768)) AS similarity
    FROM work_embeddings we
    WHERE we.work_id != ALL(exclude_ids)
    ORDER BY we.embedding <=> query_embedding::vector(768)
    LIMIT match_count;
$$;

-- Genre-based Jaccard similarity between a seed work and all other works.
-- Returns candidates sharing at least one genre, scored by Jaccard index.
CREATE OR REPLACE FUNCTION genre_jaccard_candidates(
    seed_work_id bigint,
    max_results int DEFAULT 50,
    exclude_ids bigint[] DEFAULT '{}'
)
RETURNS TABLE (work_id bigint, jaccard float, shared_genres text[])
LANGUAGE sql STABLE
SET search_path = public
AS $$
    WITH seed_genres AS (
        SELECT genre_id FROM work_genres WHERE work_id = seed_work_id
    ),
    seed_count AS (
        SELECT COUNT(*)::int AS cnt FROM seed_genres
    ),
    candidates AS (
        SELECT
            wg.work_id,
            COUNT(*)::int AS shared,
            array_agg(g.name ORDER BY g.name) AS shared_names
        FROM work_genres wg
        JOIN seed_genres sg ON wg.genre_id = sg.genre_id
        JOIN genres g ON g.id = wg.genre_id
        WHERE wg.work_id != seed_work_id
          AND wg.work_id != ALL(exclude_ids)
        GROUP BY wg.work_id
    ),
    with_totals AS (
        SELECT
            c.work_id,
            c.shared,
            c.shared_names,
            (SELECT COUNT(*)::int FROM work_genres wg2 WHERE wg2.work_id = c.work_id) AS cand_total
        FROM candidates c
    )
    SELECT
        wt.work_id,
        wt.shared::float / GREATEST((SELECT cnt FROM seed_count) + wt.cand_total - wt.shared, 1)::float AS jaccard,
        wt.shared_names AS shared_genres
    FROM with_totals wt
    ORDER BY jaccard DESC
    LIMIT max_results;
$$;

-- People overlap between a seed work and all other works.
-- Directors weighted 3x, cast weighted 1x.
CREATE OR REPLACE FUNCTION people_overlap_candidates(
    seed_work_id bigint,
    max_results int DEFAULT 50,
    exclude_ids bigint[] DEFAULT '{}'
)
RETURNS TABLE (work_id bigint, overlap_score float, shared_people text[])
LANGUAGE sql STABLE
SET search_path = public
AS $$
    WITH seed_people AS (
        SELECT person_id, role,
               CASE WHEN role = 'director' THEN 3.0
                    WHEN role = 'author' THEN 3.0
                    ELSE 1.0 END AS weight
        FROM work_people WHERE work_id = seed_work_id
    ),
    seed_total AS (
        SELECT COALESCE(SUM(weight), 1.0) AS total FROM seed_people
    ),
    matches AS (
        SELECT
            wp.work_id,
            SUM(sp.weight) AS weighted_shared,
            array_agg(DISTINCT p.name) AS people_names
        FROM work_people wp
        JOIN seed_people sp ON sp.person_id = wp.person_id
        JOIN people p ON p.id = wp.person_id
        WHERE wp.work_id != seed_work_id
          AND wp.work_id != ALL(exclude_ids)
        GROUP BY wp.work_id
    )
    SELECT
        m.work_id,
        m.weighted_shared / (SELECT total FROM seed_total) AS overlap_score,
        m.people_names AS shared_people
    FROM matches m
    ORDER BY overlap_score DESC
    LIMIT max_results;
$$;
