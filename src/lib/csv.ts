/**
 * Small CSV/TSV reader and writer.
 *
 * Problem statements are copied out of the official SIH listing or a
 * spreadsheet, so the importer has to survive quoted fields, embedded
 * commas and newlines, and doubled quotes — the cases a naive
 * `split(',')` silently corrupts. Exports go the other way, for the
 * roster download.
 */

export type Row = Record<string, string>;

/** Detects the delimiter by counting candidates outside quoted regions. */
function detectDelimiter(sample: string): string {
  const candidates = [',', '\t', ';'];
  let best = ',';
  let bestCount = -1;

  for (const candidate of candidates) {
    let count = 0;
    let inQuotes = false;

    for (let i = 0; i < sample.length; i += 1) {
      const char = sample[i];
      if (char === '"') {
        if (inQuotes && sample[i + 1] === '"') i += 1;
        else inQuotes = !inQuotes;
      } else if (char === candidate && !inQuotes) {
        count += 1;
      }
    }

    if (count > bestCount) {
      bestCount = count;
      best = candidate;
    }
  }

  return best;
}

/** Splits delimited text into rows of raw cells. */
export function parseDelimited(input: string, delimiter?: string): string[][] {
  const text = input.replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  const sep = delimiter ?? detectDelimiter(text.split('\n').slice(0, 5).join('\n'));

  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        cell += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === sep) {
      row.push(cell);
      cell = '';
    } else if (char === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += char;
    }
  }

  // Flush whatever the last line left behind.
  if (cell !== '' || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  // Drop rows that are entirely blank, which trailing newlines produce.
  return rows.filter((r) => r.some((value) => value.trim() !== ''));
}

/**
 * Parses delimited text with a header row into objects. Header names are
 * lowercased and non-alphanumerics collapsed to underscores, so
 * "PS ID", "ps_id" and "PS-Id" all land on `ps_id`.
 */
export function parseDelimitedRows(input: string, delimiter?: string): Row[] {
  const rows = parseDelimited(input, delimiter);
  if (rows.length < 2) return [];

  const headers = rows[0].map((header) =>
    header
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, ''),
  );

  return rows.slice(1).map((cells) => {
    const record: Row = {};
    headers.forEach((header, index) => {
      if (header) record[header] = (cells[index] ?? '').trim();
    });
    return record;
  });
}

/** Quotes a single cell for CSV output. */
function quote(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** Serialises rows to CSV, with a BOM so Excel reads UTF-8 correctly. */
export function toCsv(headers: string[], rows: Array<Array<string | number | null>>): string {
  const lines = [headers.map(quote).join(',')];

  for (const row of rows) {
    lines.push(row.map((cell) => quote(cell === null ? '' : String(cell))).join(','));
  }

  return `﻿${lines.join('\r\n')}\r\n`;
}

/**
 * Maps the column names real exports use onto the ones we store.
 *
 * The official SIH listing calls things "PS Number" and "Problem
 * Statement Title"; a spreadsheet someone has retyped might say "ps id"
 * or "problem_statement". Rather than make people rename columns before
 * importing, accept the shapes that actually turn up.
 */
const HEADER_ALIASES: Record<string, string> = {
  // ps_id
  ps_id: 'ps_id',
  ps_no: 'ps_id',
  ps_number: 'ps_id',
  ps_code: 'ps_id',
  psid: 'ps_id',
  problem_statement_id: 'ps_id',
  problem_statement_no: 'ps_id',
  problem_statement_number: 'ps_id',
  problem_statement_code: 'ps_id',
  // Deliberately NOT s_no / sr_no / serial: those are row counters, and
  // mapping them here would beat the real PS number on any sheet that
  // carries both.
  // title
  title: 'title',
  problem_statement_title: 'title',
  problem_statement: 'title',
  ps_title: 'title',
  name: 'title',
  // category
  category: 'category',
  ps_category: 'category',
  type: 'category',
  // theme
  theme: 'theme',
  ps_theme: 'theme',
  theme_name: 'theme',
  domain_bucket: 'theme',
  // description
  description: 'description',
  problem_description: 'description',
  ps_description: 'description',
  details: 'description',
  // organisation
  organisation: 'organisation',
  organization: 'organisation',
  ministry: 'organisation',
  department: 'organisation',
  organisation_name: 'organisation',
  organization_name: 'organisation',
};

/** Normalises one header cell to a comparable key. */
export function normaliseHeader(header: string): string {
  return header
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/**
 * Parses a problem-statement export, mapping recognised column names on
 * to our own. Unrecognised columns are kept under their normalised name
 * so nothing is silently lost.
 */
export function parseProblemStatements(input: string): Row[] {
  const rows = parseDelimited(input);
  if (rows.length < 2) return [];

  const headers = rows[0].map((header) => {
    const key = normaliseHeader(header);
    return HEADER_ALIASES[key] ?? key;
  });

  return rows.slice(1).map((cells) => {
    const record: Row = {};
    headers.forEach((header, index) => {
      // First column wins when two map to the same field, so a sheet with
      // both "S.No" and "PS Number" keeps the meaningful one.
      if (header && !record[header]) record[header] = (cells[index] ?? '').trim();
    });
    return record;
  });
}
