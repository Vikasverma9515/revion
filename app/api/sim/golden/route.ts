// P2c: golden-set bias. One run with per-query recalls, then the 27-setting sweep.
import { GOLDEN_BASE, goldenSet, sweep } from '#/lib/sim/p2';
import { int, num, sseResponse, tick } from '#/lib/sse';

export const runtime = 'nodejs';
export const maxDuration = 60;

export function GET(request: Request) {
  const q = new URL(request.url).searchParams;
  const p = {
    queries: int(q, 'queries', GOLDEN_BASE.queries, 50, 50_000),
    f: num(q, 'f', GOLDEN_BASE.f, 0, 0.95),
    old10: num(q, 'old10', GOLDEN_BASE.old10, 0, 1),
    k: num(q, 'k', GOLDEN_BASE.k, 0, 1),
    m: num(q, 'm', GOLDEN_BASE.m, 0, 1),
    c: num(q, 'c', GOLDEN_BASE.c, 0, 1),
  };
  const seed = int(q, 'seed', 300, 0, 2 ** 31);
  const sweepSeed = int(q, 'sweepSeed', 400, 0, 2 ** 31);

  return sseResponse(async (send, overBudget) => {
    send('result', { seed, params: p, ...goldenSet(p, seed, 400) });
    await tick();
    for (const row of sweep(sweepSeed)) {
      send('row', row);
      await tick();
      if (overBudget()) {
        send('stopped', { message: 'Sweep stopped early to stay inside the time limit.' });
        return;
      }
    }
  });
}
