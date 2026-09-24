// Problem 1 (a, b): Rogan-Gladen estimate, delta-method CI, kappa, replay.
// Port of reference/python/problem1_ab.py.
import { Rng } from '#/lib/stats/rng';
import { Z95 } from '#/lib/stats/special';

export type Calibration = { tp: number; fn: number; tn: number; fp: number; q: number; n: number };

export const CALIBRATION: Calibration = { tp: 20, fn: 4, tn: 352, fp: 24, q: 0.09, n: 2_000_000 };

export type VarianceParts = { flagRate: number; specificity: number; sensitivity: number };

export type RoganGladen = {
  sensitivity: number;
  specificity: number;
  J: number;
  pi: number;
  se: number;
  lo: number;
  hi: number;
  inputSe: VarianceParts;
  contributionSe: VarianceParts;
  share: VarianceParts;
};

export function roganGladen({ tp, fn, tn, fp, q, n }: Calibration): RoganGladen {
  const se = tp / (tp + fn);
  const sp = tn / (tn + fp);
  const J = se + sp - 1; // Youden's J
  const pi = (q + sp - 1) / J;
  const varQ = (q * (1 - q)) / n;
  const varSe = (se * (1 - se)) / (tp + fn);
  const varSp = (sp * (1 - sp)) / (tn + fp);
  // First-order delta method: dpi/dq = 1/J, dpi/dSp = (1-pi)/J, dpi/dSe = -pi/J
  const parts = {
    flagRate: varQ / J ** 2,
    specificity: ((1 - pi) ** 2 * varSp) / J ** 2,
    sensitivity: (pi ** 2 * varSe) / J ** 2,
  };
  const variance = parts.flagRate + parts.specificity + parts.sensitivity;
  const sePi = Math.sqrt(variance);
  return {
    sensitivity: se,
    specificity: sp,
    J,
    pi,
    se: sePi,
    lo: pi - Z95 * sePi,
    hi: pi + Z95 * sePi,
    inputSe: { flagRate: Math.sqrt(varQ), sensitivity: Math.sqrt(varSe), specificity: Math.sqrt(varSp) },
    contributionSe: {
      flagRate: Math.sqrt(parts.flagRate),
      specificity: Math.sqrt(parts.specificity),
      sensitivity: Math.sqrt(parts.sensitivity),
    },
    share: {
      flagRate: parts.flagRate / variance,
      specificity: parts.specificity / variance,
      sensitivity: parts.sensitivity / variance,
    },
  };
}

/** Cohen's kappa when both raters have the same marginal rate. */
export function kappa(pObserved: number, prevalence: number) {
  const pe = prevalence ** 2 + (1 - prevalence) ** 2;
  return { pe, kappa: (pObserved - pe) / (1 - pe) };
}

export type ReplayParams = {
  seed: number;
  replays: number;
  piTrue: number;
  seTrue: number;
  spTrue: number;
  nPos: number;
  nNeg: number;
  nProd: number;
};

export type ReplayProgress = { done: number; replays: number; coverage: number; lowerBelowZero: number };

/**
 * Redraw calibration and production counts; refit; check the CI.
 * Class counts (e.g. 24 / 376) are held fixed, as in the calibration design.
 * Yields running totals every `every` replays so callers can stream them.
 */
export function* replay(p: ReplayParams, every = 500): Generator<ReplayProgress> {
  const rng = new Rng(p.seed);
  const qTrue = p.piTrue * p.seTrue + (1 - p.piTrue) * (1 - p.spTrue);
  let covered = 0;
  let belowZero = 0;
  for (let i = 1; i <= p.replays; i++) {
    const tp = rng.binomial(p.nPos, p.seTrue);
    const tn = rng.binomial(p.nNeg, p.spTrue);
    const flags = rng.binomial(p.nProd, qTrue);
    const fit = roganGladen({ tp, fn: p.nPos - tp, tn, fp: p.nNeg - tn, q: flags / p.nProd, n: p.nProd });
    if (Number.isFinite(fit.se)) {
      // J = 0 can only happen in absurd draws; it counts as a miss.
      if (fit.lo <= p.piTrue && p.piTrue <= fit.hi) covered++;
      if (fit.lo < 0) belowZero++;
    }
    if (i % every === 0 || i === p.replays) {
      yield { done: i, replays: p.replays, coverage: covered / i, lowerBelowZero: belowZero / i };
    }
  }
}
