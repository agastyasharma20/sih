import { redirect } from 'next/navigation';
import { requireProfile, dashboardPathFor } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/** Role is resolved server-side; the user never picks where they land. */
export default async function DashboardIndex() {
  const profile = await requireProfile();
  redirect(dashboardPathFor(profile.role));
}
