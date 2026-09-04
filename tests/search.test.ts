import { describe, it, expect } from 'vitest';
import { matchesAllWords, teamSearchText } from '@/lib/search';

describe('matchesAllWords', () => {
  it('matches when every word appears, in any order', () => {
    expect(matchesAllWords('004 Team Cortex Priya Sharma', 'priya 004')).toBe(true);
  });

  it('fails when one word is missing', () => {
    expect(matchesAllWords('004 Team Cortex', 'cortex 999')).toBe(false);
  });

  it('is case-insensitive', () => {
    expect(matchesAllWords('Team CORTEX', 'cortex')).toBe(true);
  });

  it('treats an empty or whitespace query as matching everything', () => {
    expect(matchesAllWords('anything', '')).toBe(true);
    expect(matchesAllWords('anything', '   ')).toBe(true);
  });

  it('collapses repeated spaces in the query', () => {
    expect(matchesAllWords('004 Team Cortex', '004    cortex')).toBe(true);
  });

  it('matches partial words, so a prefix finds the row', () => {
    expect(matchesAllWords('0808CS221001', '0808cs')).toBe(true);
  });
});

describe('teamSearchText', () => {
  it('includes the team ID, name, status and every member field', () => {
    const text = teamSearchText({
      team_id_short: '004',
      team_name: 'Cortex',
      status: 'submitted',
      members: [
        { full_name: 'Priya Sharma', email: 'priya@piemr.edu.in', enrollment_number: '0808CS1' },
      ],
    });

    expect(text).toContain('004');
    expect(text).toContain('Cortex');
    expect(text).toContain('submitted');
    expect(text).toContain('Priya Sharma');
    expect(text).toContain('priya@piemr.edu.in');
    expect(text).toContain('0808CS1');
  });

  it('survives a team with no members loaded', () => {
    expect(() =>
      teamSearchText({ team_id_short: '001', team_name: 'X', status: 'draft', members: null }),
    ).not.toThrow();
  });

  it('does not print "undefined" for a member missing fields', () => {
    const text = teamSearchText({
      team_id_short: '001',
      team_name: 'X',
      status: 'draft',
      members: [{}],
    });
    expect(text).not.toContain('undefined');
  });
});
