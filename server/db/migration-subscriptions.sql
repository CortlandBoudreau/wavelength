-- Migration: Subscription & promo-code system
-- Run once: psql $DATABASE_URL -f server/db/migration-subscriptions.sql

-- ── 1. Subscription fields on users ──────────────────────────────────────────
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS subscription_tier TEXT NOT NULL DEFAULT 'trial'
    CHECK (subscription_tier IN ('free', 'trial', 'pro', 'lifetime')),
  ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMPTZ DEFAULT NULL;

-- Existing users get free tier (they missed the auto-trial on registration)
UPDATE users SET subscription_tier = 'free' WHERE subscription_tier = 'trial'
  AND created_at < NOW() - INTERVAL '7 days';

-- ── 2. Promo codes ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS promo_codes (
  code             TEXT PRIMARY KEY,
  description      TEXT,                   -- e.g. "Reddit beta testers May 2026"
  grants_tier      TEXT NOT NULL
    CHECK (grants_tier IN ('pro', 'lifetime')),
  duration_days    INTEGER DEFAULT NULL,   -- NULL = lifetime; otherwise days of pro access
  max_uses         INTEGER DEFAULT NULL,   -- NULL = unlimited
  used_count       INTEGER NOT NULL DEFAULT 0,
  valid_until      TIMESTAMPTZ DEFAULT NULL, -- NULL = never expires
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ── 3. Redemption log ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS code_redemptions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code         TEXT NOT NULL REFERENCES promo_codes(code),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  redeemed_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, code)   -- each user can only redeem a given code once
);

CREATE INDEX IF NOT EXISTS idx_code_redemptions_user ON code_redemptions(user_id);

-- ── 4. Seed: a lifetime "FOUNDER" code (10 uses, never expires) ───────────────
INSERT INTO promo_codes (code, description, grants_tier, duration_days, max_uses)
VALUES ('FOUNDER', 'Friends, family & early testers — lifetime access', 'lifetime', NULL, 10)
ON CONFLICT (code) DO NOTHING;
