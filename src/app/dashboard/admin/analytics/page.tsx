import { redirect } from 'next/navigation';
import { requireProfile, isAdminTier } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import {
  distribution,
  genderSplit,
  incompleteTeams,
  psDecisionSplit,
  registrationsOverTime,
  type MemberRow,
  type TeamRow,
} from '@/lib/analytics';
import { RegistrationTrend, CategoryBars, GenderDonut } from '@/components/admin/AnalyticsCharts';
import { TEAM_SIZE } from '@/lib/constants';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Analytics · PIEMR Hackathon' };

/** Available to the full admin tier, which is where the Sr. Director spends
 *  most of their time. Coordinators are excluded — this is marks-adjacent. */
export default async function AnalyticsPage() {
  const profile = await requireProfile();
  if (!isAdminTier(profile.role)) redirect('/dashboard');

  const supabase = createClient();

  const [{ data: teams }, { data: members }] = await Promise.all([
    supabase.from('teams').select('id, created_at, status, registration_locked_at'),
    supabase.from('members').select('branch, year, gender, team_id, tentative_ps_id'),
  ]);

  const teamRows = (teams ?? []) as TeamRow[];
  const memberRows = (members ?? []) as MemberRow[];

  const trend = registrationsOverTime(teamRows);
  const branches = distribution(memberRows, (m) => m.branch);
  const years = distribution(memberRows, (m) => m.year);
  const genders = genderSplit(memberRows);
  const completeness = incompleteTeams(memberRows, teamRows.length, TEAM_SIZE);
  const psSplit = psDecisionSplit(memberRows);

  const femaleCount = genders.find((g) => g.name === 'Female')?.value ?? 0;
  const femaleShare = memberRows.length
    ? Math.round((femaleCount / memberRows.length) * 100)
    : 0;

  const headline = [
    { label: 'Teams', value: teamRows.length },
    { label: 'Participants', value: memberRows.length },
    { label: 'Female share', value: `${femaleShare}%` },
    { label: 'Locked teams', value: teamRows.filter((t) => t.registration_locked_at).length },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Registration health for the current round. Scoring analytics join this page once
          judging opens.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {headline.map((stat) => (
          <div key={stat.label} className="card">
            <p className="text-3xl font-black tracking-tight">{stat.value}</p>
            <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
              {stat.label}
            </p>
          </div>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <RegistrationTrend data={trend} />
        <GenderDonut data={genders} />
        <CategoryBars title="Branch distribution" subtitle="Participants per branch" data={branches} />
        <CategoryBars title="Year distribution" subtitle="Participants per year" data={years} />
      </div>

      <div className="card">
        <h3 className="text-sm font-bold">Data quality</h3>
        <p className="mt-0.5 text-xs text-slate-500">
          Worth checking before registration closes.
        </p>

        <dl className="mt-4 grid gap-4 sm:grid-cols-4">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Complete rosters
            </dt>
            <dd className="mt-1 text-2xl font-bold">{completeness.complete}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Wrong team size
            </dt>
            <dd
              className={
                completeness.short > 0
                  ? 'mt-1 text-2xl font-bold text-amber-600'
                  : 'mt-1 text-2xl font-bold'
              }
            >
              {completeness.short}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              PS chosen
            </dt>
            <dd className="mt-1 text-2xl font-bold">{psSplit.decided}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Still TBD
            </dt>
            <dd className="mt-1 text-2xl font-bold">{psSplit.tbd}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
