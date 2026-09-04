'use client';

import Image from 'next/image';
import { useState } from 'react';
import { SIH_LOGO, SIH_EDITION } from '@/lib/branding';

/**
 * Smart India Hackathon lockup for the hero.
 *
 * Shows the official mark when one has been saved into public/, and a
 * text lockup otherwise — accurate either way, and never a broken image
 * or a stale logo from a previous edition.
 */
export function SihMark() {
  const [failed, setFailed] = useState(false);
  const src = failed ? null : SIH_LOGO;

  if (src) {
    return (
      <span className="inline-flex items-center gap-3 rounded-2xl border border-white/15 bg-white/95 px-4 py-2.5 shadow-lg">
        <Image
          src={src}
          alt={SIH_EDITION}
          width={132}
          height={44}
          priority
          onError={() => setFailed(true)}
          className="h-11 w-auto object-contain"
        />
        <span className="text-xs font-semibold uppercase tracking-wider text-sih-navy">
          Internal Round
        </span>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-sih-saffron/40 bg-sih-saffron/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-sih-saffron">
      <span aria-hidden className="flex gap-0.5">
        <span className="h-1.5 w-1.5 rounded-full bg-sih-saffron" />
        <span className="h-1.5 w-1.5 rounded-full bg-white/80" />
        <span className="h-1.5 w-1.5 rounded-full bg-sih-green" />
      </span>
      {SIH_EDITION} · Internal Round
    </span>
  );
}
