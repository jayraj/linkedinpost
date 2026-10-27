import { generateText } from 'ai';
import { LINKEDIN_AUTHOR_PROFILE } from './content-dna';
import type { Topic } from './db';
import { llm } from './llm';

const P = LINKEDIN_AUTHOR_PROFILE;

const SYSTEM = `You write high-performing LinkedIn posts for an executive audience,
in first person as ${P.author.name} (${P.author.role}).

Revision requests (see "Revision request" below): when the author asks for a different
topic, choose a subject that fits their direction, stays in their content pillars, and is
still relevant to the audience — then write the post. When they give notes, follow them
exactly, but never write about the notes themselves.

Post structure — follow in order:
1. Hook — ${P.framework.hook}
2. Context — ${P.framework.context}
3. Insight — ${P.framework.insight}
4. Takeaway — ${P.framework.takeaway}
5. Closing — ${P.framework.closing}

Rules:
- Length: ${P.writingStyle.wordCount} words, readable in ${P.writingStyle.readingTime}.
- ${P.writingStyle.paragraphs} Line breaks between short paragraphs.
- Tone: ${P.writingStyle.tone} ${P.writingStyle.language}
- Personality: ${P.writingStyle.personality.join(', ')}. Confident, zero corporate filler, no "delve/unlock/leverage" buzzwords.
- Emojis: ${P.writingStyle.emojis}
- ${P.writingStyle.hashtags} Hashtags go at the very end.
- ${P.engagement.defaultEnding}s work best as endings. ${P.engagement.followFrequency}
- Writing rules: ${P.writingRules.join(' | ')}
- Never write: ${P.neverWrite.join(' | ')}
- Never mention that you are AI.
- No sign-off: never include the author's name or job title in the post — LinkedIn already shows the byline.
- Leadership lens: write to heads of engineering. Make the decision, the trade-off, and the organizational consequence explicit. Never sound like a tool tutorial or a practitioner tip.
- Mentally run this checklist before outputting: ${P.qualityChecklist.join(' | ')}`;

/**
 * The kind of revision the author asked for on /feedback.
 * - revise: keep the topic, rewrite the post to address the notes
 * - retopic: keep the author's direction, choose a fresh topic that fits it
 */
export type FeedbackMode = 'revise' | 'retopic';

function feedbackBlock(feedback: string, mode: FeedbackMode): string {
  const instruction =
    mode === 'retopic'
      ? `The author wants a DIFFERENT topic. {FEEDBACK} is their direction, not the post text to rewrite.`
      : `The author's revision notes on the previous draft (MUST address every point): {FEEDBACK}`;

  return `

Revision request — this replaces your normal topic choice:
${instruction.replace('{FEEDBACK}', feedback)}

Rules for a revision:
- Output ONLY the new post text — no preamble, no quotes, no explanation of what you changed.
- Never mention the previous draft, the notes, "feedback", or that anything was rewritten.
- Keep the author's voice, structure, length and rules above unchanged.`;
}

/**
 * A written post plus the subject it actually landed on. `topic` differs from the
 * passed-in topic only for a 'retopic' revision, where the model picks the subject;
 * callers store this back into `chosen_topic` so the DB matches the body.
 */
export interface WrittenPost {
  content: string;
  /** The topic title the post is about — usually the input topic, else the model's choice. */
  title: string;
}

export async function writePost(
  topic: Topic,
  feedback?: string,
  opts: { mode?: FeedbackMode } = {},
): Promise<WrittenPost> {
  const mode = opts.mode ?? 'revise';
  const retopic = Boolean(feedback) && mode === 'retopic';
  const { text } = await generateText({
    model: llm(),
    system: SYSTEM,
    maxRetries: 4, // ride out Gemini "high demand" 503 spikes (default = 2)
    prompt: `Author profile:
- Author: ${P.author.name}, ${P.author.role}
- Positioning: ${P.author.positioning}
- Real experiences (rotate naturally, never invent stories): ${P.experienceBank.join(' | ')}
- Core beliefs (choose ONE per post): ${P.coreBeliefs.join(' | ')}
- AI perspective: ${P.aiPerspective.join(' | ')}
- Content pillars (rotate): ${P.contentPillars.join(' | ')}
- Post types (rotate): ${P.postTypes.join(' | ')}
- Audience: ${[...P.audience.primary, ...P.audience.secondary].join(', ')}
- Reader goals: ${P.audience.readerGoals.join(', ')}
- Closing options (pick one that fits): ${P.engagement.closingOptions.join(' | ')}

${topicBrief(topic)}${feedback ? feedbackBlock(feedback, mode) : ''}${retopic ? `

When you are done, add a final line in exactly this form:
TOPIC: <a short title of the subject you actually wrote about, max 90 characters>` : ''}
Write the final LinkedIn post now. Output ONLY the post text — no preamble, no quotes, no explanation.`,
  });

  return retopic ? splitTopicLine(text) : { content: text.trim(), title: topic.title };
}

/**
 * Splits the trailing `TOPIC: …` marker a retopic revision is asked to emit. If the
 * model omits it (or the title is implausibly long), fall back to the whole reply as
 * the post — better a stale topic label than a truncated post.
 */
function splitTopicLine(text: string): WrittenPost {
  const match = text.match(/\n\s*TOPIC:\s*(.+?)\s*$/i);
  if (!match) return { content: text.trim(), title: '' };
  const title = match[1].replace(/^["'“”]|["'“”]$/g, '').trim();
  const content = text.slice(0, match.index).trim();
  if (!title || title.length > 120 || !content) return { content: text.trim(), title: '' };
  return { content, title };
}

/** Topic framing differs when the author asked for a different subject entirely. */
function topicBrief(topic: Topic): string {
  const lines = [`Topic for this week's post:`, `- Title: ${topic.title}`, `- Why now: ${topic.why}`];
  if (topic.sourceUrl) lines.push(`- Source: ${topic.source} — ${topic.sourceUrl}`);
  return lines.join('\n');
}
