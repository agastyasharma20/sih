import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { rateLimit, clientIp } from '@/lib/rate-limit';
import { DEFAULT_EMAIL_DOMAIN } from '@/lib/constants';

export const dynamic = 'force-dynamic';

const schema = z.object({
  email: z.string().trim().toLowerCase().min(3),
  next: z.string().optional(),
});

/**
 * Passwordless sign-in link. Participants onboard through this path, so
 * the institutional domain is enforced here on the server — a client-side
 * check alone is trivially bypassed.
 *
 * Accounts that already exist (judges, coordinators, admins) may use the
 * link regardless of their address, so staff are not locked out by the
 * participant domain rule.
 */
export async function POST(request: Request) {
  const ip = clientIp(request);

  if (!rateLimit(`otp:${ip}`, 10, 15 * 60 * 1000).allowed) {
    return NextResponse.json(
      { ok: false, message: 'Too many sign-in attempts. Please wait a few minutes.' },
      { status: 429 },
    );
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: 'Enter a valid email.' }, { status: 422 });
  }

  const { email, next } = parsed.data;
  const origin = new URL(request.url).origin;

  const supabase = createClient();

  const { data: domainRow } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'allowed_email_domain')
    .single();

  const domain = (domainRow?.value as string) ?? DEFAULT_EMAIL_DOMAIN;

  // Does this address already belong to an account? Existing users keep
  // access whatever their domain; new signups must be institutional.
  let isExistingUser = false;
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from('users')
      .select('id')
      .eq('email', email)
      .maybeSingle();
    isExistingUser = Boolean(data);
  } catch {
    // Service role unavailable — fall back to the domain rule alone.
  }

  if (!isExistingUser && !new RegExp(`^[^@\\s]+@${domain.replace(/\./g, '\\.')}$`, 'i').test(email)) {
    return NextResponse.json(
      { ok: false, message: `Use your institutional @${domain} email address to sign in.` },
      { status: 403 },
    );
  }

  const redirectTo = new URL('/auth/callback', origin);
  if (next && next.startsWith('/')) redirectTo.searchParams.set('next', next);

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: redirectTo.toString(), shouldCreateUser: true },
  });

  if (error) {
    console.error('[auth:otp]', error.message);
    return NextResponse.json(
      { ok: false, message: 'Could not send the sign-in link. Please try again.' },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, message: `Sign-in link sent to ${email}.` });
}
