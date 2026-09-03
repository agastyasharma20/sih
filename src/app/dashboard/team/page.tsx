import Link from 'next/link';
import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { TeamRegistrationForm } from '@/components/registration/TeamRegistrationForm';
import type { ProblemStatement } from '@/lib/types';
import type { RegistrationInput } from '@/lib/validation/registration';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'My team · PIEMR Hackathon' };

/** Team Lead self-service: the same form, pre-filled, editable until an
 *  administrator locks registration. */
export default async function TeamDashboard() {
  const profile = await requireRole('team_lead');
  const supabase = createClient();

  const { data: team } = await supabase
    .from('teams')
    .select('id, team_id_short, team_name, status, registration_locked_at, created_at')
    .eq('created_by', profile.id)
    .maybeSingle();

  const [{ data: settingsRows }, { data: psRows }] = await Promise.all([
    supabase.from('settings').select('key, value'),
    supabase
      .from('problem_statements')
      .select('id, ps_id, title, category, theme, description, is_active')
      .eq('is_active', true)
      .order('ps_id'),
  ]);

  const settings = new Map((settingsRows ?? []).map((r) => [r.key as string, r.value]));
  const registrationOpen = settings.get('registration_open') === true;

  if (!team) {
    return (
      <div className="card max-w-xl">
        <h1 className="text-xl font-bold">No team registered yet</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          {registrationOpen
            ? 'Register your team to receive your 3-digit Team ID.'
            : 'Registration is not open at the moment. Watch the event page for the announcement.'}
        </p>
        {registrationOpen && (
          <Link href="/register" className="btn-primary mt-5">
            Register your team
          </Link>
        )}
      </div>
    );
  }

  const [{ data: members }, { data: mentors }] = await Promise.all([
    supabase
      .from('members')
      .select(
        'is_lead, full_name, gender, branch, year, enrollment_number, email, phone, tentative_ps_id',
      )
      .eq('team_id', team.id)
      .order('is_lead', { ascending: false })
      .order('created_at'),
    supabase
      .from('mentors')
      .select('type, full_name, contact, email, affiliation')
      .eq('team_id', team.id),
  ]);

  const psById = new Map((psRows ?? []).map((ps) => [ps.id as string, ps.ps_id as string]));
  const primary = mentors?.find((m) => m.type === 'primary');
  const secondary = mentors?.find((m) => m.type === 'secondary');

  const defaults: RegistrationInput = {
    team_name: team.team_name,
    members: (members ?? []).map((m) => ({
      is_lead: m.is_lead,
      full_name: m.full_name,
      gender: m.gender,
      branch: m.branch,
      year: m.year,
      enrollment_number: m.enrollment_number,
      email: m.email,
      phone: m.phone,
      tentative_ps_id: m.tentative_ps_id ? (psById.get(m.tentative_ps_id) ?? 'TBD') : 'TBD',
    })),
    primary_mentor: {
      full_name: primary?.full_name ?? '',
      contact: primary?.contact ?? '',
      email: primary?.email ?? '',
      affiliation: 'piemr',
    },
    secondary_mentor: secondary
      ? {
          full_name: secondary.full_name,
          contact: secondary.contact,
          email: secondary.email,
          affiliation: secondary.affiliation,
        }
      : null,
  };

  const locked = Boolean(team.registration_locked_at) || !registrationOpen;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-6 rounded-2xl bg-gradient-to-r from-piemr-700 to-sih-navy p-6 text-white">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-piemr-200">
            {team.team_name}
          </p>
          <p className="mt-1 text-sm text-slate-300">
            Status: <span className="font-semibold capitalize">{team.status}</span>
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs font-semibold uppercase tracking-widest text-piemr-200">Team ID</p>
          <p className="text-4xl font-black tracking-[0.15em]">{team.team_id_short}</p>
        </div>
      </div>

      {locked ? (
        <>
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
            Registration is closed — your team details are locked. Contact the SIH SPOC if
            something needs correcting.
          </div>

          <section className="card">
            <h2 className="text-lg font-bold">Team members</h2>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="pb-2 pr-4">Name</th>
                    <th className="pb-2 pr-4">Enrollment</th>
                    <th className="pb-2 pr-4">Branch</th>
                    <th className="pb-2 pr-4">Year</th>
                    <th className="pb-2 pr-4">Email</th>
                    <th className="pb-2">Phone</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {(members ?? []).map((m) => (
                    <tr key={m.enrollment_number}>
                      <td className="py-2 pr-4 font-medium">
                        {m.full_name}
                        {m.is_lead && (
                          <span className="ml-2 badge bg-amber-100 text-amber-800">Lead</span>
                        )}
                      </td>
                      <td className="py-2 pr-4">{m.enrollment_number}</td>
                      <td className="py-2 pr-4">{m.branch}</td>
                      <td className="py-2 pr-4">{m.year}</td>
                      <td className="py-2 pr-4">{m.email}</td>
                      <td className="py-2">{m.phone}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : (
        <>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Edit your team</h1>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Changes stay open until an administrator closes registration.
            </p>
          </div>

          <TeamRegistrationForm
            mode="edit"
            leadEmail={profile.email}
            leadName={profile.full_name}
            problemStatements={(psRows ?? []) as ProblemStatement[]}
            psListPublished={settings.get('ps_list_published') === true}
            defaultValues={defaults}
          />
        </>
      )}
    </div>
  );
}
