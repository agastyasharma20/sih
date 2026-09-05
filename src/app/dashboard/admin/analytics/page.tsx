import { redirect } from 'next/navigation';
import Link from 'next/link';
import { requireProfile, isAdminTier } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import {
  distribution,
  genderSplit,
  incompleteTeams,
  psDecisionSplit,
  psPopularity,
  psCategorySplit,
  psThemeDemand,
  psCatalogueSummary,
  type MemberRow,
  type TeamRow,
  type PsRow,
} from '@/lib/analytics';
import {
  auditActivity,
  criterionAverages,
  crossTab,
  dailyVelocity,
  diversityCompliance,
  judgeCalibration,
  judgingProgress,
  organisationDemand,
  pipeline,
  psConcentration,
  registrationHeatmap,
  scoreHistogram,
  submissionTotals,
  teamSizeDistribution,
  velocitySummary,
  WEEKDAYS,
  type AuditRow,
  type CriterionRow,
  type ScoreRow,
} from '@/lib/insights';
import { PsDemandTable } from '@/components/admin/PsDemandTable';
import {
  RegistrationTrend,
  CategoryBars,
  GenderDonut,
  CategoryDonut,
  VelocityChart,
  CriterionRadar,
  ScoreHistogram,
} from '@/components/admin/ChartsLazy';
import { Tabs } from '@/components/admin/insights/Tabs';
import { StatTile } from '@/components/admin/insights/StatTile';
import { Panel, Pill, Empty } from '@/components/admin/insights/Panel';
import { ActivityHeatmap } from '@/components/admin/insights/Heatmap';
import { Funnel } from '@/components/admin/insights/Funnel';
import { Matrix } from '@/components/admin/insights/Matrix';
import { TEAM_SIZE } from '@/lib/constants';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Analytics · PIEMR Hackathon' };

const YEAR_ORDER = ['1st', '2nd', '3rd', '4th'];

/**
 * The analytics module.
 *
 * Everything on this page comes from nine queries taken in parallel and
 * then aggregated in memory by pure functions, so adding a panel costs
 * nothing at the database. Row-level security does the access control:
 * the same audit query returns every action to a super-admin and only
 * the caller's own actions to an admin, with no branch in this file —
 * which is what keeps the hidden tier hidden.
 *
 * Coordinators are excluded outright: this page is marks-adjacent.
 */
export default async function AnalyticsPage() {
  const profile = await requireProfile();
  if (!isAdminTier(profile.role)) redirect('/dashboard');

  const supabase = createClient();

  const [
    { data: teams },
    { data: members },
    { data: statements },
    { data: submissions },
    { data: scores },
    { data: criteria },
    { data: results },
    { data: staff },
    { data: audit },
    { data: mentors },
  ] = await Promise.all([
    supabase
      .from('teams')
      .select('id, created_at, status, registration_locked_at, tentative_ps_id'),
    supabase.from('members').select('branch, year, gender, team_id'),
    supabase
      .from('problem_statements')
      .select('id, ps_id, title, category, theme, organisation, is_active'),
    supabase.from('submissions').select('id, team_id, submitted_at'),
    supabase.from('scores').select('submission_id, judge_id, criterion_id, marks_given'),
    supabase.from('marking_criteria').select('id, name, max_marks, display_order, is_active'),
    supabase.from('results').select('team_id, final_verdict, is_published'),
    supabase.from('users').select('id, full_name, email, role, is_active'),
    // Ordered, because the panel calls this "the most recent 1000" — an
    // unordered limit would give an arbitrary thousand and say otherwise.
    supabase
      .from('audit_log')
      .select('action, actor_id, created_at')
      .order('created_at', { ascending: false })
      .limit(1000),
    supabase.from('mentors').select('team_id, type'),
  ]);

  const teamRows = (teams ?? []) as TeamRow[];
  const memberRows = (members ?? []) as MemberRow[];
  const psRows = (statements ?? []) as PsRow[];
  const submissionRows = (submissions ?? []) as Array<{
    id: string;
    team_id: string;
    submitted_at: string | null;
  }>;
  const scoreRows = (scores ?? []) as ScoreRow[];
  const activeCriteria = ((criteria ?? []) as Array<CriterionRow & { is_active: boolean }>).filter(
    (row) => row.is_active,
  );
  const resultRows = (results ?? []) as Array<{ final_verdict: string | null; is_published: boolean }>;
  const staffRows = (staff ?? []) as Array<{
    id: string;
    full_name: string | null;
    email: string;
    role: string;
    is_active: boolean;
  }>;
  const auditRows = (audit ?? []) as AuditRow[];
  const mentorRows = (mentors ?? []) as Array<{ team_id: string; type: string }>;

  /* ------------------------------------------------------------ derived */

  const velocity = dailyVelocity(teamRows);
  const pace = velocitySummary(velocity);
  const heatmap = registrationHeatmap(teamRows);

  const branches = distribution(memberRows, (m) => m.branch);
  const years = distribution(memberRows, (m) => m.year);
  const genders = genderSplit(memberRows);
  const diversity = diversityCompliance(memberRows);
  const sizes = teamSizeDistribution(memberRows, TEAM_SIZE);
  const branchByYear = crossTab(memberRows, (m) => m.branch, (m) => m.year, YEAR_ORDER);
  const completeness = incompleteTeams(memberRows, teamRows.length, TEAM_SIZE);

  const psSplit = psDecisionSplit(teamRows);
  const catalogue = psCatalogueSummary(psRows);
  const demand = psPopularity(psRows, teamRows);
  const psCategories = psCategorySplit(psRows, teamRows);
  const themes = psThemeDemand(psRows, teamRows);
  const organisations = organisationDemand(psRows, teamRows);
  const concentration = psConcentration(demand);
  const untaken = demand.filter((row) => row.teams === 0).length;

  const submittedTeamIds = submissionRows.filter((s) => s.submitted_at).map((s) => s.team_id);
  const scoredSubmissionIds = new Set(scoreRows.map((s) => s.submission_id));
  const submissionTeam = new Map(submissionRows.map((s) => [s.id, s.team_id]));
  const scoredTeamIds = [...scoredSubmissionIds]
    .map((id) => submissionTeam.get(id))
    .filter((id): id is string => Boolean(id));

  const funnel = pipeline({
    teams: teamRows,
    members: memberRows,
    submittedTeamIds,
    scoredTeamIds,
    teamSize: TEAM_SIZE,
  });

  const criteriaStats = criterionAverages(scoreRows, activeCriteria);
  const ceiling = activeCriteria.reduce((sum, c) => sum + Number(c.max_marks), 0);
  const totals = submissionTotals(scoreRows);
  const histogram = scoreHistogram([...totals.values()], ceiling || 100);
  const judges = staffRows.filter((row) => row.role === 'judge');
  const calibration = judgeCalibration(scoreRows, judges);
  const progress = judgingProgress(
    submissionRows.filter((s) => s.submitted_at).map((s) => s.id),
    scoreRows,
    activeCriteria.length,
  );
  const verdicts = distribution(
    resultRows.filter((row) => row.final_verdict),
    (row) => row.final_verdict as string,
  );

  const activity = auditActivity(
    auditRows,
    new Map(staffRows.map((row) => [row.id, row.full_name || row.email])),
  );
  const accountsByRole = distribution(
    staffRows.filter((row) => row.is_active),
    (row) => row.role,
  );
  const teamsWithPrimaryMentor = new Set(
    mentorRows.filter((m) => m.type === 'primary').map((m) => m.team_id),
  ).size;

  /* ------------------------------------------------------------- alerts */

  // Counted per tab so the badge tells the reader where the problems are
  // before they click.
  const participantAlerts = diversity.nonCompliant + completeness.short;
  const psAlerts = psSplit.tbd + concentration.crowded.length;
  const opsAlerts =
    (catalogue.active === 0 ? 1 : 0) + Math.max(0, teamRows.length - teamsWithPrimaryMentor);

  const headline = [
    { label: 'Teams', value: teamRows.length, note: `${pace.lastSeven} in the last 7 days` },
    { label: 'Participants', value: memberRows.length, note: `${sizes.length} distinct team sizes` },
    {
      label: 'Female share',
      value: diversity.femaleShare,
      suffix: '%',
      note: diversity.nonCompliant
        ? `${diversity.nonCompliant} team(s) with no woman`
        : 'Every team compliant',
      tone: diversity.nonCompliant ? ('bad' as const) : ('good' as const),
    },
    {
      label: 'Full rosters',
      value: completeness.complete,
      note: completeness.short ? `${completeness.short} wrong size` : 'All rosters correct',
      tone: completeness.short ? ('warn' as const) : ('good' as const),
    },
    {
      label: 'PS chosen',
      value: psSplit.decided,
      note: psSplit.tbd ? `${psSplit.tbd} still TBD` : 'Nothing outstanding',
      tone: psSplit.tbd ? ('warn' as const) : ('good' as const),
    },
    {
      label: 'Locked',
      value: teamRows.filter((t) => t.registration_locked_at).length,
      note: 'Registration frozen',
    },
  ];

  const trendValues = velocity.map((point) => point.value);

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            <span className="gradient-text">Analytics</span>
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-600 dark:text-slate-400">
            Registration health, problem-statement demand and judging fairness — all computed
            live from the same rows the dashboards read.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-2 text-xs font-medium text-slate-500">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-500 animate-pulse-ring" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            Live
          </span>
          <a href="/api/admin/analytics/export" className="btn-secondary py-1.5 text-xs">
            Export snapshot
          </a>
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {headline.map((stat, index) => (
          <StatTile
            key={stat.label}
            label={stat.label}
            value={stat.value}
            suffix={stat.suffix}
            note={stat.note}
            tone={stat.tone}
            delay={index * 0.04}
            trend={index === 0 ? trendValues : undefined}
          />
        ))}
      </div>

      <Tabs
        sections={[
          {
            id: 'pulse',
            label: 'Pulse',
            content: (
              <div className="space-y-5">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <StatTile
                    label="Busiest day"
                    value={pace.peakDay ?? '—'}
                    note={pace.peakCount ? `${pace.peakCount} teams that day` : 'No data yet'}
                  />
                  <StatTile
                    label="Average per day"
                    value={pace.averagePerDay}
                    note={`${pace.activeDays} of ${pace.spanDays} days had a registration`}
                  />
                  <StatTile
                    label="Last 7 days"
                    value={pace.lastSeven}
                    note={pace.lastSeven ? 'Still arriving' : 'Nothing this week'}
                    tone={pace.lastSeven ? 'good' : 'warn'}
                  />
                  <StatTile
                    label="Quiet streak"
                    value={pace.quietStreak}
                    suffix={pace.quietStreak === 1 ? ' day' : ' days'}
                    note={pace.quietStreak > 2 ? 'Worth a reminder mail' : 'Healthy'}
                    tone={pace.quietStreak > 2 ? 'warn' : 'good'}
                  />
                </div>

                <div className="grid gap-5 lg:grid-cols-2">
                  <VelocityChart data={velocity} />
                  <RegistrationTrend data={velocity} />
                </div>

                <Panel
                  title="When teams register"
                  subtitle="Weekday against hour of day, so reminders land when they are read"
                  badge={<Pill tone="neutral">{heatmap.total} teams</Pill>}
                >
                  <ActivityHeatmap data={heatmap} />
                </Panel>

                <Panel
                  title="Event pipeline"
                  subtitle="Where teams stop — the gap between two stages is the number to act on"
                >
                  <Funnel stages={funnel} />
                </Panel>
              </div>
            ),
          },
          {
            id: 'participants',
            label: 'Participants',
            badge: participantAlerts,
            content: (
              <div className="space-y-5">
                <Panel
                  title="SIH eligibility check"
                  subtitle="Every team needs at least one female member and exactly six members"
                  badge={
                    diversity.nonCompliant + completeness.short === 0 ? (
                      <Pill tone="good">All clear</Pill>
                    ) : (
                      <Pill tone="bad">
                        {diversity.nonCompliant + completeness.short} to fix
                      </Pill>
                    )
                  }
                >
                  <dl className="grid gap-4 sm:grid-cols-4">
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Compliant teams
                      </dt>
                      <dd className="mt-1 text-2xl font-bold">{diversity.compliant}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                        No female member
                      </dt>
                      <dd
                        className={`mt-1 text-2xl font-bold ${diversity.nonCompliant ? 'text-rose-600 dark:text-rose-400' : ''}`}
                      >
                        {diversity.nonCompliant}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Wrong team size
                      </dt>
                      <dd
                        className={`mt-1 text-2xl font-bold ${completeness.short ? 'text-amber-600 dark:text-amber-400' : ''}`}
                      >
                        {completeness.short}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Two or more women
                      </dt>
                      <dd className="mt-1 text-2xl font-bold">{diversity.teamsWithMultipleWomen}</dd>
                    </div>
                  </dl>

                  {diversity.nonCompliant > 0 && (
                    <p className="mt-4 text-xs text-slate-500">
                      A team without a woman is rejected at the national portal, not here.{' '}
                      <Link href="/dashboard/admin/teams" className="font-semibold underline">
                        Open the team list
                      </Link>{' '}
                      to fix the rosters before registration closes.
                    </p>
                  )}
                </Panel>

                <div className="grid gap-5 lg:grid-cols-2">
                  <GenderDonut data={genders} />
                  <CategoryBars
                    title="Team size distribution"
                    subtitle={`Teams per roster size — ${TEAM_SIZE} is the target`}
                    data={sizes}
                  />
                  <CategoryBars
                    title="Branch distribution"
                    subtitle="Participants per branch"
                    data={branches}
                  />
                  <CategoryBars
                    title="Year distribution"
                    subtitle="Participants per year"
                    data={years}
                  />
                </div>

                <Panel
                  title="Branch against year"
                  subtitle="Where the cohort actually sits — a branch that is all final-years will not return next season"
                >
                  <Matrix data={branchByYear} />
                </Panel>
              </div>
            ),
          },
          {
            id: 'problem-statements',
            label: 'Problem statements',
            badge: psAlerts,
            content: (
              <div className="space-y-5">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <StatTile label="Active catalogue" value={catalogue.active} note={`${catalogue.retired} retired`} />
                  <StatTile
                    label="Distinct picks"
                    value={concentration.distinctChosen}
                    note={`${untaken} statements with no team`}
                    tone={untaken > catalogue.active * 0.9 ? 'warn' : 'neutral'}
                  />
                  <StatTile
                    label="Top 5 share"
                    value={concentration.topShare}
                    suffix="%"
                    note={concentration.topShare > 60 ? 'Very concentrated' : 'Reasonably spread'}
                    tone={concentration.topShare > 60 ? 'warn' : 'good'}
                  />
                  <StatTile
                    label="Still TBD"
                    value={psSplit.tbd}
                    note={psSplit.tbd ? 'Teams yet to decide' : 'Everyone has chosen'}
                    tone={psSplit.tbd ? 'warn' : 'good'}
                  />
                </div>

                <Panel
                  title="Catalogue"
                  subtitle={
                    catalogue.active > 0
                      ? `${catalogue.active} active — ${catalogue.software} software, ${catalogue.hardware} hardware, across ${catalogue.themes} theme${catalogue.themes === 1 ? '' : 's'}.`
                      : 'No problem statements imported yet, so teams can only choose TBD.'
                  }
                  badge={
                    concentration.crowded.length > 0 ? (
                      <Pill tone="warn">{concentration.crowded.length} crowded</Pill>
                    ) : (
                      <Pill tone="good">Well spread</Pill>
                    )
                  }
                >
                  {concentration.crowded.length === 0 ? (
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      No statement is drawing more than twice the average number of teams. The
                      internal round will still discriminate between entries.
                    </p>
                  ) : (
                    <>
                      <p className="text-sm text-slate-600 dark:text-slate-400">
                        These statements draw more than double the average. Teams clustered on one
                        statement compete against each other rather than the field —
                        worth steering some of them elsewhere.
                      </p>
                      <ul className="mt-3 space-y-2">
                        {concentration.crowded.map((row) => (
                          <li key={row.ps_id} className="flex items-baseline justify-between gap-3 text-sm">
                            <span className="min-w-0">
                              <span className="font-mono text-xs font-semibold">{row.ps_id}</span>{' '}
                              <span className="text-slate-600 dark:text-slate-400">{row.title}</span>
                            </span>
                            <span className="shrink-0 font-bold tabular-nums">{row.teams}</span>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                  <p className="mt-4 text-xs text-slate-500">
                    Concentration index {concentration.hhi.toFixed(3)} — 0 is perfectly spread, 1 is
                    every team on one statement.
                  </p>
                </Panel>

                <div className="grid gap-5 lg:grid-cols-2">
                  <CategoryDonut
                    title="Software vs hardware"
                    subtitle="What teams have chosen, not what the catalogue holds"
                    data={psCategories}
                  />
                  <CategoryBars title="Theme demand" subtitle="Teams per theme" data={themes} />
                </div>

                {organisations.length > 0 && (
                  <CategoryBars
                    title="Sponsoring organisation"
                    subtitle="Teams per ministry or department"
                    data={organisations.slice(0, 12)}
                  />
                )}

                <PsDemandTable rows={demand} untaken={untaken} />
              </div>
            ),
          },
          {
            id: 'judging',
            label: 'Judging',
            content: (
              <div className="space-y-5">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <StatTile label="Submissions" value={progress.submissions} note="Ideas submitted" />
                  <StatTile
                    label="Fully scored"
                    value={progress.complete}
                    note={`${progress.coverage}% coverage`}
                    tone={progress.coverage === 100 ? 'good' : 'warn'}
                  />
                  <StatTile
                    label="Part-scored"
                    value={Math.max(0, progress.started - progress.complete)}
                    note="Started but missing criteria"
                    tone={progress.started > progress.complete ? 'warn' : 'good'}
                  />
                  <StatTile
                    label="Rubric total"
                    value={ceiling}
                    note={`${activeCriteria.length} active criteria`}
                  />
                </div>

                {scoreRows.length === 0 ? (
                  <Panel title="Judging has not started" subtitle="These panels fill in as marks arrive">
                    <Empty>
                      No marks recorded yet. Criterion utilisation, the score distribution and judge
                      calibration all appear here the moment the first judge saves a score.
                    </Empty>
                  </Panel>
                ) : (
                  <>
                    <div className="grid gap-5 lg:grid-cols-2">
                      <CriterionRadar data={criteriaStats} />
                      <ScoreHistogram
                        data={histogram}
                        title="Score distribution"
                        subtitle={`Averaged team totals out of ${ceiling || 100}`}
                      />
                    </div>

                    <Panel
                      title="Criterion detail"
                      subtitle="A criterion nobody scores above half is badly written or badly briefed"
                    >
                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[420px] text-left text-sm">
                          <thead className="text-xs uppercase tracking-wider text-slate-500">
                            <tr>
                              <th className="pb-2 pr-3">Criterion</th>
                              <th className="pb-2 pr-3">Average</th>
                              <th className="pb-2 pr-3">Max</th>
                              <th className="pb-2">Utilisation</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                            {criteriaStats.map((row) => (
                              <tr key={row.name}>
                                <td className="py-2 pr-3 font-medium">{row.name}</td>
                                <td className="py-2 pr-3 tabular-nums">{row.average}</td>
                                <td className="py-2 pr-3 tabular-nums text-slate-500">{row.max}</td>
                                <td className="py-2">
                                  <div className="flex items-center gap-2">
                                    <div className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                                      <div
                                        className="h-full rounded-full bg-piemr-500"
                                        style={{ width: `${Math.min(100, row.utilisation)}%` }}
                                      />
                                    </div>
                                    <span className="tabular-nums text-xs font-semibold">
                                      {row.utilisation}%
                                    </span>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </Panel>

                    <Panel
                      title="Judge calibration"
                      subtitle="Two judges marking the same field twenty points apart is a fairness problem no leaderboard shows"
                      badge={
                        calibration.some((row) => Math.abs(row.bias) > ceiling * 0.1) ? (
                          <Pill tone="warn">Wide spread</Pill>
                        ) : (
                          <Pill tone="good">Consistent</Pill>
                        )
                      }
                    >
                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[460px] text-left text-sm">
                          <thead className="text-xs uppercase tracking-wider text-slate-500">
                            <tr>
                              <th className="pb-2 pr-3">Judge</th>
                              <th className="pb-2 pr-3">Scored</th>
                              <th className="pb-2 pr-3">Mean</th>
                              <th className="pb-2 pr-3">Spread</th>
                              <th className="pb-2">Bias</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                            {calibration.map((row) => (
                              <tr key={row.judgeId}>
                                <td className="py-2 pr-3 font-medium">{row.name}</td>
                                <td className="py-2 pr-3 tabular-nums text-slate-500">
                                  {row.submissions}
                                </td>
                                <td className="py-2 pr-3 tabular-nums">{row.mean}</td>
                                <td className="py-2 pr-3 tabular-nums text-slate-500">
                                  ±{row.spread}
                                </td>
                                <td
                                  className={`py-2 tabular-nums font-semibold ${
                                    row.bias > 0
                                      ? 'text-amber-600 dark:text-amber-400'
                                      : row.bias < 0
                                        ? 'text-piemr-600 dark:text-piemr-400'
                                        : 'text-slate-500'
                                  }`}
                                >
                                  {row.bias > 0 ? '+' : ''}
                                  {row.bias}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <p className="mt-3 text-xs text-slate-500">
                        Bias is a judge&rsquo;s mean minus the panel&rsquo;s. Positive is lenient,
                        negative is harsh; spread is how much they separate teams from each other.
                      </p>
                    </Panel>
                  </>
                )}

                {verdicts.length > 0 && (
                  <CategoryBars title="Verdicts" subtitle="Recorded results by outcome" data={verdicts} />
                )}
              </div>
            ),
          },
          {
            id: 'operations',
            label: 'Operations',
            badge: opsAlerts,
            content: (
              <div className="space-y-5">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <StatTile
                    label="Primary mentors"
                    value={teamsWithPrimaryMentor}
                    note={
                      teamRows.length - teamsWithPrimaryMentor > 0
                        ? `${teamRows.length - teamsWithPrimaryMentor} team(s) without one`
                        : 'Every team covered'
                    }
                    tone={teamRows.length - teamsWithPrimaryMentor > 0 ? 'warn' : 'good'}
                  />
                  <StatTile
                    label="Active accounts"
                    value={staffRows.filter((row) => row.is_active).length}
                    note={`${staffRows.filter((row) => !row.is_active).length} disabled`}
                  />
                  <StatTile label="Logged actions" value={activity.total} note="Most recent 1000" />
                  <StatTile
                    label="Active actors"
                    value={activity.activeActors}
                    note="Accounts that changed something"
                  />
                </div>

                <div className="grid gap-5 lg:grid-cols-2">
                  <Panel
                    title="Administrative activity"
                    subtitle={
                      profile.role === 'super_admin'
                        ? 'Every action recorded, by type'
                        : 'Your own actions, by type'
                    }
                  >
                    {activity.byAction.length === 0 ? (
                      <Empty>Nothing has been recorded yet.</Empty>
                    ) : (
                      <ul className="space-y-2">
                        {activity.byAction.slice(0, 10).map((row) => (
                          <li key={row.name} className="flex items-center gap-3 text-sm">
                            <span className="w-44 shrink-0 truncate font-mono text-xs">
                              {row.name}
                            </span>
                            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                              <div
                                className="h-full rounded-full bg-piemr-500"
                                style={{
                                  width: `${(row.value / activity.byAction[0].value) * 100}%`,
                                }}
                              />
                            </div>
                            <span className="w-8 shrink-0 text-right tabular-nums text-xs font-semibold">
                              {row.value}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                    <p className="mt-4 text-xs text-slate-500">
                      <Link href="/dashboard/admin/audit" className="font-semibold underline">
                        Open the full audit log
                      </Link>
                    </p>
                  </Panel>

                  <Panel title="Busiest accounts" subtitle="Who has been making the changes">
                    {activity.byActor.length === 0 ? (
                      <Empty>No account has made a recorded change yet.</Empty>
                    ) : (
                      <ul className="space-y-2">
                        {activity.byActor.map((row) => (
                          <li key={row.name} className="flex items-center gap-3 text-sm">
                            <span className="w-44 shrink-0 truncate">{row.name}</span>
                            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                              <div
                                className="h-full rounded-full bg-sih-saffron"
                                style={{
                                  width: `${(row.value / activity.byActor[0].value) * 100}%`,
                                }}
                              />
                            </div>
                            <span className="w-8 shrink-0 text-right tabular-nums text-xs font-semibold">
                              {row.value}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </Panel>
                </div>

                <div className="grid gap-5 lg:grid-cols-2">
                  <CategoryBars
                    title="Accounts by role"
                    subtitle="Active accounts only"
                    data={accountsByRole}
                  />
                  <Panel
                    title="Data quality"
                    subtitle="Worth clearing before registration closes"
                  >
                    <dl className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <dt className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                          Teams with no member rows
                        </dt>
                        <dd className="mt-1 text-2xl font-bold">{Math.max(0, completeness.missing)}</dd>
                      </div>
                      <div>
                        <dt className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                          Registrations without a PS
                        </dt>
                        <dd className="mt-1 text-2xl font-bold">{psSplit.tbd}</dd>
                      </div>
                      <div>
                        <dt className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                          Busiest weekday
                        </dt>
                        <dd className="mt-1 text-lg font-bold">
                          {heatmap.busiestWeekday === null ? '—' : WEEKDAYS[heatmap.busiestWeekday]}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                          Catalogue imported
                        </dt>
                        <dd className="mt-1 text-lg font-bold">
                          {catalogue.active > 0 ? 'Yes' : 'Not yet'}
                        </dd>
                      </div>
                    </dl>
                  </Panel>
                </div>
              </div>
            ),
          },
        ]}
      />
    </div>
  );
}
