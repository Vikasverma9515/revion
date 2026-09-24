import clsx from 'clsx';

/** A big readable number with a label and an optional formula footnote. */
export function Stat({
  label,
  value,
  sub,
  accent,
  className,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  accent?: boolean;
  className?: string;
}) {
  return (
    <div className={clsx('flex flex-col gap-1 rounded-lg bg-gray-900 px-4 py-3', className)}>
      <div className="text-xs font-medium text-gray-400">{label}</div>
      <div className={clsx('font-mono text-2xl font-semibold tabular-nums', accent ? 'text-accent' : 'text-gray-100')}>
        {value}
      </div>
      {sub && <div className="text-xs text-gray-500">{sub}</div>}
    </div>
  );
}

/** Small monospace footnote for formulas. */
export function Formula({ children }: { children: React.ReactNode }) {
  return <p className="font-mono text-xs leading-relaxed text-gray-500">{children}</p>;
}

export function PageTitle({ kicker, title, children }: { kicker: string; title: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="font-mono text-xs font-semibold tracking-wider text-gray-500 uppercase">{kicker}</div>
      <h1 className="text-2xl font-semibold text-gray-100">{title}</h1>
      {children && <div className="flex max-w-prose flex-col gap-2 text-sm leading-relaxed text-gray-400">{children}</div>}
    </div>
  );
}
