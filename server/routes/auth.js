const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const sgMail = require('@sendgrid/mail');
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');
const { validateRegister, validateLogin, validateProfileUpdate, validatePasswordReset } = require('../middleware/validate');

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

function makeToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, name: user.name },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
}

// POST /api/auth/register
router.post('/register', validateRegister, async (req, res) => {
  try {
    const { email, name, password } = req.body;
    const password_hash = await bcrypt.hash(password, 10);
    const trialEnds = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const { rows } = await pool.query(
      `INSERT INTO users (email, name, password_hash, subscription_tier, subscription_expires_at)
       VALUES ($1, $2, $3, 'trial', $4)
       RETURNING id, email, name, interests, hashtag_includes, hashtag_excludes,
                 subscription_tier, subscription_expires_at`,
      [email.toLowerCase().trim(), name.trim(), password_hash, trialEnds]
    );
    const user = rows[0];

    // Send verification email (non-fatal if it fails)
    try {
      const otp = String(crypto.randomInt(100000, 1000000));
      const tokenHash = crypto.createHash('sha256').update(otp).digest('hex');
      await pool.query(
        'UPDATE users SET email_verify_token = $1, email_verify_sent_at = NOW() WHERE id = $2',
        [tokenHash, user.id]
      );
      await sgMail.send({
        to: user.email,
        from: process.env.EMAIL_FROM,
        subject: 'WaveLength — verify your email',
        text: `Welcome to WaveLength! Your verification code is: ${otp}`,
        html: `<p>Welcome to WaveLength! Your verification code is:</p><h2 style="letter-spacing:8px">${otp}</h2>`,
      });
    } catch (emailErr) {
      console.warn('[register] Failed to send verification email:', emailErr.message);
    }

    res.status(201).json({ user, token: makeToken(user) });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Email already registered' });
    console.error('[POST /auth/register] Error:', err.message);
    if (err.message.includes('relation "users"')) console.error('  → Have you run server/db/migration-users.sql?');
    if (err.message.includes('secretOrPrivateKey')) console.error('  → JWT_SECRET is missing from .env');
    res.status(500).json({ error: 'Registration failed' });
  }
});

// POST /api/auth/login
router.post('/login', validateLogin, async (req, res) => {
  try {
    const { email, password } = req.body;
    const { rows } = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email.toLowerCase().trim()]
    );
    const user = rows[0];
    // Always run bcrypt compare to prevent timing attacks on email enumeration
    const validPassword = user
      ? await bcrypt.compare(password, user.password_hash)
      : await bcrypt.compare(password, '$2b$10$invalidhashfortimingprotection00000000000000000000000000');
    if (!user || !validPassword)
      return res.status(401).json({ error: 'Invalid email or password' });

    const { password_hash, ...safe } = user;
    res.json({ user: safe, token: makeToken(safe) });
  } catch (err) {
    console.error('[POST /auth/login]', err.message);
    res.status(500).json({ error: 'Login failed' });
  }
});

// GET /api/auth/me
router.get('/me', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, email, name, interests, hashtag_includes, hashtag_excludes,
              subscription_tier, subscription_expires_at, email_verified, created_at
       FROM users WHERE id = $1`,
      [req.user.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'User not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// PATCH /api/auth/profile
router.patch('/profile', requireAuth, validateProfileUpdate, async (req, res) => {
  try {
    const { name, interests, hashtag_includes, hashtag_excludes } = req.body;
    const { rows } = await pool.query(
      `UPDATE users
       SET name = COALESCE($1, name),
           interests = COALESCE($2, interests),
           hashtag_includes = COALESCE($3, hashtag_includes),
           hashtag_excludes = COALESCE($4, hashtag_excludes)
       WHERE id = $5
       RETURNING id, email, name, interests, hashtag_includes, hashtag_excludes,
                 subscription_tier, subscription_expires_at`,
      [name ?? null, interests ?? null, hashtag_includes ?? null, hashtag_excludes ?? null, req.user.id]
    );
    res.json(rows[0]);
  } catch (err) {
    console.error('[PATCH /auth/profile]', err.message);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// PATCH /api/auth/password  — change password (logged-in)
router.patch('/password', requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword)
    return res.status(400).json({ error: 'currentPassword and newPassword are required' });
  if (newPassword.length < 8)  return res.status(400).json({ error: 'Password must be at least 8 characters' });
  if (newPassword.length > 128) return res.status(400).json({ error: 'Password too long' });

  try {
    const { rows } = await pool.query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
    if (!rows.length) return res.status(404).json({ error: 'User not found' });
    const valid = await bcrypt.compare(currentPassword, rows[0].password_hash);
    if (!valid) return res.status(401).json({ error: 'Current password is incorrect' });

    const hash = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, req.user.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error('[PATCH /auth/password]', err.message);
    res.status(500).json({ error: 'Failed to update password' });
  }
});

// DELETE /api/auth/account — permanently delete the authenticated user's account
router.delete('/account', requireAuth, async (req, res) => {
  const { password } = req.body;
  if (!password) return res.status(400).json({ error: 'Password is required to confirm deletion' });

  try {
    const { rows } = await pool.query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
    if (!rows.length) return res.status(404).json({ error: 'User not found' });
    const valid = await bcrypt.compare(password, rows[0].password_hash);
    if (!valid) return res.status(401).json({ error: 'Incorrect password' });

    await pool.query('DELETE FROM users WHERE id = $1', [req.user.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error('[DELETE /auth/account]', err.message);
    res.status(500).json({ error: 'Failed to delete account' });
  }
});

// POST /api/auth/send-verification — (re)send email verification code
router.post('/send-verification', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT email, email_verified, email_verify_sent_at FROM users WHERE id = $1',
      [req.user.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'User not found' });
    if (rows[0].email_verified) return res.json({ ok: true, already: true });

    // Throttle: don't resend within 2 minutes
    const lastSent = rows[0].email_verify_sent_at;
    if (lastSent && Date.now() - new Date(lastSent).getTime() < 2 * 60 * 1000)
      return res.status(429).json({ error: 'Please wait before requesting another verification email' });

    const otp = String(crypto.randomInt(100000, 1000000));
    const tokenHash = crypto.createHash('sha256').update(otp).digest('hex');
    await pool.query(
      'UPDATE users SET email_verify_token = $1, email_verify_sent_at = NOW() WHERE id = $2',
      [tokenHash, req.user.id]
    );

    await sgMail.send({
      to: rows[0].email,
      from: process.env.EMAIL_FROM,
      subject: 'WaveLength — verify your email',
      text: `Your WaveLength verification code is: ${otp}\n\nEnter this in the app to verify your email.`,
      html: `<p>Your WaveLength verification code is:</p><h2 style="letter-spacing:8px">${otp}</h2><p>Enter this in the app to verify your email address.</p>`,
    });

    res.json({ ok: true });
  } catch (err) {
    console.error('[POST /auth/send-verification]', err.message);
    res.status(500).json({ error: 'Failed to send verification email' });
  }
});

// POST /api/auth/verify-email
router.post('/verify-email', requireAuth, async (req, res) => {
  const { otp } = req.body;
  if (!otp || !/^\d{6}$/.test(String(otp)))
    return res.status(400).json({ error: 'Invalid code' });

  const tokenHash = crypto.createHash('sha256').update(String(otp)).digest('hex');
  try {
    const { rows } = await pool.query(
      'SELECT email_verify_token, email_verified, email_verify_sent_at FROM users WHERE id = $1',
      [req.user.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'User not found' });
    if (rows[0].email_verified) return res.json({ ok: true });

    // Enforce 1-hour expiry on the verification token
    const sentAt = rows[0].email_verify_sent_at;
    if (!sentAt || Date.now() - new Date(sentAt).getTime() > 60 * 60 * 1000)
      return res.status(400).json({ error: 'Code expired — please request a new verification email' });

    if (rows[0].email_verify_token !== tokenHash)
      return res.status(400).json({ error: 'Invalid or expired code' });

    await pool.query(
      'UPDATE users SET email_verified = TRUE, email_verify_token = NULL WHERE id = $1',
      [req.user.id]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('[POST /auth/verify-email]', err.message);
    res.status(500).json({ error: 'Verification failed' });
  }
});

// POST /api/auth/forgot-password
// Always responds 200 to prevent email enumeration
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email || typeof email !== 'string') return res.json({ ok: true });

  try {
    const { rows } = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [email.toLowerCase().trim()]
    );
    if (!rows.length) return res.json({ ok: true });

    const userId = rows[0].id;
    const otp = String(crypto.randomInt(100000, 1000000)); // 6 digits
    const tokenHash = crypto.createHash('sha256').update(otp).digest('hex');
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 min

    // Per-email throttle: max 3 resets per hour
    const { rows: recent } = await pool.query(
      `SELECT COUNT(*) FROM password_reset_tokens
       WHERE user_id = $1 AND created_at > NOW() - INTERVAL '1 hour'`,
      [userId]
    );
    if (parseInt(recent[0].count) >= 3) return res.json({ ok: true }); // silent throttle

    // Invalidate existing tokens for this user
    await pool.query('DELETE FROM password_reset_tokens WHERE user_id = $1', [userId]);
    await pool.query(
      'INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
      [userId, tokenHash, expiresAt]
    );

    await sgMail.send({
      to: email.toLowerCase().trim(),
      from: process.env.EMAIL_FROM,
      subject: 'WaveLength — password reset code',
      text: `Your WaveLength password reset code is: ${otp}\n\nThis code expires in 15 minutes. If you didn't request a reset, you can ignore this email.`,
      html: `<p>Your WaveLength password reset code is:</p><h2 style="letter-spacing:8px">${otp}</h2><p>This code expires in 15 minutes. If you didn't request a reset, you can ignore this email.</p>`,
    });
  } catch (err) {
    console.error('[POST /auth/forgot-password]', err.message);
  }

  res.json({ ok: true });
});

// GET /api/auth/notification-preferences
router.get('/notification-preferences', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT notification_prefs FROM users WHERE id = $1',
      [req.user.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'User not found' });
    res.json(rows[0].notification_prefs ?? {});
  } catch (err) {
    console.error('[GET /auth/notification-preferences]', err.message);
    res.status(500).json({ error: 'Failed to load preferences' });
  }
});

// PATCH /api/auth/notification-preferences
// Accepts a partial object — only the keys present are merged in.
router.patch('/notification-preferences', requireAuth, async (req, res) => {
  const ALLOWED_KEYS = new Set([
    'daily_digest', 'daily_digest_hour', 'topic_alerts',
    'posting_reminder', 'posting_reminder_days',
  ]);

  const patch = req.body;
  if (!patch || typeof patch !== 'object' || Array.isArray(patch))
    return res.status(400).json({ error: 'Body must be an object' });

  const unknown = Object.keys(patch).filter((k) => !ALLOWED_KEYS.has(k));
  if (unknown.length)
    return res.status(400).json({ error: `Unknown preference key(s): ${unknown.join(', ')}` });

  // Type-check each accepted field
  if ('daily_digest'          in patch && typeof patch.daily_digest          !== 'boolean') return res.status(400).json({ error: 'daily_digest must be boolean' });
  if ('topic_alerts'          in patch && typeof patch.topic_alerts          !== 'boolean') return res.status(400).json({ error: 'topic_alerts must be boolean' });
  if ('posting_reminder'      in patch && typeof patch.posting_reminder      !== 'boolean') return res.status(400).json({ error: 'posting_reminder must be boolean' });
  if ('daily_digest_hour'     in patch) {
    const h = patch.daily_digest_hour;
    if (typeof h !== 'number' || !Number.isInteger(h) || h < 0 || h > 23)
      return res.status(400).json({ error: 'daily_digest_hour must be an integer 0–23' });
  }
  if ('posting_reminder_days' in patch) {
    const d = patch.posting_reminder_days;
    if (typeof d !== 'number' || !Number.isInteger(d) || d < 1 || d > 30)
      return res.status(400).json({ error: 'posting_reminder_days must be an integer 1–30' });
  }

  try {
    const { rows } = await pool.query(
      `UPDATE users
       SET notification_prefs = notification_prefs || $1::jsonb
       WHERE id = $2
       RETURNING notification_prefs`,
      [JSON.stringify(patch), req.user.id]
    );
    res.json(rows[0].notification_prefs);
  } catch (err) {
    console.error('[PATCH /auth/notification-preferences]', err.message);
    res.status(500).json({ error: 'Failed to save preferences' });
  }
});

// PATCH /api/auth/push-token — store (or clear) the Expo push token for this user.
// Called by the mobile app after notification permission is granted.
router.patch('/push-token', requireAuth, async (req, res) => {
  const { push_token } = req.body;
  // push_token may be a string (register) or null (deregister on logout)
  if (push_token !== null && push_token !== undefined && typeof push_token !== 'string')
    return res.status(400).json({ error: 'push_token must be a string or null' });

  try {
    await pool.query(
      'UPDATE users SET push_token = $1 WHERE id = $2',
      [push_token ?? null, req.user.id]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('[PATCH /auth/push-token]', err.message);
    res.status(500).json({ error: 'Failed to save push token' });
  }
});

// POST /api/auth/google — sign in / register via Google OAuth
// Accepts the access_token from expo-auth-session; verifies it with Google's
// userinfo endpoint, then finds or creates the user account.
router.post('/google', async (req, res) => {
  const { access_token } = req.body;
  if (!access_token || typeof access_token !== 'string')
    return res.status(400).json({ error: 'access_token required' });

  try {
    // Verify by calling Google's userinfo endpoint — only a valid token gets data back
    const gRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    if (!gRes.ok) return res.status(401).json({ error: 'Invalid Google token' });

    const { sub: googleId, email, name, email_verified } = await gRes.json();
    if (!email) return res.status(401).json({ error: 'Google account has no email' });

    const normalizedEmail = email.toLowerCase().trim();
    const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [normalizedEmail]);
    let user = rows[0];

    if (!user) {
      // New user — create with 7-day trial (same as email register)
      const trialEnds = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const fallbackName = name ?? normalizedEmail.split('@')[0];
      const result = await pool.query(
        `INSERT INTO users
           (email, name, google_id, email_verified, subscription_tier, subscription_expires_at)
         VALUES ($1, $2, $3, $4, 'trial', $5)
         RETURNING id, email, name, interests, hashtag_includes, hashtag_excludes,
                   subscription_tier, subscription_expires_at, email_verified`,
        [normalizedEmail, fallbackName, googleId, !!email_verified, trialEnds]
      );
      user = result.rows[0];
    } else {
      // Existing account — link google_id + mark email verified if not already
      if (!user.google_id) {
        await pool.query(
          'UPDATE users SET google_id = $1, email_verified = TRUE WHERE id = $2',
          [googleId, user.id]
        );
      }
      // Strip sensitive fields before responding
      const { password_hash, email_verify_token, email_verify_sent_at, ...safe } = user;
      user = safe;
    }

    res.json({ user, token: makeToken(user) });
  } catch (err) {
    console.error('[POST /auth/google]', err.message);
    res.status(500).json({ error: 'Google sign-in failed' });
  }
});

// POST /api/auth/reset-password
router.post('/reset-password', validatePasswordReset, async (req, res) => {
  const { email, otp, password } = req.body;
  const tokenHash = crypto.createHash('sha256').update(otp).digest('hex');

  try {
    const { rows } = await pool.query(
      `SELECT prt.id, prt.user_id FROM password_reset_tokens prt
       JOIN users u ON u.id = prt.user_id
       WHERE u.email = $1
         AND prt.token_hash = $2
         AND prt.used_at IS NULL
         AND prt.expires_at > NOW()`,
      [email.toLowerCase().trim(), tokenHash]
    );

    if (!rows.length) return res.status(400).json({ error: 'Invalid or expired code' });

    const { id: tokenId, user_id } = rows[0];
    const password_hash = await bcrypt.hash(password, 10);

    await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [password_hash, user_id]);
    await pool.query('UPDATE password_reset_tokens SET used_at = NOW() WHERE id = $1', [tokenId]);

    res.json({ ok: true });
  } catch (err) {
    console.error('[POST /auth/reset-password]', err.message);
    res.status(500).json({ error: 'Reset failed' });
  }
});

module.exports = router;
