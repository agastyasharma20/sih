'use client';

import { WEEKDAYS, type Heatmap as HeatmapData } from '@/lib/insights';

const HOUR_LABELS = [0, 4, 8, 12, 16, 20];

/**
 * Registrations by weekday and hour, in IST.
 *
 * Drawn as a CSS grid rather than with a chart library: 168 cells is
 * cheaper as divs than as SVG, and it keeps Recharts out of this bundle.
 */
export function ActivityHeatmap({ data }: { data: HeatmapData }) {
  if (data.total === 0) {
    return (
      <p className="rounded-xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-700">
        No registrations to plot yet.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      {/* Capped so a wide monitor gets a heatmap rather than a mosaic of
          40-pixel tiles; it still scrolls below the minimum. */}
      <div className="min-w-[520px] max-w-3xl">
        <div className="flex gap-1.5">
          <div className="w-9 shrink-0" />
          <div className="relative h-4 flex-1">
            {HOUR_LABELS.map((hour) => (
              <span
                key={hour}
                className="absolute top-0 text-[10px] tabular-nums text-slate-400"
                style={{ left: `${(hour / 24) * 100}%` }}
              >
                {String(hour).padStart(2, '0')}
              </span>
            ))}
          </div>
        </div>

        {data.matrix.map((row, weekday) => (
          <div key={weekday} className="mt-1 flex items-center gap-1.5">
            <span className="w-9 shrink-0 text-[10px] font-semibold uppercase text-slate-400">
              {WEEKDAYS[weekday]}
            </span>
            <div className="grid flex-1 grid-cols-24 gap-[3px]">
              {row.map((count, hour) => {
                const intensity = data.max ? count / data.max : 0;
                return (
                  <div
                    key={hour}
                    title={`${WEEKDAYS[weekday]} ${String(hour).padStart(2, '0')}:00 IST — ${count} team${count === 1 ? '' : 's'}`}
                    className="aspect-square rounded-[3px] bg-piemr-500 ring-1 ring-inset ring-slate-900/5 transition dark:ring-white/5"
                    style={{ opacity: count === 0 ? 0.06 : 0.2 + intensity * 0.8 }}
                  />
                );
              })}
            </div>
          </div>
        ))}

        <p className="mt-3 text-[11px] text-slate-500">
          Times are IST.{' '}
          {data.busiestWeekday !== null && data.busiestHour !== null && (
            <>
              Busiest window: <strong>{WEEKDAYS[data.busiestWeekday]}</strong> around{' '}
              <strong>{String(data.busiestHour).padStart(2, '0')}:00</strong>.
            </>
          )}
        </p>
      </div>
    </div>
  );
}
