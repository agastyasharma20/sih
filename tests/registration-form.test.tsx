import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TeamRegistrationForm } from '@/components/registration/TeamRegistrationForm';

// The form calls router.refresh()/push() after a successful save.
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
}));

const PS = [
  {
    id: 'p1',
    ps_id: 'SIH26001',
    title: 'Smart water monitoring',
    category: 'software' as const,
    theme: 'Clean Water',
    description: null,
    is_active: true,
  },
];

function renderForm() {
  return render(
    <TeamRegistrationForm
      mode="create"
      leadEmail="lead@piemr.edu.in"
      leadName="Lead Person"
      problemStatements={PS}
      psListPublished
    />,
  );
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('team registration form', () => {
  it('renders exactly six member cards', () => {
    renderForm();
    for (let i = 1; i <= 6; i += 1) {
      expect(screen.getByText(`Member ${i}`)).toBeInTheDocument();
    }
    expect(screen.queryByText('Member 7')).not.toBeInTheDocument();
  });

  it('marks the first member as team lead and fixes their email', () => {
    renderForm();

    expect(screen.getByText('Team Lead')).toBeInTheDocument();

    const email = screen.getByLabelText('Institutional email', {
      selector: '#m0-email',
    }) as HTMLInputElement;

    expect(email.value).toBe('lead@piemr.edu.in');
    expect(email).toHaveAttribute('readonly');
  });

  it('warns until a female member is chosen, then stops warning', async () => {
    const user = userEvent.setup();
    renderForm();

    const warning = /at least 1 female member/i;
    expect(screen.getByText(warning)).toBeInTheDocument();
    expect(screen.getByText('0 female')).toBeInTheDocument();

    await user.selectOptions(
      screen.getByLabelText('Gender', { selector: '#m0-gender' }),
      'female',
    );

    expect(screen.getByText('1 female')).toBeInTheDocument();
    expect(screen.queryByText(warning)).not.toBeInTheDocument();
  });

  it('offers one problem statement choice for the whole team, not per member', () => {
    renderForm();

    const teamPs = screen.getByLabelText('Tentative problem statement');
    expect(teamPs).toBeInTheDocument();
    expect(within(teamPs as HTMLSelectElement).getByText(/SIH26001/)).toBeInTheDocument();

    // The old per-member dropdowns must be gone.
    expect(screen.queryByLabelText('Tentative problem statement', { selector: '#m0-ps' }))
      .not.toBeInTheDocument();
  });

  it('keeps the optional mentor fields hidden until asked for', async () => {
    const user = userEvent.setup();
    renderForm();

    expect(screen.queryByLabelText('Affiliation')).not.toBeInTheDocument();

    await user.click(screen.getByLabelText(/Add a secondary mentor/i));
    expect(screen.getByLabelText('Affiliation')).toBeInTheDocument();
  });

  it('does not submit an empty form to the server', async () => {
    const user = userEvent.setup();
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    renderForm();
    await user.click(screen.getByRole('button', { name: /Submit registration/i }));

    // Client validation must reject before any network call.
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(await screen.findByText(/Team name must be at least 3 characters/i)).toBeInTheDocument();
  });

  it('tracks how many members are filled in', () => {
    renderForm();
    expect(screen.getByText('0/6 filled')).toBeInTheDocument();
  });
});
