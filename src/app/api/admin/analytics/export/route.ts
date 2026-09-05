import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSessionProfile, isAdminTier } from '@/lib/auth';
import { toCsv } from '@/lib/csv';
import {
  distribution,
  genderSplit,
  incompleteTeams,
  psDecisionSplit,
  psPopularity,
  type MemberRow,
  type PsRow,
  type TeamRow,
} from '@/lib/analytics';
import {
  dailyVelocity,
  diversityCompliance,
  pipeline,
  psConcentration,
  velocitySummary,
} from '@/lib/insights';
import { TEAM_SIZE } from '@/lib/constants';

export const dynamic = 'force-dynamic';

/**
 * A snapshot of the analytics page as CSV, for the review meeting that
 * inevitably happens in a spreadsheet.
 *
 * One long metric/value/detail table rather than a wide one: the figures
 * come from a dozen different aggregations with no shared key, and
 * forcing them into columns would only invent a relationship between
 * them that does not exist.
 *
 * Coordinators are excluded, exactly as they are from the page.
 */
export async function GET() {
  const profile = await getSessionProfile();

  if (!profile || !isAdminTier(profile.role)) {
    return NextResponse.json({ ok: false, message: 'Not permitted.' }, { status: 403 });
  }

  const supabase = createClient();

  const [{ data: teams }, { data: members }, { data: statements }, { data: submissions }] =
    await Promise.all([
      supabase
        .from('teams')
        .select('id, created_at, status, registration_locked_at, tentative_ps_id'),
      supabase.from('members').select('branch, year, gender, team_id'),
      supabase
        .from('problem_statements')
        .select('id, ps_id, title, category, theme, organisation, is_active'),
      supabase.from('submissions').select('team_id, submitted_at'),
    ]);

  const teamRows = (teams ?? []) as TeamRow[];
  const memberRows = (members ?? []) as MemberRow[];
  const psRows = (statements ?? []) as PsRow[];
  const submissionRows = (submissions ?? []) as Array<{ team_id: string; submitted_at: string | null }>;

  const pace = velocitySummary(dailyVelocity(teamRows));
  const diversity = diversityCompliance(memberRows);
  const completeness = incompleteTeams(memberRows, teamRows.length, TEAM_SIZE);
  const psSplit = psDecisionSplit(teamRows);
  const demand = psPopularity(psRows, teamRows);
  const concentration = psConcentration(demand);
  const funnel = pipeline({
    teams: teamRows,
    members: memberRows,
    submittedTeamIds: submissionRows.filter((s) => s.submitted_at).map((s) => s.team_id),
    scoredTeamIds: [],
    teamSize: TEAM_SIZE,
  });

  const rows: Array<Array<string | number | null>> = [
    ['Headline', 'Teams registered', teamRows.length, ''],
    ['Headline', 'Participants', memberRows.length, ''],
    ['Headline', 'Female share (%)', diversity.femaleShare, ''],
    ['Headline', 'Teams locked', teamRows.filter((t) => t.registration_locked_at).length, ''],

    ['Pace', 'Busiest day', pace.peakCount, pace.peakDay ?? ''],
    ['Pace', 'Average teams per day', pace.averagePerDay, `over ${pace.spanDays} days`],
    ['Pace', 'Teams in last 7 days', pace.lastSeven, ''],
    ['Pace', 'Days since last registration', pace.quietStreak, ''],

    ['Eligibility', 'Teams with a female member', diversity.compliant, ''],
    ['Eligibility', 'Teams with no female member', diversity.nonCompliant, 'blocks SIH entry'],
    ['Eligibility', 'Teams of the wrong size', completeness.short, `expected ${TEAM_SIZE}`],
    ['Eligibility', 'Complete rosters', completeness.complete, ''],

    ['Problem statements', 'Active in catalogue', psRows.filter((ps) => ps.is_active).length, ''],
    ['Problem statements', 'Teams that chose one', psSplit.decided, ''],
    ['Problem statements', 'Teams still TBD', psSplit.tbd, ''],
    ['Problem statements', 'Distinct statements chosen', concentration.distinctChosen, ''],
    ['Problem statements', 'Top 5 share (%)', concentration.topShare, ''],
    ['Problem statements', 'Concentration index', concentration.hhi, '0 spread, 1 concentrated'],
  ];

  for (const stage of funnel) {
    rows.push(['Pipeline', stage.name, stage.value, `${stage.share}% of registered`]);
  }

  for (const slice of genderSplit(memberRows)) {
    rows.push(['Gender', slice.name, slice.value, '']);
  }

  for (const slice of distribution(memberRows, (m) => m.branch)) {
    rows.push(['Branch', slice.name, slice.value, '']);
  }

  for (const slice of distribution(memberRows, (m) => m.year)) {
    rows.push(['Year', slice.name, slice.value, '']);
  }

  for (const row of demand.filter((entry) => entry.teams > 0)) {
    rows.push(['PS demand', row.ps_id, row.teams, row.title]);
  }

  const csv = toCsv(['section', 'metric', 'value', 'detail'], rows);
  const stamp = new Date().toISOString().slice(0, 10);

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="piemr-hackathon-analytics-${stamp}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}
