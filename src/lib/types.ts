export type AppRole = 'super_admin' | 'admin' | 'coordinator' | 'team_lead' | 'judge';
export type AdminSubtype = 'spoc' | 'director';
export type TeamStatus = 'draft' | 'submitted' | 'selected' | 'rejected';
export type Gender = 'male' | 'female' | 'other';

export interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  role: AppRole;
  admin_subtype: AdminSubtype | null;
  is_active: boolean;
  created_at: string;
}

export interface Member {
  id: string;
  team_id: string;
  is_lead: boolean;
  full_name: string;
  gender: Gender;
  branch: string;
  year: string;
  enrollment_number: string;
  email: string;
  phone: string;
  tentative_ps_id: string | null;
}

export interface Mentor {
  id: string;
  team_id: string;
  type: 'primary' | 'secondary';
  full_name: string;
  contact: string;
  email: string;
  affiliation: 'piemr' | 'industry';
}

export interface Team {
  id: string;
  team_id_short: string;
  team_name: string;
  status: TeamStatus;
  created_by: string;
  registration_locked_at: string | null;
  created_at: string;
}

export interface ProblemStatement {
  id: string;
  ps_id: string;
  title: string;
  category: 'software' | 'hardware';
  theme: string | null;
  description: string | null;
  is_active: boolean;
}

/** Shape returned by the register_team / update_team database functions. */
export type RegistrationResult =
  | { ok: true; team_id: string; team_id_short: string }
  | { ok: false; code: string; field?: string; value?: string; message: string };
