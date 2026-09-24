// Input checks shared by the browser-side store and the server routes.
export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

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
