import Link from 'next/link';
import { requireProfile, isAdminTier, isSpoc } from '@/lib/auth';
import { Brand, BrandFooter } from '@/components/Brand';

export const dynamic = 'force-dynamic';

/**
 * Shell for every authenticated area. The navigation is built from the
 * signed-in role, and the super-admin tier renders exactly the admin
 * navigation — no extra menu, no role label that would reveal it exists.
 */
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireProfile();

  const links: Array<{ href: string; label: string }> = [];

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
      <header className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-8">
            <Brand />
            <nav className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm font-medium">
              {links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-slate-600 transition hover:text-piemr-600 dark:text-slate-300"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-4">
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
