import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { getSessionProfile, isSpoc } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * Locking freezes a team's details independently of the global
 * registration switch — used to settle one team's roster while others are
 * still editing. `registration_editable()` reads this in the RLS policies,
 * so a locked team cannot be edited through any client.
 */
const schema = z.union([
  z.object({ scope: z.literal('team'), team_id: z.string().uuid(), locked: z.boolean() }),
  z.object({ scope: z.literal('all'), locked: z.boolean() }),
]);

export async function PATCH(request: Request) {
  const profile = await getSessionProfile();

  if (!profile || !isSpoc(profile)) {
    return NextResponse.json(
      { ok: false, message: 'Only the SIH SPOC can lock or unlock teams.' },
      { status: 403 },
    );
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: 'Invalid request.' }, { status: 422 });
  }

  const supabase = createClient();
  const lockedAt = parsed.data.locked ? new Date().toISOString() : null;

  const query = supabase.from('teams').update({ registration_locked_at: lockedAt });

  const { data, error } =
    parsed.data.scope === 'team'
      ? await query.eq('id', parsed.data.team_id).select('id')
      // Postgrest requires a filter on bulk updates; this one matches every row.
      : await query.not('id', 'is', null).select('id');

  if (error) {
    console.error('[teams:lock]', error);
    return NextResponse.json({ ok: false, message: 'Could not update.' }, { status: 500 });
  }

  await supabase.rpc('write_audit', {
    p_action: parsed.data.locked ? 'teams.locked' : 'teams.unlocked',
    p_target_table: 'teams',
    p_target_id: parsed.data.scope === 'team' ? parsed.data.team_id : null,
    p_metadata: { scope: parsed.data.scope, affected: data?.length ?? 0 },
  });

  return NextResponse.json({ ok: true, affected: data?.length ?? 0 });
}
