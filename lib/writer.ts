import { generateText } from 'ai';
import { CONTENT_DNA } from './content-dna';
import type { Topic } from './db';
import { llm } from './llm';

const SYSTEM = `You write high-performing LinkedIn posts for an executive audience.
Rules:
- ~150 words total (HARD cap 160). Short lines. Line breaks between short paragraphs.
- Structure: [scroll-stopping hook in line 1] → [personal story with concrete specifics] →
  [insight anchored in the chosen opinion] → [one clear CTA].
- Tone: confident, plain English, zero corporate filler, no "delve/unlock/leverage" buzzwords.
- Max 3 hashtags at the very end. No emojis except at most one in the hook.
- Never mention that you are AI. Write in first person as the author.
- The [TBD] markers from the author profile must be woven in literally as written if not yet replaced.`;

export async function writePost(topic: Topic, feedback?: string): Promise<string> {
  const { text } = await generateText({
    model: llm(),
    system: SYSTEM,
    maxRetries: 4, // ride out Gemini "high demand" 503 spikes (default = 2)
    prompt: `Author profile (content DNA):
- Personal story: ${CONTENT_DNA.personalStory}
- Service to promote: ${CONTENT_DNA.service.name} — ${CONTENT_DNA.service.blurb} (CTA link: ${CONTENT_DNA.service.ctaUrl})
- Signature opinion: ${CONTENT_DNA.signatureOpinion}
- Sign-off: ${CONTENT_DNA.signOff.name}, ${CONTENT_DNA.signOff.title}
- Audience: ${CONTENT_DNA.audience}
- Tone: ${CONTENT_DNA.tone}

Topic for this week's post:
- Title: ${topic.title}
- Why now: ${topic.why}
${feedback ? `\nAuthor feedback on the previous draft (MUST address it):\n${feedback}\n` : ''}
Write the final LinkedIn post now. Output ONLY the post text — no preamble, no quotes, no explanation.`,
  });

  return text.trim();
}
