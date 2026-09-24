// Agreement statistics between raters (judges and humans).
import { roganGladen } from '#/lib/sim/p1ab';
import type { Judgment, Result, RunSummary } from './store';

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

/** Majority of judges that returned a verdict; ties count as fail. */
export function consensus(j: Judgment[]) {
  const ok = j.filter((x) => !x.error);
  if (!ok.length) return null;
  return ok.filter((x) => x.pass).length * 2 > ok.length;
}

export function summarize(results: Result[], judges: string[], criteria: string[]): RunSummary {
  const done = results.filter((r) => r.status === 'done');
  const perJudge = judges.map((judge) => {
    const js = done.map((r) => r.judgments.find((j) => j.judge === judge)).filter((j): j is Judgment => !!j && !j.error);
    const mean = (f: (j: Judgment) => number) => (js.length ? js.reduce((a, j) => a + f(j), 0) / js.length : 0);
    return {
      judge,
      passRate: mean((j) => (j.pass ? 1 : 0)),
      meanOverall: mean((j) => j.overall),
      criteria: Object.fromEntries(criteria.map((c) => [c, mean((j) => j.scores[c] ?? 0)])),
      errors: done.length - js.length,
    };
  });
  const cons = done.map((r) => consensus(r.judgments)).filter((x): x is boolean => x !== null);
  // Mean pairwise Cohen's kappa between judges, on items both judged.
  let kappa: number | null = null;
  if (judges.length > 1) {
    const ks: number[] = [];
    for (let a = 0; a < judges.length; a++)
      for (let b = a + 1; b < judges.length; b++) {
        const both = done
          .map((r) => [r.judgments.find((j) => j.judge === judges[a]), r.judgments.find((j) => j.judge === judges[b])])
          .filter(([x, y]) => x && y && !x.error && !y.error) as [Judgment, Judgment][];
        const k = cohenKappa(both.map(([x]) => x.pass), both.map(([, y]) => y.pass));
        if (k !== null) ks.push(k);
      }
    kappa = ks.length ? ks.reduce((x, y) => x + y, 0) / ks.length : null;
  }
  const lat = done.map((r) => r.latency_ms ?? 0).filter((x) => x > 0);
  return {
    items: results.length,
    failed: results.filter((r) => r.status === 'failed').length,
    judges: perJudge,
    consensusPassRate: cons.length ? cons.filter(Boolean).length / cons.length : 0,
    interJudgeKappa: kappa,
    latencyP50: percentile(lat, 0.5),
    latencyP95: percentile(lat, 0.95),
    tokensIn: done.reduce((a, r) => a + (r.tokens_in ?? 0), 0),
    tokensOut: done.reduce((a, r) => a + (r.tokens_out ?? 0), 0),
  };
}
