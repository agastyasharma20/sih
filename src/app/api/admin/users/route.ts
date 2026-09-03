import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getSessionProfile, isAdminTier } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * Account provisioning for Coordinator, Judge and Admin tiers. Judges never
 * self-register: an admin creates the account here and hands over the
 * credentials.
 *
 * The super-admin tier is deliberately absent from the accepted role list.
 * It is seeded once by scripts/seed-super-admin.ts and cannot be minted
 * through any HTTP path.
 */
const createUserSchema = z.object({
  email: z.string().trim().toLowerCase().regex(/^[^@\s]+@[^@\s]+\.[^@\s]+$/, 'Enter a valid email'),
  full_name: z.string().trim().min(2),
  role: z.enum(['admin', 'coordinator', 'judge']),
  admin_subtype: z.enum(['spoc', 'director']).nullable().optional(),
  password: z.string().min(12, 'Use at least 12 characters'),
});

export async function POST(request: Request) {
  const profile = await getSessionProfile();

  if (!profile || !isAdminTier(profile.role)) {
    return NextResponse.json({ ok: false, message: 'Not permitted.' }, { status: 403 });
  }

  // Sr. Directors are read-heavy by design; account creation is the SPOC's job.
  if (profile.role === 'admin' && profile.admin_subtype === 'director') {
    return NextResponse.json(
      { ok: false, message: 'Account creation is handled by the SIH SPOC.' },
      { status: 403 },
    );
  }

  const parsed = createUserSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, message: parsed.error.issues[0]?.message ?? 'Invalid input.' },
      { status: 422 },
    );
  }

  const { email, full_name, role, admin_subtype, password } = parsed.data;

  // Only a super-admin may mint another admin.
  if (role === 'admin' && profile.role !== 'super_admin') {
    return NextResponse.json(
      { ok: false, message: 'Only a senior administrator can create admin accounts.' },
      { status: 403 },
    );
  }

  const admin = createAdminClient();

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name },
  });

  if (createError || !created.user) {
    const message = createError?.message?.includes('already')
      ? 'An account with that email already exists.'
      : 'Could not create the account.';
    return NextResponse.json({ ok: false, message }, { status: 409 });
  }

  // The auth trigger creates the profile as 'team_lead'; elevate it here,
  // where the caller's own privileges have already been checked.
  const { error: roleError } = await admin
    .from('users')
    .update({
      role,
      admin_subtype: role === 'admin' ? (admin_subtype ?? 'spoc') : null,
      full_name,
      created_by: profile.id,
    })
    .eq('id', created.user.id);

  if (roleError) {
    await admin.auth.admin.deleteUser(created.user.id);
    return NextResponse.json(
      { ok: false, message: 'Could not assign the role. The account was rolled back.' },
      { status: 500 },
    );
  }

  const supabase = createClient();
  await supabase.rpc('write_audit', {
    p_action: 'user.created',
    p_target_table: 'users',
    p_target_id: created.user.id,
    p_metadata: { email, role, admin_subtype: admin_subtype ?? null },
  });

  return NextResponse.json({ ok: true, id: created.user.id, email, role });
}

/** Account listing. Super-admin rows are filtered out for admins by RLS. */
export async function GET() {
  const profile = await getSessionProfile();

  if (!profile || !isAdminTier(profile.role)) {
    return NextResponse.json({ ok: false, message: 'Not permitted.' }, { status: 403 });
  }

  const supabase = createClient();
  const { data, error } = await supabase
    .from('users')
    .select('id, email, full_name, role, admin_subtype, is_active, created_at')
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ ok: false, message: 'Could not load accounts.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, users: data });
}
