import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Renders a TBD-able setting date for display. */
export function formatEventDate(value: unknown): string {
  if (typeof value !== 'string' || !value) return 'To be announced';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'To be announced';
  return parsed.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}
