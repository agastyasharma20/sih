import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Tabs } from '@/components/admin/insights/Tabs';
import { Matrix } from '@/components/admin/insights/Matrix';
import { Funnel } from '@/components/admin/insights/Funnel';
import { ActivityHeatmap } from '@/components/admin/insights/Heatmap';
import { StatTile } from '@/components/admin/insights/StatTile';
import { Sparkline } from '@/components/admin/insights/Sparkline';
import { crossTab, pipeline, registrationHeatmap } from '@/lib/insights';
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

describe('Tabs', () => {
  const sections = [
    { id: 'one', label: 'Pulse', content: <p>pulse panel</p> },
    { id: 'two', label: 'Judging', content: <p>judging panel</p>, badge: 3 },
  ];

  it('shows the first section and switches on click', async () => {
    const user = userEvent.setup();
    render(<Tabs sections={sections} />);

    expect(screen.getByText('pulse panel')).toBeInTheDocument();
    expect(screen.queryByText('judging panel')).not.toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: /judging/i }));

    expect(await screen.findByText('judging panel')).toBeInTheDocument();
    expect(screen.queryByText('pulse panel')).not.toBeInTheDocument();
  });

  it('marks the selected tab for assistive technology', async () => {
    const user = userEvent.setup();
    render(<Tabs sections={sections} />);

    const judging = screen.getByRole('tab', { name: /judging/i });
    expect(judging).toHaveAttribute('aria-selected', 'false');

    await user.click(judging);
    expect(judging).toHaveAttribute('aria-selected', 'true');
  });

  it('surfaces the alert count on the tab itself', () => {
    render(<Tabs sections={sections} />);
    expect(screen.getByRole('tab', { name: /judging/i })).toHaveTextContent('3');
  });
});

describe('Matrix', () => {
  it('renders every cell plus row and column totals', () => {
    const data = crossTab(
      [
        member({ branch: 'CSE', year: '3rd' }),
        member({ branch: 'CSE', year: '3rd' }),
        member({ branch: 'IT', year: '2nd' }),
      ],
      (m) => m.branch,
      (m) => m.year,
      ['1st', '2nd', '3rd', '4th'],
    );

    render(<Matrix data={data} />);

    const cse = screen.getByRole('row', { name: /^CSE/ });
    // 0 in "2nd", 2 in "3rd", then the row total.
    expect(within(cse).getAllByRole('cell').map((c) => c.textContent)).toEqual(['0', '2', '2']);
    expect(screen.getByRole('columnheader', { name: '3rd' })).toBeInTheDocument();
  });

  it('says so rather than drawing an empty grid', () => {
    render(<Matrix data={crossTab([], () => 'a', () => 'b')} />);
    expect(screen.getByText(/nothing to cross-tabulate/i)).toBeInTheDocument();
  });
});

describe('Funnel', () => {
  it('labels the drop-off between stages', () => {
    const stages = pipeline({
      teams: [team({ id: 'a' }), team({ id: 'b' })],
      members: [member({ team_id: 'a' })],
      submittedTeamIds: [],
      scoredTeamIds: [],
      teamSize: 6,
    });

    render(<Funnel stages={stages} />);

    expect(screen.getByText('Registered')).toBeInTheDocument();
    // Both teams are short of six, so the whole cohort drops at stage two.
    expect(screen.getByText(/−2 since “Registered”/)).toBeInTheDocument();
  });

  it('explains itself when no team has registered', () => {
    render(<Funnel stages={[]} />);
    expect(screen.getByText(/no teams have registered/i)).toBeInTheDocument();
  });
});

describe('ActivityHeatmap', () => {
  it('names the busiest window in IST', () => {
    render(<ActivityHeatmap data={registrationHeatmap([team()])} />);

    // 06:00 UTC on 1 Jan 2026 is Thursday 11:30 in Indore, so the caption
    // must say Thursday rather than the Wednesday a UTC bucket would give.
    const caption = screen.getByText(/busiest window/i);
    expect(caption).toHaveTextContent('Thu');
    expect(caption).toHaveTextContent('11:00');
  });

  it('falls back to a message with no registrations', () => {
    render(<ActivityHeatmap data={registrationHeatmap([])} />);
    expect(screen.getByText(/no registrations to plot/i)).toBeInTheDocument();
  });
});

describe('StatTile', () => {
  it('renders the real figure without waiting for the count-up', () => {
    // The tile is server-rendered, so the number has to be correct before
    // any animation frame runs — otherwise a printed dashboard reads zero.
    render(<StatTile label="Teams" value={42} note="7 this week" />);

    expect(screen.getByText('42')).toBeInTheDocument();
    expect(screen.getByText('7 this week')).toBeInTheDocument();
  });

  it('passes a non-numeric value straight through', () => {
    render(<StatTile label="Busiest day" value="2026-01-02" />);
    expect(screen.getByText('2026-01-02')).toBeInTheDocument();
  });
});

describe('Sparkline', () => {
  it('draws nothing for a single point, which has no trend', () => {
    const { container } = render(<Sparkline values={[3]} />);
    expect(container.querySelector('svg')).toBeNull();
  });

  it('draws a path once there are two points', () => {
    const { container } = render(<Sparkline values={[1, 4, 2]} />);
    expect(container.querySelectorAll('path')).toHaveLength(2);
  });
});

describe('Tabs keyboard navigation', () => {
  const sections = [
    { id: 'one', label: 'Pulse', content: <p>pulse panel</p> },
    { id: 'two', label: 'Judging', content: <p>judging panel</p> },
    { id: 'three', label: 'Operations', content: <p>operations panel</p> },
  ];

  it('moves between tabs with the arrow keys and wraps around', async () => {
    const user = userEvent.setup();
    render(<Tabs sections={sections} />);

    await user.tab();
    expect(screen.getByRole('tab', { name: 'Pulse' })).toHaveFocus();

    await user.keyboard('{ArrowRight}');
    expect(await screen.findByText('judging panel')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Judging' })).toHaveFocus();

    // Left from the first tab wraps to the last rather than dead-ending.
    await user.keyboard('{ArrowLeft}{ArrowLeft}');
    expect(await screen.findByText('operations panel')).toBeInTheDocument();
  });

  it('jumps to the ends with Home and End', async () => {
    const user = userEvent.setup();
    render(<Tabs sections={sections} />);

    await user.tab();
    await user.keyboard('{End}');
    expect(await screen.findByText('operations panel')).toBeInTheDocument();

    await user.keyboard('{Home}');
    expect(await screen.findByText('pulse panel')).toBeInTheDocument();
  });

  it('keeps only the selected tab in the tab order', () => {
    render(<Tabs sections={sections} />);

    expect(screen.getByRole('tab', { name: 'Pulse' })).toHaveAttribute('tabindex', '0');
    expect(screen.getByRole('tab', { name: 'Judging' })).toHaveAttribute('tabindex', '-1');
  });
});
