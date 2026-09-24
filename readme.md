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

**Live:** https://revion-rho.vercel.app

## Eval Lab (`/lab`): a live agent, LLM judges and human annotators

A working evaluation loop with real models:

- **Agent (Groq, default `openai/gpt-oss-120b`):** answers questions with tool calling (calculator, current time). There is no
  retrieval; the two problems are in its system prompt. Every question, answer, tool call, latency and token count is stored.
- **Golden sets:** curated questions with reference answers. Save any chat answer to a golden set, editing it first.
- **Rubrics:** your rules. Criteria are scored 1–5, and hard rules fail an item outright. Pass or fail is computed in code
  (mean ≥ threshold and no rule violated), not decided by the model.
- **Benchmark studio:** choose an agent, a golden set (the agent answers fresh) or imported sessions (stored answers are
  judged as given), a rubric, and 1–4 **Gemini** judges.
  - Runs go one item at a time, so they can pause and resume.
  - Reports are stored: pass rate by judge majority, per-criterion means per judge, inter-judge kappa, latency, tokens,
    per-item reasons, CSV/JSON export, and a button to re-run failed judgments.
- **Annotate:** humans label the same items blind (judge scores unlock only after labelling). The report shows judge-vs-human
  agreement: Cohen's kappa, the confusion matrix, and the judge's sensitivity and specificity against humans. It also gives a
  **Rogan-Gladen corrected pass rate**, which is Problem 1 applied to your own judge.

### Where the data lives

There is no external database. The lab runs **SQLite in the browser** (sql.js, WebAssembly) and saves it to IndexedDB after every
write, so it behaves the same locally and on Vercel. The server holds only the API keys and answers two calls: run the agent,
and run a judge. Data belongs to the browser that created it; the dashboard can download the `.sqlite` file, load one, or reset
to the seed data (a default agent, a "Grounded QA" rubric and a 10-item golden set).

### Setup

Copy `.env.example` to `.env.local` and add `GROQ_API_KEY` and `GEMINI_API_KEY`, locally and in Vercel. `LAB_ACCESS_TOKEN` is
optional; when set, `/lab` and `/api/lab` require it, so a public URL cannot spend your keys.

Free-tier Gemini keys are rate limited per model. `gemini-3.6-flash` allows only 20 requests a day, so the default judges are
`gemini-3.5-flash-lite` and `gemini-3.1-flash-lite`. The studio lists every model the key can use.

| Code | Role |
| --- | --- |
| `lib/lab/db.ts` | SQLite in the browser (sql.js), schema, IndexedDB persistence, export/import/reset |
| `lib/lab/store.ts`, `lib/lab/handlers.ts` | typed data access, and the local `/api/lab/*` data routes |
| `lib/lab/runner.ts`, `lib/lab/stats.ts` | benchmark runs, summaries, kappa, human agreement |
| `lib/lab/client.ts`, `lib/lab/remote.ts` | routes data calls to the browser database and LLM calls to the server |
| `app/api/lab/[...path]/route.ts` | server: `setup`, `models`, `answer` (agent), `judge`, `login` |
| `lib/lab/agent.ts`, `lib/lab/groq.ts` | the Groq tool-calling agent |
| `lib/lab/judge.ts`, `lib/lab/gemini.ts` | the Gemini rubric judge (structured JSON output) |
| `proxy.ts` | optional access-token gate |

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

- Next.js App Router, TypeScript, Tailwind. Charts are plain SVG. The simulation pages need no database, keys or env vars; only the Eval Lab does.
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
