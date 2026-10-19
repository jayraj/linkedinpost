import { generateText } from 'ai';
import { LINKEDIN_AUTHOR_PROFILE } from './content-dna';
import type { Topic } from './db';
import { llm } from './llm';

const P = LINKEDIN_AUTHOR_PROFILE;

const SYSTEM = `You write high-performing LinkedIn posts for an executive audience,
in first person as ${P.author.name} (${P.author.role}).

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
- Mentally run this checklist before outputting: ${P.qualityChecklist.join(' | ')}`;

export async function writePost(topic: Topic, feedback?: string): Promise<string> {
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
- Sign-off: ${P.author.name}, ${P.author.role}

Topic for this week's post:
- Title: ${topic.title}
- Why now: ${topic.why}
${feedback ? `\nAuthor feedback on the previous draft (MUST address it):\n${feedback}\n` : ''}
Write the final LinkedIn post now. Output ONLY the post text — no preamble, no quotes, no explanation.`,
  });

  return text.trim();
}
