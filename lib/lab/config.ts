// Runtime configuration. Everything comes from environment variables;
// nothing secret is ever sent to the browser (only booleans).
import 'server-only';

export const config = {
  groqKey: process.env.GROQ_API_KEY ?? '',
  geminiKey: process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY ?? '',
  tursoUrl: process.env.TURSO_DATABASE_URL ?? '',
  tursoToken: process.env.TURSO_AUTH_TOKEN ?? '',
  accessToken: process.env.LAB_ACCESS_TOKEN ?? '',
  onVercel: !!process.env.VERCEL,
};

export const DEFAULT_AGENT_MODEL = 'llama-3.3-70b-versatile';
export const DEFAULT_JUDGE_MODEL = 'gemini-2.5-flash';

/** What the dashboard shows about setup, without leaking values. */
export function setupStatus() {
  return {
    groq: !!config.groqKey,
    gemini: !!config.geminiKey,
    turso: !!config.tursoUrl,
    // A local file on Vercel lives in /tmp and disappears between cold starts.
    ephemeralDb: !config.tursoUrl && config.onVercel,
    protected: !!config.accessToken,
  };
}

export class MissingKeyError extends Error {
  constructor(name: string) {
    super(`${name} is not set. Add it to .env.local (and to the Vercel project settings for production).`);
  }
}
