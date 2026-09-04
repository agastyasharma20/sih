/**
 * Supabase renamed its API keys in 2025: `anon` became the **publishable**
 * key (`sb_publishable_…`) and `service_role` became the **secret** key
 * (`sb_secret_…`). Projects created from November 2025 onwards only have
 * the new ones.
 *
 * Both spellings of each environment variable are accepted so the name in
 * your `.env` can match whatever the dashboard calls it. The new names win
 * when both are set.
 *
 * These must be plain static member accesses, not dynamic lookups —
 * Next.js inlines `NEXT_PUBLIC_*` into the client bundle at build time by
 * reading the source, and `process.env[someVariable]` would not be found.
 */

export function supabaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!url) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL is not set. Copy it from Supabase → Project Settings → API.',
    );
  }

  return url;
}

/** Browser-safe key. Every query it makes is still gated by RLS. */
export function supabasePublishableKey(): string {
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!key) {
    throw new Error(
      'Set NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (the sb_publishable_… key from ' +
        'Supabase → Project Settings → API). NEXT_PUBLIC_SUPABASE_ANON_KEY is ' +
        'also accepted for older projects.',
    );
  }

  return key;
}

/**
 * Server-only key. Carries BYPASSRLS, so it ignores every policy in
 * 0002_rls.sql — keep it out of anything that reaches the browser.
 */
export function supabaseSecretKey(): string {
  const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!key) {
    throw new Error(
      'Set SUPABASE_SECRET_KEY (the sb_secret_… key from Supabase → Project ' +
        'Settings → API). SUPABASE_SERVICE_ROLE_KEY is also accepted for older projects.',
    );
  }

  return key;
}
