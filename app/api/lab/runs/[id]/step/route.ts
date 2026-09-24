// Process pending items of a run for up to ~40 s; the client calls again until done.
import { handle, idParam } from '#/lib/lab/api';
import { step } from '#/lib/lab/runner';

export const runtime = 'nodejs';
export const maxDuration = 60;

export const POST = handle(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => step(await idParam(params)));
