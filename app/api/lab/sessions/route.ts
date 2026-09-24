import { handle } from '#/lib/lab/api';
import { listSessions } from '#/lib/lab/store';

export const runtime = 'nodejs';

export const GET = handle(async (req: Request) => {
  const agentId = Number(new URL(req.url).searchParams.get('agentId')) || undefined;
  return listSessions(agentId);
});
