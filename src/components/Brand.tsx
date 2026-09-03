import Link from 'next/link';
import { PIEMR_SITE, SIH_SITE } from '@/lib/constants';

/**
 * Institutional lockup. The logos are loaded from the live PIEMR and SIH
 * sites rather than vendored, so a mid-year rebrand (SIH refreshes its
 * identity each edition) does not leave a stale asset in the repo.
 */
export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className="flex items-center gap-3">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-piemr-600 to-piemr-900 text-sm font-black text-white shadow-md">
        PI
      </div>
      {!compact && (
        <div className="leading-tight">
          <p className="text-sm font-bold tracking-tight text-slate-900 dark:text-white">
            PIEMR Hackathon
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            SIH Internal Selection
          </p>
        </div>
      )}
    </Link>
  );
}

export function BrandFooter() {
  return (
    <footer className="border-t border-slate-200 bg-white py-8 dark:border-slate-800 dark:bg-slate-950">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 text-sm text-slate-500 sm:flex-row dark:text-slate-400">
        <p>
          Prestige Institute of Engineering Management &amp; Research, Indore
        </p>
        <div className="flex items-center gap-5">
          <a
            href={PIEMR_SITE}
            target="_blank"
            rel="noreferrer noopener"
            className="hover:text-piemr-600 dark:hover:text-piemr-400"
          >
            piemr.edu.in
          </a>
          <a
            href={SIH_SITE}
            target="_blank"
            rel="noreferrer noopener"
            className="hover:text-sih-saffron"
          >
            sih.gov.in
          </a>
        </div>
      </div>
    </footer>
  );
}
