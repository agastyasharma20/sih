/**
 * Free-text matching for the admin roster.
 *
 * Deliberately simple: every whitespace-separated word in the query must
 * appear somewhere in the row. That means "004 kumar" finds team 004's
 * member named Kumar regardless of field order, which is how people
 * actually search a list they are looking at.
 */

/** Does `haystack` contain every word in `query`? */
export function matchesAllWords(haystack: string, query: string): boolean {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;

  const target = haystack.toLowerCase();
  return words.every((word) => target.includes(word));
}

/** Flattens the searchable text of a team into one string. */
export function teamSearchText(team: {
  team_id_short: string;
  team_name: string;
  status: string;
  members?: Array<{ full_name?: unknown; email?: unknown; enrollment_number?: unknown }> | null;
}): string {
  const parts: string[] = [team.team_id_short, team.team_name, team.status];

  for (const member of team.members ?? []) {
    parts.push(String(member.full_name ?? ''));
    parts.push(String(member.email ?? ''));
    parts.push(String(member.enrollment_number ?? ''));
  }

  return parts.join(' ');
}
