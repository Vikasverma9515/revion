import { handle, str } from '#/lib/lab/api';
import { search } from '#/lib/lab/knowledge';

export const runtime = 'nodejs';
export const maxDuration = 60;

export const GET = handle(async (req: Request) => {
  const q = new URL(req.url).searchParams;
  return search(str(q.get('q'), 'Query', 2000), Math.min(20, Number(q.get('k')) || 5));
});
