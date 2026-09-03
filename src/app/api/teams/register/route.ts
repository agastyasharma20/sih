import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { registrationSchema, issuesToFieldErrors } from '@/lib/validation/registration';
import { sendRegistrationEmail } from '@/lib/email';
import { rateLimit, clientIp } from '@/lib/rate-limit';
import type { RegistrationResult } from '@/lib/types';

export const dynamic = 'force-dynamic';

/**
 * Module 1 write path.
 *
 * Validation happens three times on purpose: in the browser for
 * responsiveness, here so a crafted request never reaches the database
 * shaped wrong, and inside register_team() where it is authoritative and
 * transactional.
 */
export async function POST(request: Request) {
  const ip = clientIp(request);
  const limit = rateLimit(`register:${ip}`, 8, 60 * 60 * 1000);

  if (!limit.allowed) {
    return NextResponse.json(
      { ok: false, message: 'Too many registration attempts. Please try again later.' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } },
    );
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { ok: false, message: 'You must be signed in to register a team.' },
      { status: 401 },
    );
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

  const { data, error } = await supabase.rpc('register_team', { payload: parsed.data });

  if (error) {
    console.error('[register_team]', error);
    return NextResponse.json(
      { ok: false, message: 'Registration could not be completed. Please try again.' },
      { status: 500 },
    );
  }

  const result = data as RegistrationResult;

  if (!result.ok) {
    const status =
      result.code === 'duplicate' ? 409 : result.code === 'registration_closed' ? 403 : 422;

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

  // Confirmation goes to all six members. A mail failure must not undo a
  // successful registration, so it is reported, not thrown.
  let emailWarning: string | undefined;
  try {
    const admin = createAdminClient();

    const [{ data: members }, { data: mentors }, { data: eventNameRow }] = await Promise.all([
      admin
        .from('members')
        .select('full_name, email, is_lead, enrollment_number')
        .eq('team_id', result.team_id),
      admin.from('mentors').select('full_name, email, type').eq('team_id', result.team_id),
      admin.from('settings').select('value').eq('key', 'event_name').single(),
    ]);

    const primary = mentors?.find((m) => m.type === 'primary');
    const secondary = mentors?.find((m) => m.type === 'secondary');

    const outcome = await sendRegistrationEmail(
      (members ?? []).map((m) => m.email),
      {
        teamIdShort: result.team_id_short,
        teamName: (parsed.data.team_name as string) ?? '',
        members: members ?? [],
        primaryMentor: primary ?? { full_name: '—', email: '—' },
        secondaryMentor: secondary ?? null,
        eventName:
          (eventNameRow?.value as string | undefined) ?? 'PIEMR Internal Hackathon',
      },
    );

    if (outcome.error) emailWarning = outcome.error;
  } catch (error) {
    console.error('[register:email]', error);
    emailWarning = 'confirmation_email_failed';
  }

  return NextResponse.json({
    ok: true,
    team_id: result.team_id,
    team_id_short: result.team_id_short,
    emailWarning,
  });
}
