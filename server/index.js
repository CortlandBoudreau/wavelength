require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { startScheduler } = require('./services/scheduler');
const pool = require('./db/pool');

const REQUIRED_VARS = ['DATABASE_URL', 'ANTHROPIC_API_KEY', 'NEWS_API_KEY', 'SENDGRID_API_KEY', 'EMAIL_TO', 'EMAIL_FROM', 'JWT_SECRET'];
const missing = REQUIRED_VARS.filter((v) => !process.env[v]);
if (missing.length) {
  console.warn('\n⚠️  Missing environment variables — some features will not work:');
  missing.forEach((v) => console.warn(`   ${v}`));
  console.warn('   Copy .env.example → .env and fill in the values.\n');
}

// Reject weak JWT secrets in any environment
if (process.env.JWT_SECRET && (
  process.env.JWT_SECRET.length < 32 ||
  process.env.JWT_SECRET === 'change_this_to_a_long_random_string'
)) {
  console.error('❌ JWT_SECRET is too weak or is the default placeholder. Generate one with:');
  console.error('   node -e "console.log(require(\'crypto\').randomBytes(64).toString(\'hex\'))"');
  process.exit(1);
}

const app = express();

// Railway runs behind a reverse proxy — trust X-Forwarded-For so rate limiting
// keys on the real client IP instead of lumping every user into one bucket.
app.set('trust proxy', 1);

// Security headers (X-Frame-Options, X-Content-Type-Options, CSP, HSTS, etc.)
app.use(helmet());

app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173', credentials: true }));
app.use(express.json({ limit: '50kb' })); // prevent oversized body attacks

// Strict rate limit on auth endpoints — 20 requests per 15 minutes per IP
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});

// General API rate limit — 300 requests per 15 minutes per IP
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});

// Tighter limit on expensive operations (refresh = NewsAPI + Claude calls)
const refreshLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 5,
  message: { error: 'Refresh rate limit reached. Wait 10 minutes before refreshing again.' },
});

// Promo code redemption — 10 attempts per hour per IP to prevent brute-forcing codes
const redeemLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: { error: 'Too many redemption attempts. Please try again later.' },
});

// Feedback — 5 submissions per hour per IP
const feedbackLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { error: 'Too many feedback submissions. Please try again later.' },
});

app.use('/api/auth', authLimiter);
app.use('/api/stories/refresh', refreshLimiter);
app.use('/api/subscription/redeem', redeemLimiter);
app.use('/api/feedback', feedbackLimiter);
app.use('/api', apiLimiter);

app.use('/api/auth', require('./routes/auth'));
app.use('/api/stories', require('./routes/stories'));
app.use('/api/subscription', require('./routes/subscription'));
app.use('/api/analytics', require('./routes/analytics'));
app.use('/api/digest', require('./routes/digest'));
app.use('/api/trending', require('./routes/trending'));
app.use('/api/sources', require('./routes/sources'));
app.use('/api/feedback', require('./routes/feedback'));

// Static legal pages — required for Play Store submission
app.get('/privacy', (req, res) => {
  res.send(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>WaveLength Privacy Policy</title>
  <style>body{font-family:system-ui,sans-serif;max-width:700px;margin:40px auto;padding:0 20px;line-height:1.7;color:#1a2a3a}h1{color:#0f1e2d}a{color:#4A9EDB}</style></head>
  <body><h1>Privacy Policy</h1><p><strong>Last updated: ${new Date().getFullYear()}</strong></p>
  <p>WaveLength ("we", "us") collects your email address and name when you register, and stores science story preferences you set in the app. We use this to personalise your feed and send email digests you request.</p>
  <p>We do not sell your data to third parties. We use SendGrid to deliver emails and RevenueCat to manage subscriptions. Your payment details are handled entirely by Google Play — we never see your card information.</p>
  <p>You can delete your account and all associated data at any time from the Profile screen in the app.</p>
  <p>For questions, email us at <a href="mailto:cortlanddb@gmail.com">cortlanddb@gmail.com</a>.</p>
  </body></html>`);
});

app.get('/terms', (req, res) => {
  res.send(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>WaveLength Terms of Service</title>
  <style>body{font-family:system-ui,sans-serif;max-width:700px;margin:40px auto;padding:0 20px;line-height:1.7;color:#1a2a3a}h1{color:#0f1e2d}</style></head>
  <body><h1>Terms of Service</h1><p><strong>Last updated: ${new Date().getFullYear()}</strong></p>
  <p>By using WaveLength you agree to use the app for lawful purposes only. The app provides AI-summarised science news for informational and content-creation purposes — summaries may not be perfectly accurate and should not be treated as scientific fact without verification.</p>
  <p>Pro subscriptions are billed monthly through Google Play. Cancellations take effect at the end of the current billing period. Refunds are subject to Google Play's refund policy.</p>
  <p>We reserve the right to suspend accounts that abuse the service. We may update these terms at any time; continued use constitutes acceptance.</p>
  <p>For questions, email us at <a href="mailto:cortlanddb@gmail.com">cortlanddb@gmail.com</a>.</p>
  </body></html>`);
});

app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({
      status: 'ok',
      db: 'ok',
      env: process.env.NODE_ENV ?? 'development',
    });
  } catch (e) {
    console.error('[health] DB error:', e.message);
    res.status(503).json({
      status: 'error',
      db: 'unreachable',
      env: process.env.NODE_ENV ?? 'development',
    });
  }
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`WaveLength API running on port ${PORT}`);
  startScheduler();
});
