import Link from 'next/link';
import { requireProfile, isAdminTier, isSpoc } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { formatEventDate } from '@/lib/utils';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Admin · PIEMR Hackathon' };

export default async function AdminDashboard() {
  const profile = await requireProfile();
  if (!isAdminTier(profile.role)) redirect('/dashboard');

  const supabase = createClient();

  const [teams, members, femaleMembers, settingsRows, ps] = await Promise.all([
    supabase.from('teams').select('id', { count: 'exact', head: true }),
    supabase.from('members').select('id', { count: 'exact', head: true }),
    supabase.from('members').select('id', { count: 'exact', head: true }).eq('gender', 'female'),
    supabase.from('settings').select('key, value'),
    supabase.from('problem_statements').select('id', { count: 'exact', head: true }),
  ]);

  const settings = new Map((settingsRows.data ?? []).map((r) => [r.key as string, r.value]));
  const registrationOpen = settings.get('registration_open') === true;

  const stats = [
    { label: 'Teams registered', value: teams.count ?? 0 },
    { label: 'Participants', value: members.count ?? 0 },
    { label: 'Female participants', value: femaleMembers.count ?? 0 },
    { label: 'Problem statements', value: ps.count ?? 0 },
  ];

  // Without at least one problem statement, the registration dropdown can
  // only offer "TBD" — worth flagging prominently to the SPOC.
  const needsProblemStatements = (ps.count ?? 0) === 0;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Event overview</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            {isSpoc(profile)
              ? 'You have operational access: accounts, problem statements and event settings.'
              : 'You have read access across every dashboard and the analytics module.'}
          </p>
        </div>

        <span
          className={
            registrationOpen
              ? 'badge bg-emerald-100 px-3 py-1 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
              : 'badge bg-slate-200 px-3 py-1 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
          }
        >
          Registration {registrationOpen ? 'open' : 'closed'}
        </span>
      </div>

      {needsProblemStatements && isSpoc(profile) && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm dark:border-amber-900 dark:bg-amber-950/40">
          <p className="font-semibold text-amber-900 dark:text-amber-100">
            No problem statements imported yet
          </p>
          <p className="mt-1 text-amber-800 dark:text-amber-200">
            Teams can register, but their problem statement choice can only be
            &ldquo;TBD&rdquo; until the list is imported.{' '}
            <Link href="/dashboard/admin/problem-statements" className="font-semibold underline">
              Import the list
            </Link>
          </p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="card">
            <p className="text-3xl font-black tracking-tight">{stat.value}</p>
            <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
              {stat.label}
            </p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="card lg:col-span-2">
          <h2 className="text-lg font-bold">Key dates</h2>
          <dl className="mt-4 grid gap-4 sm:grid-cols-2">
            {[
              ['Problem statements released', 'ps_release_date'],
              ['Submission deadline', 'submission_deadline'],
              ['Hackathon day', 'hackathon_date'],
              ['Results', 'results_date'],
            ].map(([label, key]) => (
              <div key={key}>
                <dt className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  {label}
                </dt>
                <dd className="mt-1 font-semibold">{formatEventDate(settings.get(key))}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link href="/dashboard/admin/analytics" className="btn-secondary">
              View analytics
            </Link>
            {isSpoc(profile) && (
              <>
                <Link href="/dashboard/admin/settings" className="btn-secondary">
                  Edit event settings
                </Link>
                <Link href="/dashboard/admin/problem-statements" className="btn-secondary">
                  Manage problem statements
                </Link>
              </>
            )}
          </div>
        </div>

        <div className="card">
          <h2 className="text-lg font-bold">Coming next</h2>
          <ul className="mt-3 space-y-2 text-sm text-slate-600 dark:text-slate-400">
            <li>Module 2 — idea and prototype submission forms</li>
            <li>Module 3 — judging against the marking rubric</li>
            <li>Module 4 — results publishing</li>
            <li>Module 5 — problem statements and analytics</li>
          </ul>
          <p className="mt-4 text-xs text-slate-500">
            The database schema for all four already exists, so no data migration is needed when
            they are switched on.
          </p>
        </div>
      </div>
    </div>
  );
}
