const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Returns a plain object describing the user's current access level.
 * This is the single source of truth — use it everywhere you need to
 * gate a feature.
 */
function accessStatus(user) {
  const { subscription_tier: tier, subscription_expires_at: expiresAt } = user;

  if (tier === 'lifetime') {
    return { tier, active: true, expiresAt: null, label: 'Lifetime' };
  }

  if (tier === 'free') {
    return { tier, active: false, expiresAt: null, label: 'Free' };
  }

  // trial or pro — check expiry
  const expires = expiresAt ? new Date(expiresAt) : null;
  const active = !!expires && expires > new Date();
  const label = tier === 'trial'
    ? active ? 'Trial' : 'Trial expired'
    : active ? 'Pro' : 'Pro expired';

  return { tier, active, expiresAt, label };
}

// ── GET /api/subscription/status ─────────────────────────────────────────────
router.get('/status', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT subscription_tier, subscription_expires_at FROM users WHERE id = $1',
      [req.user.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'User not found' });
    res.json(accessStatus(rows[0]));
  } catch (err) {
    console.error('[GET /subscription/status]', err.message);
    res.status(500).json({ error: 'Failed to fetch subscription status' });
  }
});

// ── POST /api/subscription/redeem ────────────────────────────────────────────
router.post('/redeem', requireAuth, async (req, res) => {
  const { code } = req.body;
  if (!code || typeof code !== 'string') {
    return res.status(400).json({ error: 'A promo code is required' });
  }

  const normalised = code.trim().toUpperCase();

  try {
    // 1. Look up the code
    const { rows: codeRows } = await pool.query(
      'SELECT * FROM promo_codes WHERE code = $1',
      [normalised]
    );
    if (!codeRows.length) {
      return res.status(404).json({ error: 'Invalid promo code' });
    }
    const promo = codeRows[0];

    // 2. Check it hasn't expired
    if (promo.valid_until && new Date(promo.valid_until) < new Date()) {
      return res.status(410).json({ error: 'This promo code has expired' });
    }

    // 3. Check usage cap
    if (promo.max_uses !== null && promo.used_count >= promo.max_uses) {
      return res.status(410).json({ error: 'This promo code has reached its usage limit' });
    }

    // 4. Check if this user already redeemed it
    const { rows: alreadyUsed } = await pool.query(
      'SELECT 1 FROM code_redemptions WHERE user_id = $1 AND code = $2',
      [req.user.id, normalised]
    );
    if (alreadyUsed.length) {
      return res.status(409).json({ error: 'You have already redeemed this code' });
    }

    // 5. Calculate new tier & expiry
    let newTier;
    let newExpiry;

    if (promo.grants_tier === 'lifetime') {
      newTier   = 'lifetime';
      newExpiry = null;
    } else {
      // pro access for duration_days — stack on top of any existing expiry
      newTier = 'pro';
      const { rows: userRows } = await pool.query(
        'SELECT subscription_tier, subscription_expires_at FROM users WHERE id = $1',
        [req.user.id]
      );
      const existing = userRows[0];

      // Don't downgrade a lifetime user
      if (existing.subscription_tier === 'lifetime') {
        return res.status(409).json({ error: 'Your account already has lifetime access' });
      }

      const base = (existing.subscription_expires_at && new Date(existing.subscription_expires_at) > new Date())
        ? new Date(existing.subscription_expires_at)
        : new Date();

      newExpiry = new Date(base.getTime() + promo.duration_days * 24 * 60 * 60 * 1000);
    }

    // 6. Apply in a transaction
    await pool.query('BEGIN');
    await pool.query(
      `UPDATE users SET subscription_tier = $1, subscription_expires_at = $2 WHERE id = $3`,
      [newTier, newExpiry, req.user.id]
    );
    await pool.query(
      `INSERT INTO code_redemptions (code, user_id) VALUES ($1, $2)`,
      [normalised, req.user.id]
    );
    await pool.query(
      `UPDATE promo_codes SET used_count = used_count + 1 WHERE code = $1`,
      [normalised]
    );
    await pool.query('COMMIT');

    res.json({
      message: 'Code redeemed successfully',
      ...accessStatus({ subscription_tier: newTier, subscription_expires_at: newExpiry }),
    });
  } catch (err) {
    await pool.query('ROLLBACK').catch(() => {});
    console.error('[POST /subscription/redeem]', err.message);
    res.status(500).json({ error: 'Failed to redeem code' });
  }
});

// ── POST /api/subscription/revenuecat-sync ────────────────────────────────────
// Called from the app immediately after a successful RevenueCat purchase.
// Trusts authenticated user — no need to hit RevenueCat REST API here because
// the webhook handles ongoing renewals/cancellations server-side.
router.post('/revenuecat-sync', requireAuth, async (req, res) => {
  const { activeSubscriptions, expiresAt } = req.body;

  // Sanity-check: only accept if an active sub is reported
  const isActive = Array.isArray(activeSubscriptions) && activeSubscriptions.length > 0;
  if (!isActive) {
    return res.status(400).json({ error: 'No active subscription reported' });
  }

  try {
    const expiry = expiresAt ? new Date(expiresAt) : null;
    await pool.query(
      `UPDATE users SET subscription_tier = 'pro', subscription_expires_at = $1 WHERE id = $2`,
      [expiry, req.user.id]
    );
    const { rows } = await pool.query(
      'SELECT subscription_tier, subscription_expires_at FROM users WHERE id = $1',
      [req.user.id]
    );
    res.json({ ok: true, ...accessStatus(rows[0]) });
  } catch (err) {
    console.error('[POST /subscription/revenuecat-sync]', err.message);
    res.status(500).json({ error: 'Sync failed' });
  }
});

// ── POST /api/subscription/webhook/revenuecat ────────────────────────────────
// RevenueCat webhook — handles renewals, cancellations, and expirations.
// Configure the webhook URL in the RevenueCat dashboard and set a shared secret.
// RevenueCat dashboard: Project → Webhooks → Authorization header value
router.post('/webhook/revenuecat', async (req, res) => {
  // Verify shared secret if configured
  const secret = process.env.REVENUECAT_WEBHOOK_SECRET;
  if (secret && req.headers.authorization !== `Bearer ${secret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const event = req.body?.event;
  if (!event) return res.status(400).json({ error: 'Missing event' });

  const { type, app_user_id: userId, expiration_at_ms: expiresMs } = event;

  // app_user_id must be our UUID (set via Purchases.logIn(user.id))
  if (!userId || !/^[0-9a-f-]{36}$/i.test(userId)) {
    return res.status(400).json({ error: 'Invalid app_user_id' });
  }

  try {
    switch (type) {
      case 'INITIAL_PURCHASE':
      case 'RENEWAL':
      case 'REACTIVATION': {
        const expiry = expiresMs ? new Date(expiresMs) : null;
        await pool.query(
          `UPDATE users SET subscription_tier = 'pro', subscription_expires_at = $1 WHERE id = $2`,
          [expiry, userId]
        );
        console.log(`[RC Webhook] ${type} — upgraded ${userId} to pro`);
        break;
      }
      case 'CANCELLATION':
      case 'EXPIRATION': {
        // Only downgrade if not lifetime (promo code users keep their tier)
        await pool.query(
          `UPDATE users SET subscription_tier = 'free', subscription_expires_at = NULL
           WHERE id = $1 AND subscription_tier = 'pro'`,
          [userId]
        );
        console.log(`[RC Webhook] ${type} — downgraded ${userId} to free`);
        break;
      }
      default:
        // Ignore TRANSFER, PRODUCT_CHANGE, BILLING_ISSUE, etc.
        break;
    }
    res.json({ ok: true });
  } catch (err) {
    console.error('[RC Webhook] Error:', err.message);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// ── POST /api/subscription/admin/codes — create a new promo code ─────────────
// Protected by ADMIN_SECRET header, not user auth.
router.post('/admin/codes', (req, res, next) => {
  const secret = process.env.ADMIN_SECRET;
  if (!secret || req.headers['x-admin-secret'] !== secret) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
}, async (req, res) => {
  const { code, description, grants_tier, duration_days, max_uses, valid_until } = req.body;

  if (!code || !grants_tier) {
    return res.status(400).json({ error: 'code and grants_tier are required' });
  }
  if (!['pro', 'lifetime'].includes(grants_tier)) {
    return res.status(400).json({ error: 'grants_tier must be "pro" or "lifetime"' });
  }
  if (grants_tier === 'pro' && !duration_days) {
    return res.status(400).json({ error: 'duration_days is required for pro codes' });
  }

  try {
    const { rows } = await pool.query(
      `INSERT INTO promo_codes (code, description, grants_tier, duration_days, max_uses, valid_until)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (code) DO NOTHING
       RETURNING *`,
      [
        code.trim().toUpperCase(),
        description ?? null,
        grants_tier,
        duration_days ?? null,
        max_uses ?? null,
        valid_until ?? null,
      ]
    );
    if (!rows.length) {
      return res.status(409).json({ error: 'A code with that name already exists' });
    }
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('[POST /subscription/admin/codes]', err.message);
    res.status(500).json({ error: 'Failed to create promo code' });
  }
});

module.exports = router;
