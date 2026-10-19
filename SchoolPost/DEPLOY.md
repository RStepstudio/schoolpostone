# Schoolpost - Quick Deploy Commands

## Prerequisites
- Node.js 18+ (install from nodejs.org)
- Cloudflare account with Pages + D1 access
- Wrangler CLI: `npm install -g wrangler`

## One-time Setup

```bash
# Login to Cloudflare
wrangler login

# Create D1 database
wrangler d1 create schoolpost

# Copy the database_id from output, update wrangler.toml:
# database_id = "your-actual-database-id-here"
```

## Local Development

```bash
# Install dependencies
npm install

# Apply migrations locally
npm run db:migrate:local

# Start dev server (http://localhost:8788)
npm run dev
```

## Production Deployment

```bash
# Apply migrations to remote D1
npm run db:migrate

# Deploy to Cloudflare Pages
npm run deploy
```

## Post-Deploy Configuration

1. **Cron Trigger** (verification check every 6 hours):
   - Go to Cloudflare Dashboard > Pages > schoolpost > Settings > Cron Triggers
   - Add: `0 */6 * * *` (targets `/api/verification/cron`)

2. **Environment Variables** (in Pages settings):
   - `VERIFICATION_CRON_SECRET` = random string (e.g., `openssl rand -hex 32`)

3. **Workers AI** (optional, for content filtering):
   - Add AI binding in Pages settings or wrangler.toml

## File Structure
```
SchoolPost/
├── wrangler.toml              # Config
├── package.json               # Scripts
├── migrations/
│   ├── 0001_initial.sql       # Base schema
│   └── 0002_anonymous_posting.sql  # New tables/columns
├── functions/
│   ├── utils/content-filter.js      # Keyword + AI filter
│   ├── api/
│   │   ├── posts.js                 # POST /api/posts (create)
│   │   ├── posts/[id].js            # DELETE /api/posts/:id (soft delete)
│   │   ├── feed.js                  # GET /api/feed (with session_id)
│   │   ├── likes.js                 # POST /api/likes
│   │   ├── follows.js               # POST /api/follows
│   │   ├── comments/[id].js         # GET comments
│   │   ├── comments.js              # POST /api/comments
│   │   ├── comments/[id].js         # DELETE comment
│   │   ├── clubs.js                 # POST /api/clubs (create)
│   │   ├── clubs/[id].js            # GET club info
│   │   ├── clubs/[id]/join.js       # POST join/leave
│   │   ├── verification.js          # GET verification status
│   │   └── verification/cron.js     # POST cron (auto-verify)
├── public/
│   ├── index.html             # Main HTML + SVG icons + onboarding dialog
│   ├── app.js                 # Full frontend logic
│   └── styles.css             # Dark mode, SVG icons, mobile UX
└── DEPLOY.md                  # This file
```

## Features Implemented
- ✅ Anonymous username onboarding (cookie + localStorage)
- ✅ Session tracking for soft delete eligibility
- ✅ Hybrid content filter (keywords + optional AI)
- ✅ File uploads (.txt, .json, .csv, .md up to 50MB)
- ✅ Comments with delete (session-scoped)
- ✅ Verification system (top 3 weekly + 5 fans OR club owner 10+ members)
- ✅ Clubs with join/leave
- ✅ Real SVG icons (inline sprite)
- ✅ Dark mode (persisted, system-aware)
- ✅ Mobile bottom nav + responsive layout