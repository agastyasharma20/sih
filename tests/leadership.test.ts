import { describe, it, expect } from 'vitest';
import { readFile } from 'node:fs/promises';
import { LEADERSHIP, initialsFor } from '@/lib/leadership';

describe('initialsFor', () => {
  it('strips honorifics before taking initials', () => {
    expect(initialsFor('Prof. (Dr.) Manojkumar Deshpande')).toBe('MD');
    expect(initialsFor('Dr. Sadhana Tiwari')).toBe('ST');
    expect(initialsFor('Er. Sadhana Tiwari')).toBe('ST');
  });

  it('uses the first and last name parts, not the middle', () => {
    expect(initialsFor('Agastya Anoop Sharma')).toBe('AS');
  });

  it('handles a single name', () => {
    expect(initialsFor('Sadhana')).toBe('SA');
  });

  it('never throws on empty or punctuation-only input', () => {
    expect(initialsFor('')).toBe('?');
    expect(initialsFor('Dr.')).toBe('?');
  });
});

describe('LEADERSHIP entries', () => {
  it('lists both roles the event needs', () => {
    expect(LEADERSHIP.map((l) => l.role)).toEqual(['Patron', 'SIH SPOC']);
  });

  it('gives every entry the fields the card renders', () => {
    for (const leader of LEADERSHIP) {
      expect(leader.name.length).toBeGreaterThan(2);
      expect(leader.title.length).toBeGreaterThan(2);
      expect(leader.bio.length).toBeGreaterThan(40);
      expect(leader.highlights.length).toBeGreaterThan(0);
      // A photo is optional. If set it must be either a local file under
      // public/leadership/ or an https URL — never http, and never a
      // relative path that would resolve differently per route.
      if (leader.photo !== null) {
        const local = leader.photo.startsWith('/leadership/');
        const remote = leader.photo.startsWith('https://');
        expect(local || remote).toBe(true);
      }
    }
  });

  /**
   * next/image refuses any remote host missing from next.config.mjs, and
   * fails silently in production — the card just falls back to initials.
   * This catches a photo URL added without allowing its host.
   */
  it('only uses remote photo hosts that next.config.mjs allows', async () => {
    // Vitest runs from the project root.
    const config = await readFile('next.config.mjs', 'utf8');

    for (const leader of LEADERSHIP) {
      if (!leader.photo?.startsWith('https://')) continue;
      const host = new URL(leader.photo).hostname;
      expect(config, `${host} is not in remotePatterns`).toContain(host);
    }
  });

  it('only links to https profiles', () => {
    for (const leader of LEADERSHIP) {
      if (leader.profileUrl) {
        expect(leader.profileUrl.startsWith('https://')).toBe(true);
      }
    }
  });
});
