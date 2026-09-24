// Server side of the Eval Lab: only the work that needs the API keys.
// Everything else (sessions, golden sets, runs, annotations) lives in the
// browser's SQLite database; see lib/lab/db.ts and lib/lab/handlers.ts.
import { runAgent } from '#/lib/lab/agent';
import { handle } from '#/lib/lab/api';
import { config, setupStatus } from '#/lib/lab/config';
import { DEFAULT_JUDGE_MODELS } from '#/lib/lab/constants';
import { geminiModels } from '#/lib/lab/gemini';
import { groqModels } from '#/lib/lab/groq';
import { judge } from '#/lib/lab/judge';
import type { Agent, Criterion } from '#/lib/lab/store';
import { HttpError, num, str } from '#/lib/lab/validate';

export const runtime = 'nodejs';
export const maxDuration = 120;

type Ctx = { params: Promise<{ path: string[] }> };
const path = async (ctx: Ctx) => (await ctx.params).path.join('/');

const settle = async (f: () => Promise<string[]>) => {
  try {
    return { models: await f(), error: null };
  } catch (e) {
    return { models: [], error: e instanceof Error ? e.message : String(e) };
  }
};

export const GET = handle(async (_req: Request, ctx: Ctx) => {
  const p = await path(ctx);
  if (p === 'setup') return setupStatus();
  if (p === 'models') return { groq: await settle(groqModels), gemini: await settle(geminiModels), defaultJudges: DEFAULT_JUDGE_MODELS };
  throw new HttpError(404, 'Not found.');
});

export const POST = handle(async (req: Request, ctx: Ctx) => {
  const p = await path(ctx);
  const b = await req.json().catch(() => ({}));

  if (p === 'answer') {
    // The agent's settings come from the browser's database; the key stays here.
    const agent = {
      model: str(b.agent?.model, 'Model', 200),
      system_prompt: str(b.agent?.system_prompt, 'System prompt', 20_000),
      temperature: num(b.agent?.temperature, 'Temperature', 0, 2),
    } as Agent;
    const history = (Array.isArray(b.history) ? b.history : [])
      .slice(-20)
      .filter((m: { role: string; content: unknown }) => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
      .map((m: { role: 'user' | 'assistant'; content: string }) => ({ role: m.role, content: m.content.slice(0, 20_000) }));
    return runAgent(agent, history, str(b.question, 'Question', 8000));
  }

  if (p === 'judge') {
    const criteria: Criterion[] = (Array.isArray(b.rubric?.criteria) ? b.rubric.criteria : [])
      .map((c: Criterion) => ({ name: String(c.name ?? '').slice(0, 60), description: String(c.description ?? '').slice(0, 1000) }))
      .filter((c: Criterion) => c.name);
    if (!criteria.length) throw new Error('The rubric has no criteria.');
    const { tokensIn: _i, tokensOut: _o, ...j } = await judge({
      model: str(b.model, 'Judge model', 200),
      rubric: { id: 0, name: '', created_at: '', criteria, rules: String(b.rubric?.rules ?? '').slice(0, 5000), pass_threshold: num(b.rubric?.pass_threshold, 'Pass threshold', 1, 5) },
      question: str(b.question, 'Question', 8000),
      answer: String(b.answer ?? '').slice(0, 40_000),
      reference: typeof b.reference === 'string' && b.reference ? b.reference.slice(0, 20_000) : null,
      context: [],
    });
    return j;
  }

  if (p === 'login') {
    if (!config.accessToken || b.token !== config.accessToken) throw new HttpError(401, 'Wrong access token.');
    const res = Response.json({ ok: true });
    res.headers.append('Set-Cookie', `lab_token=${encodeURIComponent(b.token)}; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=${60 * 60 * 24 * 30}`);
    return res;
  }
  throw new HttpError(404, 'Not found.');
});
