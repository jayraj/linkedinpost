import { SignJWT, jwtVerify } from 'jose';
import { env } from './env';

export type TokenAction = 'approve' | 'feedback';

export interface ActionPayload {
  did: string; // draft id
  act: TokenAction;
}

function secret(): Uint8Array {
  return new TextEncoder().encode(env('TOKEN_SECRET'));
}

/** Signs a 7-day action link token (matches drafts.token_expires policy). */
export async function signActionToken(draftId: string, act: TokenAction): Promise<string> {
  return new SignJWT({ did: draftId, act })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(secret());
}

/** Verifies signature + expiry + expected action. Throws on any mismatch. */
export async function verifyActionToken(token: string, act: TokenAction): Promise<ActionPayload> {
  const { payload } = await jwtVerify<ActionPayload>(token, secret());
  if (payload.act !== act) throw new Error('Token action mismatch');
  return { did: payload.did, act: payload.act };
}
