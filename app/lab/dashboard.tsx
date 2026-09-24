'use client';
import { api, fmtPct, useApi } from '#/lib/lab/client';
import type { Run } from '#/lib/lab/store';
import { Button } from '#/ui/controls';
import { Badge, Card, ErrorNote, Loading } from '#/ui/form';
import { Stat } from '#/ui/stat';
import Link from 'next/link';
import { useState } from 'react';

type Status = {
  setup: { groq: boolean; gemini: boolean; turso: boolean; ephemeralDb: boolean; protected: boolean };
  counts: Record<string, number>;
};

export function Dashboard() {
  const status = useApi<Status>('/api/lab/status');
  const runs = useApi<Run[]>('/api/lab/runs');
  const [seeding, setSeeding] = useState(false);
  const [seedMsg, setSeedMsg] = useState<string | null>(null);

  const loadStarter = async () => {
    setSeeding(true);
    setSeedMsg(null);
    try {
      const r = await api<{ added: number }>('/api/lab/knowledge/starter', { method: 'POST' });
      setSeedMsg(`Added ${r.added} documents.`);
      status.reload();
    } catch (e) {
      setSeedMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setSeeding(false);
    }
  };

  if (status.loading && !status.data) return <Loading />;
  if (status.error) return <ErrorNote>{status.error}</ErrorNote>;
  const s = status.data!;
  const c = s.counts;

  return (
    <div className="flex flex-col gap-8">
      <section aria-labelledby="setup" className="flex flex-col gap-3">
        <h2 id="setup" className="text-base font-semibold text-gray-100">
          Setup
        </h2>
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <SetupItem ok={s.setup.groq} label="Agent LLM (Groq)" missing="Set GROQ_API_KEY" />
          <SetupItem ok={s.setup.gemini} label="Judge LLM (Gemini)" missing="Set GEMINI_API_KEY" />
          <SetupItem
            ok={s.setup.turso}
            label="Database (Turso libSQL)"
            missing={s.setup.ephemeralDb ? 'Using /tmp: data is lost between cold starts. Set TURSO_DATABASE_URL' : 'Using a local libSQL file (.data/lab.db)'}
            warnOnly={!s.setup.ephemeralDb}
          />
          <SetupItem ok label="Embeddings (local all-MiniLM-L6-v2, 384-d)" missing="" />
          <SetupItem ok={s.setup.protected} label="Access token on /lab" missing="Open to anyone with the URL. Set LAB_ACCESS_TOKEN" warnOnly />
        </ul>
      </section>

      <section aria-label="Counts" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Documents" value={c.documents} sub={`${c.chunks} chunks`} />
        <Stat label="Sessions" value={c.sessions} sub={`${c.answers} answers`} />
        <Stat label="Golden items" value={c.golden} />
        <Stat label="Benchmark runs" value={c.runs} sub={`${c.annotations} human labels`} />
      </section>

      {c.documents === 0 && (
        <Card className="flex flex-col gap-3">
          <p className="text-sm text-gray-300">
            The knowledge base is empty. Load the starter documents (the two problems, the answers, the method notes and the Python
            reference code), or add your own on the Knowledge page. The first load downloads the embedding model (about 23 MB).
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={loadStarter} disabled={seeding}>
              {seeding ? 'Embedding…' : 'Load starter knowledge'}
            </Button>
            <Link href="/lab/knowledge" className="text-sm text-accent underline">
              Add your own documents
            </Link>
          </div>
          {seedMsg && <p className="text-sm text-gray-400">{seedMsg}</p>}
        </Card>
      )}

      <section aria-labelledby="flow" className="flex flex-col gap-3">
        <h2 id="flow" className="text-base font-semibold text-gray-100">
          How the pieces fit
        </h2>
        <ol className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
          {[
            ['1. Ask', '/lab/chat', 'Chat with the agent. It retrieves from the knowledge base, cites sources, and stores every turn.'],
            ['2. Curate', '/lab/golden', 'Save good questions to a golden set, editing the answer into a reference.'],
            ['3. Define rules', '/lab/agents', 'Write rubric criteria and hard rules for the judges.'],
            ['4. Benchmark', '/lab/studio', 'Run Gemini judges over a golden set (fresh answers) or imported sessions (stored answers).'],
            ['5. Annotate', '/lab/annotate', 'Humans label the same results blind; the report shows judge-human agreement.'],
            ['6. Correct', '/lab/studio', 'Judge sensitivity and specificity vs humans give a Rogan-Gladen corrected pass rate.'],
          ].map(([t, href, d]) => (
            <li key={t}>
              <Link href={href} className="flex h-full flex-col gap-1 rounded-lg bg-gray-900 px-4 py-3 hover:bg-gray-800">
                <span className="font-medium text-gray-100">{t}</span>
                <span className="text-gray-400">{d}</span>
              </Link>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="recent" className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 id="recent" className="text-base font-semibold text-gray-100">
            Recent benchmark runs
          </h2>
          <Link href="/lab/studio" className="text-sm text-accent underline">
            Open studio
          </Link>
        </div>
        {runs.loading && !runs.data ? (
          <Loading />
        ) : runs.error ? (
          <ErrorNote>{runs.error}</ErrorNote>
        ) : runs.data!.length === 0 ? (
          <p className="text-sm text-gray-500">No runs yet.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-gray-800">
            {runs.data!.slice(0, 6).map((r) => (
              <li key={r.id}>
                <Link href={`/lab/studio/runs/${r.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3 hover:bg-gray-900">
                  <span className="font-medium text-gray-100">{r.name}</span>
                  <Badge tone={r.status === 'done' ? 'good' : r.status === 'failed' ? 'bad' : 'warn'}>{r.status}</Badge>
                  <span className="text-xs text-gray-500">
                    {r.agent_name} · {r.done}/{r.total} items
                  </span>
                  {r.summary && <span className="ml-auto font-mono text-sm text-gray-200">pass {fmtPct(r.summary.consensusPassRate)}</span>}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function SetupItem({ ok, label, missing, warnOnly }: { ok: boolean; label: string; missing: string; warnOnly?: boolean }) {
  return (
    <li className="flex items-start gap-3 rounded-lg bg-gray-900 px-4 py-3">
      <Badge tone={ok ? 'good' : warnOnly ? 'warn' : 'bad'}>{ok ? 'READY' : warnOnly ? 'NOTE' : 'MISSING'}</Badge>
      <div className="min-w-0">
        <div className="text-sm font-medium text-gray-100">{label}</div>
        {!ok && missing && <div className="text-xs text-gray-400">{missing}</div>}
      </div>
    </li>
  );
}
