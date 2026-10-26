'use client';

import { useActionState, useState } from 'react';
import Link from 'next/link';
import { reviseAction, type FeedbackState } from './actions';

/**
 * Feedback form. No token input is shown: the signed token travels in a hidden
 * field and the server re-verifies it on submit.
 */
export function FeedbackForm({
  token,
  startMode,
  topics,
}: {
  token: string;
  startMode: 'revise' | 'retopic';
  topics: string[];
}) {
  const [state, formAction, pending] = useActionState<FeedbackState | null, FormData>(reviseAction, null);
  const [mode, setMode] = useState<'revise' | 'retopic'>(startMode);
  const [notes, setNotes] = useState('');

  if (state?.ok) {
    return (
      <section className="mt-6 rounded-xl border border-emerald-300 bg-emerald-50 p-5 text-emerald-900">
        <h2 className="text-base font-semibold">✅ New draft on its way</h2>
        <p className="mt-2 text-sm">
          I rewrote <strong>{state.topic}</strong> to match your notes and emailed it to you. Nothing is
          posted until you approve that version — the buttons in earlier emails are now stale.
        </p>
        <details className="mt-4">
          <summary className="cursor-pointer text-sm font-medium">Preview what was sent</summary>
          <pre className="mt-2 whitespace-pre-wrap rounded-lg bg-white p-3 font-sans text-sm text-zinc-700">
            {state.post}
          </pre>
        </details>
        <p className="mt-4 text-sm">
          <Link href="/dashboard" className="underline">
            Open the dashboard
          </Link>
        </p>
      </section>
    );
  }

  return (
    <form action={formAction} className="mt-6 rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="mode" value={mode} />

      <fieldset disabled={pending} className="flex flex-col gap-2">
        <legend className="text-sm font-semibold uppercase tracking-wide text-zinc-500">What should change?</legend>

        <label className="flex items-start gap-3 rounded-lg border border-zinc-200 p-3 text-sm dark:border-zinc-800">
          <input
            type="radio"
            name="mode_pick"
            checked={mode === 'revise'}
            onChange={() => setMode('revise')}
            className="mt-1"
          />
          <span>
            <strong>Rewrite this post</strong>
            <span className="block text-zinc-500">
              Same topic, keep the notes in mind — tone, length, angle, story, takeaway.
            </span>
          </span>
        </label>

        <label className="flex items-start gap-3 rounded-lg border border-zinc-200 p-3 text-sm dark:border-zinc-800">
          <input
            type="radio"
            name="mode_pick"
            checked={mode === 'retopic'}
            onChange={() => setMode('retopic')}
            className="mt-1"
          />
          <span>
            <strong>Pick a different topic</strong>
            <span className="block text-zinc-500">
              Tell me the subject you want, or name one of the scouted ones.
            </span>
          </span>
        </label>
      </fieldset>

      <p className="mt-4 text-sm text-zinc-500">
        {mode === 'revise'
          ? 'Examples: “cut it to 150 words”, “the hook is weak — start with the failed sprint”, “drop the Agile ceremony bit”, “end with a question about estimation”.'
          : 'Examples: “write about estimation instead”, “something on technical debt”, “topic #2 but without the AI angle”.'}
      </p>

      <label htmlFor="feedback" className="mt-4 block text-sm font-medium">
        Your notes
      </label>
      <textarea
        id="feedback"
        name="feedback"
        rows={5}
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        maxLength={1200}
        disabled={pending}
        placeholder={mode === 'revise' ? 'What should I change?' : 'Which topic do you want instead?'}
        className="mt-2 w-full rounded-lg border border-zinc-300 bg-white p-3 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
      />
      <p className="mt-1 text-xs text-zinc-500">{notes.length}/1200 characters</p>

      {topics.length ? (
        <p className="mt-2 text-xs text-zinc-500">Scouted topics: {topics.join(' · ')}</p>
      ) : null}

      <button
        type="submit"
        disabled={pending || !notes.trim()}
        className="mt-4 rounded-lg bg-zinc-800 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50"
      >
        {pending ? 'Rewriting…' : mode === 'revise' ? 'Revise draft' : 'Ask for a new topic'}
      </button>
      {pending ? <p className="mt-2 text-xs text-zinc-500">Writing can take 20–60 seconds.</p> : null}
      {state && !state.ok && state.error ? <p className="mt-3 text-sm text-red-600">{state.error}</p> : null}
    </form>
  );
}
