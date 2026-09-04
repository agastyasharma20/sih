'use client';

import Image from 'next/image';
import { motion } from 'framer-motion';
import { ExternalLink } from 'lucide-react';
import { LEADERSHIP, initialsFor } from '@/lib/leadership';

/** Named leadership behind the institute's SIH participation. */
export function Leadership() {
  return (
    <section className="border-y border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
      <div className="mx-auto max-w-6xl px-6 py-20">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-piemr-600 dark:text-piemr-400">
            PIEMR Leadership for SIH
          </p>
          <h2 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
            Who is running this round
          </h2>
          <p className="mt-3 text-slate-600 dark:text-slate-400">
            The internal hackathon is run under the institute&apos;s leadership, and its
            outcome decides which teams represent PIEMR at the Smart India Hackathon.
          </p>
        </div>

        <div className="mt-10 grid gap-6 md:grid-cols-2">
          {LEADERSHIP.map((leader, index) => (
            <motion.article
              key={leader.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:shadow-md dark:border-slate-800 dark:bg-slate-900/60"
            >
              {/* Accent bar keeps the two cards visually paired. */}
              <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-piemr-600 via-sih-saffron to-sih-green" />

              <div className="flex items-start gap-5">
                {leader.photo ? (
                  <Image
                    src={leader.photo}
                    alt={leader.name}
                    width={88}
                    height={88}
                    className="h-22 w-22 shrink-0 rounded-2xl object-cover ring-1 ring-slate-200 dark:ring-slate-700"
                  />
                ) : (
                  <div
                    aria-hidden
                    className="flex h-[88px] w-[88px] shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-piemr-600 to-sih-navy text-2xl font-black tracking-wide text-white shadow-inner"
                  >
                    {initialsFor(leader.name)}
                  </div>
                )}

                <div className="min-w-0">
                  <span className="badge bg-sih-saffron/15 text-sih-saffron">{leader.role}</span>
                  <h3 className="mt-2 text-lg font-bold leading-tight">{leader.name}</h3>
                  <p className="text-sm font-medium text-piemr-700 dark:text-piemr-400">
                    {leader.title}
                  </p>
                </div>
              </div>

              <p className="mt-5 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                {leader.bio}
              </p>

              <ul className="mt-4 space-y-2">
                {leader.highlights.map((highlight) => (
                  <li
                    key={highlight}
                    className="flex gap-2.5 text-sm text-slate-600 dark:text-slate-400"
                  >
                    <span
                      aria-hidden
                      className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-piemr-500"
                    />
                    {highlight}
                  </li>
                ))}
              </ul>

              {leader.profileUrl && (
                <a
                  href={leader.profileUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-piemr-600 hover:text-piemr-700 dark:text-piemr-400"
                >
                  Profile
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}
