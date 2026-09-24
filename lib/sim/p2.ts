// Problem 2 (a, c): two-proportion z-test and golden-set bias.
// Port of reference/python/problem2.py and problem2_direction_check.py.
import { Rng } from '#/lib/stats/rng';
import { twoSidedP, Z95 } from '#/lib/stats/special';

export function twoProportion(x1: number, n1: number, x2: number, n2: number) {
  const p1 = x1 / n1, p2 = x2 / n2;
  const pooled = (x1 + x2) / (n1 + n2);
  const sePooled = Math.sqrt(pooled * (1 - pooled) * (1 / n1 + 1 / n2));
  const z = (p2 - p1) / sePooled;
  const seDiff = Math.sqrt((p1 * (1 - p1)) / n1 + (p2 * (1 - p2)) / n2); // unpooled, for the CI
  return {
    p1, p2, diff: p2 - p1, sePooled, z,
    pValue: twoSidedP(z),
    lo: p2 - p1 - Z95 * seDiff,
    hi: p2 - p1 + Z95 * seDiff,
    // Clustering inflates variance by the design effect; z shrinks by sqrt(deff).
    deffBreakEven: (z / Z95) ** 2,
  };
}

export type GoldenParams = {
  queries: number;
  f: number; // share of relevant docs outside the old top 20 (never judged)
  old10: number; // among judged relevant docs, share in the old top 10
  k: number; // P(new top 10 | old top 10)
  m: number; // P(new top 10 | old ranks 11-20)
  c: number; // P(new top 10 | outside old top 20)
};

export const GOLDEN_BASE: GoldenParams = { queries: 1200, f: 0.2, old10: 0.71, k: 0.9, m: 0.49, c: 0.3 };

export type QueryRecall = { oldMeasured: number; newMeasured: number; oldTrue: number; newTrue: number };

export type GoldenResult = QueryRecall & {
  queriesKept: number;
  measuredGain: number;
  trueGain: number;
  perQuery?: QueryRecall[];
};

export function goldenSet(p: GoldenParams, seed: number, keepQueries = 0): GoldenResult {
  const rng = new Rng(seed);
  const sums = { oldMeasured: 0, newMeasured: 0, oldTrue: 0, newTrue: 0 };
  let kept = 0;
  const perQuery: QueryRecall[] = [];
  for (let qi = 0; qi < p.queries; qi++) {
    const r = 1 + Math.floor(rng.uniform() * 10);
    let judged = 0, oldHits = 0, newJudged = 0, newUnjudged = 0;
    for (let d = 0; d < r; d++) {
      if (rng.uniform() < p.f) {
        // outside the old top 20: relevant but never labelled
        if (rng.uniform() < p.c) newUnjudged++;
        continue;
      }
      judged++;
      if (rng.uniform() < p.old10) {
        oldHits++;
        if (rng.uniform() < p.k) newJudged++;
      } else if (rng.uniform() < p.m) {
        newJudged++;
      }
    }
    if (judged === 0) continue; // cannot be in the golden set
    kept++;
    const q: QueryRecall = {
      oldMeasured: oldHits / judged,
      newMeasured: newJudged / judged,
      oldTrue: oldHits / r,
      newTrue: (newJudged + newUnjudged) / r,
    };
    sums.oldMeasured += q.oldMeasured;
    sums.newMeasured += q.newMeasured;
    sums.oldTrue += q.oldTrue;
    sums.newTrue += q.newTrue;
    if (perQuery.length < keepQueries) perQuery.push(q);
  }
  const out: GoldenResult = {
    oldMeasured: sums.oldMeasured / kept,
    newMeasured: sums.newMeasured / kept,
    oldTrue: sums.oldTrue / kept,
    newTrue: sums.newTrue / kept,
    queriesKept: kept,
    measuredGain: 0,
    trueGain: 0,
  };
  out.measuredGain = out.newMeasured - out.oldMeasured;
  out.trueGain = out.newTrue - out.oldTrue;
  if (keepQueries) out.perQuery = perQuery;
  return out;
}

export const F_GRID = [0.1, 0.2, 0.3];
export const C_GRID = [0.1, 0.25, 0.4];
export const K_GRID = [0.85, 0.9, 0.95];

export type SweepRow = { f: number; c: number; k: number; m: number; measuredGain: number; trueGain: number; understated: boolean };

/**
 * 27 settings; m is set so the new system's measured recall stays near
 * `targetNew`. Yields one row at a time.
 */
export function* sweep(seed = 400, base: GoldenParams = GOLDEN_BASE, targetNew = 0.78): Generator<SweepRow> {
  let i = 0;
  for (const f of F_GRID) {
    for (const c of C_GRID) {
      for (const k of K_GRID) {
        const m = (targetNew - base.old10 * k) / (1 - base.old10);
        const g = goldenSet({ ...base, f, c, k, m }, seed + i);
        i++;
        yield { f, c, k, m, measuredGain: g.measuredGain, trueGain: g.trueGain, understated: g.measuredGain < g.trueGain };
      }
    }
  }
}
