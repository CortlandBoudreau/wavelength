const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);

// GET /api/analytics
router.get('/', async (req, res) => {
  try {
    const userId = req.user.id;
    const [totals, byCategory, topSources, recentActivity] = await Promise.all([
      pool.query(`
        SELECT
          COUNT(DISTINCT s.id) AS total_stories,
          COUNT(DISTINCT i.story_id) FILTER (WHERE i.favorited) AS total_favorited,
          COUNT(DISTINCT i.story_id) FILTER (WHERE i.used) AS total_used
        FROM stories s
        LEFT JOIN interactions i ON i.story_id = s.id AND i.user_id = $1
      `, [userId]),
      pool.query(`
        SELECT s.category,
          COUNT(DISTINCT s.id) AS total,
          COUNT(DISTINCT i.story_id) FILTER (WHERE i.favorited) AS favorited,
          COUNT(DISTINCT i.story_id) FILTER (WHERE i.used) AS used
        FROM stories s
        LEFT JOIN interactions i ON i.story_id = s.id AND i.user_id = $1
        GROUP BY s.category ORDER BY favorited DESC
      `, [userId]),
      pool.query(`
        SELECT s.source, COUNT(*) AS count,
               COUNT(i.story_id) FILTER (WHERE i.favorited) AS favorited
        FROM stories s
        LEFT JOIN interactions i ON i.story_id = s.id AND i.user_id = $1
        GROUP BY s.source ORDER BY favorited DESC LIMIT 10
      `, [userId]),
      pool.query(`
        SELECT DATE(s.created_at) AS date, COUNT(*) AS stories_added
        FROM stories s
        WHERE s.created_at > NOW() - INTERVAL '30 days'
          AND EXISTS (
            SELECT 1 FROM interactions i
            WHERE i.story_id = s.id AND i.user_id = $1
          )
        GROUP BY DATE(s.created_at) ORDER BY date DESC
      `, [userId]),
    ]);

    res.json({
      totals: totals.rows[0],
      byCategory: byCategory.rows,
      topSources: topSources.rows,
      recentActivity: recentActivity.rows,
    });
  } catch (err) {
    console.error('[GET /analytics]', err.message);
    res.status(500).json({ error: 'Failed to load analytics' }); // never expose err.message to client
  }
});

// GET /api/analytics/affinity
// Returns per-category engagement scores for the logged-in user, used by the
// mobile app to render the Interest Profile card.
//
// Response shape:
//   { affinity: [ { category, views, favorites, posted, affinity_score }, ... ] }
//   affinity_score is 0–1, normalised against the user's top category.
//   Categories with no interactions in the last 30 days are omitted.
router.get('/affinity', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      WITH raw AS (
        SELECT
          s.category,
          COUNT(*)                                                         AS views,
          COUNT(*) FILTER (WHERE i.favorited)                             AS favorites,
          COUNT(*) FILTER (WHERE i.used)                                  AS posted,
          SUM(
            CASE WHEN i.viewed_at IS NOT NULL THEN 1 ELSE 0 END +
            CASE WHEN i.favorited             THEN 3 ELSE 0 END +
            CASE WHEN i.used                  THEN 5 ELSE 0 END
          )::float                                                         AS score
        FROM interactions i
        JOIN stories s ON s.id = i.story_id
        WHERE i.user_id = $1
          AND i.viewed_at > NOW() - INTERVAL '30 days'
        GROUP BY s.category
      ),
      max_score AS (
        SELECT GREATEST(MAX(score), 1) AS max_score FROM raw
      )
      SELECT
        r.category,
        r.views::int,
        r.favorites::int,
        r.posted::int,
        ROUND((r.score / m.max_score)::numeric, 3) AS affinity_score
      FROM raw r, max_score m
      ORDER BY r.score DESC
    `, [req.user.id]);

    res.json({ affinity: rows });
  } catch (err) {
    console.error('[GET /analytics/affinity]', err.message);
    res.status(500).json({ error: 'Failed to load affinity data' });
  }
});

module.exports = router;
