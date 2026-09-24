// Browser → server calls for the only work that needs the API keys.
import type { Judgment, Rubric, TraceStep } from './store';

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status}).`);
  return data as T;
}

export type AgentAnswer = { answer: string; trace: TraceStep[]; tokensIn: number; tokensOut: number; latencyMs: number; model: string };

export const askAgent = (agent: { model: string; system_prompt: string; temperature: number }, history: { role: 'user' | 'assistant'; content: string }[], question: string) =>
  post<AgentAnswer>('/api/lab/answer', { agent: { model: agent.model, system_prompt: agent.system_prompt, temperature: agent.temperature }, history, question });

export const askJudge = (opts: { model: string; rubric: Rubric; question: string; answer: string; reference: string | null }) =>
  post<Judgment>('/api/lab/judge', opts);
