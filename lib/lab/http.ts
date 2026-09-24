import 'server-only';

/** fetch with retries on 429 / 5xx, honouring Retry-After (capped). */
export async function fetchRetry(url: string, init: RequestInit, label: string, tries = 4): Promise<Response> {
  let last = '';
  for (let attempt = 0; attempt < tries; attempt++) {
    const res = await fetch(url, { ...init, signal: AbortSignal.timeout(60_000) });
    if (res.ok) return res;
    last = `${res.status} ${(await res.text()).slice(0, 400)}`;
    if (res.status !== 429 && res.status < 500) break;
    const after = Number(res.headers.get('retry-after'));
    const wait = Math.min(20_000, Number.isFinite(after) && after > 0 ? after * 1000 : 1500 * 2 ** attempt);
    await new Promise((r) => setTimeout(r, wait));
  }
  throw new Error(`${label} request failed: ${last}`);
}
