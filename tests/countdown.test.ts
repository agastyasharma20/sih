import { describe, it, expect } from 'vitest';
import { timeRemaining, pad } from '@/lib/countdown';

const NOW = Date.parse('2026-03-01T00:00:00Z');

describe('timeRemaining', () => {
  it('breaks the gap into days, hours, minutes and seconds', () => {
    const target = '2026-03-03T04:05:06Z';
    expect(timeRemaining(target, NOW)).toEqual({
      days: 2,
      hours: 4,
      minutes: 5,
      seconds: 6,
      elapsed: false,
    });
  });

  it('reports elapsed once the target has passed, never negatives', () => {
    const result = timeRemaining('2026-02-28T00:00:00Z', NOW);
    expect(result.elapsed).toBe(true);
    expect(result.days).toBe(0);
  });

  it('treats the exact moment of the deadline as elapsed', () => {
    expect(timeRemaining('2026-03-01T00:00:00Z', NOW).elapsed).toBe(true);
  });

  it('treats an unset date as elapsed rather than rendering a clock', () => {
    expect(timeRemaining(null, NOW).elapsed).toBe(true);
    expect(timeRemaining(undefined, NOW).elapsed).toBe(true);
    expect(timeRemaining('', NOW).elapsed).toBe(true);
  });

  it('does not throw on an unparseable date', () => {
    expect(timeRemaining('not a date', NOW).elapsed).toBe(true);
  });

  it('handles a target under a minute away', () => {
    const result = timeRemaining('2026-03-01T00:00:30Z', NOW);
    expect(result).toMatchObject({ days: 0, hours: 0, minutes: 0, seconds: 30, elapsed: false });
  });

  it('handles a date-only value, which parses as midnight UTC', () => {
    const result = timeRemaining('2026-03-05', NOW);
    expect(result.days).toBe(4);
    expect(result.elapsed).toBe(false);
  });
});

describe('pad', () => {
  it('pads single digits so the clock does not jitter', () => {
    expect(pad(0)).toBe('00');
    expect(pad(7)).toBe('07');
    expect(pad(42)).toBe('42');
    expect(pad(365)).toBe('365');
  });
});
