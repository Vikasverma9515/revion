'use client';
// Plain-SVG charts. Series identity is never colour alone: each series also
// has its own marker shape and dash pattern, a legend and a direct label.
import { useId, useState } from 'react';

export type SeriesStyle = { color: string; dash?: string; marker: 'circle' | 'square' | 'triangle' };
export type Series = { name: string; style: SeriesStyle; points: { x: number; y: number }[] };

// Validated categorical slots 1-3 (see styles/globals.css).
export const S1: SeriesStyle = { color: 'var(--series-1)', marker: 'circle' };
export const S2: SeriesStyle = { color: 'var(--series-2)', marker: 'square', dash: '6 4' };
export const S3: SeriesStyle = { color: 'var(--series-3)', marker: 'triangle', dash: '2 3' };

const W = 640;
const H = 300;
const M = { top: 16, right: 88, bottom: 44, left: 56 };

function Marker({ x, y, style, hollow }: { x: number; y: number; style: SeriesStyle; hollow?: boolean }) {
  const common = { fill: hollow ? 'var(--color-gray-950)' : style.color, stroke: style.color, strokeWidth: 2 };
  if (style.marker === 'square') return <rect x={x - 4} y={y - 4} width={8} height={8} rx={1} {...common} />;
  if (style.marker === 'triangle') return <path d={`M${x},${y - 5} L${x + 5},${y + 4} L${x - 5},${y + 4} Z`} {...common} />;
  return <circle cx={x} cy={y} r={4.5} {...common} />;
}

export function Legend({ items }: { items: { name: string; style: SeriesStyle; hollow?: boolean }[] }) {
  return (
    <ul className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-gray-300">
      {items.map((it) => (
        <li key={it.name} className="flex items-center gap-2">
          <svg width="28" height="12" aria-hidden>
            <line x1="0" x2="28" y1="6" y2="6" stroke={it.style.color} strokeWidth="2" strokeDasharray={it.style.dash} />
            <Marker x={14} y={6} style={it.style} hollow={it.hollow} />
          </svg>
          {it.name}
        </li>
      ))}
    </ul>
  );
}

function ticks(lo: number, hi: number, count = 5) {
  const step = (hi - lo) / (count - 1);
  return Array.from({ length: count }, (_, i) => lo + i * step);
}

function directLabels(series: Series[], sx: (x: number) => number, sy: (y: number) => number) {
  const labels = series
    .filter((s) => s.points.length > 0)
    .map((s) => {
      const last = s.points[s.points.length - 1];
      return { name: s.name, x: sx(last.x), y: sy(last.y) };
    })
    .sort((a, b) => a.y - b.y);
  for (let i = 1; i < labels.length; i++) {
    if (labels[i].y - labels[i - 1].y < 13) labels[i].y = labels[i - 1].y + 13;
  }
  return labels;
}

export function LineChart({
  series,
  xDomain,
  yDomain,
  xLabel,
  yLabel,
  xFormat = (v) => String(v),
  yFormat = (v) => String(v),
  refY,
  band,
  xTicks,
  markers = true,
}: {
  series: Series[];
  markers?: boolean;
  xDomain: [number, number];
  yDomain: [number, number];
  xLabel: string;
  yLabel: string;
  xFormat?: (v: number) => string;
  yFormat?: (v: number) => string;
  refY?: { y: number; label: string };
  band?: { lo: number; hi: number; label: string };
  xTicks?: number[];
}) {
  const [hover, setHover] = useState<number | null>(null);
  const clipId = useId();
  const sx = (x: number) => M.left + ((x - xDomain[0]) / (xDomain[1] - xDomain[0])) * (W - M.left - M.right);
  const sy = (y: number) => M.top + (1 - (y - yDomain[0]) / (yDomain[1] - yDomain[0])) * (H - M.top - M.bottom);
  const xs = xTicks ?? ticks(xDomain[0], xDomain[1]);
  // Hover snaps to the nearest x that any series has.
  const allX = [...new Set(series.flatMap((s) => s.points.map((p) => p.x)))].sort((a, b) => a - b);

  const onMove = (e: React.PointerEvent<SVGRectElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const x = xDomain[0] + ((e.clientX - box.left) / box.width) * (xDomain[1] - xDomain[0]);
    let best: number | null = null;
    for (const v of allX) if (best === null || Math.abs(v - x) < Math.abs(best - x)) best = v;
    setHover(best);
  };

  return (
    <div className="relative flex flex-col gap-2">
      {series.length > 1 && <Legend items={series.map((s) => ({ name: s.name, style: s.style }))} />}
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={`${yLabel} by ${xLabel}`}>
        <clipPath id={clipId}>
          <rect x={M.left} y={M.top} width={W - M.left - M.right} height={H - M.top - M.bottom} />
        </clipPath>
        {band && (
          <g>
            <rect x={M.left} width={W - M.left - M.right} y={sy(band.hi)} height={Math.max(0, sy(band.lo) - sy(band.hi))} fill="var(--color-gray-800)" opacity={0.6} />
            <text x={W - M.right + 6} y={(sy(band.hi) + sy(band.lo)) / 2 + 4} className="fill-gray-500 text-[11px]">
              {band.label}
            </text>
          </g>
        )}
        {ticks(yDomain[0], yDomain[1]).map((t) => (
          <g key={t}>
            <line x1={M.left} x2={W - M.right} y1={sy(t)} y2={sy(t)} stroke="var(--color-gray-800)" strokeWidth={1} />
            <text x={M.left - 8} y={sy(t) + 4} textAnchor="end" className="fill-gray-500 font-mono text-[11px]">
              {yFormat(t)}
            </text>
          </g>
        ))}
        {xs.map((t) => (
          <text key={t} x={sx(t)} y={H - M.bottom + 18} textAnchor="middle" className="fill-gray-500 font-mono text-[11px]">
            {xFormat(t)}
          </text>
        ))}
        <line x1={M.left} x2={W - M.right} y1={H - M.bottom} y2={H - M.bottom} stroke="var(--color-gray-600)" />
        <text x={(M.left + W - M.right) / 2} y={H - 6} textAnchor="middle" className="fill-gray-400 text-[12px]">
          {xLabel}
        </text>
        <text transform={`translate(14 ${(M.top + H - M.bottom) / 2}) rotate(-90)`} textAnchor="middle" className="fill-gray-400 text-[12px]">
          {yLabel}
        </text>
        {refY && (
          <g>
            <line x1={M.left} x2={W - M.right} y1={sy(refY.y)} y2={sy(refY.y)} stroke="var(--color-gray-400)" strokeDasharray="1 3" />
            <text x={M.left + 6} y={sy(refY.y) - 5} className="fill-gray-400 text-[11px]">
              {refY.label}
            </text>
          </g>
        )}
        <g clipPath={`url(#${clipId})`}>
          {series.map((s) => (
            <polyline
              key={s.name}
              fill="none"
              stroke={s.style.color}
              strokeWidth={2}
              strokeDasharray={s.style.dash}
              strokeLinejoin="round"
              points={s.points.map((p) => `${sx(p.x)},${sy(p.y)}`).join(' ')}
            />
          ))}
        </g>
        {series.map((s) =>
          (markers ? s.points : s.points.slice(-1)).map((p) => <Marker key={`${s.name}-${p.x}`} x={sx(p.x)} y={sy(p.y)} style={s.style} />),
        )}
        {/* Direct labels at the last point of each series, nudged apart so they never overlap. */}
        {directLabels(series, sx, sy).map((l) => (
          <text key={l.name} x={l.x + 10} y={l.y + 4} className="fill-gray-300 text-[11px]">
            {l.name}
          </text>
        ))}
        {hover !== null && (
          <line x1={sx(hover)} x2={sx(hover)} y1={M.top} y2={H - M.bottom} stroke="var(--color-gray-500)" strokeWidth={1} />
        )}
        <rect
          x={M.left}
          y={M.top}
          width={W - M.left - M.right}
          height={H - M.top - M.bottom}
          fill="transparent"
          onPointerMove={onMove}
          onPointerLeave={() => setHover(null)}
        />
      </svg>
      {hover !== null && (
        <div
          className="pointer-events-none absolute top-10 rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-xs shadow-lg"
          style={{ left: `${(sx(hover) / W) * 100 > 60 ? 4 : 50}%` }}
        >
          <div className="mb-1 font-mono text-gray-400">
            {xLabel}: {xFormat(hover)}
          </div>
          {series.map((s) => {
            const p = s.points.find((q) => q.x === hover);
            return p ? (
              <div key={s.name} className="flex items-center justify-between gap-4 text-gray-200">
                <span>{s.name}</span>
                <span className="font-mono tabular-nums">{yFormat(p.y)}</span>
              </div>
            ) : null;
          })}
        </div>
      )}
    </div>
  );
}

/** Scatter of measured (y) vs true (x) with the y = x diagonal. */
export function Scatter({
  groups,
  xLabel,
  yLabel,
}: {
  groups: { name: string; style: SeriesStyle; points: { x: number; y: number }[] }[];
  xLabel: string;
  yLabel: string;
}) {
  const size = 320;
  const m = { top: 12, right: 12, bottom: 44, left: 52 };
  const s = (v: number) => m.left + v * (size - m.left - m.right);
  const sy = (v: number) => m.top + (1 - v) * (size - m.top - m.bottom);
  const t = [0, 0.25, 0.5, 0.75, 1];
  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="mx-auto h-auto w-full max-w-md" role="img" aria-label={`${yLabel} against ${xLabel}`}>
      {t.map((v) => (
        <g key={v}>
          <line x1={m.left} x2={size - m.right} y1={sy(v)} y2={sy(v)} stroke="var(--color-gray-800)" />
          <text x={m.left - 8} y={sy(v) + 4} textAnchor="end" className="fill-gray-500 font-mono text-[10px]">
            {v}
          </text>
          <text x={s(v)} y={size - m.bottom + 16} textAnchor="middle" className="fill-gray-500 font-mono text-[10px]">
            {v}
          </text>
        </g>
      ))}
      <line x1={s(0)} y1={sy(0)} x2={s(1)} y2={sy(1)} stroke="var(--color-gray-500)" strokeDasharray="3 3" />
      <text x={s(0.62)} y={sy(0.7)} className="fill-gray-500 text-[10px]" transform={`rotate(-45 ${s(0.62)} ${sy(0.7)})`}>
        measured = true
      </text>
      {groups.map((g) =>
        g.points.map((p, i) => {
          // Small deterministic jitter so identical fractions do not stack exactly.
          const j = (((i * 9301 + 49297) % 233280) / 233280 - 0.5) * 0.02;
          const x = s(p.x + j), y = sy(p.y + j);
          return g.style.marker === 'square' ? (
            <rect key={`${g.name}${i}`} x={x - 2.5} y={y - 2.5} width={5} height={5} fill="none" stroke={g.style.color} strokeWidth={1.25} opacity={0.75} />
          ) : (
            <circle key={`${g.name}${i}`} cx={x} cy={y} r={2.8} fill="none" stroke={g.style.color} strokeWidth={1.25} opacity={0.75} />
          );
        }),
      )}
      <text x={(m.left + size - m.right) / 2} y={size - 8} textAnchor="middle" className="fill-gray-400 text-[11px]">
        {xLabel}
      </text>
      <text transform={`translate(12 ${(m.top + size - m.bottom) / 2}) rotate(-90)`} textAnchor="middle" className="fill-gray-400 text-[11px]">
        {yLabel}
      </text>
    </svg>
  );
}

/** One horizontal 100% bar with labelled segments (labels carry the meaning). */
export function ShareBar({ parts }: { parts: { name: string; value: number; style: SeriesStyle }[] }) {
  const total = parts.reduce((a, p) => a + p.value, 0) || 1;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex h-7 w-full gap-[2px] overflow-hidden rounded" role="img" aria-label={parts.map((p) => `${p.name} ${((p.value / total) * 100).toFixed(1)}%`).join(', ')}>
        {parts.map((p) => (
          <div
            key={p.name}
            style={{
              width: `${(p.value / total) * 100}%`,
              background: p.style.color,
              backgroundImage: p.style.dash ? 'repeating-linear-gradient(45deg, transparent 0 4px, rgba(0,0,0,.25) 4px 6px)' : undefined,
            }}
          />
        ))}
      </div>
      <ul className="grid grid-cols-1 gap-1 text-sm sm:grid-cols-3">
        {parts.map((p) => (
          <li key={p.name} className="flex items-center gap-2 text-gray-300">
            <span
              className="inline-block size-3 rounded-sm"
              style={{ background: p.style.color, backgroundImage: p.style.dash ? 'repeating-linear-gradient(45deg, transparent 0 2px, rgba(0,0,0,.3) 2px 3px)' : undefined }}
              aria-hidden
            />
            {p.name}
            <span className="ml-auto font-mono tabular-nums text-gray-100 sm:ml-1">{((p.value / total) * 100).toFixed(p.value / total < 0.01 ? 2 : 1)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Figure frame: title, chart, one-sentence "what to notice", optional data table. */
export function Figure({
  title,
  notice,
  children,
  table,
  footnote,
}: {
  title: string;
  notice: React.ReactNode;
  children: React.ReactNode;
  table?: { head: string[]; rows: (string | number)[][] };
  footnote?: React.ReactNode;
}) {
  return (
    <figure className="flex flex-col gap-3 rounded-lg bg-gray-900 p-4 lg:p-5">
      <figcaption className="text-sm font-semibold text-gray-100">{title}</figcaption>
      {children}
      <p className="text-sm text-gray-400">
        <span className="font-medium text-gray-200">What to notice: </span>
        {notice}
      </p>
      {footnote && <div className="text-xs text-gray-500">{footnote}</div>}
      {table && table.rows.length > 0 && (
        <details className="text-xs text-gray-400">
          <summary className="cursor-pointer select-none hover:text-gray-200">Show data table</summary>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full border-collapse font-mono tabular-nums">
              <thead>
                <tr>
                  {table.head.map((h) => (
                    <th key={h} className="border-b border-gray-700 px-2 py-1 text-left font-medium text-gray-300">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {table.rows.map((r, i) => (
                  <tr key={i}>
                    {r.map((c, j) => (
                      <td key={j} className="border-b border-gray-800 px-2 py-1">
                        {c}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </figure>
  );
}
