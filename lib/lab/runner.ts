// Benchmark runs, stored in the browser database. A run is created with one
// pending result per item; step() processes one item (agent answer + judges,
// each a short server call), so runs can pause and resume at any point.
import { batch, one, run } from './db';
import { askAgent, askJudge } from './remote';
import { summarize } from './stats';
import {
  getAgent, getResult, getRubric, getRun, listGolden, listResults, sessionPairs,
  type Judgment, type RunSource,
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
  await batch(
    items.map((it, i) => ({
      sql: 'INSERT INTO results (run_id, position, question, reference, answer, context, golden_item_id, message_id, latency_ms, tokens_in, tokens_out) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
      args: [id, i, it.question, it.reference, it.answer, it.context, it.golden_item_id, it.message_id, it.latency_ms, it.tokens_in, it.tokens_out],
    })),
  );
  return id;
}

export async function step(runId: number) {
  const r = await getRun(runId);
  if (!r) throw new Error('Unknown run.');
  if (r.status === 'done') return { status: r.status, done: r.done, total: r.total };
  const agent = await getAgent(r.agent_id);
  const rubric = await getRubric(r.rubric_id);
  if (!agent || !rubric) throw new Error('The run refers to a deleted agent or rubric.');
  await run("UPDATE runs SET status = 'running', error = NULL WHERE id = ?", [runId]);

  const next = await one<{ id: number }>("SELECT id FROM results WHERE run_id = ? AND status = 'pending' ORDER BY position LIMIT 1", [runId]);
  if (next) {
    const res = (await getResult(next.id))!;
    try {
      let answer = res.answer;
      if (answer === null) {
        // Golden item: ask the agent now, with no chat history.
        const a = await askAgent(agent, [], res.question);
        answer = a.answer;
        await run("UPDATE results SET answer=?, context='[]', latency_ms=?, tokens_in=?, tokens_out=? WHERE id=?", [a.answer, a.latencyMs, a.tokensIn, a.tokensOut, res.id]);
      }
      // Judges run in parallel; a judge that errors is recorded, not fatal.
      const judgments: Judgment[] = await Promise.all(
        r.judges.map((model) =>
          askJudge({ model, rubric, question: res.question, answer: answer ?? '', reference: res.reference }).catch(
            (e): Judgment => ({ judge: model, scores: {}, reasons: {}, overall: 0, pass: false, verdict: '', error: e instanceof Error ? e.message : String(e) }),
          ),
        ),
      );
      await run("UPDATE results SET judgments = ?, status = 'done' WHERE id = ?", [JSON.stringify(judgments), res.id]);
    } catch (e) {
      await run("UPDATE results SET status = 'failed', error = ? WHERE id = ?", [e instanceof Error ? e.message : String(e), res.id]);
    }
    await run("UPDATE runs SET done = (SELECT COUNT(*) FROM results WHERE run_id = ? AND status != 'pending') WHERE id = ?", [runId, runId]);
  }

  const left = await one<{ n: number }>("SELECT COUNT(*) AS n FROM results WHERE run_id = ? AND status = 'pending'", [runId]);
  if (Number(left?.n ?? 0) === 0) {
    const summary = summarize(await listResults(runId), r.judges, rubric.criteria.map((c) => c.name));
    await run("UPDATE runs SET status = 'done', summary = ?, finished_at = datetime('now') WHERE id = ?", [JSON.stringify(summary), runId]);
  }
  const after = await getRun(runId);
  return { status: after!.status, done: after!.done, total: after!.total };
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
