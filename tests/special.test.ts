import { describe, expect, it } from 'vitest';
import { betaCdf, betaQuantile, jeffreysInterval, normalCdf } from '#/lib/stats/special';
import { kappa } from '#/lib/sim/p1ab';
import { toyFormulas, TOY_BASE } from '#/lib/sim/toyworld';

// Reference values from scipy.stats 1.x (beta.ppf / beta.cdf / norm.cdf).
describe('special functions', () => {
  it('beta quantiles', () => {
    expect(betaQuantile(0.025, 2.5, 314.5)).toBeCloseTo(0.00131747183143173, 10);
    expect(betaQuantile(0.975, 2.5, 314.5)).toBeCloseTo(0.020147299880935936, 10);
    expect(betaQuantile(0.975, 0.5, 316.5)).toBeCloseTo(0.007911434976694156, 10);
    expect(betaQuantile(0.025, 58.5, 126.5)).toBeCloseTo(0.2513690205670515, 10);
    expect(betaQuantile(0.975, 58.5, 126.5)).toBeCloseTo(0.3848272857815165, 10);
  });
  it('beta cdf', () => expect(betaCdf(0.3, 2, 5)).toBeCloseTo(0.579825, 10));
  it('Jeffreys with zero events has lower bound 0', () => {
    const [lo, hi] = jeffreysInterval(0, 316);
    expect(lo).toBe(0);
    expect(hi).toBeCloseTo(0.007911434976694156, 10);
  });
  it('normal cdf', () => expect(normalCdf(1.959963984540054)).toBeCloseTo(0.975, 6));
});

describe('kappa', () => {
  it('prevalence range 5%..8%', () => {
    expect(kappa(0.96, 0.05).kappa).toBeCloseTo(0.5789, 4);
    expect(kappa(0.96, 0.08).kappa).toBeCloseTo(0.7283, 4);
  });
});

describe('toy-world formulas', () => {
  it('no ambiguity, perfect annotators: no bias', () => {
    const f = toyFormulas({ ...TOY_BASE, e0: 0, e1: 0 });
    expect(f.sharedBias).toBe(0);
    expect(f.noiseBias).toBe(0);
  });
});
