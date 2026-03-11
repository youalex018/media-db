ALTER TABLE profiles
    ADD COLUMN IF NOT EXISTS show_ratings boolean DEFAULT true,
    ADD COLUMN IF NOT EXISTS show_reviews boolean DEFAULT true;

COMMENT ON COLUMN profiles.show_ratings IS 'Expose ratings on public profile when true.';
COMMENT ON COLUMN profiles.show_reviews IS 'Expose reviews/notes on public profile when true.';
