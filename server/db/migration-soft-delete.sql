-- Soft-delete support for stories
-- Run once against the live database

ALTER TABLE stories ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- Partial index: fast lookup of live (non-deleted) stories
CREATE INDEX IF NOT EXISTS idx_stories_active
  ON stories(published_at DESC)
  WHERE deleted_at IS NULL;
