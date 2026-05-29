const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const { optionalAuth } = require('../middleware/optionalAuth');
const sgMail = require('@sendgrid/mail');

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const VALID_TYPES = new Set(['bug', 'feature', 'general']);

// POST /api/feedback
router.post('/', optionalAuth, async (req, res) => {
  const { type, message } = req.body;

  if (!VALID_TYPES.has(type)) {
    return res.status(400).json({ error: 'Invalid feedback type' });
  }
  if (!message || typeof message !== 'string' || message.trim().length < 5) {
    return res.status(400).json({ error: 'Message must be at least 5 characters' });
  }
  if (message.length > 2000) {
    return res.status(400).json({ error: 'Message too long (max 2000 chars)' });
  }

  const userId = req.user?.id || null;
  const trimmed = message.trim();

  try {
    // Per-account limit: max 5 submissions per day for logged-in users
    if (userId) {
      const { rows: [count] } = await pool.query(
        `SELECT COUNT(*) FROM feedback
         WHERE user_id = $1 AND created_at > NOW() - INTERVAL '24 hours'`,
        [userId]
      );
      if (parseInt(count.count) >= 5) {
        return res.status(429).json({ error: 'You have reached the feedback limit for today. Please try again tomorrow.' });
      }
    }

    await pool.query(
      `INSERT INTO feedback (user_id, type, message) VALUES ($1, $2, $3)`,
      [userId, type, trimmed]
    );

    // Email notification to admin
    if (process.env.SENDGRID_API_KEY && process.env.EMAIL_TO && process.env.EMAIL_FROM) {
      const typeLabel = type === 'bug' ? '🐛 Bug Report' : type === 'feature' ? '✨ Feature Request' : '💬 Feedback';
      const userLabel = req.user ? `${req.user.name} (${req.user.email})` : 'Guest';
      try {
        await sgMail.send({
          to: process.env.EMAIL_TO,
          from: process.env.EMAIL_FROM,
          subject: `[WaveLength] ${typeLabel} from ${userLabel}`,
          text: `Type: ${type}\nFrom: ${userLabel}\n\n${trimmed}`,
          html: `
            <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
              <h2 style="color:#1a2a3a">${typeLabel}</h2>
              <p style="color:#6b7a8d;font-size:13px">From: <strong>${userLabel}</strong></p>
              <div style="background:#f5f0e8;border-radius:8px;padding:16px;margin-top:12px;white-space:pre-wrap;font-size:15px;color:#1a2a3a">${trimmed}</div>
            </div>
          `,
        });
      } catch (emailErr) {
        console.warn('[Feedback] Email send failed:', emailErr.message);
        // Don't fail the request if email fails
      }
    }

    res.json({ ok: true });
  } catch (err) {
    console.error('[POST /feedback]', err.message);
    res.status(500).json({ error: 'Failed to submit feedback' });
  }
});

module.exports = router;
