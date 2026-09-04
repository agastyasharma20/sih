'use client';

import { motion } from 'framer-motion';
import { fadeUp, revealOnScroll, stagger } from '@/lib/motion';

/** Fades and lifts its children in as they scroll into view, once. */
export function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <motion.div
      {...revealOnScroll}
      variants={fadeUp}
      transition={{ delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/** Reveals a list so its items arrive one after another. */
export function RevealGroup({
  children,
  gap = 0.07,
  className,
}: {
  children: React.ReactNode;
  gap?: number;
  className?: string;
}) {
  return (
    <motion.div {...revealOnScroll} variants={stagger(gap)} className={className}>
      {children}
    </motion.div>
  );
}

/** One item inside a RevealGroup. */
export function RevealItem({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div variants={fadeUp} className={className}>
      {children}
    </motion.div>
  );
}
