-- Create extensions schema for security (isolate extensions from public schema)
CREATE SCHEMA IF NOT EXISTS extensions;

-- Enable required extensions in dedicated schema
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm" SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "vector" SCHEMA extensions;

-- Grant usage on extensions schema so extension types are accessible
GRANT USAGE ON SCHEMA extensions TO authenticated;
GRANT USAGE ON SCHEMA extensions TO anon;
GRANT USAGE ON SCHEMA extensions TO service_role;

-- Create custom types
CREATE TYPE work_type AS ENUM ('movie', 'show', 'book');
CREATE TYPE read_status AS ENUM ('wishlist', 'in_progress', 'finished', 'abandoned');

-- Create tables
CREATE TABLE profiles (
    id uuid PRIMARY KEY DEFAULT auth.uid(),
    username text UNIQUE,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE works (
    id bigserial PRIMARY KEY,
    type work_type NOT NULL,
    title text NOT NULL,
    year smallint,
    language_code text,
    runtime_minutes integer,
    pages integer,
    tmdb_id integer UNIQUE,
    openlibrary_id text UNIQUE,
    isbn13 text UNIQUE,
    overview text,
    poster_url text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE TABLE people (
    id bigserial PRIMARY KEY,
    name text NOT NULL,
    tmdb_person_id integer UNIQUE,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE work_people (
    work_id bigint REFERENCES works(id) ON DELETE CASCADE,
    person_id bigint REFERENCES people(id) ON DELETE CASCADE,
    role text NOT NULL,
    ordinal integer DEFAULT 0,
    PRIMARY KEY (work_id, person_id, role)
);

CREATE TABLE genres (
    id bigserial PRIMARY KEY,
    name text UNIQUE NOT NULL,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE work_genres (
    work_id bigint REFERENCES works(id) ON DELETE CASCADE,
    genre_id bigint REFERENCES genres(id) ON DELETE CASCADE,
    PRIMARY KEY (work_id, genre_id)
);

CREATE TABLE user_items (
    id bigserial PRIMARY KEY,
    user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    work_id bigint REFERENCES works(id) ON DELETE CASCADE NOT NULL,
    status read_status DEFAULT 'wishlist',
    rating smallint CHECK (rating >= 0 AND rating <= 100),
    started_at date,
    finished_at date,
    notes text,
    visibility text DEFAULT 'private',
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    UNIQUE(user_id, work_id)
);

CREATE TABLE user_tag_names (
    id bigserial PRIMARY KEY,
    user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    name text NOT NULL,
    created_at timestamptz DEFAULT now(),
    UNIQUE(user_id, name)
);

CREATE TABLE user_item_tags (
    user_item_id bigint REFERENCES user_items(id) ON DELETE CASCADE,
    tag_id bigint REFERENCES user_tag_names(id) ON DELETE CASCADE,
    PRIMARY KEY (user_item_id, tag_id)
);

CREATE TABLE sources (
    id bigserial PRIMARY KEY,
    provider text NOT NULL,
    external_id text NOT NULL,
    payload jsonb NOT NULL,
    fetched_at timestamptz DEFAULT now(),
    UNIQUE(provider, external_id)
);

CREATE TABLE work_embeddings (
    work_id bigint PRIMARY KEY REFERENCES works(id) ON DELETE CASCADE,
    embedding extensions.vector(768),
    updated_at timestamptz DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX idx_works_title_trgm ON works USING GIN (lower(title) extensions.gin_trgm_ops);
CREATE INDEX idx_works_type_year ON works (type, year);
CREATE INDEX idx_works_tmdb_id ON works (tmdb_id) WHERE tmdb_id IS NOT NULL;
CREATE INDEX idx_works_openlibrary_id ON works (openlibrary_id) WHERE openlibrary_id IS NOT NULL;
CREATE INDEX idx_user_items_user_created ON user_items (user_id, created_at DESC);
CREATE INDEX idx_user_items_user_status ON user_items (user_id, status);
CREATE INDEX idx_user_items_user_rating ON user_items (user_id, rating DESC) WHERE rating IS NOT NULL;
CREATE INDEX idx_people_name_trgm ON people USING GIN (lower(name) extensions.gin_trgm_ops);
CREATE INDEX idx_sources_provider_external ON sources (provider, external_id);

-- Create timestamp update trigger function
-- Note: SET search_path for security (prevents search_path manipulation attacks)
CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

-- Add update triggers
CREATE TRIGGER trigger_works_updated_at
    BEFORE UPDATE ON works
    FOR EACH ROW
    EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER trigger_user_items_updated_at
    BEFORE UPDATE ON user_items
    FOR EACH ROW
    EXECUTE FUNCTION touch_updated_at();

-- Enable Row Level Security on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE works ENABLE ROW LEVEL SECURITY;
ALTER TABLE people ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_people ENABLE ROW LEVEL SECURITY;
ALTER TABLE genres ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_genres ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_tag_names ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_item_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_embeddings ENABLE ROW LEVEL SECURITY;

-- Profiles policies (users can only access their own profile)
-- Note: Using (select auth.uid()) instead of auth.uid() for performance
-- This prevents re-evaluation per row and significantly improves query performance at scale
CREATE POLICY "Users can view own profile" ON profiles
    FOR SELECT USING ((select auth.uid()) = id);

CREATE POLICY "Users can update own profile" ON profiles
    FOR UPDATE USING ((select auth.uid()) = id);

CREATE POLICY "Users can insert own profile" ON profiles
    FOR INSERT WITH CHECK ((select auth.uid()) = id);

-- User-scoped table policies (user_items, user_tag_names, user_item_tags)
CREATE POLICY "Users can manage own items" ON user_items
    FOR ALL USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can manage own tag names" ON user_tag_names
    FOR ALL USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can manage own item tags" ON user_item_tags
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_items ui 
            WHERE ui.id = user_item_tags.user_item_id 
            AND ui.user_id = (select auth.uid())
        )
    );

-- Public read-only policies for catalog tables (no insert/update/delete policies = service role only for writes)
CREATE POLICY "Public read access to works" ON works
    FOR SELECT USING (true);

CREATE POLICY "Public read access to people" ON people
    FOR SELECT USING (true);

CREATE POLICY "Public read access to work_people" ON work_people
    FOR SELECT USING (true);

CREATE POLICY "Public read access to genres" ON genres
    FOR SELECT USING (true);

CREATE POLICY "Public read access to work_genres" ON work_genres
    FOR SELECT USING (true);

CREATE POLICY "Public read access to sources" ON sources
    FOR SELECT USING (true);

CREATE POLICY "Public read access to work_embeddings" ON work_embeddings
    FOR SELECT USING (true);

-- Create a profile automatically when a user signs up
CREATE OR REPLACE FUNCTION create_profile_for_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO profiles (id, username)
    VALUES (NEW.id, NEW.email);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION create_profile_for_new_user();
