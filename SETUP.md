# ELITEOS V3 — SETUP GUIDE
# No GitHub needed. ~15 minutes start to live.

## ARCHITECTURE
You (Claude.ai Project) ←──→ EliteOS API (Vercel) ←──→ Supabase DB
         │                                                     ↑
   wHOOP MCP ─────────────────────────────────────────────────┘
   Garmin MCP ──────────────────────────────────────────────────┘
         │
   Dashboard (Vercel) ← real-time ← Supabase

────────────────────────────────────────────────────────────────
## STEP 1 — SUPABASE (5 min)
────────────────────────────────────────────────────────────────

1. supabase.com → New Project
   - Name: eliteos
   - Password: save it somewhere
   - Region: Mumbai ap-south-1 (or Singapore if not available)
   - Click "Create new project" — wait ~90 seconds

2. SQL Editor → New Query → paste supabase_schema.sql → Run
   You should see: "Success. No rows returned"

3. Settings → API → copy:
   - Project URL  →  NEXT_PUBLIC_SUPABASE_URL
   - anon/public  →  NEXT_PUBLIC_SUPABASE_ANON_KEY

4. Database → Replication → enable Realtime for:
   - sessions
   - recovery
   - intel_log
   (This powers live dashboard updates)

────────────────────────────────────────────────────────────────
## STEP 2 — DEPLOY TO VERCEL (5 min, no GitHub)
────────────────────────────────────────────────────────────────

Install Node.js if you don't have it:
  https://nodejs.org (download LTS version)

Then in terminal:

  # Install Vercel CLI
  npm install -g vercel

  # Go into the project folder
  cd eliteos_v3   (or wherever you unzipped this)

  # Create your .env.local file
  cp .env.example .env.local

  # Open .env.local and fill in your two Supabase values:
  # NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
  # NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...

  # Deploy (follow prompts — create account if needed, it's free)
  vercel --prod

Vercel will ask:
  - Set up and deploy? → Y
  - Which scope? → your account
  - Link to existing project? → N
  - Project name? → eliteos (or anything)
  - Directory: → ./  (just press Enter)
  - Override settings? → N

When it asks for environment variables, it will pick them up from .env.local automatically.

After deploy you get:
  ✓  Production: https://eliteos-xxxx.vercel.app

That's your URL. Copy it.

To update env vars if needed:
  vercel env add NEXT_PUBLIC_SUPABASE_URL
  vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
  vercel --prod  (redeploy)

────────────────────────────────────────────────────────────────
## STEP 3 — CONNECT CLAUDE (3 min)
────────────────────────────────────────────────────────────────

1. claude.ai → Projects → "New Project"
   Name it: EliteOS

2. In the project: Settings (or gear icon) → Instructions
   Paste: everything in CLAUDE_PROJECT_INSTRUCTIONS.md
   Replace: YOUR_VERCEL_URL → your actual Vercel URL

3. Make sure these MCPs are enabled in Claude Settings:
   - wHOOP ✓ (you already have this)
   - Garmin ✓ (you already have this)

────────────────────────────────────────────────────────────────
## STEP 4 — FIRST TEST
────────────────────────────────────────────────────────────────

In your EliteOS Claude project, type:
  "EliteOS morning briefing"

Claude will:
  → GET your data from the API
  → Pull WHOOP + Garmin via MCP
  → Generate full briefing
  → Write recovery data back to dashboard

Open your dashboard:
  https://your-vercel-url.vercel.app/dashboard

You should see the data appear within a few seconds.

────────────────────────────────────────────────────────────────
## DAILY USE
────────────────────────────────────────────────────────────────

Morning:
  → "EliteOS morning briefing"
  → Dashboard auto-updates with WHOOP + Garmin data

After training:
  → "Just did 45min Hyrox sim: ski erg, sled push, sled pull, wall balls. RPE 8."
  → Claude logs session + updates station readiness

Weekly planning:
  → "Plan my training week, 6 days out from Bergman"
  → Claude reads load, recovery trend, race proximity → writes planned sessions

Race intel:
  → "Bergman Pune race strategy — humid morning, trail terrain"
  → Claude reads your fitness state → gives specific plan

Mode changes:
  → "Switch to Locked-In mode, 8 weeks to Hyrox"
  → Claude updates profile on dashboard

────────────────────────────────────────────────────────────────
## TROUBLESHOOTING
────────────────────────────────────────────────────────────────

"API not reachable" in Claude:
  → Check Vercel dashboard → Functions tab → any errors?
  → Re-run: vercel --prod

Data not appearing on dashboard:
  → Open browser console — any Supabase errors?
  → Check .env.local has correct values
  → Verify Supabase Realtime is enabled (Step 1, point 4)

WHOOP not syncing:
  → Type: "what's my WHOOP recovery today?" to test MCP alone
  → If that works, the EliteOS sync will work

Claude says "I can't access the API":
  → Paste the API URL directly in chat to confirm it's live
  → https://your-url.vercel.app/api/eliteos?action=summary
  → Should return JSON

────────────────────────────────────────────────────────────────
## DASHBOARD URL
────────────────────────────────────────────────────────────────

  https://YOUR_VERCEL_URL.vercel.app/dashboard

Bookmark this. Auto-refreshes every 20s.
Live updates via Supabase Realtime — data appears within 2 seconds of Claude writing it.
