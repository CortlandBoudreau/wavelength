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

module.exports = router;
