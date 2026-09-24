// Agreement statistics between raters (judges and humans).
import { roganGladen } from '#/lib/sim/p1ab';

/** Cohen's kappa for two binary raters with their own marginals. */
export function cohenKappa(a: boolean[], b: boolean[]): number | null {
  const n = a.length;
  if (n === 0 || n !== b.length) return null;
  let agree = 0, pa = 0, pb = 0;
  for (let i = 0; i < n; i++) {
    if (a[i] === b[i]) agree++;
    if (a[i]) pa++;
    if (b[i]) pb++;
  }
  const po = agree / n;
  const pe = (pa / n) * (pb / n) + (1 - pa / n) * (1 - pb / n);
  return pe === 1 ? (po === 1 ? 1 : 0) : (po - pe) / (1 - pe);
}

export function percentile(xs: number[], q: number) {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const pos = q * (s.length - 1);
  const lo = Math.floor(pos);
  return s[lo] + (pos - lo) * ((s[Math.min(lo + 1, s.length - 1)] ?? s[lo]) - s[lo]);
}

/**
 * Human labels vs the judge on the annotated items, and the judge's pass rate
 * on all items corrected for its errors (Rogan-Gladen, as in Problem 1).
 * "Positive" here means "pass".
 */
export function humanAgreement(pairs: { human: boolean; judge: boolean }[], judgePassRateAll: number, nAll: number) {
  let tp = 0, fn = 0, tn = 0, fp = 0;
  for (const p of pairs) {
    if (p.human && p.judge) tp++;
    else if (p.human) fn++;
    else if (p.judge) fp++;
    else tn++;
  }
  const n = pairs.length;
  const kappa = cohenKappa(pairs.map((p) => p.human), pairs.map((p) => p.judge));
  const humanPassRate = n ? (tp + fn) / n : 0;
  let corrected: { pi: number; lo: number; hi: number } | null = null;
  if (tp + fn > 0 && tn + fp > 0) {
    const fit = roganGladen({ tp, fn, tn, fp, q: judgePassRateAll, n: nAll });
    if (fit.J > 0) corrected = { pi: fit.pi, lo: fit.lo, hi: fit.hi };
  }
  return {
    n,
    tp, fn, tn, fp,
    agreement: n ? (tp + tn) / n : 0,
    kappa,
    sensitivity: tp + fn ? tp / (tp + fn) : null,
    specificity: tn + fp ? tn / (tn + fp) : null,
    humanPassRate,
    judgePassRateAll,
    corrected,
  };
}
