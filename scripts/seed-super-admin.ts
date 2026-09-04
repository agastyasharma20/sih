/**
 * Seeds the single super-admin account.
 *
 * Credentials are read from the environment at deploy time and are never
 * written to the repository. Run once per environment:
 *
 *   SUPER_ADMIN_EMAIL=... SUPER_ADMIN_PASSWORD=... npm run seed:super-admin
 *
 * The account is deliberately unreachable from any HTTP path: nothing in
 * the app can create or elevate an account to this tier.
 */

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config({ path: '.env.local' });
config();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
// Supabase renamed service_role to the secret key (sb_secret_…); accept both.
const serviceKey =
  process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = process.env.SUPER_ADMIN_EMAIL;
const password = process.env.SUPER_ADMIN_PASSWORD;

function fail(message: string): never {
  console.error(`✗ ${message}`);
  process.exit(1);
}

if (!url || !serviceKey) {
  fail('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY must be set.');
}
if (!email || !password) fail('SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD must be set.');
if (password.length < 16) fail('SUPER_ADMIN_PASSWORD must be at least 16 characters.');

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  const normalizedEmail = email!.toLowerCase();

  const { data: existing } = await supabase
    .from('users')
    .select('id, role')
    .eq('email', normalizedEmail)
    .maybeSingle();

  let userId = existing?.id as string | undefined;

  if (!userId) {
    const { data, error } = await supabase.auth.admin.createUser({
      email: normalizedEmail,
      password,
      email_confirm: true,
      user_metadata: { full_name: 'System Administrator' },
    });

    if (error || !data.user) fail(`Could not create the account: ${error?.message}`);
    userId = data.user.id;
    console.log('✓ Auth account created.');
  } else {
    const { error } = await supabase.auth.admin.updateUserById(userId, { password });
    if (error) fail(`Could not update the password: ${error.message}`);
    console.log('✓ Existing account found — password rotated.');
  }

  const { error: roleError } = await supabase
    .from('users')
    .update({ role: 'super_admin', admin_subtype: null, is_active: true })
    .eq('id', userId);

  if (roleError) fail(`Could not assign the role: ${roleError.message}`);

  await supabase.from('audit_log').insert({
    actor_id: userId,
    actor_role: 'super_admin',
    action: 'super_admin.seeded',
    target_table: 'users',
    target_id: userId,
    metadata: { source: 'seed-script' },
  });

  // The address is echoed back so the operator can confirm which account
  // was provisioned; the password is never printed.
  console.log(`✓ Super-admin ready: ${normalizedEmail}`);
}

main().catch((error) => fail(error instanceof Error ? error.message : String(error)));
