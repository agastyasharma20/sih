import { describe, it, expect } from 'vitest';
import {
  parseDelimited,
  parseDelimitedRows,
  toCsv,
  parseProblemStatements,
  normaliseHeader,
} from '@/lib/csv';

describe('parseDelimited', () => {
  it('parses plain comma-separated rows', () => {
    expect(parseDelimited('a,b,c\n1,2,3')).toEqual([
      ['a', 'b', 'c'],
      ['1', '2', '3'],
    ]);
  });

  it('keeps commas inside quoted fields', () => {
    expect(parseDelimited('a,b\n"one, two",three')).toEqual([
      ['a', 'b'],
      ['one, two', 'three'],
    ]);
  });

  it('unescapes doubled quotes', () => {
    expect(parseDelimited('a\n"say ""hi"""')).toEqual([['a'], ['say "hi"']]);
  });

  it('keeps newlines inside quoted fields', () => {
    expect(parseDelimited('a,b\n"line1\nline2",x')).toEqual([
      ['a', 'b'],
      ['line1\nline2', 'x'],
    ]);
  });

  it('handles CRLF line endings and a UTF-8 BOM', () => {
    expect(parseDelimited('﻿a,b\r\n1,2\r\n')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });

  it('auto-detects tab-separated input pasted from a spreadsheet', () => {
    expect(parseDelimited('a\tb\tc\n1\t2\t3')).toEqual([
      ['a', 'b', 'c'],
      ['1', '2', '3'],
    ]);
  });

  it('ignores blank trailing lines', () => {
    expect(parseDelimited('a,b\n1,2\n\n\n')).toHaveLength(2);
  });
});

describe('parseDelimitedRows', () => {
  it('normalises header names', () => {
    const rows = parseDelimitedRows('PS ID,Title,Category\nSIH1234,Smart Water,software');
    expect(rows[0]).toEqual({ ps_id: 'SIH1234', title: 'Smart Water', category: 'software' });
  });

  it('returns nothing when there is only a header', () => {
    expect(parseDelimitedRows('ps_id,title')).toEqual([]);
  });

  it('tolerates rows with missing trailing columns', () => {
    const rows = parseDelimitedRows('ps_id,title,theme\nSIH1,Water');
    expect(rows[0]).toEqual({ ps_id: 'SIH1', title: 'Water', theme: '' });
  });
});

describe('toCsv', () => {
  it('quotes cells containing commas, quotes or newlines', () => {
    const csv = toCsv(['a', 'b'], [['plain', 'has, comma'], ['say "hi"', 'line\nbreak']]);
    expect(csv).toContain('"has, comma"');
    expect(csv).toContain('"say ""hi"""');
    expect(csv).toContain('"line\nbreak"');
  });

  it('round-trips through the parser', () => {
    const csv = toCsv(['ps_id', 'title'], [['SIH1', 'Water, clean']]);
    const rows = parseDelimitedRows(csv);
    expect(rows[0]).toEqual({ ps_id: 'SIH1', title: 'Water, clean' });
  });

  it('renders null as an empty cell', () => {
    expect(toCsv(['a'], [[null]])).toContain('\r\n\r\n');
  });
});

describe('parseProblemStatements', () => {
  it('accepts the column names the official SIH export uses', () => {
    const rows = parseProblemStatements(
      'PS Number,Problem Statement Title,Category,Theme,Organization\n' +
        'SIH25001,Smart water monitoring,Software,Clean Water,Ministry of Jal Shakti',
    );
    expect(rows[0]).toEqual({
      ps_id: 'SIH25001',
      title: 'Smart water monitoring',
      category: 'Software',
      theme: 'Clean Water',
      organisation: 'Ministry of Jal Shakti',
    });
  });

  it('accepts our own plain column names too', () => {
    const rows = parseProblemStatements('ps_id,title,category\nSIH1,Water,software');
    expect(rows[0].ps_id).toBe('SIH1');
    expect(rows[0].title).toBe('Water');
  });

  it('does not mistake a serial number column for the PS ID', () => {
    const rows = parseProblemStatements(
      'S.No,PS Number,Problem Statement Title,Category\n' +
        '1,SIH25042,Assistive device,Hardware',
    );
    expect(rows[0].ps_id).toBe('SIH25042');
    expect(rows[0].s_no).toBe('1');
  });

  it('keeps unrecognised columns rather than dropping them', () => {
    const rows = parseProblemStatements(
      'ps_id,title,category,Youth Innovation\nSIH1,Water,software,Yes',
    );
    expect(rows[0].youth_innovation).toBe('Yes');
  });

  it('handles a tab-separated paste straight out of a spreadsheet', () => {
    const rows = parseProblemStatements(
      'PS Number\tProblem Statement Title\tCategory\nSIH1\tWater quality\tSoftware',
    );
    expect(rows[0]).toEqual({ ps_id: 'SIH1', title: 'Water quality', category: 'Software' });
  });

  it('survives a title containing a comma', () => {
    const rows = parseProblemStatements(
      'PS Number,Problem Statement Title,Category\n' +
        'SIH1,"Monitoring of rivers, lakes and ponds",Software',
    );
    expect(rows[0].title).toBe('Monitoring of rivers, lakes and ponds');
  });
});

describe('normaliseHeader', () => {
  it('collapses punctuation and case', () => {
    expect(normaliseHeader('  PS Number ')).toBe('ps_number');
    expect(normaliseHeader('Problem Statement Title')).toBe('problem_statement_title');
    expect(normaliseHeader('S.No.')).toBe('s_no');
  });
});
