import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { getSessionProfile, isSpoc } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * Event configuration. Dates are TBD until an admin sets them here —
 * nothing about the schedule is compiled into the app.
 */
const settingsSchema = z.object({
  updates: z
    .array(
      z.object({
        key: z.string().min(1),
        value: z.unknown(),
      }),
    )
    .min(1),
});

export async function PUT(request: Request) {
  const profile = await getSessionProfile();

  if (!profile || !isSpoc(profile)) {
    return NextResponse.json(
      { ok: false, message: 'Only the SIH SPOC can change event settings.' },
      { status: 403 },
    );
  }

  const parsed = settingsSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: 'Invalid settings payload.' }, { status: 422 });
  }

  const supabase = createClient();

  for (const { key, value } of parsed.data.updates) {
    const { error } = await supabase
      .from('settings')
      .update({ value, updated_by: profile.id })
      .eq('key', key);

    if (error) {
      return NextResponse.json(
        { ok: false, message: `Could not update "${key}".` },
        { status: 500 },
      );
    }

    await supabase.rpc('write_audit', {
      p_action: 'settings.updated',
      p_target_table: 'settings',
      p_target_id: key,
      p_metadata: { value },
    });
  }

  return NextResponse.json({ ok: true });
}
