'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { timeRemaining, pad, type Remaining } from '@/lib/countdown';
import { fadeUp, revealOnScroll, stagger } from '@/lib/motion';

/**
 * Live countdown to the hackathon.
 *
 * The first render deliberately matches the server's (all zeros, hidden)
 * and the real value is set in an effect — computing "now" during render
 * would produce different HTML on server and client and trip a hydration
 * mismatch. Nothing renders at all until a date is set, so the landing
 * page does not show an empty clock while the schedule is still TBD.
 */
export function Countdown({ target, label }: { target: string | null; label: string }) {
  const [remaining, setRemaining] = useState<Remaining | null>(null);

  useEffect(() => {
    if (!target) return;

    const tick = () => setRemaining(timeRemaining(target));
    tick();

    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [target]);

  if (!target || !remaining || remaining.elapsed) return null;

  const units = [
    { value: remaining.days, label: remaining.days === 1 ? 'day' : 'days' },
    { value: remaining.hours, label: 'hrs' },
    { value: remaining.minutes, label: 'min' },
    { value: remaining.seconds, label: 'sec' },
  ];

  return (
    <motion.div {...revealOnScroll} variants={stagger(0.06)} className="mt-10">
      <motion.p
        variants={fadeUp}
        className="text-xs font-semibold uppercase tracking-[0.16em] text-piemr-200"
      >
        {label}
      </motion.p>

      <div className="mt-3 flex flex-wrap gap-3">
        {units.map((unit) => (
          <motion.div
            key={unit.label}
            variants={fadeUp}
            className="min-w-[76px] rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-center backdrop-blur"
          >
            <p className="font-mono text-2xl font-black tabular-nums text-white">
              {pad(unit.value)}
            </p>
            <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-piemr-200">
              {unit.label}
            </p>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
