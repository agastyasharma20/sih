import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { supabaseUrl, supabasePublishableKey } from './env';

/** Server client bound to the caller's session cookies. Acts as the signed-in
 *  user, so RLS applies exactly as it does in the browser. */
export function createClient() {
  const cookieStore = cookies();

  return createServerClient(supabaseUrl(), supabasePublishableKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Called from a Server Component, where cookies are read-only.
          // Session refresh is handled by middleware instead.
        }
      },
    },
  });
}
