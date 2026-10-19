import { NextRequest, NextResponse } from 'next/server';
import { getDraft, logAction, updateDraft } from '@/lib/db';
import { verifyActionToken } from '@/lib/tokens';
import { sendConfirmationEmail } from '@/lib/email';
import { isDryRun } from '@/lib/env';
import { postToLinkedIn } from '@/lib/linkedin';

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');
  if (!token) return NextResponse.json({ error: 'Missing token' }, { status: 400 });

  try {
    const { did } = await verifyActionToken(token, 'approve');
    const d = await getDraft(did);
    if (!d) return NextResponse.json({ error: 'Draft not found' }, { status: 404 });
    if (d.status !== 'pending') {
      return NextResponse.json({ error: 'Already processed', status: d.status }, { status: 409 });
    }

    await updateDraft(did, { status: 'approved' });
    await logAction(did, 'approved', { dryRun: isDryRun() });
    await postToLinkedIn(d.content, did);
    await updateDraft(did, { status: 'posted' });
    await sendConfirmationEmail(d, isDryRun());
    return NextResponse.redirect(new URL('/thanks', baseRedirect()));
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 403 });
  }
}

function baseRedirect() {
  return process.env.BASE_URL || 'http://localhost:3000';
}
