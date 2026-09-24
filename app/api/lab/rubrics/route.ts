import { handle, num, str } from '#/lib/lab/api';
import { listRubrics, saveRubric, type Criterion } from '#/lib/lab/store';

export const runtime = 'nodejs';

export const GET = handle(listRubrics);

export const POST = handle(async (req: Request) => {
  const b = await req.json();
  const criteria: Criterion[] = (Array.isArray(b.criteria) ? b.criteria : [])
    .map((c: Criterion) => ({ name: String(c.name ?? '').trim().slice(0, 60), description: String(c.description ?? '').trim().slice(0, 1000) }))
    .filter((c: Criterion) => c.name);
  if (!criteria.length) throw new Error('Add at least one criterion.');
  if (new Set(criteria.map((c) => c.name.toLowerCase())).size !== criteria.length) throw new Error('Criterion names must be unique.');
  const id = await saveRubric({
    id: b.id ? Number(b.id) : undefined,
    name: str(b.name, 'Name', 100),
    criteria,
    rules: typeof b.rules === 'string' ? b.rules.slice(0, 5000) : '',
    pass_threshold: num(b.pass_threshold, 'Pass threshold', 1, 5),
  });
  return { id };
});
