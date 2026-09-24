import { handle } from '#/lib/lab/api';
import { geminiModels } from '#/lib/lab/gemini';
import { groqModels } from '#/lib/lab/groq';

export const runtime = 'nodejs';

const settle = async (f: () => Promise<string[]>) => {
  try {
    return { models: await f(), error: null };
  } catch (e) {
    return { models: [], error: e instanceof Error ? e.message : String(e) };
  }
};

export const GET = handle(async () => ({ groq: await settle(groqModels), gemini: await settle(geminiModels) }));
