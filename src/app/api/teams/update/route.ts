import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { registrationSchema, issuesToFieldErrors } from '@/lib/validation/registration';
import { rateLimit, clientIp } from '@/lib/rate-limit';
import type { RegistrationResult } from '@/lib/types';

export const dynamic = 'force-dynamic';

/** Team-lead self-service edits, allowed until registration is locked. */
export async function PUT(request: Request) {
  const limit = rateLimit(`team-update:${clientIp(request)}`, 30, 60 * 60 * 1000);
  if (!limit.allowed) {
    return NextResponse.json(
      { ok: false, message: 'Too many updates. Please try again shortly.' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } },
    );
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ ok: false, message: 'You must be signed in.' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, message: 'Malformed request body.' }, { status: 400 });
  }

  const parsed = registrationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        message: 'Please correct the highlighted fields.',
        fieldErrors: issuesToFieldErrors(parsed.error.issues),
      },
      { status: 422 },
    );
  }

  const { data, error } = await supabase.rpc('update_team', { payload: parsed.data });

  if (error) {
    console.error('[update_team]', error);
    return NextResponse.json(
      { ok: false, message: 'Could not save your changes. Please try again.' },
      { status: 500 },
    );
  }

  const result = data as RegistrationResult;

  if (!result.ok) {
    const status = result.code === 'duplicate' ? 409 : result.code === 'locked' ? 403 : 422;
    return NextResponse.json(
      {
        ok: false,
        message: result.message,
        field: result.field,
        fieldErrors: result.field ? { [result.field]: result.message } : undefined,
      },
      { status },
    );
  }

  return NextResponse.json({ ok: true, team_id_short: result.team_id_short });
}
