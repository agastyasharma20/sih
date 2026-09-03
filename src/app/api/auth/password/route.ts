import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { rateLimit, clientIp } from '@/lib/rate-limit';
import { dashboardPathFor } from '@/lib/auth';
import type { AppRole } from '@/lib/types';

export const dynamic = 'force-dynamic';

const schema = z.object({
  email: z.string().trim().toLowerCase().min(3),
  password: z.string().min(1),
});

/**
 * Password sign-in. Rate limited per IP and per account to blunt
 * brute-force attempts. The response never distinguishes "no such
 * account" from "wrong password", and never reveals the signed-in role
 * beyond the dashboard path.
 */
export async function POST(request: Request) {
  const ip = clientIp(request);

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: 'Enter your email and password.' }, { status: 422 });
  }

  const { email, password } = parsed.data;

  const ipLimit = rateLimit(`pw-ip:${ip}`, 20, 15 * 60 * 1000);
  const accountLimit = rateLimit(`pw-acct:${email}`, 8, 15 * 60 * 1000);

  if (!ipLimit.allowed || !accountLimit.allowed) {
    return NextResponse.json(
      { ok: false, message: 'Too many sign-in attempts. Please wait a few minutes.' },
      {
        status: 429,
        headers: {
          'Retry-After': String(Math.max(ipLimit.retryAfterSeconds, accountLimit.retryAfterSeconds)),
        },
      },
    );
  }

  const supabase = createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.user) {
    return NextResponse.json(
      { ok: false, message: 'Those sign-in details are not correct.' },
      { status: 401 },
    );
  }

  const { data: profile } = await supabase
    .from('users')
    .select('role, is_active')
    .eq('id', data.user.id)
    .single();

  if (!profile?.is_active) {
    await supabase.auth.signOut();
    return NextResponse.json(
      { ok: false, message: 'This account is inactive. Contact the SIH SPOC.' },
      { status: 403 },
    );
  }

  return NextResponse.json({ ok: true, redirectTo: dashboardPathFor(profile.role as AppRole) });
}
