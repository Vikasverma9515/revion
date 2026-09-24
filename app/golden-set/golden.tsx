'use client';
import { fix, pts, qs } from '#/lib/format';
import { F_GRID, GOLDEN_BASE, type GoldenParams, type GoldenResult, type SweepRow } from '#/lib/sim/p2';
import { useStream } from '#/lib/use-stream';
import { Figure, Legend, S1, S2, Scatter } from '#/ui/charts';
import { Button, Field, RunBar } from '#/ui/controls';
import { Formula, Stat } from '#/ui/stat';
import { useEffect, useState } from 'react';

export function GoldenSet() {
  const [p, setP] = useState<GoldenParams>(GOLDEN_BASE);
  const [seed, setSeed] = useState(300);
  const [result, setResult] = useState<GoldenResult | null>(null);
  const [rows, setRows] = useState<SweepRow[]>([]);
  const set = (k: keyof GoldenParams) => (v: number) => setP({ ...p, [k]: v });
  const { status, message, start, cancel } = useStream((event, data) => {
    if (event === 'result') setResult(data);
    if (event === 'row') setRows((r) => [...r, data]);
  });
  const run = () => {
    setResult(null);
    setRows([]);
    start(`/api/sim/golden?${qs({ ...p, seed })}`);
  };
  useEffect(run, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Expected measured recall of the new system, to help tune m.
  const expectedNew = p.old10 * p.k + (1 - p.old10) * p.m;
  const understated = rows.filter((r) => r.understated).length;

  return (
    <div className="flex flex-col gap-8">
      <section aria-labelledby="model" className="flex flex-col gap-4">
        <h2 id="model" className="text-base font-semibold text-gray-100">
          Model settings
        </h2>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Field label="f: relevant docs outside the old top 20" value={p.f} onChange={set('f')} min={0} max={0.8} step={0.01} />
          <Field label="Old top 10 share of judged relevant docs" value={p.old10} onChange={set('old10')} min={0.05} max={1} step={0.01} hint="Sets the old system's measured recall (≈ 0.71)." />
          <Field label="k: new keeps an old top-10 doc" value={p.k} onChange={set('k')} min={0} max={1} step={0.01} />
          <Field label="m: new finds an old rank 11–20 doc" value={p.m} onChange={set('m')} min={0} max={1} step={0.01} />
          <Field label="c: new finds a doc the old system missed" value={p.c} onChange={set('c')} min={0} max={1} step={0.01} hint="These finds are unjudged and score as misses." />
          <Field label="Queries" value={p.queries} onChange={(v) => set('queries')(Math.round(v))} min={50} max={50_000} step={50} slider={false} />
        </div>
        <p className="text-xs text-gray-500">
          Expected measured recall of the new system ≈ {fix(expectedNew, 3)} (per document; the per-query average differs slightly).
        </p>
        <div>
          <Button kind="quiet" onClick={() => setP(GOLDEN_BASE)}>
            Reset
          </Button>
        </div>
      </section>

      <RunBar seed={seed} setSeed={setSeed} onRun={run} onCancel={cancel} status={status} message={message} />

      {result && (
        <>
          <section aria-label="Recall" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Measured recall@10, old → new" value={`${fix(result.oldMeasured, 3)} → ${fix(result.newMeasured, 3)}`} />
            <Stat label="True recall@10, old → new" value={`${fix(result.oldTrue, 3)} → ${fix(result.newTrue, 3)}`} />
            <Stat label="Measured gain" value={`${pts(result.measuredGain, 1)} pts`} />
            <Stat label="True gain" value={`${pts(result.trueGain, 1)} pts`} accent />
          </section>
          <Formula>
            Per relevant document: true gain ≈ (1 − f) × measured gain + f × c. The measured gain understates the true gain whenever c
            exceeds the measured gain. Both absolute recalls are too high because the unjudged documents are missing from the
            denominator.
          </Formula>
          <Figure
            title="Per-query recall@10: measured on the golden set vs true"
            notice="Old-system points never fall below the diagonal (its measured recall can only overstate the truth); new-system points spread to both sides, because its finds outside the old pool count as misses."
            footnote={`First ${result.perQuery?.length ?? 0} of ${result.queriesKept.toLocaleString()} queries; small jitter added so identical fractions do not overlap.`}
          >
            <Legend items={[{ name: 'Old system', style: S2, hollow: true }, { name: 'New system', style: S1, hollow: true }]} />
            <Scatter
              groups={[
                { name: 'Old system', style: S2, points: (result.perQuery ?? []).map((q) => ({ x: q.oldTrue, y: q.oldMeasured })) },
                { name: 'New system', style: S1, points: (result.perQuery ?? []).map((q) => ({ x: q.newTrue, y: q.newMeasured })) },
              ]}
              xLabel="True recall@10"
              yLabel="Measured recall@10"
            />
          </Figure>
        </>
      )}

      <section aria-labelledby="sweep" className="flex flex-col gap-4">
        <h2 id="sweep" className="text-base font-semibold text-gray-100">
          Direction check: 27 settings (problem2_direction_check.py)
        </h2>
        <p className="max-w-prose text-sm text-gray-400">
          f ∈ {'{0.1, 0.2, 0.3}'}, c ∈ {'{0.1, 0.25, 0.4}'}, k ∈ {'{0.85, 0.90, 0.95}'}, with m chosen so the new system&apos;s measured
          recall stays near 0.78. Fixed seeds 400–426, independent of the controls above.
        </p>
        <p className="font-mono text-sm text-gray-200" aria-live="polite">
          {rows.length} / 27 settings · measured gain below true gain in {understated} of {rows.length}
        </p>
        <Figure
          title="Measured vs true gain in recall@10, per setting"
          notice="Nearly every bar pair has the true gain (solid) above the measured gain (hatched): the golden set hides part of the new system's improvement."
          table={{
            head: ['f', 'c', 'k', 'Measured gain', 'True gain', 'Understated?'],
            rows: rows.map((r) => [r.f, r.c, r.k, fix(r.measuredGain, 3), fix(r.trueGain, 3), r.understated ? 'yes' : 'no']),
          }}
        >
          {rows.length === 0 ? (
            <div className="grid h-40 place-items-center text-sm text-gray-500">{status === 'running' ? 'Running the sweep…' : 'Press run to start the sweep.'}</div>
          ) : (
            <SweepBars rows={rows} />
          )}
        </Figure>
      </section>
    </div>
  );
}

/** Paired bars per setting, grouped by f. Hatching distinguishes measured from true. */
function SweepBars({ rows }: { rows: SweepRow[] }) {
  const max = Math.max(0.2, ...rows.flatMap((r) => [r.measuredGain, r.trueGain]));
  return (
    <div className="flex flex-col gap-3">
      <Legend items={[{ name: 'True gain', style: S1 }, { name: 'Measured gain (hatched)', style: { ...S2, dash: undefined } }]} />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {F_GRID.map((f) => (
          <div key={f} className="flex flex-col gap-1.5">
            <div className="font-mono text-xs text-gray-400">f = {f}</div>
            {rows
              .filter((r) => r.f === f)
              .map((r) => (
                <div key={`${r.c}-${r.k}`} className="flex items-center gap-2" title={`c ${r.c}, k ${r.k}: measured ${fix(r.measuredGain, 3)}, true ${fix(r.trueGain, 3)}`}>
                  <span className="w-20 shrink-0 font-mono text-[10px] text-gray-500">
                    c {r.c} k {r.k}
                  </span>
                  <div className="flex flex-1 flex-col gap-[2px]">
                    <div className="h-2 rounded-r-sm" style={{ width: `${(Math.max(0, r.trueGain) / max) * 100}%`, background: 'var(--series-1)' }} />
                    <div
                      className="h-2 rounded-r-sm"
                      style={{
                        width: `${(Math.max(0, r.measuredGain) / max) * 100}%`,
                        background: 'repeating-linear-gradient(45deg, var(--series-2) 0 3px, transparent 3px 5px)',
                      }}
                    />
                  </div>
                  <span className="w-4 text-xs text-gray-400" aria-label={r.understated ? 'understated' : 'not understated'}>
                    {r.understated ? '↓' : '='}
                  </span>
                </div>
              ))}
          </div>
        ))}
      </div>
      <p className="text-xs text-gray-500">Bar length is proportional to the gain; ↓ marks settings where the measured gain is below the true gain.</p>
    </div>
  );
}
