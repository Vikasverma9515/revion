'use client';
import { api, useApi } from '#/lib/lab/client';
import type { Agent, Criterion, Rubric } from '#/lib/lab/store';
import { Button, Field } from '#/ui/controls';
import { ErrorNote, Loading, Select, TextArea, TextField } from '#/ui/form';
import { useEffect, useState } from 'react';

type Models = { groq: { models: string[]; error: string | null }; gemini: { models: string[]; error: string | null }; defaultJudges: string[] };

export function useModels() {
  return useApi<Models>('/api/lab/models');
}

export function AgentsEditor() {
  const agents = useApi<Agent[]>('/api/lab/agents');
  const models = useModels();
  const [id, setId] = useState<number | 'new' | null>(null);
  const current = id === 'new' ? null : (agents.data?.find((a) => a.id === (id ?? agents.data?.[0]?.id)) ?? null);
  const [form, setForm] = useState<Omit<Agent, 'id' | 'created_at'>>({ name: '', model: '', system_prompt: '', temperature: 0.2, top_k: 5, allow_general: 1 });
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (current) setForm({ ...current });
    else if (id === 'new') setForm({ name: 'New agent', model: agents.data?.[0]?.model ?? 'openai/gpt-oss-120b', system_prompt: 'You are a helpful assistant. Be precise and concise.', temperature: 0.2, top_k: 5, allow_general: 1 });
  }, [current?.id, id]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = async () => {
    setError(null);
    try {
      const r = await api<{ id: number }>('/api/lab/agents', { method: 'POST', json: { ...form, id: current?.id } });
      await agents.reload();
      setId(r.id);
      setMsg('Saved.');
      setTimeout(() => setMsg(null), 1500);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  if (agents.loading && !agents.data) return <Loading />;
  if (agents.error) return <ErrorNote>{agents.error}</ErrorNote>;
  const modelOptions = [...new Set([form.model, ...(models.data?.groq.models ?? [])].filter(Boolean))];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <Select
          label="Edit agent"
          className="min-w-60 flex-1"
          value={id === 'new' ? 'new' : (current?.id ?? '')}
          onChange={(e) => setId(e.target.value === 'new' ? 'new' : Number(e.target.value))}
          options={[...agents.data!.map((a) => ({ value: a.id, label: a.name })), { value: 'new', label: '+ New agent' }]}
        />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextField label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <Select
          label="Groq model"
          value={form.model}
          onChange={(e) => setForm({ ...form, model: e.target.value })}
          options={modelOptions.map((m) => ({ value: m, label: m }))}
          hint={models.data?.groq.error ? `Could not list models: ${models.data.groq.error}` : models.loading ? 'Loading models…' : undefined}
        />
      </div>
      <TextArea label="System prompt" value={form.system_prompt} onChange={(e) => setForm({ ...form, system_prompt: e.target.value })} rows={6} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Temperature" value={form.temperature} onChange={(v) => setForm({ ...form, temperature: v })} min={0} max={1.5} step={0.05} />
      </div>
      <ErrorNote>{error}</ErrorNote>
      <div className="flex items-center gap-3">
        <Button onClick={save}>{current ? 'Save agent' : 'Create agent'}</Button>
        {msg && <span role="status" className="text-sm text-good">{msg}</span>}
      </div>
    </div>
  );
}

export function RubricsEditor() {
  const rubrics = useApi<Rubric[]>('/api/lab/rubrics');
  const [id, setId] = useState<number | 'new' | null>(null);
  const current = id === 'new' ? null : (rubrics.data?.find((r) => r.id === (id ?? rubrics.data?.[0]?.id)) ?? null);
  const [name, setName] = useState('');
  const [criteria, setCriteria] = useState<Criterion[]>([]);
  const [rules, setRules] = useState('');
  const [threshold, setThreshold] = useState(4);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (current) {
      setName(current.name);
      setCriteria(current.criteria);
      setRules(current.rules);
      setThreshold(current.pass_threshold);
    } else if (id === 'new') {
      setName('New rubric');
      setCriteria([{ name: 'Correctness', description: 'Agrees with the reference answer and the sources.' }]);
      setRules('');
      setThreshold(4);
    }
  }, [current?.id, id]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = async () => {
    setError(null);
    try {
      const r = await api<{ id: number }>('/api/lab/rubrics', { method: 'POST', json: { id: current?.id, name, criteria, rules, pass_threshold: threshold } });
      await rubrics.reload();
      setId(r.id);
      setMsg('Saved.');
      setTimeout(() => setMsg(null), 1500);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  if (rubrics.loading && !rubrics.data) return <Loading />;
  if (rubrics.error) return <ErrorNote>{rubrics.error}</ErrorNote>;

  return (
    <div className="flex flex-col gap-4">
      <Select
        label="Edit rubric"
        value={id === 'new' ? 'new' : (current?.id ?? '')}
        onChange={(e) => setId(e.target.value === 'new' ? 'new' : Number(e.target.value))}
        options={[...rubrics.data!.map((r) => ({ value: r.id, label: r.name })), { value: 'new', label: '+ New rubric' }]}
      />
      <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} />
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-2 text-sm font-medium text-gray-300">Criteria (each scored 1–5)</legend>
        {criteria.map((c, i) => (
          <div key={i} className="grid grid-cols-1 gap-2 rounded-lg bg-gray-900 p-3 sm:grid-cols-[12rem_1fr_auto]">
            <TextField label={`Criterion ${i + 1}`} value={c.name} onChange={(e) => setCriteria(criteria.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
            <TextField label="What the judge should check" value={c.description} onChange={(e) => setCriteria(criteria.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)))} />
            <button type="button" className="self-end pb-2 text-xs text-bad hover:underline" onClick={() => setCriteria(criteria.filter((_, j) => j !== i))} aria-label={`Remove criterion ${c.name}`}>
              Remove
            </button>
          </div>
        ))}
        <div>
          <Button kind="quiet" onClick={() => setCriteria([...criteria, { name: '', description: '' }])}>
            Add criterion
          </Button>
        </div>
      </fieldset>
      <TextArea
        label="Hard rules (one per line; any violation fails the item)"
        value={rules}
        onChange={(e) => setRules(e.target.value)}
        rows={4}
        placeholder="e.g. Must not give medical dosage advice."
      />
      <Field label="Pass threshold (mean criterion score)" value={threshold} onChange={setThreshold} min={1} max={5} step={0.25} />
      <ErrorNote>{error}</ErrorNote>
      <div className="flex items-center gap-3">
        <Button onClick={save}>{current ? 'Save rubric' : 'Create rubric'}</Button>
        {msg && <span role="status" className="text-sm text-good">{msg}</span>}
      </div>
    </div>
  );
}
