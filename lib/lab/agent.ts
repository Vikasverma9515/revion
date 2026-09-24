// The RAG agent: retrieves from the knowledge base up front, can search again
// or calculate via tools, and answers with numbered citations. Runs on Groq.
import 'server-only';
import { groqChat, type ChatMessage, type ToolSpec } from './groq';
import { search } from './knowledge';
import type { Agent, Source, TraceStep } from './store';

const TOOLS: ToolSpec[] = [
  {
    type: 'function',
    function: {
      name: 'search_knowledge',
      description: 'Semantic search over the knowledge base. Use it when the sources you have do not answer the question.',
      parameters: { type: 'object', properties: { query: { type: 'string', description: 'What to look for' } }, required: ['query'] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'calculator',
      description: 'Evaluate an arithmetic expression. Supports + - * / ^ ( ), sqrt, log, ln, exp, abs, min, max, round, pi, e.',
      parameters: { type: 'object', properties: { expression: { type: 'string' } }, required: ['expression'] },
    },
  },
  {
    type: 'function',
    function: { name: 'current_datetime', description: 'The current date and time in UTC.', parameters: { type: 'object', properties: {} } },
  },
];

/** Whitelisted arithmetic only: numbers, operators and a few Math functions. */
export function calculate(expression: string): number {
  const names: Record<string, string> = { sqrt: 'Math.sqrt', log: 'Math.log10', ln: 'Math.log', exp: 'Math.exp', abs: 'Math.abs', min: 'Math.min', max: 'Math.max', round: 'Math.round', pi: 'Math.PI', e: 'Math.E' };
  const tokens = expression.toLowerCase().match(/\d+\.?\d*(e[+-]?\d+)?|[a-z]+|\*\*|[-+*/^(),.%]|\s+/g) ?? [];
  if (tokens.join('') !== expression.toLowerCase()) throw new Error('Unsupported characters in expression.');
  const js = tokens
    .map((t) => {
      if (/^[a-z]+$/.test(t)) {
        if (!(t in names)) throw new Error(`Unknown function "${t}".`);
        return names[t];
      }
      return t === '^' ? '**' : t;
    })
    .join('');
  const value = Function(`"use strict"; return (${js});`)();
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error('Expression did not produce a finite number.');
  return value;
}

export type AgentAnswer = {
  answer: string;
  sources: Source[];
  trace: TraceStep[];
  tokensIn: number;
  tokensOut: number;
  latencyMs: number;
  model: string;
};

function formatSources(hits: Source[]) {
  return hits.map((h) => `[${h.n}] (${h.title})\n${h.text}`).join('\n\n---\n\n');
}

export async function runAgent(agent: Agent, history: { role: 'user' | 'assistant'; content: string }[], question: string): Promise<AgentAnswer> {
  const started = Date.now();
  const sources: Source[] = [];
  const trace: TraceStep[] = [];
  let tokensIn = 0;
  let tokensOut = 0;

  const addHits = async (query: string) => {
    const hits = await search(query, agent.top_k);
    const fresh: Source[] = [];
    for (const h of hits) {
      if (sources.some((s) => s.chunk_id === h.chunk_id)) continue;
      const s = { n: sources.length + 1, chunk_id: h.chunk_id, title: h.title, text: h.text, distance: Number(h.distance) };
      sources.push(s);
      fresh.push(s);
    }
    return fresh;
  };

  const initial = await addHits(question);
  trace.push({ tool: 'retrieve', args: { query: question, k: agent.top_k }, summary: `${initial.length} chunks` });

  const rules = [
    agent.system_prompt,
    'Cite the sources you use with their numbers in square brackets, like [1] or [2][3]. Only cite numbers that exist.',
    agent.allow_general
      ? 'If the sources do not cover the question, you may answer from general knowledge, and say clearly that the answer is not from the knowledge base.'
      : 'If the sources do not contain the answer, say you do not know. Do not use outside knowledge.',
    'Use the calculator tool for any arithmetic beyond trivial.',
  ].join('\n\n');

  const messages: ChatMessage[] = [
    { role: 'system', content: rules },
    ...history.slice(-10).map((m) => ({ role: m.role, content: m.content }) as ChatMessage),
    { role: 'user', content: `Sources from the knowledge base:\n\n${formatSources(initial) || '(no matching sources)'}\n\nQuestion: ${question}` },
  ];

  for (let step = 0; step < 6; step++) {
    const last = step === 5;
    const { message, usage } = await groqChat({ model: agent.model, messages, tools: last ? undefined : TOOLS, temperature: agent.temperature });
    tokensIn += usage.prompt_tokens;
    tokensOut += usage.completion_tokens;
    if (!message.tool_calls?.length) {
      return { answer: (message.content ?? '').trim(), sources, trace, tokensIn, tokensOut, latencyMs: Date.now() - started, model: agent.model };
    }
    messages.push({ role: 'assistant', content: message.content ?? null, tool_calls: message.tool_calls });
    for (const call of message.tool_calls) {
      let args: Record<string, string> = {};
      let output: string;
      try {
        args = JSON.parse(call.function.arguments || '{}');
        if (call.function.name === 'search_knowledge') {
          const fresh = await addHits(String(args.query ?? question));
          output = fresh.length ? formatSources(fresh) : 'No new matching sources.';
          trace.push({ tool: 'search_knowledge', args, summary: `${fresh.length} new chunks` });
        } else if (call.function.name === 'calculator') {
          const v = calculate(String(args.expression ?? ''));
          output = String(v);
          trace.push({ tool: 'calculator', args, summary: output });
        } else if (call.function.name === 'current_datetime') {
          output = new Date().toISOString();
          trace.push({ tool: 'current_datetime', args, summary: output });
        } else {
          output = `Unknown tool ${call.function.name}`;
        }
      } catch (e) {
        output = `Tool error: ${e instanceof Error ? e.message : String(e)}`;
        trace.push({ tool: call.function.name, args, summary: output });
      }
      messages.push({ role: 'tool', tool_call_id: call.id, content: output });
    }
  }
  throw new Error('The agent did not finish within 6 steps.');
}
