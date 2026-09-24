// The TypeScript port must reproduce the Python reference scripts exactly
// (same seed -> same draws -> same numbers). Fixtures come from
// scripts/make-fixtures.sh.
import { describe, expect, it } from 'vitest';
import rngFx from '#/lib/__fixtures__/rng.json';
import abFx from '#/lib/__fixtures__/problem1_ab.json';
import toyFx from '#/lib/__fixtures__/problem1_b_assumption.json';
import cFx from '#/lib/__fixtures__/problem1_c_design.json';
import p2Fx from '#/lib/__fixtures__/problem2.json';
import sweepFx from '#/lib/__fixtures__/problem2_direction_check.json';
import { Rng } from '#/lib/stats/rng';
import { CALIBRATION, replay, roganGladen } from '#/lib/sim/p1ab';
import { runToy, TOY_BASE, TOY_SCENARIOS } from '#/lib/sim/toyworld';
import { design, PREVALENCE_GRID, runCoverage } from '#/lib/sim/design';
import { GOLDEN_BASE, goldenSet, sweep, twoProportion } from '#/lib/sim/p2';

const close = (a: number, b: number, tol = 1e-12) => expect(Math.abs(a - b)).toBeLessThanOrEqual(tol);

describe('rng matches rng.py', () => {
  it('draw for draw', () => {
    const r = new Rng(42);
    rngFx.uniform.forEach((u) => close(r.uniform(), u, 0));
    rngFx.normal.forEach((z) => close(r.normal(), z));
    rngFx.binomial_small.forEach((x) => expect(r.binomial(316, 0.00623)).toBe(x));
    rngFx.binomial_large.forEach((x) => expect(r.binomial(2_000_000, 0.09)).toBe(x));
    [0.5, 2.5, 20.5].forEach((a, i) => close(r.gamma(a), rngFx.gamma[i]));
    rngFx.beta.forEach((b) => close(r.beta(2.5, 314.5), b));
  });
});

describe('problem1_ab.py', () => {
  it('Rogan-Gladen fit', () => {
    const r = roganGladen(CALIBRATION);
    close(r.pi, abFx.fit.pi);
    close(r.se, abFx.fit.se);
    close(r.share.specificity, abFx.fit.share.specificity);
  });
  it('replay, seed 1', () => {
    const fit = roganGladen(CALIBRATION);
    const steps = [...replay({ seed: 1, replays: 2000, piTrue: fit.pi, seTrue: fit.sensitivity, spTrue: fit.specificity, nPos: 24, nNeg: 376, nProd: 2_000_000 })];
    const last = steps[steps.length - 1];
    expect(last.coverage).toBe(abFx.replay_seed1_2000.coverage);
    expect(last.lowerBelowZero).toBe(abFx.replay_seed1_2000.lower_below_zero);
  });
});

describe('problem1_b_assumption.py', () => {
  TOY_SCENARIOS.forEach((sc, i) => {
    it(sc.name, () => {
      const r = runToy({ ...TOY_BASE, ...sc.over }, 100 + i);
      const py = toyFx.scenarios[i];
      close(r.trueRate, py.true_rate);
      close(r.annotatorRate, py.annotator_rate);
      close(r.roganGladen, py.rogan_gladen, 1e-10);
    });
  });
});

describe('problem1_c_design.py', () => {
  it('design', () => {
    const d = design();
    expect([d.n1, d.n0]).toEqual([cFx.design.n1, cFx.design.n0]);
    close(d.halfWidth, cFx.design.half_width);
  });
  it('coverage grid', () => {
    const d = design();
    PREVALENCE_GRID.forEach((pi, i) => {
      const c = runCoverage({ piTrue: pi, n1: d.n1, n0: d.n0, seed: 200 + i, replays: 2000, draws: 1000 });
      const py = cFx.coverage[i];
      expect([c.wald, c.agresti, c.jeffreys]).toEqual([py.wald, py.agresti, py.jeffreys]);
    });
  }, 60_000);
});

describe('problem2.py / problem2_direction_check.py', () => {
  it('z-test', () => {
    const t = twoProportion(240, 3000, 330, 3000);
    close(t.z, p2Fx.ztest.z);
    close(t.pValue, p2Fx.ztest.p_value, 1e-8); // browser erfc approximation
  });
  it('golden set', () => {
    const g = goldenSet(GOLDEN_BASE, 300);
    close(g.measuredGain, p2Fx.golden.measured_gain);
    close(g.trueGain, p2Fx.golden.true_gain);
  });
  it('sweep', () => {
    const rows = [...sweep()];
    rows.forEach((r, i) => close(r.trueGain, sweepFx.rows[i].true_gain));
    expect(rows.filter((r) => r.understated).length).toBe(sweepFx.understated);
  });
});
