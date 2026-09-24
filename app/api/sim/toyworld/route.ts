// P1b: run the toy world and stream the three rates as they settle.
import { simulateToy, TOY_BASE } from '#/lib/sim/toyworld';
import { int, num, sseResponse, tick } from '#/lib/sse';

export const runtime = 'nodejs';
export const maxDuration = 60;

export function GET(request: Request) {
  const q = new URL(request.url).searchParams;
  const p = {
    pi: num(q, 'pi', TOY_BASE.pi, 0, 1),
    h: num(q, 'h', TOY_BASE.h, 0, 0.99),
    piH: num(q, 'piH', TOY_BASE.piH, 0, 1),
    s: num(q, 's', TOY_BASE.s, 0, 1),
    f: num(q, 'f', TOY_BASE.f, 0, 1),
    e0: num(q, 'e0', TOY_BASE.e0, 0, 0.5),
    e1: num(q, 'e1', TOY_BASE.e1, 0, 0.5),
    judgeSe: num(q, 'judgeSe', TOY_BASE.judgeSe, 0, 1),
    judgeSp: num(q, 'judgeSp', TOY_BASE.judgeSp, 0, 1),
    nCal: int(q, 'nCal', TOY_BASE.nCal, 400, 1_000_000),
    nProd: int(q, 'nProd', TOY_BASE.nProd, 1_000, 1_000_000),
  };
  const seed = int(q, 'seed', 100, 0, 2 ** 31);

  return sseResponse(async (send, overBudget) => {
    send('start', { seed, params: p });
    for (const step of simulateToy(p, seed, 20_000)) {
      send('progress', step);
      await tick();
      if (overBudget() && step.done < step.total) {
        send('stopped', { message: 'Stopped early to stay inside the time limit; the last numbers shown are partial.' });
        return;
      }
    }
  });
}
