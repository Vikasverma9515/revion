'use client';
import { fix, pct, qs } from '#/lib/format';
import { design, PREVALENCE_GRID, SE_JUDGE, SP_JUDGE, PI_HAT, type CoverageProgress } from '#/lib/sim/design';
import { jeffreysInterval } from '#/lib/stats/special';
import { useStream } from '#/lib/use-stream';
import { Figure, LineChart, S1, S2, S3 } from '#/ui/charts';
import { Field, RunBar } from '#/ui/controls';
import { Formula, Stat } from '#/ui/stat';
import { useState } from 'react';

export function DesignExplorer() {
  const [total, setTotal] = useState(500);
  const [se, setSe] = useState(SE_JUDGE);
  const [sp, setSp] = useState(SP_JUDGE);
  const [pi, setPi] = useState(Number(PI_HAT.toFixed(4)));
  const [q, setQ] = useState(0.09);
  const d = design(total, se, pi, q);
  const valid = Number.isFinite(d.p1) && d.p1 <= 1 && d.p0 >= 0;
  const [, jHi] = jeffreysInterval(0, d.n0);

  return (
    <div className="flex flex-col gap-8">
      <section aria-labelledby="plan" className="flex flex-col gap-4">
        <h2 id="plan" className="text-base font-semibold text-gray-100">
          Planning inputs
        </h2>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Field label="Total labels" value={total} onChange={(v) => setTotal(Math.round(v))} min={20} max={5000} step={10} />
          <Field label="Planning prevalence π (from part a)" value={pi} onChange={setPi} min={0.001} max={0.3} step={0.001} />
          <Field label="Judge sensitivity Se" value={se} onChange={setSe} min={0.05} max={1} step={0.001} />
          <Field label="Judge specificity Sp (used by the coverage simulation)" value={sp} onChange={setSp} min={0.5} max={1} step={0.001} />
          <Field label="Flag rate q = weight of the flagged stratum" value={q} onChange={setQ} min={0.01} max={0.99} step={0.001} />
        </div>
      </section>

      {!valid ? (
        <p role="alert" className="text-sm text-bad">
          These inputs imply a stratum violation rate outside [0, 1]: Se·π must not exceed q.
        </p>
      ) : (
        <>
          <section aria-label="Allocation" className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            <Stat label="Violation rate, flagged p₁" value={pct(d.p1, 1)} sub="Se·π / q" />
            <Stat label="Violation rate, unflagged p₀" value={pct(d.p0, 2)} sub="(1 − Se)·π / (1 − q)" />
            <Stat label="Neyman allocation" value={`${d.n1} / ${d.n0}`} accent sub="flagged / unflagged" />
            <Stat label="Expected 95% half-width" value={`±${fix(d.halfWidth * 100, 2)} pts`} accent />
            <Stat label="Expected violations, unflagged" value={fix(d.expectedUnflaggedViolations, 2)} sub={`n₀ · p₀ = ${d.n0} × ${fix(d.p0, 5)}`} />
            <Stat label="P(zero unflagged violations)" value={fix(d.pZeroUnflagged, 3)} sub="(1 − p₀)^n₀" />
          </section>
          <div className="flex flex-col gap-1">
            <Formula>n_h ∝ W_h √(p_h(1 − p_h)), W₁ = q, W₀ = 1 − q</Formula>
            <Formula>half-width = 1.96 √(W₁² p₁(1−p₁)/n₁ + W₀² p₀(1−p₀)/n₀)</Formula>
          </div>
          <div className="rounded-lg border border-gray-800 p-4 text-sm leading-relaxed text-gray-400">
            <p>
              <span className="font-medium text-gray-200">Why that last count matters.</span> With about {fix(d.expectedUnflaggedViolations, 1)}{' '}
              expected violations among {d.n0} unflagged labels, there is a {pct(d.pZeroUnflagged, 0)} chance of seeing none. Wald then
              gives that stratum zero variance and claims certainty. Jeffreys still gives an upper bound of {pct(jHi, 2)} for 0 of {d.n0}.
            </p>
          </div>
          <Coverage total={total} se={se} sp={sp} pi={pi} q={q} n1={d.n1} n0={d.n0} />
        </>
      )}
    </div>
  );
}

function Coverage(props: { total: number; se: number; sp: number; pi: number; q: number; n1: number; n0: number }) {
  const [seed, setSeed] = useState(200);
  const [replays, setReplays] = useState(2000);
  const [draws, setDraws] = useState(1000);
  const [rows, setRows] = useState<(CoverageProgress | undefined)[]>([]);
  const { status, message, start, cancel } = useStream((event, data) => {
    if (event === 'progress') {
      setRows((r) => {
        const next = [...r];
        next[data.index] = data;
        return next;
      });
    }
  });
  const run = () => {
    setRows([]);
    start(`/api/sim/coverage?${qs({ total: props.total, se: props.se, sp: props.sp, pi: props.pi, q: props.q, seed, replays, draws })}`);
  };
  const done = rows.filter((r): r is CoverageProgress => !!r);
  const series = (key: 'wald' | 'agresti' | 'jeffreys') => done.map((r) => ({ x: r.pi, y: r[key] }));

  return (
    <section aria-labelledby="coverage" className="flex flex-col gap-4">
      <h2 id="coverage" className="text-base font-semibold text-gray-100">
        Which interval keeps its promise? Coverage simulation
      </h2>
      <p className="max-w-prose text-sm text-gray-400">
        The design stays fixed at {props.n1} / {props.n0}. For each true prevalence the judge keeps Se and Sp, so the stratum rates and
        weights move with it. Each replay draws both strata, builds three nominal 95% intervals, and checks whether they contain the
        truth. Jeffreys uses Beta(x + ½, n − x + ½) per stratum, combined by Monte Carlo with the known weights (2.5% / 97.5%).
      </p>
      <RunBar seed={seed} setSeed={setSeed} onRun={run} onCancel={cancel} status={status} message={message} label="Run coverage">
        <div className="w-40">
          <Field label="Replays per point" value={replays} onChange={(v) => setReplays(Math.round(v))} min={100} max={20_000} step={100} slider={false} />
        </div>
        <div className="w-40">
          <Field label="Jeffreys draws" value={draws} onChange={(v) => setDraws(Math.round(v))} min={100} max={4000} step={100} slider={false} />
        </div>
      </RunBar>
      <Figure
        title="Coverage of nominal 95% intervals across true prevalence"
        notice="Wald falls short where zero unflagged violations are common (low prevalence); Agresti-Coull and Jeffreys stay near 95%."
        footnote={`Monte Carlo error at ${replays.toLocaleString()} replays is about ±${(1.96 * Math.sqrt(0.05 * 0.95 / replays) * 100).toFixed(1)} points.`}
        table={{
          head: ['True π', 'Replays', 'Wald', 'Agresti-Coull', 'Jeffreys', 'P(x₀ = 0)'],
          rows: done.map((r) => [pct(r.pi, 1), r.done, fix(r.wald, 3), fix(r.agresti, 3), fix(r.jeffreys, 3), fix(r.zeroUnflagged, 3)]),
        }}
      >
        {done.length === 0 ? (
          <div className="grid h-40 place-items-center text-sm text-gray-500">{status === 'running' ? 'Simulating the first prevalence…' : 'Press run to stream coverage.'}</div>
        ) : (
          <LineChart
            series={[
              { name: 'Jeffreys', style: S1, points: series('jeffreys') },
              { name: 'Wald', style: S2, points: series('wald') },
              { name: 'Agresti-Coull', style: S3, points: series('agresti') },
            ]}
            xDomain={[0, 0.09]}
            xTicks={[0, ...PREVALENCE_GRID]}
            yDomain={[0.8, 1]}
            xLabel="True violation rate"
            yLabel="Coverage"
            xFormat={(v) => `${(v * 100).toFixed(1)}%`}
            yFormat={(v) => v.toFixed(2)}
            refY={{ y: 0.95, label: 'nominal 95%' }}
          />
        )}
      </Figure>
    </section>
  );
}
