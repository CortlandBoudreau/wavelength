-- Per-user notification preferences
-- Run once on staging and production.

ALTER TABLE users ADD COLUMN IF NOT EXISTS notification_prefs JSONB NOT NULL DEFAULT '{
  "daily_digest":          true,
  "daily_digest_hour":     9,
  "topic_alerts":          true,
  "posting_reminder":      false,
  "posting_reminder_days": 5
}'::jsonb;
