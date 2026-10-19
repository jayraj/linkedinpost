# Agile Post of the Week — AI Content Agent on Vercel

A small Next.js app that scouts trending Agile topics, writes a ~150-word exec-focused LinkedIn draft weekly, emails it to you with one-tap buttons, and — only after you tap "Approve" — posts to LinkedIn. Runs on Vercel Cron.

## Quick start (local)
1. `npm install`
2. `cp .env.example .env.local` and fill values (see Phase 0 below)
3. Run DB schema: `psql "$DATABASE_URL" -f db/schema.sql` (Neon SQL editor works too)
4. `npm run dev` — test `/api/weekly` locally? Prefer dry-run (`DRY_RUN=true`)

## Phase 0 (one-time)
- **Gmail App Password** (2FA enabled): Google Account → Security → App passwords → generate for "Mail"
- **LinkedIn Developer App**: https://developer.linkedin.com/apps — add product "Sign In with LinkedIn using OpenID Connect" and (later) permissions to share; capture client ID/secret
- **Tavily API key**: https://tavily.com (free tier)
- **LLM API key**: OpenAI/OpenRouter/Groq/DeepSeek etc (OpenAI-compatible)
- **Neon Postgres**: via Vercel Marketplace or https://neon.tech (free)
- Set `DATABASE_URL`, `LLM_API_KEY`, `TAVILY_API_KEY`, `GMAIL_*`, `LINKEDIN_*`, `TOKEN_SECRET`, `CRON_SECRET`, `DASHBOARD_*`, `BASE_URL`

## OAuth re-auth
Go to `/api/oauth/start` to connect/re-connect LinkedIn. The callback persists tokens and Person URN.

## Content DNA
Edit `lib/content-dna.ts` with your 4 bullets before going live.

## Post images
Every draft ships with an AI-generated square illustration (light & corporate
visual DNA), previewed inline in the approval email and published with the post.
- Default engine: [Pollinations.ai](https://pollinations.ai) — free, keyless; the
  free-tier watermark is cropped off in code (`lib/image.ts`).
- Optional upgrade: set `IMAGE_PROVIDER=gemini` to use Gemini image models
  (requires billing on the AI Studio project; falls back to Pollinations).
- If image generation fails, the post still goes out text-only and the email flags it.
- Schema columns: `drafts.image_data` (base64), `image_mime`, `image_status`.

## Go live
1. Link GitHub repo to Vercel, set all env vars
2. Deploy with `DRY_RUN=true`; test end-to-end (weekly + approve in dry-run)
3. Flip `DRY_RUN=false` — done
