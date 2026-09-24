# Revion evaluation simulations

A small site that lets a reviewer open one URL and re-run, live, the simulations behind my answers to a
two-problem evaluation screen:

- **Problem 1, the guardrail number.** Correct an LLM judge's 9% flag rate to a true violation rate
  (Rogan-Gladen, delta-method CI), compute Cohen's kappa, test what the estimate tracks when the judge and
  annotators share blind spots, and design a stratified sample of 500 exact labels.
- **Problem 2, recall is up, users are unhappy.** Test whether 8% → 11% thumbs-down is real, and show what a
  golden set labelled only from the old system's top 20 hides.

Every input can be changed. Every simulation is seeded (mulberry32) and the seed is shown, so runs are
reproducible. The results are simulations of stated toy worlds, not production data.

**Live:** https://revion-REPLACE-ME.vercel.app <!-- replace with the Vercel production URL -->

## Run locally

```sh
npm i            # or: pnpm install
npm run dev      # http://localhost:3000
npm test         # unit + parity + acceptance tests (vitest)
npm run build    # production build
```

`npm run fixtures` regenerates the Python fixtures the tests compare against (needs only `python3`; about 90 s).

## Pages

| Route | What it does |
| --- | --- |
| `/` | The answers as cards, and a **Verify** panel that re-runs every acceptance number on the server |
| `/estimator` | P1a: Rogan-Gladen estimate, delta-method CI, variance shares, streamed 20,000-replay coverage check |
| `/assumption` | P1b: kappa calculator with prevalence sensitivity; toy world comparing truth, annotators' rate and the estimate |
| `/design` | P1c: Neyman allocation, expected half-width, P(zero unflagged), live Wald / Agresti-Coull / Jeffreys coverage |
| `/is-it-real` | P2a: two-proportion z-test with editable counts and a design-effect slider |
| `/golden-set` | P2c: per-query measured vs true recall, measured vs true gain, and the 27-setting sweep |
| `/about` | Method, assumptions and the reasoning in plain language |
| `/api/health` | Health check |

## How the TypeScript maps to the Python

`reference/python/` is the source of truth. The TypeScript is a line-by-line port. Both use the same RNG and draw
in the same order, so **the same seed gives identical numbers in both languages**. `tests/parity.test.ts` checks
this against JSON written by the Python scripts (`lib/__fixtures__/`).

| Python (`reference/python/`) | TypeScript | Used by |
| --- | --- | --- |
| `rng.py` (mulberry32, normal, binomial, gamma, beta, quantile) | `lib/stats/rng.ts` | everything |
| `problem1_ab.py` | `lib/sim/p1ab.ts` | `/estimator`, `/assumption` (kappa), `/api/sim/replay` |
| `problem1_b_assumption.py` | `lib/sim/toyworld.ts` | `/assumption`, `/api/sim/toyworld` |
| `problem1_c_design.py` | `lib/sim/design.ts` | `/design`, `/api/sim/coverage` |
| `problem2.py` | `lib/sim/p2.ts` (`twoProportion`, `goldenSet`) | `/is-it-real`, `/golden-set`, `/api/sim/golden` |
| `problem2_direction_check.py` | `lib/sim/p2.ts` (`sweep`) | `/golden-set`, `/api/sim/golden` |
| — | `lib/stats/special.ts` (normal CDF, Beta CDF/quantile) | browser-side Jeffreys bounds, p-values |
| — | `lib/verify.ts` | Verify panel and `tests/acceptance.test.ts` (same assertions) |

Each Python script runs on its own (`python3 problem1_ab.py`) and prints its results, or JSON with `--json`.
They use only the standard library.

## Architecture

- Next.js App Router, TypeScript, Tailwind. Charts are plain SVG. No database, auth, env vars, secrets or analytics.
- Closed-form numbers (estimate, CI, kappa, allocation, z-test) are computed in the browser as inputs change.
- Simulations run in Node.js Route Handlers (`app/api/sim/*`, `runtime = 'nodejs'`, `maxDuration = 60`) and stream
  progress as Server-Sent Events, so charts fill in live.
- Limits: replays default to 2,000 (20,000 on P1a) and are capped at 20,000. A run stops at 50 s with a clear
  message, inside the 60 s `maxDuration` and well inside Vercel's current function limit (300 s default with Fluid compute).
- Binomial draws sum Bernoullis for n ≤ 1,000. Above that they use a normal approximation rounded and clamped to
  [0, n], which is only used for the 2,000,000 production responses.
- Jeffreys intervals: per stratum Beta(x + ½, n − x + ½), combined with the known weights (0.09 / 0.91) by Monte
  Carlo draws, equal-tailed 2.5% / 97.5%. The Beta quantile function is tested against scipy values.

## Assumptions

1. Calibration and production traffic come from the same distribution, so the judge's sensitivity and specificity transfer.
2. In (a) the annotators' majority label is treated as the truth; the P1b toy world relaxes this.
3. Kappa assumes both annotators share the 6% marginal rate (range shown for 5–8%).
4. Replays hold the calibration class counts (24 / 376) fixed and treat the point estimates as the truth.
5. In (c), the 500 new labels are exact and the 9% flag rate is known, so the stratum weights are known.
6. The coverage simulation keeps the judge's Se and Sp fixed while the true prevalence varies over 1–8%.
7. The z-test treats ratings as independent; the design effect is the only allowance for clustering.
8. Golden-set model: 1–10 relevant documents per query, placed independently (no top-10 slot limit); queries with
   no judged relevant document are dropped.
9. Toy-world ambiguous items carry one shared impression, independent of the true label. Annotators always read it;
   the judge reads it with probability f.

## Acceptance numbers

All are checked by `npm test` and by the Verify panel:

- Se 0.8333, Sp 0.9362, π 0.0340, SE 0.0162, CI [0.23%, 6.57%]; variance shares 0.03% / 95.7% / 4.3%
- Kappa 0.645 at 6% prevalence
- Neyman 184 / 316; half-width 0.99 points; 1.97 expected unflagged violations; P(zero) 0.139
- Coverage at π = 3.4%: Wald 0.909, Agresti-Coull 0.947, Jeffreys 0.946 (2,000 replays, seed 202)
- z 3.96, p 7.4e-5, CI [1.52, 4.48] points; design-effect break-even 4.09
- Toy-world scenarios and the golden-set sweep match the Python output exactly. In this model's grid the measured
  gain is below the true gain in 27 of 27 settings.

The site's shell (sidebar, boundaries, fonts) comes from the Vercel Next.js App Router Playground (MIT, see `license.md`).
