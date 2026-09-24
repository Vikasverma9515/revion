import 'server-only';
import { MissingKeyError } from './config';

/** Wrap a route handler: JSON out, errors as { error } with a useful status. */
export function handle<A extends unknown[]>(fn: (...args: A) => Promise<unknown>) {
  return async (...args: A) => {
    try {
      const out = await fn(...args);
      return out instanceof Response ? out : Response.json(out ?? { ok: true });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      const status = e instanceof MissingKeyError ? 503 : e instanceof HttpError ? e.status : 400;
      if (status >= 500 && !(e instanceof MissingKeyError)) console.error(e);
      return Response.json({ error: message }, { status });
    }
  };
}

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export const idParam = async (params: Promise<{ id: string }>) => {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(404, 'Not found.');
  return id;
};

export function str(v: unknown, name: string, max = 20_000): string {
  if (typeof v !== 'string' || !v.trim()) throw new Error(`${name} is required.`);
  if (v.length > max) throw new Error(`${name} is too long (max ${max} characters).`);
  return v.trim();
}

export function num(v: unknown, name: string, min: number, max: number): number {
  const n = Number(v);
  if (!Number.isFinite(n) || n < min || n > max) throw new Error(`${name} must be between ${min} and ${max}.`);
  return n;
}
