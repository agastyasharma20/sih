import type { ReactNode } from 'react';

/**
 * The frame every analytics block shares. Having one component own the
 * heading, the note and the optional badge is what keeps twenty panels
 * looking like one dashboard.
 */
export function Panel({
  title,
  subtitle,
  badge,
  children,
  className = '',
}: {
  title: string;
  subtitle?: ReactNode;
  badge?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`card card-glow ${className}`}>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-bold tracking-tight">{title}</h3>
          {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
        </div>
        {badge}
      </header>
      <div className="mt-4">{children}</div>
    </section>
  );
}

/** A short status pill. `tone` is the semantic, not the colour. */
export function Pill({
  tone = 'neutral',
  children,
}: {
  tone?: 'good' | 'warn' | 'bad' | 'neutral';
  children: ReactNode;
}) {
  const tones = {
    good: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
    warn: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
    bad: 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300',
    neutral: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  } as const;

  return <span className={`badge ${tones[tone]}`}>{children}</span>;
}

/** Shown wherever a panel has nothing to draw yet. */
export function Empty({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-700">
      {children}
    </p>
  );
}
