'use client';
import { api, fmtPct, useApi } from '#/lib/lab/client';
import type { Agent, Dataset, Rubric, Run, Session } from '#/lib/lab/store';
import { Button } from '#/ui/controls';
import { Badge, Checkbox, ErrorNote, Loading, Select, TextField } from '#/ui/form';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useModels } from '../agents/editors';

export function Studio() {
  const router = useRouter();
  const agents = useApi<Agent[]>('/api/lab/agents');
  const rubrics = useApi<Rubric[]>('/api/lab/rubrics');
  const datasets = useApi<Dataset[]>('/api/lab/datasets');
  const sessions = useApi<Session[]>('/api/lab/sessions');
  const runs = useApi<Run[]>('/api/lab/runs');
  const models = useModels();

  const [name, setName] = useState('');
  const [agentId, setAgentId] = useState<number | null>(null);
  const [rubricId, setRubricId] = useState<number | null>(null);
  const [sourceKind, setSourceKind] = useState<'dataset' | 'sessions'>('dataset');
  const [datasetId, setDatasetId] = useState<number | null>(null);
  const [picked, setPicked] = useState<number[] | 'all'>('all');
  const [judges, setJudges] = useState<string[]>(['gemini-2.5-flash']);
  const [limit, setLimit] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const loading = [agents, rubrics, datasets, sessions].some((x) => x.loading && !x.data);
  const loadError = [agents, rubrics, datasets, sessions].map((x) => x.error).find(Boolean);
  if (loading) return <Loading />;
  if (loadError) return <ErrorNote>{loadError}</ErrorNote>;

  const agent = agentId ?? agents.data![0]?.id;
  const rubric = rubricId ?? rubrics.data![0]?.id;
  const dataset = datasetId ?? datasets.data![0]?.id;
  // Suggested judges first, then the key's Gemini flash / pro text models.
  const judgeOptions = [...new Set([...(models.data?.defaultJudges ?? []), ...judges, ...(models.data?.gemini.models ?? []).filter((m) => /^gemini-[\d.]+-(flash|pro)(-lite)?$/.test(m))])];

  const start = async () => {
    setBusy(true);
    setError(null);
    try {
      const source = sourceKind === 'dataset' ? { kind: 'dataset', datasetId: dataset } : { kind: 'sessions', sessionIds: picked };
      const auto = `${agents.data!.find((a) => a.id === agent)?.name} · ${sourceKind === 'dataset' ? datasets.data!.find((d) => d.id === dataset)?.name : 'sessions'}`;
      const r = await api<{ id: number }>('/api/lab/runs', {
        method: 'POST',
        json: { name: name.trim() || auto, agentId: agent, rubricId: rubric, source, judges, limit: Number(limit) || undefined },
      });
      router.push(`/lab/studio/runs/${r.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };

  const toggleJudge = (m: string) => setJudges((j) => (j.includes(m) ? j.filter((x) => x !== m) : j.length >= 4 ? j : [...j, m]));

  return (
    <div className="flex flex-col gap-8">
      <section aria-labelledby="new-run" className="flex flex-col gap-4">
        <h2 id="new-run" className="text-base font-semibold text-gray-100">
          New benchmark run
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField label="Run name (optional)" value={name} onChange={(e) => setName(e.target.value)} />
          <Select label="Agent" value={agent ?? ''} onChange={(e) => setAgentId(Number(e.target.value))} options={agents.data!.map((a) => ({ value: a.id, label: `${a.name} · ${a.model}` }))} />
          <Select label="Rubric" value={rubric ?? ''} onChange={(e) => setRubricId(Number(e.target.value))} options={rubrics.data!.map((r) => ({ value: r.id, label: `${r.name} (${r.criteria.length} criteria, pass ≥ ${r.pass_threshold})` }))} />
          <TextField label="Limit items (optional)" type="number" min={1} value={limit} onChange={(e) => setLimit(e.target.value)} hint="Useful for a quick trial run." />
        </div>

        <fieldset className="flex flex-col gap-3">
          <legend className="mb-2 text-sm font-medium text-gray-300">Source</legend>
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-sm text-gray-200">
              <input type="radio" name="src" checked={sourceKind === 'dataset'} onChange={() => setSourceKind('dataset')} className="text-accent focus:ring-accent" />
              Golden dataset (agent answers fresh)
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-200">
              <input type="radio" name="src" checked={sourceKind === 'sessions'} onChange={() => setSourceKind('sessions')} className="text-accent focus:ring-accent" />
              Import sessions (judge stored answers)
            </label>
          </div>
          {sourceKind === 'dataset' ? (
            <Select label="Dataset" value={dataset ?? ''} onChange={(e) => setDatasetId(Number(e.target.value))} options={datasets.data!.map((d) => ({ value: d.id, label: `${d.name} (${d.items} items)` }))} />
          ) : (
            <div className="flex flex-col gap-2 rounded-lg bg-gray-900 p-3">
              <Checkbox label={`All sessions (${sessions.data!.length})`} checked={picked === 'all'} onChange={(e) => setPicked(e.target.checked ? 'all' : [])} />
              {picked !== 'all' && (
                <ul className="flex max-h-60 flex-col gap-1 overflow-y-auto pl-2">
                  {sessions.data!.map((s) => (
                    <li key={s.id}>
                      <Checkbox
                        label={`${s.title} · ${s.agent_name} · ${s.turns} Q`}
                        checked={picked.includes(s.id)}
                        onChange={(e) => setPicked(e.target.checked ? [...picked, s.id] : picked.filter((x) => x !== s.id))}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </fieldset>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-medium text-gray-300">Judges (Gemini, up to 4)</legend>
          {models.loading && <Loading label="Loading Gemini models…" />}
          {models.data?.gemini.error && <p className="text-xs text-warn">Could not list Gemini models: {models.data.gemini.error}</p>}
          <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
            {judgeOptions.map((m) => (
              <Checkbox key={m} label={m} checked={judges.includes(m)} onChange={() => toggleJudge(m)} />
            ))}
          </div>
          <p className="text-xs text-gray-500">Several judges give an inter-judge agreement (kappa) and a majority-vote verdict.</p>
        </fieldset>

        <ErrorNote>{error}</ErrorNote>
        <div>
          <Button onClick={start} disabled={busy || !judges.length}>
            {busy ? 'Creating…' : 'Create and start run'}
          </Button>
        </div>
      </section>

      <section aria-labelledby="runs" className="flex flex-col gap-3">
        <h2 id="runs" className="text-base font-semibold text-gray-100">
          Stored reports
        </h2>
        {runs.loading && !runs.data ? (
          <Loading />
        ) : !runs.data?.length ? (
          <p className="text-sm text-gray-500">No runs yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-400">
                  <th className="border-b border-gray-700 py-2 pr-3 font-medium">Run</th>
                  <th className="border-b border-gray-700 px-2 py-2 font-medium">Status</th>
                  <th className="border-b border-gray-700 px-2 py-2 font-medium">Judges</th>
                  <th className="border-b border-gray-700 px-2 py-2 text-right font-medium">Items</th>
                  <th className="border-b border-gray-700 px-2 py-2 text-right font-medium">Pass (majority)</th>
                  <th className="border-b border-gray-700 px-2 py-2 font-medium">Created (UTC)</th>
                </tr>
              </thead>
              <tbody>
                {runs.data.map((r) => (
                  <tr key={r.id} className="text-gray-300">
                    <td className="border-b border-gray-800 py-2 pr-3">
                      <Link href={`/lab/studio/runs/${r.id}`} className="text-gray-100 hover:underline">
                        {r.name}
                      </Link>
                      <div className="text-xs text-gray-500">{r.rubric_name}</div>
                    </td>
                    <td className="border-b border-gray-800 px-2 py-2">
                      <Badge tone={r.status === 'done' ? 'good' : r.status === 'failed' ? 'bad' : 'warn'}>{r.status}</Badge>
                    </td>
                    <td className="border-b border-gray-800 px-2 py-2 text-xs text-gray-400">{r.judges.join(', ')}</td>
                    <td className="border-b border-gray-800 px-2 py-2 text-right font-mono">
                      {r.done}/{r.total}
                    </td>
                    <td className="border-b border-gray-800 px-2 py-2 text-right font-mono">{r.summary ? fmtPct(r.summary.consensusPassRate) : '—'}</td>
                    <td className="border-b border-gray-800 px-2 py-2 font-mono text-xs text-gray-500">{r.created_at}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
