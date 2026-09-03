import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { AppRole, UserProfile } from '@/lib/types';

/**
 * Resolves the caller's role server-side, after authentication. The login
 * screen is identical for every role — nothing in the UI hints at which
 * tiers exist.
 */
export async function getSessionProfile(): Promise<UserProfile | null> {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data } = await supabase
    .from('users')
    .select('id, email, full_name, role, admin_subtype, is_active, created_at')
    .eq('id', user.id)
    .single();

  if (!data || !data.is_active) return null;

  return data as UserProfile;
}

export async function requireProfile(): Promise<UserProfile> {
  const profile = await getSessionProfile();
  if (!profile) redirect('/login');
  return profile;
}

export async function requireRole(...roles: AppRole[]): Promise<UserProfile> {
  const profile = await requireProfile();
  if (!roles.includes(profile.role)) redirect('/dashboard');
  return profile;
}

/** Landing route for each role once authentication has resolved. */
export function dashboardPathFor(role: AppRole): string {
  switch (role) {
    case 'super_admin':
    case 'admin':
      return '/dashboard/admin';
    case 'coordinator':
      return '/dashboard/coordinator';
    case 'judge':
      return '/dashboard/judge';
    default:
      return '/dashboard/team';
  }
}

/** Admin tier can see marks and analytics; coordinators explicitly cannot. */
export function isAdminTier(role: AppRole): boolean {
  return role === 'admin' || role === 'super_admin';
}

/** Operational admins (SPOC) plus super-admin do the data entry. */
export function isSpoc(profile: UserProfile): boolean {
  return (
    profile.role === 'super_admin' ||
    (profile.role === 'admin' && profile.admin_subtype === 'spoc')
  );
}
