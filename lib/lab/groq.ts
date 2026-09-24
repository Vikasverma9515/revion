// Groq chat completions (OpenAI-compatible API) with tool calling.
import 'server-only';
import { config, MissingKeyError } from './config';
import { fetchRetry } from './http';

const BASE = 'https://api.groq.com/openai/v1';

export type ChatMessage =
  | { role: 'system' | 'user'; content: string }
  | { role: 'assistant'; content: string | null; tool_calls?: ToolCall[] }
  | { role: 'tool'; tool_call_id: string; content: string };

export type ToolCall = { id: string; type: 'function'; function: { name: string; arguments: string } };
export type ToolSpec = { type: 'function'; function: { name: string; description: string; parameters: object } };

export type Completion = {
  message: { content: string | null; tool_calls?: ToolCall[] };
  usage: { prompt_tokens: number; completion_tokens: number };
};

function headers() {
  if (!config.groqKey) throw new MissingKeyError('GROQ_API_KEY');
  return { Authorization: `Bearer ${config.groqKey}`, 'Content-Type': 'application/json' };
}

export async function groqChat(opts: {
  model: string;
  messages: ChatMessage[];
  tools?: ToolSpec[];
  temperature?: number;
  maxTokens?: number;
}): Promise<Completion> {
  const res = await fetchRetry(
    `${BASE}/chat/completions`,
    {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({
        model: opts.model,
        messages: opts.messages,
        tools: opts.tools?.length ? opts.tools : undefined,
        tool_choice: opts.tools?.length ? 'auto' : undefined,
        temperature: opts.temperature ?? 0.2,
        max_completion_tokens: opts.maxTokens ?? 4096,
        // gpt-oss models think before answering; low effort keeps chat replies fast.
        ...(/gpt-oss/.test(opts.model) ? { reasoning_effort: 'low' } : {}),
      }),
    },
    'Groq',
  );
  const data = await res.json();
  return {
    message: data.choices?.[0]?.message ?? { content: '' },
    usage: { prompt_tokens: data.usage?.prompt_tokens ?? 0, completion_tokens: data.usage?.completion_tokens ?? 0 },
  };
}

/** Chat models available to this key (audio / guard models filtered out). */
export async function groqModels(): Promise<string[]> {
  const res = await fetchRetry(`${BASE}/models`, { headers: headers() }, 'Groq');
  const data = await res.json();
  return (data.data as { id: string; active?: boolean }[])
    .filter((m) => m.active !== false && !/whisper|tts|guard|playai|orpheus|distil/i.test(m.id))
    .map((m) => m.id)
    .sort();
}
