ALTER TABLE profiles
    ADD COLUMN IF NOT EXISTS is_public boolean DEFAULT false,
    ADD COLUMN IF NOT EXISTS show_username boolean DEFAULT true,
    ADD COLUMN IF NOT EXISTS show_avatar boolean DEFAULT true,
    ADD COLUMN IF NOT EXISTS avatar_url text;

COMMENT ON COLUMN profiles.is_public IS 'If true, profile can be viewed publicly.';
COMMENT ON COLUMN profiles.show_username IS 'Expose username on public profile when true.';
COMMENT ON COLUMN profiles.show_avatar IS 'Expose avatar_url on public profile when true.';
COMMENT ON COLUMN profiles.avatar_url IS 'Optional user avatar URL.';
