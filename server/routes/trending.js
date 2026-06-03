const express = require('express');
const router = express.Router();
const { getTrendingHashtags } = require('../services/trendingHashtags');

// GET /api/trending/hashtags?days=7&limit=20
// Public endpoint — no auth required
router.get('/hashtags', async (req, res) => {
  try {
    const days  = Math.min(Math.max(parseInt(req.query.days)  || 7,  1), 30);
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 20, 1), 50);
    const hashtags = await getTrendingHashtags({ days, limit });
    res.json(hashtags);
  } catch (err) {
    console.error('[GET /trending/hashtags]', err.message);
    res.status(500).json({ error: 'Failed to load trending hashtags' });
  }
});

// GET /api/trending/topics
// Returns active topic moments (bursts of 4+ stories on the same topic in 24h).
// Public endpoint — no auth required.
router.get('/topics', async (req, res) => {
  const pool = require('../db/pool');
  try {
    const { rows } = await pool.query(`
      SELECT tt.id, tt.topic_label, tt.story_count, tt.story_ids,
             tt.first_seen_at, tt.expires_at,
             -- Attach the top story for each burst (highest decayed_score)
             (
               SELECT json_build_object(
                 'id',    s.id,
                 'title', s.title,
                 'category', s.category
               )
               FROM stories s
               INNER JOIN summaries sum ON sum.story_id = s.id
               WHERE s.id = ANY(
                 SELECT jsonb_array_elements_text(tt.story_ids)::uuid
               )
               AND s.deleted_at IS NULL
               ORDER BY COALESCE(sum.decayed_score, sum.engagement_score) DESC
               LIMIT 1
             ) AS top_story
      FROM trending_topics tt
      WHERE tt.expires_at > NOW()
      ORDER BY tt.story_count DESC, tt.first_seen_at DESC
      LIMIT 5
    `);
    res.json({ topics: rows });
  } catch (err) {
    console.error('[GET /trending/topics]', err.message);
    res.status(500).json({ error: 'Failed to load topic moments' });
  }
});

module.exports = router;
