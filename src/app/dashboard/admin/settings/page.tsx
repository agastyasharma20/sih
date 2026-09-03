import { redirect } from 'next/navigation';
import { requireProfile, isSpoc } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { SettingsForm } from '@/components/admin/SettingsForm';
import { CreateAccountForm } from '@/components/admin/CreateAccountForm';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Event settings · PIEMR Hackathon' };

export default async function AdminSettingsPage() {
  const profile = await requireProfile();

  // Sr. Directors are read-heavy; operational config belongs to the SPOC.
  if (!isSpoc(profile)) redirect('/dashboard/admin');

  const supabase = createClient();
  const { data: rows } = await supabase.from('settings').select('key, value, description');

  const settings = Object.fromEntries((rows ?? []).map((r) => [r.key as string, r.value]));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Event settings</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Dates and switches are stored in the database, not in the code. Leave a date blank
          while it is still to be decided.
        </p>
      </div>

      <SettingsForm initial={settings} />

      <CreateAccountForm canCreateAdmin={profile.role === 'super_admin'} />
    </div>
  );
}
