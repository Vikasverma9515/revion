// P1a: replay the calibration + production study and stream CI coverage.
import { replay, roganGladen } from '#/lib/sim/p1ab';
import { DEFAULT_REPLAYS, int, MAX_REPLAYS, num, sseResponse, tick } from '#/lib/sse';

export const runtime = 'nodejs';
export const maxDuration = 60;

export function GET(request: Request) {
  const q = new URL(request.url).searchParams;
  const tp = int(q, 'tp', 20, 0, 100_000);
  const fn = int(q, 'fn', 4, 0, 100_000);
  const tn = int(q, 'tn', 352, 0, 100_000);
  const fp = int(q, 'fp', 24, 0, 100_000);
  const flagRate = num(q, 'q', 0.09, 0, 1);
  const n = int(q, 'n', 2_000_000, 1, 1e9);
  const seed = int(q, 'seed', 1, 0, 2 ** 31);
  const replays = int(q, 'replays', DEFAULT_REPLAYS, 1, MAX_REPLAYS);

  return sseResponse(async (send, overBudget) => {
    if (tp + fn === 0 || tn + fp === 0) throw new Error('Need at least one violation and one clean item.');
    // The world in which the point estimates are the truth.
    const fit = roganGladen({ tp, fn, tn, fp, q: flagRate, n });
    if (!(fit.J > 0)) throw new Error('Sensitivity + specificity must exceed 1 (J > 0) for Rogan-Gladen.');
    const piTrue = Math.min(1, Math.max(0, fit.pi));
    send('start', { seed, replays, piTrue });
    for (const step of replay({ seed, replays, piTrue, seTrue: fit.sensitivity, spTrue: fit.specificity, nPos: tp + fn, nNeg: tn + fp, nProd: n }, 250)) {
      send('progress', step);
      await tick();
      if (overBudget() && step.done < replays) {
        send('stopped', { message: `Stopped after ${step.done.toLocaleString()} replays to stay inside the time limit.` });
        return;
      }
    }
  });
}
