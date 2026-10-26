import { NextRequest, NextResponse } from 'next/server';
import { approveAndPost } from '@/lib/approve';
import { verifyActionToken } from '@/lib/tokens';

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');
  if (!token) return NextResponse.json({ error: 'Missing token' }, { status: 400 });

  try {
    const { did } = await verifyActionToken(token, 'approve');
    const result = await approveAndPost(did, { allowRetry: false });
    if (!result.ok) {
      return NextResponse.json({ error: result.error, status: result.status }, { status: result.code === 'not_found' ? 404 : 409 });
    }
    return NextResponse.redirect(new URL('/thanks', baseRedirect()));
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 403 });
  }
}

function baseRedirect() {
  return process.env.BASE_URL || 'http://localhost:3000';
}
