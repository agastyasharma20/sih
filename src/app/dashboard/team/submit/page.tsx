import Link from 'next/link';
import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { SubmissionForm } from '@/components/team/SubmissionForm';
import type { ProblemStatement } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Submit your idea · PIEMR Hackathon' };

/** Module 2. A team may run up to two ideas, each with its own problem
 *  statement and artefacts. */
export default async function SubmitPage() {
  const profile = await requireRole('team_lead');
  const supabase = createClient();

  const { data: team } = await supabase
    .from('teams')
    .select('id, team_id_short, team_name')
    .eq('created_by', profile.id)
    .maybeSingle();

  if (!team) {
    return (
      <div className="card max-w-xl">
        <h1 className="text-xl font-bold">Register a team first</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          You need a registered team before you can submit an idea.
        </p>
        <Link href="/register" className="btn-primary mt-5">
          Register your team
        </Link>
      </div>
    );
  }

  const [{ data: settingsRows }, { data: psRows }, { data: submissions }, { data: selections }] =
    await Promise.all([
      supabase.from('settings').select('key, value'),
      supabase
        .from('problem_statements')
        .select('id, ps_id, title, category, theme, description, is_active')
        .eq('is_active', true)
        .order('ps_id'),
      supabase
        .from('submissions')
        .select('idea_slot, ppt_url, github_url, video_url, architecture_url, submitted_at')
        .eq('team_id', team.id),
      supabase
        .from('team_ps_selection')
        .select('idea_slot, problem_statements ( ps_id )')
        .eq('team_id', team.id),
    ]);

  const settings = new Map((settingsRows ?? []).map((r) => [r.key as string, r.value]));
  const submissionsOpen = settings.get('submissions_open') === true;
  const maxIdeas = Number(settings.get('max_ideas_per_team') ?? 2);

  // Pair each slot's stored PS id back onto its submission row.
  const psBySlot = new Map<number, string>();
  for (const row of selections ?? []) {
    const ps = row.problem_statements as unknown as { ps_id: string } | null;
    if (ps?.ps_id) psBySlot.set(row.idea_slot as number, ps.ps_id);
  }

  const slots = Array.from({ length: maxIdeas }, (_, i) => i + 1);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Submit your idea</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Team {team.team_id_short} — {team.team_name}. You may enter up to {maxIdeas} ideas,
            each against a different problem statement.
          </p>
        </div>
        <span
          className={
            submissionsOpen
              ? 'badge bg-emerald-100 px-3 py-1 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
              : 'badge bg-slate-200 px-3 py-1 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
          }
        >
          Submissions {submissionsOpen ? 'open' : 'closed'}
        </span>
      </div>

      {!submissionsOpen && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          Submissions are not open yet. Anything already saved is shown below, read-only.
        </div>
      )}

      {slots.map((slot) => {
        const existing = (submissions ?? []).find((s) => s.idea_slot === slot);
        const takenPsIds = [...psBySlot.entries()]
          .filter(([otherSlot]) => otherSlot !== slot)
          .map(([, psId]) => psId);

        return (
          <SubmissionForm
            key={slot}
            teamId={team.id}
            slot={slot}
            submissionsOpen={submissionsOpen}
            problemStatements={(psRows ?? []) as ProblemStatement[]}
            takenPsIds={takenPsIds}
            existing={
              existing
                ? { ...existing, idea_slot: slot, ps_id: psBySlot.get(slot) ?? null }
                : null
            }
          />
        );
      })}
    </div>
  );
}
