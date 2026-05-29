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

module.exports = router;
