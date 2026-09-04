import { describe, it, expect } from 'vitest';
import {
  distribution,
  registrationsOverTime,
  genderSplit,
  incompleteTeams,
  psDecisionSplit,
  type MemberRow,
  type TeamRow,
} from '@/lib/analytics';

const member = (over: Partial<MemberRow> = {}): MemberRow => ({
  branch: 'CSE',
  year: '3rd Year',
  gender: 'male',
  team_id: 't1',
  ...over,
});

const team = (over: Partial<TeamRow> = {}): TeamRow => ({
  id: 't1',
  created_at: '2026-01-01T00:00:00Z',
  status: 'submitted',
  registration_locked_at: null,
  tentative_ps_id: null,
  ...over,
});

describe('distribution', () => {
  it('counts and sorts largest first', () => {
    const rows = [member(), member(), member({ branch: 'IT' })];
    expect(distribution(rows, (r) => r.branch)).toEqual([
      { name: 'CSE', value: 2 },
      { name: 'IT', value: 1 },
    ]);
  });

  it('buckets blanks as Unspecified', () => {
    expect(distribution([member({ branch: '' })], (r) => r.branch)).toEqual([
      { name: 'Unspecified', value: 1 },
    ]);
  });
});

describe('registrationsOverTime', () => {
  it('accumulates by day in chronological order', () => {
    const teams = [
      { id: 'a', created_at: '2026-01-02T10:00:00Z', status: 'submitted', registration_locked_at: null },
      { id: 'b', created_at: '2026-01-01T10:00:00Z', status: 'submitted', registration_locked_at: null },
      { id: 'c', created_at: '2026-01-02T12:00:00Z', status: 'submitted', registration_locked_at: null },
    ];
    expect(registrationsOverTime(teams)).toEqual([
      { name: '2026-01-01', value: 1, total: 1 },
      { name: '2026-01-02', value: 2, total: 3 },
    ]);
  });

  it('returns nothing for no teams', () => {
    expect(registrationsOverTime([])).toEqual([]);
  });
});

describe('genderSplit', () => {
  it('always reports all three buckets, including zeroes', () => {
    const result = genderSplit([member({ gender: 'female' }), member()]);
    expect(result).toEqual([
      { name: 'Female', value: 1 },
      { name: 'Male', value: 1 },
      { name: 'Other', value: 0 },
    ]);
  });
});

describe('incompleteTeams', () => {
  it('separates full teams from short ones', () => {
    const members = [
      ...Array.from({ length: 6 }, () => member({ team_id: 'full' })),
      ...Array.from({ length: 4 }, () => member({ team_id: 'short' })),
    ];
    expect(incompleteTeams(members, 2, 6)).toEqual({ short: 1, complete: 1, missing: 0 });
  });

  it('counts teams with no members at all as missing', () => {
    expect(incompleteTeams([], 3, 6)).toEqual({ short: 0, complete: 0, missing: 3 });
  });
});

describe('psDecisionSplit', () => {
  it('counts one choice per team, from the team row', () => {
    const teams = [
      team({ id: 'a', tentative_ps_id: 'ps-1' }),
      team({ id: 'b', tentative_ps_id: null }),
      team({ id: 'c', tentative_ps_id: 'ps-2' }),
    ];
    expect(psDecisionSplit(teams)).toEqual({ decided: 2, tbd: 1 });
  });

  it('reports nothing decided for an empty round', () => {
    expect(psDecisionSplit([])).toEqual({ decided: 0, tbd: 0 });
  });
});
