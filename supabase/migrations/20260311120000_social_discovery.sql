-- Trigram index on profiles.username for fuzzy user search
CREATE INDEX IF NOT EXISTS idx_profiles_username_trgm
    ON profiles USING gin (lower(username) extensions.gin_trgm_ops);

-- Partial index on is_public for fast filtering of public profiles
CREATE INDEX IF NOT EXISTS idx_profiles_is_public
    ON profiles (is_public) WHERE is_public = true;
