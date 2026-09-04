import { describe, it, expect } from 'vitest';
import { PIEMR_LOGO, PIEMR_MONOGRAM, SIH_LOGO, SIH_EDITION } from '@/lib/branding';
import { readFile } from 'node:fs/promises';

describe('branding config', () => {
  it('always has a monogram to fall back to', () => {
    expect(PIEMR_MONOGRAM.length).toBeGreaterThan(0);
    expect(PIEMR_MONOGRAM.length).toBeLessThanOrEqual(3);
  });

  it('names the SIH edition, so the hero is never ambiguous about the year', () => {
    expect(SIH_EDITION).toMatch(/20\d\d/);
  });

  for (const [name, value] of [
    ['PIEMR_LOGO', PIEMR_LOGO],
    ['SIH_LOGO', SIH_LOGO],
  ] as const) {
    it(`${name} is a local path or an https URL, never http`, () => {
      if (value === null) return;
      expect(value.startsWith('/') || value.startsWith('https://')).toBe(true);
    });

    it(`${name}'s host, if remote, is allowed by next.config.mjs`, async () => {
      if (!value?.startsWith('https://')) return;
      const config = await readFile('next.config.mjs', 'utf8');
      expect(config).toContain(new URL(value).hostname);
    });
  }
});
