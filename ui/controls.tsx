'use client';
import clsx from 'clsx';
import { useId } from 'react';
import type { StreamStatus } from '#/lib/use-stream';
import { randomSeed } from '#/lib/stats/rng';

/** Digits after the decimal point in a step like 0.001. */
const decimals = (step: number) => (String(step).split('.')[1] ?? '').length;

/** Slider + number box sharing one value; both are labelled and keyboard-usable. */
export function Field({
  label,
  value,
  onChange,
  min,
  max,
  step,
  hint,
  slider = true,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
  hint?: string;
  slider?: boolean;
}) {
  const id = useId();
  const set = (raw: string) => {
    const v = Number(raw);
    if (raw !== '' && Number.isFinite(v)) onChange(Math.min(max, Math.max(min, v)));
  };
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-sm font-medium text-gray-300">
          {label}
        </label>
        <input
          type="number"
          id={slider ? undefined : id}
          aria-label={slider ? `${label} value` : undefined}
          className="w-28 rounded-md border border-gray-700 bg-gray-900 px-2 py-1 text-right font-mono text-sm text-gray-100 tabular-nums focus:border-accent focus:ring-accent"
          value={Number(value.toFixed(decimals(step) + 2))}
          min={min}
          max={max}
          step={step}
          onChange={(e) => set(e.target.value)}
        />
      </div>
      {slider && (
        <input
          id={id}
          type="range"
          className="w-full accent-[var(--color-accent)]"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => set(e.target.value)}
        />
      )}
      {hint && <p className="text-xs text-gray-500">{hint}</p>}
    </div>
  );
}

export function Button({ className, kind = 'primary', ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { kind?: 'primary' | 'quiet' }) {
  return (
    <button
      className={clsx(
        'rounded-md px-3.5 py-2 text-sm font-semibold transition-colors hover:cursor-pointer disabled:cursor-not-allowed disabled:opacity-50',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
        kind === 'primary' && 'bg-accent text-on-accent hover:opacity-90',
        kind === 'quiet' && 'border border-gray-700 text-gray-200 hover:bg-gray-800',
        className,
      )}
      {...props}
    />
  );
}

/** Seed box + "new seed" + run / cancel, with the run's status underneath. */
export function RunBar({
  seed,
  setSeed,
  onRun,
  onCancel,
  status,
  message,
  label = 'Run simulation',
  children,
}: {
  seed: number;
  setSeed: (s: number) => void;
  onRun: () => void;
  onCancel: () => void;
  status: StreamStatus;
  message: string | null;
  label?: string;
  children?: React.ReactNode;
}) {
  const id = useId();
  const running = status === 'running';
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor={id} className="text-xs font-medium text-gray-400">
            Seed (mulberry32)
          </label>
          <input
            id={id}
            type="number"
            min={0}
            className="w-28 rounded-md border border-gray-700 bg-gray-900 px-2 py-1.5 font-mono text-sm text-gray-100"
            value={seed}
            onChange={(e) => setSeed(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
          />
        </div>
        <Button kind="quiet" onClick={() => setSeed(randomSeed())} disabled={running}>
          New seed
        </Button>
        {children}
        {running ? (
          <Button kind="quiet" onClick={onCancel}>
            Cancel
          </Button>
        ) : (
          <Button onClick={onRun}>{label}</Button>
        )}
      </div>
      <Status status={status} message={message} />
    </div>
  );
}

export function Status({ status, message }: { status: StreamStatus; message: string | null }) {
  if (status === 'idle') return null;
  const text = {
    running: 'Running…',
    done: 'Done.',
    stopped: message ?? 'Stopped.',
    error: `Error: ${message ?? 'something went wrong.'}`,
  }[status];
  return (
    <p
      role={status === 'error' ? 'alert' : 'status'}
      className={clsx('flex items-center gap-2 text-sm', {
        'text-gray-400': status === 'running' || status === 'done',
        'text-warn': status === 'stopped',
        'text-bad': status === 'error',
      })}
    >
      {status === 'running' && <span className="spinner size-4 rounded-full" aria-hidden />}
      {text}
    </p>
  );
}
