import { createOpenAI } from '@ai-sdk/openai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { env } from './env';

/**
 * Returns an AI SDK language model.
 * - Google AI Studio (generativelanguage.googleapis.com): native Google provider —
 *   required because Gemini's tool-calling needs thought_signature preservation,
 *   which the OpenAI-compatible endpoint does NOT handle.
 * - Any other OpenAI-compatible endpoint (OpenAI, OpenRouter, Groq, DeepSeek...): .chat()
 *   (chat/completions — /responses is not broadly supported).
 */
export function llm() {
  const baseUrl = process.env.LLM_BASE_URL || '';
  const isGoogle = baseUrl.includes('generativelanguage.googleapis.com') || process.env.LLM_PROVIDER === 'google';

  if (isGoogle) {
    const google = createGoogleGenerativeAI({ apiKey: env('LLM_API_KEY') });
    return google(env('LLM_MODEL', 'gemini-flash-lite-latest'));
  }

  const provider = createOpenAI({
    apiKey: env('LLM_API_KEY'),
    baseURL: baseUrl || undefined,
  });
  return provider.chat(env('LLM_MODEL', 'gpt-4o-mini'));
}
