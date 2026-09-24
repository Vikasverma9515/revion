export const pct = (x: number, digits = 2) => (Number.isFinite(x) ? `${(x * 100).toFixed(digits)}%` : '—');
export const pts = (x: number, digits = 2) =>
  Number.isFinite(x) ? `${x >= 0 ? '+' : '−'}${Math.abs(x * 100).toFixed(digits)}` : '—';
export const fix = (x: number, digits = 4) => (Number.isFinite(x) ? x.toFixed(digits) : '—');
export const qs = (params: Record<string, number | string>) =>
  new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)])).toString();
