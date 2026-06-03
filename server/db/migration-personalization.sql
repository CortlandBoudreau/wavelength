-- Feed personalization: per-story view tracking
-- Adds viewed_at to interactions so we can compute category affinity.
-- Run once on staging and production.

ALTER TABLE interactions ADD COLUMN IF NOT EXISTS viewed_at TIMESTAMPTZ;

-- Index so the 30-day affinity CTE is fast
CREATE INDEX IF NOT EXISTS idx_interactions_viewed_at
  ON interactions(user_id, viewed_at)
  WHERE viewed_at IS NOT NULL;
