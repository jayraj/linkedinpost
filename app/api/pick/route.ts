import { NextRequest, NextResponse } from 'next/server';
import { getDraft, logAction, updateDraft, type Draft } from '@/lib/db';
import { verifyActionToken, signActionToken } from '@/lib/tokens';
import { buildLinks, sendDraftEmail } from '@/lib/email';
import { writePost } from '@/lib/writer';
import { generatePostImage, postHook } from '@/lib/image';
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
    // Regenerate the image so it matches the swapped topic (never fatal)
    const image = await generatePostImage(topic.title, postHook(content, topic.title));
    const imgState = image
      ? { data: image.base64, mime: image.mimeType, status: 'generated' }
      : { data: null, mime: null, status: 'failed' };
    await updateDraft(did, { content, chosenTopic: topic.title, status: 'pending', image: imgState });
    const approve = await signActionToken(did, 'approve');
    const feedback = await signActionToken(did, 'feedback');
    const fresh: Draft = { ...d, content, chosen_topic: topic.title, image_data: imgState.data, image_mime: imgState.mime, image_status: imgState.status };
    const links = await buildLinks(fresh, { approve, feedback });
    await sendDraftEmail(fresh, links);
    await logAction(did, 'feedback', { picked: n, dryRun: isDryRun(), image: imgState.status });
    return NextResponse.redirect(new URL('/thanks?swapped=1', process.env.BASE_URL || 'http://localhost:3000'));
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 403 });
  }
}
