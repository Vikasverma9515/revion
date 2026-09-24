<div align="center">

# Revion · Evaluation Simulations & Eval Lab

**Every number in my answers to a two-problem LLM-evaluation screen, re-runnable live in the browser, plus a working
evaluation system: a real agent, LLM judges and human annotators.**

[**Live demo →**](https://revion-rho.vercel.app) &nbsp;·&nbsp; [Eval Lab →](https://revion-rho.vercel.app/lab) &nbsp;·&nbsp; [Python reference](reference/python)

![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=nextdotjs)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6?logo=typescript&logoColor=white)
![Tailwind](https://img.shields.io/badge/Tailwind-v4-38bdf8?logo=tailwindcss&logoColor=white)
![Tests](https://img.shields.io/badge/tests-40%20passing-2ea043)
![Verify](https://img.shields.io/badge/acceptance-11%2F11%20green-2ea043)
![Groq](https://img.shields.io/badge/agent-Groq%20gpt--oss--120b-f55036)
![Gemini](https://img.shields.io/badge/judges-Gemini-4285f4?logo=googlegemini&logoColor=white)

<img src="docs/screenshots/overview.png" alt="Overview: the answers as cards, each linking to its simulation" width="100%" />

</div>

---

## Contents

- [What this is](#what-this-is)
- [Part 1 · The simulations](#part-1--the-simulations)
- [Part 2 · Eval Lab: agent, LLM judges, human annotators](#part-2--eval-lab-agent-llm-judges-human-annotators)
- [Architecture](#architecture)
- [Python ↔ TypeScript parity](#python--typescript-parity)
- [Run it locally](#run-it-locally)
- [Project structure](#project-structure)
- [Assumptions](#assumptions)

---

## What this is

| | Part 1 · Simulations | Part 2 · Eval Lab |
| --- | --- | --- |
| **Purpose** | Let a reviewer re-run every number behind my written answers | Show the same ideas working on a live system |
| **Where** | `/`, `/estimator`, `/assumption`, `/design`, `/is-it-real`, `/golden-set` | `/lab/*` |
| **Engine** | Seeded Monte Carlo (mulberry32) streamed from Node route handlers | Groq agent, Gemini judges, SQLite in the browser |
| **Checked by** | 11 acceptance checks, run live in the **Verify** panel and in `npm test` | Unit tests plus end-to-end runs on the live site |

> Everything in Part 1 is a simulation of a stated toy world, not production data. Every run shows its seed, and the
> same seed gives the **same numbers in Python and TypeScript**.

---

## Part 1 · The simulations

### The answers

| Problem | Answer | Page |
| --- | --- | --- |
| **1a** True violation rate | **3.4%**, 95% CI **0.2% – 6.6%** (Rogan-Gladen + delta method); specificity carries ~96% of the variance | [Estimator](https://revion-rho.vercel.app/estimator) |
| **1b** Annotator agreement | Cohen's κ = **0.645** at 6% prevalence (0.58 – 0.73 for 5–8%) | [Assumption & kappa](https://revion-rho.vercel.app/assumption) |
| **1c** 500 exact labels | Neyman **184 / 316**, half-width **±0.99 pts**, ~2 unflagged violations expected (P(zero) = 0.139) → Jeffreys, not Wald | [Sampling design](https://revion-rho.vercel.app/design) |
| **2a** 8% → 11% thumbs-down | **z = 3.96**, p ≈ 7e-5, CI [1.52, 4.48] pts; significance lost at design effect ≈ **4.1** | [Is it real?](https://revion-rho.vercel.app/is-it-real) |
| **2c** Golden-set bias | Labels only from the old top 20 → absolute recall inflated, new system's gain **understated** (27 of 27 settings) | [Golden-set bias](https://revion-rho.vercel.app/golden-set) |

### Verify panel: every acceptance number, live

<img src="docs/screenshots/verify.png" alt="Verify panel with 11 of 11 checks passing" width="100%" />

### Charts that fill in live

Every simulation streams its progress over Server-Sent Events, and every input is editable.

<table>
  <tr>
    <td width="50%"><img src="docs/screenshots/estimator.png" alt="Replaying the study 20,000 times: coverage near 95%, lower bound often below zero" /><br/><sub><b>P1a</b> · Replay the study 20,000 times: coverage settles at 95%, yet the lower bound is often negative.</sub></td>
    <td width="50%"><img src="docs/screenshots/variance-share.png" alt="Variance share bar: specificity 95.7%" /><br/><sub><b>P1a</b> · Where the interval's width comes from: specificity, not the 2M production flags.</sub></td>
  </tr>
  <tr>
    <td><img src="docs/screenshots/toy-world.png" alt="Toy world: Rogan-Gladen estimate tracks the annotators' rate, not the truth" /><br/><sub><b>P1b</b> · Toy world: the corrected estimate tracks the <i>annotators'</i> rate, not the truth.</sub></td>
    <td><img src="docs/screenshots/coverage.png" alt="Coverage of Wald, Agresti-Coull and Jeffreys across prevalence" /><br/><sub><b>P1c</b> · Wald under-covers where zero unflagged violations are common; Jeffreys holds 95%.</sub></td>
  </tr>
  <tr>
    <td><img src="docs/screenshots/golden-set-scatter.png" alt="Per-query measured vs true recall" /><br/><sub><b>P2c</b> · Per-query measured vs true recall@10 for the old and new systems.</sub></td>
    <td><img src="docs/screenshots/golden-set-sweep.png" alt="27-setting sweep: measured gain below true gain" /><br/><sub><b>P2c</b> · The 27-setting sweep: the measured gain is below the true gain in every setting.</sub></td>
  </tr>
</table>

---

## Part 2 · Eval Lab: agent, LLM judges, human annotators

A working evaluation loop with real models. You ask an agent questions, turn good answers into a golden set, write your
own judging rules, benchmark the agent with LLM judges, and then check the judges against human labels. That last step is
Problem 1 applied to your own judge.

```mermaid
flowchart LR
    A["💬 Ask the agent<br/>Groq · gpt-oss-120b"] --> B["⭐ Save to golden set<br/>edit the reference"]
    B --> C["📏 Rubric<br/>criteria + hard rules"]
    C --> D["🧪 Benchmark studio<br/>1–4 Gemini judges"]
    A -.->|import sessions| D
    D --> E["📊 Stored report<br/>pass rate · κ · latency"]
    E --> F["🧑‍⚖️ Human annotation<br/>blind to the judges"]
    F --> G["✅ Judge vs human<br/>κ · Se/Sp · corrected pass rate"]
```

### 1 · Chat with the agent

Every question, answer, tool call, latency and token count is stored. Math is typeset with KaTeX.

<img src="docs/screenshots/chat.png" alt="Agent chat with typeset math, model, latency and tokens" width="100%" />

### 2 · Save any answer to a golden set, after editing it

<table>
  <tr>
    <td width="50%"><img src="docs/screenshots/save-to-golden.png" alt="Save to golden set with an editable reference answer" /><br/><sub>Edit the answer into the reference you want judged as correct.</sub></td>
    <td width="50%"><img src="docs/screenshots/golden-sets.png" alt="Golden dataset list" /><br/><sub>Golden datasets: seed items plus ones saved from chat.</sub></td>
  </tr>
</table>

### 3 · Your rules for the judges

Criteria are scored 1–5, and hard rules fail an item outright. **Pass or fail is computed in code** (mean ≥ threshold and
no rule violated), never decided by the model.

<img src="docs/screenshots/rubrics.png" alt="Rubric editor with criteria, hard rules and pass threshold" width="100%" />

### 4 · Benchmark studio

Pick an agent, a source, a rubric and 1–4 Gemini judges:
- **Golden set:** the agent answers every question fresh.
- **Imported sessions:** the stored answers are judged exactly as users saw them.

Runs go one item at a time, so they can pause and resume.

<table>
  <tr>
    <td width="50%"><img src="docs/screenshots/studio.png" alt="Benchmark studio run configuration" /></td>
    <td width="50%"><img src="docs/screenshots/report.png" alt="Stored benchmark report with pass rate, kappa, latency, tokens and per-criterion scores" /></td>
  </tr>
</table>

Each item keeps every judge's per-criterion scores and reasons. In this item the agent got the 3.4% point estimate right
but made its CI far too narrow, ignoring the calibration uncertainty. The judges **disagreed**: one passed it, the other
failed it on a hard rule, and the human sided with the fail. That kind of disagreement is what the agreement panel below
measures. (The agent's answer is collapsed here.)

<img src="docs/screenshots/report-judges.png" alt="Report item: question, reference and two judges' scores and reasons, one pass and one fail" width="100%" />

### 5 · Human annotation, and how far to trust the judges

Annotators label the same items **blind**: judge scores unlock only after labelling. The report then compares humans
with the judge majority and corrects the judges' pass rate with **Rogan-Gladen**, the estimator from Problem 1.

<table>
  <tr>
    <td width="50%"><img src="docs/screenshots/annotate.png" alt="Annotation form: pass/fail, criterion scores, note" /></td>
    <td width="50%"><img src="docs/screenshots/human-agreement.png" alt="Judge vs human: agreement, kappa, sensitivity/specificity, corrected pass rate, confusion matrix" /></td>
  </tr>
</table>

<img src="docs/screenshots/lab-dashboard.png" alt="Eval Lab dashboard: setup status, counts, data tools, recent runs" width="100%" />

---

## Architecture

```mermaid
flowchart TB
    subgraph Browser
        UI["Next.js pages<br/>React + plain-SVG charts"]
        DB[("SQLite · sql.js WASM<br/>saved to IndexedDB")]
        UI <--> DB
    end
    subgraph Vercel["Vercel · Node.js route handlers"]
        SIM["/api/sim/* · /api/verify<br/>seeded simulations over SSE"]
        LAB["/api/lab/answer · judge · models"]
    end
    UI -- "EventSource" --> SIM
    UI -- "fetch" --> LAB
    LAB --> GROQ["Groq · agent<br/>tool calling"]
    LAB --> GEM["Gemini · judges<br/>JSON-schema output"]
```

- **Simulations** run in Node route handlers (`runtime = 'nodejs'`, `maxDuration` set) and stream progress with
  Server-Sent Events. Replays are capped at 20,000 per run, and a run stops early with a message before the time limit.
- **Eval Lab data** has no external database. It lives in **SQLite running in the browser** (sql.js) and is saved to
  IndexedDB, so it works the same locally and on Vercel. The dashboard can download the `.sqlite` file, load one, or reset it.
- **The server holds only the API keys.** It exposes two model calls: run the agent, and run a judge.
- **Binomial draws** sum Bernoullis for n ≤ 1,000. Above that they use a clamped normal approximation, which is only
  used for the 2,000,000 production responses. **Jeffreys** uses Beta(x+½, n−x+½) per stratum, combined by Monte Carlo
  with the known weights; the Beta quantile function is tested against scipy.

---

## Python ↔ TypeScript parity

[`reference/python/`](reference/python) is the source of truth, written with the standard library only. The TypeScript is a
line-by-line port using the same RNG and the same draw order, and `tests/parity.test.ts` checks the results **draw for draw**
against JSON written by the Python scripts.

| Python | TypeScript | Used by |
| --- | --- | --- |
| `rng.py` | `lib/stats/rng.ts` | everything |
| `problem1_ab.py` | `lib/sim/p1ab.ts` | `/estimator`, kappa, `/api/sim/replay` |
| `problem1_b_assumption.py` | `lib/sim/toyworld.ts` | `/assumption`, `/api/sim/toyworld` |
| `problem1_c_design.py` | `lib/sim/design.ts` | `/design`, `/api/sim/coverage` |
| `problem2.py` | `lib/sim/p2.ts` | `/is-it-real`, `/golden-set` |
| `problem2_direction_check.py` | `lib/sim/p2.ts` (`sweep`) | `/golden-set` |

```sh
cd reference/python && python3 problem1_ab.py
# Sensitivity 0.8333  Specificity 0.9362
# pi = 0.0340   SE = 0.0162   95% CI [0.2295%, 6.5723%]
```

---

## Run it locally

```sh
pnpm install        # or: npm i
pnpm dev            # http://localhost:3000
pnpm test           # 40 tests: parity, acceptance, stats, lab logic
pnpm build
```

The Eval Lab needs two keys. Copy `.env.example` to `.env.local`:

| Variable | For |
| --- | --- |
| `GROQ_API_KEY` | the agent ([console.groq.com](https://console.groq.com/keys)) |
| `GEMINI_API_KEY` | the judges ([aistudio.google.com](https://aistudio.google.com/apikey)) |
| `LAB_ACCESS_TOKEN` | optional; protects `/lab` and `/api/lab` on a public URL |

> Free-tier Gemini keys are rate limited per model (`gemini-3.6-flash` allows 20 requests a day), so the default judges are
> `gemini-3.5-flash-lite` and `gemini-3.1-flash-lite`. A report can re-run judgments that failed on quota.

`pnpm fixtures` regenerates the Python fixtures (needs only `python3`; about 90 s).

---

## Project structure

```
app/
  page.tsx, estimator/, assumption/, design/, is-it-real/, golden-set/, about/   Part 1 pages
  lab/  chat/, sessions/, golden/, agents/, studio/, annotate/                     Part 2 pages
  api/  sim/*, verify/, health/                                                   simulation routes (SSE)
        lab/[...path]/                                                            agent + judge calls
lib/
  sim/     p1ab.ts, toyworld.ts, design.ts, p2.ts        ports of the Python scripts
  stats/   rng.ts (mulberry32), special.ts (Beta/normal)
  lab/     db.ts (browser SQLite), store.ts, handlers.ts, runner.ts, stats.ts,
           agent.ts + groq.ts, judge.ts + gemini.ts
  verify.ts                                              the 11 acceptance checks
reference/python/                                        source-of-truth scripts
tests/                                                   vitest: parity, acceptance, special, lab
docs/screenshots/                                        the images in this README
```

---

## Assumptions

<details>
<summary><b>Simulations</b> (click to expand)</summary>

1. Calibration and production traffic come from the same distribution, so the judge's sensitivity and specificity transfer.
2. In (a) the annotators' majority label is treated as the truth; the P1b toy world relaxes this.
3. Kappa assumes both annotators share the 6% marginal rate (range shown for 5–8%).
4. Replays hold the calibration class counts (24 / 376) fixed and treat the point estimates as the truth.
5. In (c), the 500 new labels are exact and the 9% flag rate is known, so the stratum weights are known.
6. The coverage simulation keeps the judge's Se and Sp fixed while the true prevalence varies over 1–8%.
7. The z-test treats ratings as independent; the design effect is the only allowance for clustering.
8. Golden-set model: 1–10 relevant documents per query, placed independently (no top-10 slot limit); queries with no
   judged relevant document are dropped.
9. Toy-world ambiguous items carry one shared impression, independent of the true label. Annotators always read it; the
   judge reads it with probability f.

</details>

<details>
<summary><b>Eval Lab</b></summary>

- The human label for an item is the majority of its annotators; ties count as fail. The judge verdict is the majority of
  the judges that returned a score.
- The corrected pass rate assumes the labelled items are representative and the humans are right; its interval is the
  delta-method interval from Problem 1.
- The agent has no retrieval. The two problem statements are in its system prompt as reference material.
- Lab data belongs to the browser that created it; share it by downloading and loading the `.sqlite` file.

</details>

<details>
<summary><b>Phone and light mode</b></summary>

<p align="center"><img src="docs/screenshots/mobile-light.png" alt="The overview on a phone in light mode" width="320" /></p>

</details>

---

<sub>The site's shell (sidebar, boundaries, fonts) started from the Vercel Next.js App Router Playground (MIT, see
<code>license.md</code>).</sub>
