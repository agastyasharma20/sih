'use client';

import { createBrowserClient } from '@supabase/ssr';
import { supabaseUrl, supabasePublishableKey } from './env';

/** Browser client. Carries the anon key only — every table it touches is
 *  still gated by Row-Level Security. */
export function createClient() {
  return createBrowserClient(supabaseUrl(), supabasePublishableKey());
}
