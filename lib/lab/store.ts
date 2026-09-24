// Typed data access for every table. Plain SQL, no ORM.
import 'server-only';
import { all, json, one, run } from './db';

export type Agent = {
  id: number;
  name: string;
  model: string;
  system_prompt: string;
  temperature: number;
  top_k: number;
  allow_general: number;
  created_at: string;
};
export type Session = { id: number; agent_id: number; title: string; created_at: string; agent_name?: string; turns?: number };
export type Source = { n: number; chunk_id: number; title: string; text: string; distance: number };
export type TraceStep = { tool: string; args: unknown; summary: string };
export type Message = {
  id: number;
  session_id: number;
  role: 'user' | 'assistant';
  content: string;
  context: Source[];
  trace: TraceStep[];
  model: string | null;
  latency_ms: number | null;
  tokens_in: number | null;
  tokens_out: number | null;
  created_at: string;
};
export type Dataset = { id: number; name: string; description: string; created_at: string; items?: number };
export type GoldenItem = {
  id: number;
  dataset_id: number;
  question: string;
  reference: string;
  tags: string;
  source_message_id: number | null;
  created_at: string;
  updated_at: string;
};
export type Criterion = { name: string; description: string };
export type Rubric = { id: number; name: string; criteria: Criterion[]; rules: string; pass_threshold: number; created_at: string };
export type RunSource = { kind: 'dataset'; datasetId: number } | { kind: 'sessions'; sessionIds: number[] | 'all' };
export type Run = {
  id: number;
  name: string;
  agent_id: number;
  rubric_id: number;
  source: RunSource;
  judges: string[];
  status: 'pending' | 'running' | 'done' | 'failed';
  total: number;
  done: number;
  error: string | null;
  summary: RunSummary | null;
  created_at: string;
  finished_at: string | null;
  agent_name?: string;
  rubric_name?: string;
};
export type Judgment = {
  judge: string;
  scores: Record<string, number>;
  reasons: Record<string, string>;
  overall: number;
  pass: boolean;
  verdict: string;
  error?: string;
};
export type Result = {
  id: number;
  run_id: number;
  position: number;
  question: string;
  reference: string | null;
  answer: string | null;
  context: Source[];
  golden_item_id: number | null;
  message_id: number | null;
  latency_ms: number | null;
  tokens_in: number | null;
  tokens_out: number | null;
  judgments: Judgment[];
  status: 'pending' | 'done' | 'failed';
  error: string | null;
};
export type Annotation = {
  id: number;
  result_id: number;
  annotator: string;
  pass: number;
  scores: Record<string, number>;
  note: string;
  created_at: string;
};
export type RunSummary = {
  items: number;
  failed: number;
  judges: {
    judge: string;
    passRate: number;
    meanOverall: number;
    criteria: Record<string, number>;
    errors: number;
  }[];
  consensusPassRate: number;
  interJudgeKappa: number | null;
  latencyP50: number;
  latencyP95: number;
  tokensIn: number;
  tokensOut: number;
};

// ---------- agents ----------
export const listAgents = () => all<Agent>('SELECT * FROM agents ORDER BY id');
export const getAgent = (id: number) => one<Agent>('SELECT * FROM agents WHERE id = ?', [id]);
export async function saveAgent(a: Omit<Agent, 'id' | 'created_at'> & { id?: number }) {
  if (a.id) {
    await run('UPDATE agents SET name=?, model=?, system_prompt=?, temperature=?, top_k=?, allow_general=? WHERE id=?', [
      a.name, a.model, a.system_prompt, a.temperature, a.top_k, a.allow_general, a.id,
    ]);
    return a.id;
  }
  return (
    await run('INSERT INTO agents (name, model, system_prompt, temperature, top_k, allow_general) VALUES (?,?,?,?,?,?)', [
      a.name, a.model, a.system_prompt, a.temperature, a.top_k, a.allow_general,
    ])
  ).id;
}

// ---------- sessions & messages ----------
export const listSessions = (agentId?: number) =>
  all<Session>(
    `SELECT s.*, a.name AS agent_name, (SELECT COUNT(*) FROM messages m WHERE m.session_id = s.id AND m.role = 'user') AS turns
     FROM sessions s JOIN agents a ON a.id = s.agent_id ${agentId ? 'WHERE s.agent_id = ?' : ''} ORDER BY s.id DESC`,
    agentId ? [agentId] : [],
  );
export const getSession = (id: number) =>
  one<Session>('SELECT s.*, a.name AS agent_name FROM sessions s JOIN agents a ON a.id = s.agent_id WHERE s.id = ?', [id]);
export const createSession = async (agentId: number, title: string) =>
  (await run('INSERT INTO sessions (agent_id, title) VALUES (?, ?)', [agentId, title.slice(0, 120)])).id;
export const deleteSession = (id: number) => run('DELETE FROM sessions WHERE id = ?', [id]);

type MessageRow = Omit<Message, 'context' | 'trace'> & { context: string | null; trace: string | null };
const toMessage = (r: MessageRow): Message => ({ ...r, context: json(r.context, []), trace: json(r.trace, []) });

export const listMessages = async (sessionId: number) =>
  (await all<MessageRow>('SELECT * FROM messages WHERE session_id = ? ORDER BY id', [sessionId])).map(toMessage);
export const getMessage = async (id: number) => {
  const r = await one<MessageRow>('SELECT * FROM messages WHERE id = ?', [id]);
  return r ? toMessage(r) : null;
};
export async function addMessage(m: Omit<Message, 'id' | 'created_at'>) {
  return (
    await run(
      'INSERT INTO messages (session_id, role, content, context, trace, model, latency_ms, tokens_in, tokens_out) VALUES (?,?,?,?,?,?,?,?,?)',
      [m.session_id, m.role, m.content, JSON.stringify(m.context), JSON.stringify(m.trace), m.model, m.latency_ms, m.tokens_in, m.tokens_out],
    )
  ).id;
}

/** Question/answer pairs from sessions: each assistant message with the user message before it. */
export async function sessionPairs(sessionIds: number[] | 'all') {
  const filter = sessionIds === 'all' ? '' : `AND a.session_id IN (${sessionIds.map(() => '?').join(',') || 'NULL'})`;
  return all<{ message_id: number; question: string; answer: string; context: string | null; latency_ms: number; tokens_in: number; tokens_out: number }>(
    `SELECT a.id AS message_id, a.content AS answer, a.context, a.latency_ms, a.tokens_in, a.tokens_out,
       (SELECT u.content FROM messages u WHERE u.session_id = a.session_id AND u.role = 'user' AND u.id < a.id ORDER BY u.id DESC LIMIT 1) AS question
     FROM messages a WHERE a.role = 'assistant' ${filter} ORDER BY a.id`,
    sessionIds === 'all' ? [] : sessionIds,
  );
}

// ---------- golden datasets ----------
export const listDatasets = () =>
  all<Dataset>('SELECT d.*, (SELECT COUNT(*) FROM golden_items g WHERE g.dataset_id = d.id) AS items FROM datasets d ORDER BY d.id');
export const getDataset = (id: number) => one<Dataset>('SELECT * FROM datasets WHERE id = ?', [id]);
export const createDataset = async (name: string, description = '') =>
  (await run('INSERT INTO datasets (name, description) VALUES (?, ?)', [name, description])).id;
export const deleteDataset = (id: number) => run('DELETE FROM datasets WHERE id = ?', [id]);
export const listGolden = (datasetId: number) =>
  all<GoldenItem>('SELECT * FROM golden_items WHERE dataset_id = ? ORDER BY id', [datasetId]);
export async function saveGolden(g: { id?: number; dataset_id: number; question: string; reference: string; tags?: string; source_message_id?: number | null }) {
  if (g.id) {
    await run("UPDATE golden_items SET question=?, reference=?, tags=?, updated_at=datetime('now') WHERE id=?", [g.question, g.reference, g.tags ?? '', g.id]);
    return g.id;
  }
  return (
    await run('INSERT INTO golden_items (dataset_id, question, reference, tags, source_message_id) VALUES (?,?,?,?,?)', [
      g.dataset_id, g.question, g.reference, g.tags ?? '', g.source_message_id ?? null,
    ])
  ).id;
}
export const deleteGolden = (id: number) => run('DELETE FROM golden_items WHERE id = ?', [id]);

// ---------- rubrics ----------
type RubricRow = Omit<Rubric, 'criteria'> & { criteria: string };
const toRubric = (r: RubricRow): Rubric => ({ ...r, criteria: json(r.criteria, []) });
export const listRubrics = async () => (await all<RubricRow>('SELECT * FROM rubrics ORDER BY id')).map(toRubric);
export const getRubric = async (id: number) => {
  const r = await one<RubricRow>('SELECT * FROM rubrics WHERE id = ?', [id]);
  return r ? toRubric(r) : null;
};
export async function saveRubric(r: Omit<Rubric, 'id' | 'created_at'> & { id?: number }) {
  if (r.id) {
    await run('UPDATE rubrics SET name=?, criteria=?, rules=?, pass_threshold=? WHERE id=?', [r.name, JSON.stringify(r.criteria), r.rules, r.pass_threshold, r.id]);
    return r.id;
  }
  return (await run('INSERT INTO rubrics (name, criteria, rules, pass_threshold) VALUES (?,?,?,?)', [r.name, JSON.stringify(r.criteria), r.rules, r.pass_threshold])).id;
}

// ---------- runs & results ----------
type RunRow = Omit<Run, 'source' | 'judges' | 'summary'> & { source: string; judges: string; summary: string | null };
const toRun = (r: RunRow): Run => ({ ...r, source: json(r.source, { kind: 'sessions', sessionIds: 'all' }), judges: json(r.judges, []), summary: json(r.summary, null) });
export const listRuns = async () =>
  (
    await all<RunRow>(
      'SELECT r.*, a.name AS agent_name, b.name AS rubric_name FROM runs r JOIN agents a ON a.id = r.agent_id JOIN rubrics b ON b.id = r.rubric_id ORDER BY r.id DESC',
    )
  ).map(toRun);
export const getRun = async (id: number) => {
  const r = await one<RunRow>(
    'SELECT r.*, a.name AS agent_name, b.name AS rubric_name FROM runs r JOIN agents a ON a.id = r.agent_id JOIN rubrics b ON b.id = r.rubric_id WHERE r.id = ?',
    [id],
  );
  return r ? toRun(r) : null;
};
export const deleteRun = (id: number) => run('DELETE FROM runs WHERE id = ?', [id]);

type ResultRow = Omit<Result, 'context' | 'judgments'> & { context: string | null; judgments: string | null };
const toResult = (r: ResultRow): Result => ({ ...r, context: json(r.context, []), judgments: json(r.judgments, []) });
export const listResults = async (runId: number) =>
  (await all<ResultRow>('SELECT * FROM results WHERE run_id = ? ORDER BY position', [runId])).map(toResult);
export const getResult = async (id: number) => {
  const r = await one<ResultRow>('SELECT * FROM results WHERE id = ?', [id]);
  return r ? toResult(r) : null;
};

// ---------- annotations ----------
type AnnotationRow = Omit<Annotation, 'scores'> & { scores: string };
export const listAnnotations = async (runId: number) =>
  (
    await all<AnnotationRow>('SELECT n.* FROM annotations n JOIN results r ON r.id = n.result_id WHERE r.run_id = ? ORDER BY n.id', [runId])
  ).map((a) => ({ ...a, scores: json<Record<string, number>>(a.scores, {}) }));
export async function saveAnnotation(a: { result_id: number; annotator: string; pass: boolean; scores: Record<string, number>; note: string }) {
  await run(
    `INSERT INTO annotations (result_id, annotator, pass, scores, note) VALUES (?,?,?,?,?)
     ON CONFLICT (result_id, annotator) DO UPDATE SET pass = excluded.pass, scores = excluded.scores, note = excluded.note, created_at = datetime('now')`,
    [a.result_id, a.annotator, a.pass ? 1 : 0, JSON.stringify(a.scores), a.note],
  );
}

export async function counts() {
  const r = await one<Record<string, number>>(
    `SELECT (SELECT COUNT(*) FROM agents) AS agents, (SELECT COUNT(*) FROM sessions) AS sessions, (SELECT COUNT(*) FROM messages WHERE role='assistant') AS answers,
      (SELECT COUNT(*) FROM golden_items) AS golden, (SELECT COUNT(*) FROM runs) AS runs, (SELECT COUNT(*) FROM annotations) AS annotations`,
  );
  return Object.fromEntries(Object.entries(r ?? {}).map(([k, v]) => [k, Number(v)]));
}
