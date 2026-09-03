import { redirect } from 'next/navigation';
import { requireProfile, isAdminTier } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Teams · PIEMR Hackathon' };

export default async function AdminTeamsPage() {
  const profile = await requireProfile();
  if (!isAdminTier(profile.role)) redirect('/dashboard');

  const supabase = createClient();

  const { data: teams } = await supabase
    .from('teams')
    .select(
      `id, team_id_short, team_name, status, registration_locked_at, created_at,
       members ( full_name, gender, branch, year, enrollment_number, email, phone, is_lead ),
       mentors ( type, full_name, email )`,
    )
    .order('team_id_short');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Registered teams</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          {teams?.length ?? 0} team{(teams?.length ?? 0) === 1 ? '' : 's'} registered.
        </p>
      </div>

      {(teams ?? []).length === 0 ? (
        <div className="card">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            No teams have registered yet.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {(teams ?? []).map((team) => {
            const members = (team.members ?? []) as Array<Record<string, string | boolean>>;
            const femaleCount = members.filter((m) => m.gender === 'female').length;
            const primary = (team.mentors ?? []).find(
              (m: { type: string }) => m.type === 'primary',
            );

            return (
              <details key={team.id} className="card group">
                <summary className="flex cursor-pointer flex-wrap items-center gap-4 list-none">
                  <span className="rounded-lg bg-piemr-600 px-3 py-1.5 font-mono text-sm font-bold text-white">
                    {team.team_id_short}
                  </span>
                  <span className="font-semibold">{team.team_name}</span>
                  <span className="badge bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                    {members.length} members
                  </span>
                  <span className="badge bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                    {femaleCount} female
                  </span>
                  <span className="badge bg-slate-100 capitalize text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                    {team.status}
                  </span>
                  {team.registration_locked_at && (
                    <span className="badge bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                      Locked
                    </span>
                  )}
                </summary>

                <div className="mt-5 overflow-x-auto border-t border-slate-200 pt-4 dark:border-slate-800">
                  <table className="w-full text-left text-sm">
                    <thead className="text-xs uppercase tracking-wider text-slate-500">
                      <tr>
                        <th className="pb-2 pr-4">Name</th>
                        <th className="pb-2 pr-4">Enrollment</th>
                        <th className="pb-2 pr-4">Branch</th>
                        <th className="pb-2 pr-4">Year</th>
                        <th className="pb-2 pr-4">Email</th>
                        <th className="pb-2">Phone</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                      {members.map((m) => (
                        <tr key={String(m.enrollment_number)}>
                          <td className="py-2 pr-4 font-medium">
                            {String(m.full_name)}
                            {m.is_lead && (
                              <span className="ml-2 badge bg-amber-100 text-amber-800">Lead</span>
                            )}
                          </td>
                          <td className="py-2 pr-4">{String(m.enrollment_number)}</td>
                          <td className="py-2 pr-4">{String(m.branch)}</td>
                          <td className="py-2 pr-4">{String(m.year)}</td>
                          <td className="py-2 pr-4">{String(m.email)}</td>
                          <td className="py-2">{String(m.phone)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {primary && (
                    <p className="mt-4 text-sm text-slate-600 dark:text-slate-400">
                      Primary mentor: <strong>{primary.full_name}</strong> ({primary.email})
                    </p>
                  )}
                </div>
              </details>
            );
          })}
        </div>
      )}
    </div>
  );
}
