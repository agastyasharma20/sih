import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { dashboardPathFor } from '@/lib/auth';
import type { AppRole } from '@/lib/types';

export const dynamic = 'force-dynamic';

/** Magic-link / OTP landing. Role is resolved here, server-side, and the
 *  user is forwarded to the dashboard their role owns. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const next = url.searchParams.get('next');

  if (!code) {
    return NextResponse.redirect(new URL('/login?error=missing_code', url.origin));
  }

  const supabase = createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(new URL('/login?error=invalid_link', url.origin));
  }

  if (next && next.startsWith('/')) {
    return NextResponse.redirect(new URL(next, url.origin));
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let role: AppRole = 'team_lead';
  if (user) {
    const { data } = await supabase.from('users').select('role').eq('id', user.id).single();
    if (data?.role) role = data.role as AppRole;
  }

  return NextResponse.redirect(new URL(dashboardPathFor(role), url.origin));
}
