import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { Brand, BrandFooter } from '@/components/Brand';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Trophy } from 'lucide-react';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Results · PIEMR Hackathon' };

interface PublicResult {
  team_id_short: string;
  team_name: string;
  ps_id: string | null;
  ps_title: string | null;
}

/** Public listing of selected teams. Marks are never exposed here — the
 *  feed function returns names and problem statements only. */
export default async function PublicResultsPage() {
  const supabase = createClient();
  const { data } = await supabase.rpc('public_results');

  const feed = (data ?? { published: false, teams: [] }) as {
    published: boolean;
    teams: PublicResult[];
  };

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Brand />
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Link href="/login" className="btn-secondary py-1.5 text-xs">
              Sign in
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-12">
        <h1 className="text-3xl font-black tracking-tight">Results</h1>

        {!feed.published ? (
          <div className="card mt-8 max-w-xl">
            <h2 className="text-lg font-bold">Not announced yet</h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              Results for the internal round have not been published. Team leads will see their
              own result on their dashboard as soon as it is released.
            </p>
            <Link href="/" className="btn-secondary mt-5">
              Back to the event page
            </Link>
          </div>
        ) : (
          <>
            <p className="mt-2 text-slate-600 dark:text-slate-400">
              {feed.teams.length} team{feed.teams.length === 1 ? '' : 's'} selected to represent
              PIEMR at the Smart India Hackathon.
            </p>

            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              {feed.teams.map((team) => (
                <article
                  key={`${team.team_id_short}-${team.ps_id ?? ''}`}
                  className="card flex gap-4"
                >
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-sih-saffron/15 text-sih-saffron">
                    <Trophy className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-mono text-xs font-bold text-slate-500">
                      Team {team.team_id_short}
                    </p>
                    <h2 className="font-semibold">{team.team_name}</h2>
                    {team.ps_id && (
                      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                        {team.ps_id} — {team.ps_title}
                      </p>
                    )}
                  </div>
                </article>
              ))}
            </div>

            {feed.teams.length === 0 && (
              <p className="mt-8 text-sm text-slate-500">No teams have been selected yet.</p>
            )}
          </>
        )}
      </main>

      <BrandFooter />
    </div>
  );
}
