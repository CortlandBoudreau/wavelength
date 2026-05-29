# WaveLength

A full-stack science content discovery and curation app built for science communicators and educators. WaveLength automatically aggregates breaking science stories from multiple sources, uses Claude AI to generate Instagram-ready summaries and engagement scores, clusters duplicate coverage, and delivers a personalised daily digest — with a web dashboard for managing everything.

---

## The Problem

Finding fresh, relevant science content for Instagram manually takes hours. WaveLength cuts that down to minutes by surfacing the right stories every morning — pre-summarized, scored for engagement potential, and ready to post.

---

## Features

### Content Aggregation
- **NewsAPI** — 8 science categories queried daily across a 7-day window
- **RSS feeds** — ScienceDaily (oceanography, space, wildlife) and ScienceAlert
- **Reddit signal** — 12 science subreddits fetched concurrently via the public JSON API (no auth required); posts filtered by score > 50 to reduce noise
- **Duplicate detection** — stories deduplicated by URL on ingest; similar stories grouped into topic clusters using Jaccard similarity on title tokens

### AI Summarization (Claude `claude-sonnet-4-6`)
- Plain-language 2–3 sentence summary for a general audience
- Three Instagram caption bullet points
- Content angle classification: `educational`, `inspiring`, `surprising`, or `trending`
- Five suggested hashtags
- **Engagement score** (1–10) rating each story's Instagram potential — 10 = visually compelling, broad appeal; 1 = niche or hard to visualize
- Prompt injection defenses: user content sandboxed in `<article>` XML tags, output validated against allowlists, sanitized before insertion into prompts

### Dashboard
- Browse stories by category, sort by date or engagement score
- **Trending hashtags** sidebar — shows the top hashtags from the past 7 days, click any to filter the story grid
- **One per topic** toggle — deduplicates story clusters, showing only the highest-scored story per group
- Favorite, mark as posted, add private notes and tags
- **Source quality ratings** — rate any source 1–5 stars so you can track which outlets consistently deliver good content
- Hashtag include/exclude filters — always surface stories tagged with topics you love, hide topics you don't

### Personalization
- Per-user interest categories, hashtag filters, and interaction history
- Engagement profile: the most-engaged category feeds back into Claude prompts to refine recommendations
- **Guest mode** — full dashboard access with all preferences stored in `localStorage`; no account required

### Email Digest
- HTML email sent daily at 8am via SendGrid with top stories, summaries, and hashtags
- All content HTML-escaped and URL-validated to prevent injection

### Security
- JWT authentication (7-day expiry), bcrypt password hashing
- Rate limiting: auth endpoints (20 req/15 min), refresh (5 req/10 min), global API (300 req/15 min)
- Input validation middleware on all routes — UUID regex, email regex, hashtag regex, length limits, category allowlists
- `helmet` security headers on all responses
- SSL enforced on database connections in production

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite |
| Backend | Node.js + Express |
| Database | PostgreSQL |
| AI | Claude API (`claude-sonnet-4-6`) |
| News sources | NewsAPI · ScienceDaily RSS · ScienceAlert RSS · Reddit public API |
| Email | SendGrid |
| Scheduling | node-cron (6am aggregate + cluster, 8am digest) |
| Auth | JWT + bcrypt |
| Security | helmet · express-rate-limit · input validation middleware |

---

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL 14+
- API keys for Anthropic, NewsAPI, and SendGrid

### Setup

```bash
# 1. Clone the repo
git clone <repo-url>
cd wavelength

# 2. Install all dependencies
npm run install:all

# 3. Copy the env template and fill in your keys
cp .env.example .env

# 4. Run the database migrations (in order)
node server/db/migrate.js
node server/db/migration-users.js
node server/db/migration-categories.js
node server/db/migration-features.js

# 5. Start both servers
npm run dev
```

The frontend runs at `http://localhost:5173` and the API at `http://localhost:3001`.

### Environment Variables

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `ANTHROPIC_API_KEY` | Claude API key |
| `NEWS_API_KEY` | NewsAPI key |
| `SENDGRID_API_KEY` | SendGrid key (must start with `SG.`) |
| `EMAIL_TO` | Digest recipient address |
| `EMAIL_FROM` | Verified sender address |
| `JWT_SECRET` | Min 32 chars — generate with `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"` |
| `CLIENT_URL` | Frontend origin for CORS (e.g. `http://localhost:5173`) |
| `PORT` | API port (default `3001`) |

---

## Project Structure

```
wavelength/
├── client/                        # React 18 + Vite frontend
│   ├── public/
│   │   └── favicon.svg            # Custom SVG wave icon
│   └── src/
│       ├── api/
│       │   ├── auth.js            # Login, register, profile API calls
│       │   ├── stories.js         # Stories, trending, sources API calls
│       │   └── guestStorage.js    # localStorage-based guest mode
│       ├── components/
│       │   ├── StoryCard.jsx      # Story card with score badge + star rating
│       │   └── StoryCardSkeleton.jsx  # Shimmer skeleton loader
│       ├── context/
│       │   └── AuthContext.jsx    # Auth state, guest mode, profile updates
│       └── pages/
│           ├── Landing.jsx        # Public marketing / landing page
│           ├── Dashboard.jsx      # Main story feed with filters + trending sidebar
│           ├── StoryDetail.jsx    # Full story view with notes and hashtags
│           ├── Profile.jsx        # Interest categories, hashtag filters
│           ├── Analytics.jsx      # Engagement stats by category and source
│           ├── Login.jsx
│           └── Register.jsx
│
├── server/                        # Node.js + Express API
│   ├── db/
│   │   ├── pool.js                # PostgreSQL pool (SSL enforced in production)
│   │   ├── migrate.js             # Base schema
│   │   ├── migration-users.js     # Multi-user auth schema
│   │   ├── migration-categories.js # Category constraint updates
│   │   └── migration-features.js  # engagement_score, cluster_id, source_ratings
│   ├── middleware/
│   │   ├── auth.js                # requireAuth — blocks unauthenticated requests
│   │   ├── optionalAuth.js        # optionalAuth — attaches user if token present
│   │   └── validate.js            # Input validation (UUID, email, hashtag, categories)
│   ├── routes/
│   │   ├── auth.js                # POST /register /login, GET /me, PATCH /profile
│   │   ├── stories.js             # GET /stories, POST /refresh, PATCH interactions
│   │   ├── analytics.js           # GET /analytics
│   │   ├── digest.js              # POST /digest/send, GET /digest/preview
│   │   ├── trending.js            # GET /trending/hashtags
│   │   └── sources.js             # GET /sources, POST /sources/rate
│   ├── services/
│   │   ├── newsAggregator.js      # NewsAPI + RSS + Reddit ingestion
│   │   ├── claudeSummarizer.js    # Claude summarization with engagement scoring
│   │   ├── clusterStories.js      # Jaccard-similarity topic clustering
│   │   ├── trendingHashtags.js    # Hashtag frequency aggregation from summaries
│   │   ├── emailDigest.js         # SendGrid HTML digest with XSS-safe templating
│   │   └── scheduler.js           # node-cron: 6am aggregate+cluster, 8am digest
│   └── index.js                   # Express app, rate limiters, route registration
│
├── .env.example
└── .gitignore                     # Covers .env, Claude session files, secrets
```

---

## Content Categories

| Category | Sources |
|---|---|
| 🌊 Marine Science | ScienceDaily Oceanography, r/marinebiology, r/Oceanography, NewsAPI |
| 🔬 Diversity in STEM | r/BlackInSTEM, r/WomenInSTEM, NewsAPI |
| 🧪 Science | ScienceAlert RSS, r/science, r/EverythingScience, NewsAPI |
| ✨ Cool Facts | NewsAPI |
| 🚀 Space | ScienceDaily Space, r/space, r/Astronomy, NewsAPI |
| 🌿 Climate | r/environment, r/climate, NewsAPI |
| 🐾 Wildlife | ScienceDaily Wildlife, r/wildlifebiology, NewsAPI |
| 🧠 Health Science | r/neuroscience, NewsAPI |

---

## Scheduled Jobs

| Time | Job |
|---|---|
| 6:00 AM daily | Aggregate news (NewsAPI + RSS + Reddit) → summarize new stories with Claude → cluster by topic |
| 8:00 AM daily | Send HTML email digest via SendGrid |

Both jobs can also be triggered manually from the dashboard (Refresh Stories / Send Digest buttons).

---

## API Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/register` | — | Create account |
| POST | `/api/auth/login` | — | Sign in, returns JWT |
| GET | `/api/auth/me` | ✓ | Current user |
| PATCH | `/api/auth/profile` | ✓ | Update interests + hashtag filters |
| GET | `/api/stories` | optional | List stories (with user interactions if authed) |
| GET | `/api/stories/:id` | optional | Single story |
| POST | `/api/stories/refresh` | ✓ | Trigger aggregation + summarization + clustering |
| PATCH | `/api/stories/:id/favorite` | ✓ | Toggle saved |
| PATCH | `/api/stories/:id/used` | ✓ | Toggle posted |
| PATCH | `/api/stories/:id/notes` | ✓ | Save notes + tags |
| GET | `/api/trending/hashtags` | — | Top hashtags from last N days |
| GET | `/api/sources` | ✓ | Sources with user's ratings |
| POST | `/api/sources/rate` | ✓ | Rate a source 1–5 |
| DELETE | `/api/sources/rate` | ✓ | Remove a source rating |
| GET | `/api/analytics` | ✓ | Engagement stats |
| POST | `/api/digest/send` | ✓ | Send digest email |
| GET | `/api/digest/preview` | ✓ | Preview digest content |

---

## Deployment

| Service | Platform |
|---|---|
| Frontend | Vercel (`client/`) |
| Backend | Railway or Render (`server/`) |
| Database | Railway PostgreSQL or Supabase |
| Scheduling | Keep the server process alive (Railway/Render keep-alive) or migrate cron jobs to Vercel Cron + API routes for serverless deployments |

Set `NODE_ENV=production` in your deployment environment. The database pool will enforce SSL with `rejectUnauthorized: true` by default (override with `DB_SSL_REJECT_UNAUTHORIZED=false` only for local dev without SSL).
