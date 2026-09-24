'use client';
import type { Check } from '#/lib/verify';
import { useStream } from '#/lib/use-stream';
import { Button, Status } from '#/ui/controls';
import { CheckCircleIcon, XCircleIcon } from '@heroicons/react/20/solid';
import Link from 'next/link';
import { useEffect, useState } from 'react';

const TOTAL = 11;

export function VerifyPanel() {
  const [checks, setChecks] = useState<Check[]>([]);
  const { status, message, start } = useStream((event, data) => {
    if (event === 'check') setChecks((c) => [...c, data as Check]);
  });
  const run = () => {
    setChecks([]);
    start('/api/verify');
  };
  // Run once on load so the reviewer sees the badges without clicking.
  useEffect(run, []); // eslint-disable-line react-hooks/exhaustive-deps

  const passed = checks.filter((c) => c.pass).length;
  const allDone = status === 'done';
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-100">Verify every acceptance number</h2>
          <p className="text-sm text-gray-400">
            Runs on the server with the same code the pages use and the same assertions as the unit tests.
          </p>
        </div>
        <Button onClick={run} disabled={status === 'running'}>
          Run again
        </Button>
      </div>
      <p className="font-mono text-sm text-gray-300" aria-live="polite">
        {checks.length} / {TOTAL} run · {passed} passed
        {allDone && (passed === checks.length ? ' · all green' : ` · ${checks.length - passed} failed`)}
      </p>
      <Status status={status} message={message} />
      <ul className="flex flex-col divide-y divide-gray-800">
        {checks.map((c) => (
          <li key={c.id} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-start sm:gap-4">
            <span
              className={`inline-flex w-fit shrink-0 items-center gap-1 rounded px-2 py-0.5 font-mono text-xs font-semibold ${c.pass ? 'bg-good/15 text-good' : 'bg-bad/15 text-bad'}`}
            >
              {c.pass ? <CheckCircleIcon className="size-4" aria-hidden /> : <XCircleIcon className="size-4" aria-hidden />}
              {c.pass ? 'PASS' : 'FAIL'}
            </span>
            <div className="flex min-w-0 flex-col gap-0.5">
              <Link href={c.section} className="text-sm font-medium text-gray-100 hover:underline">
                {c.label}
              </Link>
              <span className="font-mono text-xs break-words text-gray-400">expected {c.expected}</span>
              <span className="font-mono text-xs break-words text-gray-300">got {c.actual}</span>
            </div>
          </li>
        ))}
        {status === 'running' &&
          Array.from({ length: Math.max(0, TOTAL - checks.length) }, (_, i) => (
            <li key={`p${i}`} className="py-3">
              <div className="h-4 w-2/3 animate-pulse rounded bg-gray-800" aria-hidden />
            </li>
          ))}
      </ul>
    </div>
  );
}
