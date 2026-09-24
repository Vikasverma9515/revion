import 'server-only';

/** fetch with retries on 429 / 5xx, honouring Retry-After (capped). */
export async function fetchRetry(url: string, init: RequestInit, label: string, tries = 3): Promise<Response> {
  let last = '';
  for (let attempt = 0; attempt < tries; attempt++) {
    const res = await fetch(url, { ...init, signal: AbortSignal.timeout(45_000) });
    if (res.ok) return res;
    last = `${res.status} ${errorMessage(await res.text())}`;
    if (res.status !== 429 && res.status < 500) break;
    const after = Number(res.headers.get('retry-after'));
    const wait = Math.min(8_000, Number.isFinite(after) && after > 0 ? after * 1000 : 1000 * 2 ** attempt);
    await new Promise((r) => setTimeout(r, wait));
  }
  throw new Error(`${label} request failed: ${last}`);
}

/** The provider's error message, not the whole JSON body. */
function errorMessage(body: string) {
  try {
    const e = JSON.parse(body).error;
    return String(e?.message ?? e ?? body).slice(0, 300);
  } catch {
    return body.slice(0, 300);
  }
}
