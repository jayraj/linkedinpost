import { generateText, stepCountIs, tool } from 'ai';
import { z } from 'zod';
import type { Topic } from './db';
import { llm } from './llm';
import { webSearch } from './search';

const SYSTEM = `You are an Agile trend scout for a LinkedIn thought-leadership account aimed at executives.
You autonomously research what's trending RIGHT NOW in Agile project management and pick the 3 most promising
topics for a weekly LinkedIn post. Prefer: debates and shifts in the industry (AI in Agile, scaling failures,
metrics debates, certification backlash, real incident post-mortems), not rehashed 2015 Scrum basics.
You may run multiple searches with different queries to cross-check what's genuinely trending this week.
Rank by: (1) recency, (2) relevance to leadership/executives, (3) debate potential (would people argue in comments?).`;

/**
 * Agentic trend scout: an LLM loop with a web_search tool (plan §3 "Agent + search MCP").
 * Returns the top 3 topics with source links.
 */
export async function scoutTopics(): Promise<Topic[]> {
  const { text } = await generateText({
    model: llm(),
    system: SYSTEM,
    prompt: `Research trending topics in Agile project management for the week of ${new Date().toISOString().slice(0, 10)}.
Run as many searches as you need (try: "agile trends this week", "scrum news", "project management debate",
relevant subreddit/industry news). Then output your final answer as STRICT JSON only — no prose, no markdown fence:

[{"title":"...","why":"one sentence: why it's trending and why execs care","source":"publication or community name","sourceUrl":"https://..."}]

Exactly 3 objects. Today's date: ${new Date().toDateString()}.`,
    tools: {
      web_search: tool({
        description: 'Search the web for current Agile/PM news and discussions. Returns titles, URLs and snippets.',
        inputSchema: z.object({ query: z.string().describe('Search query') }),
        execute: async ({ query }) => {
          const hits = await webSearch(query);
          return hits.map((h) => ({ title: h.title, url: h.url, snippet: h.snippet.slice(0, 400) }));
        },
      }),
    },
    stopWhen: stepCountIs(8), // agent loop cap — up to 8 reasoning/tool steps
  });

  return parseTopics(text);
}

function parseTopics(text: string): Topic[] {
  const jsonStr = text.match(/\[[\s\S]*\]/)?.[0];
  if (!jsonStr) throw new Error(`Scout returned no JSON: ${text.slice(0, 300)}`);
  const parsed = JSON.parse(jsonStr) as Array<Partial<Topic>>;
  if (!Array.isArray(parsed) || parsed.length < 3) {
    throw new Error(`Scout JSON malformed or short: ${jsonStr.slice(0, 300)}`);
  }
  return parsed.slice(0, 3).map((t, i) => ({
    title: String(t.title ?? `Topic ${i + 1}`),
    why: String(t.why ?? ''),
    source: String(t.source ?? 'web'),
    sourceUrl: String(t.sourceUrl ?? ''),
  }));
}
