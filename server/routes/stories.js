const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');
const { optionalAuth } = require('../middleware/optionalAuth');
const { validateUUID, validateNotes, VALID_CATEGORIES } = require('../middleware/validate');
const { runAggregation } = require('../services/newsAggregator');
const { summarizeUnsummarized } = require('../services/claudeSummarizer');
const { clusterRecentStories } = require('../services/clusterStories');

const FREE_DAILY_LIMIT = 3;

// GET /api/stories — public, but attaches user interactions if logged in
router.get('/', optionalAuth, async (req, res) => {
  try {
    const { favorited, limit = 50, offset = 0 } = req.query;
    const category = VALID_CATEGORIES.has(req.query.category) ? req.query.category : null;
    const categories = req.query.categories
      ? req.query.categories.split(',').filter((c) => VALID_CATEGORIES.has(c))
      : null;
    let safeLimit = Math.min(Math.max(parseInt(limit) || 50, 1), 100);
    const safeOffset = Math.max(parseInt(offset) || 0, 0);
    const userId = req.user?.id || null;

    // ── Free-tier gate ──────────────────────────────────────────────────────
    let isFree = !userId; // guests always limited
    if (userId) {
      const { rows: [u] } = await pool.query(
        'SELECT subscription_tier, subscription_expires_at FROM users WHERE id = $1',
        [userId]
      );
      const tier = u?.subscription_tier ?? 'free';
      const exp  = u?.subscription_expires_at ? new Date(u.subscription_expires_at) : null;
      isFree = tier === 'free' || (tier !== 'lifetime' && (!exp || exp <= new Date()));
    }

    let viewsToday = 0;

    if (isFree && userId) {
      // Ensure a row exists for today
      await pool.query(
        `INSERT INTO story_views (user_id, view_date, count)
         VALUES ($1, CURRENT_DATE, 0)
         ON CONFLICT (user_id, view_date) DO NOTHING`,
        [userId]
      );
      const { rows: [vr] } = await pool.query(
        'SELECT count FROM story_views WHERE user_id = $1 AND view_date = CURRENT_DATE',
        [userId]
      );
      viewsToday = vr?.count ?? 0;

      if (viewsToday >= FREE_DAILY_LIMIT) {
        return res.json({ stories: [], limitReached: true, viewsToday });
      }
      safeLimit = Math.min(safeLimit, FREE_DAILY_LIMIT - viewsToday);
    } else if (isFree && !userId) {
      // Guests: cap each request at the daily limit (no persistent tracking)
      safeLimit = Math.min(safeLimit, FREE_DAILY_LIMIT);
    }
    // ────────────────────────────────────────────────────────────────────────

    const conditions = ['s.deleted_at IS NULL'];
    const params = [userId];

    if (category) {
      params.push(category);
      conditions.push(`s.category = $${params.length}`);
    } else if (categories && categories.length > 0) {
      params.push(categories);
      conditions.push(`s.category = ANY($${params.length})`);
    }
    if (favorited === 'true' && userId) {
      conditions.push(`i.favorited = TRUE`);
    }

    const { rows } = await pool.query(`
      SELECT s.*, sum.summary, sum.bullets, sum.angle, sum.hashtags, sum.engagement_score,
             i.favorited, i.notes, i.tags, i.used
      FROM stories s
      INNER JOIN summaries sum ON sum.story_id = s.id
      LEFT JOIN interactions i ON i.story_id = s.id AND ($1::uuid IS NULL OR i.user_id = $1)
      WHERE ${conditions.join(' AND ')}
      ORDER BY s.published_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `, [...params, safeLimit, safeOffset]);

    // Increment daily view count for tracked free users
    if (isFree && userId && rows.length > 0) {
      await pool.query(
        'UPDATE story_views SET count = count + $1 WHERE user_id = $2 AND view_date = CURRENT_DATE',
        [rows.length, userId]
      );
      viewsToday += rows.length;
    }

    const limitReached = isFree && viewsToday >= FREE_DAILY_LIMIT;
    res.json({ stories: rows, limitReached, viewsToday });
  } catch (err) {
    console.error('[GET /stories]', err.message);
    res.status(500).json({ error: 'Failed to load stories' });
  }
});

// GET /api/stories/categories — distinct categories currently in the DB
router.get('/categories', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT DISTINCT category FROM stories WHERE deleted_at IS NULL ORDER BY category ASC`
    );
    res.json(rows.map((r) => r.category));
  } catch (err) {
    console.error('[GET /stories/categories]', err.message);
    res.status(500).json({ error: 'Failed to load categories' });
  }
});

// GET /api/stories/:id — public
router.get('/:id', optionalAuth, async (req, res) => {
  if (!validateUUID(req.params.id, res)) return;
  try {
    const userId = req.user?.id || null;
    const { rows } = await pool.query(`
      SELECT s.*, sum.summary, sum.bullets, sum.angle, sum.hashtags, sum.engagement_score,
             i.favorited, i.notes, i.tags, i.used
      FROM stories s
      INNER JOIN summaries sum ON sum.story_id = s.id
      LEFT JOIN interactions i ON i.story_id = s.id AND ($2::uuid IS NULL OR i.user_id = $2)
      WHERE s.id = $1 AND s.deleted_at IS NULL
    `, [req.params.id, userId]);

    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('[GET /stories/:id]', err.message);
    res.status(500).json({ error: 'Failed to load story' });
  }
});

// POST /api/stories/refresh — admin only (server-side secret, not user auth)
// Aggregation runs automatically via the scheduler; this exists for manual dev triggers.
router.post('/refresh', (req, res, next) => {
  const secret = process.env.ADMIN_SECRET;
  if (!secret || req.headers['x-admin-secret'] !== secret) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
}, async (req, res) => {
  try {
    const aggResult = await runAggregation();
    const summarized = await summarizeUnsummarized();
    const clusters = await clusterRecentStories();
    res.json({ ...aggResult, summarized, clusters });
  } catch (err) {
    console.error('[POST /stories/refresh]', err.message);
    res.status(500).json({ error: 'Aggregation failed' });
  }
});

// All interaction mutations require auth
router.patch('/:id/favorite', requireAuth, async (req, res) => {
  if (!validateUUID(req.params.id, res)) return;
  try {
    const { rows: existing } = await pool.query(
      'SELECT * FROM interactions WHERE story_id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    if (existing.length) {
      const toggled = !existing[0].favorited;
      await pool.query(
        'UPDATE interactions SET favorited = $1, updated_at = NOW() WHERE story_id = $2 AND user_id = $3',
        [toggled, req.params.id, req.user.id]
      );
      res.json({ favorited: toggled });
    } else {
      await pool.query(
        'INSERT INTO interactions (story_id, user_id, favorited) VALUES ($1, $2, TRUE)',
        [req.params.id, req.user.id]
      );
      res.json({ favorited: true });
    }
  } catch (err) {
    console.error('[PATCH /favorite]', err.message);
    res.status(500).json({ error: 'Failed to toggle favorite' });
  }
});

router.patch('/:id/notes', requireAuth, validateNotes, async (req, res) => {
  if (!validateUUID(req.params.id, res)) return;
  try {
    const { notes, tags } = req.body;
    const { rows: existing } = await pool.query(
      'SELECT * FROM interactions WHERE story_id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    if (existing.length) {
      await pool.query(
        `UPDATE interactions SET notes = $1, tags = $2, updated_at = NOW() WHERE story_id = $3 AND user_id = $4`,
        [notes, JSON.stringify(tags || existing[0].tags || []), req.params.id, req.user.id]
      );
    } else {
      await pool.query(
        `INSERT INTO interactions (story_id, user_id, notes, tags) VALUES ($1, $2, $3, $4)`,
        [req.params.id, req.user.id, notes, JSON.stringify(tags || [])]
      );
    }
    res.json({ ok: true });
  } catch (err) {
    console.error('[PATCH /notes]', err.message);
    res.status(500).json({ error: 'Failed to save notes' });
  }
});

router.patch('/:id/used', requireAuth, async (req, res) => {
  if (!validateUUID(req.params.id, res)) return;
  try {
    const { rows: existing } = await pool.query(
      'SELECT * FROM interactions WHERE story_id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    if (existing.length) {
      const toggled = !existing[0].used;
      await pool.query(
        'UPDATE interactions SET used = $1, updated_at = NOW() WHERE story_id = $2 AND user_id = $3',
        [toggled, req.params.id, req.user.id]
      );
      res.json({ used: toggled });
    } else {
      await pool.query(
        'INSERT INTO interactions (story_id, user_id, used) VALUES ($1, $2, TRUE)',
        [req.params.id, req.user.id]
      );
      res.json({ used: true });
    }
  } catch (err) {
    console.error('[PATCH /used]', err.message);
    res.status(500).json({ error: 'Failed to toggle used' });
  }
});

module.exports = router;
