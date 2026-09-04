'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

interface Row {
  team_id: string;
  team_id_short: string;
  team_name: string;
  idea_slot: number;
  judge_count: number;
  total_marks: number;
  average_marks: number | null;
  verdict: 'selected' | 'waitlisted' | 'rejected' | null;
  is_published: boolean;
}

const VERDICTS = ['selected', 'waitlisted', 'rejected'] as const;

export function ResultsTable({ rows }: { rows: Row[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  async function save(row: Row, verdict: string | null, publish: boolean) {
    const key = `${row.team_id}-${row.idea_slot}`;
    setBusy(key);

    await fetch('/api/admin/results', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        team_id: row.team_id,
        idea_slot: row.idea_slot,
        final_verdict: verdict,
        is_published: publish,
      }),
    });

    setBusy(null);
    router.refresh();
  }

  if (rows.length === 0) {
    return (
      <div className="card">
        <p className="text-sm text-slate-600 dark:text-slate-400">
          No submissions have been scored yet.
        </p>
      </div>
    );
  }

  return (
    <div className="card overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="text-xs uppercase tracking-wider text-slate-500">
          <tr>
            <th className="pb-3 pr-4">Team</th>
            <th className="pb-3 pr-4">Idea</th>
            <th className="pb-3 pr-4">Judges</th>
            <th className="pb-3 pr-4">Average</th>
            <th className="pb-3 pr-4">Verdict</th>
            <th className="pb-3">Published</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
          {rows.map((row) => {
            const key = `${row.team_id}-${row.idea_slot}`;

            return (
              <tr key={key}>
                <td className="py-3 pr-4">
                  <span className="font-mono font-bold">{row.team_id_short}</span>
                  <span className="ml-2 text-slate-600 dark:text-slate-400">{row.team_name}</span>
                </td>
                <td className="py-3 pr-4">{row.idea_slot}</td>
                <td className="py-3 pr-4">{row.judge_count}</td>
                <td className="py-3 pr-4 font-mono font-semibold">
                  {row.average_marks ?? '—'}
                </td>
                <td className="py-3 pr-4">
                  <select
                    value={row.verdict ?? ''}
                    disabled={busy === key}
                    onChange={(e) => save(row, e.target.value || null, row.is_published)}
                    className="field-input py-1 text-xs"
                  >
                    <option value="">Not decided</option>
                    {VERDICTS.map((verdict) => (
                      <option key={verdict} value={verdict} className="capitalize">
                        {verdict[0].toUpperCase() + verdict.slice(1)}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="py-3">
                  {busy === key ? (
                    <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                  ) : (
                    <label className="flex items-center gap-2 text-xs">
                      <input
                        type="checkbox"
                        checked={row.is_published}
                        disabled={!row.verdict}
                        onChange={(e) => save(row, row.verdict, e.target.checked)}
                        className="h-4 w-4 rounded border-slate-300 text-piemr-600 focus:ring-piemr-500"
                      />
                      {row.is_published ? 'Visible to team' : 'Hidden'}
                    </label>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <p className="mt-4 text-xs text-slate-500">
        A verdict must be set before it can be published. Publishing reveals it to that team
        only; the public results page additionally needs the
        <code className="mx-1 rounded bg-slate-100 px-1 dark:bg-slate-800">results_published</code>
        switch in Settings. Marks are never shown to teams or on the public page.
      </p>
    </div>
  );
}
