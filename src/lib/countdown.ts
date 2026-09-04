/** Pure countdown maths, kept out of the component so it can be tested. */

export interface Remaining {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  /** True once the target has passed, or when there is no target. */
  elapsed: boolean;
}

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * Time from `now` until `target`.
 *
 * Returns `elapsed` rather than negative numbers so a countdown that has
 * run out renders a message instead of "-3 days". An unparseable or
 * missing target is also `elapsed`, because a date nobody has set yet
 * should not render a live clock.
 */
export function timeRemaining(target: string | null | undefined, now: number = Date.now()): Remaining {
  const zero: Remaining = { days: 0, hours: 0, minutes: 0, seconds: 0, elapsed: true };

  if (!target) return zero;

  const end = new Date(target).getTime();
  if (Number.isNaN(end)) return zero;

  const diff = end - now;
  if (diff <= 0) return zero;

  return {
    days: Math.floor(diff / DAY),
    hours: Math.floor((diff % DAY) / HOUR),
    minutes: Math.floor((diff % HOUR) / MINUTE),
    seconds: Math.floor((diff % MINUTE) / SECOND),
    elapsed: false,
  };
}

/** Two digits, so the clock does not jitter as numbers change width. */
export function pad(value: number): string {
  return String(value).padStart(2, '0');
}
