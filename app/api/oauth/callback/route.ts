import { NextRequest, NextResponse } from 'next/server';
import { exchangeCode } from '@/lib/linkedin';
import { baseUrl } from '@/lib/env';

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code');
  const state = req.nextUrl.searchParams.get('state');
  if (!code || state !== 'agile-post-agent') {
    return NextResponse.json({ error: 'Bad OAuth callback' }, { status: 400 });
  }
  try {
    await exchangeCode(code);
    return NextResponse.redirect(new URL('/thanks?oauth=1', baseUrl()));
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
