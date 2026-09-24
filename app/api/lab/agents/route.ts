import { handle, num, str } from '#/lib/lab/api';
import { listAgents, saveAgent } from '#/lib/lab/store';

export const runtime = 'nodejs';

export const GET = handle(listAgents);

export const POST = handle(async (req: Request) => {
  const b = await req.json();
  const id = await saveAgent({
    id: b.id ? Number(b.id) : undefined,
    name: str(b.name, 'Name', 100),
    model: str(b.model, 'Model', 200),
    system_prompt: str(b.system_prompt, 'System prompt', 10_000),
    temperature: num(b.temperature, 'Temperature', 0, 2),
    top_k: Math.round(num(b.top_k, 'Top-k', 1, 20)),
    allow_general: b.allow_general ? 1 : 0,
  });
  return { id };
});
