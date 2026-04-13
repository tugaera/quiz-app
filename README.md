# QuizLive — Real-Time Quiz Platform

A Kahoot-style real-time quiz platform with server-authoritative timers, automatic question progression, invite-only registration, and live leaderboards.

## Tech Stack

- **Framework:** Next.js 16 (App Router, TypeScript, Server Components)
- **Database & Auth:** Supabase (Postgres, Auth, Realtime, Edge Functions)
- **Styling:** Tailwind CSS v4 + shadcn/ui v4
- **Forms:** react-hook-form + Zod v4
- **QR Codes:** qrcode.react
- **Deployment:** Vercel

---

## Local Development Setup

### Prerequisites

- Node.js 18+ and npm
- A Supabase project (free tier works) — [create one here](https://supabase.com/dashboard)

### 1. Clone and install dependencies

```bash
git clone <your-repo-url>
cd quiz-app
npm install
```

### 2. Set up Supabase

#### Create a Supabase project

1. Go to [supabase.com/dashboard](https://supabase.com/dashboard) and create a new project
2. Note down your **Project URL**, **anon key**, and **service role key** from Settings → API

#### Run the database migration

1. Open the **SQL Editor** in your Supabase dashboard
2. Copy the entire contents of `supabase/migrations/00001_initial_schema.sql`
3. Paste it into the SQL Editor and click **Run**

This creates all 7 tables, RLS policies, indexes, triggers, and enables Realtime on the required tables.

#### Enable Realtime

Go to **Database → Replication** in the Supabase dashboard and confirm these tables are in the `supabase_realtime` publication:
- `quiz_sessions`
- `players`
- `answers`

(The migration script does this automatically, but verify it.)

#### Configure Auth

1. Go to **Authentication → Providers** and ensure **Email** provider is enabled
2. Optionally disable "Confirm email" for local development (Authentication → Settings)
3. Under **Authentication → Settings**, you can disable new user signups at the project level (registration is gated by invite codes in the app)

### 3. Configure environment variables

Copy the example env file and fill in your Supabase credentials:

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NEXT_PUBLIC_APP_URL=http://localhost:3000
INVITE_TOKEN_SECRET=any-random-string-at-least-32-characters-long
SUPABASE_EDGE_FUNCTION_URL=http://localhost:54321/functions/v1/advance-question
```

| Variable | Where to find it |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Dashboard → Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase Dashboard → Settings → API → `anon` `public` key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Dashboard → Settings → API → `service_role` key (keep secret!) |
| `INVITE_TOKEN_SECRET` | Generate with: `openssl rand -hex 32` |

### 4. Create the first user (bootstrap)

Since registration requires an invite code, you need to create the first user manually:

1. Go to **Supabase Dashboard → Authentication → Users → Add User**
2. Create a user with email + password
3. The `on_auth_user_created` trigger will auto-create their profile
4. Now sign in at `http://localhost:3000/auth/login`
5. Go to Profile and generate an invite code to register additional users

### 5. Start the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 6. (Optional) Edge Function for auto-progression

The Edge Function at `supabase/functions/advance-question/index.ts` handles automatic question advancement. For local development:

```bash
# Install Supabase CLI globally (if not already)
npm install -g supabase

# Start local Supabase (optional — you can also use the hosted project)
supabase start

# Serve Edge Functions locally
supabase functions serve advance-question --env-file .env.local
```

For development without the Edge Function, the quiz will still work — questions just won't auto-advance when the timer expires. You can manually test the flow.

---

## Production Deployment (Vercel + Supabase)

### 1. Deploy to Vercel

1. Push your code to GitHub
2. Go to [vercel.com/new](https://vercel.com/new) and import the repository
3. Vercel auto-detects Next.js — no special build settings needed

### 2. Set environment variables in Vercel

Go to your Vercel project → **Settings → Environment Variables** and add:

| Variable | Value | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://your-project.supabase.co` | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJ...` | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJ...` | **Mark as secret** — Supabase service role key |
| `NEXT_PUBLIC_APP_URL` | `https://your-app.vercel.app` | Your Vercel deployment URL (or custom domain) |
| `INVITE_TOKEN_SECRET` | (random 32+ char string) | **Mark as secret** — `openssl rand -hex 32` |
| `SUPABASE_EDGE_FUNCTION_URL` | `https://your-project.supabase.co/functions/v1/advance-question` | Edge Function URL |

### 3. Deploy the Edge Function

```bash
# Link to your Supabase project
supabase link --project-ref your-project-ref

# Deploy the Edge Function
supabase functions deploy advance-question
```

### 4. Set up auto-progression scheduler (pg_cron)

The Edge Function needs to be called periodically to advance expired questions. Set this up in the **Supabase SQL Editor**:

```sql
-- Enable pg_cron and pg_net extensions (if not already)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedule the Edge Function to run every minute
SELECT cron.schedule(
  'advance-questions-job',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://your-project.supabase.co/functions/v1/advance-question',
    headers := jsonb_build_object(
      'Authorization', 'Bearer your-service-role-key',
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);
```

Replace `your-project` and `your-service-role-key` with your actual values.

> **Note:** pg_cron runs at 1-minute resolution. For sub-second timer accuracy, the client-side timer derives remaining time from the server timestamp — so the UX is smooth regardless. The Edge Function just handles the progression between questions.

### 5. Verify deployment

1. Visit your Vercel URL
2. Sign in with the user you created in Supabase
3. Generate an invite code from Profile
4. Open an incognito window and register at `/auth/register?code=YOUR_CODE`
5. Create a quiz, add questions, start a session
6. Scan the QR code (or open the play link) in another browser to join as a player

---

## Project Structure

```
quiz-app/
├── app/
│   ├── api/
│   │   ├── auth/signout/          # Sign out endpoint
│   │   ├── invite/                # Invite code endpoints (validate, generate, use)
│   │   └── session/[sessionId]/   # Session state endpoint
│   ├── auth/
│   │   ├── login/                 # Email + password login
│   │   └── register/              # Invite-gated registration
│   ├── dashboard/
│   │   ├── profile/               # User info + invite management
│   │   └── quiz/
│   │       ├── new/               # Create quiz form
│   │       └── [quizId]/
│   │           ├── edit/           # Question editor
│   │           ├── session/[sessionId]/
│   │           │   └── results/    # Results + leaderboard
│   │           └── page.tsx        # Quiz detail + session management
│   └── play/[sessionId]/          # Player join + game
├── components/
│   ├── quiz/                      # TimerBar, QuestionCard, AnswerButton, QRModal
│   ├── session/                   # PlayerList, AnswerStats, Leaderboard
│   └── ui/                        # shadcn/ui primitives
├── hooks/                         # useCountdown, useSessionState
├── lib/
│   ├── supabase/                  # Client (browser, server, admin, middleware)
│   ├── realtime/                  # usePlayerChannel, useHostChannel
│   ├── timer/                     # useServerTimer
│   └── env.ts                     # Zod-validated env vars
├── supabase/
│   ├── functions/advance-question/ # Edge Function for auto-progression
│   └── migrations/                # SQL schema
└── types/                         # DB types, Zod schemas, realtime events
```

## Architecture

### Timer System

The timer is **server-authoritative**. When a question starts, the server records `question_started_at` (a timestamp). Every client computes remaining time as:

```
remaining = timeLimitSeconds - (now - questionStartedAt)
```

This means:
- All clients share the same deadline regardless of when they connected
- Late joiners see the correct remaining time immediately
- Reconnecting mid-question resumes at the right position
- No drift between clients

### Realtime

- **Broadcast channel** `quiz:{sessionId}` — events: `quiz_start`, `next_question`, `quiz_end`
- **Postgres Changes** on `players` (join events) and `answers` (submission counts)
- **REST fallback** via `GET /api/session/[sessionId]/state` on mount and tab refocus

### Scoring

- Correct answer: **1000 points** base
- Speed bonus: up to **500 points** (linearly decreasing with response time)
- Wrong / no answer: **0 points**

---

## Key Commands

```bash
npm run dev          # Start development server
npm run build        # Production build
npm run lint         # Run ESLint
```
