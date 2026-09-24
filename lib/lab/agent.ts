// The agent: a Groq model with tool calling (calculator, current time).
// It answers from its system prompt and its own knowledge; there is no retrieval.
import 'server-only';
import { groqChat, type ChatMessage, type ToolSpec } from './groq';
import type { Agent, TraceStep } from './store';

const TOOLS: ToolSpec[] = [
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

export type AgentAnswer = { answer: string; trace: TraceStep[]; tokensIn: number; tokensOut: number; latencyMs: number; model: string };

export async function runAgent(agent: Agent, history: { role: 'user' | 'assistant'; content: string }[], question: string): Promise<AgentAnswer> {
  const started = Date.now();
  const trace: TraceStep[] = [];
  let tokensIn = 0;
  let tokensOut = 0;
  const messages: ChatMessage[] = [
    { role: 'system', content: `${agent.system_prompt}\n\nUse the calculator tool for any arithmetic beyond trivial.` },
    ...history.slice(-10).map((m) => ({ role: m.role, content: m.content }) as ChatMessage),
    { role: 'user', content: question },
  ];

  for (let step = 0; step < 6; step++) {
    const last = step === 5;
    const { message, usage } = await groqChat({ model: agent.model, messages, tools: last ? undefined : TOOLS, temperature: agent.temperature });
    tokensIn += usage.prompt_tokens;
    tokensOut += usage.completion_tokens;
    if (!message.tool_calls?.length) {
      return { answer: (message.content ?? '').trim(), trace, tokensIn, tokensOut, latencyMs: Date.now() - started, model: agent.model };
    }
    messages.push({ role: 'assistant', content: message.content ?? null, tool_calls: message.tool_calls });
    for (const call of message.tool_calls) {
      let args: Record<string, string> = {};
      let output: string;
      try {
        args = JSON.parse(call.function.arguments || '{}');
        if (call.function.name === 'calculator') output = String(calculate(String(args.expression ?? '')));
        else if (call.function.name === 'current_datetime') output = new Date().toISOString();
        else output = `Unknown tool ${call.function.name}`;
      } catch (e) {
        output = `Tool error: ${e instanceof Error ? e.message : String(e)}`;
      }
      trace.push({ tool: call.function.name, args, summary: output });
      messages.push({ role: 'tool', tool_call_id: call.id, content: output });
    }
  }
  throw new Error('The agent did not finish within 6 steps.');
}
