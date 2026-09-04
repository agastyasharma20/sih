import type { Gender } from '@/lib/types';

/**
 * Aggregations for the analytics dashboard. Kept as pure functions over
 * rows the page already fetched, so they are testable without a database
 * and add no extra round trips.
 */

export interface MemberRow {
  branch: string;
  year: string;
  gender: Gender;
  team_id: string;
}

export interface TeamRow {
  id: string;
  created_at: string;
  status: string;
  registration_locked_at: string | null;
  tentative_ps_id?: string | null;
}

export interface Slice {
  name: string;
  value: number;
}

/** Counts occurrences of a field, largest first. */
export function distribution<T>(rows: T[], key: (row: T) => string): Slice[] {
  const counts = new Map<string, number>();

  for (const row of rows) {
    const value = key(row) || 'Unspecified';
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

/** Cumulative registrations per day, for the trend chart. */
export function registrationsOverTime(teams: TeamRow[]): Array<Slice & { total: number }> {
  const byDay = new Map<string, number>();

  for (const team of teams) {
    const day = team.created_at.slice(0, 10);
    byDay.set(day, (byDay.get(day) ?? 0) + 1);
  }

  const days = [...byDay.entries()].sort((a, b) => a[0].localeCompare(b[0]));

  let running = 0;
  return days.map(([name, value]) => {
    running += value;
    return { name, value, total: running };
  });
}

/**
 * Gender split across all registered participants. Reported because the
 * one-female-member rule makes it a compliance figure, not just a stat.
 */
export function genderSplit(members: MemberRow[]): Slice[] {
  const order: Gender[] = ['female', 'male', 'other'];
  const counts = new Map<string, number>(order.map((g) => [g, 0]));

  for (const member of members) {
    counts.set(member.gender, (counts.get(member.gender) ?? 0) + 1);
  }

  return order.map((gender) => ({
    name: gender[0].toUpperCase() + gender.slice(1),
    value: counts.get(gender) ?? 0,
  }));
}

/** Teams whose roster is short of the required size — a data-quality check. */
export function incompleteTeams(members: MemberRow[], teamCount: number, teamSize: number) {
  const perTeam = new Map<string, number>();
  for (const member of members) {
    perTeam.set(member.team_id, (perTeam.get(member.team_id) ?? 0) + 1);
  }

  const short = [...perTeam.values()].filter((count) => count !== teamSize).length;
  return { short, complete: perTeam.size - short, missing: teamCount - perTeam.size };
}

/**
 * How many teams have settled on a problem statement versus left it TBD.
 * Reads the team-level choice — it used to be recorded per member, which
 * allowed six different answers for one team.
 */
export function psDecisionSplit(teams: TeamRow[]): { decided: number; tbd: number } {
  const decided = teams.filter((team) => Boolean(team.tentative_ps_id)).length;
  return { decided, tbd: teams.length - decided };
}

/** A problem statement plus how many teams have picked it. */
export interface PsRow {
  id: string;
  ps_id: string;
  title: string;
  category: 'software' | 'hardware';
  theme: string | null;
  organisation?: string | null;
  is_active: boolean;
}

export interface PsPopularity {
  ps_id: string;
  title: string;
  category: 'software' | 'hardware';
  theme: string | null;
  teams: number;
}

/**
 * Problem-statement demand, most-picked first.
 *
 * Counts every active statement, including the ones nobody chose —
 * a zero is the useful signal here, since it tells the SPOC which
 * statements to promote before registration closes.
 */
export function psPopularity(
  statements: PsRow[],
  teams: Array<{ tentative_ps_id?: string | null }>,
): PsPopularity[] {
  const counts = new Map<string, number>();

  for (const team of teams) {
    if (team.tentative_ps_id) {
      counts.set(team.tentative_ps_id, (counts.get(team.tentative_ps_id) ?? 0) + 1);
    }
  }

  return statements
    .filter((ps) => ps.is_active)
    .map((ps) => ({
      ps_id: ps.ps_id,
      title: ps.title,
      category: ps.category,
      theme: ps.theme,
      teams: counts.get(ps.id) ?? 0,
    }))
    .sort((a, b) => b.teams - a.teams || a.ps_id.localeCompare(b.ps_id));
}

/** Software vs hardware split of what teams actually chose. */
export function psCategorySplit(
  statements: PsRow[],
  teams: Array<{ tentative_ps_id?: string | null }>,
): Slice[] {
  const byId = new Map(statements.map((ps) => [ps.id, ps]));
  const counts = { software: 0, hardware: 0 };

  for (const team of teams) {
    const ps = team.tentative_ps_id ? byId.get(team.tentative_ps_id) : undefined;
    if (ps) counts[ps.category] += 1;
  }

  return [
    { name: 'Software', value: counts.software },
    { name: 'Hardware', value: counts.hardware },
  ];
}

/** Demand per theme, for the themes teams have actually chosen. */
export function psThemeDemand(
  statements: PsRow[],
  teams: Array<{ tentative_ps_id?: string | null }>,
): Slice[] {
  const byId = new Map(statements.map((ps) => [ps.id, ps]));
  const counts = new Map<string, number>();

  for (const team of teams) {
    const ps = team.tentative_ps_id ? byId.get(team.tentative_ps_id) : undefined;
    if (!ps) continue;
    const theme = ps.theme || 'Unspecified';
    counts.set(theme, (counts.get(theme) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

/** Headline numbers about the catalogue itself. */
export function psCatalogueSummary(statements: PsRow[]) {
  const active = statements.filter((ps) => ps.is_active);

  return {
    total: statements.length,
    active: active.length,
    retired: statements.length - active.length,
    software: active.filter((ps) => ps.category === 'software').length,
    hardware: active.filter((ps) => ps.category === 'hardware').length,
    themes: new Set(active.map((ps) => ps.theme).filter(Boolean)).size,
  };
}
