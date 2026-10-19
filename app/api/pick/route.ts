import { NextRequest, NextResponse } from 'next/server';
import { getDraft, logAction, updateDraft } from '@/lib/db';
import { verifyActionToken, signActionToken } from '@/lib/tokens';
import { buildLinks, sendDraftEmail } from '@/lib/email';
import { writePost } from '@/lib/writer';
import { isDryRun } from '@/lib/env';

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');
  const n = parseInt(req.nextUrl.searchParams.get('n') || '2', 10);
  if (!token) return NextResponse.json({ error: 'Missing token' }, { status: 400 });
  try {
    const { did } = await verifyActionToken(token, 'feedback');
    const d = await getDraft(did);
    if (!d) return NextResponse.json({ error: 'Draft not found' }, { status: 404 });
    const topic = d.topics[Math.min(Math.max(n-1,0), d.topics.length-1)];
    const content = await writePost(topic, `User wants topic #${n}: ${topic.title}`);
    await updateDraft(did, { content, chosenTopic: topic.title, status: 'pending' });
    const approve = await signActionToken(did, 'approve');
    const feedback = await signActionToken(did, 'feedback');
    const links = await buildLinks({ ...d, content, chosen_topic: topic.title }, { approve, feedback });
    await sendDraftEmail({ ...d, content, chosen_topic: topic.title, chosenTopic: topic.title } as any, links);
    await logAction(did, 'feedback', { picked: n, dryRun: isDryRun() });
    return NextResponse.redirect(new URL('/thanks?swapped=1', process.env.BASE_URL || 'http://localhost:3000'));
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 403 });
  }
}
