import { describe, it, expect } from 'vitest';
import {
  auditActivity,
  criterionAverages,
  crossTab,
  dailyVelocity,
  diversityCompliance,
  istParts,
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
  type CriterionRow,
  type ScoreRow,
} from '@/lib/insights';
import type { MemberRow, TeamRow } from '@/lib/analytics';

const member = (over: Partial<MemberRow> = {}): MemberRow => ({
  branch: 'CSE',
  year: '3rd',
  gender: 'male',
  team_id: 't1',
  ...over,
});

const team = (over: Partial<TeamRow> = {}): TeamRow => ({
  id: 't1',
  created_at: '2026-01-01T06:00:00Z',
  status: 'submitted',
  registration_locked_at: null,
  tentative_ps_id: null,
  ...over,
});

describe('istParts', () => {
  it('shifts UTC into IST', () => {
    expect(istParts('2026-01-01T06:00:00Z')).toEqual({ day: '2026-01-01', weekday: 4, hour: 11 });
  });

  it('rolls a late-evening UTC timestamp into the next IST day', () => {
    // 20:00 UTC is 01:30 the following morning in Indore. Bucketing this
    // as the 1st would put a registration on the wrong campus day.
    const parts = istParts('2026-01-01T20:00:00Z');
    expect(parts.day).toBe('2026-01-02');
    expect(parts.hour).toBe(1);
  });
});

describe('dailyVelocity', () => {
  it('fills the days nobody registered', () => {
    const points = dailyVelocity([
      team({ id: 'a', created_at: '2026-01-01T06:00:00Z' }),
      team({ id: 'b', created_at: '2026-01-04T06:00:00Z' }),
    ]);

    // Without the gap days the chart would draw a straight climb and
    // hide the two-day stall in the middle.
    expect(points.map((p) => p.name)).toEqual([
      '2026-01-01',
      '2026-01-02',
      '2026-01-03',
      '2026-01-04',
    ]);
    expect(points.map((p) => p.value)).toEqual([1, 0, 0, 1]);
    expect(points.map((p) => p.total)).toEqual([1, 1, 1, 2]);
  });

  it('returns nothing for no teams', () => {
    expect(dailyVelocity([])).toEqual([]);
  });
});

describe('velocitySummary', () => {
  it('reports the peak, the pace and the current stall', () => {
    const summary = velocitySummary([
      { name: '2026-01-01', value: 1, total: 1 },
      { name: '2026-01-02', value: 5, total: 6 },
      { name: '2026-01-03', value: 0, total: 6 },
      { name: '2026-01-04', value: 0, total: 6 },
    ]);

    expect(summary.peakDay).toBe('2026-01-02');
    expect(summary.peakCount).toBe(5);
    expect(summary.activeDays).toBe(2);
    expect(summary.quietStreak).toBe(2);
    expect(summary.averagePerDay).toBe(1.5);
  });

  it('is safe on an empty series', () => {
    expect(velocitySummary([]).peakDay).toBeNull();
  });
});

describe('registrationHeatmap', () => {
  it('buckets by IST weekday and hour', () => {
    const map = registrationHeatmap([team({ created_at: '2026-01-01T06:00:00Z' })]);

    // 1 Jan 2026 06:00 UTC is Thursday 11:30 IST.
    expect(map.matrix[4][11]).toBe(1);
    expect(map.busiestWeekday).toBe(4);
    expect(map.busiestHour).toBe(11);
    expect(map.max).toBe(1);
  });

  it('has no busiest slot when nothing has been registered', () => {
    const map = registrationHeatmap([]);
    expect(map.busiestHour).toBeNull();
    expect(map.max).toBe(0);
  });
});

describe('teamSizeDistribution', () => {
  it('always lists the expected size, even at zero', () => {
    const rows = teamSizeDistribution([member({ team_id: 'a' })], 6);

    expect(rows).toEqual([
      { name: '1 member', value: 1 },
      { name: '6 members', value: 0 },
    ]);
  });
});

describe('diversityCompliance', () => {
  it('names the teams that would be rejected', () => {
    const result = diversityCompliance([
      member({ team_id: 'a', gender: 'female' }),
      member({ team_id: 'a' }),
      member({ team_id: 'b' }),
      member({ team_id: 'c', gender: 'female' }),
      member({ team_id: 'c', gender: 'female' }),
    ]);

    expect(result.compliant).toBe(2);
    expect(result.nonCompliant).toBe(1);
    expect(result.offendingTeamIds).toEqual(['b']);
    expect(result.teamsWithMultipleWomen).toBe(1);
    expect(result.femaleShare).toBe(60);
  });
});

describe('crossTab', () => {
  it('honours a fixed column order and drops columns with no data', () => {
    const table = crossTab(
      [
        member({ branch: 'CSE', year: '3rd' }),
        member({ branch: 'CSE', year: '2nd' }),
        member({ branch: 'IT', year: '3rd' }),
      ],
      (m) => m.branch,
      (m) => m.year,
      ['1st', '2nd', '3rd', '4th'],
    );

    expect(table.cols).toEqual(['2nd', '3rd']);
    expect(table.rows).toEqual(['CSE', 'IT']);
    expect(table.matrix).toEqual([
      [1, 1],
      [0, 1],
    ]);
    expect(table.rowTotals).toEqual([2, 1]);
    expect(table.colTotals).toEqual([1, 2]);
    expect(table.total).toBe(3);
  });
});

describe('psConcentration', () => {
  const demand = (ps_id: string, teams: number) => ({
    ps_id,
    title: ps_id,
    category: 'software' as const,
    theme: null,
    teams,
  });

  it('flags statements drawing more than twice the average', () => {
    const result = psConcentration([
      demand('SIH1', 10),
      demand('SIH2', 1),
      demand('SIH3', 1),
      demand('SIH4', 0),
    ]);

    expect(result.distinctChosen).toBe(3);
    expect(result.crowded.map((row) => row.ps_id)).toEqual(['SIH1']);
    expect(result.topShare).toBe(100);
    expect(result.hhi).toBeGreaterThan(0.5);
  });

  it('is zero when nobody has chosen anything', () => {
    expect(psConcentration([demand('SIH1', 0)])).toEqual({
      hhi: 0,
      distinctChosen: 0,
      topShare: 0,
      crowded: [],
    });
  });
});

describe('organisationDemand', () => {
  it('groups blank organisations rather than dropping them', () => {
    const rows = organisationDemand(
      [
        { id: 'p1', organisation: 'Ministry of Jal Shakti' },
        { id: 'p2', organisation: '  ' },
      ],
      [{ tentative_ps_id: 'p1' }, { tentative_ps_id: 'p2' }, { tentative_ps_id: null }],
    );

    expect(rows).toEqual([
      { name: 'Ministry of Jal Shakti', value: 1 },
      { name: 'Unspecified', value: 1 },
    ]);
  });
});

describe('pipeline', () => {
  it('counts each stage from ids and reports the drop-off', () => {
    const teams = [
      team({ id: 'a', tentative_ps_id: 'p1', registration_locked_at: '2026-01-02T00:00:00Z' }),
      team({ id: 'b' }),
    ];
    const members = [
      ...Array.from({ length: 6 }, () => member({ team_id: 'a' })),
      member({ team_id: 'b' }),
    ];

    const stages = pipeline({
      teams,
      members,
      // A duplicate id must not inflate the stage.
      submittedTeamIds: ['a', 'a'],
      scoredTeamIds: [],
      teamSize: 6,
    });

    expect(stages.map((s) => [s.name, s.value])).toEqual([
      ['Registered', 2],
      ['Full roster', 1],
      ['PS chosen', 1],
      ['Locked', 1],
      ['Idea submitted', 1],
      ['Scored', 0],
    ]);
    expect(stages[1].dropped).toBe(1);
    expect(stages[1].share).toBe(50);
  });
});

describe('criterionAverages', () => {
  const criteria: CriterionRow[] = [
    { id: 'c1', name: 'Innovation', max_marks: 20, display_order: 1 },
    { id: 'c2', name: 'Feasibility', max_marks: 10, display_order: 2 },
  ];

  it('normalises each average against its own ceiling', () => {
    const scores: ScoreRow[] = [
      { submission_id: 's1', judge_id: 'j1', criterion_id: 'c1', marks_given: 10 },
      { submission_id: 's1', judge_id: 'j1', criterion_id: 'c2', marks_given: 9 },
    ];

    const stats = criterionAverages(scores, criteria);

    // Ten marks means half of Innovation but would be a 100% of nothing
    // if the two criteria were compared on their raw averages.
    expect(stats[0]).toMatchObject({ name: 'Innovation', average: 10, utilisation: 50 });
    expect(stats[1]).toMatchObject({ name: 'Feasibility', average: 9, utilisation: 90 });
  });

  it('reports zero for a criterion nobody has scored', () => {
    expect(criterionAverages([], criteria)[0]).toMatchObject({ average: 0, entries: 0 });
  });
});

describe('submissionTotals', () => {
  it('averages across judges rather than summing them', () => {
    const scores: ScoreRow[] = [
      { submission_id: 's1', judge_id: 'j1', criterion_id: 'c1', marks_given: 10 },
      { submission_id: 's1', judge_id: 'j1', criterion_id: 'c2', marks_given: 10 },
      { submission_id: 's1', judge_id: 'j2', criterion_id: 'c1', marks_given: 5 },
      { submission_id: 's1', judge_id: 'j2', criterion_id: 'c2', marks_given: 5 },
    ];

    // Two judges scoring 20 and 10 is a team on 15, not on 30 — summing
    // would make a team look better for having been judged twice.
    expect(submissionTotals(scores).get('s1')).toBe(15);
  });
});

describe('scoreHistogram', () => {
  it('puts a perfect score in the last band, not past the end', () => {
    const bands = scoreHistogram([100], 100, 10);
    expect(bands).toHaveLength(10);
    expect(bands[9]).toEqual({ name: '90–100', value: 1 });
  });
});

describe('judgeCalibration', () => {
  it('measures each judge against the panel mean', () => {
    const scores: ScoreRow[] = [
      { submission_id: 's1', judge_id: 'j1', criterion_id: 'c1', marks_given: 90 },
      { submission_id: 's2', judge_id: 'j1', criterion_id: 'c1', marks_given: 90 },
      { submission_id: 's1', judge_id: 'j2', criterion_id: 'c1', marks_given: 50 },
      { submission_id: 's2', judge_id: 'j2', criterion_id: 'c1', marks_given: 50 },
    ];

    const rows = judgeCalibration(scores, [
      { id: 'j1', full_name: 'Lenient', email: 'a@x' },
      { id: 'j2', full_name: null, email: 'harsh@x' },
    ]);

    expect(rows[0]).toMatchObject({ name: 'Lenient', mean: 90, bias: 20, spread: 0 });
    // Falls back to the email when the account has no name.
    expect(rows[1]).toMatchObject({ name: 'harsh@x', mean: 50, bias: -20 });
  });

  it('returns nothing when no marks exist', () => {
    expect(judgeCalibration([], [{ id: 'j1', full_name: 'A', email: 'a@x' }])).toEqual([]);
  });
});

describe('judgingProgress', () => {
  it('counts a submission complete only once every criterion is marked', () => {
    const scores: ScoreRow[] = [
      { submission_id: 's1', judge_id: 'j1', criterion_id: 'c1', marks_given: 5 },
      { submission_id: 's1', judge_id: 'j1', criterion_id: 'c2', marks_given: 5 },
      { submission_id: 's2', judge_id: 'j1', criterion_id: 'c1', marks_given: 5 },
    ];

    const progress = judgingProgress(['s1', 's2', 's3'], scores, 2);

    expect(progress).toEqual({
      submissions: 3,
      started: 2,
      complete: 1,
      outstanding: 2,
      coverage: 33,
    });
  });
});

describe('auditActivity', () => {
  it('resolves actor names and labels the system actor', () => {
    const activity = auditActivity(
      [
        { action: 'team.register', actor_id: 'u1', created_at: '2026-01-01T06:00:00Z' },
        { action: 'team.register', actor_id: null, created_at: '2026-01-01T07:00:00Z' },
        { action: 'settings.update', actor_id: 'u1', created_at: '2026-01-02T06:00:00Z' },
      ],
      new Map([['u1', 'Dr. Sadhana Tiwari']]),
    );

    expect(activity.total).toBe(3);
    expect(activity.byAction[0]).toEqual({ name: 'team.register', value: 2 });
    expect(activity.byActor).toEqual([
      { name: 'Dr. Sadhana Tiwari', value: 2 },
      { name: 'System', value: 1 },
    ]);
    expect(activity.perDay.map((d) => d.name)).toEqual(['2026-01-01', '2026-01-02']);
    expect(activity.activeActors).toBe(2);
  });
});
