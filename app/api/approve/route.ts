import { NextRequest, NextResponse } from 'next/server';
import { getDraft, logAction, updateDraft } from '@/lib/db';
import { verifyActionToken } from '@/lib/tokens';
import { sendConfirmationEmail } from '@/lib/email';
import { isDryRun } from '@/lib/env';
import { postToLinkedIn } from '@/lib/linkedin';

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');
  if (!token) return NextResponse.json({ error: 'Missing token' }, { status: 400 });

  let did: string | null = null;
  try {
    ({ did } = await verifyActionToken(token, 'approve'));
    const d = await getDraft(did);
    if (!d) return NextResponse.json({ error: 'Draft not found' }, { status: 404 });
    // pending = fresh approval; approved = retry after a failed post attempt.
    // Anything else (posted/expired/failed) is final.
    if (d.status !== 'pending' && d.status !== 'approved') {
      return NextResponse.json({ error: 'Already processed', status: d.status }, { status: 409 });
    }
    if (d.status === 'pending') {
      await updateDraft(did, { status: 'approved' });
      await logAction(did, 'approved', { dryRun: isDryRun() });
    } else {
      await logAction(did, 'approve_retry', { dryRun: isDryRun() });
    }

    const image = d.image_data && d.image_status === 'generated'
      ? { base64: d.image_data, mimeType: d.image_mime || 'image/png' }
      : null;
    await postToLinkedIn(d.content, did, { image, altText: d.chosen_topic });
    await updateDraft(did, { status: 'posted' });
    await sendConfirmationEmail(d, isDryRun());
    return NextResponse.redirect(new URL('/thanks', baseRedirect()));
  } catch (e) {
    // Stays 'approved' — the same link can be re-opened to retry (approve_retry).
    if (did) await logAction(did, 'failed', { stage: 'approve', error: String(e) }).catch(() => {});
    return NextResponse.json(
      { error: String(e), hint: 'Nothing was published — re-open the same approval link to retry.' },
      { status: 403 },
    );
  }
}

function baseRedirect() {
  return process.env.BASE_URL || 'http://localhost:3000';
}
