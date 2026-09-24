'use client';
import { fix, pct, qs } from '#/lib/format';
import { CALIBRATION, roganGladen, type ReplayProgress } from '#/lib/sim/p1ab';
import { useStream } from '#/lib/use-stream';
import { Figure, LineChart, S1, S2, S3, ShareBar } from '#/ui/charts';
import { Button, Field, RunBar } from '#/ui/controls';
import { Formula, Stat } from '#/ui/stat';
import { useState } from 'react';

export function Estimator() {
  const [c, setC] = useState(CALIBRATION);
  const set = (k: keyof typeof c) => (v: number) => setC({ ...c, [k]: v });
  const valid = c.tp + c.fn > 0 && c.tn + c.fp > 0;
  const r = valid ? roganGladen(c) : null;
  const ok = r !== null && r.J > 0;

  return (
    <div className="flex flex-col gap-8">
      <section aria-labelledby="inputs" className="flex flex-col gap-4">
        <h2 id="inputs" className="text-base font-semibold text-gray-100">
          Calibration and production inputs
        </h2>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Field label="TP: violations the judge flagged" value={c.tp} onChange={set('tp')} min={0} max={400} step={1} />
          <Field label="FN: violations the judge missed" value={c.fn} onChange={set('fn')} min={0} max={400} step={1} />
          <Field label="TN: clean items the judge passed" value={c.tn} onChange={set('tn')} min={0} max={2000} step={1} />
          <Field label="FP: clean items the judge flagged" value={c.fp} onChange={set('fp')} min={0} max={2000} step={1} />
          <Field label="Production flag rate q" value={c.q} onChange={set('q')} min={0} max={1} step={0.001} />
          <Field label="Production volume N" value={c.n} onChange={set('n')} min={1000} max={10_000_000} step={1000} />
        </div>
        <div>
          <Button kind="quiet" onClick={() => setC(CALIBRATION)}>
            Reset to the problem&apos;s numbers
          </Button>
        </div>
      </section>

      {!ok ? (
        <p role="alert" className="rounded-lg border border-bad/40 bg-bad/10 p-4 text-sm text-bad">
          {valid
            ? 'Sensitivity + specificity must exceed 1 (J > 0); otherwise the judge is no better than chance and the correction is undefined.'
            : 'Enter at least one violation (TP + FN > 0) and one clean item (TN + FP > 0).'}
        </p>
      ) : (
        <>
          <section aria-label="Estimate" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Sensitivity Se" value={fix(r.sensitivity)} sub={`TP/(TP+FN) = ${c.tp}/${c.tp + c.fn}`} />
            <Stat label="Specificity Sp" value={fix(r.specificity)} sub={`TN/(TN+FP) = ${c.tn}/${c.tn + c.fp}`} />
            <Stat label="True rate π̂" value={pct(r.pi)} accent sub={`SE ${fix(r.se)}`} />
            <Stat label="95% CI" value={`${pct(r.lo, 1)} – ${pct(r.hi, 1)}`} sub="π̂ ± 1.96 · SE" />
          </section>
          {(r.pi < 0 || r.pi > 1) && (
            <p className="text-sm text-warn">
              The estimate falls outside [0, 1]: the flag rate is lower than the judge&apos;s false-positive rate (or higher than its
              sensitivity). Rogan-Gladen does not clip; report such a result as 0 or 1 with care.
            </p>
          )}
          <div className="flex flex-col gap-1">
            <Formula>J = Se + Sp − 1 = {fix(r.J)} · π̂ = (q + Sp − 1) / J</Formula>
            <Formula>Var(π̂) = [Var(q) + (1−π̂)² Var(Sp) + π̂² Var(Se)] / J²</Formula>
            <Formula>
              SE contributions: flag rate {fix(r.contributionSe.flagRate)}, specificity {fix(r.contributionSe.specificity)}, sensitivity{' '}
              {fix(r.contributionSe.sensitivity)}
            </Formula>
          </div>

          <Figure
            title="Where the interval's width comes from"
            notice={`${pct(r.share.specificity, 1)} of the variance comes from specificity; the 2M production flags contribute almost nothing, so more calibration labels on clean items is what narrows the interval.`}
            table={{
              head: ['Source', 'Input SE', 'Variance share'],
              rows: [
                ['Flag rate q', fix(r.inputSe.flagRate, 5), pct(r.share.flagRate, 2)],
                ['Specificity', fix(r.inputSe.specificity, 5), pct(r.share.specificity, 2)],
                ['Sensitivity', fix(r.inputSe.sensitivity, 5), pct(r.share.sensitivity, 2)],
              ],
            }}
          >
            <ShareBar
              parts={[
                { name: 'Specificity', value: r.share.specificity, style: S1 },
                { name: 'Sensitivity', value: r.share.sensitivity, style: S2 },
                { name: 'Flag rate', value: r.share.flagRate, style: S3 },
              ]}
            />
          </Figure>

          <Replay c={c} piHat={r.pi} />
        </>
      )}
    </div>
  );
}

function Replay({ c, piHat }: { c: typeof CALIBRATION; piHat: number }) {
  const [seed, setSeed] = useState(1);
  const [replays, setReplays] = useState(20_000);
  const [points, setPoints] = useState<ReplayProgress[]>([]);
  const { status, message, start, cancel } = useStream((event, data) => {
    if (event === 'progress') setPoints((p) => [...p, data]);
  });
  const run = () => {
    setPoints([]);
    start(`/api/sim/replay?${qs({ ...c, seed, replays })}`);
  };
  const last = points[points.length - 1];

  return (
    <section aria-labelledby="replay" className="flex flex-col gap-4">
      <h2 id="replay" className="text-base font-semibold text-gray-100">
        Does the interval cover the truth? Replay the study
      </h2>
      <p className="max-w-prose text-sm text-gray-400">
        Treat π̂ = {pct(piHat)} and the calibrated Se, Sp as the truth. Each replay redraws the calibration counts (class sizes{' '}
        {c.tp + c.fn} / {c.tn + c.fp} held fixed) and the production flags, refits, and asks whether the 95% interval contains the
        true rate.
      </p>
      <RunBar seed={seed} setSeed={setSeed} onRun={run} onCancel={cancel} status={status} message={message} label={`Replay ${replays.toLocaleString()} times`}>
        <div className="w-44">
          <Field label="Replays" value={replays} onChange={(v) => setReplays(Math.round(v))} min={100} max={20_000} step={100} slider={false} />
        </div>
      </RunBar>
      {last && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          <Stat label="Coverage of the 95% CI" value={pct(last.coverage, 1)} accent sub={`${last.done.toLocaleString()} of ${last.replays.toLocaleString()} replays`} />
          <Stat label="Lower bound below zero" value={pct(last.lowerBelowZero, 1)} sub="share of replays" />
        </div>
      )}
      <Figure
        title="Running coverage and share of impossible lower bounds"
        notice="Coverage settles near 95%, yet in a large share of replays the lower bound is negative: the correction divides by J and specificity is uncertain, so the symmetric delta interval often spills below zero."
        table={{ head: ['Replays', 'Coverage', 'Lower < 0'], rows: points.filter((_, i) => i % 8 === 7 || i === points.length - 1).map((p) => [p.done, pct(p.coverage, 1), pct(p.lowerBelowZero, 1)]) }}
      >
        {points.length === 0 ? (
          <div className="grid h-40 place-items-center text-sm text-gray-500">{status === 'running' ? 'Waiting for the first results…' : 'Press replay to stream results.'}</div>
        ) : (
          <LineChart
            series={[
              { name: 'Coverage', style: S1, points: points.map((p) => ({ x: p.done, y: p.coverage })) },
              { name: 'Lower < 0', style: S2, points: points.map((p) => ({ x: p.done, y: p.lowerBelowZero })) },
            ]}
            xDomain={[0, replays]}
            yDomain={[0, 1]}
            xLabel="Replays completed"
            yLabel="Share of replays"
            xFormat={(v) => (v >= 1000 ? `${(v / 1000).toFixed(v % 1000 ? 1 : 0)}k` : String(Math.round(v)))}
            yFormat={(v) => `${Math.round(v * 100)}%`}
            refY={{ y: 0.95, label: '95% target' }}
            markers={false}
          />
        )}
      </Figure>
    </section>
  );
}
