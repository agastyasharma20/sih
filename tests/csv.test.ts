import { describe, it, expect } from 'vitest';
import { parseDelimited, parseDelimitedRows, toCsv } from '@/lib/csv';

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
