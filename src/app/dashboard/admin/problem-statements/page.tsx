import { redirect } from 'next/navigation';
import { requireProfile, isSpoc } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { ProblemStatementManager } from '@/components/admin/ProblemStatementManager';
import type { ProblemStatement } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Problem statements · PIEMR Hackathon' };

export default async function AdminProblemStatementsPage() {
  const profile = await requireProfile();
  if (!isSpoc(profile)) redirect('/dashboard/admin');

  const supabase = createClient();
  const { data } = await supabase
    .from('problem_statements')
    .select('id, ps_id, title, category, theme, description, is_active')
    .order('ps_id');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Problem statements</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Import the official Smart India Hackathon list. Teams pick from these during
          registration, and they appear on the public listing page.
        </p>
      </div>

      <ProblemStatementManager statements={(data ?? []) as ProblemStatement[]} />
    </div>
  );
}
