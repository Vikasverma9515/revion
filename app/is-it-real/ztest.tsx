'use client';
import { fix, pct } from '#/lib/format';
import { twoProportion } from '#/lib/sim/p2';
import { twoSidedP, Z95 } from '#/lib/stats/special';
import { Figure, LineChart, S1 } from '#/ui/charts';
import { Button, Field } from '#/ui/controls';
import { Formula, Stat } from '#/ui/stat';
import { useState } from 'react';

const START = { x1: 240, n1: 3000, x2: 330, n2: 3000 };

export function ZTest() {
  const [c, setC] = useState(START);
  const [deff, setDeff] = useState(1);
  const set = (k: keyof typeof c) => (v: number) => setC({ ...c, [k]: Math.round(v) });
  const valid = c.n1 > 0 && c.n2 > 0 && c.x1 <= c.n1 && c.x2 <= c.n2 && c.x1 + c.x2 > 0 && c.x1 + c.x2 < c.n1 + c.n2;
  const t = valid ? twoProportion(c.x1, c.n1, c.x2, c.n2) : null;

  return (
    <div className="flex flex-col gap-8">
      <section aria-labelledby="counts" className="flex flex-col gap-4">
        <h2 id="counts" className="text-base font-semibold text-gray-100">
          Counts
        </h2>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Field label="Before: thumbs-down" value={c.x1} onChange={set('x1')} min={0} max={c.n1} step={1} />
          <Field label="Before: rated answers" value={c.n1} onChange={set('n1')} min={1} max={100_000} step={10} slider={false} />
          <Field label="After: thumbs-down" value={c.x2} onChange={set('x2')} min={0} max={c.n2} step={1} />
          <Field label="After: rated answers" value={c.n2} onChange={set('n2')} min={1} max={100_000} step={10} slider={false} />
        </div>
        <div>
          <Button kind="quiet" onClick={() => setC(START)}>
            Reset to 240 / 3,000 vs 330 / 3,000
          </Button>
        </div>
      </section>

      {!t ? (
        <p role="alert" className="text-sm text-bad">
          Counts must satisfy 0 ≤ thumbs-down ≤ rated, with at least one thumbs-down and one non-thumbs-down overall.
        </p>
      ) : (
        <>
          <section aria-label="Test result" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Rates" value={`${pct(t.p1, 1)} → ${pct(t.p2, 1)}`} />
            <Stat label="z (pooled SE)" value={fix(t.z, 2)} accent sub={`SE ${fix(t.sePooled, 4)}`} />
            <Stat label="Two-sided p" value={t.pValue < 1e-4 ? t.pValue.toExponential(1) : fix(t.pValue, 4)} />
            <Stat label="95% CI for the change" value={`${fix(t.lo * 100, 2)} to ${fix(t.hi * 100, 2)}`} sub="points (unpooled SE)" />
          </section>
          <div className="flex flex-col gap-1">
            <Formula>z = (p₂ − p₁) / √(p̄(1 − p̄)(1/n₁ + 1/n₂)), p̄ = (x₁ + x₂)/(n₁ + n₂)</Formula>
            <Formula>CI = (p₂ − p₁) ± 1.96 √(p₁(1−p₁)/n₁ + p₂(1−p₂)/n₂)</Formula>
          </div>
          <DesignEffect z={t.z} deff={deff} setDeff={setDeff} breakEven={t.deffBreakEven} />
          <p className="max-w-prose text-sm text-gray-400">
            Significant is not the same as caused by the embedding change: this is a before/after comparison, so a shift in rating habits,
            query mix or another deployment in the same window would produce the same numbers.
          </p>
        </>
      )}
    </div>
  );
}

function DesignEffect({ z, deff, setDeff, breakEven }: { z: number; deff: number; setDeff: (v: number) => void; breakEven: number }) {
  const zEff = z / Math.sqrt(deff);
  const significant = Math.abs(zEff) >= Z95;
  const maxD = Math.max(8, Math.ceil(breakEven * 1.5));
  const curve = Array.from({ length: 61 }, (_, i) => {
    const d = 1 + (i * (maxD - 1)) / 60;
    return { x: d, y: Math.abs(z) / Math.sqrt(d) };
  });
  return (
    <section aria-labelledby="deff" className="flex flex-col gap-4">
      <h2 id="deff" className="text-base font-semibold text-gray-100">
        Clustering: the design effect
      </h2>
      <Field label="Design effect (variance inflation)" value={deff} onChange={setDeff} min={1} max={maxD} step={0.05} hint="1 = independent ratings. Heavy raters and repeated sessions push it up." />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Stat label="Effective z" value={fix(zEff, 2)} accent sub={`z / √${fix(deff, 2)}`} />
        <Stat label="Effective p" value={twoSidedP(zEff) < 1e-4 ? twoSidedP(zEff).toExponential(1) : fix(twoSidedP(zEff), 4)} />
        <Stat
          label="At 5% level"
          value={significant ? '✓ significant' : '✗ not significant'}
          sub={`significance lost at design effect ${fix(breakEven, 2)}`}
        />
      </div>
      <Figure
        title="Effective z as the design effect grows"
        notice={`The change stays significant until ratings are clustered enough to inflate the variance about ${fix(breakEven, 1)}-fold.`}
        footnote={<Formula>break-even design effect = (z / 1.96)²</Formula>}
      >
        <LineChart
          series={[{ name: '|z| / √deff', style: S1, points: curve }]}
          xDomain={[1, maxD]}
          yDomain={[0, Math.max(4.5, Math.ceil(Math.abs(z)))]}
          xLabel="Design effect"
          yLabel="Effective |z|"
          xFormat={(v) => v.toFixed(1)}
          yFormat={(v) => v.toFixed(1)}
          refY={{ y: Z95, label: '1.96' }}
          markers={false}
        />
      </Figure>
    </section>
  );
}
