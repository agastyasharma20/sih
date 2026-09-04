import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { SIH_SITE } from '@/lib/constants';
import { ExternalLink } from 'lucide-react';
import { JudgeConsole } from '@/components/judge/JudgeConsole';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Judging · PIEMR Hackathon' };

/** Module 3. A judge types the team's 3-digit ID, reviews the artefacts,
 *  and scores against the criteria an admin configured. */
export default async function JudgeDashboard() {
  await requireRole('judge');
  const supabase = createClient();

  const [{ data: criteria }, { data: settingRow }] = await Promise.all([
    supabase
      .from('marking_criteria')
      .select('id, name, description, max_marks')
      .eq('is_active', true)
      .order('display_order'),
    supabase.from('settings').select('value').eq('key', 'judging_open').maybeSingle(),
  ]);

  const judgingOpen = settingRow?.value === true;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Judging</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Enter a team&apos;s 3-digit ID to pull up their submission and score it.
          </p>
        </div>
        <span
          className={
            judgingOpen
              ? 'badge bg-emerald-100 px-3 py-1 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
              : 'badge bg-slate-200 px-3 py-1 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
          }
        >
          Judging {judgingOpen ? 'open' : 'closed'}
        </span>
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

      <JudgeConsole
        criteria={(criteria ?? []).map((c) => ({ ...c, max_marks: Number(c.max_marks) }))}
        judgingOpen={judgingOpen}
      />
    </div>
  );
}
