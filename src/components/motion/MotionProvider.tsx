'use client';

import { MotionConfig } from 'framer-motion';
import { DURATION, EASE_OUT } from '@/lib/motion';

/**
 * Wraps the app so every animation shares one default transition and one
 * reduced-motion policy.
 *
 * `reducedMotion="user"` makes Framer honour the operating system
 * setting: transform and layout animations are dropped, opacity is kept.
 * Someone with vestibular sensitivity gets a still page rather than no
 * page — and we do not have to remember it at each call site.
 */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return (
    <MotionConfig
      reducedMotion="user"
      transition={{ duration: DURATION.base, ease: EASE_OUT }}
    >
      {children}
    </MotionConfig>
  );
}
