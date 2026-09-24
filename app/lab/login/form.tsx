'use client';
import { api } from '#/lib/lab/client';
import { Button } from '#/ui/controls';
import { ErrorNote, TextField } from '#/ui/form';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';

export function LoginForm() {
  const next = useSearchParams().get('next') ?? '/lab';
  const [token, setToken] = useState('');
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={async (e) => {
        e.preventDefault();
        try {
          await api('/api/lab/login', { method: 'POST', json: { token } });
          // Only same-site paths are allowed as a destination.
          window.location.href = next.startsWith('/') && !next.startsWith('//') ? next : '/lab';
        } catch (err) {
          setError(err instanceof Error ? err.message : String(err));
        }
      }}
    >
      <TextField label="Access token" type="password" autoComplete="current-password" value={token} onChange={(e) => setToken(e.target.value)} />
      <ErrorNote>{error}</ErrorNote>
      <div>
        <Button type="submit" disabled={!token}>
          Enter
        </Button>
      </div>
    </form>
  );
}
