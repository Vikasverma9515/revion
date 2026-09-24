// The lab's data API, served in the browser from the local SQLite database.
// Pages call api('/api/lab/…'); lib/lab/client.ts sends the paths below here
// and only LLM work (answer, judge, models, setup) to the server.
import { askAgent } from './remote';
import { createRun, retryFailed, step } from './runner';
import { consensus, humanAgreement } from './stats';
import * as db from './store';
import { HttpError, num, str } from './validate';

type Handler = (req: Request, id: number) => Promise<unknown>;
type Route = { method: string; path: RegExp; fn: Handler };

const body = (req: Request) => req.json().catch(() => ({}));
const q = (req: Request, key: string) => new URL(req.url).searchParams.get(key);

export const ROUTES: Route[] = [
  {
    method: 'GET',
    path: /^status$/,
    fn: async () => {
      const setup = await fetch('/api/lab/setup').then((r) => r.json()).catch(() => ({ groq: false, gemini: false, protected: false }));
      return { setup, counts: await db.counts() };
    },
  },

  // Agents
  { method: 'GET', path: /^agents$/, fn: () => db.listAgents() },
  {
    method: 'POST',
    path: /^agents$/,
    fn: async (req) => {
      const b = await body(req);
      const id = await db.saveAgent({
        id: b.id ? Number(b.id) : undefined,
        name: str(b.name, 'Name', 100),
        model: str(b.model, 'Model', 200),
        system_prompt: str(b.system_prompt, 'System prompt', 20_000),
        temperature: num(b.temperature, 'Temperature', 0, 2),
        top_k: 5,
        allow_general: 1,
      });
      return { id };
    },
  },

  // Chat: the question and the answer are stored in the session.
  {
    method: 'POST',
    path: /^chat$/,
    fn: async (req) => {
      const b = await body(req);
      const question = str(b.question, 'Question', 8000);
      const agent = await db.getAgent(Number(b.agentId));
      if (!agent) throw new HttpError(404, 'Unknown agent.');
      let sessionId = b.sessionId ? Number(b.sessionId) : 0;
      if (sessionId) {
        const s = await db.getSession(sessionId);
        if (!s || s.agent_id !== agent.id) throw new HttpError(404, 'Unknown session for this agent.');
      }
      const history = sessionId ? (await db.listMessages(sessionId)).map((m) => ({ role: m.role, content: m.content })) : [];
      // Call the model first so a failure does not leave a half-written session.
      const a = await askAgent(agent, history, question);
      if (!sessionId) sessionId = await db.createSession(agent.id, question);
      const userId = await db.addMessage({ session_id: sessionId, role: 'user', content: question, context: [], trace: [], model: null, latency_ms: null, tokens_in: null, tokens_out: null });
      const assistantId = await db.addMessage({
        session_id: sessionId, role: 'assistant', content: a.answer, context: [], trace: a.trace,
        model: a.model, latency_ms: a.latencyMs, tokens_in: a.tokensIn, tokens_out: a.tokensOut,
      });
      return { sessionId, user: await db.getMessage(userId), assistant: await db.getMessage(assistantId) };
    },
  },

  // Sessions
  { method: 'GET', path: /^sessions$/, fn: async (req) => db.listSessions(Number(q(req, 'agentId')) || undefined) },
  {
    method: 'GET',
    path: /^sessions\/(\d+)$/,
    fn: async (_req, id) => {
      const session = await db.getSession(id);
      if (!session) throw new HttpError(404, 'Unknown session.');
      return { session, messages: await db.listMessages(id) };
    },
  },
  { method: 'DELETE', path: /^sessions\/(\d+)$/, fn: (_req, id) => db.deleteSession(id) },

  // Golden datasets and items
  { method: 'GET', path: /^datasets$/, fn: () => db.listDatasets() },
  {
    method: 'POST',
    path: /^datasets$/,
    fn: async (req) => {
      const b = await body(req);
      return { id: await db.createDataset(str(b.name, 'Name', 100), typeof b.description === 'string' ? b.description : '') };
    },
  },
  { method: 'DELETE', path: /^datasets$/, fn: async (req) => db.deleteDataset(Number(q(req, 'id'))) },
  {
    method: 'GET',
    path: /^datasets\/(\d+)$/,
    fn: async (_req, id) => {
      const dataset = await db.getDataset(id);
      if (!dataset) throw new HttpError(404, 'Unknown dataset.');
      return { dataset, items: await db.listGolden(id) };
    },
  },
  {
    method: 'POST',
    path: /^golden$/,
    fn: async (req) => {
      const b = await body(req);
      const datasetId = Number(b.datasetId);
      if (!(await db.getDataset(datasetId))) throw new Error('Pick a dataset.');
      const id = await db.saveGolden({
        id: b.id ? Number(b.id) : undefined,
        dataset_id: datasetId,
        question: str(b.question, 'Question', 8000),
        reference: str(b.reference, 'Reference answer', 20_000),
        tags: typeof b.tags === 'string' ? b.tags.slice(0, 200) : '',
        source_message_id: b.sourceMessageId ? Number(b.sourceMessageId) : null,
      });
      return { id };
    },
  },
  { method: 'DELETE', path: /^golden$/, fn: async (req) => db.deleteGolden(Number(q(req, 'id'))) },

  // Rubrics
  { method: 'GET', path: /^rubrics$/, fn: () => db.listRubrics() },
  {
    method: 'POST',
    path: /^rubrics$/,
    fn: async (req) => {
      const b = await body(req);
      const criteria: db.Criterion[] = (Array.isArray(b.criteria) ? b.criteria : [])
        .map((c: db.Criterion) => ({ name: String(c.name ?? '').trim().slice(0, 60), description: String(c.description ?? '').trim().slice(0, 1000) }))
        .filter((c: db.Criterion) => c.name);
      if (!criteria.length) throw new Error('Add at least one criterion.');
      if (new Set(criteria.map((c) => c.name.toLowerCase())).size !== criteria.length) throw new Error('Criterion names must be unique.');
      const id = await db.saveRubric({
        id: b.id ? Number(b.id) : undefined,
        name: str(b.name, 'Name', 100),
        criteria,
        rules: typeof b.rules === 'string' ? b.rules.slice(0, 5000) : '',
        pass_threshold: num(b.pass_threshold, 'Pass threshold', 1, 5),
      });
      return { id };
    },
  },

  // Benchmark runs
  { method: 'GET', path: /^runs$/, fn: () => db.listRuns() },
  {
    method: 'POST',
    path: /^runs$/,
    fn: async (req) => {
      const b = await body(req);
      const source: db.RunSource =
        b.source?.kind === 'dataset'
          ? { kind: 'dataset', datasetId: Number(b.source.datasetId) }
          : { kind: 'sessions', sessionIds: Array.isArray(b.source?.sessionIds) ? b.source.sessionIds.map(Number) : 'all' };
      const id = await createRun({
        name: str(b.name, 'Run name', 120),
        agentId: Number(b.agentId),
        rubricId: Number(b.rubricId),
        source,
        judges: (Array.isArray(b.judges) ? b.judges : []).map(String).filter(Boolean).slice(0, 4),
        limit: Number(b.limit) || undefined,
      });
      return { id };
    },
  },
  {
    method: 'GET',
    path: /^runs\/(\d+)$/,
    fn: async (_req, id) => {
      const run = await db.getRun(id);
      if (!run) throw new HttpError(404, 'Unknown run.');
      const [results, annotations, rubric] = await Promise.all([db.listResults(id), db.listAnnotations(id), db.getRubric(run.rubric_id)]);
      // Human label per result = majority of its annotators (ties count as fail).
      const byResult = new Map<number, boolean[]>();
      for (const a of annotations) byResult.set(a.result_id, [...(byResult.get(a.result_id) ?? []), !!a.pass]);
      const judged = results.map((r) => ({ r, judge: consensus(r.judgments) })).filter((x) => x.judge !== null);
      const pairs = judged
        .filter((x) => byResult.has(x.r.id))
        .map((x) => {
          const labels = byResult.get(x.r.id)!;
          return { human: labels.filter(Boolean).length * 2 > labels.length, judge: x.judge as boolean };
        });
      const judgePassAll = judged.length ? judged.filter((x) => x.judge).length / judged.length : 0;
      return { run, rubric, results, annotations, agreement: pairs.length ? humanAgreement(pairs, judgePassAll, judged.length) : null };
    },
  },
  { method: 'DELETE', path: /^runs\/(\d+)$/, fn: (_req, id) => db.deleteRun(id) },
  // Process pending items for up to ~40 s; the client calls again until done.
  { method: 'POST', path: /^runs\/(\d+)\/step$/, fn: (_req, id) => step(id) },
  { method: 'POST', path: /^runs\/(\d+)\/retry$/, fn: (_req, id) => retryFailed(id) },

  // Human annotations
  {
    method: 'POST',
    path: /^annotations$/,
    fn: async (req) => {
      const b = await body(req);
      const result = await db.getResult(Number(b.resultId));
      if (!result) throw new Error('Unknown result.');
      const scores: Record<string, number> = {};
      for (const [k, v] of Object.entries(b.scores ?? {})) {
        const n = Math.round(Number(v));
        if (n >= 1 && n <= 5) scores[k.slice(0, 60)] = n;
      }
      await db.saveAnnotation({
        result_id: result.id,
        annotator: str(b.annotator, 'Annotator name', 60),
        pass: !!b.pass,
        scores,
        note: typeof b.note === 'string' ? b.note.slice(0, 2000) : '',
      });
    },
  },

];

/** Run a local route; throws on unknown paths and on handler errors. */
export async function dispatch(method: string, path: string, req: Request) {
  for (const r of ROUTES) {
    const m = r.method === method && path.match(r.path);
    if (m) return r.fn(req, Number(m[1] ?? 0));
  }
  throw new HttpError(404, `No such endpoint: ${method} /api/lab/${path}`);
}
