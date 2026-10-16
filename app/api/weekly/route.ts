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

export async function POST(req: NextRequest) {
  if (!cronAuth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const weekOf = currentMonday();
  try {
    // Guard: avoid double-run in the same week (idempotent by week)
    const existing = await getDraftForWeek(weekOf);
    if (existing && (existing.status === 'pending' || existing.status === 'approved')) {
      await logAction(existing.id, 'skipped_duplicate', { weekOf, status: existing.status });
      return NextResponse.json({ ok: true, duplicate: true, draftId: existing.id });
    }

    // 1. Scout topics (agentic)
    const topics: Topic[] = await scoutTopics();
    const chosen = topics[0];
    // 2. Write post
    const content = await writePost(chosen);
    // 3. Draft + tokens
    const tokenExpires = new Date(Date.now() + 7 * 24 * 3600_000);
    const draft = await createDraft({ weekOf, topics, chosenTopic: chosen.title, content, tokenExpires });
    const approve = await signActionToken(draft.id, 'approve');
    const feedback = await signActionToken(draft.id, 'feedback');
    const links = await buildLinks(draft, { approve, feedback });
    // 4. Email
    await sendDraftEmail(draft, links);
    await logAction(draft.id, 'emailed', { dryRun: isDryRun(), links: { ...links, feedback: '[redacted]' } });
    return NextResponse.json({ ok: true, draftId: draft.id, weekOf });
  } catch (e) {
    await sendAlertEmail('weekly pipeline failed', e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
