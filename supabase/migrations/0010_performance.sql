-- =====================================================================
-- Query performance.
--
-- Two real costs, both flagged by Supabase's advisor:
--
-- 1. Eight policies call auth.uid() bare, so Postgres re-evaluates it
--    once per row scanned rather than once per statement. Wrapping it as
--    (select auth.uid()) turns it into an InitPlan, evaluated once. On a
--    227-row problem statement list or a growing members table this is
--    the difference between one call and hundreds.
--
-- 2. Five foreign keys have no covering index, so the planner falls back
--    to a sequential scan when joining or when checking a delete.
--
-- The advisor also reports ~150 "multiple permissive policies". That is
-- inherent to having one policy per audience (own / staff / admin), which
-- is what makes them readable and safe to change. Merging them into one
-- OR-ed expression per table would save little at this scale and would
-- make the security boundary much harder to reason about, so it is left
-- alone deliberately.
-- =====================================================================

-- ------------------------------------------------- auth.uid() InitPlans
drop policy if exists users_select_self on public.users;
create policy users_select_self on public.users
  for select using (id = (select auth.uid()));

drop policy if exists users_update_self on public.users;
create policy users_update_self on public.users
  for update using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

drop policy if exists teams_select_own on public.teams;
create policy teams_select_own on public.teams
  for select using (created_by = (select auth.uid()));

drop policy if exists teams_insert_own on public.teams;
create policy teams_insert_own on public.teams
  for insert with check (created_by = (select auth.uid()));

drop policy if exists teams_update_own on public.teams;
create policy teams_update_own on public.teams
  for update using (
    created_by = (select auth.uid()) and public.registration_editable(id)
  )
  with check (created_by = (select auth.uid()));

drop policy if exists scores_select_own_judge on public.scores;
create policy scores_select_own_judge on public.scores
  for select using (judge_id = (select auth.uid()));

drop policy if exists scores_write_own_judge on public.scores;
create policy scores_write_own_judge on public.scores
  for all using (
    judge_id = (select auth.uid()) and public.current_app_role() = 'judge'
  )
  with check (
    judge_id = (select auth.uid()) and public.current_app_role() = 'judge'
  );

drop policy if exists audit_select_own on public.audit_log;
create policy audit_select_own on public.audit_log
  for select using (
    public.is_admin_tier() and actor_id = (select auth.uid())
  );

-- -------------------------------------------- covering foreign key indexes
create index if not exists scores_criterion_idx
  on public.scores (criterion_id);
create index if not exists settings_updated_by_idx
  on public.settings (updated_by);
create index if not exists team_ps_selection_ps_idx
  on public.team_ps_selection (ps_id);
create index if not exists teams_tentative_ps_idx
  on public.teams (tentative_ps_id);
create index if not exists users_created_by_idx
  on public.users (created_by);

-- ---------------------------------------------------- hot-path indexes
-- Every judge lookup is by the 3-digit ID, and the admin results screen
-- joins scores back to submissions.
create index if not exists teams_short_id_idx
  on public.teams (team_id_short);
create index if not exists scores_submission_idx
  on public.scores (submission_id);
create index if not exists members_team_lead_idx
  on public.members (team_id, is_lead);

-- Indexes the advisor reports as never used are kept: it is measuring a
-- database with one team in it, and each of these covers a query the
-- event will actually run once teams and scores exist.
