ALTER TABLE profiles
    ADD COLUMN IF NOT EXISTS ai_insights text,
    ADD COLUMN IF NOT EXISTS ai_insights_updated_at timestamptz;

COMMENT ON COLUMN profiles.ai_insights IS 'Last generated AI taste profile analysis.';
COMMENT ON COLUMN profiles.ai_insights_updated_at IS 'Timestamp of the last AI insights generation.';
