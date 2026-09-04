/**
 * Shared motion vocabulary.
 *
 * One place for durations and easing so the whole site moves the same
 * way. Every variant here is safe under `prefers-reduced-motion`: the
 * MotionProvider sets Framer's reduced-motion mode, which strips
 * transform and layout animation while keeping opacity, so content still
 * appears rather than snapping in without warning.
 */

import type { Variants, Transition } from 'framer-motion';

/** Decelerating curve — quick to start, settles softly. */
export const EASE_OUT = [0.22, 1, 0.36, 1] as const;

export const DURATION = {
  fast: 0.18,
  base: 0.35,
  slow: 0.55,
} as const;

export const spring: Transition = {
  type: 'spring',
  stiffness: 260,
  damping: 28,
  mass: 0.9,
};

/** Rise and fade. The workhorse for anything entering the viewport. */
export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 18 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: DURATION.base, ease: EASE_OUT },
  },
};

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: DURATION.base, ease: EASE_OUT } },
};

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.96 },
  show: { opacity: 1, scale: 1, transition: spring },
};

/**
 * Parent for a list. Children inherit `hidden`/`show` and play in
 * sequence, which reads as one motion instead of several.
 */
export const stagger = (gap = 0.07, delay = 0): Variants => ({
  hidden: {},
  show: {
    transition: { staggerChildren: gap, delayChildren: delay },
  },
});

/** Standard "reveal as it scrolls into view" props. */
export const revealOnScroll = {
  initial: 'hidden',
  whileInView: 'show',
  viewport: { once: true, margin: '-80px' },
} as const;

/** Subtle lift for interactive cards. */
export const hoverLift = {
  whileHover: { y: -3, transition: { duration: DURATION.fast, ease: EASE_OUT } },
  whileTap: { scale: 0.99 },
} as const;
