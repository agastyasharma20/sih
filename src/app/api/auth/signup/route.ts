import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { rateLimit, clientIp } from '@/lib/rate-limit';
import { DEFAULT_EMAIL_DOMAIN } from '@/lib/constants';

export const dynamic = 'force-dynamic';

/**
 * Participant self-signup with a password.
 *
 * This exists so the event does not depend on Supabase's built-in auth
 * mailer, which is rate-limited to a handful of messages per hour on the
 * free plan — with ~120 team leads signing in at once, magic links jam.
 * The account is created already confirmed, so no auth email is sent at
 * all.
 *
 * The trade-off is that the address is not proved to belong to the person
 * signing up. It is bounded by the institutional domain check below, by
 * every member needing a unique enrollment number at registration, and by
 * admins seeing the full roster. Anyone who wants a verified path can
 * still use the sign-in link on the login page.
 */
const schema = z.object({
  email: z.string().trim().toLowerCase().min(3),
  password: z.string().min(8, 'Use at least 8 characters').max(72),
  full_name: z.string().trim().min(2, 'Enter your full name').max(120),
});

export async function POST(request: Request) {
  const ip = clientIp(request);

  if (!rateLimit(`signup:${ip}`, 10, 60 * 60 * 1000).allowed) {
    return NextResponse.json(
      { ok: false, message: 'Too many sign-up attempts. Please try again later.' },
      { status: 429 },
    );
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, message: parsed.error.issues[0]?.message ?? 'Check your details.' },
      { status: 422 },
    );
  }

  const { email, password, full_name } = parsed.data;
  const supabase = createClient();

  const { data: domainRow } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'allowed_email_domain')
    .maybeSingle();

  const domain = (domainRow?.value as string) ?? DEFAULT_EMAIL_DOMAIN;

  // Enforced here on the server; a client-side check alone is bypassable.
  if (!new RegExp(`^[^@\\s]+@${domain.replace(/\./g, '\\.')}$`, 'i').test(email)) {
    return NextResponse.json(
      { ok: false, message: `Sign up with your institutional @${domain} email address.` },
      { status: 403 },
    );
  }

  // A missing or wrong secret key is the most common deployment mistake,
  // and it surfaces here first. Say so plainly rather than blaming the user.
  let admin;
  try {
    admin = createAdminClient();
  } catch (error) {
    console.error('[signup] admin client unavailable:', error);
    return NextResponse.json(
      {
        ok: false,
        message:
          'The server is not configured for sign-ups yet. An administrator needs to set ' +
          'SUPABASE_SECRET_KEY. Use the sign-in link option in the meantime.',
      },
      { status: 500 },
    );
  }

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name },
  });

  if (createError || !created?.user) {
    // Log the real reason; the response stays deliberately vague about
    // whether an address is already registered.
    console.error('[signup] createUser failed:', {
      status: createError?.status,
      code: createError?.code,
      message: createError?.message,
    });

    const reason = createError?.message?.toLowerCase() ?? '';

    if (reason.includes('already') || reason.includes('registered')) {
      return NextResponse.json(
        { ok: false, message: 'An account already exists for that email. Sign in instead.' },
        { status: 409 },
      );
    }

    // "User not allowed" means the key in use is not the secret key — the
    // publishable key cannot reach the admin API.
    if (reason.includes('not allowed') || createError?.status === 403) {
      return NextResponse.json(
        {
          ok: false,
          message:
            'The server is using the wrong Supabase key for sign-ups. It needs the secret ' +
            '(sb_secret_…) key, not the publishable one.',
        },
        { status: 500 },
      );
    }

    if (reason.includes('password')) {
      return NextResponse.json(
        { ok: false, message: 'That password was rejected. Try a longer one.' },
        { status: 422 },
      );
    }

    return NextResponse.json(
      {
        ok: false,
        message: createError?.message
          ? `Could not create the account: ${createError.message}`
          : 'Could not create the account. Please try again.',
      },
      { status: 400 },
    );
  }

  // The auth trigger has created the profile as team_lead; sign them in.
  const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

  if (signInError) {
    return NextResponse.json(
      { ok: true, signedIn: false, message: 'Account created. Please sign in.' },
      { status: 200 },
    );
  }

  return NextResponse.json({ ok: true, signedIn: true, redirectTo: '/dashboard/team' });
}
