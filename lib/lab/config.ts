// Runtime configuration from environment variables. Only booleans ever reach the browser.
import 'server-only';

export const config = {
  groqKey: process.env.GROQ_API_KEY ?? process.env.GROQ_API_KEYS_2 ?? '',
  geminiKey: process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY ?? '',
  accessToken: process.env.LAB_ACCESS_TOKEN ?? '',
  onVercel: !!process.env.VERCEL,
};

export const DEFAULT_AGENT_MODEL = 'openai/gpt-oss-120b';
// Checked against the Gemini API in September 2026: older models are closed to new keys.
export const DEFAULT_JUDGE_MODELS = ['gemini-3.6-flash', 'gemini-3.5-flash-lite'];

/** What the dashboard shows about setup, without leaking values. */
export function setupStatus() {
  return {
    groq: !!config.groqKey,
    gemini: !!config.geminiKey,
    // On Vercel the SQLite file lives in /tmp: kept while the instance is warm, lost on a cold start.
    ephemeralDb: config.onVercel,
    protected: !!config.accessToken,
  };
}

export class MissingKeyError extends Error {
  constructor(name: string) {
    super(`${name} is not set. Add it to .env.local (and to the Vercel project settings for production).`);
  }
}
