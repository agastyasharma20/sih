import { describe, it, expect } from 'vitest';
import {
  distribution,
  registrationsOverTime,
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

const ps = (over: Partial<PsRow> = {}): PsRow => ({
  id: 'p1',
  ps_id: 'SIH1',
  title: 'Water',
  category: 'software',
  theme: 'Clean Water',
  is_active: true,
  ...over,
});

describe('psPopularity', () => {
  it('ranks by number of teams, most picked first', () => {
    const statements = [
      ps({ id: 'a', ps_id: 'SIH1' }),
      ps({ id: 'b', ps_id: 'SIH2' }),
      ps({ id: 'c', ps_id: 'SIH3' }),
    ];
    const teams = [
      { tentative_ps_id: 'b' },
      { tentative_ps_id: 'b' },
      { tentative_ps_id: 'a' },
    ];
    expect(psPopularity(statements, teams).map((r) => [r.ps_id, r.teams])).toEqual([
      ['SIH2', 2],
      ['SIH1', 1],
      ['SIH3', 0],
    ]);
  });

  it('keeps statements nobody chose — a zero is the point', () => {
    const result = psPopularity([ps({ id: 'a' })], []);
    expect(result).toHaveLength(1);
    expect(result[0].teams).toBe(0);
  });

  it('excludes retired statements', () => {
    const result = psPopularity([ps({ id: 'a' }), ps({ id: 'b', is_active: false })], []);
    expect(result).toHaveLength(1);
  });

  it('ignores a team pointing at a statement that no longer exists', () => {
    const result = psPopularity([ps({ id: 'a' })], [{ tentative_ps_id: 'deleted' }]);
    expect(result[0].teams).toBe(0);
  });
});

describe('psCategorySplit', () => {
  it('counts what teams chose, not what the catalogue contains', () => {
    const statements = [
      ps({ id: 'a', category: 'software' }),
      ps({ id: 'b', category: 'hardware' }),
      ps({ id: 'c', category: 'hardware' }),
    ];
    const teams = [{ tentative_ps_id: 'a' }, { tentative_ps_id: 'b' }, { tentative_ps_id: null }];
    expect(psCategorySplit(statements, teams)).toEqual([
      { name: 'Software', value: 1 },
      { name: 'Hardware', value: 1 },
    ]);
  });
});

describe('psThemeDemand', () => {
  it('aggregates chosen statements by theme', () => {
    const statements = [
      ps({ id: 'a', theme: 'Clean Water' }),
      ps({ id: 'b', theme: 'MedTech' }),
      ps({ id: 'c', theme: 'MedTech' }),
    ];
    const teams = [{ tentative_ps_id: 'b' }, { tentative_ps_id: 'c' }, { tentative_ps_id: 'a' }];
    expect(psThemeDemand(statements, teams)).toEqual([
      { name: 'MedTech', value: 2 },
      { name: 'Clean Water', value: 1 },
    ]);
  });

  it('buckets a missing theme rather than dropping the team', () => {
    const result = psThemeDemand([ps({ id: 'a', theme: null })], [{ tentative_ps_id: 'a' }]);
    expect(result).toEqual([{ name: 'Unspecified', value: 1 }]);
  });
});

describe('psCatalogueSummary', () => {
  it('separates active from retired and counts distinct themes', () => {
    const statements = [
      ps({ id: 'a', category: 'software', theme: 'Clean Water' }),
      ps({ id: 'b', category: 'hardware', theme: 'MedTech' }),
      ps({ id: 'c', category: 'hardware', theme: 'MedTech' }),
      ps({ id: 'd', is_active: false }),
    ];
    expect(psCatalogueSummary(statements)).toEqual({
      total: 4,
      active: 3,
      retired: 1,
      software: 1,
      hardware: 2,
      themes: 2,
    });
  });

  it('reports zeroes for an empty catalogue', () => {
    expect(psCatalogueSummary([])).toEqual({
      total: 0, active: 0, retired: 0, software: 0, hardware: 0, themes: 0,
    });
  });
});
