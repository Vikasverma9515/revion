'use client';
import clsx from 'clsx';
import { useId } from 'react';

const input =
  'w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100 placeholder:text-gray-600 focus:border-accent focus:ring-accent disabled:opacity-60';

export function TextField({ label, hint, className, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
  const id = useId();
  return (
    <div className={clsx('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-sm font-medium text-gray-300">
        {label}
      </label>
      <input id={id} className={input} {...props} />
      {hint && <p className="text-xs text-gray-500">{hint}</p>}
    </div>
  );
}

export function TextArea({ label, hint, className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; hint?: string }) {
  const id = useId();
  return (
    <div className={clsx('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-sm font-medium text-gray-300">
        {label}
      </label>
      <textarea id={id} className={clsx(input, 'min-h-24 leading-relaxed')} {...props} />
      {hint && <p className="text-xs text-gray-500">{hint}</p>}
    </div>
  );
}

export function Select({
  label,
  options,
  hint,
  className,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & { label: string; options: { value: string | number; label: string }[]; hint?: string }) {
  const id = useId();
  return (
    <div className={clsx('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-sm font-medium text-gray-300">
        {label}
      </label>
      <select id={id} className={input} {...props}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {hint && <p className="text-xs text-gray-500">{hint}</p>}
    </div>
  );
}

export function Checkbox({ label, hint, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
  const id = useId();
  return (
    <div className="flex items-start gap-2">
      <input id={id} type="checkbox" className="mt-0.5 rounded border-gray-600 bg-gray-900 text-accent focus:ring-accent" {...props} />
      <div>
        <label htmlFor={id} className="text-sm text-gray-200">
          {label}
        </label>
        {hint && <p className="text-xs text-gray-500">{hint}</p>}
      </div>
    </div>
  );
}

export function ErrorNote({ children }: { children: React.ReactNode }) {
  if (!children) return null;
  return (
    <p role="alert" className="rounded-md border border-bad/40 bg-bad/10 px-3 py-2 text-sm text-bad">
      {children}
    </p>
  );
}

export function Loading({ label = 'Loading…' }: { label?: string }) {
  return (
    <p role="status" className="flex items-center gap-2 text-sm text-gray-400">
      <span className="spinner size-4 rounded-full" aria-hidden />
      {label}
    </p>
  );
}

export function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={clsx('rounded-lg bg-gray-900 p-4', className)}>{children}</div>;
}

export function Badge({ tone = 'gray', children }: { tone?: 'gray' | 'good' | 'bad' | 'warn' | 'accent'; children: React.ReactNode }) {
  return (
    <span
      className={clsx('inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-mono text-[11px] font-semibold', {
        'bg-gray-800 text-gray-300': tone === 'gray',
        'bg-good/15 text-good': tone === 'good',
        'bg-bad/15 text-bad': tone === 'bad',
        'bg-warn/15 text-warn': tone === 'warn',
        'bg-accent/15 text-accent': tone === 'accent',
      })}
    >
      {children}
    </span>
  );
}
