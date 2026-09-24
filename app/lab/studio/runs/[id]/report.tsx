'use client';
import { api, fmtMs, fmtNum, fmtPct, useApi } from '#/lib/lab/client';
import type { Annotation, Result, Rubric, Run } from '#/lib/lab/store';
import { Legend, S1, S2, S3, type SeriesStyle } from '#/ui/charts';
import { Button } from '#/ui/controls';
import { Badge, ErrorNote, Loading } from '#/ui/form';
import { Formula, Stat } from '#/ui/stat';
import { Markdown } from '#/ui/markdown';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

type Agreement = {
  n: number; tp: number; fn: number; tn: number; fp: number; agreement: number; kappa: number | null;
  sensitivity: number | null; specificity: number | null; humanPassRate: number; judgePassRateAll: number;
  corrected: { pi: number; lo: number; hi: number } | null;
};
type Report = { run: Run; rubric: Rubric | null; results: Result[]; annotations: Annotation[]; agreement: Agreement | null };

const JUDGE_STYLES: SeriesStyle[] = [S1, S2, S3, { color: 'var(--color-gray-400)', marker: 'circle', dash: '1 2' }];

export function Report({ id }: { id: number }) {
  const router = useRouter();
  const report = useApi<Report>(`/api/lab/runs/${id}`);
  const [stepping, setStepping] = useState(false);
  const [stepError, setStepError] = useState<string | null>(null);
  const cancelled = useRef(false);

  // Drive the run: call /step until it is done, refreshing the report each time.
  const drive = useCallback(async () => {
    setStepping(true);
    setStepError(null);
    cancelled.current = false;
    try {
      for (;;) {
        const s = await api<{ status: string; done: number; total: number }>(`/api/lab/runs/${id}/step`, { method: 'POST' });
        await report.reload();
        if (s.status === 'done' || cancelled.current) break;
      }
    } catch (e) {
      setStepError(e instanceof Error ? e.message : String(e));
    } finally {
      setStepping(false);
    }
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const started = useRef(false);
  useEffect(() => {
    if (!started.current && report.data && report.data.run.status !== 'done') {
      started.current = true;
      drive();
    }
    return () => {
      cancelled.current = true;
    };
  }, [report.data?.run.status]); // eslint-disable-line react-hooks/exhaustive-deps

  if (report.loading && !report.data) return <Loading />;
  if (report.error) return <ErrorNote>{report.error}</ErrorNote>;
  const { run, rubric, results, annotations, agreement } = report.data!;
  const s = run.summary;
  const criteria = rubric?.criteria.map((c) => c.name) ?? [];

  const exportFile = (kind: 'json' | 'csv') => {
    let body: string;
    if (kind === 'json') body = JSON.stringify(report.data, null, 2);
    else {
      const cols = ['position', 'question', 'reference', 'answer', ...run.judges.flatMap((j) => [`${j}:pass`, `${j}:overall`, ...criteria.map((c) => `${j}:${c}`)]), 'human_pass'];
      const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
      const rows = results.map((r) => {
        const human = annotations.filter((a) => a.result_id === r.id);
        return [
          r.position + 1, r.question, r.reference, r.answer,
          ...run.judges.flatMap((j) => {
            const x = r.judgments.find((y) => y.judge === j);
            return [x?.pass, x?.overall?.toFixed(2), ...criteria.map((c) => x?.scores[c])];
          }),
          human.length ? human.filter((a) => a.pass).length * 2 > human.length : '',
        ].map(esc).join(',');
      });
      body = [cols.map(esc).join(','), ...rows].join('\n');
    }
    const url = URL.createObjectURL(new Blob([body], { type: kind === 'json' ? 'application/json' : 'text/csv' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `run-${run.id}.${kind}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const failedCount = results.filter((r) => r.status === 'failed' || r.judgments.some((j) => j.error)).length;
  const retry = async () => {
    try {
      await api(`/api/lab/runs/${id}/retry`, { method: 'POST' });
      await report.reload();
      drive();
    } catch (e) {
      setStepError(e instanceof Error ? e.message : String(e));
    }
  };

  const remove = async () => {
    if (!confirm('Delete this run, its results and annotations?')) return;
    await api(`/api/lab/runs/${id}`, { method: 'DELETE' });
    router.push('/lab/studio');
  };

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-3">
        <div className="font-mono text-xs font-semibold tracking-wider text-gray-500 uppercase">Benchmark report #{run.id}</div>
        <h1 className="text-2xl font-semibold text-gray-100">{run.name}</h1>
        <div className="flex flex-wrap items-center gap-2 text-sm text-gray-400">
          <Badge tone={run.status === 'done' ? 'good' : run.status === 'failed' ? 'bad' : 'warn'}>{run.status}</Badge>
          <span>Agent: {run.agent_name}</span>
          <span>· Rubric: {run.rubric_name}</span>
          <span>· Source: {run.source.kind === 'dataset' ? 'golden dataset' : 'imported sessions'}</span>
          <span>· Judges: {run.judges.join(', ')}</span>
        </div>
        {run.status !== 'done' && (
          <div className="flex flex-col gap-2">
            <div className="h-2 w-full overflow-hidden rounded bg-gray-800" role="progressbar" aria-valuenow={run.done} aria-valuemin={0} aria-valuemax={run.total} aria-label="Run progress">
              <div className="h-full bg-accent transition-all" style={{ width: `${(run.done / Math.max(1, run.total)) * 100}%` }} />
            </div>
            <div className="flex flex-wrap items-center gap-3 text-sm text-gray-400">
              <span>
                {run.done} of {run.total} items processed
              </span>
              {stepping ? (
                <>
                  <span className="spinner size-4 rounded-full" aria-hidden />
                  <Button kind="quiet" onClick={() => (cancelled.current = true)}>
                    Pause after this step
                  </Button>
                </>
              ) : (
                <Button onClick={drive}>Resume run</Button>
              )}
            </div>
            <ErrorNote>{stepError}</ErrorNote>
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          {run.status === 'done' && failedCount > 0 && (
            <Button onClick={retry} disabled={stepping}>
              Re-run {failedCount} failed judgment{failedCount > 1 ? 's' : ''}
            </Button>
          )}
          <Button kind="quiet" onClick={() => exportFile('csv')}>
            Export CSV
          </Button>
          <Button kind="quiet" onClick={() => exportFile('json')}>
            Export JSON
          </Button>
          <Link href={`/lab/annotate?run=${run.id}`} className="rounded-md border border-gray-700 px-3.5 py-2 text-sm font-semibold text-gray-200 hover:bg-gray-800">
            Annotate this run
          </Link>
          <Button kind="quiet" onClick={remove} className="text-bad">
            Delete run
          </Button>
        </div>
      </header>

      {s && (
        <section aria-label="Summary" className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Pass rate (judge majority)" value={fmtPct(s.consensusPassRate, 1)} accent sub={`${s.items - s.failed} judged, ${s.failed} failed`} />
            <Stat label="Inter-judge kappa" value={s.interJudgeKappa == null ? '—' : fmtNum(s.interJudgeKappa)} sub={run.judges.length > 1 ? 'mean pairwise, on pass/fail' : 'needs 2+ judges'} />
            <Stat label="Agent latency p50 / p95" value={`${fmtMs(s.latencyP50)}`} sub={`p95 ${fmtMs(s.latencyP95)}`} />
            <Stat label="Agent tokens" value={(s.tokensIn + s.tokensOut).toLocaleString()} sub={`${s.tokensIn.toLocaleString()} in / ${s.tokensOut.toLocaleString()} out`} />
          </div>
          <figure className="flex flex-col gap-3 rounded-lg bg-gray-900 p-4">
            <figcaption className="text-sm font-semibold text-gray-100">Mean score per criterion, by judge (1–5)</figcaption>
            <Legend items={s.judges.map((j, i) => ({ name: `${j.judge} · pass ${fmtPct(j.passRate)}${j.errors ? ` · ${j.errors} errors` : ''}`, style: JUDGE_STYLES[i % 4] }))} />
            <div className="flex flex-col gap-3">
              {criteria.map((c) => (
                <div key={c} className="grid grid-cols-[7rem_1fr] items-center gap-3 sm:grid-cols-[10rem_1fr]">
                  <span className="truncate text-sm text-gray-300">{c}</span>
                  <div className="flex flex-col gap-[2px]">
                    {s.judges.map((j, i) => (
                      <div key={j.judge} className="flex items-center gap-2">
                        <div
                          className="h-2.5 rounded-r-sm"
                          style={{
                            width: `${((j.criteria[c] ?? 0) / 5) * 100}%`,
                            background: JUDGE_STYLES[i % 4].color,
                            backgroundImage: i % 2 ? 'repeating-linear-gradient(45deg, transparent 0 3px, rgba(0,0,0,.3) 3px 5px)' : undefined,
                          }}
                        />
                        <span className="font-mono text-xs text-gray-300">{fmtNum(j.criteria[c])}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <p className="text-sm text-gray-400">
              <span className="font-medium text-gray-200">What to notice: </span>
              the weakest criterion is where to improve the agent; a large gap between judges on one criterion means the rubric wording is
              ambiguous.
            </p>
          </figure>
        </section>
      )}

      <HumanAgreement agreement={agreement} runId={run.id} annotations={annotations.length} />

      <section aria-labelledby="items" className="flex flex-col gap-3">
        <h2 id="items" className="text-base font-semibold text-gray-100">
          Items
        </h2>
        <ol className="flex flex-col gap-2">
          {results.map((r) => (
            <ResultRow key={r.id} r={r} criteria={criteria} human={annotations.filter((a) => a.result_id === r.id)} />
          ))}
        </ol>
      </section>
    </div>
  );
}

function HumanAgreement({ agreement: a, runId, annotations }: { agreement: Agreement | null; runId: number; annotations: number }) {
  return (
    <section aria-labelledby="human" className="flex flex-col gap-3">
      <h2 id="human" className="text-base font-semibold text-gray-100">
        Judges vs human annotators
      </h2>
      {!a ? (
        <p className="text-sm text-gray-400">
          {annotations ? 'Annotated items have no judge verdict yet.' : 'No human labels yet.'}{' '}
          <Link href={`/lab/annotate?run=${runId}`} className="text-accent underline">
            Annotate items
          </Link>{' '}
          to measure how far the LLM judges can be trusted.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Items labelled by humans" value={a.n} />
            <Stat label="Agreement / Cohen's kappa" value={fmtPct(a.agreement)} sub={`κ = ${a.kappa == null ? '—' : fmtNum(a.kappa)}`} />
            <Stat label="Judge sensitivity / specificity" value={`${fmtNum(a.sensitivity)} / ${fmtNum(a.specificity)}`} sub="vs human pass / fail" />
            <Stat
              label="Corrected pass rate"
              value={a.corrected ? fmtPct(Math.min(1, Math.max(0, a.corrected.pi)), 1) : '—'}
              accent
              sub={a.corrected ? `95% CI ${fmtPct(Math.max(0, a.corrected.lo), 1)} – ${fmtPct(Math.min(1, a.corrected.hi), 1)} · raw ${fmtPct(a.judgePassRateAll, 1)}` : 'needs human passes and fails'}
            />
          </div>
          <div className="overflow-x-auto">
            <table className="text-sm">
              <caption className="mb-1 text-left text-xs text-gray-500">Confusion matrix (rows: human, columns: judge majority)</caption>
              <thead>
                <tr className="text-xs text-gray-400">
                  <th />
                  <th className="px-4 py-1 font-medium">Judge pass</th>
                  <th className="px-4 py-1 font-medium">Judge fail</th>
                </tr>
              </thead>
              <tbody className="font-mono">
                <tr>
                  <th className="pr-4 text-left text-xs font-medium text-gray-400">Human pass</th>
                  <td className="px-4 py-1 text-center text-gray-100">{a.tp}</td>
                  <td className="px-4 py-1 text-center text-gray-100">{a.fn}</td>
                </tr>
                <tr>
                  <th className="pr-4 text-left text-xs font-medium text-gray-400">Human fail</th>
                  <td className="px-4 py-1 text-center text-gray-100">{a.fp}</td>
                  <td className="px-4 py-1 text-center text-gray-100">{a.tn}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <Formula>
            Corrected pass rate = (q + Sp − 1) / (Se + Sp − 1), with q the judges&apos; pass rate on all items and Se, Sp measured against
            the human labels. This is the Rogan-Gladen estimate from Problem 1, with a delta-method interval. It assumes the labelled items
            are representative and the humans are right.
          </Formula>
        </>
      )}
    </section>
  );
}

function ResultRow({ r, criteria, human }: { r: Result; criteria: string[]; human: Annotation[] }) {
  const passes = r.judgments.filter((j) => !j.error && j.pass).length;
  const valid = r.judgments.filter((j) => !j.error).length;
  const majority = valid ? passes * 2 > valid : null;
  return (
    <li className="rounded-lg bg-gray-900">
      <details>
        <summary className="flex cursor-pointer list-none flex-wrap items-center gap-2 px-4 py-3">
          <span className="font-mono text-xs text-gray-500">#{r.position + 1}</span>
          {r.status === 'pending' ? (
            <Badge tone="warn">pending</Badge>
          ) : r.status === 'failed' ? (
            <Badge tone="bad">error</Badge>
          ) : majority === null ? (
            <Badge tone="bad">judge error</Badge>
          ) : (
            <Badge tone={majority ? 'good' : 'bad'}>{majority ? '✓ pass' : '✗ fail'}</Badge>
          )}
          {human.length > 0 && <Badge tone="accent">human: {human.filter((h) => h.pass).length}/{human.length} pass</Badge>}
          <span className="min-w-0 flex-1 truncate text-sm text-gray-100">{r.question}</span>
          <span className="font-mono text-xs text-gray-500">{r.judgments.map((j) => (j.error ? 'err' : j.overall.toFixed(1))).join(' / ')}</span>
        </summary>
        <div className="flex flex-col gap-3 border-t border-gray-800 px-4 py-3 text-sm">
          {r.error && <ErrorNote>{r.error}</ErrorNote>}
          <Block label="Question">{r.question}</Block>
          {r.reference && <Block label="Reference">{r.reference}</Block>}
          <div>
            <div className="mb-1 text-xs font-medium text-gray-500">Agent answer · {fmtMs(r.latency_ms)}</div>
            {r.answer ? <Markdown>{r.answer}</Markdown> : <p className="text-gray-500">(not generated yet)</p>}
          </div>
          {r.judgments.map((j) => (
            <div key={j.judge} className="rounded-md border border-gray-800 p-3">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs text-gray-300">{j.judge}</span>
                {j.error ? <Badge tone="bad">error</Badge> : <Badge tone={j.pass ? 'good' : 'bad'}>{j.pass ? 'pass' : 'fail'} · {j.overall.toFixed(2)}</Badge>}
              </div>
              {j.error ? (
                <p className="text-xs text-bad">{j.error}</p>
              ) : (
                <>
                  <ul className="flex flex-col gap-1 text-xs text-gray-400">
                    {criteria.map((c) => (
                      <li key={c}>
                        <span className="font-mono text-gray-200">
                          {c} {j.scores[c]}/5
                        </span>{' '}
                        {j.reasons[c]}
                      </li>
                    ))}
                  </ul>
                  {j.verdict && <p className="mt-2 text-xs whitespace-pre-wrap text-gray-300">{j.verdict}</p>}
                </>
              )}
            </div>
          ))}
          {human.map((h) => (
            <p key={h.id} className="text-xs text-gray-400">
              <span className="font-medium text-gray-200">{h.annotator}</span>: {h.pass ? 'pass' : 'fail'}
              {h.note && ` · ${h.note}`}
            </p>
          ))}
        </div>
      </details>
    </li>
  );
}

function Block({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 text-xs font-medium text-gray-500">{label}</div>
      <div className="whitespace-pre-wrap text-gray-200">{children}</div>
    </div>
  );
}
