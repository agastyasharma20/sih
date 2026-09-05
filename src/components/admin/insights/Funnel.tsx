'use client';

import { motion } from 'framer-motion';
import type { FunnelStage } from '@/lib/insights';

/**
 * The event as a funnel. Bars are drawn against the first stage so the
 * narrowing is literal, and each drop-off is labelled — the gap between
 * two stages is the number worth acting on, not either stage alone.
 */
export function Funnel({ stages }: { stages: FunnelStage[] }) {
  const top = stages[0]?.value ?? 0;

  if (top === 0) {
    return (
      <p className="rounded-xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-700">
        No teams have registered yet, so there is no funnel to draw.
      </p>
    );
  }

  return (
    <ol className="space-y-3">
      {stages.map((stage, index) => (
        <li key={stage.name}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="font-medium">{stage.name}</span>
            <span className="tabular-nums text-slate-500">
              <strong className="text-slate-900 dark:text-slate-100">{stage.value}</strong>
              <span className="ml-1.5 text-xs">{stage.share}%</span>
            </span>
          </div>

          <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            <motion.div
              initial={{ width: 0 }}
              whileInView={{ width: `${top ? (stage.value / top) * 100 : 0}%` }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.6, delay: index * 0.06, ease: [0.16, 1, 0.3, 1] }}
              className="h-full rounded-full bg-gradient-to-r from-piemr-600 to-sih-saffron"
            />
          </div>

          {index > 0 && stage.dropped > 0 && (
            <p className="mt-1 text-[11px] font-medium text-amber-600 dark:text-amber-400">
              −{stage.dropped} since &ldquo;{stages[index - 1].name}&rdquo;
            </p>
          )}
        </li>
      ))}
    </ol>
  );
}
