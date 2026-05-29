const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');
const { validateRegister, validateLogin, validateProfileUpdate } = require('../middleware/validate');

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
              subscription_tier, subscription_expires_at, created_at
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

module.exports = router;
