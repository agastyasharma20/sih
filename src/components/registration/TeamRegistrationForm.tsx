'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, CheckCircle2, Loader2, UserCheck, Users } from 'lucide-react';
import {
  registrationSchema,
  emptyMember,
  type RegistrationInput,
  type RegistrationValues,
} from '@/lib/validation/registration';
import { TEAM_SIZE, MIN_FEMALE_MEMBERS } from '@/lib/constants';
import { MemberFields } from './MemberFields';
import type { ProblemStatement } from '@/lib/types';

interface Props {
  mode: 'create' | 'edit';
  leadEmail: string;
  leadName: string | null;
  problemStatements: ProblemStatement[];
  psListPublished: boolean;
  defaultValues?: RegistrationInput;
}

function buildDefaults(leadEmail: string, leadName: string | null): RegistrationInput {
  const members = Array.from({ length: TEAM_SIZE }, (_, i) => emptyMember(i === 0));
  members[0] = { ...members[0], email: leadEmail, full_name: leadName ?? '' };

  return {
    team_name: '',
    members,
    primary_mentor: { full_name: '', contact: '', email: '', affiliation: 'piemr' },
    secondary_mentor: null,
  };
}

export function TeamRegistrationForm({
  mode,
  leadEmail,
  leadName,
  problemStatements,
  psListPublished,
  defaultValues,
}: Props) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const [successId, setSuccessId] = useState<string | null>(null);
  const [emailWarning, setEmailWarning] = useState<string | null>(null);
  const [showSecondary, setShowSecondary] = useState(
    Boolean(defaultValues?.secondary_mentor?.full_name),
  );

  const methods = useForm<RegistrationInput, unknown, RegistrationValues>({
    resolver: zodResolver(registrationSchema),
    defaultValues: defaultValues ?? buildDefaults(leadEmail, leadName),
    mode: 'onBlur',
  });

  const {
    register,
    handleSubmit,
    watch,
    setError,
    formState: { errors, isSubmitting },
  } = methods;

  const members = watch('members') ?? [];
  const femaleCount = members.filter((m) => m?.gender === 'female').length;
  const filledCount = members.filter(
    (m) => m?.full_name && m?.email && m?.enrollment_number && m?.phone,
  ).length;

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    setEmailWarning(null);

    // The secondary mentor is optional; drop it entirely when collapsed so
    // an empty object never reaches the server schema.
    const payload = {
      ...values,
      secondary_mentor:
        showSecondary && values.secondary_mentor?.full_name ? values.secondary_mentor : null,
    };

    try {
      const response = await fetch(
        mode === 'create' ? '/api/teams/register' : '/api/teams/update',
        {
          method: mode === 'create' ? 'POST' : 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
      );

      const result = await response.json();

      if (!response.ok || !result.ok) {
        // Map server-side collisions (another team already holds this
        // enrollment/email/phone) back onto the exact field.
        if (result.fieldErrors) {
          for (const [path, message] of Object.entries(
            result.fieldErrors as Record<string, string>,
          )) {
            const target = path.includes('.')
              ? path
              : members.findIndex(
                    (m) =>
                      String(m?.[path as keyof typeof m] ?? '').toLowerCase() ===
                      String(result.value ?? '').toLowerCase(),
                  ) >= 0
                ? `members.${members.findIndex(
                    (m) =>
                      String(m?.[path as keyof typeof m] ?? '').toLowerCase() ===
                      String(result.value ?? '').toLowerCase(),
                  )}.${path}`
                : path;

            setError(target as never, { type: 'server', message });
          }
        }

        setFormError(result.message ?? 'Registration could not be completed.');
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }

      if (mode === 'create') {
        setSuccessId(result.team_id_short);
        if (result.emailWarning) setEmailWarning(result.emailWarning);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        setFormError(null);
        router.refresh();
        setSuccessId(result.team_id_short);
      }
    } catch {
      setFormError('Network error. Your details were not saved — please try again.');
    }
  });

  if (successId && mode === 'create') {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className="card text-center"
      >
        <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500" />
        <h2 className="mt-4 text-2xl font-bold">Your team is registered</h2>
        <p className="mt-2 text-slate-600 dark:text-slate-400">
          Keep this Team ID — judges use it to pull up your submission on the day.
        </p>

        <div className="mx-auto mt-6 w-fit rounded-2xl border border-piemr-200 bg-piemr-50 px-10 py-5 dark:border-piemr-800 dark:bg-piemr-950">
          <p className="text-xs font-semibold uppercase tracking-widest text-piemr-700 dark:text-piemr-300">
            Team ID
          </p>
          <p className="mt-1 text-5xl font-black tracking-[0.15em] text-piemr-900 dark:text-white">
            {successId}
          </p>
        </div>

        <p className="mt-6 text-sm text-slate-600 dark:text-slate-400">
          {emailWarning
            ? 'Registration saved. Confirmation emails could not be delivered — your Team ID is shown above and on your dashboard.'
            : 'A confirmation email with your Team ID has gone out to all six members.'}
        </p>

        <button
          type="button"
          onClick={() => router.push('/dashboard/team')}
          className="btn-primary mt-6"
        >
          Go to my dashboard
        </button>
      </motion.div>
    );
  }

  return (
    <FormProvider {...methods}>
      <form onSubmit={onSubmit} className="space-y-8">
        <AnimatePresence>
          {formError && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              role="alert"
              className="flex gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 dark:border-rose-900 dark:bg-rose-950/40"
            >
              <AlertCircle className="h-5 w-5 shrink-0 text-rose-600 dark:text-rose-400" />
              <div>
                <p className="font-semibold text-rose-900 dark:text-rose-100">
                  Registration not completed
                </p>
                <p className="mt-0.5 text-sm text-rose-800 dark:text-rose-200">{formError}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {mode === 'edit' && successId && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100">
            Changes saved for team {successId}.
          </div>
        )}

        {/* ------------------------------------------------- team name */}
        <section className="card">
          <h2 className="text-lg font-bold">Team details</h2>
          <div className="mt-4 max-w-md">
            <label className="field-label" htmlFor="team_name">
              Team name
            </label>
            <input
              id="team_name"
              className="field-input"
              aria-invalid={Boolean(errors.team_name)}
              {...register('team_name')}
            />
            {errors.team_name && <p className="field-error">{errors.team_name.message}</p>}
          </div>
        </section>

        {/* --------------------------------------------------- members */}
        <section>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold">Team members</h2>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Exactly {TEAM_SIZE} members, including you as the team lead.
              </p>
            </div>

            <div className="flex gap-2">
              <span className="badge bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                <Users className="mr-1 h-3 w-3" />
                {filledCount}/{TEAM_SIZE} filled
              </span>
              <span
                className={
                  femaleCount >= MIN_FEMALE_MEMBERS
                    ? 'badge bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                    : 'badge bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                }
              >
                <UserCheck className="mr-1 h-3 w-3" />
                {femaleCount} female
              </span>
            </div>
          </div>

          {errors.members?.message && (
            <p className="mb-4 rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700 dark:bg-rose-950/50 dark:text-rose-300">
              {errors.members.message}
            </p>
          )}

          {femaleCount < MIN_FEMALE_MEMBERS && (
            <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
              Every team must include at least {MIN_FEMALE_MEMBERS} female member. You can still
              fill the form — this must be resolved before you can submit.
            </p>
          )}

          <div className="grid gap-4 lg:grid-cols-2">
            {Array.from({ length: TEAM_SIZE }, (_, index) => (
              <MemberFields
                key={index}
                index={index}
                problemStatements={problemStatements}
                psListPublished={psListPublished}
                lockLeadEmail={mode === 'create'}
              />
            ))}
          </div>
        </section>

        {/* --------------------------------------------------- mentors */}
        <section className="card">
          <h2 className="text-lg font-bold">Mentors</h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            The primary mentor is required and must be PIEMR faculty.
          </p>

          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            <div>
              <label className="field-label" htmlFor="pm-name">
                Primary mentor name
              </label>
              <input
                id="pm-name"
                className="field-input"
                aria-invalid={Boolean(errors.primary_mentor?.full_name)}
                {...register('primary_mentor.full_name')}
              />
              {errors.primary_mentor?.full_name && (
                <p className="field-error">{errors.primary_mentor.full_name.message}</p>
              )}
            </div>
            <div>
              <label className="field-label" htmlFor="pm-contact">
                Contact number
              </label>
              <input
                id="pm-contact"
                type="tel"
                inputMode="numeric"
                className="field-input"
                aria-invalid={Boolean(errors.primary_mentor?.contact)}
                {...register('primary_mentor.contact')}
              />
              {errors.primary_mentor?.contact && (
                <p className="field-error">{errors.primary_mentor.contact.message}</p>
              )}
            </div>
            <div>
              <label className="field-label" htmlFor="pm-email">
                PIEMR email
              </label>
              <input
                id="pm-email"
                type="email"
                className="field-input"
                placeholder="mentor@piemr.edu.in"
                aria-invalid={Boolean(errors.primary_mentor?.email)}
                {...register('primary_mentor.email')}
              />
              {errors.primary_mentor?.email && (
                <p className="field-error">{errors.primary_mentor.email.message}</p>
              )}
            </div>
          </div>

          <div className="mt-6 border-t border-slate-200 pt-5 dark:border-slate-800">
            <label className="flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                checked={showSecondary}
                onChange={(e) => setShowSecondary(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-piemr-600 focus:ring-piemr-500"
              />
              Add a secondary mentor (optional — PIEMR or industry)
            </label>

            <AnimatePresence>
              {showSecondary && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="mt-4 grid gap-4 sm:grid-cols-4">
                    <div>
                      <label className="field-label" htmlFor="sm-name">
                        Name
                      </label>
                      <input
                        id="sm-name"
                        className="field-input"
                        {...register('secondary_mentor.full_name')}
                      />
                      {errors.secondary_mentor?.full_name && (
                        <p className="field-error">{errors.secondary_mentor.full_name.message}</p>
                      )}
                    </div>
                    <div>
                      <label className="field-label" htmlFor="sm-contact">
                        Contact
                      </label>
                      <input
                        id="sm-contact"
                        type="tel"
                        inputMode="numeric"
                        className="field-input"
                        {...register('secondary_mentor.contact')}
                      />
                      {errors.secondary_mentor?.contact && (
                        <p className="field-error">{errors.secondary_mentor.contact.message}</p>
                      )}
                    </div>
                    <div>
                      <label className="field-label" htmlFor="sm-email">
                        Email
                      </label>
                      <input
                        id="sm-email"
                        type="email"
                        className="field-input"
                        {...register('secondary_mentor.email')}
                      />
                      {errors.secondary_mentor?.email && (
                        <p className="field-error">{errors.secondary_mentor.email.message}</p>
                      )}
                    </div>
                    <div>
                      <label className="field-label" htmlFor="sm-affiliation">
                        Affiliation
                      </label>
                      <select
                        id="sm-affiliation"
                        className="field-input"
                        {...register('secondary_mentor.affiliation')}
                      >
                        <option value="piemr">PIEMR</option>
                        <option value="industry">Industry</option>
                      </select>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </section>

        <div className="flex flex-wrap items-center gap-4">
          <button type="submit" disabled={isSubmitting} className="btn-primary">
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {mode === 'create' ? 'Submit registration' : 'Save changes'}
          </button>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {mode === 'create'
              ? 'You can edit these details from your dashboard until registration closes.'
              : 'Editing stays open until an administrator closes registration.'}
          </p>
        </div>
      </form>
    </FormProvider>
  );
}
