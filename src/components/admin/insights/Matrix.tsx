import type { CrossTab } from '@/lib/insights';

/**
 * A cross-tab drawn as a shaded table — branch against year, say.
 *
 * Intensity carries the value and the number repeats it, because colour
 * alone is not readable for everyone and these cells are small.
 */
export function Matrix({ data, unit = 'participants' }: { data: CrossTab; unit?: string }) {
  if (data.total === 0) {
    return (
      <p className="rounded-xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-700">
        Nothing to cross-tabulate yet.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      {/* Capped for the same reason as the heatmap: full-width cells turn
          each count into a banner. */}
      <table className="w-full min-w-[420px] max-w-2xl border-separate border-spacing-1 text-sm">
        <caption className="sr-only">
          {unit} by {data.rows.length} rows and {data.cols.length} columns
        </caption>
        <thead>
          <tr>
            <th scope="col" className="w-40 text-left text-xs font-semibold text-slate-400">
              &nbsp;
            </th>
            {data.cols.map((col) => (
              <th
                key={col}
                scope="col"
                className="px-1 text-center text-[11px] font-semibold uppercase tracking-wider text-slate-500"
              >
                {col}
              </th>
            ))}
            <th scope="col" className="px-1 text-center text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              All
            </th>
          </tr>
        </thead>
        <tbody>
          {data.rows.map((row, r) => (
            <tr key={row}>
              <th scope="row" className="max-w-[10rem] truncate pr-2 text-left text-xs font-medium">
                {row}
              </th>
              {data.matrix[r].map((count, c) => (
                <td
                  key={data.cols[c]}
                  title={`${row} · ${data.cols[c]} — ${count} ${unit}`}
                  className="rounded-md text-center text-xs font-semibold tabular-nums"
                  style={{
                    backgroundColor: count
                      ? `rgba(46, 99, 255, ${0.12 + (count / data.max) * 0.62})`
                      : undefined,
                    color: count && count / data.max > 0.55 ? '#fff' : undefined,
                  }}
                >
                  <span className={count ? '' : 'text-slate-300 dark:text-slate-700'}>{count}</span>
                </td>
              ))}
              <td className="text-center text-xs font-bold tabular-nums text-slate-500">
                {data.rowTotals[r]}
              </td>
            </tr>
          ))}
          <tr>
            <th scope="row" className="pr-2 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              All
            </th>
            {data.colTotals.map((total, c) => (
              <td key={data.cols[c]} className="text-center text-xs font-bold tabular-nums text-slate-500">
                {total}
              </td>
            ))}
            <td className="text-center text-xs font-black tabular-nums">{data.total}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
