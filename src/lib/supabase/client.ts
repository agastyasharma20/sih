'use client';

import { createBrowserClient } from '@supabase/ssr';

/** Browser client. Carries the anon key only — every table it touches is
 *  still gated by Row-Level Security. */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
