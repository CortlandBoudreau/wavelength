const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');

// GET /api/sources — list distinct sources with avg rating for the logged-in user
router.get('/', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT s.source, COUNT(*) AS story_count,
              sr.rating AS my_rating
       FROM stories s
       LEFT JOIN source_ratings sr ON sr.source = s.source AND sr.user_id = $1
       GROUP BY s.source, sr.rating
       ORDER BY story_count DESC`,
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    console.error('[GET /sources]', err.message);
    res.status(500).json({ error: 'Failed to load sources' });
  }
});

// POST /api/sources/rate — upsert a rating (1-5) for a source
router.post('/rate', requireAuth, async (req, res) => {
  const { source, rating } = req.body;

  if (typeof source !== 'string' || source.trim().length === 0 || source.length > 200) {
    return res.status(400).json({ error: 'Invalid source' });
  }
  const r = parseInt(rating, 10);
  if (isNaN(r) || r < 1 || r > 5) {
    return res.status(400).json({ error: 'Rating must be an integer 1–5' });
  }

  try {
    await pool.query(
      `INSERT INTO source_ratings (user_id, source, rating)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, source)
       DO UPDATE SET rating = EXCLUDED.rating, created_at = NOW()`,
      [req.user.id, source.trim(), r]
    );
    res.json({ ok: true, source: source.trim(), rating: r });
  } catch (err) {
    console.error('[POST /sources/rate]', err.message);
    res.status(500).json({ error: 'Failed to save rating' });
  }
});

// DELETE /api/sources/rate — remove a user's rating for a source
router.delete('/rate', requireAuth, async (req, res) => {
  const { source } = req.body;
  if (typeof source !== 'string' || source.trim().length === 0) {
    return res.status(400).json({ error: 'Invalid source' });
  }
  try {
    await pool.query(
      'DELETE FROM source_ratings WHERE user_id = $1 AND source = $2',
      [req.user.id, source.trim()]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('[DELETE /sources/rate]', err.message);
    res.status(500).json({ error: 'Failed to remove rating' });
  }
});

module.exports = router;
