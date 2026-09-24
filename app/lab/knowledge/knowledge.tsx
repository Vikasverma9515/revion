'use client';
import { api, useApi } from '#/lib/lab/client';
import type { Doc, Hit } from '#/lib/lab/knowledge';
import { Button } from '#/ui/controls';
import { ErrorNote, Loading, TextArea, TextField } from '#/ui/form';
import { useRef, useState } from 'react';

type Mode = 'file' | 'url' | 'text';

export function Knowledge() {
  const docs = useApi<Doc[]>('/api/lab/knowledge');
  const [mode, setMode] = useState<Mode>('file');
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [text, setText] = useState('');
  const file = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const add = async () => {
    setBusy(true);
    setMsg(null);
    setError(null);
    try {
      let r: { chunks: number };
      if (mode === 'file') {
        const f = file.current?.files?.[0];
        if (!f) throw new Error('Choose a file.');
        const form = new FormData();
        form.append('file', f);
        if (title) form.append('title', title);
        r = await api('/api/lab/knowledge', { method: 'POST', body: form });
        if (file.current) file.current.value = '';
      } else if (mode === 'url') {
        r = await api('/api/lab/knowledge', { method: 'POST', json: { url, title } });
        setUrl('');
      } else {
        r = await api('/api/lab/knowledge', { method: 'POST', json: { title, text } });
        setText('');
      }
      setTitle('');
      setMsg(`Added: ${r.chunks} chunks embedded.`);
      docs.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (d: Doc) => {
    if (!confirm(`Delete "${d.title}" and its ${d.chunks} chunks?`)) return;
    try {
      await api(`/api/lab/knowledge?id=${d.id}`, { method: 'DELETE' });
      docs.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const starter = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ added: number }>('/api/lab/knowledge/starter', { method: 'POST' });
      setMsg(`Added ${r.added} starter documents.`);
      docs.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-8">
      <section aria-labelledby="add" className="flex flex-col gap-4">
        <h2 id="add" className="text-base font-semibold text-gray-100">
          Add a document
        </h2>
        <div role="tablist" aria-label="Source type" className="flex gap-2">
          {(['file', 'url', 'text'] as Mode[]).map((m) => (
            <button
              key={m}
              role="tab"
              aria-selected={mode === m}
              type="button"
              onClick={() => setMode(m)}
              className={`rounded-md px-3 py-1.5 text-sm ${mode === m ? 'bg-gray-800 text-white' : 'text-gray-400 hover:bg-gray-900'}`}
            >
              {m === 'file' ? 'Upload file' : m === 'url' ? 'Web page' : 'Paste text'}
            </button>
          ))}
        </div>
        <TextField label="Title (optional for files and URLs)" value={title} onChange={(e) => setTitle(e.target.value)} />
        {mode === 'file' && (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="kfile" className="text-sm font-medium text-gray-300">
              File (.pdf .md .txt .csv .json .py .ts .html, up to 4 MB)
            </label>
            <input id="kfile" ref={file} type="file" accept=".pdf,.md,.markdown,.txt,.csv,.json,.py,.ts,.html" className="text-sm text-gray-300 file:mr-3 file:rounded-md file:border-0 file:bg-gray-800 file:px-3 file:py-1.5 file:text-gray-100" />
          </div>
        )}
        {mode === 'url' && <TextField label="URL" type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" />}
        {mode === 'text' && <TextArea label="Text" value={text} onChange={(e) => setText(e.target.value)} rows={8} />}
        <ErrorNote>{error}</ErrorNote>
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={add} disabled={busy}>
            {busy ? 'Embedding…' : 'Add to knowledge base'}
          </Button>
          <Button kind="quiet" onClick={starter} disabled={busy}>
            Load starter documents
          </Button>
          {msg && <span role="status" className="text-sm text-good">{msg}</span>}
        </div>
      </section>

      <SearchTester />

      <section aria-labelledby="docs" className="flex flex-col gap-3">
        <h2 id="docs" className="text-base font-semibold text-gray-100">
          Documents
        </h2>
        {docs.loading && !docs.data ? (
          <Loading />
        ) : docs.error ? (
          <ErrorNote>{docs.error}</ErrorNote>
        ) : docs.data!.length === 0 ? (
          <p className="text-sm text-gray-500">No documents yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-400">
                  <th className="border-b border-gray-700 py-2 pr-3 font-medium">Title</th>
                  <th className="border-b border-gray-700 px-2 py-2 font-medium">Source</th>
                  <th className="border-b border-gray-700 px-2 py-2 text-right font-medium">Chunks</th>
                  <th className="border-b border-gray-700 px-2 py-2 text-right font-medium">Characters</th>
                  <th className="border-b border-gray-700 py-2 pl-2" />
                </tr>
              </thead>
              <tbody>
                {docs.data!.map((d) => (
                  <tr key={d.id} className="text-gray-300">
                    <td className="border-b border-gray-800 py-2 pr-3 text-gray-100">{d.title}</td>
                    <td className="max-w-48 truncate border-b border-gray-800 px-2 py-2 text-xs text-gray-500">{d.source}</td>
                    <td className="border-b border-gray-800 px-2 py-2 text-right font-mono">{d.chunks}</td>
                    <td className="border-b border-gray-800 px-2 py-2 text-right font-mono">{d.chars.toLocaleString()}</td>
                    <td className="border-b border-gray-800 py-2 pl-2 text-right">
                      <button type="button" onClick={() => remove(d)} className="text-xs text-bad hover:underline">
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function SearchTester() {
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<Hit[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const go = async () => {
    setBusy(true);
    setError(null);
    try {
      setHits(await api<Hit[]>(`/api/lab/knowledge/search?q=${encodeURIComponent(q)}&k=5`));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <section aria-labelledby="search" className="flex flex-col gap-3">
      <h2 id="search" className="text-base font-semibold text-gray-100">
        Test retrieval
      </h2>
      <form
        className="flex flex-col gap-2 sm:flex-row sm:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          if (q.trim()) go();
        }}
      >
        <TextField label="Query" value={q} onChange={(e) => setQ(e.target.value)} className="flex-1" placeholder="e.g. why Wald fails at zero events" />
        <Button type="submit" kind="quiet" disabled={busy || !q.trim()}>
          {busy ? 'Searching…' : 'Search'}
        </Button>
      </form>
      <ErrorNote>{error}</ErrorNote>
      {hits && (
        <ol className="flex flex-col gap-2">
          {hits.length === 0 && <li className="text-sm text-gray-500">No matches.</li>}
          {hits.map((h, i) => (
            <li key={h.chunk_id} className="rounded-lg bg-gray-900 p-3 text-xs text-gray-400">
              <div className="mb-1 flex gap-2">
                <span className="font-mono text-accent">#{i + 1}</span>
                <span className="font-medium text-gray-200">{h.title}</span>
                <span className="ml-auto font-mono">cosine sim {(1 - Number(h.distance)).toFixed(3)}</span>
              </div>
              <p className="line-clamp-3 whitespace-pre-wrap">{h.text}</p>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
