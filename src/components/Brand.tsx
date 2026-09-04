'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState } from 'react';
import { Heart, Mail, ExternalLink } from 'lucide-react';
import { PIEMR_SITE, SIH_SITE } from '@/lib/constants';
import { PIEMR_LOGO, PIEMR_MONOGRAM } from '@/lib/branding';

/**
 * Institutional lockup. Uses the real logo when one is configured in
 * src/lib/branding.ts, and a monogram otherwise — including when a
 * configured image fails to load, so a moved file never leaves a broken
 * icon in the header of every page.
 */
export function Brand({ compact = false }: { compact?: boolean }) {
  const [logoFailed, setLogoFailed] = useState(false);
  const logoSrc = logoFailed ? null : PIEMR_LOGO;

  return (
    <Link href="/" className="flex items-center gap-3">
      {logoSrc ? (
        // A light backing keeps the institute's colour logo legible on the
        // dark hero header as well as on white pages, and w-auto lets a
        // wordmark keep its own proportions instead of being squeezed
        // into a square. unoptimized because the asset is an SVG.
        <span className="flex h-10 items-center rounded-lg bg-white px-2 shadow-sm ring-1 ring-black/5">
          <Image
            src={logoSrc}
            alt="Prestige Institute of Engineering Management & Research"
            width={150}
            height={36}
            priority
            unoptimized
            className="h-7 w-auto max-w-[150px] object-contain"
            onError={() => setLogoFailed(true)}
          />
        </span>
      ) : (
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-piemr-600 to-piemr-900 text-sm font-black text-white shadow-md">
          {PIEMR_MONOGRAM}
        </div>
      )}

      {!compact && (
        <div className="leading-tight">
          <p className="text-sm font-bold tracking-tight text-slate-900 dark:text-white">
            PIEMR Hackathon
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">SIH Internal Selection</p>
        </div>
      )}
    </Link>
  );
}

export function BrandFooter() {
  return (
    <footer className="border-t border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-start">
          <div>
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              Prestige Institute of Engineering Management &amp; Research
            </p>
            <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
              Indore, Madhya Pradesh
            </p>
          </div>

          <div className="flex items-center gap-5 text-sm">
            <a
              href={PIEMR_SITE}
              target="_blank"
              rel="noreferrer noopener"
              className="text-slate-500 transition hover:text-piemr-600 dark:text-slate-400"
            >
              piemr.edu.in
            </a>
            <a
              href={SIH_SITE}
              target="_blank"
              rel="noreferrer noopener"
              className="text-slate-500 transition hover:text-sih-saffron dark:text-slate-400"
            >
              sih.gov.in
            </a>
          </div>
        </div>

        <div className="mt-8 flex flex-col items-center gap-3 border-t border-slate-200 pt-6 sm:flex-row sm:justify-between dark:border-slate-800">
          <p className="flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400">
            Designed &amp; developed by
            <span className="font-semibold text-slate-700 dark:text-slate-200">
              Agastya Sharma
            </span>
            with
            <Heart
              className="h-3.5 w-3.5 fill-rose-500 text-rose-500"
              aria-label="love"
            />
          </p>

          <div className="flex items-center gap-4">
            <a
              href="mailto:work.agastya20@gmail.com"
              className="inline-flex items-center gap-1.5 text-sm text-slate-500 transition hover:text-piemr-600 dark:text-slate-400"
            >
              <Mail className="h-4 w-4" />
              work.agastya20@gmail.com
            </a>
            <a
              href="https://www.linkedin.com/in/agastya20"
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center gap-1.5 text-sm text-slate-500 transition hover:text-piemr-600 dark:text-slate-400"
            >
              <ExternalLink className="h-4 w-4" />
              LinkedIn
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
