-- Free tier: daily story view tracking
CREATE TABLE IF NOT EXISTS story_views (
  user_id    UUID    REFERENCES users(id) ON DELETE CASCADE,
  view_date  DATE    NOT NULL DEFAULT CURRENT_DATE,
  count      INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, view_date)
);
