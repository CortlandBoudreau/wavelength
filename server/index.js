require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { startScheduler } = require('./services/scheduler');

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

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`WaveLength API running on port ${PORT}`);
  startScheduler();
});
