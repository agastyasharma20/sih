import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { supabaseUrl, supabasePublishableKey } from './env';

/**
 * A query to a database in the same region answers in tens of
 * milliseconds. Without a deadline, one that never answers — a paused
 * free project, a network blip — blocks the whole server render until
 * the platform gives up, and the visitor stares at nothing.
 *
 * Eight seconds is far longer than a healthy query and short enough that
 * a broken one still renders the page's empty state rather than hanging.
 */
const QUERY_TIMEOUT_MS = 8000;

function fetchWithTimeout(input: RequestInfo | URL, init?: RequestInit) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), QUERY_TIMEOUT_MS);

  // Respect a caller's own signal as well as our deadline.
  init?.signal?.addEventListener('abort', () => controller.abort(), { once: true });

  return fetch(input, { ...init, signal: controller.signal }).finally(() =>
    clearTimeout(timer),
  );
}

/** Server client bound to the caller's session cookies. Acts as the signed-in
 *  user, so RLS applies exactly as it does in the browser. */
export function createClient() {
  const cookieStore = cookies();

  return createServerClient(supabaseUrl(), supabasePublishableKey(), {
    global: { fetch: fetchWithTimeout },
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
