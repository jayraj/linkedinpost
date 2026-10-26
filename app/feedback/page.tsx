import Link from 'next/link';
import { getDraft } from '@/lib/db';
import { isDryRun } from '@/lib/env';
import { verifySubmittedToken } from './actions';
import { FeedbackForm } from './form';

export const metadata = { title: 'Revise your draft · Agile Post Agent' };

// Signed-link page: the token comes from the URL and the draft from the DB, so
// there is no meaningful static shell to prerender. Opt out of instant-navigation
// validation and let the route block on the server (see docs: instant = false).
export const instant = false;

/**
 * Signed-link page for giving feedback: rewrite the current topic, or ask for a
 * different one. Reached from "✏️ Give feedback / pick another topic" in the email,
 * or directly via /feedback?token=… (same token as /api/pick).
 *
 * Motion, not mutation: all writes happen in the server action after the token is
 * re-verified.
 */
export default async function FeedbackPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; mode?: string }>;
}) {
  const { token, mode } = await searchParams;
  const startMode: 'revise' | 'retopic' = mode === 'retopic' ? 'retopic' : 'revise';

  const shell = (children: React.ReactNode) => (
    <main className="min-h-screen bg-zinc-50 px-5 py-10 text-zinc-900 dark:bg-black dark:text-zinc-100">
      <div className="mx-auto max-w-2xl">{children}</div>
    </main>
  );

  if (!token) {
    return shell(
      <>
        <h1 className="text-2xl font-bold">Revision link needed</h1>
        <p className="mt-3 text-zinc-600 dark:text-zinc-400">
          Open the “✏️ Give feedback” button in your latest draft email — the link carries a signed
          token that authorizes changes to that draft.
        </p>
      </>,
    );
  }

  let did: string;
  try {
    ({ did } = await verifySubmittedToken(token));
  } catch {
    return shell(
      <>
        <h1 className="text-2xl font-bold">This link no longer works</h1>
        <p className="mt-3 text-zinc-600 dark:text-zinc-400">
          It may have expired (links are good for 7 days) or been replaced by a newer draft email.
          The next Monday cycle will send a fresh one.
        </p>
      </>,
    );
  }

  const draft = await getDraft(did);
  if (!draft) {
    return shell(
      <>
        <h1 className="text-2xl font-bold">Draft not found</h1>
        <p className="mt-3 text-zinc-600 dark:text-zinc-400">This draft no longer exists in the database.</p>
      </>,
    );
  }

  const closed = draft.status === 'posted' || draft.status === 'expired';

  return shell(
    <>
      <h1 className="text-2xl font-bold">Revise this draft</h1>
      <p className="mt-2 text-sm text-zinc-500">
        {draft.status === 'posted'
          ? 'Already posted — revisions are closed for this draft.'
          : `Draft ${draft.id.slice(0, 8)} · ${draft.chosen_topic}`}
      </p>

      {isDryRun() ? (
        <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          DRY RUN — approving from this session only simulates posting.
        </div>
      ) : null}

      {closed ? (
        <div className="mt-6 rounded-lg border border-zinc-300 bg-white p-5 dark:border-zinc-700 dark:bg-zinc-950">
          <p className="text-zinc-600 dark:text-zinc-400">
            {draft.status === 'posted'
              ? 'This draft has been published to LinkedIn, so it can no longer be revised.'
              : 'This draft expired before approval, so it can no longer be revised.'}
          </p>
          <p className="mt-3">
            <Link href="/dashboard" className="text-blue-600 underline">
              Open the dashboard
            </Link>
          </p>
        </div>
      ) : (
        <>
          <section className="mt-6 rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Current draft</h2>
            <pre className="mt-3 whitespace-pre-wrap font-sans text-sm text-zinc-700 dark:text-zinc-300">
              {draft.content}
            </pre>
          </section>

          <FeedbackForm token={token} startMode={startMode} topics={draft.topics.map((t) => `#${t.title}`)} />
        </>
      )}
    </>,
  );
}
