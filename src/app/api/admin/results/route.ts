import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { getSessionProfile, isAdminTier } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const schema = z.object({
  team_id: z.string().uuid(),
  idea_slot: z.coerce.number().int().min(1).max(2).default(1),
  final_verdict: z.enum(['selected', 'waitlisted', 'rejected']).nullable(),
  is_published: z.boolean().default(false),
});

export async function POST(request: Request) {
  const profile = await getSessionProfile();

  if (!profile || !isAdminTier(profile.role)) {
    return NextResponse.json({ ok: false, message: 'Not permitted.' }, { status: 403 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: 'Invalid request.' }, { status: 422 });
  }

  const supabase = createClient();
  const { data, error } = await supabase.rpc('set_result', { payload: parsed.data });

  if (error) {
    console.error('[set_result]', error);
    return NextResponse.json({ ok: false, message: 'Could not save the result.' }, { status: 500 });
  }

  const result = data as { ok: boolean; message?: string };
  return NextResponse.json(result, { status: result.ok ? 200 : 403 });
}
