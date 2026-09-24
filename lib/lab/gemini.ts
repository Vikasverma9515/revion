// Google Gemini (Generative Language API) with JSON-schema structured output.
import 'server-only';
import { config, MissingKeyError } from './config';
import { fetchRetry } from './http';

const BASE = 'https://generativelanguage.googleapis.com/v1beta';

function key() {
  if (!config.geminiKey) throw new MissingKeyError('GEMINI_API_KEY');
  return config.geminiKey;
}

export async function geminiJson<T>(opts: {
  model: string;
  system: string;
  prompt: string;
  schema: object;
  temperature?: number;
}): Promise<{ data: T; tokensIn: number; tokensOut: number }> {
  const res = await fetchRetry(
    `${BASE}/models/${encodeURIComponent(opts.model)}:generateContent`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key() },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: opts.system }] },
        contents: [{ role: 'user', parts: [{ text: opts.prompt }] }],
        generationConfig: {
          temperature: opts.temperature ?? 0,
          responseMimeType: 'application/json',
          responseSchema: opts.schema,
        },
      }),
    },
    `Gemini (${opts.model})`,
  );
  const body = await res.json();
  const text: string = body.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? '').join('') ?? '';
  if (!text) throw new Error(`Gemini returned no content (${body.candidates?.[0]?.finishReason ?? body.promptFeedback?.blockReason ?? 'unknown'}).`);
  return {
    data: JSON.parse(text) as T,
    tokensIn: body.usageMetadata?.promptTokenCount ?? 0,
    tokensOut: body.usageMetadata?.candidatesTokenCount ?? 0,
  };
}

/** Gemini models that support generateContent. */
export async function geminiModels(): Promise<string[]> {
  const res = await fetchRetry(`${BASE}/models?pageSize=200`, { headers: { 'x-goog-api-key': key() } }, 'Gemini');
  const data = await res.json();
  return (data.models as { name: string; supportedGenerationMethods?: string[] }[])
    .filter((m) => m.supportedGenerationMethods?.includes('generateContent') && /gemini/.test(m.name) && !/embedding|image|tts|audio|live/i.test(m.name))
    .map((m) => m.name.replace(/^models\//, ''))
    .sort();
}
