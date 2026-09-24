'use client';
import { api, useApi } from '#/lib/lab/client';
import type { Dataset, GoldenItem } from '#/lib/lab/store';
import { Button } from '#/ui/controls';
import { Badge, ErrorNote, Loading, Select, TextArea, TextField } from '#/ui/form';
import Link from 'next/link';
import { useState } from 'react';

export function Golden() {
  const datasets = useApi<Dataset[]>('/api/lab/datasets');
  const [selected, setSelected] = useState<number | null>(null);
  const [newName, setNewName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const id = selected ?? datasets.data?.[0]?.id ?? null;

  const create = async () => {
    try {
      const r = await api<{ id: number }>('/api/lab/datasets', { method: 'POST', json: { name: newName } });
      setNewName('');
      await datasets.reload();
      setSelected(r.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const removeDataset = async (d: Dataset) => {
    if (!confirm(`Delete the dataset "${d.name}" and its ${d.items} items?`)) return;
    await api(`/api/lab/datasets?id=${d.id}`, { method: 'DELETE' });
    setSelected(null);
    datasets.reload();
  };

  if (datasets.loading && !datasets.data) return <Loading />;
  if (datasets.error) return <ErrorNote>{datasets.error}</ErrorNote>;
  const current = datasets.data!.find((d) => d.id === id);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <Select
          label="Dataset"
          className="flex-1"
          value={id ?? ''}
          onChange={(e) => setSelected(Number(e.target.value))}
          options={datasets.data!.map((d) => ({ value: d.id, label: `${d.name} (${d.items} items)` }))}
        />
        <TextField label="New dataset" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Name" />
        <Button kind="quiet" onClick={create} disabled={!newName.trim()}>
          Create
        </Button>
      </div>
      <ErrorNote>{error}</ErrorNote>
      {current && (
        <div className="flex flex-wrap items-center gap-3 text-sm text-gray-400">
          <span>{current.description || 'No description.'}</span>
          <button type="button" onClick={() => removeDataset(current)} className="ml-auto text-xs text-bad hover:underline">
            Delete dataset
          </button>
        </div>
      )}
      {id && <Items datasetId={id} onChange={datasets.reload} />}
    </div>
  );
}

function Items({ datasetId, onChange }: { datasetId: number; onChange: () => void }) {
  const data = useApi<{ items: GoldenItem[] }>(`/api/lab/datasets/${datasetId}`);
  const [editing, setEditing] = useState<number | 'new' | null>(null);
  if (data.loading && !data.data) return <Loading />;
  if (data.error) return <ErrorNote>{data.error}</ErrorNote>;
  const items = data.data!.items;
  const done = () => {
    setEditing(null);
    data.reload();
    onChange();
  };
  return (
    <section aria-label="Golden items" className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-100">{items.length} items</h2>
        <Button kind="quiet" onClick={() => setEditing('new')}>
          Add item
        </Button>
      </div>
      {editing === 'new' && <Editor datasetId={datasetId} onDone={done} onCancel={() => setEditing(null)} />}
      <ol className="flex flex-col gap-3">
        {items.map((it, i) =>
          editing === it.id ? (
            <li key={it.id}>
              <Editor datasetId={datasetId} item={it} onDone={done} onCancel={() => setEditing(null)} />
            </li>
          ) : (
            <li key={it.id} className="flex flex-col gap-2 rounded-lg bg-gray-900 px-4 py-3">
              <div className="flex items-start gap-3">
                <span className="font-mono text-xs text-gray-500">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-100">{it.question}</p>
                  <p className="mt-1 text-sm whitespace-pre-wrap text-gray-400">{it.reference}</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 pl-6 text-xs">
                {it.tags.split(',').filter(Boolean).map((t) => (
                  <Badge key={t}>{t.trim()}</Badge>
                ))}
                {it.source_message_id && <Badge tone="accent">from chat</Badge>}
                <button type="button" onClick={() => setEditing(it.id)} className="ml-auto text-gray-300 hover:underline">
                  Edit
                </button>
                <button
                  type="button"
                  className="text-bad hover:underline"
                  onClick={async () => {
                    if (!confirm('Delete this item?')) return;
                    await api(`/api/lab/golden?id=${it.id}`, { method: 'DELETE' });
                    done();
                  }}
                >
                  Delete
                </button>
              </div>
            </li>
          ),
        )}
      </ol>
      {items.length === 0 && (
        <p className="text-sm text-gray-500">
          Empty. Add items here, or save answers from <Link href="/lab/chat" className="text-accent underline">the chat</Link>.
        </p>
      )}
    </section>
  );
}

function Editor({ datasetId, item, onDone, onCancel }: { datasetId: number; item?: GoldenItem; onDone: () => void; onCancel: () => void }) {
  const [q, setQ] = useState(item?.question ?? '');
  const [ref, setRef] = useState(item?.reference ?? '');
  const [tags, setTags] = useState(item?.tags ?? '');
  const [error, setError] = useState<string | null>(null);
  const save = async () => {
    try {
      await api('/api/lab/golden', { method: 'POST', json: { id: item?.id, datasetId, question: q, reference: ref, tags } });
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-gray-700 p-4">
      <TextArea label="Question" value={q} onChange={(e) => setQ(e.target.value)} rows={2} />
      <TextArea label="Reference answer" value={ref} onChange={(e) => setRef(e.target.value)} rows={5} />
      <TextField label="Tags (comma separated)" value={tags} onChange={(e) => setTags(e.target.value)} />
      <ErrorNote>{error}</ErrorNote>
      <div className="flex gap-2">
        <Button onClick={save} disabled={!q.trim() || !ref.trim()}>
          Save
        </Button>
        <Button kind="quiet" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
