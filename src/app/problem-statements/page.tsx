import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { Brand, BrandFooter } from '@/components/Brand';
import { SIH_SITE } from '@/lib/constants';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Problem statements · PIEMR Hackathon' };

/** Public browse view. Filtering runs off the query string so the page
 *  stays a server component and remains linkable. */
export default async function ProblemStatementsPage({
  searchParams,
}: {
  searchParams: { category?: string; theme?: string };
}) {
  const supabase = createClient();

  const [{ data: rows }, { data: settingsRows }] = await Promise.all([
    supabase
      .from('problem_statements')
      .select('id, ps_id, title, category, theme, description')
      .eq('is_active', true)
      .order('ps_id'),
    supabase.from('settings').select('key, value').eq('key', 'ps_list_published').single(),
  ]);

  const published = settingsRows?.value === true;
  const all = rows ?? [];
  const themes = Array.from(new Set(all.map((r) => r.theme).filter(Boolean))) as string[];

  const filtered = all.filter(
    (ps) =>
      (!searchParams.category || ps.category === searchParams.category) &&
      (!searchParams.theme || ps.theme === searchParams.theme),
  );

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Brand />
          <Link href="/login" className="btn-secondary py-1.5 text-xs">
            Sign in
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">
        <h1 className="text-3xl font-black tracking-tight">Problem statements</h1>
        <p className="mt-2 max-w-2xl text-slate-600 dark:text-slate-400">
          Sourced from the official Smart India Hackathon list. Browse them before choosing what
          your team will build.
        </p>

        {!published && all.length === 0 ? (
          <div className="card mt-8 max-w-xl">
            <h2 className="text-lg font-bold">Not published yet</h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              The problem statement list for this edition has not been released. Teams can
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
          <>
            <div className="mt-8 flex flex-wrap gap-2">
              <FilterChip href="/problem-statements" label="All" active={!searchParams.category && !searchParams.theme} />
              <FilterChip
                href="/problem-statements?category=software"
                label="Software"
                active={searchParams.category === 'software'}
              />
              <FilterChip
                href="/problem-statements?category=hardware"
                label="Hardware"
                active={searchParams.category === 'hardware'}
              />
              {themes.map((theme) => (
                <FilterChip
                  key={theme}
                  href={`/problem-statements?theme=${encodeURIComponent(theme)}`}
                  label={theme}
                  active={searchParams.theme === theme}
                />
              ))}
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {filtered.map((ps) => (
                <article key={ps.id} className="card">
                  <div className="flex items-center gap-3">
                    <span className="rounded-md bg-piemr-600 px-2 py-1 font-mono text-xs font-bold text-white">
                      {ps.ps_id}
                    </span>
                    <span className="badge bg-slate-100 capitalize text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                      {ps.category}
                    </span>
                    {ps.theme && (
                      <span className="badge bg-sih-saffron/15 text-sih-saffron">{ps.theme}</span>
                    )}
                  </div>
                  <h2 className="mt-3 font-semibold leading-snug">{ps.title}</h2>
                  {ps.description && (
                    <p className="mt-2 line-clamp-4 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                      {ps.description}
                    </p>
                  )}
                </article>
              ))}
            </div>

            {filtered.length === 0 && (
              <p className="mt-8 text-sm text-slate-500">
                No problem statements match that filter.
              </p>
            )}
          </>
        )}
      </main>

      <BrandFooter />
    </div>
  );
}

function FilterChip({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={
        active
          ? 'rounded-full bg-piemr-600 px-3 py-1.5 text-xs font-semibold text-white'
          : 'rounded-full border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:border-piemr-400 dark:border-slate-700 dark:text-slate-300'
      }
    >
      {label}
    </Link>
  );
}
