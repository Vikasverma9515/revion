// Server-Sent Events helper for the simulation route handlers.
//
// Vercel functions (Fluid compute) default to a 300 s limit; every route sets
// maxDuration = 60 and this helper stops early at BUDGET_MS with a clear
// "stopped" event, so a run never dies silently at the platform limit.
export const BUDGET_MS = 50_000;

export type Send = (event: string, data: unknown) => void;

export function sseResponse(run: (send: Send, overBudget: () => boolean) => Promise<void>) {
  const encoder = new TextEncoder();
  const started = Date.now();
  const stream = new ReadableStream({
    async start(controller) {
      const send: Send = (event, data) =>
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      try {
        await run(send, () => Date.now() - started > BUDGET_MS);
      } catch (e) {
        send('error', { message: e instanceof Error ? e.message : String(e) });
      }
      send('done', {});
      controller.close();
    },
  });
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}

/** Give the event loop a turn so queued chunks flush to the client. */
export const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

/** Read a number from the query string, clamped to [min, max]. */
export function num(params: URLSearchParams, key: string, fallback: number, min: number, max: number) {
  const raw = params.get(key);
  const x = raw === null || raw === '' ? fallback : Number(raw);
  if (!Number.isFinite(x)) return fallback;
  return Math.min(max, Math.max(min, x));
}

export const int = (params: URLSearchParams, key: string, fallback: number, min: number, max: number) =>
  Math.round(num(params, key, fallback, min, max));

export const MAX_REPLAYS = 20_000;
export const DEFAULT_REPLAYS = 2_000;
