'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, useInView } from 'framer-motion';

/** Counts up to `value` once the tile scrolls into view. */
export function StatCounter({
  value,
  label,
  suffix = '',
}: {
  value: number;
  label: string;
  suffix?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-60px' });
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (!inView) return;

    if (value === 0) {
      setDisplay(0);
      return;
    }

    const duration = 1100;
    const start = performance.now();
    let frame = 0;

    const tick = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      // Ease-out so the number decelerates into its final value.
      setDisplay(Math.round(value * (1 - Math.pow(1 - progress, 3))));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [inView, value]);

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 16 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5 }}
      className="rounded-2xl border border-white/10 bg-white/5 px-6 py-5 backdrop-blur"
    >
      <p className="text-3xl font-black tracking-tight text-white sm:text-4xl">
        {display}
        {suffix}
      </p>
      <p className="mt-1 text-xs font-medium uppercase tracking-wider text-piemr-200">{label}</p>
    </motion.div>
  );
}
