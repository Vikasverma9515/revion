'use client';
import { api, useApi } from '#/lib/lab/client';
import type { Annotation, Result, Rubric, Run } from '#/lib/lab/store';
import { Button } from '#/ui/controls';
import { Badge, ErrorNote, Loading, Select, TextArea, TextField } from '#/ui/form';
import { Markdown } from '#/ui/markdown';
import clsx from 'clsx';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

type Report = { run: Run; rubric: Rubric | null; results: Result[]; annotations: Annotation[] };

export function Annotate() {
  const params = useSearchParams();
  const runs = useApi<Run[]>('/api/lab/runs');
  const [runId, setRunId] = useState<number | null>(Number(params.get('run')) || null);
  const [annotator, setAnnotator] = useState('');
  useEffect(() => {
    try {
      setAnnotator(localStorage.getItem('annotator') ?? '');
    } catch {}
  }, []);
  const saveName = (v: string) => {
    setAnnotator(v);
    try {
      localStorage.setItem('annotator', v);
    } catch {}
  };

  if (runs.loading && !runs.data) return <Loading />;
  if (runs.error) return <ErrorNote>{runs.error}</ErrorNote>;
  const ready = runs.data!.filter((r) => r.done > 0);
  const chosen = runId ?? ready[0]?.id ?? null;
  if (!ready.length)
    return (
      <p className="text-sm text-gray-500">
        No results to label yet. <Link href="/lab/studio" className="text-accent underline">Run a benchmark</Link> first.
      </p>
    );

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Select label="Run" value={chosen ?? ''} onChange={(e) => setRunId(Number(e.target.value))} options={ready.map((r) => ({ value: r.id, label: `#${r.id} ${r.name} (${r.done} items)` }))} />
        <TextField label="Your name (annotator)" value={annotator} onChange={(e) => saveName(e.target.value)} placeholder="e.g. vikas" hint="Stored in this browser only." />
      </div>
      {chosen && annotator.trim() ? <Queue runId={chosen} annotator={annotator.trim()} /> : <p className="text-sm text-gray-500">Enter your name to start labelling.</p>}
    </div>
  );
}

function Queue({ runId, annotator }: { runId: number; annotator: string }) {
  const report = useApi<Report>(`/api/lab/runs/${runId}`);
  const [index, setIndex] = useState<number | null>(null);
  const items = useMemo(() => report.data?.results.filter((r) => r.status === 'done') ?? [], [report.data]);
  const mine = useMemo(() => new Map((report.data?.annotations ?? []).filter((a) => a.annotator === annotator).map((a) => [a.result_id, a])), [report.data, annotator]);

  useEffect(() => {
    if (index === null && items.length) {
      const first = items.findIndex((r) => !mine.has(r.id));
      setIndex(first === -1 ? 0 : first);
    }
  }, [items, mine, index]);

  if (report.loading && !report.data) return <Loading />;
  if (report.error) return <ErrorNote>{report.error}</ErrorNote>;
  if (!items.length) return <p className="text-sm text-gray-500">This run has no judged items yet.</p>;
  const i = index ?? 0;
  const item = items[i];
  const criteria = report.data!.rubric?.criteria ?? [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3 text-sm text-gray-400">
        <span className="font-mono">
          Item {i + 1} / {items.length}
        </span>
        <span>· you have labelled {mine.size}</span>
        <div className="h-1.5 min-w-32 flex-1 overflow-hidden rounded bg-gray-800" aria-hidden>
          <div className="h-full bg-accent" style={{ width: `${(mine.size / items.length) * 100}%` }} />
        </div>
        <Link href={`/lab/studio/runs/${runId}`} className="text-accent underline">
          Report
        </Link>
      </div>
      <nav aria-label="Items" className="flex flex-wrap gap-1">
        {items.map((r, j) => (
          <button
            key={r.id}
            type="button"
            onClick={() => setIndex(j)}
            aria-current={j === i ? 'true' : undefined}
            aria-label={`Item ${j + 1}${mine.has(r.id) ? ', labelled' : ''}`}
            className={clsx('size-7 rounded font-mono text-[11px]', j === i ? 'bg-accent text-on-accent' : mine.has(r.id) ? 'bg-gray-700 text-gray-100' : 'bg-gray-900 text-gray-500 hover:bg-gray-800')}
          >
            {j + 1}
          </button>
        ))}
      </nav>
      <Item key={`${item.id}-${annotator}`} item={item} criteria={criteria.map((c) => c.name)} existing={mine.get(item.id)} annotator={annotator} onSaved={async () => {
        await report.reload();
        setIndex(Math.min(items.length - 1, i + 1));
      }} />
    </div>
  );
}

function Item({ item, criteria, existing, annotator, onSaved }: { item: Result; criteria: string[]; existing?: Annotation; annotator: string; onSaved: () => void }) {
  const [pass, setPass] = useState<boolean | null>(existing ? !!existing.pass : null);
  const [scores, setScores] = useState<Record<string, number>>(existing?.scores ?? {});
  const [note, setNote] = useState(existing?.note ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [reveal, setReveal] = useState(false);

  const save = async () => {
    if (pass === null) return;
    setSaving(true);
    setError(null);
    try {
      await api('/api/lab/annotations', { method: 'POST', json: { resultId: item.id, annotator, pass, scores, note } });
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <article className="flex flex-col gap-4 rounded-lg bg-gray-900 p-4">
      <Section label="Question">{item.question}</Section>
      {item.reference && <Section label="Reference answer">{item.reference}</Section>}
      <div>
        <div className="mb-1 text-xs font-medium text-gray-500">Agent answer</div>
        <Markdown>{item.answer ?? ''}</Markdown>
      </div>
      {item.context.length > 0 && (
        <details className="text-xs text-gray-400">
          <summary className="cursor-pointer hover:text-gray-200">Sources the agent retrieved ({item.context.length})</summary>
          <ol className="mt-2 flex flex-col gap-2">
            {item.context.map((s) => (
              <li key={s.chunk_id} className="rounded border border-gray-800 p-2">
                <span className="font-mono text-accent">[{s.n}]</span> <span className="text-gray-300">{s.title}</span>
                <p className="mt-1 line-clamp-5 whitespace-pre-wrap">{s.text}</p>
              </li>
            ))}
          </ol>
        </details>
      )}

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium text-gray-200">Overall verdict</legend>
        <div className="flex gap-2">
          <button type="button" aria-pressed={pass === true} onClick={() => setPass(true)} className={clsx('rounded-md border px-4 py-2 text-sm font-semibold', pass === true ? 'border-good bg-good/15 text-good' : 'border-gray-700 text-gray-300 hover:bg-gray-800')}>
            ✓ Pass
          </button>
          <button type="button" aria-pressed={pass === false} onClick={() => setPass(false)} className={clsx('rounded-md border px-4 py-2 text-sm font-semibold', pass === false ? 'border-bad bg-bad/15 text-bad' : 'border-gray-700 text-gray-300 hover:bg-gray-800')}>
            ✗ Fail
          </button>
        </div>
      </fieldset>

      {criteria.length > 0 && (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-medium text-gray-200">Criterion scores (optional, 1–5)</legend>
          {criteria.map((c) => (
            <div key={c} className="flex flex-wrap items-center gap-2">
              <span className="w-32 text-sm text-gray-300">{c}</span>
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  aria-label={`${c} ${n}`}
                  aria-pressed={scores[c] === n}
                  onClick={() => setScores({ ...scores, [c]: n })}
                  className={clsx('size-8 rounded font-mono text-sm', scores[c] === n ? 'bg-accent text-on-accent' : 'bg-gray-800 text-gray-300 hover:bg-gray-700')}
                >
                  {n}
                </button>
              ))}
            </div>
          ))}
        </fieldset>
      )}

      <TextArea label="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
      <ErrorNote>{error}</ErrorNote>
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={save} disabled={pass === null || saving}>
          {saving ? 'Saving…' : existing ? 'Update and next' : 'Save and next'}
        </Button>
        {existing && <Badge tone="accent">already labelled by you</Badge>}
        <button type="button" onClick={() => setReveal((r) => !r)} disabled={!existing} className="ml-auto text-xs text-gray-400 underline disabled:no-underline disabled:opacity-50">
          {existing ? (reveal ? 'Hide judge scores' : 'Reveal judge scores') : 'Judge scores unlock after you label'}
        </button>
      </div>
      {reveal && existing && (
        <ul className="flex flex-col gap-1 text-xs text-gray-400">
          {item.judgments.map((j) => (
            <li key={j.judge}>
              <span className="font-mono text-gray-200">{j.judge}</span>: {j.error ? 'error' : `${j.pass ? 'pass' : 'fail'} (${j.overall.toFixed(2)}) · ${j.verdict}`}
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 text-xs font-medium text-gray-500">{label}</div>
      <div className="text-sm whitespace-pre-wrap text-gray-100">{children}</div>
    </div>
  );
}
