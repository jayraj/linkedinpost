import { NextRequest, NextResponse } from 'next/server';
import { verifyActionToken } from '@/lib/tokens';
import { applyRevision } from '@/lib/revision';
import { baseUrl } from '@/lib/env';

/**
 * One-tap topic swap from the weekly email: `/api/pick?token=…&n=2`.
 * n indexes the scouted topics (1-3), so n=2/3 means "write topic #2/#3 instead".
 * The rewrite + email live in applyRevision so this and /feedback stay identical.
 */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');
  const n = parseInt(req.nextUrl.searchParams.get('n') || '2', 10);
  if (!token) return NextResponse.json({ error: 'Missing token' }, { status: 400 });
  if (!Number.isFinite(n) || n < 1 || n > 3) {
    return NextResponse.json({ error: 'n must be 1, 2 or 3' }, { status: 400 });
  }

  try {
    const { did } = await verifyActionToken(token, 'feedback');
    const result = await applyRevision(did, `User wants topic #${n}`, 'retopic');
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 409 });
    return NextResponse.redirect(new URL('/thanks?swapped=1', baseUrl()));
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 403 });
  }
}
