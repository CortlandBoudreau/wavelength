-- Migration: Add multi-user support
-- Run this against your existing wavelength DB

-- 1. Users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  interests TEXT[] DEFAULT '{"marine_science","diversity_stem","science","cool_facts"}',
  hashtag_includes TEXT[] DEFAULT '{}',  -- hashtags to surface (e.g. '#BlackInSTEM')
  hashtag_excludes TEXT[] DEFAULT '{}',  -- hashtags to suppress
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Add user_id to interactions (drop old single-story unique, add per-user unique)
ALTER TABLE interactions
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE;

-- Drop old unique constraint on story_id alone (may be named differently)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'interactions'::regclass AND contype = 'u' AND conname = 'interactions_story_id_key'
  ) THEN
    ALTER TABLE interactions DROP CONSTRAINT interactions_story_id_key;
  END IF;
END$$;

-- New unique: one interaction row per user per story
ALTER TABLE interactions
  DROP CONSTRAINT IF EXISTS interactions_story_user_key;
ALTER TABLE interactions
  ADD CONSTRAINT interactions_story_user_key UNIQUE (story_id, user_id);

CREATE INDEX IF NOT EXISTS idx_interactions_user_id ON interactions(user_id);
