import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { Download } from 'lucide-react';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Team roster · PIEMR Hackathon' };

/**
 * Documentation role. Roster data only — judge scores are absent from this
 * page and, more importantly, from every query this account is permitted
 * to run. The scores table has no policy granting coordinators access, so
 * hitting the API directly returns nothing either.
 */
export default async function CoordinatorDashboard() {
  await requireRole('coordinator');
  const supabase = createClient();

  const { data: teams } = await supabase
    .from('teams')
    .select(
      `id, team_id_short, team_name, status,
       members ( full_name, branch, year, enrollment_number, email, phone, is_lead )`,
    )
    .order('team_id_short');

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Team roster</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Contact details and selection status for documentation. Judge scores are not part of
            this view.
          </p>
        </div>
        <a href="/api/admin/teams/export" className="btn-secondary py-1.5 text-xs">
          <Download className="h-3.5 w-3.5" />
          Export roster (CSV)
        </a>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-xs uppercase tracking-wider text-slate-500">
            <tr>
              <th className="pb-3 pr-4">Team ID</th>
              <th className="pb-3 pr-4">Team</th>
              <th className="pb-3 pr-4">Lead</th>
              <th className="pb-3 pr-4">Lead email</th>
              <th className="pb-3 pr-4">Lead phone</th>
              <th className="pb-3 pr-4">Members</th>
              <th className="pb-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
            {(teams ?? []).map((team) => {
              const members = (team.members ?? []) as Array<Record<string, string | boolean>>;
              const lead = members.find((m) => m.is_lead);

              return (
                <tr key={team.id}>
                  <td className="py-3 pr-4 font-mono font-bold">{team.team_id_short}</td>
                  <td className="py-3 pr-4 font-medium">{team.team_name}</td>
                  <td className="py-3 pr-4">{lead ? String(lead.full_name) : '—'}</td>
                  <td className="py-3 pr-4">{lead ? String(lead.email) : '—'}</td>
                  <td className="py-3 pr-4">{lead ? String(lead.phone) : '—'}</td>
                  <td className="py-3 pr-4">{members.length}</td>
                  <td className="py-3 capitalize">{team.status}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {(teams ?? []).length === 0 && (
          <p className="py-6 text-center text-sm text-slate-500">No teams registered yet.</p>
        )}
      </div>
    </div>
  );
}
