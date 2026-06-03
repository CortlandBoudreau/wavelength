-- Google OAuth support
-- Run once on staging and production.

ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id TEXT;

-- Unique partial index: only enforces uniqueness for rows that actually have a google_id
CREATE UNIQUE INDEX IF NOT EXISTS users_google_id_idx
  ON users(google_id)
  WHERE google_id IS NOT NULL;
