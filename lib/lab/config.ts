// Server configuration from environment variables. Only booleans ever reach the browser.
import 'server-only';

export const config = {
  groqKey: process.env.GROQ_API_KEY ?? process.env.GROQ_API_KEYS_2 ?? '',
  geminiKey: process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY ?? '',
  accessToken: process.env.LAB_ACCESS_TOKEN ?? '',
};

export function setupStatus() {
  return { groq: !!config.groqKey, gemini: !!config.geminiKey, protected: !!config.accessToken };
}

export class MissingKeyError extends Error {
  constructor(name: string) {
    super(`${name} is not set. Add it to .env.local (and to the Vercel project settings for production).`);
  }
}
