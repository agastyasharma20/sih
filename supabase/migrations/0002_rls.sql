-- =====================================================================
-- Row-Level Security
--
-- Authorization is enforced here, in Postgres, not in the UI. A
-- coordinator calling the scores endpoint directly is refused by the
-- database, not by a hidden menu item.
-- =====================================================================

-- ------------------------------------------------------ role helpers
-- SECURITY DEFINER so the helper can read public.users without being
-- subject to the very policies it is being used to evaluate.
create or replace function public.current_app_role()
returns public.app_role
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select u.role
    from public.users u
   where u.id = auth.uid()
     and u.is_active;
$$;

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.current_app_role() = 'super_admin';
$$;

-- Admin tier and above: full data access including marks.
create or replace function public.is_admin_tier()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.current_app_role() in ('super_admin', 'admin');
$$;

-- SPOC admins do the operational data entry; directors are read-heavy.
create or replace function public.is_spoc()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.users u
     where u.id = auth.uid()
       and u.is_active
       and (
         u.role = 'super_admin'
         or (u.role = 'admin' and u.admin_subtype = 'spoc')
       )
  );
$$;

-- Roles allowed to see the team roster (never the marks).
create or replace function public.is_roster_viewer()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.current_app_role()
    in ('super_admin', 'admin', 'coordinator', 'judge');
$$;

-- Does the current user lead this team?
create or replace function public.owns_team(target_team uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.teams t
     where t.id = target_team
       and t.created_by = auth.uid()
  );
$$;

-- Registration edits are allowed until an admin locks the team or closes
-- registration globally.
create or replace function public.registration_editable(target_team uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
           (select (value #>> '{}')::boolean
              from public.settings where key = 'registration_open'),
           false)
     and not exists (
           select 1 from public.teams t
            where t.id = target_team
              and t.registration_locked_at is not null
         );
$$;

-- ------------------------------------------------------------- enable
alter table public.users              enable row level security;
alter table public.teams              enable row level security;
alter table public.members            enable row level security;
alter table public.mentors            enable row level security;
alter table public.problem_statements enable row level security;
alter table public.team_ps_selection  enable row level security;
alter table public.submissions        enable row level security;
alter table public.marking_criteria   enable row level security;
alter table public.scores             enable row level security;
alter table public.results            enable row level security;
alter table public.settings           enable row level security;
alter table public.audit_log          enable row level security;

-- -------------------------------------------------------------- users
-- Everyone reads their own row.
drop policy if exists users_select_self on public.users;
create policy users_select_self on public.users
  for select using (id = auth.uid());

-- Admins manage accounts but must never learn that a super-admin tier
-- exists: super-admin rows are filtered out of their result set.
drop policy if exists users_select_admin on public.users;
create policy users_select_admin on public.users
  for select using (
    public.is_admin_tier()
    and (public.is_super_admin() or role <> 'super_admin')
  );

drop policy if exists users_update_self on public.users;
create policy users_update_self on public.users
  for update using (id = auth.uid())
  with check (id = auth.uid());

-- Role changes and account creation go through the service-role API
-- routes, which audit-log every change. No client-side insert path.
drop policy if exists users_write_super_admin on public.users;
create policy users_write_super_admin on public.users
  for all using (public.is_super_admin())
  with check (public.is_super_admin());

-- -------------------------------------------------------------- teams
drop policy if exists teams_select_own on public.teams;
create policy teams_select_own on public.teams
  for select using (created_by = auth.uid());

drop policy if exists teams_select_staff on public.teams;
create policy teams_select_staff on public.teams
  for select using (public.is_roster_viewer());

drop policy if exists teams_insert_own on public.teams;
create policy teams_insert_own on public.teams
  for insert with check (created_by = auth.uid());

drop policy if exists teams_update_own on public.teams;
create policy teams_update_own on public.teams
  for update using (created_by = auth.uid() and public.registration_editable(id))
  with check (created_by = auth.uid());

drop policy if exists teams_write_admin on public.teams;
create policy teams_write_admin on public.teams
  for all using (public.is_admin_tier())
  with check (public.is_admin_tier());

-- ------------------------------------------------------------ members
drop policy if exists members_select_own on public.members;
create policy members_select_own on public.members
  for select using (public.owns_team(team_id));

drop policy if exists members_select_staff on public.members;
create policy members_select_staff on public.members
  for select using (public.is_roster_viewer());

drop policy if exists members_write_own on public.members;
create policy members_write_own on public.members
  for all using (public.owns_team(team_id) and public.registration_editable(team_id))
  with check (public.owns_team(team_id) and public.registration_editable(team_id));

drop policy if exists members_write_admin on public.members;
create policy members_write_admin on public.members
  for all using (public.is_admin_tier())
  with check (public.is_admin_tier());

-- ------------------------------------------------------------ mentors
drop policy if exists mentors_select_own on public.mentors;
create policy mentors_select_own on public.mentors
  for select using (public.owns_team(team_id));

drop policy if exists mentors_select_staff on public.mentors;
create policy mentors_select_staff on public.mentors
  for select using (public.is_roster_viewer());

drop policy if exists mentors_write_own on public.mentors;
create policy mentors_write_own on public.mentors
  for all using (public.owns_team(team_id) and public.registration_editable(team_id))
  with check (public.owns_team(team_id) and public.registration_editable(team_id));

drop policy if exists mentors_write_admin on public.mentors;
create policy mentors_write_admin on public.mentors
  for all using (public.is_admin_tier())
  with check (public.is_admin_tier());

-- -------------------------------------------------- problem statements
-- The PS list is public so teams can browse before choosing.
drop policy if exists ps_select_all on public.problem_statements;
create policy ps_select_all on public.problem_statements
  for select using (is_active or public.is_roster_viewer());

drop policy if exists ps_write_spoc on public.problem_statements;
create policy ps_write_spoc on public.problem_statements
  for all using (public.is_spoc()) with check (public.is_spoc());

-- --------------------------------------------------- team PS selection
drop policy if exists team_ps_select_own on public.team_ps_selection;
create policy team_ps_select_own on public.team_ps_selection
  for select using (public.owns_team(team_id));

drop policy if exists team_ps_select_staff on public.team_ps_selection;
create policy team_ps_select_staff on public.team_ps_selection
  for select using (public.is_roster_viewer());

drop policy if exists team_ps_write_own on public.team_ps_selection;
create policy team_ps_write_own on public.team_ps_selection
  for all using (public.owns_team(team_id) and public.registration_editable(team_id))
  with check (public.owns_team(team_id) and public.registration_editable(team_id));

drop policy if exists team_ps_write_admin on public.team_ps_selection;
create policy team_ps_write_admin on public.team_ps_selection
  for all using (public.is_admin_tier()) with check (public.is_admin_tier());

-- -------------------------------------------------------- submissions
drop policy if exists submissions_select_own on public.submissions;
create policy submissions_select_own on public.submissions
  for select using (public.owns_team(team_id));

drop policy if exists submissions_select_staff on public.submissions;
create policy submissions_select_staff on public.submissions
  for select using (public.is_roster_viewer());

drop policy if exists submissions_write_own on public.submissions;
create policy submissions_write_own on public.submissions
  for all using (public.owns_team(team_id))
  with check (public.owns_team(team_id));

drop policy if exists submissions_write_admin on public.submissions;
create policy submissions_write_admin on public.submissions
  for all using (public.is_admin_tier()) with check (public.is_admin_tier());

-- ---------------------------------------------------- marking criteria
drop policy if exists criteria_select_internal on public.marking_criteria;
create policy criteria_select_internal on public.marking_criteria
  for select using (public.current_app_role() is not null);

drop policy if exists criteria_write_admin on public.marking_criteria;
create policy criteria_write_admin on public.marking_criteria
  for all using (public.is_admin_tier()) with check (public.is_admin_tier());

-- ------------------------------------------------------------- scores
-- The load-bearing policy. Coordinators and team leads are absent from
-- every clause here, so no marks reach them through any client.
drop policy if exists scores_select_own_judge on public.scores;
create policy scores_select_own_judge on public.scores
  for select using (judge_id = auth.uid());

drop policy if exists scores_select_admin on public.scores;
create policy scores_select_admin on public.scores
  for select using (public.is_admin_tier());

drop policy if exists scores_write_own_judge on public.scores;
create policy scores_write_own_judge on public.scores
  for all using (judge_id = auth.uid() and public.current_app_role() = 'judge')
  with check (judge_id = auth.uid() and public.current_app_role() = 'judge');

drop policy if exists scores_write_admin on public.scores;
create policy scores_write_admin on public.scores
  for all using (public.is_admin_tier()) with check (public.is_admin_tier());

-- ------------------------------------------------------------ results
-- A team lead sees their own verdict only once it is published.
drop policy if exists results_select_own_published on public.results;
create policy results_select_own_published on public.results
  for select using (public.owns_team(team_id) and is_published);

drop policy if exists results_select_staff on public.results;
create policy results_select_staff on public.results
  for select using (public.is_roster_viewer());

drop policy if exists results_write_admin on public.results;
create policy results_write_admin on public.results
  for all using (public.is_admin_tier()) with check (public.is_admin_tier());

-- ----------------------------------------------------------- settings
drop policy if exists settings_select_public on public.settings;
create policy settings_select_public on public.settings
  for select using (is_public or public.current_app_role() is not null);

drop policy if exists settings_write_spoc on public.settings;
create policy settings_write_spoc on public.settings
  for all using (public.is_spoc()) with check (public.is_spoc());

-- ---------------------------------------------------------- audit log
drop policy if exists audit_select_super_admin on public.audit_log;
create policy audit_select_super_admin on public.audit_log
  for select using (public.is_super_admin());

-- Admins see the trail of their own actions, never anyone else's.
drop policy if exists audit_select_own on public.audit_log;
create policy audit_select_own on public.audit_log
  for select using (public.is_admin_tier() and actor_id = auth.uid());
