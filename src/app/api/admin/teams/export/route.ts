import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSessionProfile, isAdminTier } from '@/lib/auth';
import { toCsv } from '@/lib/csv';

export const dynamic = 'force-dynamic';

/**
 * Roster export, one row per member — the shape the institute needs for
 * SIH paperwork and attendance.
 *
 * Coordinators are included deliberately: this is roster data, which their
 * documentation role covers. It carries no marks, and RLS would strip them
 * even if the query asked.
 */
export async function GET() {
  const profile = await getSessionProfile();

  if (!profile || (!isAdminTier(profile.role) && profile.role !== 'coordinator')) {
    return NextResponse.json({ ok: false, message: 'Not permitted.' }, { status: 403 });
  }

  const supabase = createClient();

  const { data: teams, error } = await supabase
    .from('teams')
    .select(
      `team_id_short, team_name, status, created_at, registration_locked_at,
       members ( full_name, gender, branch, year, enrollment_number, email, phone, is_lead ),
       mentors ( type, full_name, email, contact )`,
    )
    .order('team_id_short');

  if (error) {
    return NextResponse.json({ ok: false, message: 'Could not build the export.' }, { status: 500 });
  }

  const headers = [
    'team_id', 'team_name', 'status', 'registered_at', 'locked',
    'member_name', 'is_lead', 'gender', 'branch', 'year',
    'enrollment_number', 'email', 'phone',
    'primary_mentor', 'primary_mentor_email', 'secondary_mentor',
  ];

  const rows: Array<Array<string | null>> = [];

  for (const team of teams ?? []) {
    const members = (team.members ?? []) as Array<Record<string, unknown>>;
    const mentors = (team.mentors ?? []) as Array<Record<string, unknown>>;
    const primary = mentors.find((m) => m.type === 'primary');
    const secondary = mentors.find((m) => m.type === 'secondary');

    // Lead first, so each team block reads naturally in a spreadsheet.
    const ordered = [...members].sort((a, b) => Number(b.is_lead) - Number(a.is_lead));

    for (const member of ordered) {
      rows.push([
        team.team_id_short,
        team.team_name,
        team.status,
        team.created_at ? new Date(team.created_at).toISOString() : '',
        team.registration_locked_at ? 'yes' : 'no',
        String(member.full_name ?? ''),
        member.is_lead ? 'yes' : 'no',
        String(member.gender ?? ''),
        String(member.branch ?? ''),
        String(member.year ?? ''),
        String(member.enrollment_number ?? ''),
        String(member.email ?? ''),
        String(member.phone ?? ''),
        String(primary?.full_name ?? ''),
        String(primary?.email ?? ''),
        String(secondary?.full_name ?? ''),
      ]);
    }
  }

  const csv = toCsv(headers, rows);
  const stamp = new Date().toISOString().slice(0, 10);

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="piemr-hackathon-teams-${stamp}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}
