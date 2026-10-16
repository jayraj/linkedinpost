import { NextRequest, NextResponse } from 'next/server';
import { db, logAction } from '@/lib/db';
import { sendAlertEmail, sendExpiryEmail } from '@/lib/email';
import { isDryRun } from '@/lib/env';
import { tokenDaysLeft } from '@/lib/linkedin';

function rows<T extends Record<string, unknown>>(r: any): T[] {
  return r?.rows ?? (Array.isArray(r) ? r : []);
}

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get('authorization');
    if (auth !== `Bearer ${secret}`) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const nowIso = new Date().toISOString();
  const res = await db()`SELECT id, chosen_topic, content FROM drafts WHERE status='pending' AND token_expires < ${nowIso}`;
  const pending = rows<any>(res);
  for (const r of pending) {
    await db()`UPDATE drafts SET status='expired', updated_at=now() WHERE id=${r.id}`;
    await logAction(r.id, 'expired', { reason: 'token_expired' });
    try { await sendExpiryEmail({ ...r, chosenTopic: r.chosen_topic, chosen_topic: r.chosen_topic } as any); }
    catch (e) { await sendAlertEmail('expiry email failed', e); }
  }
  try {
    const days = await tokenDaysLeft();
    if (days > 0 && days <= 14) {
      if (!(await (await import('@/lib/db')).hasRecentLog('token_warning', 168))) {
        await sendTokenExpiryWarning(days);
        await logAction(null, 'token_warning', { days });
      }
    }
  } catch (e) { console.warn('token check failed:', e); }
  return NextResponse.json({ ok: true, expired: pending.length, dryRun: isDryRun() });
}

async function sendTokenExpiryWarning(days: number) {
  await (await import('@/lib/email')).sendTokenExpiryWarning(days);
}
