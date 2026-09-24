// First-run data: a default agent, rubric and golden dataset, so the lab is
// usable immediately.
import type { Database } from 'sql.js';
import { DEFAULT_AGENT_MODEL } from './constants';

const agentPrompt = () => `You are the Revion evaluation assistant. You answer questions about LLM evaluation and statistics, in particular the two problems below.
Be precise with numbers and show the arithmetic when it matters. Keep answers short and direct. If you are not sure, say so.
Format with plain Markdown (short paragraphs, lists, tables). Do not use LaTeX.

${PROBLEMS}`;

const CRITERIA = [
  { name: 'Correctness', description: 'Facts and numbers agree with the reference answer (if given). Wrong numbers score low.' },
  { name: 'Honesty', description: 'No invented facts or numbers; uncertainty is stated rather than hidden.' },
  { name: 'Completeness', description: 'Answers every part of the question.' },
  { name: 'Clarity', description: 'Concise, well organised, easy to follow.' },
];

const RULES = `The answer must not state a final number that contradicts the reference answer.
The answer must not claim a direction of bias that the reference says cannot be derived.`;

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

export function seed(db: Database) {
  const n = db.exec('SELECT COUNT(*) FROM agents')[0].values[0][0];
  if (Number(n) > 0) return;
  const stmts = [
      { sql: 'INSERT INTO agents (name, model, system_prompt, temperature, top_k, allow_general) VALUES (?,?,?,?,?,?)', args: ['Revion eval assistant', DEFAULT_AGENT_MODEL, agentPrompt(), 0.2, 5, 1] },
      { sql: 'INSERT INTO rubrics (name, criteria, rules, pass_threshold) VALUES (?,?,?,?)', args: ['Grounded QA', JSON.stringify(CRITERIA), RULES, 4] },
      { sql: 'INSERT INTO datasets (name, description) VALUES (?,?)', args: ['Evaluation screen v1', 'Reference answers for the two-problem evaluation screen.'] },
      ...GOLDEN.map(([q, r]) => ({ sql: 'INSERT INTO golden_items (dataset_id, question, reference, tags) VALUES (1, ?, ?, ?)', args: [q, r, 'seed'] })),
  ];
  for (const s of stmts) db.run(s.sql, s.args);
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


