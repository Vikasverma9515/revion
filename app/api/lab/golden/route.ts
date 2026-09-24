// Golden items: create or edit (optionally from a chat answer), delete.
import { handle, str } from '#/lib/lab/api';
import { deleteGolden, getDataset, saveGolden } from '#/lib/lab/store';

export const runtime = 'nodejs';

export const POST = handle(async (req: Request) => {
  const b = await req.json();
  const datasetId = Number(b.datasetId);
  if (!(await getDataset(datasetId))) throw new Error('Pick a dataset.');
  const id = await saveGolden({
    id: b.id ? Number(b.id) : undefined,
    dataset_id: datasetId,
    question: str(b.question, 'Question', 8000),
    reference: str(b.reference, 'Reference answer', 20_000),
    tags: typeof b.tags === 'string' ? b.tags.slice(0, 200) : '',
    source_message_id: b.sourceMessageId ? Number(b.sourceMessageId) : null,
  });
  return { id };
});

export const DELETE = handle(async (req: Request) => {
  await deleteGolden(Number(new URL(req.url).searchParams.get('id')));
});
