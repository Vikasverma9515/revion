import { handle, str } from '#/lib/lab/api';
import { createRun } from '#/lib/lab/runner';
import { listRuns, type RunSource } from '#/lib/lab/store';

export const runtime = 'nodejs';

export const GET = handle(listRuns);

export const POST = handle(async (req: Request) => {
  const b = await req.json();
  const source: RunSource =
    b.source?.kind === 'dataset'
      ? { kind: 'dataset', datasetId: Number(b.source.datasetId) }
      : { kind: 'sessions', sessionIds: Array.isArray(b.source?.sessionIds) ? b.source.sessionIds.map(Number) : 'all' };
  const judges = (Array.isArray(b.judges) ? b.judges : []).map(String).filter(Boolean).slice(0, 4);
  const id = await createRun({
    name: str(b.name, 'Run name', 120),
    agentId: Number(b.agentId),
    rubricId: Number(b.rubricId),
    source,
    judges,
    limit: Number(b.limit) || undefined,
  });
  return { id };
});
