import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { SIH_SITE } from '@/lib/constants';
import { ExternalLink } from 'lucide-react';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Judging · PIEMR Hackathon' };

/** Module 3 lands here. The rubric below is live from the database, so
 *  what a judge sees always matches what an admin has configured. */
export default async function JudgeDashboard() {
  await requireRole('judge');
  const supabase = createClient();

  const { data: criteria } = await supabase
    .from('marking_criteria')
    .select('id, name, description, max_marks')
    .eq('is_active', true)
    .order('display_order');

  const total = (criteria ?? []).reduce((sum, c) => sum + Number(c.max_marks), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Judging</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          At the presentation you will enter a team&apos;s 3-digit Team ID to pull up their
          submission and score it against the rubric below.
        </p>
      </div>

      <a
        href={SIH_SITE}
        target="_blank"
        rel="noreferrer noopener"
        className="flex items-center justify-between rounded-xl border border-sih-saffron/40 bg-sih-saffron/10 p-4 text-sm"
      >
        <span>
          <strong>National round rules</strong> — refer to the official Smart India Hackathon
          site for the current edition&apos;s guidelines.
        </span>
        <ExternalLink className="h-4 w-4 shrink-0 text-sih-saffron" />
      </a>

      <div className="card">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">Marking criteria</h2>
          <span className="badge bg-piemr-100 text-piemr-800 dark:bg-piemr-950 dark:text-piemr-300">
            {total} marks total
          </span>
        </div>

        <ul className="mt-4 divide-y divide-slate-200 dark:divide-slate-800">
          {(criteria ?? []).map((criterion) => (
            <li key={criterion.id} className="flex items-start justify-between gap-6 py-3">
              <div>
                <p className="font-medium">{criterion.name}</p>
                {criterion.description && (
                  <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">
                    {criterion.description}
                  </p>
                )}
              </div>
              <span className="shrink-0 font-mono text-sm font-semibold">
                / {criterion.max_marks}
              </span>
            </li>
          ))}
        </ul>

        <p className="mt-4 text-xs text-slate-500">
          Scoring opens once submissions close (Module 3). Remarks are recorded per criterion
          alongside the marks.
        </p>
      </div>
    </div>
  );
}
