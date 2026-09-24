// First-run data: a default agent, rubric and golden dataset, so the lab is
// usable immediately. Knowledge documents are loaded separately (they need
// embeddings) via loadStarterKnowledge().
import 'server-only';
import type { Client } from '@libsql/client';
import fs from 'node:fs';
import path from 'node:path';
import { DEFAULT_AGENT_MODEL } from './config';

const AGENT_PROMPT = `You are the Revion evaluation assistant. You answer questions about LLM evaluation, statistics, retrieval quality and the Revion evaluation screen (the guardrail-number and recall problems), using the knowledge base.
Be precise with numbers and show the arithmetic when it matters. Keep answers short and direct.`;

const CRITERIA = [
  { name: 'Correctness', description: 'Facts and numbers agree with the reference answer (if given) and the sources. Wrong numbers score low.' },
  { name: 'Groundedness', description: 'Every claim is supported by the retrieved sources or clearly marked as general knowledge; citations point to sources that support the claim.' },
  { name: 'Completeness', description: 'Answers every part of the question.' },
  { name: 'Clarity', description: 'Concise, well organised, easy to follow.' },
];

const RULES = `The answer must not invent numbers that appear in neither the sources nor the reference.
The answer must not cite a source number that was not provided.`;

const GOLDEN: [string, string][] = [
  ['What are the judge\'s sensitivity and specificity from the 400-item calibration?', 'Sensitivity = 20/24 = 0.8333; specificity = 352/376 = 0.9362.'],
  ['The judge flags 9% of 2,000,000 production responses. What is the estimated true violation rate and its 95% CI?', 'Rogan-Gladen: pi = (0.09 + 0.9362 - 1) / (0.8333 + 0.9362 - 1) = 3.40%. Delta-method SE 0.0162, so the 95% CI is about 0.2% to 6.6%.'],
  ['Which quantity dominates the width of the confidence interval for the violation rate?', 'The specificity estimate: about 96% of the variance (sensitivity about 4%, the 2M-response flag rate almost nothing).'],
  ["What is Cohen's kappa for the annotators, and what does it depend on?", 'With 96% pairwise agreement and a 6% marginal rate for each annotator, pe = 0.06^2 + 0.94^2 = 0.8872 and kappa = (0.96 - 0.8872)/(1 - 0.8872) = 0.645. It depends on the assumed marginals: about 0.58 to 0.73 for 5% to 8%.'],
  ['How should 500 extra exact labels be allocated?', 'Stratify by the judge decision and use Neyman allocation: 184 judge-flagged and 316 unflagged, giving an expected 95% half-width of about 0.99 percentage points.'],
  ['How many violations do we expect among the unflagged labels, and what does that imply for the interval method?', 'About 316 x 0.00623 = 2 violations, with a 14% chance of none. At zero events Wald reports no uncertainty (simulated coverage about 91%), so use a Jeffreys interval per stratum combined with the known weights.'],
  ['Is the thumbs-down rise from 8% to 11% on about 3,000 ratings each a real change?', 'Yes, statistically: 240 vs 330 of 3,000, z = 3.96, p < 0.001, 95% CI for the increase 1.5 to 4.5 points. It does not show the embedding change caused it (clustering by user, before/after design, shifts in query mix).'],
  ['What does a golden set labelled only from the old system\'s top 20 hide?', 'Relevant documents outside the old top 20 are never judged: they are missing from the recall denominator (absolute recall too high) and new-system finds among them count as misses, so the new system\'s gain is understated. It also says little about precision. Fix: pool both systems\' results and judge the pool.'],
  ['What is the cheapest test for a pipeline mismatch after an embedding-model swap?', 'Run about 100 identical queries through the full old and new production pipelines and compare embeddings, index coverage, scores and top-k against the intended pipeline (prefixes, truncation, normalisation, partial re-embedding, stale similarity thresholds).'],
  ['How much clustering (design effect) would make the 8% to 11% change non-significant?', 'z shrinks by sqrt(deff); significance is lost when deff exceeds (3.96/1.96)^2, about 4.1.'],
];

export async function seed(db: Client) {
  const n = await db.execute('SELECT COUNT(*) AS n FROM agents');
  if (Number(n.rows[0].n) > 0) return;
  await db.batch(
    [
      { sql: 'INSERT INTO agents (name, model, system_prompt, temperature, top_k, allow_general) VALUES (?,?,?,?,?,?)', args: ['Revion eval assistant', DEFAULT_AGENT_MODEL, AGENT_PROMPT, 0.2, 5, 1] },
      { sql: 'INSERT INTO rubrics (name, criteria, rules, pass_threshold) VALUES (?,?,?,?)', args: ['Grounded QA', JSON.stringify(CRITERIA), RULES, 4] },
      { sql: 'INSERT INTO datasets (name, description) VALUES (?,?)', args: ['Evaluation screen v1', 'Reference answers for the two-problem evaluation screen.'] },
      ...GOLDEN.map(([q, r]) => ({ sql: 'INSERT INTO golden_items (dataset_id, question, reference, tags) VALUES (1, ?, ?, ?)', args: [q, r, 'seed'] })),
    ],
    'write',
  );
}

/** Starter knowledge: the problems, the answers, method notes and the Python reference code. */
export function starterDocuments(): { title: string; source: string; text: string }[] {
  const docs = [
    { title: 'Evaluation screen: the two problems', source: 'seed', text: PROBLEMS },
    { title: 'Submitted answers', source: 'seed', text: ANSWERS },
    { title: 'Method notes and assumptions', source: 'seed', text: METHOD },
  ];
  const dir = path.join(process.cwd(), 'reference', 'python');
  for (const f of ['problem1_ab.py', 'problem1_b_assumption.py', 'problem1_c_design.py', 'problem2.py', 'problem2_direction_check.py']) {
    try {
      docs.push({ title: `reference/python/${f}`, source: 'seed', text: fs.readFileSync(path.join(dir, f), 'utf8') });
    } catch {
      // Not bundled in this deployment; skip.
    }
  }
  return docs;
}

const PROBLEMS = `PROBLEM 1: THE GUARDRAIL NUMBER

An LLM judge flags policy-violating responses from a production assistant. To calibrate it, 400 production responses are sampled at random. Three annotators label each one. Pairwise annotator agreement is 96%. The majority label marks 24 responses (6%) as violations. The judge flags 44 of the 400: 20 of the 24 violations and 24 of the 376 clean ones. The next day the judge runs on 2,000,000 production responses and flags 9%.

a) Estimate the true violation rate for that day with a 95% confidence interval. Show the method and the arithmetic. Say which quantity dominates the width of the interval.

b) Compute Cohen's kappa for the annotators. Then name the assumption the answer to (a) makes about the annotators and the judge, explain why an LLM judge is likely to break it, and say how to test it. Do not state a direction of bias unless it has been derived.

c) 500 more responses can be labelled; treat those labels as exact. Design the sampling. Give the number of labels per group, the expected interval half-width, and the expected number of violations among responses the judge did not flag. Say what that last count does to the choice of interval method.

PROBLEM 2: RECALL IS UP, USERS ARE UNHAPPY

A retrieval-augmented assistant switches embedding models. On the golden set (1,200 queries, relevance labels made by annotators who judged the top 20 results of the old system), recall@10 rises from 0.71 to 0.78. Over the next two weeks the thumbs-down rate goes from 8% to 11%, on about 3,000 rated answers per period.

a) Show whether 8% to 11% is a real change.

b) List the five most likely causes, ranked. For each, give the cheapest test that would confirm or kill it in under a day.

c) Say what the golden set's construction hides, and in which direction it biases the recall numbers.`;

const ANSWERS = `PROBLEM 1 (a): The judge's 9% is not the violation rate: calibration shows both false positives and false negatives. Sensitivity = 20/24 = 0.8333. Specificity = 352/376 = 0.9362. With p as the true rate: 0.09 = p(0.8333) + (1-p)(1-0.9362), so p = 0.0340, about 3.40% (Rogan-Gladen). 95% CI by first-order delta method. Input SEs: flag rate 0.00020, sensitivity sqrt(0.8333 x 0.1667/24) = 0.0761, specificity sqrt(0.9362 x 0.0638/376) = 0.0126. After scaling by the derivatives they contribute 0.0003, 0.0034 and 0.0158, so SE(p) = 0.0162 and the interval is 3.40% +/- 1.96(1.62%) = 0.2% to 6.6%. Specificity carries about 96% of the variance, sensitivity about 4%, the 2M flag rate almost nothing.

PROBLEM 1 (b): Kappa is not identifiable from 96% agreement alone; expected agreement needs marginal rates. Using the 6% majority-label rate for each: Pe = 0.06^2 + 0.94^2 = 0.8872; kappa = (0.96 - 0.8872)/(1 - 0.8872) = about 0.645. Approximate range 0.58 to 0.73 for annotator prevalence 5% to 8%. The key assumption in (a): conditional on the true label, judge errors are independent of annotator errors, and the calibration relationship still holds in production. An LLM judge likely breaks this because it and the humans read the same policy and share blind spots on ambiguous cases. Agreement then flatters the judge, and (a) really estimates how often annotators would say "violation". No direction of bias is claimed: with a shared impression on an ambiguous share of items it can be positive or negative. Test: experts adjudicate every judge-vs-majority disagreement, every 2-1 split and a random slice of unanimous items; recompute sensitivity and specificity against them, and check whether judge and annotator false positives coincide beyond chance (Fisher). Oversample flagged items.

PROBLEM 1 (c): Stratify by judge decision. Bayes at 3.4% gives 31.5% violations among judge-positive and 0.62% among judge-negative. Neyman allocation gives 184 positive and 316 negative labels. Expected 95% half-width: 1.96 x sqrt[(0.09^2 x 0.315 x 0.685/184) + (0.91^2 x 0.00623 x 0.99377/316)] = 0.99 points. Among the 316 negatives expect 316 x 0.00623 = about 2 violations, with a 14% chance of none. That rules out Wald (simulated coverage about 91%; at zero events it reports no uncertainty). Use a Jeffreys interval per stratum, combined with the known weights (simulated coverage 95% to 96%).

PROBLEM 2 (a): 240 versus 330 thumbs-downs out of about 3,000 each: SE = 0.0076, z = 3.96, p < 0.001, 95% CI for the increase 1.5 to 4.5 points. Not sampling noise, but it does not show the embedding change caused it: ratings cluster by user, this is before/after, and rating habits or query mix may have shifted. Significance is lost at a design effect of about 4.1.

PROBLEM 2 (b), causes ranked with one-day tests:
1. Pipeline mismatch (prefixes, truncation, normalization, a half-re-embedded index, an old similarity threshold). Test: run 100 identical queries through the full old/new production pipelines and compare embeddings, index coverage, scores and top-k.
2. Recall improved but ranking worsened. Test: LLM-judge a fresh pooled sample of about 200 queries; compare Recall@1/3/5, MRR, NDCG.
3. Noisier context. Test: fix generator and prompt, replay old versus new contexts, compare answer quality.
4. Domain-specific embedding failures. Test: slice a paired sample by topic/query type.
5. A production confounder. Test: deployment logs, and thumbs-down rates within matched traffic cohorts.

PROBLEM 2 (c): The golden set labels only the old system's top 20. Relevant documents the old system never surfaced are missing from the denominator, so absolute recall is too high for both systems. Relevant documents only the new system finds are unjudged and count as misses, so the new system's recall is biased downward and its gain understated. It says little about precision or distracting context, so higher recall can coexist with worse answers. Fix: pool both retrievers' results and judge the combined pool.`;

const METHOD = `Method notes. Simulations are seeded with mulberry32 so the Python reference and the TypeScript port give identical numbers. Binomial draws sum Bernoullis for n <= 1000 and use a clamped normal approximation above. Jeffreys intervals use Beta(x+0.5, n-x+0.5) per stratum combined by Monte Carlo with known weights 0.09/0.91.

Assumptions: calibration and production traffic share a distribution; the majority label is treated as truth in (a); kappa assumes both annotators share the 6% marginal; replays hold calibration class counts fixed; in (c) the 9% flag rate is known so stratum weights are known; the z-test treats ratings as independent and the design effect is the only allowance for clustering.

Toy world for (b): some items are ambiguous (share h) and carry one shared impression (probability s of reading as a violation) independent of the truth (rate pi_h among ambiguous items). Annotator noise bias = (1-a0)(1-pi*) - (1-a1)pi*; shared impression bias = h(s - pi_h). The Rogan-Gladen estimate tracks the annotators' rate, not the truth.

Golden-set model for Problem 2(c): per relevant document, true gain = (1-f) x measured gain + f x c, where f is the share of relevant documents outside the old top 20 and c is the new system's hit rate on them. The measured gain understates the true gain whenever c exceeds the measured gain; in the 27-setting sweep it did in 27 of 27.`;
