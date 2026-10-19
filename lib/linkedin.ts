import { db, logAction } from './db';
import { baseUrl, env, isDryRun } from './env';
import { sendAlertEmail } from './email';

const API = 'https://api.linkedin.com';
const TOKEN_URL = `${API}/oauth/v2/accessToken`;
const AUTH_URL = `${API}/oauth/v2/authorization`;

interface TokenSet {
  accessToken: string;
  refreshToken?: string;
  expiresAt: Date;
  personUrn: string;
}

function rows<T extends Record<string, unknown>>(r: any): T[] {
  return r?.rows ?? (Array.isArray(r) ? r : []);
}

async function getTokens(): Promise<TokenSet> {
  const res = await db()`SELECT * FROM linkedin_tokens WHERE id=1`;
  const r = rows<any>(res);
  if (r.length) {
    const x = r[0];
    return {
      accessToken: String(x.access_token),
      refreshToken: x.refresh_token ? String(x.refresh_token) : undefined,
      expiresAt: new Date(String(x.expires_at)),
      personUrn: String(x.person_urn),
    };
  }
  return {
    accessToken: env('LINKEDIN_ACCESS_TOKEN'),
    refreshToken: process.env.LINKEDIN_REFRESH_TOKEN || undefined,
    expiresAt: new Date(process.env.LINKEDIN_TOKEN_EXPIRES_AT || Date.now()),
    personUrn: env('LINKEDIN_PERSON_URN'),
  };
}

async function persistTokens(t: TokenSet): Promise<void> {
  await db()`INSERT INTO linkedin_tokens (id,access_token,refresh_token,expires_at,person_urn,updated_at) VALUES (1,${t.accessToken},${t.refreshToken??null},${t.expiresAt.toISOString()},${t.personUrn},now()) ON CONFLICT (id) DO UPDATE SET access_token=EXCLUDED.access_token, refresh_token=COALESCE(EXCLUDED.refresh_token,linkedin_tokens.refresh_token), expires_at=EXCLUDED.expires_at, person_urn=EXCLUDED.person_urn, updated_at=now()`;
}

async function validAccessToken(): Promise<string> {
  const t = await getTokens();
  if (t.expiresAt.getTime() - Date.now() > 5*60*1000) return t.accessToken;
  if (!t.refreshToken) throw new Error('Token expired and no refresh_token — re-auth /api/oauth/start');
  const clientId = env('LINKEDIN_CLIENT_ID');
  const clientSecret = env('LINKEDIN_CLIENT_SECRET');
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: t.refreshToken, client_id: clientId, client_secret: clientSecret }),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`LinkedIn refresh failed (${res.status}): ${await res.text()}`);
  const data = (await res.json()) as any;
  const next: TokenSet = { accessToken: data.access_token, refreshToken: data.refresh_token ?? t.refreshToken, expiresAt: new Date(Date.now()+data.expires_in*1000), personUrn: t.personUrn };
  await persistTokens(next);
  return next.accessToken;
}

export async function tokenDaysLeft(): Promise<number> {
  const t = await getTokens();
  return Math.floor((t.expiresAt.getTime()-Date.now())/86400000);
}

export async function postToLinkedIn(content: string, draftId: string): Promise<{ posted: boolean; id?: string }> {
  if (isDryRun()) { await logAction(draftId,'dry_run',{contentLength: content.length}); return { posted: false }; }
  const token = await validAccessToken();
  const personUrn = (await getTokens()).personUrn;
  const version = env('LINKEDIN_API_VERSION','202506');
  const res = await fetch(`${API}/rest/posts`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'LinkedIn-Version': version, 'X-Restli-Protocol-Version': '2.0.0', 'Content-Type': 'application/json' },
    body: JSON.stringify({ author: personUrn, commentary: content, visibility: 'PUBLIC', distribution: { feedDistribution: 'MAIN_FEED', targetEntities: [], thirdPartyDistributionChannels: [] }, lifecycleState: 'PUBLISHED', isReshareDisabledByAuthor: false }),
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) { const body = await res.text(); await logAction(draftId,'failed',{status: res.status, body}); await sendAlertEmail(`LinkedIn post failed (${res.status})`, new Error(body)); throw new Error(`LinkedIn API ${res.status}: ${body}`); }
  const id = res.headers.get('x-restli-id') ?? undefined;
  await logAction(draftId,'posted',{id}); return { posted: true, id };
}

export function oauthStartUrl(): string {
  const params = new URLSearchParams({ response_type: 'code', client_id: env('LINKEDIN_CLIENT_ID'), redirect_uri: `${baseUrl()}/api/oauth/callback`, scope: 'openid profile w_member_social', state: 'agile-post-agent' });
  return `${AUTH_URL}?${params}`;
}

export async function exchangeCode(code: string): Promise<void> {
  const res = await fetch(TOKEN_URL, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'authorization_code', code, client_id: env('LINKEDIN_CLIENT_ID'), client_secret: env('LINKEDIN_CLIENT_SECRET'), redirect_uri: `${baseUrl()}/api/oauth/callback` }),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`OAuth exchange failed (${res.status}): ${await res.text()}`);
  const data = (await res.json()) as any;
  let personUrn = process.env.LINKEDIN_PERSON_URN ?? '';
  if (data.id_token) { try { const claims = JSON.parse(Buffer.from(data.id_token.split('.')[1],'base64url').toString()); if (claims.sub) personUrn = `urn:li:person:${claims.sub}`; } catch {} }
  if (!personUrn) throw new Error('No person URN — set LINKEDIN_PERSON_URN');
  await persistTokens({ accessToken: data.access_token, refreshToken: data.refresh_token, expiresAt: new Date(Date.now()+data.expires_in*1000), personUrn });
  await logAction(null,'oauth_connected',{personUrn});
}
