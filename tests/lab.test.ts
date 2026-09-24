// Eval Lab logic that needs no API keys or database.
import { describe, expect, it } from 'vitest';
import { calculate } from '#/lib/lab/agent';
import { cohenKappa, consensus, humanAgreement, percentile, summarize } from '#/lib/lab/stats';
import type { Judgment, Result } from '#/lib/lab/store';

describe('calculator tool', () => {
  it('evaluates arithmetic and whitelisted functions', () => {
    expect(calculate('0.17 * 2000000')).toBeCloseTo(340000);
    expect(calculate('(3.96/1.96)^2')).toBeCloseTo(4.082, 3);
    expect(calculate('sqrt(0.8333*0.1667/24)')).toBeCloseTo(0.0761, 4);
  });
  it('rejects anything else', () => {
    expect(() => calculate('process.exit()')).toThrow();
    expect(() => calculate('constructor')).toThrow();
    expect(() => calculate('"a"+1')).toThrow();
  });
});

describe('agreement statistics', () => {
  it("Cohen's kappa", () => {
    expect(cohenKappa([true, false, true, false], [true, false, true, false])).toBe(1);
    // 96% agreement at 6% prevalence each (the Problem 1 numbers) -> 0.645
    const n = 10_000, a: boolean[] = [], b: boolean[] = [];
    for (let i = 0; i < n; i++) {
      a.push(i < 600);
      b.push(i < 400 || (i >= 600 && i < 800));
    }
    expect(cohenKappa(a, b)).toBeCloseTo(0.645, 3);
  });
  it('human vs judge, with a Rogan-Gladen corrected pass rate', () => {
    // Problem 1 in "pass" terms: judge "flags" = passes.
    const pairs = [
      ...Array(20).fill({ human: true, judge: true }),
      ...Array(4).fill({ human: true, judge: false }),
      ...Array(352).fill({ human: false, judge: false }),
      ...Array(24).fill({ human: false, judge: true }),
    ];
    const h = humanAgreement(pairs, 0.09, 2_000_000);
    expect(h.sensitivity).toBeCloseTo(0.8333, 4);
    expect(h.specificity).toBeCloseTo(0.9362, 4);
    expect(h.corrected!.pi).toBeCloseTo(0.034, 4);
  });
  it('percentile', () => expect(percentile([1, 2, 3, 4, 5], 0.5)).toBe(3));
});

describe('run summary', () => {
  const j = (judge: string, pass: boolean, overall: number, error?: string): Judgment => ({ judge, pass, overall, scores: { A: overall }, reasons: {}, verdict: '', error });
  const r = (id: number, judgments: Judgment[], latency = 1000): Result => ({
    id, run_id: 1, position: id, question: 'q', reference: null, answer: 'a', context: [], golden_item_id: null, message_id: null,
    latency_ms: latency, tokens_in: 10, tokens_out: 5, judgments, status: 'done', error: null,
  });
  it('majority vote ignores errored judges; ties fail', () => {
    expect(consensus([j('a', true, 5), j('b', false, 2)])).toBe(false);
    expect(consensus([j('a', true, 5), j('b', false, 0, 'boom')])).toBe(true);
    expect(consensus([j('a', false, 0, 'x')])).toBeNull();
  });
  it('summarises pass rates, criteria and inter-judge kappa', () => {
    const results = [r(1, [j('a', true, 5), j('b', true, 4.5)]), r(2, [j('a', false, 2), j('b', false, 2.5)]), r(3, [j('a', true, 4), j('b', false, 3)], 3000)];
    const s = summarize(results, ['a', 'b'], ['A']);
    expect(s.judges[0].passRate).toBeCloseTo(2 / 3);
    expect(s.judges[1].criteria.A).toBeCloseTo(10 / 3);
    expect(s.consensusPassRate).toBeCloseTo(1 / 3);
    expect(s.interJudgeKappa).toBeCloseTo(0.4, 5);
    expect(s.tokensIn).toBe(30);
    expect(s.latencyP50).toBe(1000);
  });
});

import { delatex, prepareMath } from '#/ui/markdown';
describe('LaTeX cleanup', () => {
  it('turns common LaTeX into plain text', () => {
    expect(delatex('\\(\\kappa \\approx 0.645\\)')).toBe('κ ≈ 0.645');
    expect(delatex('\\frac{0.96-0.8872}{1-0.8872}')).toBe('(0.96-0.8872)/(1-0.8872)');
    expect(delatex('P(\\text{clean}) = 0.94')).toBe('P(clean) = 0.94');
    expect(delatex('\\frac{\\text{TP}}{\\text{Actual violations}}')).toBe('(TP)/(Actual violations)');
    expect(delatex('\\begin{aligned} a &= 1,\\\\ b &\\approx 2 \\end{aligned}')).toBe(' a = 1,  \n b ≈ 2 ');
    expect(delatex('\\partial\\pi/\\partial p')).toBe('∂π/∂ p');
  });
  it('keeps delimited math for KaTeX and cleans the rest', () => {
    expect(prepareMath('so \\(\\kappa = 0.645\\) and \\text{done}')).toBe('so $$\\kappa = 0.645$$ and done');
    expect(prepareMath('\\[x^2\\]')).toBe('\n$$\nx^2\n$$\n');
    expect(prepareMath('costs $5 and $10')).toBe('costs $5 and $10');
    expect(prepareMath('\\(\\text{3.4 %}\\)')).toBe('$$\\text{3.4 \\%}$$');
  });
});
