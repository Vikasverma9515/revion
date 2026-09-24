import { handle, HttpError, idParam } from '#/lib/lab/api';
import { getDataset, listGolden } from '#/lib/lab/store';

export const runtime = 'nodejs';

export const GET = handle(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const id = await idParam(params);
  const dataset = await getDataset(id);
  if (!dataset) throw new HttpError(404, 'Unknown dataset.');
  return { dataset, items: await listGolden(id) };
});
