import { handle, HttpError, idParam } from '#/lib/lab/api';
import { deleteSession, getSession, listMessages } from '#/lib/lab/store';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ id: string }> };

export const GET = handle(async (_req: Request, { params }: Ctx) => {
  const id = await idParam(params);
  const session = await getSession(id);
  if (!session) throw new HttpError(404, 'Unknown session.');
  return { session, messages: await listMessages(id) };
});

export const DELETE = handle(async (_req: Request, { params }: Ctx) => {
  await deleteSession(await idParam(params));
});
