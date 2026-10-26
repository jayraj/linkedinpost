import { getDraft, logAction, updateDraft, type Draft, type Topic } from './db';
import { buildLinks, sendDraftEmail, sendFeedbackAckEmail } from './email';
import { signActionToken } from './tokens';
import { writePost, type FeedbackMode } from './writer';

/** Long enough to say what's wrong, short enough to stay out of the prompt budget. */
export const MAX_FEEDBACK_CHARS = 1200;

export interface RevisionResult {
  ok: boolean;
  error?: string;
  draft?: Draft;
  /** The topic the rewrite ended up using (a re-scout may pick a different one). */
  topic?: Topic;
}

/**
 * Applies author feedback to a draft: rewrite (same topic) or re-topic (authors'
 * direction -> a different subject), then email the new version with fresh links.
 *
 * Used by the /feedback form and by /api/pick (which is a re-topic with a fixed
 * direction: one of the three scouted topics).
 *
 * Status is always normalised back to 'pending' so a stale approve token can't
 * publish text the author never saw.
 */
export async function applyRevision(
  did: string,
  feedback: string,
  mode: FeedbackMode,
): Promise<RevisionResult> {
  const notes = feedback.trim();
  if (!notes) return { ok: false, error: 'Please describe what to change.' };
  if (notes.length > MAX_FEEDBACK_CHARS) {
    return { ok: false, error: `Feedback is too long (max ${MAX_FEEDBACK_CHARS} characters).` };
  }

  const d = await getDraft(did);
  if (!d) return { ok: false, error: 'Draft not found — it may have been deleted.' };
  if (d.status === 'posted') {
    return { ok: false, error: 'This draft was already posted — nothing left to revise.' };
  }

  const topic = pickTopic(d, mode, notes);
  const written = await writePost(topic, notes, { mode });

  // A retopic lets the model name the subject it chose (TOPIC: line); once we know it,
  // prefer that name so the stored topic matches the body the author actually reads.
  const title = written.title || topic.title;
  const content = written.content;
  const full = { ...topic, title };

  await updateDraft(did, { content, chosenTopic: title, status: 'pending' });

  const approve = await signActionToken(did, 'approve');
  const feedbackToken = await signActionToken(did, 'feedback');
  const revise = await signActionToken(did, 'revise');
  const next = { ...d, content, chosen_topic: title, status: 'pending' as const };
  const links = await buildLinks(next, { approve, feedback: feedbackToken, revise });
  const updated = { ...next, chosenTopic: title, content } as Draft;

  if (mode === 'retopic') await sendDraftEmail(updated, links);
  else await sendFeedbackAckEmail(updated, links);

  await logAction(did, 'feedback', {
    mode,
    dryRun: process.env.DRY_RUN !== 'false',
    topic: title,
    notesLength: notes.length,
  });

  return { ok: true, draft: updated, topic: full };
}

/**
 * 'revise' keeps the subject the draft is currently on. 'retopic' reuses one of the
 * scouted topics when the notes clearly reference it, otherwise the model picks a
 * fresh subject from the author's direction.
 *
 * Note the `chosen_topic` fallback: after a retopic the stored title is the model's
 * own subject, not one of the three scouted titles, so matching against `topics` can
 * miss. Falling back to `chosen_topic` (not `topics[0]`) keeps a later revise on the
 * subject the author last saw instead of silently reverting to the first suggestion.
 */
function pickTopic(d: Draft, mode: FeedbackMode, notes: string): Topic {
  const current: Topic = d.topics.find((t) => t.title === d.chosen_topic) ?? {
    title: d.chosen_topic,
    why: d.topics[0]?.why ?? '',
    source: '',
    sourceUrl: '',
  };

  if (mode !== 'retopic') return current;

  const wanted = mentionedTopic(d.topics, notes);
  if (wanted) return wanted;

  const direction = notes.match(/(?:about|on|regarding|topic|covering)\s+([^.!?\n]{3,80})/i)?.[1];
  return {
    title: d.chosen_topic,
    why: direction
      ? `The author asked for a different topic: ${direction.trim()}.`
      : `The author rejected the previous topic and asked for a different one.`,
    source: '',
    sourceUrl: '',
  };
}

/** Exact "topic #2" style references first, then a loose title-word match. */
function mentionedTopic(topics: Topic[], notes: string): Topic | undefined {
  const byNumber = notes.match(/topic\s*#?\s*(\d+)/i);
  if (byNumber) {
    const idx = parseInt(byNumber[1], 10) - 1;
    if (idx >= 0 && idx < topics.length) return topics[idx];
  }

  const lower = notes.toLowerCase();
  return topics.find((t) => {
    const words = t.title.toLowerCase().split(/\W+/).filter((w) => w.length > 4);
    if (!words.length) return false;
    const hits = words.filter((w) => lower.includes(w)).length;
    return hits >= Math.min(3, Math.ceil(words.length / 2));
  });
}
