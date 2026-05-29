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

// POST /api/digest/send
router.post('/send', async (req, res) => {
  try {
    await sendDigest();
    res.json({ ok: true });
  } catch (err) {
    console.error('[POST /digest/send]', err.message);
    res.status(500).json({ error: 'Digest send failed' });
  }
});

module.exports = router;
