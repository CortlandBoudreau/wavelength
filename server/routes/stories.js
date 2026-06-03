const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');
const { optionalAuth } = require('../middleware/optionalAuth');
const { validateUUID, validateNotes, VALID_CATEGORIES } = require('../middleware/validate');
const { runAggregation } = require('../services/newsAggregator');
const { summarizeUnsummarized, generateCaption } = require('../services/claudeSummarizer');
const { clusterRecentStories } = require('../services/clusterStories');

const FREE_DAILY_LIMIT = 3;

// GET /api/stories — public, attaches user interactions if logged in
// No feed cap — all stories visible to everyone. Free tier gates the detail view.
router.get('/', optionalAuth, async (req, res) => {
  try {
    const { favorited, limit = 50, offset = 0 } = req.query;
    const sortByScore = req.query.sort === 'score';
    // ?since=N  — only return stories published within the last N hours (max 168 = 7 days)
    const sinceHours = req.query.since ? Math.min(Math.max(parseInt(req.query.since) || 0, 1), 168) : null;
    const category = VALID_CATEGORIES.has(req.query.category) ? req.query.category : null;
    const categories = req.query.categories
      ? req.query.categories.split(',').filter((c) => VALID_CATEGORIES.has(c))
      : null;
    const safeLimit = Math.min(Math.max(parseInt(limit) || 50, 1), 100);
    const safeOffset = Math.max(parseInt(offset) || 0, 0);
    const userId = req.user?.id || null;

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
    if (sinceHours) {
      conditions.push(`s.published_at > NOW() - INTERVAL '${sinceHours} hours'`);
    }

    const { rows } = await pool.query(`
      SELECT s.*, sum.summary, sum.bullets, sum.angle, sum.hashtags, sum.engagement_score,
             i.favorited, i.notes, i.tags, i.used,
             CASE WHEN s.cluster_id IS NOT NULL THEN (
               SELECT COUNT(*) FROM stories s2
               WHERE s2.cluster_id = s.cluster_id AND s2.deleted_at IS NULL
             ) ELSE 1 END AS cluster_size
      FROM stories s
      INNER JOIN summaries sum ON sum.story_id = s.id
      LEFT JOIN interactions i ON i.story_id = s.id AND ($1::uuid IS NULL OR i.user_id = $1)
      WHERE ${conditions.join(' AND ')}
      ORDER BY ${sortByScore ? 'sum.engagement_score DESC, s.published_at DESC' : 's.published_at DESC'}
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `, [...params, safeLimit, safeOffset]);

    res.json({ stories: rows });
  } catch (err) {
    console.error('[GET /stories]', err.message);
    res.status(500).json({ error: 'Failed to load stories' });
  }
});

// GET /api/stories/search?q=keyword — full-text search across title + summary
router.get('/search', optionalAuth, async (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  if (!q || q.length < 2) return res.json({ stories: [] });
  if (q.length > 100) return res.status(400).json({ error: 'Query too long' });

  try {
    const userId = req.user?.id || null;
    const { rows } = await pool.query(`
      SELECT s.*, sum.summary, sum.bullets, sum.angle, sum.hashtags, sum.engagement_score,
             i.favorited, i.notes, i.tags, i.used
      FROM stories s
      INNER JOIN summaries sum ON sum.story_id = s.id
      LEFT JOIN interactions i ON i.story_id = s.id AND ($2::uuid IS NULL OR i.user_id = $2)
      WHERE s.deleted_at IS NULL
        AND (
          s.title    ILIKE $1
          OR sum.summary ILIKE $1
        )
      ORDER BY s.published_at DESC
      LIMIT 40
    `, [`%${q}%`, userId]);
    res.json({ stories: rows });
  } catch (err) {
    console.error('[GET /stories/search]', err.message);
    res.status(500).json({ error: 'Search failed' });
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

// GET /api/stories/:id — public, but free-tier users are capped at 3 detail views/day
router.get('/:id', optionalAuth, async (req, res) => {
  if (!validateUUID(req.params.id, res)) return;
  try {
    const userId = req.user?.id || null;

    // ── Free-tier gate ──────────────────────────────────────────────────────
    // Guests are gated client-side (no user_id to track here).
    if (userId) {
      const { rows: [u] } = await pool.query(
        'SELECT subscription_tier, subscription_expires_at FROM users WHERE id = $1',
        [userId]
      );
      const tier = u?.subscription_tier ?? 'free';
      const exp  = u?.subscription_expires_at ? new Date(u.subscription_expires_at) : null;
      const isFree = tier === 'free' || (tier !== 'lifetime' && (!exp || exp <= new Date()));

      if (isFree) {
        const { rows: [vr] } = await pool.query(
          'SELECT count FROM story_views WHERE user_id = $1 AND view_date = CURRENT_DATE',
          [userId]
        );
        const viewsToday = vr?.count ?? 0;
        if (viewsToday >= FREE_DAILY_LIMIT) {
          return res.status(402).json({ limitReached: true, viewsToday });
        }
        await pool.query(
          `INSERT INTO story_views (user_id, view_date, count)
           VALUES ($1, CURRENT_DATE, 1)
           ON CONFLICT (user_id, view_date) DO UPDATE SET count = story_views.count + 1`,
          [userId]
        );
      }
    }
    // ────────────────────────────────────────────────────────────────────────

    const { rows } = await pool.query(`
      SELECT s.*, sum.summary, sum.bullets, sum.angle, sum.hashtags, sum.engagement_score,
             i.favorited, i.notes, i.tags, i.used,
             CASE WHEN s.cluster_id IS NOT NULL THEN (
               SELECT COUNT(*) FROM stories s2
               WHERE s2.cluster_id = s.cluster_id AND s2.deleted_at IS NULL
             ) ELSE 1 END AS cluster_size
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
  const secret = process.env.ADMIN_KEY;
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

// GET /api/stories/:id/related — stories in the same cluster
router.get('/:id/related', optionalAuth, async (req, res) => {
  if (!validateUUID(req.params.id, res)) return;
  try {
    const userId = req.user?.id || null;
    // Get the cluster_id for this story
    const { rows: [story] } = await pool.query(
      'SELECT cluster_id, category FROM stories WHERE id = $1 AND deleted_at IS NULL',
      [req.params.id]
    );
    if (!story) return res.status(404).json({ error: 'Not found' });

    // If no cluster, fall back to same category
    const { rows } = story.cluster_id
      ? await pool.query(`
          SELECT s.id, s.title, s.source, s.published_at, s.category,
                 sum.summary, sum.engagement_score, sum.angle,
                 i.favorited, i.used
          FROM stories s
          INNER JOIN summaries sum ON sum.story_id = s.id
          LEFT JOIN interactions i ON i.story_id = s.id AND ($3::uuid IS NULL OR i.user_id = $3)
          WHERE s.cluster_id = $1 AND s.id <> $2 AND s.deleted_at IS NULL
          ORDER BY s.published_at DESC LIMIT 5
        `, [story.cluster_id, req.params.id, userId])
      : await pool.query(`
          SELECT s.id, s.title, s.source, s.published_at, s.category,
                 sum.summary, sum.engagement_score, sum.angle,
                 i.favorited, i.used
          FROM stories s
          INNER JOIN summaries sum ON sum.story_id = s.id
          LEFT JOIN interactions i ON i.story_id = s.id AND ($3::uuid IS NULL OR i.user_id = $3)
          WHERE s.category = $1 AND s.id <> $2 AND s.deleted_at IS NULL
          ORDER BY s.published_at DESC LIMIT 5
        `, [story.category, req.params.id, userId]);

    res.json({ stories: rows });
  } catch (err) {
    console.error('[GET /stories/:id/related]', err.message);
    res.status(500).json({ error: 'Failed to load related stories' });
  }
});

// POST /api/stories/:id/caption — generate (or return cached) Instagram caption
router.post('/:id/caption', requireAuth, async (req, res) => {
  if (!validateUUID(req.params.id, res)) return;
  try {
    const { rows } = await pool.query(`
      SELECT s.id, s.title, sum.summary, sum.bullets, sum.angle, sum.hashtags, sum.caption
      FROM stories s
      INNER JOIN summaries sum ON sum.story_id = s.id
      WHERE s.id = $1 AND s.deleted_at IS NULL
    `, [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    const caption = await generateCaption(rows[0]);
    res.json({ caption });
  } catch (err) {
    console.error('[POST /stories/:id/caption]', err.message);
    res.status(500).json({ error: 'Failed to generate caption' });
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
