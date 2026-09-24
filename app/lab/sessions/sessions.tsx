'use client';
import { api, useApi } from '#/lib/lab/client';
import type { Session } from '#/lib/lab/store';
import { ErrorNote, Loading } from '#/ui/form';
import Link from 'next/link';

export function Sessions() {
  const sessions = useApi<Session[]>('/api/lab/sessions');
  if (sessions.loading && !sessions.data) return <Loading />;
  if (sessions.error) return <ErrorNote>{sessions.error}</ErrorNote>;
  if (!sessions.data!.length)
    return (
      <p className="text-sm text-gray-500">
        No sessions yet. <Link href="/lab/chat" className="text-accent underline">Ask the agent something</Link>.
      </p>
    );
  const remove = async (s: Session) => {
    if (!confirm(`Delete the session "${s.title}"?`)) return;
    await api(`/api/lab/sessions/${s.id}`, { method: 'DELETE' });
    sessions.reload();
  };
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] text-sm">
        <thead>
          <tr className="text-left text-xs text-gray-400">
            <th className="border-b border-gray-700 py-2 pr-3 font-medium">Session</th>
            <th className="border-b border-gray-700 px-2 py-2 font-medium">Agent</th>
            <th className="border-b border-gray-700 px-2 py-2 text-right font-medium">Questions</th>
            <th className="border-b border-gray-700 px-2 py-2 font-medium">Started (UTC)</th>
            <th className="border-b border-gray-700 py-2 pl-2" />
          </tr>
        </thead>
        <tbody>
          {sessions.data!.map((s) => (
            <tr key={s.id} className="text-gray-300">
              <td className="border-b border-gray-800 py-2 pr-3">
                <Link href={`/lab/chat?session=${s.id}`} className="text-gray-100 hover:underline">
                  {s.title}
                </Link>
              </td>
              <td className="border-b border-gray-800 px-2 py-2 text-gray-400">{s.agent_name}</td>
              <td className="border-b border-gray-800 px-2 py-2 text-right font-mono">{s.turns}</td>
              <td className="border-b border-gray-800 px-2 py-2 font-mono text-xs text-gray-500">{s.created_at}</td>
              <td className="border-b border-gray-800 py-2 pl-2 text-right">
                <button type="button" onClick={() => remove(s)} className="text-xs text-bad hover:underline">
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
