// A run's report: summary, every result, human annotations and agreement.
import { handle, HttpError, idParam } from '#/lib/lab/api';
import { consensus } from '#/lib/lab/runner';
import { humanAgreement } from '#/lib/lab/stats';
import { deleteRun, getRubric, getRun, listAnnotations, listResults } from '#/lib/lab/store';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ id: string }> };

export const GET = handle(async (_req: Request, { params }: Ctx) => {
  const id = await idParam(params);
  const run = await getRun(id);
  if (!run) throw new HttpError(404, 'Unknown run.');
  const [results, annotations, rubric] = await Promise.all([listResults(id), listAnnotations(id), getRubric(run.rubric_id)]);

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
  const agreement = pairs.length ? humanAgreement(pairs, judgePassAll, judged.length) : null;
  return { run, rubric, results, annotations, agreement };
});

export const DELETE = handle(async (_req: Request, { params }: Ctx) => {
  await deleteRun(await idParam(params));
});
