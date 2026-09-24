// Acceptance checks. Shared by the unit tests and the Verify panel, so the
// badges on the site are the same assertions the test suite runs.
import toyFixture from '#/lib/__fixtures__/problem1_b_assumption.json';
import sweepFixture from '#/lib/__fixtures__/problem2_direction_check.json';
import { CALIBRATION, kappa, roganGladen } from '#/lib/sim/p1ab';
import { design, PREVALENCE_GRID, runCoverage } from '#/lib/sim/design';
import { runToy, TOY_BASE, TOY_SCENARIOS } from '#/lib/sim/toyworld';
import { sweep, twoProportion } from '#/lib/sim/p2';

export type Check = {
  id: string;
  section: string; // href of the page that explains it
  label: string;
  expected: string;
  actual: string;
  pass: boolean;
};

const near = (x: number, target: number, tol: number) => Math.abs(x - target) <= tol;
const pct = (x: number, d = 2) => `${(x * 100).toFixed(d)}%`;

type Spec = { id: string; section: string; label: string; run: () => Omit<Check, 'id' | 'section' | 'label'> };

const SPECS: Spec[] = [
  {
    id: 'se-sp', section: '/estimator', label: 'Sensitivity and specificity',
    run: () => {
      const r = roganGladen(CALIBRATION);
      return {
        expected: '0.8333 / 0.9362',
        actual: `${r.sensitivity.toFixed(4)} / ${r.specificity.toFixed(4)}`,
        pass: near(r.sensitivity, 0.8333, 5e-5) && near(r.specificity, 0.9362, 5e-5),
      };
    },
  },
  {
    id: 'rg', section: '/estimator', label: 'Rogan-Gladen estimate, SE and 95% CI',
    run: () => {
      const r = roganGladen(CALIBRATION);
      return {
        expected: 'π 0.0340, SE 0.0162, CI [0.23%, 6.57%]',
        actual: `π ${r.pi.toFixed(4)}, SE ${r.se.toFixed(4)}, CI [${pct(r.lo)}, ${pct(r.hi)}]`,
        pass: near(r.pi, 0.034, 5e-5) && near(r.se, 0.0162, 5e-5) && near(r.lo, 0.0023, 5e-5) && near(r.hi, 0.0657, 5e-5),
      };
    },
  },
  {
    id: 'shares', section: '/estimator', label: 'Variance shares (flag rate / specificity / sensitivity)',
    run: () => {
      const s = roganGladen(CALIBRATION).share;
      return {
        expected: '≈ 0.03% / 95.7% / 4.3%',
        actual: `${pct(s.flagRate)} / ${pct(s.specificity, 1)} / ${pct(s.sensitivity, 1)}`,
        pass: near(s.flagRate, 0.0003, 5e-5) && near(s.specificity, 0.957, 5e-4) && near(s.sensitivity, 0.043, 5e-4),
      };
    },
  },
  {
    id: 'kappa', section: '/assumption', label: "Cohen's kappa at 6% prevalence",
    run: () => {
      const k = kappa(0.96, 0.06).kappa;
      return { expected: '0.645', actual: k.toFixed(3), pass: near(k, 0.645, 5e-4) };
    },
  },
  {
    id: 'toy', section: '/assumption', label: 'Toy-world biases match problem1_b_assumption.py',
    run: () => {
      let worst = 0;
      TOY_SCENARIOS.forEach((sc, i) => {
        const r = runToy({ ...TOY_BASE, ...sc.over }, 100 + i);
        const py = toyFixture.scenarios[i];
        worst = Math.max(worst, Math.abs(r.roganGladen - r.trueRate - py.bias_vs_truth));
      });
      return {
        expected: 'same numbers as Python, 6 scenarios',
        actual: `largest difference ${worst.toExponential(1)}`,
        pass: worst < 1e-9,
      };
    },
  },
  {
    id: 'neyman', section: '/design', label: 'Neyman allocation and expected half-width',
    run: () => {
      const d = design();
      return {
        expected: '184 / 316, ±0.99 points',
        actual: `${d.n1} / ${d.n0}, ±${(d.halfWidth * 100).toFixed(2)} points`,
        pass: d.n1 === 184 && d.n0 === 316 && near(d.halfWidth * 100, 0.99, 0.005),
      };
    },
  },
  {
    id: 'unflagged', section: '/design', label: 'Expected violations among unflagged; P(zero)',
    run: () => {
      const d = design();
      return {
        expected: '1.97; 0.139',
        actual: `${d.expectedUnflaggedViolations.toFixed(2)}; ${d.pZeroUnflagged.toFixed(3)}`,
        pass: near(d.expectedUnflaggedViolations, 1.97, 0.005) && near(d.pZeroUnflagged, 0.139, 5e-4),
      };
    },
  },
  {
    id: 'coverage', section: '/design', label: 'Coverage at π = 3.4% (2,000 replays, ±0.01 Monte Carlo)',
    run: () => {
      const d = design();
      const i = PREVALENCE_GRID.indexOf(0.034);
      const c = runCoverage({ piTrue: 0.034, n1: d.n1, n0: d.n0, seed: 200 + i, replays: 2000, draws: 1000 });
      const inRange = (x: number, lo: number, hi: number) => x >= lo - 0.01 && x <= hi + 0.01;
      return {
        expected: 'Wald 0.89–0.91, Agresti 0.92–0.955, Jeffreys 0.945–0.964',
        actual: `Wald ${c.wald.toFixed(3)}, Agresti ${c.agresti.toFixed(3)}, Jeffreys ${c.jeffreys.toFixed(3)}`,
        pass: inRange(c.wald, 0.89, 0.91) && inRange(c.agresti, 0.92, 0.955) && inRange(c.jeffreys, 0.945, 0.964),
      };
    },
  },
  {
    id: 'ztest', section: '/is-it-real', label: 'Two-proportion z-test, 240/3000 vs 330/3000',
    run: () => {
      const t = twoProportion(240, 3000, 330, 3000);
      return {
        expected: 'z 3.96, p ≈ 7e-5, CI [1.52, 4.48]',
        actual: `z ${t.z.toFixed(2)}, p ${t.pValue.toExponential(1)}, CI [${(t.lo * 100).toFixed(2)}, ${(t.hi * 100).toFixed(2)}]`,
        pass: near(t.z, 3.96, 0.005) && near(t.pValue, 7.4e-5, 1e-5) && near(t.lo * 100, 1.52, 0.005) && near(t.hi * 100, 4.48, 0.005),
      };
    },
  },
  {
    id: 'deff', section: '/is-it-real', label: 'Design effect where significance is lost',
    run: () => {
      const d = twoProportion(240, 3000, 330, 3000).deffBreakEven;
      return { expected: '≈ 4.1', actual: d.toFixed(2), pass: near(d, 4.1, 0.05) };
    },
  },
  {
    id: 'sweep', section: '/golden-set', label: 'Golden-set sweep matches problem2_direction_check.py',
    run: () => {
      const rows = [...sweep()];
      const count = rows.filter((r) => r.understated).length;
      const same = rows.every((r, i) => Math.abs(r.trueGain - sweepFixture.rows[i].true_gain) < 1e-12);
      return {
        expected: `measured < true in ${sweepFixture.understated} of 27 (Python)`,
        actual: `${count} of ${rows.length}`,
        pass: same && count === sweepFixture.understated,
      };
    },
  },
];

export const CHECK_IDS = SPECS.map((s) => ({ id: s.id, label: s.label, section: s.section }));

export function* runChecks(): Generator<Check> {
  for (const s of SPECS) {
    try {
      yield { id: s.id, section: s.section, label: s.label, ...s.run() };
    } catch (e) {
      yield { id: s.id, section: s.section, label: s.label, expected: '', actual: String(e), pass: false };
    }
  }
}
