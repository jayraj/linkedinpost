import { generateImage } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import sharp from 'sharp';
import { env } from './env';

/**
 * AI-generated illustration for the weekly post.
 *
 * Engines:
 * - Default: Pollinations.ai (Flux) — free, keyless, no billing. Anonymous
 *   tier: 768px max, 1 image / 45s per IP (irrelevant at 1 image/week).
 * - IMAGE_PROVIDER=gemini: Gemini image models first (needs billing enabled
 *   on the AI Studio project — free-tier image quota is 0), falling back to
 *   Pollinations automatically.
 *
 * Visual DNA — light & corporate, so every week looks like a series:
 * white/light-gray backgrounds, navy/slate palette with one teal accent.
 *
 * NEVER throws: returns null on any failure so the weekly pipeline can fall
 * back to a text-only post instead of dying.
 */

/**
 * Visual DNA — light & corporate abstract, so every week looks like a series.
 * Positive phrasing only: Flux (the Pollinations model) largely ignores
 * negations like "no faces" and can even be nudged toward them.
 */
const VISUAL_LEAD =
  'A clean minimal flat-vector illustration made of simple geometric shapes and abstract symbols, like a modern editorial infographic in an executive business magazine.';
const VISUAL_DNA =
  'White background, muted palette of navy blue, slate gray and a single teal accent. Generous whitespace, thin clean line work. Purely abstract and symbolic: diagrams, arrows, circles, rectangles, simple pictograms and abstract icons.';

/** First fallback is current-gen; second is the proven classic Nano Banana. */
const GEMINI_MODELS = ['gemini-3.1-flash-image', 'gemini-2.5-flash-image'] as const;

export interface PostImage {
  base64: string;
  mimeType: string;
}

/** First non-empty line of the post = the hook the image should visualize. */
export function postHook(content: string, fallback: string): string {
  return (
    content
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)[0]?.slice(0, 300) ?? fallback
  );
}

async function viaGemini(prompt: string): Promise<PostImage | null> {
  for (const modelId of GEMINI_MODELS) {
    try {
      const google = createGoogleGenerativeAI({ apiKey: env('LLM_API_KEY') });
      const { image } = await generateImage({
        model: google.image(modelId),
        prompt,
        aspectRatio: '1:1',
        maxRetries: 2,
      });
      return { base64: image.base64, mimeType: image.mediaType };
    } catch (e) {
      console.error(`gemini image failed (${modelId}):`, String(e));
    }
  }
  return null;
}

/**
 * Free-tier images carry a "pollinations.ai" watermark ~2% from the bottom-right
 * edge. Cropping the bottom 60px removes it cleanly (verified via vision QA:
 * no watermark, no cut-off fragments). Falls back to the original on failure.
 */
async function stripWatermark(buf: Buffer, mimeType: string): Promise<PostImage> {
  try {
    const meta = await sharp(buf).metadata();
    if (meta.width && meta.height && meta.height > 120) {
      const out = await sharp(buf)
        .extract({ left: 0, top: 0, width: meta.width, height: meta.height - 60 })
        .jpeg({ quality: 92 })
        .toBuffer();
      return { base64: out.toString('base64'), mimeType: 'image/jpeg' };
    }
  } catch (e) {
    console.error('watermark crop failed:', String(e));
  }
  return { base64: buf.toString('base64'), mimeType };
}

async function viaPollinations(prompt: string): Promise<PostImage | null> {
  const seed = Math.floor(Math.random() * 1e9);
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=768&height=768&model=flux&nologo=true&seed=${seed}`;

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(60_000) });
      const type = res.headers.get('content-type') || '';
      if (res.ok && type.startsWith('image/')) {
        const raw = Buffer.from(await res.arrayBuffer());
        return await stripWatermark(raw, type.split(';')[0]);
      }
      const body = await res.text();
      console.error(`pollinations attempt ${attempt}: ${res.status} ${body.slice(0, 200)}`);
      // 402/429 = free-tier rate limit (1 per 45s) — worth waiting out once
      if ((res.status === 402 || res.status === 429) && attempt === 1) {
        await new Promise((r) => setTimeout(r, 46_000));
        continue;
      }
      return null;
    } catch (e) {
      console.error(`pollinations attempt ${attempt} error:`, String(e));
      if (attempt === 1) await new Promise((r) => setTimeout(r, 10_000));
    }
  }
  return null;
}

export async function generatePostImage(
  topic: string,
  hook: string,
): Promise<PostImage | null> {
  const prompt = `${VISUAL_LEAD}

Topic of the post: ${topic}
Central idea to visualize: ${hook}

${VISUAL_DNA}`;

  try {
    if (process.env.IMAGE_PROVIDER === 'gemini') {
      const g = await viaGemini(prompt);
      if (g) return g;
    }
    return await viaPollinations(prompt);
  } catch (e) {
    console.error('image generation failed:', String(e));
    return null;
  }
}
