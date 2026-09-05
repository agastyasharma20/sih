import { requireProfile, isAdminTier, isSpoc } from '@/lib/auth';
import { Brand, BrandFooter } from '@/components/Brand';
import { ThemeToggle } from '@/components/ThemeToggle';
import { DashboardNav, type NavLink } from '@/components/DashboardNav';

export const dynamic = 'force-dynamic';

/**
 * Shell for every authenticated area. The navigation is built from the
 * signed-in role, and the super-admin tier renders exactly the admin
 * navigation — no extra menu, no role label that would reveal it exists.
 */
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireProfile();

  const links: NavLink[] = [];

  if (isAdminTier(profile.role)) {
    links.push(
      { href: '/dashboard/admin', label: 'Overview' },
      { href: '/dashboard/admin/teams', label: 'Teams' },
      { href: '/dashboard/admin/analytics', label: 'Analytics' },
      { href: '/dashboard/admin/results', label: 'Results' },
    );
    // Operational screens belong to the SPOC; a Sr. Director is read-heavy.
    if (isSpoc(profile)) {
      links.push(
        { href: '/dashboard/admin/problem-statements', label: 'Problem statements' },
        { href: '/dashboard/admin/settings', label: 'Settings' },
      );
    }
    links.push({ href: '/dashboard/admin/audit', label: 'Audit log' });
  } else if (profile.role === 'coordinator') {
    links.push({ href: '/dashboard/coordinator', label: 'Team roster' });
  } else if (profile.role === 'judge') {
    links.push({ href: '/dashboard/judge', label: 'Judging' });
  } else {
    links.push(
      { href: '/dashboard/team', label: 'My team' },
      { href: '/dashboard/team/submit', label: 'Submit idea' },
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/85 backdrop-blur-md supports-[backdrop-filter]:bg-white/70 dark:border-slate-800 dark:bg-slate-950/85 dark:supports-[backdrop-filter]:bg-slate-950/70">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-8">
            <Brand />
            <DashboardNav links={links} />
          </div>

          <div className="flex items-center gap-3">
            <ThemeToggle />
            <span className="hidden text-sm text-slate-500 sm:block dark:text-slate-400">
              {profile.full_name ?? profile.email}
            </span>
            <form action="/auth/signout" method="post">
              <button type="submit" className="btn-secondary py-1.5 text-xs">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">{children}</main>

      <BrandFooter />
    </div>
  );
}
