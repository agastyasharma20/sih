'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';

export interface NavLink {
  href: string;
  label: string;
}

/**
 * Primary navigation for the authenticated shell.
 *
 * The active pill is one shared layout element rather than a per-link
 * transition, so it slides between destinations instead of cross-fading.
 * Matching is longest-prefix: "/dashboard/admin" must not light up while
 * the reader is on "/dashboard/admin/teams".
 */
export function DashboardNav({ links }: { links: NavLink[] }) {
  const pathname = usePathname();

  const active = links.reduce<string | null>((best, link) => {
    const matches = pathname === link.href || pathname.startsWith(`${link.href}/`);
    if (!matches) return best;
    return best && best.length >= link.href.length ? best : link.href;
  }, null);

  return (
    <nav className="scrollbar-none -mx-1 flex max-w-full items-center gap-1 overflow-x-auto px-1 text-sm font-medium">
      {links.map((link) => {
        const selected = link.href === active;

        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={selected ? 'page' : undefined}
            className={`relative shrink-0 rounded-full px-3 py-1.5 transition ${
              selected
                ? 'text-piemr-700 dark:text-piemr-200'
                : 'text-slate-600 hover:text-piemr-600 dark:text-slate-300 dark:hover:text-piemr-300'
            }`}
          >
            {selected && (
              <motion.span
                layoutId="dashboard-nav-pill"
                className="absolute inset-0 rounded-full bg-piemr-100 dark:bg-piemr-950/70"
                transition={{ type: 'spring', stiffness: 400, damping: 34 }}
              />
            )}
            <span className="relative">{link.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
