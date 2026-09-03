import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireProfile } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { TeamRegistrationForm } from '@/components/registration/TeamRegistrationForm';
import { Brand, BrandFooter } from '@/components/Brand';
import type { ProblemStatement } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Register your team · PIEMR Hackathon' };

export default async function RegisterPage() {
  const profile = await requireProfile();
  const supabase = createClient();

  // Staff accounts have no registration to make.
  if (profile.role !== 'team_lead') redirect('/dashboard');

  const [{ data: settingsRows }, { data: existingTeam }, { data: psRows }] = await Promise.all([
    supabase.from('settings').select('key, value'),
    supabase.from('teams').select('id').eq('created_by', profile.id).maybeSingle(),
    supabase
      .from('problem_statements')
      .select('id, ps_id, title, category, theme, description, is_active')
      .eq('is_active', true)
      .order('ps_id'),
  ]);

  // One team per lead — send repeat visitors to the edit view.
  if (existingTeam) redirect('/dashboard/team');

  const settings = new Map((settingsRows ?? []).map((r) => [r.key as string, r.value]));
  const registrationOpen = settings.get('registration_open') === true;

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Brand />
          <form action="/auth/signout" method="post">
            <button type="submit" className="text-sm font-medium text-slate-500 hover:text-piemr-600">
              Sign out
            </button>
          </form>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">
        <h1 className="text-3xl font-black tracking-tight">Register your team</h1>
        <p className="mt-2 max-w-2xl text-slate-600 dark:text-slate-400">
          Six members, one PIEMR faculty mentor, and at least one female member. Your 3-digit
          Team ID is issued as soon as you submit.
        </p>

        {registrationOpen ? (
          <div className="mt-8">
            <TeamRegistrationForm
              mode="create"
              leadEmail={profile.email}
              leadName={profile.full_name}
              problemStatements={(psRows ?? []) as ProblemStatement[]}
              psListPublished={settings.get('ps_list_published') === true}
            />
          </div>
        ) : (
          <div className="card mt-8 max-w-xl">
            <h2 className="text-lg font-bold">Registration is closed</h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              Team registration is not open at the moment. Watch the event page for the
              announcement, or contact the SIH SPOC if you believe this is an error.
            </p>
            <Link href="/" className="btn-secondary mt-5">
              Back to the event page
            </Link>
          </div>
        )}
      </main>

      <BrandFooter />
    </div>
  );
}
