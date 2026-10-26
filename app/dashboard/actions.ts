'use server';

import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { approveAndPost } from '@/lib/approve';

export interface ActionResult {
  ok: boolean;
  error?: string;
}

/**
 * Dashboard "Approve & post" / "Retry post". Posts to /dashboard, so it is already
 * behind the proxy basic-auth; re-checked here per Server Function security guidance.
 */
export async function approveAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  if (!(await isDashboardAuthorized())) return { ok: false, error: 'Unauthorized' };

  const id = String(formData.get('id') ?? '');
  if (!id) return { ok: false, error: 'Missing draft id' };

  try {
    const result = await approveAndPost(id, { allowRetry: true });
    revalidatePath('/dashboard');
    return result.ok ? { ok: true } : { ok: false, error: result.error };
  } catch (e) {
    // Post attempt failed (already logged + alert email sent); status is left at
    // 'approved' so a Retry button appears after the refresh below.
    revalidatePath('/dashboard');
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Mirrors proxy.ts: allowed when creds are unset (local dev), else require Basic auth. */
async function isDashboardAuthorized(): Promise<boolean> {
  const user = process.env.DASHBOARD_USER;
  const pass = process.env.DASHBOARD_PASSWORD;
  if (!user || !pass) return true;
  const h = await headers();
  return h.get('authorization') === 'Basic ' + btoa(`${user}:${pass}`);
}
