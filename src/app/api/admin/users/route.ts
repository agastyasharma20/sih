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

/**
 * Reset an account's password, or deactivate it.
 *
 * WHY THERE IS NO "SHOW PASSWORD" HERE
 *
 * Supabase Auth stores a bcrypt hash, never the password itself. There is
 * nothing to reveal — not to an admin, not to the database owner, not to
 * anyone. That is the whole point of hashing: if this database leaked,
 * every account would still be safe.
 *
 * What an administrator actually needs is to get a judge who has
 * forgotten their password back in, and this does that: set a new one and
 * hand it over, exactly as when the account was created. The reset is
 * written to the audit log, so there is a record of who reset whose
 * password and when — which reading a stored password would not give you.
 */
const patchSchema = z.union([
  z.object({
    action: z.literal('reset_password'),
    user_id: z.string().uuid(),
    password: z.string().min(12, 'Use at least 12 characters').max(72),
  }),
  z.object({
    action: z.literal('set_active'),
    user_id: z.string().uuid(),
    is_active: z.boolean(),
  }),
]);

export async function PATCH(request: Request) {
  const profile = await getSessionProfile();

  if (!profile || !isAdminTier(profile.role)) {
    return NextResponse.json({ ok: false, message: 'Not permitted.' }, { status: 403 });
  }

  if (profile.role === 'admin' && profile.admin_subtype === 'director') {
    return NextResponse.json(
      { ok: false, message: 'Account changes are handled by the SIH SPOC.' },
      { status: 403 },
    );
  }

  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, message: parsed.error.issues[0]?.message ?? 'Invalid request.' },
      { status: 422 },
    );
  }

  const admin = createAdminClient();

  const { data: target } = await admin
    .from('users')
    .select('id, email, role')
    .eq('id', parsed.data.user_id)
    .maybeSingle();

  if (!target) {
    return NextResponse.json({ ok: false, message: 'No such account.' }, { status: 404 });
  }

  // An admin must not be able to seize a more privileged account by
  // resetting its password.
  if (target.role === 'super_admin' && profile.role !== 'super_admin') {
    return NextResponse.json({ ok: false, message: 'No such account.' }, { status: 404 });
  }

  if (target.role === 'admin' && profile.role !== 'super_admin') {
    return NextResponse.json(
      { ok: false, message: 'Only a senior administrator can change an admin account.' },
      { status: 403 },
    );
  }

  const supabase = createClient();

  if (parsed.data.action === 'reset_password') {
    const { error } = await admin.auth.admin.updateUserById(target.id, {
      password: parsed.data.password,
    });

    if (error) {
      console.error('[users:reset_password]', error.message);
      return NextResponse.json(
        { ok: false, message: 'Could not set the new password.' },
        { status: 500 },
      );
    }

    // The password itself is deliberately not recorded.
    await supabase.rpc('write_audit', {
      p_action: 'user.password_reset',
      p_target_table: 'users',
      p_target_id: target.id,
      p_metadata: { email: target.email, by: profile.email },
    });

    return NextResponse.json({
      ok: true,
      message: `Password updated for ${target.email}. Share it with them directly.`,
    });
  }

  // Deactivating is how you remove access without deleting the audit
  // trail attached to the account.
  const { error } = await admin
    .from('users')
    .update({ is_active: parsed.data.is_active })
    .eq('id', target.id);

  if (error) {
    return NextResponse.json({ ok: false, message: 'Could not update the account.' }, { status: 500 });
  }

  await supabase.rpc('write_audit', {
    p_action: parsed.data.is_active ? 'user.reactivated' : 'user.deactivated',
    p_target_table: 'users',
    p_target_id: target.id,
    p_metadata: { email: target.email, by: profile.email },
  });

  return NextResponse.json({ ok: true, message: 'Account updated.' });
}
