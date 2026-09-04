import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { Brand, BrandFooter } from '@/components/Brand';
import { ThemeToggle } from '@/components/ThemeToggle';
import { SIH_SITE } from '@/lib/constants';
import { ProblemStatementBrowser } from '@/components/ProblemStatementBrowser';
import type { ProblemStatement } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Problem statements · PIEMR Hackathon' };

/** Public catalogue. The whole active list is sent once and filtered in
 *  the browser — with a few hundred statements that is far faster than a
 *  request per keystroke, and it works while scrolling on a phone. */
export default async function ProblemStatementsPage() {
  const supabase = createClient();

  const [{ data: rows }, { data: publishedRow }] = await Promise.all([
    supabase
      .from('problem_statements')
      .select('id, ps_id, title, category, theme, description, organisation, is_active')
      .eq('is_active', true)
      .order('ps_id'),
    supabase.from('settings').select('value').eq('key', 'ps_list_published').maybeSingle(),
  ]);

  const statements = (rows ?? []) as Array<ProblemStatement & { organisation?: string | null }>;
  const published = publishedRow?.value === true;

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Brand />
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Link href="/login" className="btn-secondary py-1.5 text-xs">
              Sign in
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">
        <h1 className="text-3xl font-black tracking-tight">Problem statements</h1>
        <p className="mt-2 max-w-2xl text-slate-600 dark:text-slate-400">
          The official Smart India Hackathon list. Search it before choosing what your team
          will build — you lock in the final choice when you submit your idea.
        </p>

        {statements.length === 0 ? (
          <div className="card mt-8 max-w-xl">
            <h2 className="text-lg font-bold">
              {published ? 'Nothing published yet' : 'Not published yet'}
            </h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              The problem statement list for this edition has not been released here. Teams can
              register now and leave their choice as TBD.
            </p>
            <a
              href={SIH_SITE}
              target="_blank"
              rel="noreferrer noopener"
              className="btn-secondary mt-5"
            >
              Check sih.gov.in
            </a>
          </div>
        ) : (
          <div className="mt-8">
            <ProblemStatementBrowser statements={statements} />
          </div>
        )}
      </main>

      <BrandFooter />
    </div>
  );
}
