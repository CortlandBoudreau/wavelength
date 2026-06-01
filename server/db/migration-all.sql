-- WaveLength: catch-up migration
-- Safely adds every column / table / index that may be missing from an older DB.
-- All statements are idempotent (IF NOT EXISTS / ADD COLUMN IF NOT EXISTS).

-- ── pgcrypto (needed for gen_random_uuid) ─────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── stories ───────────────────────────────────────────────────────────────────
ALTER TABLE stories
  ADD COLUMN IF NOT EXISTS cluster_id  UUID,
  ADD COLUMN IF NOT EXISTS deleted_at  TIMESTAMPTZ DEFAULT NULL;

-- ── summaries ─────────────────────────────────────────────────────────────────
ALTER TABLE summaries
  ADD COLUMN IF NOT EXISTS engagement_score INTEGER DEFAULT 5;

-- ── users ─────────────────────────────────────────────────────────────────────
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS hashtag_includes TEXT[]      DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS hashtag_excludes TEXT[]      DEFAULT '{}';

-- subscription columns (CHECK constraint must be added carefully)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'subscription_tier'
  ) THEN
    ALTER TABLE users
      ADD COLUMN subscription_tier TEXT NOT NULL DEFAULT 'free'
        CHECK (subscription_tier IN ('free', 'trial', 'pro', 'lifetime'));
  END IF;
END $$;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMPTZ DEFAULT NULL;

-- ── promo_codes ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS promo_codes (
  code          TEXT PRIMARY KEY,
  description   TEXT,
  grants_tier   TEXT NOT NULL CHECK (grants_tier IN ('pro', 'lifetime')),
  duration_days INTEGER     DEFAULT NULL,
  max_uses      INTEGER     DEFAULT NULL,
  used_count    INTEGER     NOT NULL DEFAULT 0,
  valid_until   TIMESTAMPTZ DEFAULT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── code_redemptions ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS code_redemptions (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  code        TEXT        NOT NULL REFERENCES promo_codes(code),
  user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  redeemed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, code)
);

-- ── source_ratings ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS source_ratings (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        REFERENCES users(id) ON DELETE CASCADE,
  source     TEXT        NOT NULL,
  rating     INTEGER     CHECK (rating BETWEEN 1 AND 5),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, source)
);

-- ── digests ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS digests (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  sent_at    TIMESTAMPTZ,
  story_ids  JSONB,
  status     TEXT        CHECK (status IN ('sent', 'failed')) DEFAULT 'sent',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── indexes ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_stories_active        ON stories(published_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_stories_category      ON stories(category);
CREATE INDEX IF NOT EXISTS idx_summaries_story_id    ON summaries(story_id);
CREATE INDEX IF NOT EXISTS idx_interactions_user     ON interactions(user_id);
CREATE INDEX IF NOT EXISTS idx_interactions_story    ON interactions(story_id);
CREATE INDEX IF NOT EXISTS idx_interactions_fav      ON interactions(favorited) WHERE favorited = TRUE;
CREATE INDEX IF NOT EXISTS idx_code_redemptions_user ON code_redemptions(user_id);

-- ── caption cache ────────────────────────────────────────────────────────────
ALTER TABLE summaries
  ADD COLUMN IF NOT EXISTS caption TEXT DEFAULT NULL;

-- ── email verification ────────────────────────────────────────────────────────
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS email_verified    BOOLEAN     NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS email_verify_token TEXT        DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS email_verify_sent_at TIMESTAMPTZ DEFAULT NULL;

-- ── password_reset_tokens ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT        NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at    TIMESTAMPTZ DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_password_reset_user ON password_reset_tokens(user_id);

-- ── seed data ─────────────────────────────────────────────────────────────────
INSERT INTO promo_codes (code, description, grants_tier, duration_days, max_uses)
VALUES ('FOUNDER', 'Friends, family & early testers — lifetime access', 'lifetime', NULL, 10)
ON CONFLICT (code) DO NOTHING;
