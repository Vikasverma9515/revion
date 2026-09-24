// Benchmark runs. A run is created with one pending result per item; the
// client then calls step() repeatedly. Each step works until a time budget
// is used, so long runs survive serverless time limits and can resume.
import 'server-only';
import { runAgent } from './agent';
import { one, run } from './db';
import { judge } from './judge';
import { cohenKappa, percentile } from './stats';
import {
  getAgent, getResult, getRubric, getRun, listGolden, listResults, sessionPairs,
  type Judgment, type Result, type RunSource, type RunSummary,
} from './store';

export async function createRun(opts: { name: string; agentId: number; rubricId: number; source: RunSource; judges: string[]; limit?: number }) {
  if (!opts.judges.length) throw new Error('Pick at least one judge model.');
  if (!(await getAgent(opts.agentId))) throw new Error('Unknown agent.');
  if (!(await getRubric(opts.rubricId))) throw new Error('Unknown rubric.');

  type Item = { question: string; reference: string | null; answer: string | null; context: string | null; golden_item_id: number | null; message_id: number | null; latency_ms: number | null; tokens_in: number | null; tokens_out: number | null };
  let items: Item[] = [];
  if (opts.source.kind === 'dataset') {
    items = (await listGolden(opts.source.datasetId)).map((g) => ({
      question: g.question, reference: g.reference, answer: null, context: null, golden_item_id: g.id, message_id: null, latency_ms: null, tokens_in: null, tokens_out: null,
    }));
  } else {
    // Imported sessions: judge the stored answers as they were given. If an
    // answer was saved to a golden set, its edited reference is used.
    const pairs = await sessionPairs(opts.source.sessionIds);
    for (const p of pairs) {
      if (!p.question) continue;
      const ref = await one<{ reference: string; id: number }>('SELECT reference, id FROM golden_items WHERE source_message_id = ? ORDER BY id DESC LIMIT 1', [p.message_id]);
      items.push({ question: p.question, reference: ref?.reference ?? null, answer: p.answer, context: p.context, golden_item_id: ref?.id ?? null, message_id: p.message_id, latency_ms: p.latency_ms, tokens_in: p.tokens_in, tokens_out: p.tokens_out });
    }
  }
  if (opts.limit && opts.limit > 0) items = items.slice(0, opts.limit);
  if (!items.length) throw new Error('The selected source has no items.');

  const { id } = await run('INSERT INTO runs (name, agent_id, rubric_id, source, judges, total) VALUES (?,?,?,?,?,?)', [
    opts.name, opts.agentId, opts.rubricId, JSON.stringify(opts.source), JSON.stringify(opts.judges), items.length,
  ]);
  const { db } = await import('./db');
  await (await db()).batch(
    items.map((it, i) => ({
      sql: 'INSERT INTO results (run_id, position, question, reference, answer, context, golden_item_id, message_id, latency_ms, tokens_in, tokens_out) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
      args: [id, i, it.question, it.reference, it.answer, it.context, it.golden_item_id, it.message_id, it.latency_ms, it.tokens_in, it.tokens_out],
    })),
    'write',
  );
  return id;
}

export async function step(runId: number, budgetMs = 45_000) {
  const started = Date.now();
  const r = await getRun(runId);
  if (!r) throw new Error('Unknown run.');
  if (r.status === 'done') return { status: r.status, done: r.done, total: r.total };
  const agent = await getAgent(r.agent_id);
  const rubric = await getRubric(r.rubric_id);
  if (!agent || !rubric) throw new Error('The run refers to a deleted agent or rubric.');
  await run("UPDATE runs SET status = 'running', error = NULL WHERE id = ?", [runId]);

  // Start another item only if one more (as slow as the slowest so far) still fits the budget,
  // so a step stays inside the 60 s function limit.
  let slowest = 0;
  while (Date.now() - started + slowest < budgetMs) {
    const itemStart = Date.now();
    const next = await one<{ id: number }>("SELECT id FROM results WHERE run_id = ? AND status = 'pending' ORDER BY position LIMIT 1", [runId]);
    if (!next) break;
    const res = (await getResult(next.id))!;
    try {
      let { answer, context } = res;
      if (answer === null) {
        // Golden item: ask the agent now, with no chat history.
        const a = await runAgent(agent, [], res.question);
        answer = a.answer;
        context = [];
        await run('UPDATE results SET answer=?, context=?, latency_ms=?, tokens_in=?, tokens_out=? WHERE id=?', [
          a.answer, '[]', a.latencyMs, a.tokensIn, a.tokensOut, res.id,
        ]);
      }
      const judgments = await Promise.all(
        r.judges.map((model) => judge({ model, rubric, question: res.question, answer: answer ?? '', reference: res.reference, context })),
      );
      const clean: Judgment[] = judgments.map(({ tokensIn: _i, tokensOut: _o, ...j }) => j);
      await run("UPDATE results SET judgments = ?, status = 'done' WHERE id = ?", [JSON.stringify(clean), res.id]);
    } catch (e) {
      await run("UPDATE results SET status = 'failed', error = ? WHERE id = ?", [e instanceof Error ? e.message : String(e), res.id]);
    }
    await run("UPDATE runs SET done = (SELECT COUNT(*) FROM results WHERE run_id = ? AND status != 'pending') WHERE id = ?", [runId, runId]);
    slowest = Math.max(slowest, Date.now() - itemStart);
  }

  const left = await one<{ n: number }>("SELECT COUNT(*) AS n FROM results WHERE run_id = ? AND status = 'pending'", [runId]);
  if (Number(left?.n ?? 0) === 0) {
    const summary = summarize(await listResults(runId), r.judges, rubric.criteria.map((c) => c.name));
    await run("UPDATE runs SET status = 'done', summary = ?, finished_at = datetime('now') WHERE id = ?", [JSON.stringify(summary), runId]);
  }
  const after = await getRun(runId);
  return { status: after!.status, done: after!.done, total: after!.total };
}

/** Majority of judges that returned a verdict; ties count as fail. */
export function consensus(j: Judgment[]) {
  const ok = j.filter((x) => !x.error);
  if (!ok.length) return null;
  return ok.filter((x) => x.pass).length * 2 > ok.length;
}

export function summarize(results: Result[], judges: string[], criteria: string[]): RunSummary {
  const done = results.filter((r) => r.status === 'done');
  const perJudge = judges.map((judge) => {
    const js = done.map((r) => r.judgments.find((j) => j.judge === judge)).filter((j): j is Judgment => !!j && !j.error);
    const mean = (f: (j: Judgment) => number) => (js.length ? js.reduce((a, j) => a + f(j), 0) / js.length : 0);
    return {
      judge,
      passRate: mean((j) => (j.pass ? 1 : 0)),
      meanOverall: mean((j) => j.overall),
      criteria: Object.fromEntries(criteria.map((c) => [c, mean((j) => j.scores[c] ?? 0)])),
      errors: done.length - js.length,
    };
  });
  const cons = done.map((r) => consensus(r.judgments)).filter((x): x is boolean => x !== null);
  // Mean pairwise Cohen's kappa between judges, on items both judged.
  let kappa: number | null = null;
  if (judges.length > 1) {
    const ks: number[] = [];
    for (let a = 0; a < judges.length; a++)
      for (let b = a + 1; b < judges.length; b++) {
        const both = done
          .map((r) => [r.judgments.find((j) => j.judge === judges[a]), r.judgments.find((j) => j.judge === judges[b])])
          .filter(([x, y]) => x && y && !x.error && !y.error) as [Judgment, Judgment][];
        const k = cohenKappa(both.map(([x]) => x.pass), both.map(([, y]) => y.pass));
        if (k !== null) ks.push(k);
      }
    kappa = ks.length ? ks.reduce((x, y) => x + y, 0) / ks.length : null;
  }
  const lat = done.map((r) => r.latency_ms ?? 0).filter((x) => x > 0);
  return {
    items: results.length,
    failed: results.filter((r) => r.status === 'failed').length,
    judges: perJudge,
    consensusPassRate: cons.length ? cons.filter(Boolean).length / cons.length : 0,
    interJudgeKappa: kappa,
    latencyP50: percentile(lat, 0.5),
    latencyP95: percentile(lat, 0.95),
    tokensIn: done.reduce((a, r) => a + (r.tokens_in ?? 0), 0),
    tokensOut: done.reduce((a, r) => a + (r.tokens_out ?? 0), 0),
  };
}


/**
 * Re-queue items whose judge calls failed (e.g. a model was overloaded).
 * Answers are kept, so only the judges run again.
 */
export async function retryFailed(runId: number) {
  const results = await listResults(runId);
  const failed = results.filter((r) => r.status === 'failed' || r.judgments.some((j) => j.error));
  for (const r of failed) {
    await run("UPDATE results SET status = 'pending', error = NULL, judgments = NULL WHERE id = ?", [r.id]);
  }
  if (failed.length) {
    await run("UPDATE runs SET status = 'running', summary = NULL, finished_at = NULL, done = (SELECT COUNT(*) FROM results WHERE run_id = ? AND status != 'pending') WHERE id = ?", [runId, runId]);
  }
  return { requeued: failed.length };
}
