// Defaults shared by the browser and the server.
export const DEFAULT_AGENT_MODEL = 'openai/gpt-oss-120b';
// Checked against the Gemini API in September 2026: older models are closed to
// new keys, and on the free tier gemini-3.6-flash allows only 20 requests a day,
// so the defaults are the two flash-lite models.
export const DEFAULT_JUDGE_MODELS = ['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite'];
