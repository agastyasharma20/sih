import { redirect } from 'next/navigation';
import { requireProfile, isAdminTier } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { ResultsTable } from '@/components/admin/ResultsTable';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Results · PIEMR Hackathon' };

/** Module 4. Scores come from the submission_scores view, which is
 *  security_invoker — a coordinator opening this URL sees nothing. */
export default async function ResultsPage() {
  const profile = await requireProfile();
  if (!isAdminTier(profile.role)) redirect('/dashboard');

  const supabase = createClient();

  const [{ data: scores }, { data: results }] = await Promise.all([
    supabase
      .from('submission_scores')
      .select('team_id, team_id_short, team_name, idea_slot, judge_count, total_marks, average_marks')
      .order('average_marks', { ascending: false, nullsFirst: false }),
    supabase.from('results').select('team_id, idea_slot, final_verdict, is_published'),
  ]);

  const resultByKey = new Map(
    (results ?? []).map((r) => [`${r.team_id}-${r.idea_slot}`, r]),
  );

  const rows = (scores ?? []).map((score) => {
    const existing = resultByKey.get(`${score.team_id}-${score.idea_slot}`);
    return {
      team_id: score.team_id as string,
      team_id_short: score.team_id_short as string,
      team_name: score.team_name as string,
      idea_slot: score.idea_slot as number,
      judge_count: Number(score.judge_count ?? 0),
      total_marks: Number(score.total_marks ?? 0),
      average_marks: score.average_marks === null ? null : Number(score.average_marks),
      verdict: (existing?.final_verdict ?? null) as
        | 'selected'
        | 'waitlisted'
        | 'rejected'
        | null,
      is_published: Boolean(existing?.is_published),
    };
  });

  const published = rows.filter((r) => r.is_published).length;
  const selected = rows.filter((r) => r.verdict === 'selected').length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Results</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Ranked by average marks across judges. {selected} selected, {published} published.
        </p>
      </div>

      <ResultsTable rows={rows} />
    </div>
  );
}
