// P1c: coverage of Wald / Agresti-Coull / Jeffreys across true prevalence.
import { coverage, design, PREVALENCE_GRID, SE_JUDGE, SP_JUDGE } from '#/lib/sim/design';
import { DEFAULT_REPLAYS, int, MAX_REPLAYS, num, sseResponse, tick } from '#/lib/sse';

export const runtime = 'nodejs';
export const maxDuration = 60;

export function GET(request: Request) {
  const q = new URL(request.url).searchParams;
  const total = int(q, 'total', 500, 20, 20_000);
  const se = num(q, 'se', SE_JUDGE, 0.01, 1);
  const sp = num(q, 'sp', SP_JUDGE, 0.01, 1);
  const pi = num(q, 'pi', 0.034, 0.0001, 0.5);
  const flagRate = num(q, 'q', 0.09, 0.001, 0.999);
  const seed = int(q, 'seed', 200, 0, 2 ** 31);
  const replays = int(q, 'replays', DEFAULT_REPLAYS, 1, MAX_REPLAYS);
  const draws = int(q, 'draws', 1000, 100, 4000);

  return sseResponse(async (send, overBudget) => {
    // The design is fixed from the planning inputs; the truth then varies.
    const d = design(total, se, pi, flagRate);
    send('start', { seed, replays, draws, n1: d.n1, n0: d.n0, grid: PREVALENCE_GRID });
    for (let i = 0; i < PREVALENCE_GRID.length; i++) {
      const params = { piTrue: PREVALENCE_GRID[i], n1: d.n1, n0: d.n0, seed: seed + i, replays, draws, se, sp };
      for (const step of coverage(params, 100)) {
        send('progress', { index: i, ...step });
        await tick();
        if (overBudget() && !(i === PREVALENCE_GRID.length - 1 && step.done === replays)) {
          send('stopped', {
            message: `Stopped at π = ${(PREVALENCE_GRID[i] * 100).toFixed(1)}% after ${step.done} replays to stay inside the time limit. Lower the replay count or Jeffreys draws.`,
          });
          return;
        }
      }
    }
  });
}
