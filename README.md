# WaveLength

A science news curation mobile app built for Instagram science creators. WaveLength automatically aggregates breaking science stories from 100+ sources, uses Claude AI to generate plain-language summaries, engagement scores, and Instagram captions, then delivers everything in a clean feed so creators spend minutes — not hours — finding content worth posting.

---

## The Problem

Finding fresh, relevant science content for Instagram manually takes hours. WaveLength cuts that down to minutes by surfacing the right stories every morning — pre-summarised, scored for engagement potential, with captions ready to copy.

---

## Features

### Content Aggregation
- **30+ RSS feeds** — ScienceDaily (10 categories), ScienceAlert, NASA, Nature, New Scientist, Smithsonian, Popular Science, and more
- **43 subreddits** — r/science, r/space, r/marinebiology, r/neuroscience, r/biology, r/geology, r/physics, r/chemistry, and many more; filtered by score > 50 to reduce noise
- **Bluesky** — 11 science search queries via the public AT Protocol API (no auth required)
- **Mastodon** — 8 science hashtag timelines via fosstodon.org public API
- **arXiv** — 4 preprint feeds (astro-ph, physics, q-bio, eess); summaries always flag preliminary research
- **27 YouTube channels** — Kurzgesagt, Veritasium, SciShow, PBS Space Time, Deep Look, MBARI, NOAA, Nautilus Live, Schmidt Ocean Institute, and more; parsed from free RSS feeds, no API key required
- **Duplicate detection** — deduplicated by URL on ingest; similar stories grouped into topic clusters using Jaccard similarity on title tokens

### AI Summarisation (Claude)
- `claude-haiku-4-5` for story summaries (override via `SUMMARIZER_MODEL`) — plain-language 2–3 sentences, 3 caption bullet points, content angle, 5 hashtags, engagement score 1–10
- `claude-haiku-4-6` for Instagram caption generation — warm, accessible voice; hook → explanation → CTA → hashtags; cached per story
- **Relevance gate + category correction** — the same summarization call judges whether a story is genuinely science and assigns the best-fit category. Off-topic content (politics/sports/celebrity/markets/spam that leaked from broad feeds) is soft-deleted; mis-tagged stories are recategorized. Curated sources (arXiv, YouTube channels) are trusted and never dropped.
- **Source-type context injection** — different system prompt context per source (YouTube descriptions vs. Reddit titles vs. arXiv abstracts vs. social posts)
- **Thin-content fast path** — Reddit/Bluesky/Mastodon posts under 80 chars skip the full summary to save cost, but still get a lightweight relevance check
- Prompt injection defences: user content sandboxed in `<article>` XML tags, output validated against allowlists

### Mobile App (React Native / Expo)
- Browse stories by interest category with personalised tabs
- **Search** — full-text search with 400ms debounce
- **Sort** — toggle between Newest and Top Rated (by engagement score)
- **Trending hashtags** — pill row filters the feed by hashtag
- **Already-seen dimming** — visited story cards dim in the feed
- **Related stories** — shown at the bottom of every detail view (by cluster, falls back to category)
- **Share** — native share sheet with title + URL
- **Copy hashtags** — single tap copies all hashtags for pasting into Instagram
- **Copy full package** — one tap copies Title + Summary + Hashtags ready to paste into Instagram notes
- **Generate Caption** — AI-written Instagram caption with hook, explanation, CTA, and hashtags *(Pro)*
- **Save / Mark Posted / Notes** — save stories, track what you've used, add private notes *(Pro)*
- **Hide Posted filter** — toggle pill removes used stories from the feed *(Pro)*
- **New stories banner** — animated green pill appears on pull-to-refresh showing how many new stories were added
- **Haptic feedback** — throughout key interactions

### Authentication & Accounts
- JWT authentication with 7-day expiry; automatic logout on 401 (expired token)
- Password reset via 6-digit OTP email (SHA-256 hashed in DB, 15-min expiry)
- Email verification flow
- Change password, delete account
- Confirm password on registration (min 8 chars)

### Subscriptions (RevenueCat)
- Free tier: 3 story detail views per day
- Pro: unlimited views, Generate Caption, Save/Notes/Mark Posted, Hide Posted filter
- Restore purchases support
- Promo / redeem code support

### Notifications
- Daily 9am local push notification via `expo-notifications`
- Permission requested once after login; silently no-ops if denied

### Security
- JWT auth (7-day expiry), bcrypt password hashing
- Rate limiting: auth endpoints (20 req/15 min), refresh (5 req/10 min), global API (300 req/15 min)
- Per-email password reset throttle (1 request per minute)
- Input validation middleware — UUID regex, email regex, category allowlist, length limits
- `helmet` security headers on all responses
- SSL enforced on database connections in production
- OTP tokens SHA-256 hashed before storage

---

## Tech Stack

| Layer | Technology |
|---|---|
| Mobile | React Native + Expo SDK ~54 (managed workflow, Android) |
| Backend | Node.js + Express |
| Database | PostgreSQL (Railway) |
| AI | Claude API — `claude-haiku-4-5` (summaries, configurable) · `claude-haiku-4-6` (captions) |
| Subscriptions | RevenueCat |
| Email | SendGrid (password reset OTP + email verification) |
| News sources | RSS · Reddit · Bluesky AT Protocol · Mastodon · arXiv · YouTube RSS |
| Scheduling | node-cron (aggregation pipeline + 8am digest + 3am cleanup; gated by env vars) |
| Auth | JWT + bcrypt |
| Security | helmet · express-rate-limit · input validation middleware |
| Navigation | React Navigation (native stack) |
| Storage | expo-secure-store (token) · AsyncStorage (guest prefs) |

---

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL 14+
- Anthropic API key
- SendGrid API key (for password reset / email verification)
- RevenueCat account (for subscriptions — can be skipped for local dev)

### Backend setup

```bash
# 1. Clone the repo
git clone https://github.com/CortlandBoudreau/wavelength.git
cd wavelength

# 2. Install server dependencies
cd server && npm install

# 3. Copy the env template and fill in your keys
cp .env.example .env

# 4. Run migrations
node server/db/migrate.js

# 5. Start the API
npm run dev
```

The API runs at `http://localhost:3001`.

### Mobile setup

```bash
cd wavelength-mobile
npm install

# Start Expo dev server
npx expo start

# Build a development APK
npx expo run:android
```

### Environment Variables

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `ANTHROPIC_API_KEY` | Claude API key |
| `NEWS_API_KEY` | NewsAPI key (aggregation source) |
| `SENDGRID_API_KEY` | SendGrid key (must start with `SG.`) |
| `EMAIL_FROM` | Verified SendGrid sender address |
| `EMAIL_TO` | Admin recipient for the daily digest + posting reminders |
| `JWT_SECRET` | Min 32 chars — `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"` |
| `ADMIN_KEY` | Secret header value for the manual refresh endpoint |
| `CLIENT_URL` | Frontend origin for CORS |
| `PORT` | API port (default `3001`) |
| `AGGREGATION_RUNS_PER_DAY` | `0` = aggregation fully paused, `1` = 10am, `2` = +4pm, `3` = +2am (default) |
| `EMAIL_JOBS_ENABLED` | `0`/`false`/`off`/`no` disables digest + posting reminders (default on). Set `0` on staging / unused services so only one service emails `EMAIL_TO`. |
| `SUMMARIZER_MODEL` | Override the summarizer model (default `claude-haiku-4-5`) |

---

## Project Structure

```
wavelength/
├── server/                          # Node.js + Express API (deployed on Railway)
│   ├── db/
│   │   ├── pool.js                  # PostgreSQL pool (SSL enforced in production)
│   │   ├── migrate.js               # Migration runner
│   │   ├── migration-all.sql        # Full schema (users, stories, summaries, interactions, etc.)
│   │   └── migration-password-reset.sql
│   ├── middleware/
│   │   ├── auth.js                  # requireAuth
│   │   ├── optionalAuth.js          # optionalAuth — attaches user if token present
│   │   └── validate.js              # Input validation (UUID, email, categories, password reset)
│   ├── routes/
│   │   ├── auth.js                  # Register, login, me, profile, password reset, email verify, delete account
│   │   ├── stories.js               # Stories feed, search, related, caption, interactions
│   │   ├── trending.js              # Trending hashtags
│   │   └── subscription.js          # RevenueCat sync, promo code redeem
│   ├── services/
│   │   ├── newsAggregator.js        # RSS · Reddit · Bluesky · Mastodon · arXiv · YouTube ingestion
│   │   ├── claudeSummarizer.js      # Summaries + captions; source-type context; thin-content filter
│   │   ├── clusterStories.js        # Jaccard-similarity topic clustering
│   │   ├── trendingHashtags.js      # Hashtag frequency aggregation
│   │   └── scheduler.js             # node-cron jobs
│   └── index.js                     # Express app, rate limiters, /privacy, /terms routes
│
└── wavelength-mobile/               # React Native / Expo Android app
    ├── app.json                     # Expo config (package, versionCode, plugins)
    ├── assets/                      # Icons and splash screens
    └── src/
        ├── api/
        │   ├── client.ts            # Axios instance pointing at Railway API
        │   ├── auth.ts              # Auth API calls + User type
        │   ├── stories.ts           # Stories, search, related, caption
        │   ├── trending.ts          # Trending hashtags
        │   └── subscription.ts      # RevenueCat sync, promo codes
        ├── components/
        │   ├── StoryCard.tsx        # Card with score badge, viewed dimming
        │   ├── SkeletonCard.tsx     # Shimmer loading state
        │   ├── CategoryTabs.tsx     # Horizontal interest category tabs
        │   ├── HashtagPill.tsx      # Tappable hashtag filter pill
        │   ├── ScoreBadge.tsx       # Engagement score badge (1–10)
        │   └── WaveLogo.tsx         # App logo component
        ├── context/
        │   ├── AuthContext.tsx      # Auth state, JWT restore, 401 interceptor, daily notification trigger
        │   └── PurchaseContext.tsx  # RevenueCat offerings + purchase flow
        ├── navigation/
        │   ├── AppNavigator.tsx     # Root stack (Dashboard, StoryDetail, Paywall, Profile)
        │   └── AuthStack.tsx        # Auth stack (Login, Register, ForgotPassword)
        ├── screens/
        │   ├── Dashboard.tsx        # Feed with search, sort, category tabs, trending, banners
        │   ├── StoryDetail.tsx      # Full story — summary, bullets, hashtags, caption, save, notes
        │   ├── Profile.tsx          # Account settings, subscription, change password, delete account
        │   ├── Paywall.tsx          # Subscription purchase / restore / promo code
        │   ├── Login.tsx
        │   ├── Register.tsx         # With confirm password
        │   ├── ForgotPassword.tsx   # 3-step: email → OTP → new password
        │   └── Onboarding.tsx       # Interest category picker
        └── utils/
            ├── proCheck.ts          # isProUser() — checks tier + expiry
            ├── notifications.ts     # scheduleDailyDigest() via expo-notifications
            ├── categories.ts        # Category emoji + display name mapping
            ├── clusterDedup.ts      # Client-side cluster deduplication
            └── guestStorage.ts      # Guest daily view tracking via AsyncStorage
```

---

## Content Sources

### RSS Feeds (30+)
ScienceDaily (Oceanography, Space, Wildlife, Biology, Earth, Chemistry, Health, Plants & Animals, Fossils, Archaeology), ScienceAlert, NASA Breaking News, Nature News, New Scientist, Phys.org, Popular Science, Smithsonian Magazine, Live Science, EurekAlert, Science News, The Scientist, Ars Technica Science, BBC Science, Guardian Science, Scientific American, IFLScience, Ocean Conservancy, MBARI, NOAA Fisheries, Marine Pollution Bulletin

### Reddit (43 subreddits)
r/science, r/EverythingScience, r/space, r/Astronomy, r/physics, r/chemistry, r/biology, r/neuroscience, r/geology, r/Paleontology, r/ecology, r/evolution, r/genetics, r/microbiology, r/botany, r/zoology, r/Entomology, r/astrophysics, r/cosmology, r/climate, r/environment, r/sustainability, r/Oceanography, r/marinebiology, r/DeepSeaCreatures, r/coralreefs, r/sharks, r/whales, r/seabirds, r/limnology, r/BlackInSTEM, r/WomenInSTEM, r/psychology, r/cognitive, r/artificial, r/MachineLearning, r/quantum, r/nanotechnology, r/medicine, r/healthscience, r/nutrition, r/epidemiology, r/virology

### Other Sources
- **Bluesky** — 11 science search queries via public AT Protocol API
- **Mastodon** — 8 science hashtag timelines (fosstodon.org)
- **arXiv** — astro-ph, physics, q-bio, eess preprint feeds
- **YouTube** (27 channels) — Kurzgesagt, SciShow, Veritasium, PBS Space Time, MinuteEarth, Smarter Every Day, It's Okay To Be Smart, Real Engineering, TED-Ed, Deep Look, PBS Eons, National Geographic, SciShow Space, SciShow Psych, MBARI, Ocean Exploration Trust (Nautilus), Schmidt Ocean Institute, Monterey Bay Aquarium, NOAA, WHOI, Scripps Oceanography, Coral Restoration Foundation, Ocean Conservancy, Australian Marine Science, Scuba Diving Magazine, Underwater360, DIVEIN

---

## Scheduled Jobs

| Time | Job |
|---|---|
| 2:00 AM | Aggregation pipeline — runs only when `AGGREGATION_RUNS_PER_DAY` ≥ 3 |
| 3:00 AM | Cleanup — soft-delete stories >14 days old + expire old topic moments |
| 8:00 AM | Email digest — *(skipped when `EMAIL_JOBS_ENABLED` is off)* |
| 10:00 AM | Aggregation pipeline — runs unless `AGGREGATION_RUNS_PER_DAY=0` |
| 4:00 PM | Aggregation pipeline — runs only when `AGGREGATION_RUNS_PER_DAY` ≥ 2 |
| 8:00 PM | Posting reminder — *(skipped when `EMAIL_JOBS_ENABLED` is off)* |

The aggregation pipeline = fetch all sources → summarise (with relevance gate) → cluster → freshness decay → burst detection.

Manual trigger: `POST /api/stories/refresh` with `x-admin-secret` header.

---

## Maintenance Scripts

One-off scripts in `server/scripts/` (load `.env` from the repo root; need `DATABASE_URL`):

| Script | Purpose |
|---|---|
| `reclassifyStories.js` | Re-run the relevance gate over existing stories — soft-delete off-topic, fix mis-categorized. Dry-run by default; `--commit` to apply. |
| `cleanTitles.js` | Re-clean existing titles (strip social hashtags, markdown/HTML links). Dry-run by default; `--commit` to apply. |
| `createPromoCode.js` | Create/update a promo code: `node scripts/createPromoCode.js <CODE> <tier> <days\|lifetime> [max_uses]` |

---

## API Endpoints

### Auth
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/register` | — | Create account |
| POST | `/api/auth/login` | — | Sign in, returns JWT |
| GET | `/api/auth/me` | ✓ | Current user + subscription |
| PATCH | `/api/auth/profile` | ✓ | Update interests |
| PATCH | `/api/auth/password` | ✓ | Change password |
| DELETE | `/api/auth/account` | ✓ | Delete account |
| POST | `/api/auth/forgot-password` | — | Send reset OTP (throttled per email) |
| POST | `/api/auth/reset-password` | — | Verify OTP + set new password |
| POST | `/api/auth/send-verification` | ✓ | Send email verification OTP |
| POST | `/api/auth/verify-email` | ✓ | Verify email with OTP |

### Stories
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/stories` | optional | List stories (`?category=`, `?categories=`, `?sort=score`, `?hashtag=`) |
| GET | `/api/stories/search` | optional | Full-text search (`?q=`) |
| GET | `/api/stories/:id` | optional | Single story (free tier: 3 views/day) |
| GET | `/api/stories/:id/related` | optional | Related stories by cluster or category |
| POST | `/api/stories/:id/caption` | ✓ Pro | Generate (or return cached) Instagram caption |
| POST | `/api/stories/refresh` | Admin | Trigger aggregation + summarisation + clustering |
| PATCH | `/api/stories/:id/favorite` | ✓ | Toggle saved |
| PATCH | `/api/stories/:id/used` | ✓ | Toggle posted |
| PATCH | `/api/stories/:id/notes` | ✓ | Save notes |

### Other
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/trending/hashtags` | — | Top hashtags from recent stories |
| POST | `/api/subscription/sync` | ✓ | Sync RevenueCat purchase to DB |
| POST | `/api/subscription/redeem` | ✓ | Redeem promo code |
| GET | `/privacy` | — | Privacy policy (inline HTML) |
| GET | `/terms` | — | Terms of service (inline HTML) |

---

## Subscription Tiers

| Feature | Guest | Free | Pro |
|---|---|---|---|
| Browse feed + search | ✅ | ✅ | ✅ |
| Copy hashtags / full package | ✅ | ✅ | ✅ |
| Sort by Top Rated | ✅ | ✅ | ✅ |
| Daily push notification | — | ✅ | ✅ |
| Story detail views | 3/day | 3/day | Unlimited |
| Generate Caption (AI) | — | 🔒 | ✅ |
| Save / Notes / Mark Posted | — | 🔒 | ✅ |
| Hide Posted filter | — | — | ✅ |

---

## Deployment

| Service | Platform |
|---|---|
| API | Railway |
| Database | Railway PostgreSQL |
| Mobile | Google Play Store (Internal Testing → Production) |

### Pending before next APK release
- Run DB migration on Railway prod (caption column, email_verified, password_reset_tokens)
- Confirm `EMAIL_FROM` env var is set on Railway
- Build versionCode 4 APK (`npx expo build` or EAS Build) — required for `expo-notifications` native plugin
- Upload to Play Store Internal Testing
