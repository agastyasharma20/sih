'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, useInView, useReducedMotion } from 'framer-motion';
import { Sparkline } from './Sparkline';

export type Tone = 'good' | 'warn' | 'bad' | 'neutral';

const TONE_RING: Record<Tone, string> = {
  good: 'before:from-emerald-500/70',
  warn: 'before:from-amber-500/70',
  bad: 'before:from-rose-500/70',
  neutral: 'before:from-piemr-500/70',
};

const TONE_TEXT: Record<Tone, string> = {
  good: 'text-emerald-600 dark:text-emerald-400',
  warn: 'text-amber-600 dark:text-amber-400',
  bad: 'text-rose-600 dark:text-rose-400',
  neutral: 'text-slate-500',
};

/**
 * A headline figure. Counts up once on entry, draws an optional trend
 * line, and colours only the note — the number itself stays neutral so a
 * wall of tiles does not turn into a traffic light.
 */
export function StatTile({
  label,
  value,
  note,
  tone = 'neutral',
  suffix = '',
  trend,
  delay = 0,
}: {
  label: string;
  value: number | string;
  note?: string;
  tone?: Tone;
  suffix?: string;
  trend?: number[];
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-40px' });
  const reduced = useReducedMotion();
  const numeric = typeof value === 'number';

  // Server-render the true figure so the tile is correct without JS and
  // in any test that reads it before the animation runs.
  const [display, setDisplay] = useState<number>(numeric ? (value as number) : 0);

  useEffect(() => {
    if (!numeric || !inView || reduced) return;

    const target = value as number;
    if (target === 0) return;

    const duration = 900;
    const start = performance.now();
    let frame = requestAnimationFrame(function tick(now) {
      const progress = Math.min((now - start) / duration, 1);
      setDisplay(Math.round(target * (1 - (1 - progress) ** 3)));
      if (progress < 1) frame = requestAnimationFrame(tick);
    });

    return () => cancelAnimationFrame(frame);
  }, [inView, numeric, reduced, value]);

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 12 }}
      animate={inView ? { opacity: 1, y: 0 } : undefined}
      transition={{ duration: 0.4, delay }}
      className={`stat-tile ${TONE_RING[tone]}`}
    >
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p>

      <div className="mt-2 flex items-end justify-between gap-3">
        <p className="text-3xl font-black tracking-tight tabular-nums">
          {numeric ? display : value}
          {suffix}
        </p>
        {trend && trend.length > 1 && <Sparkline values={trend} />}
      </div>

      {note && <p className={`mt-1.5 text-xs font-medium ${TONE_TEXT[tone]}`}>{note}</p>}
    </motion.div>
  );
}
