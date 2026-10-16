# Final Plan v2 — "Agile Post of the Week" — AI Content Agent on Vercel

> **This plan now lives at `~/Desktop/linkedinpost/PLAN.md`** (moved from `.opencode/plan/` after plan mode ended — directory casing is lowercase per user preference). Build here.
> This plan was finalized in Plan mode on 2026-10-16. All user decisions below are locked in.

---

## 1. Goal

A lightweight web app on Vercel that, fully automatically once a week:

1. Searches trending topics in Agile project management (agentic trend scout)
2. Suggests 3 topics + writes 1 ready-to-post viral-style LinkedIn draft (~150 words, exec-focused)
3. Emails the draft to the user (Gmail) with one-tap action buttons
4. **Only after the user taps "Approve"**, posts the draft to their LinkedIn feed
5. Handles feedback ("Pick #2", edits), 7-day expiry reminders, failure alerts, and LinkedIn token-expiry warnings

**Classification:** AI-powered automation pipeline with an agentic research step (not full autonomous agentic AI — the human approval gate is a hard design requirement).

## 2. Locked-in Decisions (user-confirmed)

| Decision | Choice |
|---|---|
| Hosting | **Vercel** (lightweight web app), repo on **GitHub**, auto-deploy on push |
| Scheduler | **Vercel Cron** (not local launchd) |
| Approval flow | **One-tap signed buttons in the email** (Approve / Try #2 / Give feedback) — no IMAP polling |
| Email | **Gmail → same Gmail account** (send and receive), SMTP via App Password |
| Schedule | **Monday 8:00 AM** weekly; daily expiry/token check |
| Post media | **Text-only first** (no images in v1) |
| Email contents | **3 topic suggestions + 1 ready draft** |
| LinkedIn integration | **Direct LinkedIn REST API only — no LinkedIn MCP** (user decision) |
| Trend scout style | **Agentic: AI agent loop + search MCP (Tavily)**, direct Tavily HTTP API as fallback |
| Audience | Leadership / executives |
| Tone | Short & punchy (~150 words) |
| Content angle (all four) | Personal story + company/service promo + thought leadership + educational how-to |
| Accounts user already has | GitHub, Vercel, LLM API key |

## 3. Technology Stack (final)

| Layer | Technology | Notes |
|---|---|---|
| App framework | **Next.js (TypeScript, App Router) on Vercel** | API routes + password-protected dashboard |
| Scheduler | **Vercel Cron** | `POST /api/weekly` (Mon 8am) + `GET /api/expire` (daily) |
| Database | **Postgres — Neon free tier** (via Vercel Marketplace) | Drafts & state machine |
| Trend scout | **Agentic step**: Vercel AI SDK tool-calling loop with **Tavily Search MCP** as search tool; fallback = Tavily HTTP API | Agent searches, iterates, curates top 3 trending Agile topics with source links |
| Writer | **Vercel AI SDK** + user's LLM API key | 150-word viral-style post from stored content DNA |
| Email send | **Nodemailer → Gmail SMTP** (App Password) | Suggestions + draft + 3 signed action links |
| Approval links | **Signed single-use expiring tokens** (HMAC via `jose`) | Server-side validation |
| LinkedIn posting | **LinkedIn REST API** — `POST /rest/posts`, OAuth 2.0, scope `w_member_social` (+ `openid`/`profile` for person URN) | Token refresh logic + expiry-warning emails in code |
| Secrets | **Vercel encrypted env vars** | Gmail app password, LinkedIn access+refresh tokens, LLM key, HMAC secret, dashboard basic-auth |
| Dashboard | Single protected page (`/dashboard`) | Draft list + statuses |
| CI/CD | GitHub → Vercel Git integration | Push = deploy |
| **Cost** | **~$0/month** | All free tiers; LLM ≈ pennies/week |

## 4. Architecture

```
 GitHub ──push──▶ Vercel: Next.js app ◀── Vercel Cron (Mon 8am + daily)
                         │
                         │ POST /api/weekly
                         │   ① SCOUT (agentic): agent + search MCP loop
                         │        → top 3 trending Agile topics + sources
                         │   ② WRITER (LLM): viral 150-word draft
                         │   ③ save [PENDING] → Neon DB
                         │   ④ email: suggestions + draft + signed buttons ──▶ Gmail
                         │
 User (phone) ──tap─────▶ /api/approve?token=...
                         │     ├─ valid → LinkedIn REST API → LIVE POST ✅
                         │     ├─ → confirmation email to user
                         │     └─ invalid/used/expired → rejected safely
 User ──tap "Try #2"────▶ /api/feedback → re-run agent/LLM → new draft email
 Cron (daily) ──────────▶ /api/expire → 7-day expiry reminders,
                         │              LinkedIn token-expiry warnings (~2 weeks ahead),
                         │              failure alert emails
 /dashboard ────────────▶ drafts & statuses (basic-auth protected)
```

## 5. Data Model (Neon Postgres)

```
drafts
  id            uuid PK
  week_of       date            -- scheduled week
  topics        jsonb           -- [{title, source, why_trending}] (3 items)
  chosen_topic  text
  content       text            -- the LinkedIn post body
  status        text            -- pending | approved | posted | expired | failed
  token_hash    text            -- HMAC of current action token
  token_expires timestamptz
  created_at    timestamptz
  updated_at    timestamptz

post_log (audit)
  id, draft_id, action (emailed|approved|feedback|posted|expired|failed),
  detail jsonb, created_at

linkedin_tokens (persist or env + rotate on refresh)
  access_token, refresh_token, expires_at, person_urn
```

## 6. Weekly Flow (end to end)

1. **Monday 8:00 AM** — Vercel Cron hits `/api/weekly`
2. **Scout (agentic)** — agent autonomously searches trending Agile topics (LinkedIn News, Reddit r/agile, HN, Google News, PM blogs via Tavily/search MCP) → curates top 3 with sources
3. **Write** — LLM generates one viral ~150-word post: hook → personal story → insight/opinion → CTA, exec-focused, from stored content DNA
4. **Email** — arrives in user's Gmail: 3 suggestions + ready draft + buttons (✅ Approve & Post / 🔄 Try #2 instead / ✏️ Give feedback), all links signed
5. **User taps Approve** (seconds, from phone) → `/api/approve` validates token → posts via LinkedIn API → confirmation email ✅
   - **Try #2 / feedback** → agent re-runs with that input → new draft email
   - **No response in 7 days** → expiry reminder, draft → `EXPIRED`
6. **Every transition** logged in DB + Vercel function logs

## 7. Hard Guarantees (non-negotiable)

- 🔒 **Nothing posts without explicit user tap** — server-side approval gate, non-bypassable
- 🔒 Signed, single-use, expiring tokens on all action links
- 🔒 Dashboard basic-auth protected
- 🔒 **Dry-run mode** env flag: full pipeline runs but LinkedIn call is stubbed
- 🔒 Every failure → alert email to user
- 🔒 LinkedIn token expiry → warning email ~2 weeks ahead (re-auth ≈ 2 min)
- 🔒 Credentials only in Vercel env vars (never in repo)

## 8. Build Phases

| Phase | Deliverable | User involvement |
|---|---|---|
| **0. Inputs & setup** | Content DNA (4 bullets below), Gmail App Password, LinkedIn Developer App + OAuth token, env vars set in Vercel | ⚠️ Guided setup (~30 min total) |
| **1. Scaffold** | Next.js repo, Neon DB schema, env vars, GitHub↔Vercel linked | — |
| **2. Pipeline** | `/api/weekly`: scout agent → writer → email, dry-run toggle | Review test email |
| **3. Approval + LinkedIn** | Signed-link endpoints, LinkedIn OAuth + poster, confirmation emails | One supervised live post |
| **4. Cron & safety** | Cron jobs, expiry/token warnings, error alerts, logs | — |
| **5. Dashboard** | Simple drafts/status page | Optional |
| **6. Go live** | Dry-run week → real week → hands-off | Tap Approve weekly |

## 9. Build-time Verifications (do not assume)

1. **Vercel Hobby limits** — cron frequency cap and function `maxDuration` (pipeline may exceed default timeout).
   Fallbacks: split pipeline into chained steps, or free external cron ping (e.g., cron-job.org). No user-facing change.
2. **LinkedIn API policy (2026)** — current OAuth scopes, token lifespan/refresh rules, whether app verification/review is required for `w_member_social` person posts, exact `POST /rest/posts` payload shape.
3. **Tavily MCP on Vercel** — whether a stdio MCP server can spawn in a Node function or must use remote/SSE; fallback to direct Tavily HTTP API (simple and reliable).
4. **Gmail App Password** — still supported with 2FA; SMTP deprecations do not affect App Passwords.

## 10. Honest Risks

1. **LinkedIn token lifecycle** — re-auth every ~2-3 months (auto-warned in advance); policy changes possible
2. **Vercel Hobby limits** — mitigations in §9; ~zero risk at 1-2 runs/week volume
3. **"Viral" is a goal, not a guarantee** — v1 follows proven hook/structure best practices
4. **v2 roadmap (optional):** agent reads LinkedIn analytics (impressions/likes via API) and adapts next week's topics/hook style — the natural agentic evolution

## 11. Content DNA (STILL NEEDED FROM USER — 4 bullets)

- ⭐ **Personal Agile story:** _TBD — 1–2 sentences of raw detail_
- ⭐ **Company/service to promote + CTA link:** _TBD_
- ⭐ **Signature opinion (exec-facing take):** _TBD_
- ⭐ **Name & title for sign-off:** _TBD_

## 12. LinkedIn MCP (settled)

User initially considered a LinkedIn MCP; final decision: **ignore LinkedIn MCP for now**. Posting goes through the official REST API directly from the serverless function (deterministic, zero LLM cost at the approval gate). A LinkedIn MCP may be revisited later for interactive/chat features.

---

## First tasks for the implementer agent

1. ~~Copy this file to Desktop~~ ✅ Done — plan is at `~/Desktop/linkedinpost/PLAN.md`, repo initialized
2. Collect the 4 Content DNA bullets from the user (§11) → fill `lib/content-dna.ts`
3. Guide user through Phase 0 setup (Gmail App Password, LinkedIn Developer App) — see README.md
4. Begin Phase 1 scaffold (Next.js app in this directory)

## Build progress

- [x] Plan file moved to `~/Desktop/linkedinpost/PLAN.md`
- [x] `git init` (branch `main`)
- [ ] Phase 1: Next.js scaffold + Neon schema + env template
- [ ] Phase 2: Pipeline (scout → writer → email, dry-run)
- [ ] Phase 3: Approval + LinkedIn posting
- [ ] Phase 4: Cron + safety (expiry, token warnings, alerts)
- [ ] Phase 5: Dashboard
- [ ] Phase 6: Go live
