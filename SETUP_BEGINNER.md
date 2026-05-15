# ELITEOS — COMPLETE SETUP GUIDE
# Assumes you know nothing. Every click explained.
# Time: ~20 minutes

════════════════════════════════════════════════════════════
PART 1 — SUPABASE (your database, free)
════════════════════════════════════════════════════════════

STEP 1: Create Supabase account
────────────────────────────────
1. Open your browser
2. Go to: https://supabase.com
3. Click "Start your project" (green button)
4. Sign up with Google (easiest) or email
5. You're now on the Supabase dashboard


STEP 2: Create a new project
──────────────────────────────
1. Click "New project"
2. Fill in:
   - Name: eliteos
   - Database Password: make something up, SAVE IT in notes
   - Region: pick "South Asia (Mumbai)" or "Southeast Asia (Singapore)"
3. Click "Create new project"
4. Wait about 60-90 seconds for it to spin up (there's a loading bar)


STEP 3: Run the database setup
────────────────────────────────
1. On the left sidebar, click "SQL Editor"
2. Click "New query" (top left)
3. Open the file: supabase_schema.sql (from the zip you downloaded)
   - On Mac: double-click it, it opens in TextEdit
   - On Windows: right-click → Open with → Notepad
4. Select ALL the text (Ctrl+A or Cmd+A) → Copy it (Ctrl+C or Cmd+C)
5. Go back to Supabase SQL Editor → click in the text area → Paste (Ctrl+V or Cmd+V)
6. Click "Run" (green button, top right)
7. You should see "Success. No rows returned" at the bottom ✓


STEP 4: Enable live updates (Realtime)
────────────────────────────────────────
1. On the left sidebar, click "Database"
2. Click "Replication" (in the submenu)
3. You'll see a list of tables. Find these three and toggle them ON:
   - sessions
   - recovery
   - intel_log
4. They should turn green/enabled ✓


STEP 5: Copy your API keys
────────────────────────────
1. On the left sidebar, click "Settings" (gear icon at bottom)
2. Click "API"
3. You'll see two things — copy both into Notepad/Notes app:

   Project URL:
   Looks like: https://abcdefghijk.supabase.co
   → COPY THIS, label it "SUPABASE URL"

   anon/public key:
   Looks like: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOi...
   (very long string)
   → COPY THIS, label it "SUPABASE KEY"

════════════════════════════════════════════════════════════
PART 2 — NODE.JS (needed to deploy)
════════════════════════════════════════════════════════════

STEP 6: Install Node.js
─────────────────────────
1. Go to: https://nodejs.org
2. Click the big green button that says "LTS" (recommended)
3. Download and install it (just click Next/Continue through all the steps)
4. When done, open Terminal (Mac) or Command Prompt (Windows):
   - Mac: press Cmd+Space, type "terminal", press Enter
   - Windows: press Windows key, type "cmd", press Enter
5. Type this and press Enter:
   node --version
6. You should see something like: v20.11.0
   If you see a version number, Node.js is installed ✓


════════════════════════════════════════════════════════════
PART 3 — PREPARE THE PROJECT FILES
════════════════════════════════════════════════════════════

STEP 7: Unzip and prepare the project
────────────────────────────────────────
1. Find the file you downloaded: eliteos_v3_final.zip
2. Unzip it:
   - Mac: double-click the zip file
   - Windows: right-click → Extract All
3. You now have a folder called "eliteos_v3"
4. Inside it, find the file called: .env.example
   NOTE: On Mac, files starting with "." are hidden by default.
   To show hidden files on Mac: press Cmd+Shift+. (dot) in Finder
5. Make a COPY of .env.example and rename the copy to: .env.local
   (The original name has a dot at the start and ends in .example)
   (The new file should be named: .env.local — dot, env, dot, local)
6. Open .env.local in Notepad/TextEdit
7. Replace the placeholder values with your Supabase keys from Step 5:

   BEFORE:
   NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_ANON_KEY

   AFTER (example — use YOUR actual values):
   NEXT_PUBLIC_SUPABASE_URL=https://abcdefghijk.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6...

8. Save the file ✓


════════════════════════════════════════════════════════════
PART 4 — DEPLOY TO VERCEL (your website host, free)
════════════════════════════════════════════════════════════

STEP 8: Install Vercel and deploy
───────────────────────────────────
1. Open Terminal (Mac) or Command Prompt (Windows) — same as Step 6

2. Install Vercel (copy this exactly, press Enter):
   npm install -g vercel

3. Navigate into your project folder.
   Type cd followed by a space, then drag the "eliteos_v3" folder
   directly into the terminal window. It will auto-fill the path.
   Press Enter.

   Example of what it might look like:
   cd /Users/yourname/Downloads/eliteos_v3

4. Type this and press Enter:
   vercel --prod

5. First time: it will ask you to log in.
   Press Enter to open browser → sign up with GitHub or email (free)
   Come back to terminal after logging in.

6. It will ask you questions. Answer like this:
   "Set up and deploy?" → type Y, press Enter
   "Which scope?" → press Enter (selects your account)
   "Link to existing project?" → type N, press Enter
   "What's your project's name?" → type eliteos, press Enter
   "In which directory is your code located?" → press Enter (it shows ./)
   "Want to override the settings?" → type N, press Enter

7. Wait ~2 minutes. It's building and deploying.

8. When done you'll see:
   ✓  Production: https://eliteos-something.vercel.app

   COPY THAT URL. It's your EliteOS website. ✓


STEP 9: Verify it works
─────────────────────────
1. Open your browser
2. Go to: https://YOUR-VERCEL-URL.vercel.app/dashboard
   (replace YOUR-VERCEL-URL with what you got in Step 8)
3. You should see the EliteOS dashboard — dark, tactical interface
   It will be mostly empty — that's normal, no data yet ✓


════════════════════════════════════════════════════════════
PART 5 — CONNECT CLAUDE
════════════════════════════════════════════════════════════

STEP 10: Create a Claude Project
──────────────────────────────────
1. Go to: https://claude.ai
2. On the left sidebar, look for "Projects" — click it
3. Click "New Project"
4. Name it: EliteOS
5. Click Create


STEP 11: Add your instructions to Claude
──────────────────────────────────────────
1. Inside your EliteOS project, look for "Project instructions"
   or a settings/gear icon — click it
2. There's a text box for instructions
3. Open the file: CLAUDE_PROJECT_INSTRUCTIONS.md
   (From your eliteos_v3 folder — open with Notepad/TextEdit)
4. Select ALL text (Ctrl+A) → Copy (Ctrl+C)
5. Paste it into the Claude instructions box
6. IMPORTANT: Find the line that says:
   Base URL: https://YOUR_VERCEL_URL/api/eliteos
   Replace YOUR_VERCEL_URL with your actual URL from Step 8
   Example: Base URL: https://eliteos-abc123.vercel.app/api/eliteos
   Do the same for the other line with YOUR_VERCEL_URL
7. Click Save ✓


STEP 12: Make sure WHOOP and Garmin are connected
───────────────────────────────────────────────────
1. In Claude.ai, go to Settings
2. Look for "Integrations" or "Connections" or "MCP"
3. Make sure wHOOP is toggled ON
4. Make sure Garmin is toggled ON
   (If they're already connected from before, they should already be on)


════════════════════════════════════════════════════════════
PART 6 — TEST IT
════════════════════════════════════════════════════════════

STEP 13: First message
────────────────────────
1. In your EliteOS Claude project, type:
   EliteOS morning briefing

2. Claude should:
   - Pull your WHOOP data
   - Pull your Garmin data
   - Generate a full briefing
   - Write the data to your dashboard

3. Open your dashboard in another tab:
   https://YOUR-VERCEL-URL.vercel.app/dashboard

4. Within a few seconds you should see data appearing ✓


════════════════════════════════════════════════════════════
IF SOMETHING GOES WRONG
════════════════════════════════════════════════════════════

Problem: Dashboard shows "Loading Systems" forever
Fix: Check that your .env.local has the correct Supabase values
     Re-run: vercel --prod (from your project folder in terminal)

Problem: Claude says it can't reach the API
Fix: Test the API directly — open browser, go to:
     https://YOUR-VERCEL-URL.vercel.app/api/eliteos?action=summary
     Should show JSON text. If error, re-check your Vercel deployment.

Problem: "npm not found" in terminal
Fix: Node.js didn't install correctly. Re-do Step 6.

Problem: Can't find .env.example (Mac hidden files)
Fix: In Finder, press Cmd+Shift+. to toggle hidden files visible

Problem: Vercel deploy fails
Fix: Make sure you're in the right folder (Step 8, point 3)
     Type: ls (Mac) or dir (Windows) — you should see package.json listed

════════════════════════════════════════════════════════════
DONE. YOUR SYSTEM IS LIVE.
════════════════════════════════════════════════════════════

Dashboard: https://YOUR-VERCEL-URL.vercel.app/dashboard
Claude project: EliteOS (in claude.ai Projects)

Daily use:
- Morning: "EliteOS morning briefing" → Claude syncs WHOOP/Garmin, briefs you
- After training: just tell Claude what you did, it logs it
- Check dashboard: opens in any browser, any device, any time
