// LLM-as-a-judge on Gemini: scores each rubric criterion 1-5 with a reason,
// and lists violations of the rubric's hard rules. Pass/fail is computed
// here, not by the model: mean score >= threshold and no rule violated.
import 'server-only';
import { geminiJson } from './gemini';
import type { Judgment, Rubric, Source } from './store';

const SCALE = `Scale for every criterion:
5 = fully meets the criterion, no issues
4 = meets it with minor issues
3 = partly meets it; noticeable problems
2 = mostly fails it
1 = completely fails it`;

type Raw = { criteria: { name: string; score: number; reason: string }[]; rule_violations: string[]; verdict: string };

const SCHEMA = {
  type: 'OBJECT',
  properties: {
    criteria: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: { name: { type: 'STRING' }, score: { type: 'INTEGER' }, reason: { type: 'STRING' } },
        required: ['name', 'score', 'reason'],
      },
    },
    rule_violations: { type: 'ARRAY', items: { type: 'STRING' } },
    verdict: { type: 'STRING' },
  },
  required: ['criteria', 'rule_violations', 'verdict'],
};

export async function judge(opts: {
  model: string;
  rubric: Rubric;
  question: string;
  answer: string;
  reference: string | null;
  context: Source[];
}): Promise<Judgment & { tokensIn: number; tokensOut: number }> {
  const { rubric } = opts;
  const system = [
    'You are a careful, strict evaluator of answers produced by an AI assistant.',
    'Judge only what is on the page. Do not reward length or confident tone. Do not assume facts that are not in the question or the reference.',
    SCALE,
    'Return one entry per criterion, using the exact criterion names given.',
  ].join('\n\n');
  const context = opts.context.map((s) => `[${s.n}] (${s.title}) ${s.text.slice(0, 1500)}`).join('\n\n').slice(0, 12_000);
  const prompt = [
    `## Criteria\n${rubric.criteria.map((c) => `- ${c.name}: ${c.description}`).join('\n')}`,
    rubric.rules.trim() ? `## Hard rules (list each one the answer violates in rule_violations)\n${rubric.rules.trim()}` : '## Hard rules\n(none)',
    `## Question\n${opts.question}`,
    opts.reference ? `## Reference answer (treat as correct)\n${opts.reference}` : '## Reference answer\n(none provided; judge correctness against your own knowledge)',
    ...(context ? [`## Sources the assistant retrieved\n${context}`] : []),
    `## Assistant's answer\n${opts.answer}`,
  ].join('\n\n');

  try {
    const { data, tokensIn, tokensOut } = await geminiJson<Raw>({ model: opts.model, system, prompt, schema: SCHEMA });
    const scores: Record<string, number> = {};
    const reasons: Record<string, string> = {};
    for (const c of rubric.criteria) {
      const hit = data.criteria.find((x) => x.name.trim().toLowerCase() === c.name.trim().toLowerCase());
      scores[c.name] = hit ? Math.min(5, Math.max(1, Math.round(hit.score))) : 1;
      reasons[c.name] = hit?.reason ?? 'The judge did not score this criterion.';
    }
    const overall = Object.values(scores).reduce((a, b) => a + b, 0) / Math.max(1, rubric.criteria.length);
    const violations = data.rule_violations.filter((v) => v.trim());
    return {
      judge: opts.model,
      scores,
      reasons,
      overall,
      pass: overall >= rubric.pass_threshold && violations.length === 0,
      verdict: violations.length ? `${data.verdict}\nRule violations: ${violations.join('; ')}` : data.verdict,
      tokensIn,
      tokensOut,
    };
  } catch (e) {
    return { judge: opts.model, scores: {}, reasons: {}, overall: 0, pass: false, verdict: '', error: e instanceof Error ? e.message : String(e), tokensIn: 0, tokensOut: 0 };
  }
}
