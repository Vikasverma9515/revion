'use client';
import { fix, pct, pts, qs } from '#/lib/format';
import { kappa } from '#/lib/sim/p1ab';
import { clearRate, TOY_BASE, TOY_SCENARIOS, toyFormulas, type ToyParams, type ToyProgress, type ToyResult } from '#/lib/sim/toyworld';
import { useStream } from '#/lib/use-stream';
import { Figure, LineChart, S1, S2, S3 } from '#/ui/charts';
import { Field, RunBar } from '#/ui/controls';
import { Formula, Stat } from '#/ui/stat';
import clsx from 'clsx';
import { useEffect, useState } from 'react';

export function KappaCalculator() {
  const [po, setPo] = useState(0.96);
  const [p, setP] = useState(0.06);
  const [lo, setLo] = useState(0.05);
  const [hi, setHi] = useState(0.08);
  const k = kappa(po, p);
  const curve = Array.from({ length: 41 }, (_, i) => {
    const x = 0.01 + (i * 0.14) / 40;
    return { x, y: kappa(po, x).kappa };
  });
  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Field label="Observed pairwise agreement pₒ" value={po} onChange={setPo} min={0.5} max={1} step={0.001} />
        <Field label="Annotator 'violation' rate p" value={p} onChange={setP} min={0.005} max={0.5} step={0.001} />
        <Field label="Sensitivity range: low p" value={lo} onChange={setLo} min={0.005} max={0.5} step={0.005} />
        <Field label="Sensitivity range: high p" value={hi} onChange={setHi} min={0.005} max={0.5} step={0.005} />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Stat label="Chance agreement pₑ" value={fix(k.pe)} sub="p² + (1 − p)²" />
        <Stat label="Cohen's kappa" value={fix(k.kappa, 3)} accent sub="(pₒ − pₑ) / (1 − pₑ)" />
        <Stat label={`Kappa for p in ${pct(lo, 1)}–${pct(hi, 1)}`} value={`${fix(kappa(po, lo).kappa, 2)} – ${fix(kappa(po, hi).kappa, 2)}`} />
      </div>
      <Figure
        title="Kappa against the assumed annotator prevalence"
        notice="The same 96% agreement means very different kappa at low prevalence, because two raters who almost always say 'clean' agree by chance most of the time."
        footnote={<Formula>Assumes both annotators share the marginal rate p; with unequal marginals pₑ = p₁p₂ + (1−p₁)(1−p₂).</Formula>}
      >
        <LineChart
          series={[{ name: 'kappa', style: S1, points: curve }]}
          xDomain={[0.01, 0.15]}
          yDomain={[-0.2, 1]}
          xLabel="Annotator violation rate p"
          yLabel="Cohen's kappa"
          xFormat={(v) => `${(v * 100).toFixed(0)}%`}
          yFormat={(v) => v.toFixed(1)}
          refY={{ y: k.kappa, label: `κ at p = ${pct(p, 1)}` }}
          markers={false}
        />
      </Figure>
    </div>
  );
}

type Row = { name: string; params: ToyParams; result: ToyResult };

export function ToyWorld() {
  const [p, setP] = useState<ToyParams>({ ...TOY_BASE, ...TOY_SCENARIOS[2].over });
  const [seed, setSeed] = useState(102);
  const [trace, setTrace] = useState<ToyResult[]>([]);
  const [history, setHistory] = useState<Row[]>([]);
  const [runName, setRunName] = useState('');
  const [progress, setProgress] = useState<ToyProgress | null>(null);
  const set = (k: keyof ToyParams) => (v: number) => setP({ ...p, [k]: v });
  const f = toyFormulas(p);
  const piClear = clearRate(p);
  const consistent = piClear >= 0 && piClear <= 1;

  const { status, message, start, cancel } = useStream((event, data) => {
    if (event === 'progress') {
      setProgress(data);
      if (data.partial) setTrace((t) => [...t, data.partial]);
    }
  });
  const run = (params = p, name = 'Custom settings', s = seed) => {
    setTrace([]);
    setProgress(null);
    setRunName(name);
    start(`/api/sim/toyworld?${qs({ ...params, seed: s })}`);
  };
  const last = trace[trace.length - 1];
  // Keep a small history of finished runs for side-by-side comparison.
  useEffect(() => {
    if (status === 'done' && last) setHistory((h) => [{ name: runName, params: p, result: last }, ...h].slice(0, 8));
  }, [status]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex flex-col gap-8">
      <section aria-labelledby="scenarios" className="flex flex-col gap-3">
        <h2 id="scenarios" className="text-base font-semibold text-gray-100">
          Preset scenarios (same as problem1_b_assumption.py)
        </h2>
        <div className="flex flex-wrap gap-2">
          {TOY_SCENARIOS.map((sc, i) => (
            <button
              key={sc.name}
              type="button"
              disabled={status === 'running'}
              onClick={() => {
                const params = { ...TOY_BASE, ...sc.over };
                setP(params);
                setSeed(100 + i);
                run(params, sc.name, 100 + i);
              }}
              className="rounded-md border border-gray-700 px-3 py-1.5 text-left text-xs text-gray-300 hover:bg-gray-800 disabled:opacity-50"
            >
              {i + 1}. {sc.name}
            </button>
          ))}
        </div>
      </section>

      <section aria-labelledby="world" className="flex flex-col gap-4">
        <h2 id="world" className="text-base font-semibold text-gray-100">
          The world
        </h2>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Field label="True violation rate π" value={p.pi} onChange={set('pi')} min={0} max={0.5} step={0.001} />
          <Field label="Ambiguous share h" value={p.h} onChange={set('h')} min={0} max={0.5} step={0.01} />
          <Field label="True rate among ambiguous π_h" value={p.piH} onChange={set('piH')} min={0} max={1} step={0.01} />
          <Field label="Shared impression says 'violation' s" value={p.s} onChange={set('s')} min={0} max={1} step={0.01} />
          <Field label="Judge shares the impression f" value={p.f} onChange={set('f')} min={0} max={1} step={0.05} hint="Otherwise the judge reads the true label on ambiguous items." />
          <Field label="Annotator false-positive rate e₀" value={p.e0} onChange={set('e0')} min={0} max={0.3} step={0.005} hint="Per annotator; three annotators, majority vote." />
          <Field label="Annotator false-negative rate e₁" value={p.e1} onChange={set('e1')} min={0} max={0.5} step={0.01} />
          <Field label="Judge sensitivity (vs what it perceives)" value={p.judgeSe} onChange={set('judgeSe')} min={0.5} max={1} step={0.01} />
          <Field label="Judge specificity (vs what it perceives)" value={p.judgeSp} onChange={set('judgeSp')} min={0.5} max={1} step={0.01} />
          <Field label="Calibration items" value={p.nCal} onChange={(v) => set('nCal')(Math.round(v))} min={400} max={1_000_000} step={1000} slider={false} hint="Large by default so sampling noise does not hide the pattern." />
          <Field label="Production items" value={p.nProd} onChange={(v) => set('nProd')(Math.round(v))} min={1000} max={1_000_000} step={1000} slider={false} />
        </div>
        {!consistent && (
          <p role="alert" className="text-sm text-bad">
            π, h and π_h are inconsistent: the violation rate among clear items would be {pct(piClear)}. Lower h·π_h or raise π.
          </p>
        )}
      </section>

      <section aria-labelledby="formulas" className="flex flex-col gap-3">
        <h2 id="formulas" className="text-base font-semibold text-gray-100">
          Bias of the annotators&apos; rate against the truth (expected)
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Stat label="Shared impression bias" value={`${pts(f.sharedBias)} pts`} sub="h (s − π_h)" />
          <Stat label="Annotator noise bias" value={`${pts(f.noiseBias)} pts`} sub="(1 − a₀)(1 − π*) − (1 − a₁) π*" />
          <Stat label="Expected annotators' rate" value={pct(f.annotatorRateExpected)} sub={`truth ${pct(p.pi)} + both biases`} />
        </div>
        <Formula>
          a₀, a₁ = majority-of-3 specificity and sensitivity = {fix(f.a0)}, {fix(f.a1)} (from e₀, e₁). π* = π + h(s − π_h) is the rate the
          annotators perceive; with no ambiguous items π* = π. Either term can be positive or negative.
        </Formula>
      </section>

      <section aria-labelledby="run" className="flex flex-col gap-4">
        <h2 id="run" className="text-base font-semibold text-gray-100">
          Simulate
        </h2>
        <RunBar seed={seed} setSeed={setSeed} onRun={() => consistent && run()} onCancel={cancel} status={status} message={message} />
        {progress && status === 'running' && (
          <div className="h-1.5 w-full overflow-hidden rounded bg-gray-800" role="progressbar" aria-valuenow={Math.round((progress.done / progress.total) * 100)} aria-valuemin={0} aria-valuemax={100} aria-label="Simulation progress">
            <div className="h-full bg-accent" style={{ width: `${(progress.done / progress.total) * 100}%` }} />
          </div>
        )}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Stat label="True rate" value={last ? pct(last.trueRate) : '—'} sub="in the production sample" />
          <Stat label="Annotators' rate" value={last ? pct(last.annotatorRate) : '—'} sub="majority label, if they labelled production" />
          <Stat label="Rogan-Gladen estimate" value={last ? pct(last.roganGladen) : '—'} accent sub={last ? `J = ${fix(last.J, 3)}` : 'calibrated vs majority label'} />
        </div>
        {last && (
          <p className="text-sm text-gray-300">
            Estimate − truth: <span className="font-mono">{pts(last.roganGladen - last.trueRate)} pts</span> · Estimate − annotators:{' '}
            <span className="font-mono">{pts(last.roganGladen - last.annotatorRate)} pts</span>
          </p>
        )}
        <Figure
          title="The three rates as production items stream in"
          notice="The estimate line sits on the annotators' line, not on the truth; any residual gap to the annotators is sampling noise scaled by 1/J and shrinks with more calibration items."
          table={{ head: ['Items', 'True', 'Annotators', 'Estimate'], rows: trace.map((t, i) => [(i + 1) * 20_000, pct(t.trueRate), pct(t.annotatorRate), pct(t.roganGladen)]) }}
        >
          {trace.length === 0 ? (
            <div className="grid h-40 place-items-center text-sm text-gray-500">{status === 'running' ? 'Calibrating the judge…' : 'Pick a scenario or press run.'}</div>
          ) : (
            <LineChart
              series={[
                { name: 'Estimate', style: S1, points: trace.map((t, i) => ({ x: Math.min(p.nProd, (i + 1) * 20_000), y: t.roganGladen })) },
                { name: 'Annotators', style: S2, points: trace.map((t, i) => ({ x: Math.min(p.nProd, (i + 1) * 20_000), y: t.annotatorRate })) },
                { name: 'Truth', style: S3, points: trace.map((t, i) => ({ x: Math.min(p.nProd, (i + 1) * 20_000), y: t.trueRate })) },
              ]}
              xDomain={[0, p.nProd]}
              yDomain={yDomainFor(trace)}
              xLabel="Production items processed"
              yLabel="Violation rate"
              xFormat={(v) => `${Math.round(v / 1000)}k`}
              yFormat={(v) => `${(v * 100).toFixed(1)}%`}
              markers={trace.length < 15}
            />
          )}
        </Figure>
      </section>

      {history.length > 0 && (
        <section aria-labelledby="history" className="flex flex-col gap-3">
          <h2 id="history" className="text-base font-semibold text-gray-100">
            Your runs
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-400">
                  <th className="border-b border-gray-700 py-2 pr-3 font-medium">Scenario</th>
                  <th className="border-b border-gray-700 px-2 py-2 text-right font-medium">True</th>
                  <th className="border-b border-gray-700 px-2 py-2 text-right font-medium">Annotators</th>
                  <th className="border-b border-gray-700 px-2 py-2 text-right font-medium">Estimate</th>
                  <th className="border-b border-gray-700 px-2 py-2 text-right font-medium">Est − true</th>
                  <th className="border-b border-gray-700 px-2 py-2 text-right font-medium">Est − annot.</th>
                </tr>
              </thead>
              <tbody className="font-mono tabular-nums">
                {history.map((h, i) => (
                  <tr key={i} className={clsx(i === 0 && 'text-gray-100', i > 0 && 'text-gray-400')}>
                    <td className="border-b border-gray-800 py-2 pr-3 font-sans">{h.name}</td>
                    <td className="border-b border-gray-800 px-2 py-2 text-right">{pct(h.result.trueRate)}</td>
                    <td className="border-b border-gray-800 px-2 py-2 text-right">{pct(h.result.annotatorRate)}</td>
                    <td className="border-b border-gray-800 px-2 py-2 text-right">{pct(h.result.roganGladen)}</td>
                    <td className="border-b border-gray-800 px-2 py-2 text-right">{pts(h.result.roganGladen - h.result.trueRate)}</td>
                    <td className="border-b border-gray-800 px-2 py-2 text-right">{pts(h.result.roganGladen - h.result.annotatorRate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

function yDomainFor(trace: ToyResult[]): [number, number] {
  const ys = trace.flatMap((t) => [t.trueRate, t.annotatorRate, t.roganGladen]);
  const lo = Math.min(...ys), hi = Math.max(...ys);
  const pad = Math.max(0.005, (hi - lo) * 0.25);
  return [Math.max(0, lo - pad), Math.min(1, hi + pad)];
}
