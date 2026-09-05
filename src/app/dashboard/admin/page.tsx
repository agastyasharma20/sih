import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireProfile, isAdminTier, isSpoc } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { formatEventDate } from '@/lib/utils';
import { incompleteTeams, psDecisionSplit, type MemberRow, type TeamRow } from '@/lib/analytics';
import { dailyVelocity, diversityCompliance, velocitySummary } from '@/lib/insights';
import { StatTile } from '@/components/admin/insights/StatTile';
import { Panel, Pill } from '@/components/admin/insights/Panel';
import { TEAM_SIZE } from '@/lib/constants';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Admin · PIEMR Hackathon' };

/**
 * The overview screen.
 *
 * It leads with what is wrong rather than with what exists: a SPOC
 * opening this page a week before the deadline needs the four teams
 * missing a female member before they need the headline count.
 */
export default async function AdminDashboard() {
  const profile = await requireProfile();
  if (!isAdminTier(profile.role)) redirect('/dashboard');

  const supabase = createClient();

  const [{ data: teams }, { data: members }, { data: settingsRows }, ps] = await Promise.all([
    supabase.from('teams').select('id, created_at, status, registration_locked_at, tentative_ps_id'),
    supabase.from('members').select('branch, year, gender, team_id'),
    supabase.from('settings').select('key, value'),
    supabase.from('problem_statements').select('id', { count: 'exact', head: true }),
  ]);

  const teamRows = (teams ?? []) as TeamRow[];
  const memberRows = (members ?? []) as MemberRow[];

  const settings = new Map((settingsRows ?? []).map((r) => [r.key as string, r.value]));
  const registrationOpen = settings.get('registration_open') === true;

  const pace = velocitySummary(dailyVelocity(teamRows));
  const trend = dailyVelocity(teamRows).map((point) => point.value);
  const diversity = diversityCompliance(memberRows);
  const completeness = incompleteTeams(memberRows, teamRows.length, TEAM_SIZE);
  const psSplit = psDecisionSplit(teamRows);
  const psCount = ps.count ?? 0;

  // Anything on this list stops a team entering SIH, so it belongs above
  // the fold rather than three clicks into analytics.
  const alerts: Array<{ tone: 'bad' | 'warn'; text: string; href: string; cta: string }> = [];

  if (psCount === 0 && isSpoc(profile)) {
    alerts.push({
      tone: 'warn',
      text: 'No problem statements imported, so every team can only choose “TBD”.',
      href: '/dashboard/admin/problem-statements',
      cta: 'Import the list',
    });
  }
  if (diversity.nonCompliant > 0) {
    alerts.push({
      tone: 'bad',
      text: `${diversity.nonCompliant} team${diversity.nonCompliant === 1 ? ' has' : 's have'} no female member — the national portal rejects those entries.`,
      href: '/dashboard/admin/teams',
      cta: 'Review rosters',
    });
  }
  if (completeness.short > 0) {
    alerts.push({
      tone: 'warn',
      text: `${completeness.short} team${completeness.short === 1 ? ' is' : 's are'} not exactly ${TEAM_SIZE} members.`,
      href: '/dashboard/admin/teams',
      cta: 'Review rosters',
    });
  }
  if (pace.quietStreak > 2 && registrationOpen) {
    alerts.push({
      tone: 'warn',
      text: `No registrations for ${pace.quietStreak} days while registration is still open.`,
      href: '/dashboard/admin/analytics',
      cta: 'See the trend',
    });
  }

  const stats = [
    {
      label: 'Teams registered',
      value: teamRows.length,
      note: `${pace.lastSeven} in the last 7 days`,
      trend,
    },
    {
      label: 'Participants',
      value: memberRows.length,
      note: `${completeness.complete} complete rosters`,
    },
    {
      label: 'Female share',
      value: diversity.femaleShare,
      suffix: '%',
      note: diversity.nonCompliant
        ? `${diversity.nonCompliant} team(s) non-compliant`
        : 'Every team compliant',
      tone: diversity.nonCompliant ? ('bad' as const) : ('good' as const),
    },
    {
      label: 'Problem statements',
      value: psCount,
      note: psSplit.tbd ? `${psSplit.tbd} team(s) still TBD` : 'All teams have chosen',
      tone: psCount === 0 ? ('warn' as const) : ('neutral' as const),
    },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            <span className="gradient-text">Event overview</span>
          </h1>
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

      {alerts.length > 0 && (
        <Panel
          title="Needs attention"
          subtitle="Each of these blocks a team from entering SIH if it is still true at the deadline"
          badge={<Pill tone={alerts.some((a) => a.tone === 'bad') ? 'bad' : 'warn'}>{alerts.length}</Pill>}
        >
          <ul className="space-y-3">
            {alerts.map((alert) => (
              <li
                key={alert.text}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 px-4 py-3 text-sm dark:border-slate-800"
              >
                <span className="flex items-center gap-2.5">
                  <span
                    className={`h-2 w-2 shrink-0 rounded-full ${alert.tone === 'bad' ? 'bg-rose-500' : 'bg-amber-500'}`}
                  />
                  {alert.text}
                </span>
                <Link href={alert.href} className="shrink-0 text-xs font-semibold underline">
                  {alert.cta}
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat, index) => (
          <StatTile
            key={stat.label}
            label={stat.label}
            value={stat.value}
            suffix={stat.suffix}
            note={stat.note}
            tone={stat.tone}
            trend={stat.trend}
            delay={index * 0.05}
          />
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="card card-glow lg:col-span-2">
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
            <Link href="/dashboard/admin/analytics" className="btn-primary py-2 text-xs">
              Open analytics
            </Link>
            <a href="/api/admin/teams/export" className="btn-secondary py-2 text-xs">
              Export roster
            </a>
            {isSpoc(profile) && (
              <>
                <Link href="/dashboard/admin/settings" className="btn-secondary py-2 text-xs">
                  Event settings
                </Link>
                <Link href="/dashboard/admin/problem-statements" className="btn-secondary py-2 text-xs">
                  Problem statements
                </Link>
              </>
            )}
          </div>
        </div>

        <div className="card card-glow">
          <h2 className="text-lg font-bold">Registration pace</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-slate-500">Busiest day</dt>
              <dd className="font-semibold">
                {pace.peakDay ? `${pace.peakDay} · ${pace.peakCount}` : '—'}
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-slate-500">Average per day</dt>
              <dd className="font-semibold tabular-nums">{pace.averagePerDay}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-slate-500">Last 7 days</dt>
              <dd className="font-semibold tabular-nums">{pace.lastSeven}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-slate-500">Quiet streak</dt>
              <dd className="font-semibold tabular-nums">
                {pace.quietStreak} day{pace.quietStreak === 1 ? '' : 's'}
              </dd>
            </div>
          </dl>
          <p className="mt-4 text-xs text-slate-500">
            Days are counted in IST, so &ldquo;today&rdquo; means today on campus.
          </p>
        </div>
      </div>
    </div>
  );
}
