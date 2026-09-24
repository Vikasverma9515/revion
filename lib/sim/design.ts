// Problem 1 (c): stratified sampling design and interval coverage.
// Port of reference/python/problem1_c_design.py.
import { pyRound, quantile, Rng } from '#/lib/stats/rng';
import { Z95 } from '#/lib/stats/special';

export const SE_JUDGE = 20 / 24;
export const SP_JUDGE = 352 / 376;
export const PI_HAT = (0.09 + SP_JUDGE - 1) / (SE_JUDGE + SP_JUDGE - 1);

/** Bayes: violation rate among flagged (p1) and unflagged (p0). */
export function stratumRates(se: number, pi: number, q: number) {
  return { p1: (se * pi) / q, p0: ((1 - se) * pi) / (1 - q) };
}

/** n_h proportional to W_h * sqrt(p_h (1 - p_h)), rounded to sum to total. */
export function neyman(total: number, q: number, p1: number, p0: number) {
  const w1 = q * Math.sqrt(p1 * (1 - p1));
  const w0 = (1 - q) * Math.sqrt(p0 * (1 - p0));
  let n1 = pyRound((total * w1) / (w1 + w0));
  n1 = Math.min(total - 1, Math.max(1, n1));
  return { n1, n0: total - n1 };
}

export type Design = {
  p1: number;
  p0: number;
  n1: number;
  n0: number;
  halfWidth: number;
  expectedUnflaggedViolations: number;
  pZeroUnflagged: number;
};

export function design(total = 500, se = SE_JUDGE, pi = PI_HAT, q = 0.09): Design {
  const { p1, p0 } = stratumRates(se, pi, q);
  const { n1, n0 } = neyman(total, q, p1, p0);
  const variance = (q ** 2 * p1 * (1 - p1)) / n1 + ((1 - q) ** 2 * p0 * (1 - p0)) / n0;
  return {
    p1, p0, n1, n0,
    halfWidth: Z95 * Math.sqrt(variance),
    expectedUnflaggedViolations: n0 * p0,
    pZeroUnflagged: (1 - p0) ** n0,
  };
}

export type Interval = [number, number];
export type Method = 'wald' | 'agresti' | 'jeffreys';
export const METHODS: Method[] = ['wald', 'agresti', 'jeffreys'];

export function intervals(x1: number, n1: number, x0: number, n0: number, w1: number, rng: Rng, draws: number) {
  const w0 = 1 - w1;
  // Wald: plug-in variance; a stratum with 0 events contributes 0 variance.
  const a1 = x1 / n1, a0 = x0 / n0;
  let est = w1 * a1 + w0 * a0;
  let hw = Z95 * Math.sqrt((w1 ** 2 * a1 * (1 - a1)) / n1 + (w0 ** 2 * a0 * (1 - a0)) / n0);
  const wald: Interval = [est - hw, est + hw];
  // Agresti-Coull per stratum (add 2 successes and 2 failures), combined.
  const t1 = (x1 + 2) / (n1 + 4), t0 = (x0 + 2) / (n0 + 4);
  est = w1 * t1 + w0 * t0;
  hw = Z95 * Math.sqrt((w1 ** 2 * t1 * (1 - t1)) / (n1 + 4) + (w0 ** 2 * t0 * (1 - t0)) / (n0 + 4));
  const agresti: Interval = [est - hw, est + hw];
  // Jeffreys: Beta(x+0.5, n-x+0.5) posterior per stratum, combined by Monte
  // Carlo with the known weights; equal-tailed 2.5% / 97.5%.
  const combo: number[] = new Array(draws);
  for (let i = 0; i < draws; i++) {
    combo[i] = w1 * rng.beta(x1 + 0.5, n1 - x1 + 0.5) + w0 * rng.beta(x0 + 0.5, n0 - x0 + 0.5);
  }
  combo.sort((a, b) => a - b);
  const jeffreys: Interval = [quantile(combo, 0.025), quantile(combo, 0.975)];
  return { wald, agresti, jeffreys };
}

export type CoverageParams = {
  piTrue: number;
  n1: number;
  n0: number;
  seed: number;
  replays: number;
  draws: number;
  se?: number;
  sp?: number;
};

export type CoverageProgress = {
  pi: number;
  q: number;
  done: number;
  replays: number;
  wald: number;
  agresti: number;
  jeffreys: number;
  zeroUnflagged: number;
};

/**
 * Fixed design (n1, n0). The true world has prevalence piTrue and the
 * judge's calibrated Se / Sp, so the weights are the flag rate q(piTrue).
 */
export function* coverage(c: CoverageParams, every = 250): Generator<CoverageProgress> {
  const se = c.se ?? SE_JUDGE, sp = c.sp ?? SP_JUDGE;
  const rng = new Rng(c.seed);
  const q = c.piTrue * se + (1 - c.piTrue) * (1 - sp);
  const { p1, p0 } = stratumRates(se, c.piTrue, q);
  const hits = { wald: 0, agresti: 0, jeffreys: 0 };
  let zero = 0;
  for (let i = 1; i <= c.replays; i++) {
    const x1 = rng.binomial(c.n1, p1);
    const x0 = rng.binomial(c.n0, p0);
    if (x0 === 0) zero++;
    const ci = intervals(x1, c.n1, x0, c.n0, q, rng, c.draws);
    for (const m of METHODS) if (ci[m][0] <= c.piTrue && c.piTrue <= ci[m][1]) hits[m]++;
    if (i % every === 0 || i === c.replays) {
      yield {
        pi: c.piTrue, q, done: i, replays: c.replays,
        wald: hits.wald / i, agresti: hits.agresti / i, jeffreys: hits.jeffreys / i,
        zeroUnflagged: zero / i,
      };
    }
  }
}

export const PREVALENCE_GRID = [0.01, 0.02, 0.034, 0.05, 0.08];

export function runCoverage(c: CoverageParams): CoverageProgress {
  let last: CoverageProgress | undefined;
  for (const step of coverage(c)) last = step;
  return last!;
}
