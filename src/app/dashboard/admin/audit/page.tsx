import { redirect } from 'next/navigation';
import { requireProfile, isAdminTier } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Audit log · PIEMR Hackathon' };

/**
 * Super-admin sees every action; an admin sees only their own. That split
 * is enforced by the two policies on audit_log, not by this query — the
 * same request simply returns different rows depending on who asks.
 */
export default async function AuditLogPage() {
  const profile = await requireProfile();
  if (!isAdminTier(profile.role)) redirect('/dashboard');

  const supabase = createClient();

  const { data: entries } = await supabase
    .from('audit_log')
    .select('id, actor_id, actor_role, action, target_table, target_id, metadata, created_at')
    .order('created_at', { ascending: false })
    .limit(200);

  const actorIds = [...new Set((entries ?? []).map((e) => e.actor_id).filter(Boolean))];
  const { data: actors } = actorIds.length
    ? await supabase.from('users').select('id, email, full_name').in('id', actorIds)
    : { data: [] };

  const actorById = new Map((actors ?? []).map((a) => [a.id as string, a]));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Audit log</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          {profile.role === 'super_admin'
            ? 'Every administrative action, most recent first.'
            : 'Your own administrative actions, most recent first.'}
        </p>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-xs uppercase tracking-wider text-slate-500">
            <tr>
              <th className="pb-3 pr-4">When</th>
              <th className="pb-3 pr-4">Actor</th>
              <th className="pb-3 pr-4">Action</th>
              <th className="pb-3 pr-4">Target</th>
              <th className="pb-3">Detail</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
            {(entries ?? []).map((entry) => {
              const actor = entry.actor_id ? actorById.get(entry.actor_id) : null;

              return (
                <tr key={entry.id}>
                  <td className="whitespace-nowrap py-2 pr-4 text-xs text-slate-500">
                    {new Date(entry.created_at).toLocaleString('en-IN')}
                  </td>
                  <td className="py-2 pr-4">
                    {actor?.full_name ?? actor?.email ?? '—'}
                    <span className="ml-2 text-xs text-slate-400">{entry.actor_role}</span>
                  </td>
                  <td className="py-2 pr-4 font-mono text-xs">{entry.action}</td>
                  <td className="py-2 pr-4 text-xs text-slate-500">
                    {entry.target_table ?? '—'}
                  </td>
                  <td className="py-2 text-xs text-slate-500">
                    {entry.metadata ? JSON.stringify(entry.metadata) : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {(entries ?? []).length === 0 && (
          <p className="py-6 text-center text-sm text-slate-500">No activity recorded yet.</p>
        )}
      </div>
    </div>
  );
}
