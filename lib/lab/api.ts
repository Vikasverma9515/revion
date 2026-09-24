import 'server-only';
import { MissingKeyError } from './config';
import { HttpError } from './validate';

/** Wrap a route handler: JSON out, errors as { error } with a useful status. */
export function handle<A extends unknown[]>(fn: (...args: A) => Promise<unknown>) {
  return async (...args: A) => {
    try {
      const out = await fn(...args);
      return out instanceof Response ? out : Response.json(out ?? { ok: true });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      const status = e instanceof MissingKeyError ? 503 : e instanceof HttpError ? e.status : 400;
      return Response.json({ error: message }, { status });
    }
  };
}
