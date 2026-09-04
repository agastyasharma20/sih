import { describe, it, expect } from 'vitest';
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
      // A photo is optional, but if set it must be a local public path so
      // the institute site cannot break the image.
      if (leader.photo !== null) {
        expect(leader.photo.startsWith('/leadership/')).toBe(true);
      }
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
