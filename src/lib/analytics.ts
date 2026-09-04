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
  tentative_ps_id: string | null;
}

export interface TeamRow {
  id: string;
  created_at: string;
  status: string;
  registration_locked_at: string | null;
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

/** How many teams have settled on a problem statement versus left it TBD. */
export function psDecisionSplit(members: MemberRow[]): { decided: number; tbd: number } {
  const perTeam = new Map<string, boolean>();

  for (const member of members) {
    const decided = perTeam.get(member.team_id) || member.tentative_ps_id !== null;
    perTeam.set(member.team_id, decided);
  }

  const values = [...perTeam.values()];
  return {
    decided: values.filter(Boolean).length,
    tbd: values.filter((v) => !v).length,
  };
}
