import { createOpenAI } from '@ai-sdk/openai';
import { env } from './env';

/** Any OpenAI-compatible endpoint (OpenAI, OpenRouter, Groq, DeepSeek, ...). */
export function llm() {
  const provider = createOpenAI({
    apiKey: env('LLM_API_KEY'),
    baseURL: process.env.LLM_BASE_URL || undefined,
  });
  return provider(env('LLM_MODEL', 'gpt-4o-mini'));
}
