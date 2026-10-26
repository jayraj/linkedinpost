import { Suspense } from 'react';
import { listDrafts, type Draft } from '@/lib/db';
import { isDryRun } from '@/lib/env';
import { ApproveButton } from './approve-button';

const STATUS_BADGE: Record<Draft['status'], string> = {
  pending: 'bg-amber-100 text-amber-800 border-amber-300',
  approved: 'bg-blue-100 text-blue-800 border-blue-300',
  posted: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  expired: 'bg-zinc-100 text-zinc-600 border-zinc-300',
  failed: 'bg-red-100 text-red-800 border-red-300',
};

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}
function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export default function Dashboard() {
  const dryRun = isDryRun();
  return (
    <main className="min-h-screen bg-zinc-50 px-6 py-10 font-sans text-zinc-900 dark:bg-black dark:text-zinc-100">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-2xl font-bold">Agile Post Agent · Dashboard</h1>

        <div
          className={
            'mt-4 rounded-lg border px-4 py-3 text-sm font-medium ' +
            (dryRun
              ? 'border-amber-300 bg-amber-50 text-amber-900'
              : 'border-emerald-300 bg-emerald-50 text-emerald-900')
          }
        >
          {dryRun
            ? 'DRY RUN — approve buttons only simulate posting; nothing goes to LinkedIn.'
            : 'LIVE — approve buttons post to LinkedIn for real.'}
        </div>

        <Suspense fallback={<p className="mt-8 text-zinc-500">Loading drafts…</p>}>
          <DraftList dryRun={dryRun} />
        </Suspense>
      </div>
    </main>
  );
}

async function DraftList({ dryRun }: { dryRun: boolean }) {
  const drafts = await listDrafts();

  if (!drafts.length) {
    return <p className="mt-8 text-zinc-500">No drafts yet — the first one arrives with Monday&apos;s cron run.</p>;
  }

  return (
    <div className="mt-6 flex flex-col gap-4">
      <p className="text-sm text-zinc-500">{drafts.length} draft{drafts.length === 1 ? '' : 's'}, newest first</p>
      {drafts.map((d) => {
        const mode: 'approve' | 'retry' | null =
          d.status === 'pending' ? 'approve' : d.status === 'approved' || d.status === 'failed' ? 'retry' : null;
        return (
          <article
            key={d.id}
            className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950"
          >
            <div className="flex flex-wrap items-center gap-3">
              <span className={'rounded-full border px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide ' + STATUS_BADGE[d.status]}>
                {d.status}
              </span>
              <h2 className="text-base font-semibold">Week of {fmtDate(d.week_of)}</h2>
            </div>

            <p className="mt-1 text-xs text-zinc-500">
              drafted {fmtDateTime(d.created_at)} · updated {fmtDateTime(d.updated_at)}
            </p>

            <p className="mt-3 font-medium">{d.chosen_topic}</p>

            <details className="mt-2">
              <summary className="cursor-pointer text-sm text-zinc-500 select-none">
                Post text ({d.content.length} characters)
              </summary>
              <pre className="mt-2 whitespace-pre-wrap rounded-lg bg-zinc-50 p-3 font-sans text-sm text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
                {d.content}
              </pre>
            </details>

            {mode ? <ApproveButton id={d.id} mode={mode} dryRun={dryRun} /> : null}
          </article>
        );
      })}
    </div>
  );
}
