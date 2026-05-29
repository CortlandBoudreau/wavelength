require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

pool.query(`
  -- Engagement score on summaries (1-10, Claude-generated)
  ALTER TABLE summaries ADD COLUMN IF NOT EXISTS engagement_score INTEGER CHECK (engagement_score BETWEEN 1 AND 10);

  -- Story cluster ID — stories about the same event share a cluster_id
  ALTER TABLE stories ADD COLUMN IF NOT EXISTS cluster_id UUID;
  CREATE INDEX IF NOT EXISTS idx_stories_cluster_id ON stories(cluster_id);

  -- Source quality ratings per user
  CREATE TABLE IF NOT EXISTS source_ratings (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID REFERENCES users(id) ON DELETE CASCADE,
    source     TEXT NOT NULL,
    rating     INTEGER CHECK (rating BETWEEN 1 AND 5) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, source)
  );
  CREATE INDEX IF NOT EXISTS idx_source_ratings_user ON source_ratings(user_id);
`)
.then(() => { console.log('Features migration complete!'); process.exit(0); })
.catch(e => { console.error('Migration failed:', e.message); process.exit(1); });
