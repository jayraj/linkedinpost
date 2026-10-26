'use server';

import { applyRevision, MAX_FEEDBACK_CHARS } from '@/lib/revision';
import { signActionToken, verifyActionToken } from '@/lib/tokens';
import type { FeedbackMode } from '@/lib/writer';

export interface FeedbackState {
  ok: boolean;
  error?: string;
  post?: string;
  topic?: string;
  /** Freshly signed token for another round (the submitted one is already spent). */
  nextToken?: string;
}

/**
 * Signed-link revision. The token in the URL is the authorization — it is verified
 * server-side on every submit (the client only ever passes it back verbatim), so a
 * forged request cannot touch a draft it has no token for.
 */
export async function reviseAction(_prev: FeedbackState | null, formData: FormData): Promise<FeedbackState> {
  const token = String(formData.get('token') ?? '');
  const rawMode = String(formData.get('mode') ?? 'revise');
  const mode: FeedbackMode = rawMode === 'retopic' ? 'retopic' : 'revise';

  if (!token) return { ok: false, error: 'Missing token — use the link from your email.' };

  let did: string;
  try {
    ({ did } = await verifySubmittedToken(token));
  } catch (e) {
    return { ok: false, error: `Invalid or expired link (${String(e)}). Ask for a fresh draft email.` };
  }
  const notes = String(formData.get('feedback') ?? '').trim();
  if (!notes) return { ok: false, error: 'Please describe what to change.' };
  if (notes.length > MAX_FEEDBACK_CHARS) {
    return { ok: false, error: `Too long — keep it under ${MAX_FEEDBACK_CHARS} characters.` };
  }

  try {
    const result = await applyRevision(did, notes, mode);
    if (!result.ok) return { ok: false, error: result.error };

    // Rotate: the submitted token is single-use in spirit — after a successful
    // revision the page hands the author the freshly signed one for the next round.
    const nextToken = await signActionToken(did, 'revise');
    return { ok: true, post: result.draft?.content, topic: result.topic?.title, nextToken };
  } catch (e) {
    return { ok: false, error: `Revision failed: ${e instanceof Error ? e.message : String(e)}` };
  }
}

/** Verifies the submitted token and returns the draft id it authorizes. */
export async function verifySubmittedToken(token: string): Promise<{ did: string }> {
  try {
    return await verifyActionToken(token, 'revise');
  } catch {
    return await verifyActionToken(token, 'feedback');
  }
}
