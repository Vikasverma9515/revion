'use client';
// Browser-side API for the lab. Data paths are answered by the local SQLite
// database (lib/lab/handlers.ts); LLM paths go to the server, which holds the keys.
import { useCallback, useEffect, useState } from 'react';

const SERVER_PATHS = /^\/api\/lab\/(setup|models|answer|judge|login)(\?|$)/;

export async function api<T = unknown>(path: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const { json, ...rest } = init ?? {};
  const request: RequestInit = {
    ...rest,
    headers: json !== undefined ? { 'Content-Type': 'application/json', ...rest.headers } : rest.headers,
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  };
  if (SERVER_PATHS.test(path)) {
    const res = await fetch(path, request);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status}).`);
    return data as T;
  }
  const { dispatch } = await import('./handlers');
  const url = new URL(path, window.location.origin);
  const method = (request.method ?? 'GET').toUpperCase();
  const out = await dispatch(method, url.pathname.replace(/^\/api\/lab\//, ''), new Request(url, { ...request, method }));
  return (out ?? { ok: true }) as T;
}

/** GET a path, with loading and error state and a reload function. */
export function useApi<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!!path);
  const reload = useCallback(async () => {
    if (!path) return;
    setLoading(true);
    try {
      setData(await api<T>(path));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [path]);
  useEffect(() => {
    reload();
  }, [reload]);
  return { data, error, loading, reload, setData };
}

export const fmtMs = (ms: number | null | undefined) => (ms == null ? '—' : ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(1)} s`);
export const fmtPct = (x: number | null | undefined, d = 0) => (x == null || !Number.isFinite(x) ? '—' : `${(x * 100).toFixed(d)}%`);
export const fmtNum = (x: number | null | undefined, d = 2) => (x == null || !Number.isFinite(x) ? '—' : x.toFixed(d));
