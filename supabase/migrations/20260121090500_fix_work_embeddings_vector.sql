-- Ensure vector type is available from extensions schema
CREATE EXTENSION IF NOT EXISTS "vector" SCHEMA extensions;

-- Create table if migration previously failed before creation
CREATE TABLE IF NOT EXISTS work_embeddings (
    work_id bigint PRIMARY KEY REFERENCES works(id) ON DELETE CASCADE,
    embedding extensions.vector(768),
    updated_at timestamptz DEFAULT now()
);

-- If table exists with wrong type, fix it
ALTER TABLE work_embeddings
    ALTER COLUMN embedding TYPE extensions.vector(768);
