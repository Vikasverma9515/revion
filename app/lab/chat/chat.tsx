'use client';
import { api, fmtMs, useApi } from '#/lib/lab/client';
import type { Agent, Dataset, Message, Session } from '#/lib/lab/store';
import { Button } from '#/ui/controls';
import { Badge, ErrorNote, Loading, Select, TextArea, TextField } from '#/ui/form';
import clsx from 'clsx';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

export function Chat() {
  const params = useSearchParams();
  const router = useRouter();
  const agents = useApi<Agent[]>('/api/lab/agents');
  const [agentId, setAgentId] = useState<number | null>(null);
  const [sessionId, setSessionId] = useState<number | null>(Number(params.get('session')) || null);
  const sessions = useApi<Session[]>(agentId ? `/api/lab/sessions?agentId=${agentId}` : null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingSession, setLoadingSession] = useState(false);
  const [question, setQuestion] = useState('');
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const end = useRef<HTMLDivElement>(null);

  // Pick the agent: the one owning the requested session, else the first.
  useEffect(() => {
    if (!agents.data?.length || agentId) return;
    if (sessionId) {
      api<{ session: Session }>(`/api/lab/sessions/${sessionId}`)
        .then((r) => setAgentId(r.session.agent_id))
        .catch(() => setAgentId(agents.data![0].id));
    } else setAgentId(agents.data[0].id);
  }, [agents.data, agentId, sessionId]);

  useEffect(() => {
    if (!sessionId) {
      setMessages([]);
      return;
    }
    setLoadingSession(true);
    api<{ messages: Message[] }>(`/api/lab/sessions/${sessionId}`)
      .then((r) => setMessages(r.messages))
      .catch((e) => setError(e.message))
      .finally(() => setLoadingSession(false));
  }, [sessionId]);

  useEffect(() => end.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }), [messages.length, pending]);

  const openSession = (id: number | null) => {
    setSessionId(id);
    setError(null);
    router.replace(id ? `/lab/chat?session=${id}` : '/lab/chat', { scroll: false });
  };

  const send = async () => {
    const q = question.trim();
    if (!q || !agentId || pending) return;
    setPending(q);
    setQuestion('');
    setError(null);
    try {
      const r = await api<{ sessionId: number; user: Message; assistant: Message }>('/api/lab/chat', { method: 'POST', json: { agentId, sessionId, question: q } });
      setMessages((m) => [...m, r.user, r.assistant]);
      if (r.sessionId !== sessionId) {
        setSessionId(r.sessionId);
        router.replace(`/lab/chat?session=${r.sessionId}`, { scroll: false });
      }
      sessions.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setQuestion(q);
    } finally {
      setPending(null);
    }
  };

  if (agents.loading && !agents.data) return <Loading />;
  if (agents.error) return <ErrorNote>{agents.error}</ErrorNote>;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[14rem_1fr]">
      <aside className="flex flex-col gap-4" aria-label="Agent and sessions">
        <Select
          label="Agent"
          value={agentId ?? ''}
          onChange={(e) => {
            setAgentId(Number(e.target.value));
            openSession(null);
          }}
          options={(agents.data ?? []).map((a) => ({ value: a.id, label: `${a.name} · ${a.model}` }))}
        />
        <Button kind="quiet" onClick={() => openSession(null)}>
          New conversation
        </Button>
        <div className="flex flex-col gap-1">
          <div className="text-xs font-medium text-gray-500 uppercase">Sessions</div>
          {sessions.loading && !sessions.data ? (
            <Loading />
          ) : (
            <ul className="flex max-h-72 flex-col gap-1 overflow-y-auto lg:max-h-[28rem]">
              {(sessions.data ?? []).map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => openSession(s.id)}
                    className={clsx('w-full truncate rounded-md px-2 py-1.5 text-left text-sm', s.id === sessionId ? 'bg-gray-800 text-white' : 'text-gray-400 hover:bg-gray-900')}
                    aria-current={s.id === sessionId ? 'true' : undefined}
                  >
                    {s.title}
                  </button>
                </li>
              ))}
              {sessions.data?.length === 0 && <li className="text-sm text-gray-600">No sessions yet.</li>}
            </ul>
          )}
        </div>
      </aside>

      <section className="flex min-w-0 flex-col gap-4" aria-label="Conversation">
        {loadingSession && <Loading label="Loading conversation…" />}
        {!loadingSession && messages.length === 0 && !pending && (
          <div className="rounded-lg border border-dashed border-gray-800 p-6 text-sm text-gray-500">
            Ask anything. The agent searches the knowledge base first, cites what it uses, and can search again or calculate. Try:
            &ldquo;Why does specificity dominate the interval width?&rdquo;
          </div>
        )}
        <ol className="flex flex-col gap-4">
          {messages.map((m, i) =>
            m.role === 'user' ? (
              <li key={m.id} className="ml-auto max-w-[85%] rounded-lg bg-accent/15 px-4 py-2.5 text-sm whitespace-pre-wrap text-gray-100">
                {m.content}
              </li>
            ) : (
              <AssistantMessage key={m.id} m={m} question={messages[i - 1]?.content ?? ''} />
            ),
          )}
          {pending && (
            <>
              <li className="ml-auto max-w-[85%] rounded-lg bg-accent/15 px-4 py-2.5 text-sm whitespace-pre-wrap text-gray-100">{pending}</li>
              <li>
                <Loading label="Retrieving and answering…" />
              </li>
            </>
          )}
        </ol>
        <div ref={end} />
        <ErrorNote>{error}</ErrorNote>
        <form
          className="sticky bottom-2 flex flex-col gap-2 rounded-lg border border-gray-800 bg-gray-950 p-3"
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
        >
          <label htmlFor="q" className="sr-only">
            Your question
          </label>
          <textarea
            id="q"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            rows={2}
            placeholder="Ask the agent… (Enter to send, Shift+Enter for a new line)"
            className="w-full resize-none rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100 placeholder:text-gray-600 focus:border-accent focus:ring-accent"
          />
          <div className="flex justify-end">
            <Button type="submit" disabled={!question.trim() || !!pending || !agentId}>
              Send
            </Button>
          </div>
        </form>
      </section>
    </div>
  );
}

/** Render [n] citations as small badges. */
function withCitations(text: string) {
  return text.split(/(\[\d+\])/g).map((part, i) =>
    /^\[\d+\]$/.test(part) ? (
      <sup key={i} className="mx-0.5 rounded bg-gray-800 px-1 font-mono text-[10px] text-accent">
        {part.slice(1, -1)}
      </sup>
    ) : (
      part
    ),
  );
}

function AssistantMessage({ m, question }: { m: Message; question: string }) {
  const [saving, setSaving] = useState(false);
  return (
    <li className="flex flex-col gap-2 rounded-lg bg-gray-900 px-4 py-3">
      <div className="text-sm leading-relaxed whitespace-pre-wrap text-gray-100">{withCitations(m.content)}</div>
      <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
        <Badge>{m.model}</Badge>
        <span>{fmtMs(m.latency_ms)}</span>
        <span>
          {m.tokens_in ?? 0} in / {m.tokens_out ?? 0} out tokens
        </span>
        <button type="button" onClick={() => setSaving((s) => !s)} className="ml-auto rounded-md border border-gray-700 px-2 py-1 text-gray-200 hover:bg-gray-800">
          {saving ? 'Close' : 'Save to golden set'}
        </button>
      </div>
      {m.context.length > 0 && (
        <details className="text-xs text-gray-400">
          <summary className="cursor-pointer hover:text-gray-200">Sources ({m.context.length})</summary>
          <ol className="mt-2 flex flex-col gap-2">
            {m.context.map((s) => (
              <li key={s.chunk_id} className="rounded border border-gray-800 p-2">
                <div className="mb-1 flex items-center gap-2">
                  <span className="font-mono text-accent">[{s.n}]</span>
                  <span className="font-medium text-gray-300">{s.title}</span>
                  <span className="ml-auto font-mono">sim {(1 - s.distance).toFixed(2)}</span>
                </div>
                <p className="line-clamp-4 whitespace-pre-wrap">{s.text}</p>
              </li>
            ))}
          </ol>
        </details>
      )}
      {m.trace.length > 0 && (
        <details className="text-xs text-gray-400">
          <summary className="cursor-pointer hover:text-gray-200">Tool trace ({m.trace.length})</summary>
          <ol className="mt-2 flex flex-col gap-1 font-mono">
            {m.trace.map((t, i) => (
              <li key={i}>
                {t.tool}({JSON.stringify(t.args)}) → {t.summary}
              </li>
            ))}
          </ol>
        </details>
      )}
      {saving && <SaveGolden question={question} answer={m.content} messageId={m.id} onDone={() => setSaving(false)} />}
    </li>
  );
}

export function SaveGolden({ question, answer, messageId, onDone }: { question: string; answer: string; messageId?: number; onDone: () => void }) {
  const datasets = useApi<Dataset[]>('/api/lab/datasets');
  const [q, setQ] = useState(question);
  // Strip citation markers: a reference answer should stand on its own.
  const [ref, setRef] = useState(answer.replace(/\s?\[\d+\]/g, ''));
  const [tags, setTags] = useState('');
  const [datasetId, setDatasetId] = useState<number | null>(null);
  const [newName, setNewName] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const chosen = datasetId ?? datasets.data?.[0]?.id ?? null;

  const save = async () => {
    setError(null);
    try {
      let id = chosen;
      if (newName.trim()) id = (await api<{ id: number }>('/api/lab/datasets', { method: 'POST', json: { name: newName.trim() } })).id;
      if (!id) throw new Error('Pick or name a dataset.');
      await api('/api/lab/golden', { method: 'POST', json: { datasetId: id, question: q, reference: ref, tags, sourceMessageId: messageId } });
      setStatus('Saved to the golden set.');
      setTimeout(onDone, 900);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div className="mt-2 flex flex-col gap-3 rounded-lg border border-gray-700 p-3">
      <TextArea label="Question" value={q} onChange={(e) => setQ(e.target.value)} rows={2} />
      <TextArea label="Reference answer (edit it into the answer you want judged as correct)" value={ref} onChange={(e) => setRef(e.target.value)} rows={6} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Select
          label="Dataset"
          value={chosen ?? ''}
          onChange={(e) => setDatasetId(Number(e.target.value))}
          options={(datasets.data ?? []).map((d) => ({ value: d.id, label: `${d.name} (${d.items})` }))}
        />
        <TextField label="…or new dataset" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Name" />
        <TextField label="Tags" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="e.g. stats, p1" />
      </div>
      <ErrorNote>{error}</ErrorNote>
      <div className="flex items-center gap-3">
        <Button onClick={save} disabled={!q.trim() || !ref.trim()}>
          Save
        </Button>
        {status && <span role="status" className="text-sm text-good">{status}</span>}
      </div>
    </div>
  );
}
