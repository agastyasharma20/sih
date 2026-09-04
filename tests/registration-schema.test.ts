import { describe, it, expect } from 'vitest';
import { registrationSchema, emptyMember } from '@/lib/validation/registration';

/** A submission that should always pass, which each test then perturbs. */
function validMember(i: number, overrides: Record<string, unknown> = {}) {
  return {
    is_lead: i === 0,
    full_name: `Member ${i + 1}`,
    gender: i === 0 ? 'female' : 'male',
    branch: 'Computer Science & Engineering',
    year: '3rd Year',
    enrollment_number: `0808CS22100${i}`,
    email: `member${i}@piemr.edu.in`,
    phone: `900000000${i}`,
    tentative_ps_id: 'TBD',
    ...overrides,
  };
}

function validPayload(overrides: Record<string, unknown> = {}) {
  return {
    team_name: 'Team Cortex',
    members: Array.from({ length: 6 }, (_, i) => validMember(i)),
    primary_mentor: {
      full_name: 'Dr. Mentor',
      contact: '9876543210',
      email: 'mentor@piemr.edu.in',
      affiliation: 'piemr',
    },
    secondary_mentor: null,
    ...overrides,
  };
}

const messages = (result: { success: boolean; error?: { issues: { message: string }[] } }) =>
  result.success ? [] : result.error!.issues.map((i) => i.message);

describe('registration schema', () => {
  it('accepts a well-formed team', () => {
    const result = registrationSchema.safeParse(validPayload());
    expect(messages(result)).toEqual([]);
    expect(result.success).toBe(true);
  });

  it('rejects a team without a female member', () => {
    const members = Array.from({ length: 6 }, (_, i) =>
      validMember(i, { gender: 'male' }),
    );
    const result = registrationSchema.safeParse(validPayload({ members }));
    expect(result.success).toBe(false);
    expect(messages(result).join(' ')).toMatch(/at least 1 female member/i);
  });

  it('rejects fewer than six members', () => {
    const members = Array.from({ length: 5 }, (_, i) => validMember(i));
    const result = registrationSchema.safeParse(validPayload({ members }));
    expect(result.success).toBe(false);
    expect(messages(result).join(' ')).toMatch(/exactly 6 members/i);
  });

  it('rejects a non-institutional member email', () => {
    const members = Array.from({ length: 6 }, (_, i) => validMember(i));
    members[2] = validMember(2, { email: 'someone@gmail.com' });
    const result = registrationSchema.safeParse(validPayload({ members }));
    expect(result.success).toBe(false);
    expect(messages(result).join(' ')).toMatch(/@piemr\.edu\.in/);
  });

  it('rejects a primary mentor outside PIEMR', () => {
    const result = registrationSchema.safeParse(
      validPayload({
        primary_mentor: {
          full_name: 'Ext Mentor',
          contact: '9876543210',
          email: 'mentor@infosys.com',
          affiliation: 'piemr',
        },
      }),
    );
    expect(result.success).toBe(false);
  });

  it('flags duplicate emails within the form', () => {
    const members = Array.from({ length: 6 }, (_, i) => validMember(i));
    members[4] = validMember(4, { email: 'member1@piemr.edu.in' });
    const result = registrationSchema.safeParse(validPayload({ members }));
    expect(result.success).toBe(false);
    expect(messages(result).join(' ')).toMatch(/Same as member 2/);
  });

  it('normalises phone numbers with spaces and dashes', () => {
    const members = Array.from({ length: 6 }, (_, i) => validMember(i));
    members[0] = validMember(0, { phone: '+91 90000-00000' });
    const result = registrationSchema.safeParse(validPayload({ members }));
    // +91 prefix pushes it to 12 digits, which must be rejected rather than
    // silently truncated.
    expect(result.success).toBe(false);
  });

  it('accepts a 10-digit phone written with separators', () => {
    const members = Array.from({ length: 6 }, (_, i) => validMember(i));
    members[0] = validMember(0, { phone: '90000 00000' });
    const result = registrationSchema.safeParse(validPayload({ members }));
    expect(result.success).toBe(true);
  });

  // --- the two cases suspected from reading the form component ---------

  it('handles is_lead arriving as a string from a hidden input', () => {
    const members = Array.from({ length: 6 }, (_, i) =>
      validMember(i, { is_lead: i === 0 ? 'true' : 'false' }),
    );
    const result = registrationSchema.safeParse(validPayload({ members }));
    expect(result.success).toBe(true);
  });

  it('treats a blank secondary mentor as absent', () => {
    const result = registrationSchema.safeParse(
      validPayload({ secondary_mentor: { full_name: '', contact: '', email: '', affiliation: 'industry' } }),
    );
    expect(messages(result)).toEqual([]);
    expect(result.success).toBe(true);
  });

  it('still validates a secondary mentor that was filled in', () => {
    const result = registrationSchema.safeParse(
      validPayload({
        secondary_mentor: { full_name: 'Ind Mentor', contact: '12', email: 'bad', affiliation: 'industry' },
      }),
    );
    expect(result.success).toBe(false);
  });

  it('emptyMember produces a row the schema rejects until filled', () => {
    const members = Array.from({ length: 6 }, (_, i) => validMember(i));
    members[3] = emptyMember() as never;
    const result = registrationSchema.safeParse(validPayload({ members }));
    expect(result.success).toBe(false);
  });
});
