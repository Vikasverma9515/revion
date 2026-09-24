import { handle, str } from '#/lib/lab/api';
import { createDataset, deleteDataset, listDatasets } from '#/lib/lab/store';

export const runtime = 'nodejs';

export const GET = handle(listDatasets);

export const POST = handle(async (req: Request) => {
  const b = await req.json();
  return { id: await createDataset(str(b.name, 'Name', 100), typeof b.description === 'string' ? b.description : '') };
});

export const DELETE = handle(async (req: Request) => {
  await deleteDataset(Number(new URL(req.url).searchParams.get('id')));
});
