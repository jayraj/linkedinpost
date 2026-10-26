import { Draft, getDraft, logAction, updateDraft } from './db';
import { isDryRun } from './env';
import { postToLinkedIn } from './linkedin';
import { sendConfirmationEmail } from './email';

export interface ApproveResult {
  ok: boolean;
  code?: 'not_found' | 'conflict';
  error?: string;
  status?: Draft['status'];
  dryRun?: boolean;
}

/**
 * Shared approve -> post -> confirm logic, used by both the signed email link
 * (/api/approve) and the dashboard server action, so the two paths behave identically.
 *
 * - pending            -> mark approved, then post
 * - approved / failed  -> retry the post (only when allowRetry, i.e. the dashboard)
 * - posted / expired   -> refuse
 *
 * If the LinkedIn call throws, the draft is left at 'approved' so it can be retried
 * (postToLinkedIn already logs 'failed' and sends an alert email itself).
 */
export async function approveAndPost(did: string, opts: { allowRetry: boolean }): Promise<ApproveResult> {
  const d = await getDraft(did);
  if (!d) return { ok: false, code: 'not_found', error: 'Draft not found' };

  if (d.status === 'posted') return { ok: false, code: 'conflict', error: 'Already posted', status: d.status };
  if (d.status === 'expired') return { ok: false, code: 'conflict', error: 'Draft expired — no longer approvable', status: d.status };

  if (d.status === 'pending') {
    await updateDraft(did, { status: 'approved' });
    await logAction(did, 'approved', { dryRun: isDryRun() });
  } else {
    // approved | failed
    if (!opts.allowRetry) return { ok: false, code: 'conflict', error: 'Already processed', status: d.status };
    await logAction(did, 'retry_post', { from: d.status, dryRun: isDryRun() });
  }

  await postToLinkedIn(d.content, did);
  await updateDraft(did, { status: 'posted' });
  await sendConfirmationEmail(d, isDryRun());
  return { ok: true, status: 'posted', dryRun: isDryRun() };
}
