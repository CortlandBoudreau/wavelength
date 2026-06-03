-- Freshness decay + trending topic bursts
-- Run once on staging and production.

-- 1. Decayed engagement score on summaries
--    Updated nightly by the freshness-decay job.
--    Feeds the "Top Rated" sort so fresh stories outrank old ones of equal quality.
ALTER TABLE summaries ADD COLUMN IF NOT EXISTS decayed_score FLOAT;

-- Seed with the existing engagement scores so the feed works immediately
UPDATE summaries s
SET decayed_score = s.engagement_score
WHERE s.decayed_score IS NULL;

CREATE INDEX IF NOT EXISTS idx_summaries_decayed_score ON summaries(decayed_score DESC);

-- 2. Expo push tokens for server-initiated notifications
ALTER TABLE users ADD COLUMN IF NOT EXISTS push_token TEXT;

-- 3. Trending topic moments
--    A "topic moment" = 4+ stories sharing a keyword cluster in a 24-hour window.
CREATE TABLE IF NOT EXISTS trending_topics (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_label   TEXT NOT NULL,          -- e.g. "crispr gene therapy"
  story_ids     JSONB NOT NULL,          -- array of story UUIDs in this burst
  story_count   INT NOT NULL,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at    TIMESTAMPTZ NOT NULL,   -- first_seen_at + 36 hours
  notified      BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trending_topics_expires ON trending_topics(expires_at);
