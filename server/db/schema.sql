-- WaveLength Database Schema
-- This is the canonical schema for a fresh setup.
-- Run: psql $DATABASE_URL -f server/db/schema.sql

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── Stories ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stories (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  title        TEXT        NOT NULL,
  source       TEXT,
  url          TEXT        UNIQUE,
  published_at TIMESTAMPTZ,
  category     TEXT,       -- validated in app layer, not DB constraint (categories grow over time)
  raw_body     TEXT,
  cluster_id   UUID,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  deleted_at   TIMESTAMPTZ DEFAULT NULL  -- soft delete: NULL = live, set = removed
);

-- ── AI summaries ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS summaries (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id         UUID REFERENCES stories(id) ON DELETE CASCADE,
  summary          TEXT,
  bullets          JSONB,
  angle            TEXT CHECK (angle IN ('educational', 'inspiring', 'surprising', 'trending')),
  hashtags         JSONB,
  engagement_score INTEGER DEFAULT 5,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ── Users ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email                   TEXT        UNIQUE NOT NULL,
  name                    TEXT        NOT NULL,
  password_hash           TEXT        NOT NULL,
  interests               TEXT[]      DEFAULT '{}',
  hashtag_includes        TEXT[]      DEFAULT '{}',
  hashtag_excludes        TEXT[]      DEFAULT '{}',
  subscription_tier       TEXT        NOT NULL DEFAULT 'trial'
    CHECK (subscription_tier IN ('free', 'trial', 'pro', 'lifetime')),
  subscription_expires_at TIMESTAMPTZ DEFAULT NULL,
  created_at              TIMESTAMPTZ DEFAULT NOW()
);

-- ── User interactions with stories ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS interactions (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id   UUID        REFERENCES stories(id) ON DELETE CASCADE,
  user_id    UUID        REFERENCES users(id)   ON DELETE CASCADE,
  favorited  BOOLEAN     DEFAULT FALSE,
  notes      TEXT,
  tags       JSONB       DEFAULT '[]',
  used       BOOLEAN     DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (story_id, user_id)
);

-- ── Promo codes ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS promo_codes (
  code          TEXT PRIMARY KEY,
  description   TEXT,
  grants_tier   TEXT NOT NULL CHECK (grants_tier IN ('pro', 'lifetime')),
  duration_days INTEGER     DEFAULT NULL,   -- NULL = lifetime
  max_uses      INTEGER     DEFAULT NULL,   -- NULL = unlimited
  used_count    INTEGER     NOT NULL DEFAULT 0,
  valid_until   TIMESTAMPTZ DEFAULT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── Promo code redemption log ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS code_redemptions (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  code        TEXT        NOT NULL REFERENCES promo_codes(code),
  user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  redeemed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, code)
);

-- ── Email digest log ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS digests (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  sent_at    TIMESTAMPTZ,
  story_ids  JSONB,
  status     TEXT        CHECK (status IN ('sent', 'failed')) DEFAULT 'sent',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Source ratings ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS source_ratings (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        REFERENCES users(id) ON DELETE CASCADE,
  source     TEXT        NOT NULL,
  rating     INTEGER     CHECK (rating BETWEEN 1 AND 5),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, source)
);

-- ── Indexes ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_stories_active       ON stories(published_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_stories_category     ON stories(category);
CREATE INDEX IF NOT EXISTS idx_summaries_story_id   ON summaries(story_id);
CREATE INDEX IF NOT EXISTS idx_interactions_user    ON interactions(user_id);
CREATE INDEX IF NOT EXISTS idx_interactions_story   ON interactions(story_id);
CREATE INDEX IF NOT EXISTS idx_interactions_fav     ON interactions(favorited) WHERE favorited = TRUE;
CREATE INDEX IF NOT EXISTS idx_code_redemptions_user ON code_redemptions(user_id);

-- ── Seed data ─────────────────────────────────────────────────────────────────
INSERT INTO promo_codes (code, description, grants_tier, duration_days, max_uses)
VALUES ('FOUNDER', 'Friends, family & early testers — lifetime access', 'lifetime', NULL, 10)
ON CONFLICT (code) DO NOTHING;
