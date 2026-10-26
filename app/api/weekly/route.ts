import { NextRequest, NextResponse } from 'next/server';
import { createDraft, currentMonday, getDraftForWeek, logAction, updateDraft, type Topic } from '@/lib/db';
import { sendAlertEmail, sendDraftEmail, buildLinks } from '@/lib/email';
import { signActionToken } from '@/lib/tokens';
import { scoutTopics } from '@/lib/scout';
import { writePost } from '@/lib/writer';
import { baseUrl, env, isDryRun } from '@/lib/env';

function cronAuth(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // dev/local without CRON_SECRET
  const auth = req.headers.get('authorization');
  return auth === `Bearer ${secret}`;
}

// Full function budget (seconds): pipeline (~60-110s) + one 60s-cooled retry
export const maxDuration = 300;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Scout + write as one unit so a mid-pipeline capacity spike can be retried whole. */
async function scoutAndWrite(): Promise<{ topics: Topic[]; content: string }> {
  const topics = await scoutTopics();
  const written = await writePost(topics[0]);
  return { topics, content: written.content };
}

// Vercel cron invokes routes with GET; POST kept for manual triggers (curl/tests).
async function handle(req: NextRequest) {
  if (!cronAuth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const weekOf = currentMonday();
  try {
    // Guard: avoid double-run in the same week (idempotent by week)
    const existing = await getDraftForWeek(weekOf);
    if (existing && (existing.status === 'pending' || existing.status === 'approved' || existing.status === 'posted')) {
      await logAction(existing.id, 'skipped_duplicate', { weekOf, status: existing.status });
      return NextResponse.json({ ok: true, duplicate: true, draftId: existing.id });
    }

    // 1+2. Scout topics (agentic) + write — one cooled retry if a capacity
    // spike (Gemini 503 "high demand") kills the first attempt. Bounded so
    // the retry never starts when there isn't budget left before maxDuration.
    const started = Date.now();
    let out: { topics: Topic[]; content: string };
    try {
      out = await scoutAndWrite();
    } catch (e) {
      if (Date.now() - started > 150_000) throw e; // too late to retry safely
      await sleep(60_000); // let the spike pass
      out = await scoutAndWrite();
    }
    const topics = out.topics;
    const chosen = topics[0];
    const content = out.content;
    // 3. Draft + tokens
    const tokenExpires = new Date(Date.now() + 7 * 24 * 3600_000);
    const draft = await createDraft({ weekOf, topics, chosenTopic: chosen.title, content, tokenExpires });
    const approve = await signActionToken(draft.id, 'approve');
    const feedback = await signActionToken(draft.id, 'feedback');
    const revise = await signActionToken(draft.id, 'revise');
    const links = await buildLinks(draft, { approve, feedback, revise });
    // 4. Email
    await sendDraftEmail(draft, links);
    await logAction(draft.id, 'emailed', { dryRun: isDryRun(), links: { ...links, feedback: '[redacted]', revise: '[redacted]' } });
    return NextResponse.json({ ok: true, draftId: draft.id, weekOf });
  } catch (e) {
    // Always leave a DB trace, even if the alert email itself fails
    await logAction(null, 'failed', { weekOf, error: String(e) }).catch(() => {});
    try {
      await sendAlertEmail('weekly pipeline failed', e);
    } catch {}
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return handle(req);
}

export async function POST(req: NextRequest) {
  return handle(req);
}
