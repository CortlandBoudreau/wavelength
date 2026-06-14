const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { sendDigest, previewDigest } = require('../services/emailDigest');

// All digest routes require authentication
router.use(requireAuth);

// GET /api/digest/preview
router.get('/preview', async (req, res) => {
  try {
    const { stories, html } = await previewDigest();
    res.json({ stories, html });
  } catch (err) {
    console.error('[GET /digest/preview]', err.message);
    res.status(500).json({ error: 'Preview failed' });
  }
});

// POST /api/digest/send — emails the digest to the requesting user's own address.
// Per-user cooldown so one user can't burn SendGrid quota.
const lastSentByUser = new Map(); // userId → timestamp
const SEND_COOLDOWN_MS = 10 * 60 * 1000;

router.post('/send', async (req, res) => {
  const last = lastSentByUser.get(req.user.id) ?? 0;
  if (Date.now() - last < SEND_COOLDOWN_MS) {
    return res.status(429).json({ error: 'Digest already sent recently. Try again in a few minutes.' });
  }

  try {
    await sendDigest(req.user.email);
    lastSentByUser.set(req.user.id, Date.now());
    res.json({ ok: true });
  } catch (err) {
    console.error('[POST /digest/send]', err.message);
    res.status(500).json({ error: 'Digest send failed' });
  }
});

module.exports = router;
