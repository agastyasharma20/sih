import Link from 'next/link';
import { ClipboardList, Gavel, Trophy, Users2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getSessionProfile, dashboardPathFor } from '@/lib/auth';
import { Hero } from '@/components/landing/Hero';
import { Leadership } from '@/components/landing/Leadership';
import { Reveal, RevealGroup, RevealItem } from '@/components/motion/Reveal';
import { Brand, BrandFooter } from '@/components/Brand';
import { ThemeToggle } from '@/components/ThemeToggle';
import { formatEventDate } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const STAGES = [
  {
    icon: Users2,
    title: 'Register your team',
    body: 'Six members, one team lead, at least one female member, and a PIEMR faculty mentor. You get a 3-digit Team ID on submission.',
  },
  {
    icon: ClipboardList,
    title: 'Pick a problem statement',
    body: 'Browse the official SIH problem statements and lock in up to two ideas for your team.',
  },
  {
    icon: Gavel,
    title: 'Pitch to the panel',
    body: 'Present against the published rubric. Judges pull up your submission using your Team ID.',
  },
  {
    icon: Trophy,
    title: 'Make the roster',
    body: 'Selected teams go forward as PIEMR’s entries to the Smart India Hackathon.',
  },
];

export default async function LandingPage() {
  const supabase = createClient();
  const profile = await getSessionProfile();

  // Counts come from an aggregate function rather than a table read: the
  // teams and members tables are closed to anonymous visitors by RLS, so
  // querying them directly would show a logged-out visitor zeroes.
  const [settingsResult, statsResult] = await Promise.all([
    supabase.from('settings').select('key, value'),
    supabase.rpc('public_stats'),
  ]);

  const stats = (statsResult.data ?? {}) as {
    teams?: number;
    participants?: number;
    problem_statements?: number;
  };

  const settings = new Map(
    (settingsResult.data ?? []).map((row) => [row.key as string, row.value]),
  );

  const registrationOpen = settings.get('registration_open') === true;
  const eventName = (settings.get('event_name') as string) ?? 'PIEMR Internal Hackathon';

  return (
    <div className="flex min-h-screen flex-col">
      <header className="absolute inset-x-0 top-0 z-20">
        <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <div className="[&_p]:!text-white [&_p+p]:!text-piemr-200">
            <Brand />
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/problem-statements"
              className="hidden text-sm font-medium text-slate-200 hover:text-white sm:block"
            >
              Problem statements
            </Link>
            <Link
              href="/results"
              className="hidden text-sm font-medium text-slate-200 hover:text-white sm:block"
            >
              Results
            </Link>
            <span className="[&_button]:text-slate-300 [&_button:hover]:bg-white/10 [&_button:hover]:text-white">
              <ThemeToggle />
            </span>
            {profile ? (
              <Link href={dashboardPathFor(profile.role)} className="btn-primary">
                Dashboard
              </Link>
            ) : (
              <Link
                href="/login"
                className="btn border border-white/20 text-white hover:bg-white/10"
              >
                Sign in
              </Link>
            )}
          </div>
        </nav>
      </header>

      <main className="flex-1">
        <Hero
          eventName={eventName}
          hackathonDate={formatEventDate(settings.get('hackathon_date'))}
          hackathonDateRaw={(settings.get('hackathon_date') as string | null) ?? null}
          registrationOpen={registrationOpen}
          teamCount={stats.teams ?? 0}
          participantCount={stats.participants ?? 0}
          problemStatementCount={stats.problem_statements ?? 0}
        />

        <section className="mx-auto max-w-6xl px-6 py-20">
          <Reveal>
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">How the round works</h2>
            <p className="mt-2 max-w-2xl text-slate-600 dark:text-slate-400">
              Four stages, from registration through to the institute&apos;s final SIH roster.
            </p>
          </Reveal>

          <RevealGroup className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {STAGES.map((stage, index) => (
              <RevealItem key={stage.title} className="card h-full">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-piemr-50 text-piemr-700 dark:bg-piemr-950 dark:text-piemr-300">
                  <stage.icon className="h-5 w-5" />
                </div>
                <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Stage {index + 1}
                </p>
                <h3 className="mt-1 font-semibold">{stage.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                  {stage.body}
                </p>
              </RevealItem>
            ))}
          </RevealGroup>
        </section>

        <Leadership />

        <section className="bg-slate-50 dark:bg-slate-900/40">
          <RevealGroup className="mx-auto grid max-w-6xl gap-8 px-6 py-16 sm:grid-cols-3">
            {(
              [
                ['Problem statements released', 'ps_release_date'],
                ['Submission deadline', 'submission_deadline'],
                ['Hackathon day', 'hackathon_date'],
              ] as const
            ).map(([label, key]) => (
              <RevealItem key={key}>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  {label}
                </p>
                <p className="mt-2 text-xl font-bold">{formatEventDate(settings.get(key))}</p>
              </RevealItem>
            ))}
          </RevealGroup>
        </section>
      </main>

      <BrandFooter />
    </div>
  );
}
