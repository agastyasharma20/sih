'use client';

import { useFormContext } from 'react-hook-form';
import { Crown } from 'lucide-react';
import { BRANCHES, YEARS, GENDERS } from '@/lib/constants';
import type { RegistrationInput } from '@/lib/validation/registration';
import type { ProblemStatement } from '@/lib/types';

interface MemberFieldsProps {
  index: number;
  problemStatements: ProblemStatement[];
  psListPublished: boolean;
  /** The lead's email is fixed to the signed-in account. */
  lockLeadEmail: boolean;
}

export function MemberFields({
  index,
  problemStatements,
  psListPublished,
  lockLeadEmail,
}: MemberFieldsProps) {
  const {
    register,
    formState: { errors },
  } = useFormContext<RegistrationInput>();

  const memberErrors = errors.members?.[index];
  // Row 1 is always the team lead — both on registration (the signed-in
  // account) and on edit, where members load lead-first.
  const isLead = index === 0;

  const errorFor = (field: keyof NonNullable<typeof memberErrors>) =>
    (memberErrors as Record<string, { message?: string }> | undefined)?.[field as string]?.message;

  const invalid = (field: string) =>
    Boolean((memberErrors as Record<string, unknown> | undefined)?.[field]);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-bold">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-piemr-600 text-xs font-bold text-white">
            {index + 1}
          </span>
          Member {index + 1}
        </h3>
        {isLead && (
          <span className="badge bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
            <Crown className="mr-1 h-3 w-3" />
            Team Lead
          </span>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="field-label" htmlFor={`m${index}-name`}>
            Full name
          </label>
          <input
            id={`m${index}-name`}
            className="field-input"
            aria-invalid={invalid('full_name')}
            {...register(`members.${index}.full_name`)}
          />
          {errorFor('full_name') && <p className="field-error">{errorFor('full_name')}</p>}
        </div>

        <div>
          <label className="field-label" htmlFor={`m${index}-gender`}>
            Gender
          </label>
          <select
            id={`m${index}-gender`}
            className="field-input"
            aria-invalid={invalid('gender')}
            defaultValue=""
            {...register(`members.${index}.gender`)}
          >
            <option value="" disabled>
              Select…
            </option>
            {GENDERS.map((g) => (
              <option key={g.value} value={g.value}>
                {g.label}
              </option>
            ))}
          </select>
          {errorFor('gender') && <p className="field-error">{errorFor('gender')}</p>}
        </div>

        <div>
          <label className="field-label" htmlFor={`m${index}-enrollment`}>
            Enrollment number
          </label>
          <input
            id={`m${index}-enrollment`}
            className="field-input uppercase"
            aria-invalid={invalid('enrollment_number')}
            {...register(`members.${index}.enrollment_number`)}
          />
          {errorFor('enrollment_number') && (
            <p className="field-error">{errorFor('enrollment_number')}</p>
          )}
        </div>

        <div>
          <label className="field-label" htmlFor={`m${index}-branch`}>
            Branch
          </label>
          <select
            id={`m${index}-branch`}
            className="field-input"
            aria-invalid={invalid('branch')}
            defaultValue=""
            {...register(`members.${index}.branch`)}
          >
            <option value="" disabled>
              Select…
            </option>
            {BRANCHES.map((branch) => (
              <option key={branch} value={branch}>
                {branch}
              </option>
            ))}
          </select>
          {errorFor('branch') && <p className="field-error">{errorFor('branch')}</p>}
        </div>

        <div>
          <label className="field-label" htmlFor={`m${index}-year`}>
            Year
          </label>
          <select
            id={`m${index}-year`}
            className="field-input"
            aria-invalid={invalid('year')}
            defaultValue=""
            {...register(`members.${index}.year`)}
          >
            <option value="" disabled>
              Select…
            </option>
            {YEARS.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
          {errorFor('year') && <p className="field-error">{errorFor('year')}</p>}
        </div>

        <div>
          <label className="field-label" htmlFor={`m${index}-email`}>
            Institutional email
          </label>
          <input
            id={`m${index}-email`}
            type="email"
            className="field-input"
            placeholder="name@piemr.edu.in"
            readOnly={isLead && lockLeadEmail}
            aria-invalid={invalid('email')}
            {...register(`members.${index}.email`)}
          />
          {isLead && lockLeadEmail && (
            <p className="mt-1 text-xs text-slate-500">
              Fixed to the account you signed in with.
            </p>
          )}
          {errorFor('email') && <p className="field-error">{errorFor('email')}</p>}
        </div>

        <div>
          <label className="field-label" htmlFor={`m${index}-phone`}>
            Phone number
          </label>
          <input
            id={`m${index}-phone`}
            type="tel"
            inputMode="numeric"
            className="field-input"
            placeholder="10-digit mobile"
            aria-invalid={invalid('phone')}
            {...register(`members.${index}.phone`)}
          />
          {errorFor('phone') && <p className="field-error">{errorFor('phone')}</p>}
        </div>

        <div className="sm:col-span-2">
          <label className="field-label" htmlFor={`m${index}-ps`}>
            Tentative problem statement
          </label>
          <select
            id={`m${index}-ps`}
            className="field-input"
            {...register(`members.${index}.tentative_ps_id`)}
          >
            <option value="TBD">
              {psListPublished ? 'Not decided yet (TBD)' : 'TBD — list not published yet'}
            </option>
            {problemStatements.map((ps) => (
              <option key={ps.id} value={ps.ps_id}>
                {ps.ps_id} — {ps.title}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
