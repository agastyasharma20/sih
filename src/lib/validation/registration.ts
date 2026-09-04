import { z } from 'zod';
import { TEAM_SIZE, MIN_FEMALE_MEMBERS, DEFAULT_EMAIL_DOMAIN } from '@/lib/constants';

/**
 * One schema, used by the browser form and by the API route. The database
 * re-checks all of it in register_team(); this layer exists to give fast,
 * field-level feedback, not to be the security boundary.
 */

const institutionalEmail = (domain: string = DEFAULT_EMAIL_DOMAIN) =>
  z
    .string()
    .trim()
    .toLowerCase()
    .min(1, 'Email is required')
    .regex(
      new RegExp(`^[^@\\s]+@${domain.replace(/\./g, '\\.')}$`, 'i'),
      `Must be an @${domain} address`,
    );

const phone = z
  .string()
  .trim()
  .transform((v) => v.replace(/\D/g, ''))
  .refine((v) => v.length === 10, 'Enter a 10-digit phone number');

/**
 * Form controls hand back the strings "true"/"false" rather than booleans,
 * and z.coerce.boolean() would read "false" as true. A union keeps the
 * input type concrete, which z.preprocess would erase — React Hook Form
 * derives its field paths from that type.
 */
const formBoolean = z
  .union([z.boolean(), z.literal('true'), z.literal('false')])
  .transform((value) => value === true || value === 'true')
  .default(false);

export const memberSchema = z.object({
  is_lead: formBoolean,
  full_name: z.string().trim().min(2, 'Enter the full name'),
  gender: z.enum(['male', 'female', 'other'], { message: 'Select a gender' }),
  branch: z.string().trim().min(1, 'Select a branch'),
  year: z.string().trim().min(1, 'Select a year'),
  enrollment_number: z
    .string()
    .trim()
    .toUpperCase()
    .min(4, 'Enter the enrollment number')
    .max(30, 'Enrollment number looks too long'),
  email: institutionalEmail(),
  phone,
  /** Dropdown value from problem_statements.ps_id, or 'TBD' before the
   *  list is published. Never free text. */
  tentative_ps_id: z.string().trim().default('TBD'),
});

export const mentorSchema = z.object({
  full_name: z.string().trim().min(2, 'Enter the mentor name'),
  contact: z
    .string()
    .trim()
    .transform((v) => v.replace(/\D/g, ''))
    .refine((v) => v.length === 10, 'Enter a 10-digit contact number'),
  email: z.string().trim().toLowerCase().min(1, 'Email is required'),
  affiliation: z.enum(['piemr', 'industry']).default('piemr'),
});

/** Primary mentor must be PIEMR-affiliated. */
export const primaryMentorSchema = mentorSchema.extend({
  email: institutionalEmail(),
  affiliation: z.literal('piemr').default('piemr'),
});

/**
 * Optional secondary mentor: PIEMR or industry, so any valid address.
 *
 * Every field tolerates a blank, because collapsing the optional section
 * leaves empty strings behind rather than removing the object. Completeness
 * is enforced in the root superRefine, but only once the user has actually
 * entered something — otherwise the form would deadlock on errors attached
 * to fields nobody can see.
 */
export const secondaryMentorSchema = z.object({
  full_name: z.string().trim().default(''),
  contact: z.string().trim().default(''),
  email: z.string().trim().toLowerCase().default(''),
  affiliation: z.enum(['piemr', 'industry']).default('industry'),
});

/** True once any part of the optional mentor section has been filled in. */
export function isMentorProvided(mentor: {
  full_name?: string;
  contact?: string;
  email?: string;
} | null | undefined): boolean {
  if (!mentor) return false;
  return [mentor.full_name, mentor.contact, mentor.email].some(
    (value) => String(value ?? '').trim() !== '',
  );
}

export const registrationSchema = z
  .object({
    team_name: z
      .string()
      .trim()
      .min(3, 'Team name must be at least 3 characters')
      .max(60, 'Team name must be 60 characters or fewer'),
    members: z
      .array(memberSchema)
      .length(TEAM_SIZE, `A team must have exactly ${TEAM_SIZE} members`),
    primary_mentor: primaryMentorSchema,
    secondary_mentor: secondaryMentorSchema.nullable().default(null),
  })
  .superRefine((data, ctx) => {
    // Optional mentor: silent while untouched, fully checked once started.
    const secondary = data.secondary_mentor;
    if (isMentorProvided(secondary)) {
      if (secondary!.full_name.trim().length < 2) {
        ctx.addIssue({
          code: 'custom',
          path: ['secondary_mentor', 'full_name'],
          message: 'Enter the mentor name',
        });
      }
      if (secondary!.contact.replace(/\D/g, '').length !== 10) {
        ctx.addIssue({
          code: 'custom',
          path: ['secondary_mentor', 'contact'],
          message: 'Enter a 10-digit contact number',
        });
      }
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(secondary!.email)) {
        ctx.addIssue({
          code: 'custom',
          path: ['secondary_mentor', 'email'],
          message: 'Enter a valid email address',
        });
      }
    }

    const femaleCount = data.members.filter((m) => m.gender === 'female').length;
    if (femaleCount < MIN_FEMALE_MEMBERS) {
      ctx.addIssue({
        code: 'custom',
        path: ['members'],
        message: `Your team needs at least ${MIN_FEMALE_MEMBERS} female member. Update one member's gender to continue.`,
      });
    }

    const leadCount = data.members.filter((m) => m.is_lead).length;
    if (leadCount !== 1) {
      ctx.addIssue({
        code: 'custom',
        path: ['members'],
        message: 'Exactly one member must be marked as the team lead.',
      });
    }

    // Catch in-form collisions before the round trip; the database catches
    // collisions against other teams.
    const seen = {
      email: new Map<string, number>(),
      enrollment_number: new Map<string, number>(),
      phone: new Map<string, number>(),
    };

    data.members.forEach((member, index) => {
      (['email', 'enrollment_number', 'phone'] as const).forEach((field) => {
        const value = String(member[field]).toLowerCase();
        if (!value) return;
        const first = seen[field].get(value);
        if (first !== undefined) {
          ctx.addIssue({
            code: 'custom',
            path: ['members', index, field],
            message: `Same as member ${first + 1}. Each member needs a unique ${field.replace('_', ' ')}.`,
          });
        } else {
          seen[field].set(value, index);
        }
      });
    });
  });

export type MemberInput = z.input<typeof memberSchema>;
export type RegistrationInput = z.input<typeof registrationSchema>;
export type RegistrationValues = z.output<typeof registrationSchema>;

/** Blank member row used to prime the six-member form. */
export const emptyMember = (isLead = false): MemberInput => ({
  is_lead: isLead,
  full_name: '',
  gender: undefined as unknown as MemberInput['gender'],
  branch: '',
  year: '',
  enrollment_number: '',
  email: '',
  phone: '',
  tentative_ps_id: 'TBD',
});

/** Flatten Zod issues into `path -> message` for API error responses. */
export function issuesToFieldErrors(issues: z.core.$ZodIssue[]): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of issues) {
    const key = issue.path.join('.') || '_form';
    if (!errors[key]) errors[key] = issue.message;
  }
  return errors;
}
