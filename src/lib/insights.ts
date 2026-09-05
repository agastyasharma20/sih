import type { MemberRow, PsPopularity, Slice, TeamRow } from '@/lib/analytics';

/**
 * The deep half of the analytics module.
 *
 * `analytics.ts` answers "how many"; this file answers "is that healthy".
 * Everything here is a pure function over rows the page already fetched,
 * so it costs no extra round trips and is testable without a database.
 *
 * Times are bucketed in IST rather than UTC. The database stores UTC, but
 * a SPOC reading "the busiest hour is 19:00" means seven in the evening in
 * Indore — a UTC bucket would put the campus rush at 13:30 and be useless.
 */
export const IST_OFFSET_MINUTES = 330;

/** Shifts a UTC timestamp into IST so day and hour buckets read locally. */
export function istParts(iso: string): { day: string; weekday: number; hour: number } {
  const shifted = new Date(new Date(iso).getTime() + IST_OFFSET_MINUTES * 60_000);

  return {
    day: shifted.toISOString().slice(0, 10),
    weekday: shifted.getUTCDay(),
    hour: shifted.getUTCHours(),
  };
}

/* -------------------------------------------------------------- velocity */

export interface VelocityPoint {
  name: string;
  value: number;
  total: number;
}

/**
 * New teams per day with a running total, gap days included.
 *
 * The gaps matter: a chart that silently skips the three days nobody
 * registered draws a straight climb and hides the stall.
 */
export function dailyVelocity(teams: TeamRow[]): VelocityPoint[] {
  if (teams.length === 0) return [];

  const byDay = new Map<string, number>();
  for (const team of teams) {
    const { day } = istParts(team.created_at);
    byDay.set(day, (byDay.get(day) ?? 0) + 1);
  }

  const days = [...byDay.keys()].sort();
  const first = Date.parse(`${days[0]}T00:00:00Z`);
  const last = Date.parse(`${days[days.length - 1]}T00:00:00Z`);

  const points: VelocityPoint[] = [];
  let running = 0;

  for (let t = first; t <= last; t += 86_400_000) {
    const day = new Date(t).toISOString().slice(0, 10);
    const value = byDay.get(day) ?? 0;
    running += value;
    points.push({ name: day, value, total: running });
  }

  return points;
}

export interface VelocitySummary {
  peakDay: string | null;
  peakCount: number;
  averagePerDay: number;
  activeDays: number;
  spanDays: number;
  lastSeven: number;
  quietStreak: number;
}

/** Reads the shape of the velocity series: peak, pace and current stall. */
export function velocitySummary(points: VelocityPoint[]): VelocitySummary {
  if (points.length === 0) {
    return {
      peakDay: null,
      peakCount: 0,
      averagePerDay: 0,
      activeDays: 0,
      spanDays: 0,
      lastSeven: 0,
      quietStreak: 0,
    };
  }

  const peak = points.reduce((best, point) => (point.value > best.value ? point : best));
  const total = points[points.length - 1].total;

  let quietStreak = 0;
  for (let i = points.length - 1; i >= 0 && points[i].value === 0; i -= 1) quietStreak += 1;

  return {
    peakDay: peak.name,
    peakCount: peak.value,
    averagePerDay: Math.round((total / points.length) * 10) / 10,
    activeDays: points.filter((point) => point.value > 0).length,
    spanDays: points.length,
    lastSeven: points.slice(-7).reduce((sum, point) => sum + point.value, 0),
    quietStreak,
  };
}

/* --------------------------------------------------------------- heatmap */

export const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

export interface Heatmap {
  /** `matrix[weekday][hour]`, both in IST. */
  matrix: number[][];
  max: number;
  total: number;
  busiestHour: number | null;
  busiestWeekday: number | null;
}

/**
 * When teams actually register, as a weekday × hour grid.
 *
 * This is the one chart that changes behaviour rather than describing it:
 * it tells the SPOC when a reminder mail will be opened.
 */
export function registrationHeatmap(teams: TeamRow[]): Heatmap {
  const matrix = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 0));
  const perHour = Array.from({ length: 24 }, () => 0);
  const perDay = Array.from({ length: 7 }, () => 0);

  for (const team of teams) {
    const { weekday, hour } = istParts(team.created_at);
    matrix[weekday][hour] += 1;
    perHour[hour] += 1;
    perDay[weekday] += 1;
  }

  const max = Math.max(0, ...matrix.flat());

  return {
    matrix,
    max,
    total: teams.length,
    busiestHour: teams.length ? perHour.indexOf(Math.max(...perHour)) : null,
    busiestWeekday: teams.length ? perDay.indexOf(Math.max(...perDay)) : null,
  };
}

/* --------------------------------------------------------- participation */

/** Team sizes as they stand, so short and oversized rosters both show up. */
export function teamSizeDistribution(members: MemberRow[], expected: number): Slice[] {
  const perTeam = new Map<string, number>();
  for (const member of members) {
    perTeam.set(member.team_id, (perTeam.get(member.team_id) ?? 0) + 1);
  }

  const counts = new Map<number, number>();
  for (const size of perTeam.values()) {
    counts.set(size, (counts.get(size) ?? 0) + 1);
  }
  // Always show the expected size, even at zero, so the target is visible.
  if (!counts.has(expected)) counts.set(expected, 0);

  return [...counts.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([size, value]) => ({ name: `${size} member${size === 1 ? '' : 's'}`, value }));
}

export interface DiversityCompliance {
  compliant: number;
  nonCompliant: number;
  offendingTeamIds: string[];
  femaleShare: number;
  teamsWithMultipleWomen: number;
}

/**
 * SIH requires at least one female member per team. A team that misses it
 * is rejected at the national portal, so this is a blocking check rather
 * than a diversity statistic — the offending ids are returned so the SPOC
 * can go and fix those rosters.
 */
export function diversityCompliance(members: MemberRow[]): DiversityCompliance {
  const perTeam = new Map<string, { total: number; female: number }>();

  for (const member of members) {
    const entry = perTeam.get(member.team_id) ?? { total: 0, female: 0 };
    entry.total += 1;
    if (member.gender === 'female') entry.female += 1;
    perTeam.set(member.team_id, entry);
  }

  const offendingTeamIds = [...perTeam.entries()]
    .filter(([, entry]) => entry.female === 0)
    .map(([id]) => id);

  const female = members.filter((member) => member.gender === 'female').length;

  return {
    compliant: perTeam.size - offendingTeamIds.length,
    nonCompliant: offendingTeamIds.length,
    offendingTeamIds,
    femaleShare: members.length ? Math.round((female / members.length) * 100) : 0,
    teamsWithMultipleWomen: [...perTeam.values()].filter((entry) => entry.female > 1).length,
  };
}

export interface CrossTab {
  rows: string[];
  cols: string[];
  matrix: number[][];
  rowTotals: number[];
  colTotals: number[];
  max: number;
  total: number;
}

/**
 * Two-dimensional counts — branch against year, say. Rows and columns are
 * ordered by their own totals so the dense corner lands top-left.
 */
export function crossTab<T>(
  data: T[],
  rowKey: (row: T) => string,
  colKey: (row: T) => string,
  colOrder?: string[],
): CrossTab {
  const counts = new Map<string, Map<string, number>>();
  const rowTotal = new Map<string, number>();
  const colTotal = new Map<string, number>();

  for (const item of data) {
    const r = rowKey(item) || 'Unspecified';
    const c = colKey(item) || 'Unspecified';

    if (!counts.has(r)) counts.set(r, new Map());
    const row = counts.get(r)!;
    row.set(c, (row.get(c) ?? 0) + 1);

    rowTotal.set(r, (rowTotal.get(r) ?? 0) + 1);
    colTotal.set(c, (colTotal.get(c) ?? 0) + 1);
  }

  const rows = [...rowTotal.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([name]) => name);

  const cols = colOrder
    ? colOrder.filter((name) => colTotal.has(name))
    : [...colTotal.entries()]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .map(([name]) => name);

  const matrix = rows.map((r) => cols.map((c) => counts.get(r)?.get(c) ?? 0));

  return {
    rows,
    cols,
    matrix,
    rowTotals: rows.map((r) => rowTotal.get(r) ?? 0),
    colTotals: cols.map((c) => colTotal.get(c) ?? 0),
    max: Math.max(0, ...matrix.flat()),
    total: data.length,
  };
}

/* ---------------------------------------------------- problem statements */

export interface PsConcentration {
  /** Herfindahl index over chosen statements, 0 (spread) to 1 (all one). */
  hhi: number;
  distinctChosen: number;
  topShare: number;
  crowded: PsPopularity[];
}

/**
 * How concentrated the picks are. If forty teams converge on three
 * statements the internal round stops discriminating between them, so
 * `crowded` lists the ones drawing more than double the average.
 */
export function psConcentration(demand: PsPopularity[]): PsConcentration {
  const chosen = demand.filter((row) => row.teams > 0);
  const total = chosen.reduce((sum, row) => sum + row.teams, 0);

  if (total === 0) {
    return { hhi: 0, distinctChosen: 0, topShare: 0, crowded: [] };
  }

  const hhi = chosen.reduce((sum, row) => sum + (row.teams / total) ** 2, 0);
  const average = total / chosen.length;

  return {
    hhi: Math.round(hhi * 1000) / 1000,
    distinctChosen: chosen.length,
    topShare: Math.round((chosen.slice(0, 5).reduce((s, r) => s + r.teams, 0) / total) * 100),
    crowded: chosen.filter((row) => row.teams > average * 2 && row.teams > 1).slice(0, 8),
  };
}

/** Demand per sponsoring organisation, for the statements teams chose. */
export function organisationDemand(
  statements: Array<{ id: string; organisation?: string | null }>,
  teams: Array<{ tentative_ps_id?: string | null }>,
): Slice[] {
  const byId = new Map(statements.map((ps) => [ps.id, ps]));
  const counts = new Map<string, number>();

  for (const team of teams) {
    const ps = team.tentative_ps_id ? byId.get(team.tentative_ps_id) : undefined;
    if (!ps) continue;
    const name = ps.organisation?.trim() || 'Unspecified';
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name));
}

/* -------------------------------------------------------------- pipeline */

export interface FunnelStage {
  name: string;
  value: number;
  /** Share of the first stage, 0–100. */
  share: number;
  /** Teams lost since the previous stage. */
  dropped: number;
}

export interface PipelineInput {
  teams: TeamRow[];
  members: MemberRow[];
  submittedTeamIds: Iterable<string>;
  scoredTeamIds: Iterable<string>;
  teamSize: number;
}

/**
 * The whole event as one funnel, from a registered team to a scored one.
 * Every stage is derived from ids rather than counts so a team that skips
 * a stage cannot inflate a later one.
 */
export function pipeline({
  teams,
  members,
  submittedTeamIds,
  scoredTeamIds,
  teamSize,
}: PipelineInput): FunnelStage[] {
  const perTeam = new Map<string, number>();
  for (const member of members) {
    perTeam.set(member.team_id, (perTeam.get(member.team_id) ?? 0) + 1);
  }

  const registered = teams.length;
  const complete = teams.filter((team) => perTeam.get(team.id) === teamSize).length;
  const chosen = teams.filter((team) => Boolean(team.tentative_ps_id)).length;
  const locked = teams.filter((team) => Boolean(team.registration_locked_at)).length;
  const submitted = new Set(submittedTeamIds).size;
  const scored = new Set(scoredTeamIds).size;

  const raw = [
    ['Registered', registered],
    ['Full roster', complete],
    ['PS chosen', chosen],
    ['Locked', locked],
    ['Idea submitted', submitted],
    ['Scored', scored],
  ] as const;

  return raw.map(([name, value], index) => ({
    name,
    value,
    share: registered ? Math.round((value / registered) * 100) : 0,
    dropped: index === 0 ? 0 : Math.max(0, raw[index - 1][1] - value),
  }));
}

/* --------------------------------------------------------------- judging */

export interface CriterionRow {
  id: string;
  name: string;
  max_marks: number;
  display_order: number;
}

export interface ScoreRow {
  submission_id: string;
  judge_id: string;
  criterion_id: string;
  marks_given: number;
}

export interface CriterionStat {
  name: string;
  average: number;
  max: number;
  /** Average as a percentage of the criterion's ceiling. */
  utilisation: number;
  entries: number;
}

/**
 * Average marks per criterion, as a share of that criterion's ceiling.
 *
 * The raw average is not comparable across criteria worth different
 * marks, which is exactly the mistake this normalisation prevents — a
 * criterion nobody scores above half is either badly written or badly
 * briefed.
 */
export function criterionAverages(scores: ScoreRow[], criteria: CriterionRow[]): CriterionStat[] {
  const totals = new Map<string, { sum: number; count: number }>();

  for (const score of scores) {
    const entry = totals.get(score.criterion_id) ?? { sum: 0, count: 0 };
    entry.sum += Number(score.marks_given);
    entry.count += 1;
    totals.set(score.criterion_id, entry);
  }

  return [...criteria]
    .sort((a, b) => a.display_order - b.display_order)
    .map((criterion) => {
      const entry = totals.get(criterion.id);
      const average = entry && entry.count ? entry.sum / entry.count : 0;

      return {
        name: criterion.name,
        average: Math.round(average * 10) / 10,
        max: Number(criterion.max_marks),
        utilisation: criterion.max_marks
          ? Math.round((average / Number(criterion.max_marks)) * 100)
          : 0,
        entries: entry?.count ?? 0,
      };
    });
}

/** Each submission's mean total across the judges who scored it. */
export function submissionTotals(scores: ScoreRow[]): Map<string, number> {
  const perJudge = new Map<string, Map<string, number>>();

  for (const score of scores) {
    if (!perJudge.has(score.submission_id)) perJudge.set(score.submission_id, new Map());
    const judges = perJudge.get(score.submission_id)!;
    judges.set(score.judge_id, (judges.get(score.judge_id) ?? 0) + Number(score.marks_given));
  }

  const totals = new Map<string, number>();
  for (const [submission, judges] of perJudge) {
    const values = [...judges.values()];
    totals.set(submission, values.reduce((sum, v) => sum + v, 0) / values.length);
  }

  return totals;
}

/** Buckets totals into fixed-width bands for a distribution chart. */
export function scoreHistogram(totals: number[], ceiling: number, buckets = 10): Slice[] {
  const width = Math.max(1, ceiling / buckets);

  const counts = Array.from({ length: buckets }, () => 0);
  for (const total of totals) {
    const index = Math.min(buckets - 1, Math.max(0, Math.floor(total / width)));
    counts[index] += 1;
  }

  return counts.map((value, index) => ({
    name: `${Math.round(index * width)}–${Math.round((index + 1) * width)}`,
    value,
  }));
}

export interface JudgeCalibration {
  judgeId: string;
  name: string;
  submissions: number;
  mean: number;
  spread: number;
  /** Mean minus the cohort mean: positive is lenient, negative is harsh. */
  bias: number;
}

/**
 * Per-judge leniency. Two judges scoring the same field twenty marks
 * apart is a fairness problem that no leaderboard reveals — this is the
 * only view that catches it before results are published.
 */
export function judgeCalibration(
  scores: ScoreRow[],
  judges: Array<{ id: string; full_name: string | null; email: string }>,
): JudgeCalibration[] {
  const perJudge = new Map<string, Map<string, number>>();

  for (const score of scores) {
    if (!perJudge.has(score.judge_id)) perJudge.set(score.judge_id, new Map());
    const submissions = perJudge.get(score.judge_id)!;
    submissions.set(
      score.submission_id,
      (submissions.get(score.submission_id) ?? 0) + Number(score.marks_given),
    );
  }

  const names = new Map(judges.map((j) => [j.id, j.full_name || j.email]));

  const rows = [...perJudge.entries()].map(([judgeId, submissions]) => {
    const totals = [...submissions.values()];
    const mean = totals.reduce((sum, v) => sum + v, 0) / totals.length;
    const variance =
      totals.reduce((sum, v) => sum + (v - mean) ** 2, 0) / Math.max(1, totals.length);

    return {
      judgeId,
      name: names.get(judgeId) ?? 'Unknown judge',
      submissions: totals.length,
      mean: Math.round(mean * 10) / 10,
      spread: Math.round(Math.sqrt(variance) * 10) / 10,
      bias: 0,
    };
  });

  if (rows.length === 0) return rows;

  const cohort = rows.reduce((sum, row) => sum + row.mean, 0) / rows.length;
  for (const row of rows) row.bias = Math.round((row.mean - cohort) * 10) / 10;

  return rows.sort((a, b) => b.mean - a.mean);
}

export interface JudgingProgress {
  submissions: number;
  started: number;
  complete: number;
  outstanding: number;
  coverage: number;
}

/**
 * How far judging has actually got. "Complete" means every active
 * criterion carries a mark from at least one judge — a half-scored
 * submission is worse than an unscored one, because it looks finished.
 */
export function judgingProgress(
  submissionIds: string[],
  scores: ScoreRow[],
  criteriaCount: number,
): JudgingProgress {
  const perSubmission = new Map<string, Set<string>>();

  for (const score of scores) {
    if (!perSubmission.has(score.submission_id)) {
      perSubmission.set(score.submission_id, new Set());
    }
    perSubmission.get(score.submission_id)!.add(score.criterion_id);
  }

  const started = submissionIds.filter((id) => perSubmission.has(id)).length;
  const complete = submissionIds.filter(
    (id) => criteriaCount > 0 && (perSubmission.get(id)?.size ?? 0) >= criteriaCount,
  ).length;

  return {
    submissions: submissionIds.length,
    started,
    complete,
    outstanding: submissionIds.length - complete,
    coverage: submissionIds.length ? Math.round((complete / submissionIds.length) * 100) : 0,
  };
}

/* ----------------------------------------------------------------- audit */

export interface AuditRow {
  action: string;
  actor_id: string | null;
  created_at: string;
}

export interface AuditActivity {
  byAction: Slice[];
  byActor: Slice[];
  perDay: Slice[];
  total: number;
  activeActors: number;
}

/**
 * What the admin tier has been doing, from the audit log. Super-admin
 * territory: it is the only place a rogue account's burst of edits shows
 * up as a shape rather than as a thousand individual rows.
 */
export function auditActivity(
  logs: AuditRow[],
  actorNames: Map<string, string> = new Map(),
): AuditActivity {
  const byAction = new Map<string, number>();
  const byActor = new Map<string, number>();
  const perDay = new Map<string, number>();

  for (const log of logs) {
    byAction.set(log.action, (byAction.get(log.action) ?? 0) + 1);

    const actor = log.actor_id ?? 'system';
    byActor.set(actor, (byActor.get(actor) ?? 0) + 1);

    const { day } = istParts(log.created_at);
    perDay.set(day, (perDay.get(day) ?? 0) + 1);
  }

  const sorted = (map: Map<string, number>, label?: (key: string) => string): Slice[] =>
    [...map.entries()]
      .map(([name, value]) => ({ name: label ? label(name) : name, value }))
      .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name));

  return {
    byAction: sorted(byAction),
    byActor: sorted(byActor, (id) =>
      id === 'system' ? 'System' : (actorNames.get(id) ?? `${id.slice(0, 8)}…`),
    ).slice(0, 10),
    perDay: [...perDay.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([name, value]) => ({ name, value })),
    total: logs.length,
    activeActors: byActor.size,
  };
}
