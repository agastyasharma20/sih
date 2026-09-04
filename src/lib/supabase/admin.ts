import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { supabaseUrl, supabaseSecretKey } from './env';

/**
 * Privileged client, using Supabase's secret key (formerly service_role).
 * It carries BYPASSRLS, so it ignores every policy in 0002_rls.sql and is
 * confined to server-only paths that have already checked the caller's
 * role: account provisioning, the super-admin seed script, and reading
 * member emails to send confirmations.
 *
 * Never import this into a Client Component.
 */
export function createAdminClient() {
  return createSupabaseClient(supabaseUrl(), supabaseSecretKey(), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
