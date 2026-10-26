'use client';

import { useActionState } from 'react';
import { approveAction, type ActionResult } from './actions';

export function ApproveButton({ id, mode, dryRun }: { id: string; mode: 'approve' | 'retry'; dryRun: boolean }) {
  const [state, formAction, pending] = useActionState(approveAction, null);

  const label = pending ? 'Posting…' : mode === 'approve' ? '✓ Approve & post' : '↻ Retry post';
  const warn = dryRun
    ? 'Simulate posting this draft?\n\nDRY_RUN is on — nothing will actually go to LinkedIn.'
    : 'Post this draft to LinkedIn FOR REAL?\n\nThis cannot be undone.';

  return (
    <form action={formAction} onSubmit={(e) => { if (!confirm(warn)) e.preventDefault(); }} className="mt-3">
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        disabled={pending}
        className={
          mode === 'approve'
            ? 'rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:opacity-50'
            : 'rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-amber-700 disabled:opacity-50'
        }
      >
        {label}
      </button>
      {state && !state.ok ? (
        <p className="mt-2 text-sm text-red-600">{state.error}</p>
      ) : null}
    </form>
  );
}
