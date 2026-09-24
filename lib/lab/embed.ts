// Local sentence embeddings (all-MiniLM-L6-v2, 384 dims, int8) via transformers.js.
// No API key: the model (~23 MB) is downloaded once and cached on disk.
import 'server-only';
import { config } from './config';
import path from 'node:path';

export const EMBED_MODEL = 'Xenova/all-MiniLM-L6-v2';

type Extractor = (texts: string[], opts: { pooling: 'mean'; normalize: boolean }) => Promise<{ tolist(): number[][] }>;
let extractor: Promise<Extractor> | null = null;

function load(): Promise<Extractor> {
  if (!extractor) {
    extractor = (async () => {
      const { pipeline, env } = await import('@huggingface/transformers');
      env.cacheDir = config.onVercel ? '/tmp/hf-cache' : path.join(process.cwd(), '.data', 'hf-cache');
      return (await pipeline('feature-extraction', EMBED_MODEL, { dtype: 'q8' })) as unknown as Extractor;
    })();
    extractor.catch(() => (extractor = null)); // retry on the next call if the download failed
  }
  return extractor;
}

/** Unit-length vectors, so cosine distance = 1 - dot product. */
export async function embed(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const ext = await load();
  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += 32) {
    const batch = await ext(texts.slice(i, i + 32), { pooling: 'mean', normalize: true });
    out.push(...batch.tolist());
  }
  return out;
}
