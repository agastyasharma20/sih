'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight, CalendarDays, Users } from 'lucide-react';
import { StatCounter } from './StatCounter';
import { Countdown } from './Countdown';

interface HeroProps {
  eventName: string;
  hackathonDate: string;
  /** Raw ISO date for the live clock; null while the schedule is TBD. */
  hackathonDateRaw: string | null;
  registrationOpen: boolean;
  teamCount: number;
  participantCount: number;
  problemStatementCount: number;
}

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.6, ease: [0.22, 1, 0.36, 1] as const },
  }),
};

export function Hero({
  eventName,
  hackathonDate,
  hackathonDateRaw,
  registrationOpen,
  teamCount,
  participantCount,
  problemStatementCount,
}: HeroProps) {
  return (
    <section className="relative overflow-hidden bg-sih-navy">
      <div className="hero-mesh absolute inset-0 animate-gradient-pan opacity-90" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_35%,rgba(11,20,55,0.85)_100%)]" />

      <div className="relative mx-auto max-w-6xl px-6 py-24 sm:py-32">
        <motion.div initial="hidden" animate="show" className="max-w-3xl">
          <motion.span
            variants={fadeUp}
            custom={0}
            className="inline-flex items-center gap-2 rounded-full border border-sih-saffron/40 bg-sih-saffron/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-sih-saffron"
          >
            Smart India Hackathon · Internal Round
          </motion.span>

          <motion.h1
            variants={fadeUp}
            custom={1}
            className="mt-6 text-4xl font-black leading-[1.05] tracking-tight text-white sm:text-6xl"
          >
            {eventName}
            <span className="block bg-gradient-to-r from-sih-saffron via-white to-sih-green bg-clip-text text-transparent">
              Build. Pitch. Represent PIEMR.
            </span>
          </motion.h1>

          <motion.p
            variants={fadeUp}
            custom={2}
            className="mt-6 max-w-2xl text-lg leading-relaxed text-slate-300"
          >
            Teams of six compete for a place on the institute&apos;s Smart India Hackathon
            roster. Register your team, lock in a problem statement, and take it to the
            judging panel.
          </motion.p>

          <motion.div variants={fadeUp} custom={3} className="mt-9 flex flex-wrap gap-3">
            {registrationOpen ? (
              <Link href="/register" className="btn-primary group">
                Register your team
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
            ) : (
              <span className="btn cursor-not-allowed border border-white/15 bg-white/5 text-slate-300">
                Registration opens soon
              </span>
            )}

            <Link
              href="/problem-statements"
              className="btn border border-white/20 text-white hover:bg-white/10"
            >
              Browse problem statements
            </Link>
          </motion.div>

          <motion.div
            variants={fadeUp}
            custom={4}
            className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-slate-300"
          >
            <span className="inline-flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-sih-saffron" />
              {hackathonDate}
            </span>
            <span className="inline-flex items-center gap-2">
              <Users className="h-4 w-4 text-sih-saffron" />6 members per team · at least one
              female member
            </span>
          </motion.div>
        </motion.div>

        <Countdown target={hackathonDateRaw} label="Hackathon begins in" />

        <div className="mt-16 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCounter value={teamCount} label="Teams registered" />
          <StatCounter value={participantCount} label="Participants" />
          <StatCounter value={problemStatementCount} label="Problem statements" />
          <StatCounter value={6} label="Members per team" />
        </div>
      </div>
    </section>
  );
}
