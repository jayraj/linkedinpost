import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    const { oauthStartUrl } = await import('@/lib/linkedin');
    return NextResponse.redirect(oauthStartUrl());
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? String(e) }, { status: 500 });
  }
}
