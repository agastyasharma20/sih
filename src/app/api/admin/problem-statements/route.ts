import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { getSessionProfile, isSpoc } from '@/lib/auth';
import { parseDelimitedRows } from '@/lib/csv';

export const dynamic = 'force-dynamic';

/** One problem statement, however it arrived (form or import). */
const psSchema = z.object({
  ps_id: z
    .string()
    .trim()
    .min(1, 'PS ID is required')
    .max(40)
    // Constrained to a safe charset: the retire-missing step embeds these
    // ids in a PostgREST filter list, where a quote or comma would change
    // the query's meaning.
    .regex(/^[A-Za-z0-9._-]+$/, 'PS ID may contain only letters, digits, dot, underscore and hyphen'),
  title: z.string().trim().min(3, 'Title is required').max(300),
  category: z.enum(['software', 'hardware']),
  theme: z.string().trim().max(120).optional().nullable(),
  description: z.string().trim().max(4000).optional().nullable(),
  is_active: z.boolean().default(true),
});

const bodySchema = z.union([
  z.object({ mode: z.literal('single'), statement: psSchema }),
  z.object({
    mode: z.literal('bulk'),
    /** Raw CSV/TSV pasted from the SIH listing or a spreadsheet. */
    text: z.string().min(1),
    deactivate_missing: z.boolean().default(false),
  }),
]);

/** Accepts the loose category spellings a pasted sheet tends to contain. */
function normaliseCategory(value: string): 'software' | 'hardware' | null {
  const cleaned = value.trim().toLowerCase();
  if (['software', 'sw', 's'].includes(cleaned)) return 'software';
  if (['hardware', 'hw', 'h'].includes(cleaned)) return 'hardware';
  return null;
}

export async function POST(request: Request) {
  const profile = await getSessionProfile();

  if (!profile || !isSpoc(profile)) {
    return NextResponse.json(
      { ok: false, message: 'Only the SIH SPOC can manage problem statements.' },
      { status: 403 },
    );
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, message: parsed.error.issues[0]?.message ?? 'Invalid request.' },
      { status: 422 },
    );
  }

  const supabase = createClient();

  // ------------------------------------------------------------- single
  if (parsed.data.mode === 'single') {
    const statement = parsed.data.statement;

    const { error } = await supabase
      .from('problem_statements')
      .upsert(
        {
          ...statement,
          theme: statement.theme || null,
          description: statement.description || null,
        },
        { onConflict: 'ps_id' },
      );

    if (error) {
      return NextResponse.json(
        { ok: false, message: 'Could not save the problem statement.' },
        { status: 500 },
      );
    }

    await supabase.rpc('write_audit', {
      p_action: 'problem_statement.saved',
      p_target_table: 'problem_statements',
      p_target_id: statement.ps_id,
      p_metadata: { title: statement.title },
    });

    return NextResponse.json({ ok: true, imported: 1, skipped: [] });
  }

  // --------------------------------------------------------------- bulk
  const rows = parseDelimitedRows(parsed.data.text);

  if (rows.length === 0) {
    return NextResponse.json(
      {
        ok: false,
        message:
          'No rows found. Include a header row with at least ps_id, title and category.',
      },
      { status: 422 },
    );
  }

  if (rows.length > 1000) {
    return NextResponse.json(
      { ok: false, message: 'Import is limited to 1000 rows at a time.' },
      { status: 422 },
    );
  }

  const valid: z.infer<typeof psSchema>[] = [];
  const skipped: Array<{ row: number; reason: string }> = [];

  rows.forEach((row, index) => {
    // Row 1 is the header, so the first data row reads as line 2 — which is
    // what the person sees in their spreadsheet.
    const line = index + 2;
    const category = normaliseCategory(row.category ?? '');

    if (!row.ps_id) {
      skipped.push({ row: line, reason: 'missing ps_id' });
      return;
    }
    if (!row.title) {
      skipped.push({ row: line, reason: 'missing title' });
      return;
    }
    if (!category) {
      skipped.push({
        row: line,
        reason: `category must be software or hardware (got "${row.category ?? ''}")`,
      });
      return;
    }

    const candidate = psSchema.safeParse({
      ps_id: row.ps_id,
      title: row.title,
      category,
      theme: row.theme || null,
      description: row.description || null,
      is_active: true,
    });

    if (!candidate.success) {
      skipped.push({ row: line, reason: candidate.error.issues[0]?.message ?? 'invalid row' });
      return;
    }

    valid.push(candidate.data);
  });

  // Later duplicates of a ps_id would make the upsert fail on "affect row a
  // second time", so collapse them here and report it.
  const deduped = new Map<string, z.infer<typeof psSchema>>();
  for (const statement of valid) {
    if (deduped.has(statement.ps_id)) {
      skipped.push({ row: 0, reason: `duplicate ps_id "${statement.ps_id}" in the file` });
    }
    deduped.set(statement.ps_id, statement);
  }

  if (deduped.size === 0) {
    return NextResponse.json(
      { ok: false, message: 'No valid rows to import.', skipped },
      { status: 422 },
    );
  }

  const { error } = await supabase
    .from('problem_statements')
    .upsert([...deduped.values()], { onConflict: 'ps_id' });

  if (error) {
    console.error('[ps:bulk]', error);
    return NextResponse.json(
      { ok: false, message: 'Import failed while writing to the database.' },
      { status: 500 },
    );
  }

  // Optionally retire statements that are no longer in the list, rather than
  // deleting them — teams may already reference them.
  let deactivated = 0;
  if (parsed.data.deactivate_missing) {
    const { data: retired } = await supabase
      .from('problem_statements')
      .update({ is_active: false })
      .not('ps_id', 'in', `(${[...deduped.keys()].map((id) => `"${id}"`).join(',')})`)
      .eq('is_active', true)
      .select('id');

    deactivated = retired?.length ?? 0;
  }

  await supabase.rpc('write_audit', {
    p_action: 'problem_statement.bulk_import',
    p_target_table: 'problem_statements',
    p_target_id: null,
    p_metadata: { imported: deduped.size, skipped: skipped.length, deactivated },
  });

  return NextResponse.json({
    ok: true,
    imported: deduped.size,
    deactivated,
    skipped,
  });
}

/** Toggle active state or delete a statement no team has chosen. */
export async function PATCH(request: Request) {
  const profile = await getSessionProfile();

  if (!profile || !isSpoc(profile)) {
    return NextResponse.json({ ok: false, message: 'Not permitted.' }, { status: 403 });
  }

  const schema = z.object({ id: z.string().uuid(), is_active: z.boolean() });
  const parsed = schema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: 'Invalid request.' }, { status: 422 });
  }

  const supabase = createClient();
  const { error } = await supabase
    .from('problem_statements')
    .update({ is_active: parsed.data.is_active })
    .eq('id', parsed.data.id);

  if (error) {
    return NextResponse.json({ ok: false, message: 'Could not update.' }, { status: 500 });
  }

  await supabase.rpc('write_audit', {
    p_action: parsed.data.is_active ? 'problem_statement.activated' : 'problem_statement.retired',
    p_target_table: 'problem_statements',
    p_target_id: parsed.data.id,
    p_metadata: null,
  });

  return NextResponse.json({ ok: true });
}
