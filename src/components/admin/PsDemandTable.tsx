'use client';

/**
 * Problem-statement demand. Shows the busiest statements plus, crucially,
 * how many nobody has taken — that is what tells the SPOC what to promote
 * before registration closes.
 */
export function PsDemandTable({
  rows,
  untaken,
}: {
  rows: Array<{ ps_id: string; title: string; category: string; theme: string | null; teams: number }>;
  untaken: number;
}) {
  const chosen = rows.filter((row) => row.teams > 0);
  const busiest = Math.max(1, ...rows.map((row) => row.teams));

  return (
    <div className="card">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold">Problem statement demand</h3>
          <p className="mt-0.5 text-xs text-slate-500">
            Which statements teams have picked, most popular first.
          </p>
        </div>
        <span
          className={
            untaken > 0
              ? 'badge bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
              : 'badge bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
          }
        >
          {untaken} with no team yet
        </span>
      </div>

      {chosen.length === 0 ? (
        <p className="mt-6 text-sm text-slate-500">
          No team has chosen a problem statement yet.
        </p>
      ) : (
        <div className="mt-4 max-h-96 overflow-y-auto">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-white text-xs uppercase tracking-wider text-slate-500 dark:bg-slate-900">
              <tr>
                <th className="pb-2 pr-3">PS</th>
                <th className="pb-2 pr-3">Title</th>
                <th className="pb-2 pr-3">Theme</th>
                <th className="pb-2">Teams</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {chosen.map((row) => (
                <tr key={row.ps_id}>
                  <td className="py-2 pr-3 font-mono text-xs font-semibold">{row.ps_id}</td>
                  <td className="py-2 pr-3">
                    <span className="line-clamp-1">{row.title}</span>
                    <span className="text-xs capitalize text-slate-400">{row.category}</span>
                  </td>
                  <td className="py-2 pr-3 text-xs text-slate-500">{row.theme ?? '—'}</td>
                  <td className="py-2">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                        <div
                          className="h-full rounded-full bg-piemr-500"
                          style={{ width: `${(row.teams / busiest) * 100}%` }}
                        />
                      </div>
                      <span className="font-mono text-xs font-semibold">{row.teams}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
