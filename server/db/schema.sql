-- WaveLength Database Schema — canonical, fully consolidated
-- This is the single source of truth for a fresh DB setup.
-- Run: psql $DATABASE_URL -f server/db/schema.sql
-- Or:  node server/db/reset.js   (wipes existing data first)

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── Stories ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stories (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  title        TEXT        NOT NULL,
  source       TEXT,
  url          TEXT        UNIQUE,
  published_at TIMESTAMPTZ,
  category     TEXT,
  raw_body     TEXT,
  cluster_id   UUID,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  deleted_at   TIMESTAMPTZ DEFAULT NULL
);

-- ── AI summaries ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS summaries (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id         UUID        REFERENCES stories(id) ON DELETE CASCADE,
  summary          TEXT,
  bullets          JSONB,
  angle            TEXT        CHECK (angle IN ('educational', 'inspiring', 'surprising', 'trending')),
  hashtags         JSONB,
  engagement_score INTEGER     DEFAULT 5,
  decayed_score    FLOAT,
  caption          TEXT        DEFAULT NULL,
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
  subscription_tier       TEXT        NOT NULL DEFAULT 'free'
    CHECK (subscription_tier IN ('free', 'trial', 'pro', 'lifetime')),
  subscription_expires_at TIMESTAMPTZ DEFAULT NULL,
  email_verified          BOOLEAN     NOT NULL DEFAULT FALSE,
  email_verify_token      TEXT        DEFAULT NULL,
  email_verify_sent_at    TIMESTAMPTZ DEFAULT NULL,
  google_id               TEXT,
  push_token              TEXT,
  notification_prefs      JSONB       NOT NULL DEFAULT '{
    "daily_digest":          true,
    "daily_digest_hour":     9,
    "topic_alerts":          true,
    "posting_reminder":      false,
    "posting_reminder_days": 5
  }'::jsonb,
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
  viewed_at  TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (story_id, user_id)
);

-- ── Password reset tokens ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT        NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at    TIMESTAMPTZ DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Promo codes ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS promo_codes (
  code          TEXT        PRIMARY KEY,
  description   TEXT,
  grants_tier   TEXT        NOT NULL CHECK (grants_tier IN ('pro', 'lifetime')),
  duration_days INTEGER     DEFAULT NULL,
  max_uses      INTEGER     DEFAULT NULL,
  used_count    INTEGER     NOT NULL DEFAULT 0,
  valid_until   TIMESTAMPTZ DEFAULT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── Promo code redemptions ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS code_redemptions (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  code        TEXT        NOT NULL REFERENCES promo_codes(code),
  user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  redeemed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, code)
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

-- ── Email digest log ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS digests (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  sent_at    TIMESTAMPTZ,
  story_ids  JSONB,
  status     TEXT        CHECK (status IN ('sent', 'failed')) DEFAULT 'sent',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Trending topic moments ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS trending_topics (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_label   TEXT        NOT NULL,
  story_ids     JSONB       NOT NULL,
  story_count   INT         NOT NULL,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at    TIMESTAMPTZ NOT NULL,
  notified      BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Feedback ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS feedback (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        REFERENCES users(id) ON DELETE SET NULL,
  type       TEXT        NOT NULL CHECK (type IN ('bug', 'feature', 'general')),
  message    TEXT        NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Indexes ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_stories_active          ON stories(published_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_stories_category        ON stories(category);
CREATE INDEX IF NOT EXISTS idx_summaries_story_id      ON summaries(story_id);
CREATE INDEX IF NOT EXISTS idx_summaries_decayed_score ON summaries(decayed_score DESC);
CREATE INDEX IF NOT EXISTS idx_interactions_user       ON interactions(user_id);
CREATE INDEX IF NOT EXISTS idx_interactions_story      ON interactions(story_id);
CREATE INDEX IF NOT EXISTS idx_interactions_fav        ON interactions(favorited) WHERE favorited = TRUE;
CREATE INDEX IF NOT EXISTS idx_interactions_viewed_at  ON interactions(user_id, viewed_at) WHERE viewed_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_code_redemptions_user   ON code_redemptions(user_id);
CREATE INDEX IF NOT EXISTS idx_password_reset_user     ON password_reset_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_trending_topics_expires ON trending_topics(expires_at);
CREATE INDEX IF NOT EXISTS idx_feedback_user           ON feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_feedback_created        ON feedback(created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS users_google_id_idx  ON users(google_id) WHERE google_id IS NOT NULL;

-- ── Seed data ─────────────────────────────────────────────────────────────────
INSERT INTO promo_codes (code, description, grants_tier, duration_days, max_uses)
VALUES ('FOUNDER', 'Friends, family & early testers — lifetime access', 'lifetime', NULL, 10)
ON CONFLICT (code) DO NOTHING;
