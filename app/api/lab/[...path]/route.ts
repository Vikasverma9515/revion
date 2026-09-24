// Single entry point for the Eval Lab API; see lib/lab/handlers.ts.
import { handle, HttpError } from '#/lib/lab/api';
import { ROUTES } from '#/lib/lab/handlers';

export const runtime = 'nodejs';
export const maxDuration = 300;

type Ctx = { params: Promise<{ path: string[] }> };

function dispatch(method: string) {
  return handle(async (req: Request, { params }: Ctx) => {
    const path = (await params).path.join('/');
    for (const r of ROUTES) {
      const m = r.method === method && path.match(r.path);
      if (m) return r.fn(req, Number(m[1] ?? 0));
    }
    throw new HttpError(404, `No such endpoint: ${method} /api/lab/${path}`);
  });
}

export const GET = dispatch('GET');
export const POST = dispatch('POST');
export const DELETE = dispatch('DELETE');
