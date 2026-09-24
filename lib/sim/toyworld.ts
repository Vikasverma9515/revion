// Problem 1 (b): what does the Rogan-Gladen estimate track?
// Port of reference/python/problem1_b_assumption.py (see its docstring).
import { Rng } from '#/lib/stats/rng';

export type ToyParams = {
  pi: number; // true violation rate
  h: number; // share of ambiguous items
  piH: number; // true violation rate among ambiguous items
  s: number; // P(shared impression says "violation") on ambiguous items
  f: number; // P(judge shares the impression) on ambiguous items
  e0: number; // per-annotator false-positive rate
  e1: number; // per-annotator false-negative rate
  judgeSe: number;
  judgeSp: number;
  nCal: number;
  nProd: number;
};

export const TOY_BASE: ToyParams = {
  pi: 0.034, h: 0, piH: 0, s: 0, f: 1, e0: 0.01, e1: 0.05,
  judgeSe: 0.85, judgeSp: 0.94, nCal: 200_000, nProd: 200_000,
};

export const TOY_SCENARIOS: { name: string; over: Partial<ToyParams> }[] = [
  { name: 'Clean annotators, no ambiguity', over: {} },
  { name: 'Noisy annotators, no ambiguity', over: { e0: 0.03, e1: 0.2 } },
  { name: 'Ambiguous items read as violations', over: { h: 0.1, piH: 0.1, s: 0.5 } },
  { name: 'Ambiguous items read as clean', over: { h: 0.1, piH: 0.2, s: 0.03 } },
  { name: 'As row 3, judge reads the truth instead', over: { h: 0.1, piH: 0.1, s: 0.5, f: 0 } },
  { name: 'Noise and ambiguity together', over: { h: 0.05, piH: 0.3, s: 0.1, e0: 0.02, e1: 0.15 } },
];

/** P(majority of 3 is right) when each annotator is right with prob 1-err. */
export function majorityAccuracy(err: number) {
  const a = 1 - err;
  return a ** 3 + 3 * a ** 2 * (1 - a);
}

export function toyFormulas(p: ToyParams) {
  const a0 = majorityAccuracy(p.e0);
  const a1 = majorityAccuracy(p.e1);
  const sharedBias = p.h * (p.s - p.piH);
  const piStar = p.pi + sharedBias; // the rate annotators perceive
  const noiseBias = (1 - a0) * (1 - piStar) - (1 - a1) * piStar;
  return { a0, a1, sharedBias, noiseBias, annotatorRateExpected: p.pi + sharedBias + noiseBias };
}

export function clearRate(p: ToyParams) {
  return (p.pi - p.h * p.piH) / (1 - p.h);
}

/** Returns [truth, majority, judge flag]. Draw order matches the Python. */
function drawItem(rng: Rng, p: ToyParams, piClear: number): [boolean, boolean, boolean] {
  const ambiguous = rng.uniform() < p.h;
  const truth = rng.uniform() < (ambiguous ? p.piH : piClear);
  const impression = ambiguous ? rng.uniform() < p.s : truth;
  let votes = 0;
  for (let i = 0; i < 3; i++) {
    const u = rng.uniform();
    if (impression ? u >= p.e1 : u < p.e0) votes++;
  }
  const majority = votes >= 2;
  const judgeSees = ambiguous && rng.uniform() < p.f ? impression : truth;
  const flag = rng.uniform() < (judgeSees ? p.judgeSe : 1 - p.judgeSp);
  return [truth, majority, flag];
}

export type ToyResult = {
  trueRate: number;
  annotatorRate: number;
  roganGladen: number;
  judgeRate: number;
  J: number;
  calSensitivity: number;
  calSpecificity: number;
};

export type ToyProgress = { phase: 'calibration' | 'production'; done: number; total: number; partial?: ToyResult };

/** Streams progress; the last yield carries the full result in `partial`. */
export function* simulateToy(p: ToyParams, seed: number, every = 20_000): Generator<ToyProgress> {
  const piClear = clearRate(p);
  if (!(piClear >= 0 && piClear <= 1)) {
    throw new Error('pi, h and pi_h are inconsistent: the clear-item rate falls outside [0, 1].');
  }
  const rng = new Rng(seed);
  const total = p.nCal + p.nProd;
  let tp = 0, fn = 0, tn = 0, fp = 0;
  for (let i = 1; i <= p.nCal; i++) {
    const [, m, j] = drawItem(rng, p, piClear);
    if (m) j ? tp++ : fn++;
    else j ? fp++ : tn++;
    if (i % every === 0) yield { phase: 'calibration', done: i, total };
  }
  const se = tp / (tp + fn);
  const sp = tn / (tn + fp);
  let trueN = 0, majN = 0, flagN = 0;
  for (let i = 1; i <= p.nProd; i++) {
    const [t, m, j] = drawItem(rng, p, piClear);
    if (t) trueN++;
    if (m) majN++;
    if (j) flagN++;
    if (i % every === 0 || i === p.nProd) {
      const q = flagN / i;
      yield {
        phase: 'production',
        done: p.nCal + i,
        total,
        partial: {
          trueRate: trueN / i,
          annotatorRate: majN / i,
          roganGladen: (q + sp - 1) / (se + sp - 1),
          judgeRate: q,
          J: se + sp - 1,
          calSensitivity: se,
          calSpecificity: sp,
        },
      };
    }
  }
}

export function runToy(p: ToyParams, seed: number): ToyResult {
  let last: ToyResult | undefined;
  for (const step of simulateToy(p, seed)) if (step.partial) last = step.partial;
  return last!;
}
