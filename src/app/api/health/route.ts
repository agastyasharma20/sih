import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

/**
 * Deployment self-check.
 *
 * Reports whether each piece of configuration is present and whether the
 * database actually answers — the questions you have while a deployment
 * is half-working. It reports presence only: no key, value or fragment
 * of a secret is ever returned, so it is safe to leave reachable.
 */
export async function GET() {
  const checks: Record<string, unknown> = {};

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishable =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const secret = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

  checks.supabase_url = url ? 'set' : 'MISSING';
  checks.publishable_key = publishable
    ? publishable.startsWith('sb_secret_')
      ? 'WRONG KEY — this is a secret key, not the publishable one'
      : 'set'
    : 'MISSING — set NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY';
  checks.secret_key = secret
    ? secret.startsWith('sb_publishable_')
      ? 'WRONG KEY — this is the publishable key, not the secret one'
      : 'set'
    : 'MISSING — set SUPABASE_SECRET_KEY (sign-ups and admin screens need it)';

  checks.email = process.env.RESEND_API_KEY
    ? 'set'
    : 'not set — confirmation emails are skipped (registration still works)';

  // Does the database answer, and did the migrations run?
  try {
    const supabase = createClient();
    const { count, error } = await supabase
      .from('settings')
      .select('key', { count: 'exact', head: true });

    checks.database = error
      ? `ERROR — ${error.message}`
      : count === null
        ? 'reachable'
        : count >= 14
          ? `ready (${count} settings)`
          : `INCOMPLETE — ${count} settings, expected 14. Re-run SETUP_ALL.sql`;
  } catch (error) {
    checks.database = `UNREACHABLE — ${error instanceof Error ? error.message : 'unknown'}`;
  }

  // Can the server reach the admin API? This is what sign-up needs.
  try {
    const admin = createAdminClient();
    const { error } = await admin.from('users').select('id', { count: 'exact', head: true });
    checks.admin_access = error ? `ERROR — ${error.message}` : 'working';
  } catch (error) {
    checks.admin_access = `NOT CONFIGURED — ${error instanceof Error ? error.message : 'unknown'}`;
  }

  const healthy = Object.values(checks).every(
    (value) => !String(value).match(/MISSING|ERROR|WRONG|UNREACHABLE|INCOMPLETE|NOT CONFIGURED/),
  );

  return NextResponse.json(
    { healthy, checks },
    { status: healthy ? 200 : 503, headers: { 'Cache-Control': 'no-store' } },
  );
}
