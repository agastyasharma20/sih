import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { getSessionProfile } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const schema = z.object({
  submission_id: z.string().uuid(),
  scores: z
    .array(
      z.object({
        criterion_id: z.string().uuid(),
        marks_given: z.coerce.number().min(0).max(1000),
        remarks: z.string().trim().max(2000).optional().default(''),
      }),
    )
    .min(1, 'Score at least one criterion'),
});

/** Judges record marks. The per-criterion maximum is enforced in the
 *  database, which knows each criterion's own ceiling. */
export async function POST(request: Request) {
  const profile = await getSessionProfile();

  if (!profile || profile.role !== 'judge') {
    return NextResponse.json(
      { ok: false, message: 'Only judges can record scores.' },
      { status: 403 },
    );
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, message: parsed.error.issues[0]?.message ?? 'Invalid scores.' },
      { status: 422 },
    );
  }

  const supabase = createClient();
  const { data, error } = await supabase.rpc('save_scores', { payload: parsed.data });

  if (error) {
    console.error('[save_scores]', error);
    return NextResponse.json({ ok: false, message: 'Could not save scores.' }, { status: 500 });
  }

  const result = data as { ok: boolean; message?: string; saved?: number; code?: string };

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, message: result.message },
      { status: result.code === 'closed' ? 403 : 422 },
    );
  }

  return NextResponse.json(result);
}

/** Look up a team by the 3-digit ID typed at the presentation. */
export async function GET(request: Request) {
  const profile = await getSessionProfile();

  if (!profile || !['judge', 'admin', 'super_admin'].includes(profile.role)) {
    return NextResponse.json({ ok: false, message: 'Not permitted.' }, { status: 403 });
  }

  const shortId = new URL(request.url).searchParams.get('team') ?? '';

  if (!/^\d{1,3}$/.test(shortId.trim())) {
    return NextResponse.json(
      { ok: false, message: 'Enter a team ID of up to 3 digits.' },
      { status: 422 },
    );
  }

  const supabase = createClient();
  const { data, error } = await supabase.rpc('judge_lookup_team', { p_short_id: shortId.trim() });

  if (error) {
    return NextResponse.json({ ok: false, message: 'Lookup failed.' }, { status: 500 });
  }

  const result = data as { ok: boolean; message?: string };
  return NextResponse.json(result, { status: result.ok ? 200 : 404 });
}
