-- =====================================================================
-- PIEMR Hackathon Platform — complete database setup
--
-- Paste this ENTIRE file into the Supabase SQL Editor and press Run.
-- It contains every migration in the correct order, so there is nothing
-- to sequence by hand.
--
-- Safe to run more than once. Every statement is idempotent: existing
-- objects are left alone and missing ones are created, so if a previous
-- run failed part-way you can simply run this again.
-- =====================================================================


-- ###################################################################
-- ## 0001_schema.sql
-- ###################################################################

-- =====================================================================
-- PIEMR Internal Hackathon Platform — core schema
-- Covers Modules 1-5. Module 1 (registration) is wired up in the app;
-- the remaining tables exist now so later modules need no migration of
-- existing data.
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------- enums
do $$ begin
  create type public.app_role as enum (
    'super_admin',
    'admin',
    'coordinator',
    'team_lead',
    'judge'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.admin_subtype as enum ('spoc', 'director');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.team_status as enum ('draft', 'submitted', 'selected', 'rejected');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.ps_category as enum ('software', 'hardware');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.mentor_type as enum ('primary', 'secondary');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.mentor_affiliation as enum ('piemr', 'industry');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.final_verdict as enum ('selected', 'waitlisted', 'rejected');
exception when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------- users
-- Password hashes live in auth.users (Supabase Auth). This table carries
-- authorization state only.
create table if not exists public.users (
  id            uuid primary key references auth.users (id) on delete cascade,
  email         text not null unique,
  full_name     text,
  role          public.app_role not null default 'team_lead',
  admin_subtype public.admin_subtype,
  created_by    uuid references public.users (id) on delete set null,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint users_admin_subtype_only_for_admin
    check (admin_subtype is null or role = 'admin')
);

create index if not exists users_role_idx on public.users (role);

-- ---------------------------------------------------------------- teams
-- team_id_short is the zero-padded 3-digit ID judges type in at
-- presentation time. Allocated from a sequence, 001-999.
create sequence if not exists public.team_short_id_seq as integer minvalue 1 maxvalue 999;

create table if not exists public.teams (
  id                    uuid primary key default gen_random_uuid(),
  team_id_short         text not null unique
                          check (team_id_short ~ '^[0-9]{3}$'),
  team_name             text not null unique,
  status                public.team_status not null default 'submitted',
  created_by            uuid not null references public.users (id) on delete restrict,
  registration_locked_at timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index if not exists teams_created_by_idx on public.teams (created_by);
create index if not exists teams_status_idx on public.teams (status);

-- -------------------------------------------------------------- members
-- Uniqueness is global, not per-team: a student already registered on one
-- team cannot appear on another.
create table if not exists public.members (
  id                uuid primary key default gen_random_uuid(),
  team_id           uuid not null references public.teams (id) on delete cascade,
  is_lead           boolean not null default false,
  full_name         text not null,
  gender            text not null check (gender in ('male', 'female', 'other')),
  branch            text not null,
  year              text not null,
  enrollment_number text not null,
  email             text not null,
  phone             text not null,
  tentative_ps_id   uuid, -- FK attached after problem_statements is created
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- Case/format-insensitive global uniqueness.
create unique index if not exists members_enrollment_unique
  on public.members (upper(enrollment_number));
create unique index if not exists members_email_unique
  on public.members (lower(email));
create unique index if not exists members_phone_unique
  on public.members (phone);
create index if not exists members_team_idx on public.members (team_id);

-- Exactly one lead per team.
create unique index if not exists members_one_lead_per_team
  on public.members (team_id) where is_lead;

-- -------------------------------------------------------------- mentors
create table if not exists public.mentors (
  id           uuid primary key default gen_random_uuid(),
  team_id      uuid not null references public.teams (id) on delete cascade,
  type         public.mentor_type not null,
  full_name    text not null,
  contact      text not null,
  email        text not null,
  affiliation  public.mentor_affiliation not null,
  is_required  boolean not null default false,
  created_at   timestamptz not null default now(),
  -- The primary mentor is mandatory and must be PIEMR-affiliated.
  constraint mentors_primary_is_piemr
    check (type <> 'primary' or affiliation = 'piemr')
);

create unique index if not exists mentors_one_per_type_per_team
  on public.mentors (team_id, type);
create index if not exists mentors_team_idx on public.mentors (team_id);

-- --------------------------------------------------- problem statements
create table if not exists public.problem_statements (
  id          uuid primary key default gen_random_uuid(),
  ps_id       text not null unique,
  title       text not null,
  category    public.ps_category not null,
  theme       text,
  description text,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists problem_statements_active_idx on public.problem_statements (is_active);

-- members.tentative_ps_id is declared above but problem_statements is
-- created after it; attach the FK now.
do $$ begin
  alter table public.members
    add constraint members_tentative_ps_fkey
    foreign key (tentative_ps_id)
    references public.problem_statements (id) on delete set null;
exception when duplicate_object then null;
end $$;

-- ------------------------------------------------ team PS selection (M2)
-- A team may run up to two ideas; each idea slot locks one PS.
create table if not exists public.team_ps_selection (
  id         uuid primary key default gen_random_uuid(),
  team_id    uuid not null references public.teams (id) on delete cascade,
  ps_id      uuid not null references public.problem_statements (id) on delete restrict,
  idea_slot  smallint not null check (idea_slot in (1, 2)),
  created_at timestamptz not null default now(),
  unique (team_id, idea_slot)
);

-- ---------------------------------------------------- submissions (M2)
create table if not exists public.submissions (
  id               uuid primary key default gen_random_uuid(),
  team_id          uuid not null references public.teams (id) on delete cascade,
  idea_slot        smallint not null check (idea_slot in (1, 2)),
  ppt_url          text,
  github_url       text,
  video_url        text,
  architecture_url text,
  submitted_at     timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (team_id, idea_slot)
);

-- ------------------------------------------------ marking criteria (M3)
create table if not exists public.marking_criteria (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  description   text,
  max_marks     numeric(5, 2) not null check (max_marks > 0),
  display_order integer not null default 0,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ---------------------------------------------------------- scores (M3)
create table if not exists public.scores (
  id           uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions (id) on delete cascade,
  judge_id     uuid not null references public.users (id) on delete restrict,
  criterion_id uuid not null references public.marking_criteria (id) on delete restrict,
  marks_given  numeric(5, 2) not null check (marks_given >= 0),
  remarks      text,
  scored_at    timestamptz not null default now(),
  unique (submission_id, judge_id, criterion_id)
);

create index if not exists scores_judge_idx on public.scores (judge_id);

-- --------------------------------------------------------- results (M4)
create table if not exists public.results (
  id            uuid primary key default gen_random_uuid(),
  team_id       uuid not null references public.teams (id) on delete cascade,
  idea_slot     smallint not null check (idea_slot in (1, 2)),
  is_published  boolean not null default false,
  final_verdict public.final_verdict,
  published_at  timestamptz,
  updated_at    timestamptz not null default now(),
  unique (team_id, idea_slot)
);

-- -------------------------------------------------------------- settings
create table if not exists public.settings (
  key         text primary key,
  value       jsonb,
  description text,
  is_public   boolean not null default false,
  updated_by  uuid references public.users (id) on delete set null,
  updated_at  timestamptz not null default now()
);

-- ------------------------------------------------------------- audit log
create table if not exists public.audit_log (
  id           bigserial primary key,
  actor_id     uuid references public.users (id) on delete set null,
  actor_role   public.app_role,
  action       text not null,
  target_table text,
  target_id    text,
  metadata     jsonb,
  created_at   timestamptz not null default now()
);

create index if not exists audit_log_actor_idx on public.audit_log (actor_id);
create index if not exists audit_log_created_idx on public.audit_log (created_at desc);

-- -------------------------------------------------------- updated_at fn
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists users_touch on public.users;
create trigger users_touch before update on public.users
  for each row execute function public.touch_updated_at();
drop trigger if exists teams_touch on public.teams;
create trigger teams_touch before update on public.teams
  for each row execute function public.touch_updated_at();
drop trigger if exists members_touch on public.members;
create trigger members_touch before update on public.members
  for each row execute function public.touch_updated_at();
drop trigger if exists problem_statements_touch on public.problem_statements;
create trigger problem_statements_touch before update on public.problem_statements
  for each row execute function public.touch_updated_at();
drop trigger if exists submissions_touch on public.submissions;
create trigger submissions_touch before update on public.submissions
  for each row execute function public.touch_updated_at();
drop trigger if exists marking_criteria_touch on public.marking_criteria;
create trigger marking_criteria_touch before update on public.marking_criteria
  for each row execute function public.touch_updated_at();
drop trigger if exists results_touch on public.results;
create trigger results_touch before update on public.results
  for each row execute function public.touch_updated_at();
drop trigger if exists settings_touch on public.settings;
create trigger settings_touch before update on public.settings
  for each row execute function public.touch_updated_at();

-- ------------------------------------------- team size guard (max six)
create or replace function public.enforce_team_size()
returns trigger
language plpgsql
as $$
declare
  member_count integer;
begin
  select count(*) into member_count
    from public.members
   where team_id = new.team_id;

  if member_count > 6 then
    raise exception 'A team cannot have more than 6 members'
      using errcode = 'check_violation';
  end if;

  return null;
end;
$$;

drop trigger if exists members_max_six on public.members;
create constraint trigger members_max_six
  after insert or update on public.members
  deferrable initially deferred
  for each row execute function public.enforce_team_size();

-- ###################################################################
-- ## 0002_rls.sql
-- ###################################################################

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

-- ###################################################################
-- ## 0003_functions.sql
-- ###################################################################

-- =====================================================================
-- Module 1 — registration functions
-- =====================================================================

-- ------------------------------------------- auth.users -> public.users
-- Every new auth user gets a profile. The role is ALWAYS 'team_lead'
-- here: signup metadata is attacker-controlled, so a self-registering
-- participant must not be able to claim a privileged role. Judge,
-- coordinator and admin accounts are elevated afterwards by the
-- service-role admin API, which audit-logs the change.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.users (id, email, full_name, role)
  values (
    new.id,
    lower(new.email),
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    'team_lead'
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- --------------------------------------------- 3-digit team ID handout
create or replace function public.allocate_team_short_id()
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  next_id integer;
begin
  select nextval('public.team_short_id_seq') into next_id;

  if next_id > 999 then
    raise exception 'Team ID space (001-999) is exhausted'
      using errcode = 'P0001';
  end if;

  return lpad(next_id::text, 3, '0');
end;
$$;

-- ------------------------------------------------------ audit logging
create or replace function public.write_audit(
  p_action       text,
  p_target_table text default null,
  p_target_id    text default null,
  p_metadata     jsonb default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.audit_log (actor_id, actor_role, action, target_table, target_id, metadata)
  values (auth.uid(), public.current_app_role(), p_action, p_target_table, p_target_id, p_metadata);
end;
$$;

-- =====================================================================
-- register_team
--
-- The single write path for Module 1. Every rule from the spec is
-- enforced here rather than in the browser: exactly six members, at
-- least one female member, institutional email domain, a required
-- PIEMR-affiliated primary mentor, and enrollment/email/phone
-- uniqueness across ALL teams.
--
-- Returns jsonb. On rejection: {ok:false, code, field, message} with no
-- rows written. On success: {ok:true, team_id, team_id_short}.
-- =====================================================================
create or replace function public.register_team(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor          uuid := auth.uid();
  v_actor_email    text;
  v_role           public.app_role;
  v_registration_open boolean;
  v_team_name      text;
  v_members        jsonb;
  v_member         jsonb;
  v_mentor         jsonb;
  v_female_count   integer := 0;
  v_lead_count     integer := 0;
  v_team_id        uuid;
  v_short_id       text;
  v_enrollment     text;
  v_email          text;
  v_phone          text;
  v_existing       text;
  v_ps_uuid        uuid;
  v_domain         text;
begin
  if v_actor is null then
    return jsonb_build_object('ok', false, 'code', 'unauthenticated',
      'message', 'You must be signed in to register a team.');
  end if;

  select role, email into v_role, v_actor_email
    from public.users where id = v_actor and is_active;

  if v_role is null then
    return jsonb_build_object('ok', false, 'code', 'unauthenticated',
      'message', 'Your account is inactive. Contact the SIH SPOC.');
  end if;

  if v_role <> 'team_lead' then
    return jsonb_build_object('ok', false, 'code', 'forbidden',
      'message', 'Only participant accounts can register a team.');
  end if;

  -- Registration window ------------------------------------------------
  select coalesce((value #>> '{}')::boolean, false)
    into v_registration_open
    from public.settings where key = 'registration_open';

  if not coalesce(v_registration_open, false) then
    return jsonb_build_object('ok', false, 'code', 'registration_closed',
      'message', 'Registration is currently closed.');
  end if;

  -- One team per team lead ---------------------------------------------
  if exists (select 1 from public.teams where created_by = v_actor) then
    return jsonb_build_object('ok', false, 'code', 'already_registered',
      'message', 'You have already registered a team. Edit it from your dashboard.');
  end if;

  v_domain := coalesce(
    (select value #>> '{}' from public.settings where key = 'allowed_email_domain'),
    'piemr.edu.in');

  v_team_name := trim(payload ->> 'team_name');
  v_members   := payload -> 'members';

  if v_team_name is null or length(v_team_name) < 3 then
    return jsonb_build_object('ok', false, 'code', 'invalid', 'field', 'team_name',
      'message', 'Team name must be at least 3 characters.');
  end if;

  if exists (select 1 from public.teams where lower(team_name) = lower(v_team_name)) then
    return jsonb_build_object('ok', false, 'code', 'duplicate', 'field', 'team_name',
      'message', 'That team name is already taken. Please pick another.');
  end if;

  -- Exactly six members -------------------------------------------------
  if v_members is null or jsonb_typeof(v_members) <> 'array' then
    return jsonb_build_object('ok', false, 'code', 'invalid', 'field', 'members',
      'message', 'Member list is missing.');
  end if;

  if jsonb_array_length(v_members) <> 6 then
    return jsonb_build_object('ok', false, 'code', 'invalid', 'field', 'members',
      'message', format('A team must have exactly 6 members. You submitted %s.',
                        jsonb_array_length(v_members)));
  end if;

  -- Per-member checks ---------------------------------------------------
  for v_member in select * from jsonb_array_elements(v_members)
  loop
    v_email      := lower(trim(v_member ->> 'email'));
    v_enrollment := upper(trim(v_member ->> 'enrollment_number'));
    v_phone      := regexp_replace(coalesce(v_member ->> 'phone', ''), '[^0-9]', '', 'g');

    if coalesce(trim(v_member ->> 'full_name'), '') = '' then
      return jsonb_build_object('ok', false, 'code', 'invalid', 'field', 'full_name',
        'message', 'Every member needs a full name.');
    end if;

    if v_email is null or v_email !~ ('^[^@[:space:]]+@' || replace(v_domain, '.', '\.') || '$') then
      return jsonb_build_object('ok', false, 'code', 'invalid', 'field', 'email',
        'message', format('%s is not a valid @%s address.',
                          coalesce(v_member ->> 'email', 'That address'), v_domain));
    end if;

    if length(v_phone) <> 10 then
      return jsonb_build_object('ok', false, 'code', 'invalid', 'field', 'phone',
        'message', 'Each phone number must be 10 digits.');
    end if;

    if v_enrollment = '' then
      return jsonb_build_object('ok', false, 'code', 'invalid', 'field', 'enrollment_number',
        'message', 'Every member needs an enrollment number.');
    end if;

    if coalesce(v_member ->> 'gender', '') = 'female' then
      v_female_count := v_female_count + 1;
    end if;

    if coalesce((v_member ->> 'is_lead')::boolean, false) then
      v_lead_count := v_lead_count + 1;
      if v_email <> lower(v_actor_email) then
        return jsonb_build_object('ok', false, 'code', 'invalid', 'field', 'is_lead',
          'message', 'The team lead entry must use the email you signed in with.');
      end if;
    end if;

    -- Global uniqueness, checked up front so the message can name the
    -- exact field that collided without leaking which team holds it.
    select 'x' into v_existing from public.members
     where upper(enrollment_number) = v_enrollment limit 1;
    if found then
      return jsonb_build_object('ok', false, 'code', 'duplicate', 'field', 'enrollment_number',
        'value', v_enrollment,
        'message', format('Enrollment number %s is already registered with another team.', v_enrollment));
    end if;

    select 'x' into v_existing from public.members
     where lower(email) = v_email limit 1;
    if found then
      return jsonb_build_object('ok', false, 'code', 'duplicate', 'field', 'email',
        'value', v_email,
        'message', format('%s is already registered with another team.', v_email));
    end if;

    select 'x' into v_existing from public.members
     where phone = v_phone limit 1;
    if found then
      return jsonb_build_object('ok', false, 'code', 'duplicate', 'field', 'phone',
        'value', v_phone,
        'message', format('Phone number %s is already registered with another team.', v_phone));
    end if;
  end loop;

  -- Duplicates *within* the submitted form ------------------------------
  if (select count(distinct lower(m ->> 'email')) from jsonb_array_elements(v_members) m) <> 6 then
    return jsonb_build_object('ok', false, 'code', 'duplicate', 'field', 'email',
      'message', 'Two members share the same email address.');
  end if;

  if (select count(distinct upper(trim(m ->> 'enrollment_number')))
        from jsonb_array_elements(v_members) m) <> 6 then
    return jsonb_build_object('ok', false, 'code', 'duplicate', 'field', 'enrollment_number',
      'message', 'Two members share the same enrollment number.');
  end if;

  if (select count(distinct regexp_replace(m ->> 'phone', '[^0-9]', '', 'g'))
        from jsonb_array_elements(v_members) m) <> 6 then
    return jsonb_build_object('ok', false, 'code', 'duplicate', 'field', 'phone',
      'message', 'Two members share the same phone number.');
  end if;

  if v_lead_count <> 1 then
    return jsonb_build_object('ok', false, 'code', 'invalid', 'field', 'is_lead',
      'message', 'Exactly one member must be marked as the team lead.');
  end if;

  -- Compulsory: at least one female member ------------------------------
  if v_female_count < 1 then
    return jsonb_build_object('ok', false, 'code', 'invalid', 'field', 'gender',
      'message', 'A team must include at least one female member.');
  end if;

  -- Primary mentor ------------------------------------------------------
  v_mentor := payload -> 'primary_mentor';
  if v_mentor is null or coalesce(trim(v_mentor ->> 'full_name'), '') = '' then
    return jsonb_build_object('ok', false, 'code', 'invalid', 'field', 'primary_mentor',
      'message', 'A primary mentor is required.');
  end if;

  if lower(coalesce(v_mentor ->> 'email', '')) !~ ('^[^@[:space:]]+@' || replace(v_domain, '.', '\.') || '$') then
    return jsonb_build_object('ok', false, 'code', 'invalid', 'field', 'primary_mentor_email',
      'message', format('The primary mentor must be PIEMR-affiliated (@%s address).', v_domain));
  end if;

  -- ------------------------------------------------------- write phase
  v_short_id := public.allocate_team_short_id();

  insert into public.teams (team_id_short, team_name, status, created_by)
  values (v_short_id, v_team_name, 'submitted', v_actor)
  returning id into v_team_id;

  for v_member in select * from jsonb_array_elements(v_members)
  loop
    v_ps_uuid := null;
    if nullif(trim(coalesce(v_member ->> 'tentative_ps_id', '')), '') is not null
       and (v_member ->> 'tentative_ps_id') <> 'TBD' then
      select id into v_ps_uuid from public.problem_statements
       where ps_id = trim(v_member ->> 'tentative_ps_id');
    end if;

    insert into public.members (
      team_id, is_lead, full_name, gender, branch, year,
      enrollment_number, email, phone, tentative_ps_id
    ) values (
      v_team_id,
      coalesce((v_member ->> 'is_lead')::boolean, false),
      trim(v_member ->> 'full_name'),
      v_member ->> 'gender',
      trim(v_member ->> 'branch'),
      trim(v_member ->> 'year'),
      upper(trim(v_member ->> 'enrollment_number')),
      lower(trim(v_member ->> 'email')),
      regexp_replace(v_member ->> 'phone', '[^0-9]', '', 'g'),
      v_ps_uuid
    );
  end loop;

  insert into public.mentors (team_id, type, full_name, contact, email, affiliation, is_required)
  values (
    v_team_id, 'primary',
    trim(v_mentor ->> 'full_name'),
    trim(v_mentor ->> 'contact'),
    lower(trim(v_mentor ->> 'email')),
    'piemr', true
  );

  v_mentor := payload -> 'secondary_mentor';
  if v_mentor is not null and coalesce(trim(v_mentor ->> 'full_name'), '') <> '' then
    insert into public.mentors (team_id, type, full_name, contact, email, affiliation, is_required)
    values (
      v_team_id, 'secondary',
      trim(v_mentor ->> 'full_name'),
      trim(v_mentor ->> 'contact'),
      lower(trim(v_mentor ->> 'email')),
      coalesce(nullif(v_mentor ->> 'affiliation', ''), 'industry')::public.mentor_affiliation,
      false
    );
  end if;

  perform public.write_audit('team.registered', 'teams', v_team_id::text,
    jsonb_build_object('team_id_short', v_short_id, 'team_name', v_team_name));

  return jsonb_build_object(
    'ok', true,
    'team_id', v_team_id,
    'team_id_short', v_short_id
  );

exception
  -- Two team leads submitting the same student at the same instant lose
  -- the race at the unique index rather than at the check above.
  when unique_violation then
    return jsonb_build_object(
      'ok', false,
      'code', 'duplicate',
      'field', case
        when sqlerrm like '%members_enrollment_unique%' then 'enrollment_number'
        when sqlerrm like '%members_email_unique%'      then 'email'
        when sqlerrm like '%members_phone_unique%'      then 'phone'
        when sqlerrm like '%teams_team_name_key%'       then 'team_name'
        else 'unknown'
      end,
      'message', 'Someone else just registered one of these details. Please re-check and try again.'
    );
end;
$$;

revoke all on function public.register_team(jsonb) from public;
grant execute on function public.register_team(jsonb) to authenticated;

-- =====================================================================
-- update_team — team-lead self-service edits, allowed until an admin
-- locks the team or closes registration. Same rule set as registration.
-- =====================================================================
create or replace function public.update_team(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor        uuid := auth.uid();
  v_team_id      uuid;
  v_short_id     text;
  v_team_name    text;
  v_members      jsonb;
  v_member       jsonb;
  v_mentor       jsonb;
  v_female_count integer := 0;
  v_lead_count   integer := 0;
  v_email        text;
  v_enrollment   text;
  v_phone        text;
  v_ps_uuid      uuid;
  v_domain       text;
  v_conflict     text;
begin
  if v_actor is null then
    return jsonb_build_object('ok', false, 'code', 'unauthenticated',
      'message', 'You must be signed in.');
  end if;

  select id, team_id_short into v_team_id, v_short_id
    from public.teams where created_by = v_actor;

  if v_team_id is null then
    return jsonb_build_object('ok', false, 'code', 'not_found',
      'message', 'You have not registered a team yet.');
  end if;

  if not public.registration_editable(v_team_id) then
    return jsonb_build_object('ok', false, 'code', 'locked',
      'message', 'Registration is closed — your team details can no longer be edited.');
  end if;

  v_domain := coalesce(
    (select value #>> '{}' from public.settings where key = 'allowed_email_domain'),
    'piemr.edu.in');

  v_team_name := trim(payload ->> 'team_name');
  v_members   := payload -> 'members';

  if v_team_name is null or length(v_team_name) < 3 then
    return jsonb_build_object('ok', false, 'code', 'invalid', 'field', 'team_name',
      'message', 'Team name must be at least 3 characters.');
  end if;

  if exists (select 1 from public.teams
              where lower(team_name) = lower(v_team_name) and id <> v_team_id) then
    return jsonb_build_object('ok', false, 'code', 'duplicate', 'field', 'team_name',
      'message', 'That team name is already taken.');
  end if;

  if v_members is null or jsonb_array_length(v_members) <> 6 then
    return jsonb_build_object('ok', false, 'code', 'invalid', 'field', 'members',
      'message', 'A team must have exactly 6 members.');
  end if;

  for v_member in select * from jsonb_array_elements(v_members)
  loop
    v_email      := lower(trim(v_member ->> 'email'));
    v_enrollment := upper(trim(v_member ->> 'enrollment_number'));
    v_phone      := regexp_replace(coalesce(v_member ->> 'phone', ''), '[^0-9]', '', 'g');

    if v_email !~ ('^[^@[:space:]]+@' || replace(v_domain, '.', '\.') || '$') then
      return jsonb_build_object('ok', false, 'code', 'invalid', 'field', 'email',
        'message', format('%s is not a valid @%s address.', v_email, v_domain));
    end if;

    if length(v_phone) <> 10 then
      return jsonb_build_object('ok', false, 'code', 'invalid', 'field', 'phone',
        'message', 'Each phone number must be 10 digits.');
    end if;

    if coalesce(v_member ->> 'gender', '') = 'female' then
      v_female_count := v_female_count + 1;
    end if;
    if coalesce((v_member ->> 'is_lead')::boolean, false) then
      v_lead_count := v_lead_count + 1;
    end if;

    -- Uniqueness excludes this team's own rows, so a member keeping their
    -- details does not collide with themselves.
    select 'enrollment_number' into v_conflict from public.members
     where upper(enrollment_number) = v_enrollment and team_id <> v_team_id limit 1;
    if found then
      return jsonb_build_object('ok', false, 'code', 'duplicate', 'field', 'enrollment_number',
        'message', format('Enrollment number %s is already registered with another team.', v_enrollment));
    end if;

    select 'email' into v_conflict from public.members
     where lower(email) = v_email and team_id <> v_team_id limit 1;
    if found then
      return jsonb_build_object('ok', false, 'code', 'duplicate', 'field', 'email',
        'message', format('%s is already registered with another team.', v_email));
    end if;

    select 'phone' into v_conflict from public.members
     where phone = v_phone and team_id <> v_team_id limit 1;
    if found then
      return jsonb_build_object('ok', false, 'code', 'duplicate', 'field', 'phone',
        'message', format('Phone number %s is already registered with another team.', v_phone));
    end if;
  end loop;

  if v_lead_count <> 1 then
    return jsonb_build_object('ok', false, 'code', 'invalid', 'field', 'is_lead',
      'message', 'Exactly one member must be marked as the team lead.');
  end if;

  if v_female_count < 1 then
    return jsonb_build_object('ok', false, 'code', 'invalid', 'field', 'gender',
      'message', 'A team must include at least one female member.');
  end if;

  v_mentor := payload -> 'primary_mentor';
  if v_mentor is null or coalesce(trim(v_mentor ->> 'full_name'), '') = '' then
    return jsonb_build_object('ok', false, 'code', 'invalid', 'field', 'primary_mentor',
      'message', 'A primary mentor is required.');
  end if;

  if lower(coalesce(v_mentor ->> 'email', '')) !~ ('^[^@[:space:]]+@' || replace(v_domain, '.', '\.') || '$') then
    return jsonb_build_object('ok', false, 'code', 'invalid', 'field', 'primary_mentor_email',
      'message', format('The primary mentor must be PIEMR-affiliated (@%s address).', v_domain));
  end if;

  -- ------------------------------------------------------- write phase
  update public.teams set team_name = v_team_name where id = v_team_id;

  delete from public.members where team_id = v_team_id;

  for v_member in select * from jsonb_array_elements(v_members)
  loop
    v_ps_uuid := null;
    if nullif(trim(coalesce(v_member ->> 'tentative_ps_id', '')), '') is not null
       and (v_member ->> 'tentative_ps_id') <> 'TBD' then
      select id into v_ps_uuid from public.problem_statements
       where ps_id = trim(v_member ->> 'tentative_ps_id');
    end if;

    insert into public.members (
      team_id, is_lead, full_name, gender, branch, year,
      enrollment_number, email, phone, tentative_ps_id
    ) values (
      v_team_id,
      coalesce((v_member ->> 'is_lead')::boolean, false),
      trim(v_member ->> 'full_name'),
      v_member ->> 'gender',
      trim(v_member ->> 'branch'),
      trim(v_member ->> 'year'),
      upper(trim(v_member ->> 'enrollment_number')),
      lower(trim(v_member ->> 'email')),
      regexp_replace(v_member ->> 'phone', '[^0-9]', '', 'g'),
      v_ps_uuid
    );
  end loop;

  delete from public.mentors where team_id = v_team_id;

  insert into public.mentors (team_id, type, full_name, contact, email, affiliation, is_required)
  values (v_team_id, 'primary', trim(v_mentor ->> 'full_name'), trim(v_mentor ->> 'contact'),
          lower(trim(v_mentor ->> 'email')), 'piemr', true);

  v_mentor := payload -> 'secondary_mentor';
  if v_mentor is not null and coalesce(trim(v_mentor ->> 'full_name'), '') <> '' then
    insert into public.mentors (team_id, type, full_name, contact, email, affiliation, is_required)
    values (v_team_id, 'secondary', trim(v_mentor ->> 'full_name'), trim(v_mentor ->> 'contact'),
            lower(trim(v_mentor ->> 'email')),
            coalesce(nullif(v_mentor ->> 'affiliation', ''), 'industry')::public.mentor_affiliation,
            false);
  end if;

  perform public.write_audit('team.updated', 'teams', v_team_id::text,
    jsonb_build_object('team_id_short', v_short_id));

  return jsonb_build_object('ok', true, 'team_id', v_team_id, 'team_id_short', v_short_id);

exception
  when unique_violation then
    return jsonb_build_object('ok', false, 'code', 'duplicate', 'field',
      case
        when sqlerrm like '%members_enrollment_unique%' then 'enrollment_number'
        when sqlerrm like '%members_email_unique%'      then 'email'
        when sqlerrm like '%members_phone_unique%'      then 'phone'
        else 'unknown'
      end,
      'message', 'Someone else just registered one of these details. Please re-check and try again.');
end;
$$;

revoke all on function public.update_team(jsonb) from public;
grant execute on function public.update_team(jsonb) to authenticated;

-- ###################################################################
-- ## 0004_seed.sql
-- ###################################################################

-- =====================================================================
-- Seed data: settings defaults and the marking rubric.
--
-- Dates are intentionally null. The hackathon date, PS release date and
-- submission deadline are still TBD and are edited from the admin
-- settings screen — nothing here is hardcoded to a calendar.
-- =====================================================================

insert into public.settings (key, value, description, is_public) values
  ('registration_open',   'false'::jsonb,
   'Master switch for Module 1. While false, no team can register or edit.', true),
  ('hackathon_date',      'null'::jsonb,
   'Date of the internal hackathon. TBD.', true),
  ('ps_release_date',     'null'::jsonb,
   'Date the SIH problem statement list is published to teams. TBD.', true),
  ('submission_deadline', 'null'::jsonb,
   'Deadline for Module 2 idea/prototype submissions. TBD.', true),
  ('results_date',        'null'::jsonb,
   'Date results are published. TBD.', true),
  ('allowed_email_domain','"piemr.edu.in"'::jsonb,
   'Institutional email domain enforced on participants and primary mentors.', true),
  ('team_size',           '6'::jsonb,
   'Required number of members per team.', true),
  ('min_female_members',  '1'::jsonb,
   'Minimum female members per team.', true),
  ('max_ideas_per_team',  '2'::jsonb,
   'Number of problem statements a team may submit against.', true),
  ('event_name',          '"PIEMR Internal Hackathon"'::jsonb,
   'Display name used across the site and in emails.', true),
  ('ps_list_published',   'false'::jsonb,
   'When false, teams may leave the tentative PS choice as TBD.', true)
on conflict (key) do nothing;

-- ---------------------------------------------------------------------
-- Default marking rubric, SIH-style. Admin and Super-Admin can add,
-- edit, remove or reweight these at any time from settings — verify
-- against the current edition's official judging sheet before the event.
-- ---------------------------------------------------------------------
insert into public.marking_criteria (name, description, max_marks, display_order)
select * from (values
  ('Problem Understanding & Relevance',
   'Grasp of the chosen problem statement and the significance of solving it.', 20, 1),
  ('Innovation & Novelty',
   'Originality of the approach compared to existing solutions.', 20, 2),
  ('Technical Feasibility & Complexity',
   'Soundness of the technical approach and the depth of engineering involved.', 20, 3),
  ('Clarity of Presentation',
   'Structure, clarity and confidence of the pitch and supporting material.', 20, 4),
  ('Execution & Prototype Readiness',
   'How much of the solution is actually working and demonstrable.', 20, 5)
) as seed(name, description, max_marks, display_order)
-- Seeded once. Re-running must not duplicate the rubric, and there is no
-- unique key on name, so guard on the table being empty instead.
where not exists (select 1 from public.marking_criteria);

-- ###################################################################
-- ## 0005_grants.sql
-- ###################################################################

-- =====================================================================
-- Explicit privilege grants.
--
-- A hosted Supabase project grants these to anon/authenticated by
-- default, but stating them here keeps the migrations self-contained and
-- reproducible on a plain Postgres instance. Table privileges are only
-- the outer gate — RLS still decides which rows each role actually sees.
-- =====================================================================

grant usage on schema public to anon, authenticated, service_role;

-- Signed-in users: full DML surface, narrowed to their own rows by RLS.
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;

-- Anonymous visitors: read-only, and only the rows the public-facing
-- policies expose (active problem statements, public settings).
grant select on public.problem_statements to anon;
grant select on public.settings to anon;

grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;

alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public
  grant all on tables to service_role;

-- ---------------------------------------------------------------------
-- Public counters for the landing page.
--
-- The teams and members tables are closed to anonymous visitors, so the
-- hero statistics come from this aggregate instead. It returns counts
-- only — no row ever leaves the function.
-- ---------------------------------------------------------------------
create or replace function public.public_stats()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'teams',        (select count(*) from public.teams),
    'participants', (select count(*) from public.members),
    'problem_statements',
                    (select count(*) from public.problem_statements where is_active)
  );
$$;

revoke all on function public.public_stats() from public;
grant execute on function public.public_stats() to anon, authenticated;

-- ###################################################################
-- ## 0006_submissions_judging.sql
-- ###################################################################

-- =====================================================================
-- Modules 2, 3 and 4 — submissions, judging and results
--
-- The tables already exist from 0001. This migration adds the write
-- paths, the judging lookups, and the policies that keep a judge inside
-- their own scores.
-- =====================================================================

-- ---------------------------------------------------------- settings
insert into public.settings (key, value, description, is_public) values
  ('submissions_open', 'false'::jsonb,
   'Master switch for Module 2. While false, no team can submit or edit an idea.', true),
  ('judging_open', 'false'::jsonb,
   'Master switch for Module 3. While false, judges cannot record scores.', true),
  ('results_published', 'false'::jsonb,
   'When true, teams see their own verdict and the public results page lists selections.', true)
on conflict (key) do nothing;

-- ---------------------------------------------- submission editability
create or replace function public.submissions_editable()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    (select (value #>> '{}')::boolean from public.settings where key = 'submissions_open'),
    false);
$$;

-- =====================================================================
-- Module 2 — submit_idea
--
-- One call per idea slot. Locks the team's problem statement choice for
-- that slot and records whatever artefacts have been provided so far, so
-- a team can save a partial draft and come back to it.
-- =====================================================================
create or replace function public.submit_idea(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor    uuid := auth.uid();
  v_team     uuid;
  v_slot     smallint;
  v_ps_id    text;
  v_ps       uuid;
  v_max      integer;
  v_final    boolean;
  v_sub      uuid;
begin
  if v_actor is null then
    return jsonb_build_object('ok', false, 'code', 'unauthenticated',
      'message', 'You must be signed in.');
  end if;

  select id into v_team from public.teams where created_by = v_actor;
  if v_team is null then
    return jsonb_build_object('ok', false, 'code', 'not_found',
      'message', 'Register a team before submitting an idea.');
  end if;

  if not public.submissions_editable() then
    return jsonb_build_object('ok', false, 'code', 'closed',
      'message', 'Submissions are closed.');
  end if;

  v_slot := coalesce((payload ->> 'idea_slot')::smallint, 1);

  select coalesce((value #>> '{}')::integer, 2) into v_max
    from public.settings where key = 'max_ideas_per_team';

  if v_slot < 1 or v_slot > coalesce(v_max, 2) then
    return jsonb_build_object('ok', false, 'code', 'invalid', 'field', 'idea_slot',
      'message', format('Idea slot must be between 1 and %s.', coalesce(v_max, 2)));
  end if;

  -- Problem statement: required to finalise, optional while drafting.
  v_ps_id := nullif(trim(coalesce(payload ->> 'ps_id', '')), '');
  v_final := coalesce((payload ->> 'final')::boolean, false);

  if v_ps_id is not null then
    select id into v_ps from public.problem_statements
     where ps_id = v_ps_id and is_active;

    if v_ps is null then
      return jsonb_build_object('ok', false, 'code', 'invalid', 'field', 'ps_id',
        'message', format('Problem statement %s is not on the active list.', v_ps_id));
    end if;

    -- The same PS cannot be used for both of a team's slots.
    if exists (
      select 1 from public.team_ps_selection
       where team_id = v_team and ps_id = v_ps and idea_slot <> v_slot
    ) then
      return jsonb_build_object('ok', false, 'code', 'duplicate', 'field', 'ps_id',
        'message', 'Your other idea already uses this problem statement.');
    end if;

    insert into public.team_ps_selection (team_id, ps_id, idea_slot)
    values (v_team, v_ps, v_slot)
    on conflict (team_id, idea_slot) do update set ps_id = excluded.ps_id;
  end if;

  if v_final and v_ps_id is null then
    return jsonb_build_object('ok', false, 'code', 'invalid', 'field', 'ps_id',
      'message', 'Choose a problem statement before submitting.');
  end if;

  insert into public.submissions (
    team_id, idea_slot, ppt_url, github_url, video_url, architecture_url, submitted_at
  ) values (
    v_team, v_slot,
    nullif(trim(coalesce(payload ->> 'ppt_url', '')), ''),
    nullif(trim(coalesce(payload ->> 'github_url', '')), ''),
    nullif(trim(coalesce(payload ->> 'video_url', '')), ''),
    nullif(trim(coalesce(payload ->> 'architecture_url', '')), ''),
    case when v_final then now() else null end
  )
  on conflict (team_id, idea_slot) do update set
    ppt_url          = excluded.ppt_url,
    github_url       = excluded.github_url,
    video_url        = excluded.video_url,
    architecture_url = excluded.architecture_url,
    -- Once finalised, the timestamp stands; a later draft save cannot clear it.
    submitted_at     = coalesce(excluded.submitted_at, public.submissions.submitted_at)
  returning id into v_sub;

  perform public.write_audit(
    case when v_final then 'submission.finalised' else 'submission.saved' end,
    'submissions', v_sub::text,
    jsonb_build_object('idea_slot', v_slot, 'ps_id', v_ps_id));

  return jsonb_build_object('ok', true, 'submission_id', v_sub, 'idea_slot', v_slot,
                            'final', v_final);
end;
$$;

revoke all on function public.submit_idea(jsonb) from public;
grant execute on function public.submit_idea(jsonb) to authenticated;

-- =====================================================================
-- Module 3 — judging
-- =====================================================================

-- Look up a team by the 3-digit ID a judge types at the presentation.
-- SECURITY DEFINER so it returns exactly one team's submission summary
-- and nothing else, regardless of what the caller asks for.
create or replace function public.judge_lookup_team(p_short_id text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_role public.app_role := public.current_app_role();
  v_team public.teams%rowtype;
  v_slots jsonb;
begin
  if v_role is null or v_role not in ('judge', 'admin', 'super_admin') then
    return jsonb_build_object('ok', false, 'code', 'forbidden',
      'message', 'Only judges can look up a team for scoring.');
  end if;

  select * into v_team from public.teams
   where team_id_short = lpad(trim(p_short_id), 3, '0');

  if v_team.id is null then
    return jsonb_build_object('ok', false, 'code', 'not_found',
      'message', format('No team with ID %s.', trim(p_short_id)));
  end if;

  select coalesce(jsonb_agg(slot order by slot.idea_slot), '[]'::jsonb) into v_slots
  from (
    select s.idea_slot,
           s.id as submission_id,
           s.github_url,
           s.video_url,
           s.ppt_url,
           s.architecture_url,
           s.submitted_at,
           ps.ps_id,
           ps.title as ps_title,
           ps.category as ps_category,
           -- How much of this judge's own scoring is already recorded.
           (select count(*) from public.scores sc
             where sc.submission_id = s.id and sc.judge_id = auth.uid()) as scored_criteria
      from public.submissions s
      left join public.team_ps_selection sel
        on sel.team_id = s.team_id and sel.idea_slot = s.idea_slot
      left join public.problem_statements ps on ps.id = sel.ps_id
     where s.team_id = v_team.id
  ) slot;

  return jsonb_build_object(
    'ok', true,
    'team', jsonb_build_object(
      'id', v_team.id,
      'team_id_short', v_team.team_id_short,
      'team_name', v_team.team_name,
      'status', v_team.status
    ),
    'slots', v_slots
  );
end;
$$;

revoke all on function public.judge_lookup_team(text) from public;
grant execute on function public.judge_lookup_team(text) to authenticated;

-- ---------------------------------------------------------- save_scores
-- A judge records marks and remarks for one submission in one call.
-- Marks are validated against each criterion's own maximum, so a judge
-- cannot award 50 out of 20.
create or replace function public.save_scores(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor   uuid := auth.uid();
  v_role    public.app_role := public.current_app_role();
  v_sub     uuid;
  v_entry   jsonb;
  v_crit    uuid;
  v_max     numeric;
  v_marks   numeric;
  v_written integer := 0;
begin
  if v_actor is null or v_role <> 'judge' then
    return jsonb_build_object('ok', false, 'code', 'forbidden',
      'message', 'Only judges can record scores.');
  end if;

  if not coalesce(
       (select (value #>> '{}')::boolean from public.settings where key = 'judging_open'),
       false) then
    return jsonb_build_object('ok', false, 'code', 'closed',
      'message', 'Judging is not open.');
  end if;

  v_sub := (payload ->> 'submission_id')::uuid;

  if not exists (select 1 from public.submissions where id = v_sub) then
    return jsonb_build_object('ok', false, 'code', 'not_found',
      'message', 'That submission does not exist.');
  end if;

  for v_entry in select * from jsonb_array_elements(payload -> 'scores')
  loop
    v_crit  := (v_entry ->> 'criterion_id')::uuid;
    v_marks := (v_entry ->> 'marks_given')::numeric;

    select max_marks into v_max from public.marking_criteria
     where id = v_crit and is_active;

    if v_max is null then
      return jsonb_build_object('ok', false, 'code', 'invalid', 'field', 'criterion_id',
        'message', 'One of the criteria is no longer active.');
    end if;

    if v_marks is null or v_marks < 0 or v_marks > v_max then
      return jsonb_build_object('ok', false, 'code', 'invalid', 'field', 'marks_given',
        'message', format('Marks must be between 0 and %s.', v_max));
    end if;

    insert into public.scores (submission_id, judge_id, criterion_id, marks_given, remarks)
    values (v_sub, v_actor, v_crit, v_marks,
            nullif(trim(coalesce(v_entry ->> 'remarks', '')), ''))
    on conflict (submission_id, judge_id, criterion_id) do update set
      marks_given = excluded.marks_given,
      remarks     = excluded.remarks,
      scored_at   = now();

    v_written := v_written + 1;
  end loop;

  perform public.write_audit('scores.saved', 'submissions', v_sub::text,
    jsonb_build_object('criteria', v_written));

  return jsonb_build_object('ok', true, 'saved', v_written);
end;
$$;

revoke all on function public.save_scores(jsonb) from public;
grant execute on function public.save_scores(jsonb) to authenticated;

-- =====================================================================
-- Module 4 — results
-- =====================================================================

-- Aggregate marks per submission. A security_invoker view, so the scores
-- policies still apply: an admin sees every row, a judge only their own,
-- and a coordinator none at all.
create or replace view public.submission_scores
with (security_invoker = true)
as
  select
    s.id            as submission_id,
    s.team_id,
    s.idea_slot,
    t.team_id_short,
    t.team_name,
    count(distinct sc.judge_id)                    as judge_count,
    coalesce(sum(sc.marks_given), 0)               as total_marks,
    case when count(distinct sc.judge_id) > 0
         then round(coalesce(sum(sc.marks_given), 0)
                    / count(distinct sc.judge_id), 2)
         else null end                             as average_marks
    from public.submissions s
    join public.teams t on t.id = s.team_id
    left join public.scores sc on sc.submission_id = s.id
   group by s.id, s.team_id, s.idea_slot, t.team_id_short, t.team_name;

grant select on public.submission_scores to authenticated;

-- Set a verdict, and publish or unpublish it.
create or replace function public.set_result(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_team    uuid;
  v_slot    smallint;
  v_verdict public.final_verdict;
  v_publish boolean;
begin
  if not public.is_admin_tier() then
    return jsonb_build_object('ok', false, 'code', 'forbidden',
      'message', 'Only an administrator can publish results.');
  end if;

  v_team    := (payload ->> 'team_id')::uuid;
  v_slot    := coalesce((payload ->> 'idea_slot')::smallint, 1);
  v_verdict := nullif(payload ->> 'final_verdict', '')::public.final_verdict;
  v_publish := coalesce((payload ->> 'is_published')::boolean, false);

  insert into public.results (team_id, idea_slot, final_verdict, is_published, published_at)
  values (v_team, v_slot, v_verdict, v_publish,
          case when v_publish then now() else null end)
  on conflict (team_id, idea_slot) do update set
    final_verdict = excluded.final_verdict,
    is_published  = excluded.is_published,
    published_at  = excluded.published_at,
    updated_at    = now();

  -- Keep the team's own status in step, so rosters and exports agree.
  if v_verdict is not null then
    update public.teams
       set status = case v_verdict
                      when 'selected' then 'selected'::public.team_status
                      when 'rejected' then 'rejected'::public.team_status
                      else 'submitted'::public.team_status
                    end
     where id = v_team;
  end if;

  perform public.write_audit('result.set', 'results', v_team::text,
    jsonb_build_object('idea_slot', v_slot, 'verdict', v_verdict, 'published', v_publish));

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.set_result(jsonb) from public;
grant execute on function public.set_result(jsonb) to authenticated;

-- ------------------------------------------------- public results feed
-- Selected teams only, names only, never marks. Readable by anyone once
-- an admin flips results_published.
create or replace function public.public_results()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select case
    when not coalesce(
      (select (value #>> '{}')::boolean from public.settings where key = 'results_published'),
      false)
    then jsonb_build_object('published', false, 'teams', '[]'::jsonb)
    else jsonb_build_object(
      'published', true,
      'teams', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'team_id_short', t.team_id_short,
                 'team_name', t.team_name,
                 'ps_id', ps.ps_id,
                 'ps_title', ps.title
               ) order by t.team_id_short)
          from public.results r
          join public.teams t on t.id = r.team_id
          left join public.team_ps_selection sel
            on sel.team_id = t.id and sel.idea_slot = r.idea_slot
          left join public.problem_statements ps on ps.id = sel.ps_id
         where r.is_published and r.final_verdict = 'selected'
      ), '[]'::jsonb))
  end;
$$;

revoke all on function public.public_results() from public;
grant execute on function public.public_results() to anon, authenticated;

-- =====================================================================
-- Deliberately no Storage bucket.
--
-- Teams link their presentation and architecture diagram (Google Drive,
-- OneDrive, GitHub) rather than uploading. At ~120 teams a 25 MB upload
-- cap would need roughly 2 GB, against the 1 GB Supabase gives for free,
-- and the whole point of this deployment is that it costs nothing.
--
-- Links also survive the event: a Drive file stays reachable after the
-- project is archived, where a bucket on a paused free project does not.
--
-- If the institute later funds a paid plan and wants real uploads, add a
-- bucket and a policy scoping writes to `(storage.foldername(name))[1] =
-- team_id`, then swap the two URL fields in the submission form for file
-- inputs. Nothing else changes: submissions already stores plain URLs.
-- =====================================================================

-- ###################################################################
-- ## 0007_team_level_ps.sql
-- ###################################################################

-- =====================================================================
-- Move the tentative problem statement from the member to the team.
--
-- A team picks one problem statement together — asking the same question
-- in all six member cards produced six chances to disagree and no way to
-- resolve it. The team-level column is the single answer, and Module 2's
-- team_ps_selection still holds the final locked-in choice per idea slot.
-- =====================================================================

alter table public.teams
  add column if not exists tentative_ps_id uuid
    references public.problem_statements (id) on delete set null;

-- Carry across anything already captured per member: take the first
-- non-null choice on each team, so nothing entered so far is lost.
do $$
begin
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public'
       and table_name = 'members'
       and column_name = 'tentative_ps_id'
  ) then
    execute $mig$
      update public.teams t
         set tentative_ps_id = sub.ps_id
        from (
          select distinct on (team_id) team_id, tentative_ps_id as ps_id
            from public.members
           where tentative_ps_id is not null
           order by team_id, created_at
        ) sub
       where sub.team_id = t.id
         and t.tentative_ps_id is null
    $mig$;

    execute 'alter table public.members drop column tentative_ps_id';
  end if;
end $$;

-- ---------------------------------------------------------------------
-- register_team and update_team both wrote the per-member column, so
-- both are replaced here. Everything else about them is unchanged.
-- ---------------------------------------------------------------------
create or replace function public.register_team(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor          uuid := auth.uid();
  v_actor_email    text;
  v_role           public.app_role;
  v_registration_open boolean;
  v_team_name      text;
  v_members        jsonb;
  v_member         jsonb;
  v_mentor         jsonb;
  v_female_count   integer := 0;
  v_lead_count     integer := 0;
  v_team_id        uuid;
  v_short_id       text;
  v_enrollment     text;
  v_email          text;
  v_phone          text;
  v_existing       text;
  v_ps_uuid        uuid;
  v_ps_code        text;
  v_domain         text;
begin
  if v_actor is null then
    return jsonb_build_object('ok', false, 'code', 'unauthenticated',
      'message', 'You must be signed in to register a team.');
  end if;

  select role, email into v_role, v_actor_email
    from public.users where id = v_actor and is_active;

  if v_role is null then
    return jsonb_build_object('ok', false, 'code', 'unauthenticated',
      'message', 'Your account is inactive. Contact the SIH SPOC.');
  end if;

  if v_role <> 'team_lead' then
    return jsonb_build_object('ok', false, 'code', 'forbidden',
      'message', 'Only participant accounts can register a team.');
  end if;

  select coalesce((value #>> '{}')::boolean, false)
    into v_registration_open
    from public.settings where key = 'registration_open';

  if not coalesce(v_registration_open, false) then
    return jsonb_build_object('ok', false, 'code', 'registration_closed',
      'message', 'Registration is currently closed.');
  end if;

  if exists (select 1 from public.teams where created_by = v_actor) then
    return jsonb_build_object('ok', false, 'code', 'already_registered',
      'message', 'You have already registered a team. Edit it from your dashboard.');
  end if;

  v_domain := coalesce(
    (select value #>> '{}' from public.settings where key = 'allowed_email_domain'),
    'piemr.edu.in');

  v_team_name := trim(payload ->> 'team_name');
  v_members   := payload -> 'members';

  if v_team_name is null or length(v_team_name) < 3 then
    return jsonb_build_object('ok', false, 'code', 'invalid', 'field', 'team_name',
      'message', 'Team name must be at least 3 characters.');
  end if;

  if exists (select 1 from public.teams where lower(team_name) = lower(v_team_name)) then
    return jsonb_build_object('ok', false, 'code', 'duplicate', 'field', 'team_name',
      'message', 'That team name is already taken. Please pick another.');
  end if;

  if v_members is null or jsonb_typeof(v_members) <> 'array' then
    return jsonb_build_object('ok', false, 'code', 'invalid', 'field', 'members',
      'message', 'Member list is missing.');
  end if;

  if jsonb_array_length(v_members) <> 6 then
    return jsonb_build_object('ok', false, 'code', 'invalid', 'field', 'members',
      'message', format('A team must have exactly 6 members. You submitted %s.',
                        jsonb_array_length(v_members)));
  end if;

  -- One tentative problem statement for the whole team, optional at
  -- registration time because the list may not be published yet.
  v_ps_code := nullif(trim(coalesce(payload ->> 'tentative_ps_id', '')), '');
  if v_ps_code is not null and v_ps_code <> 'TBD' then
    select id into v_ps_uuid from public.problem_statements
     where ps_id = v_ps_code and is_active;

    if v_ps_uuid is null then
      return jsonb_build_object('ok', false, 'code', 'invalid', 'field', 'tentative_ps_id',
        'message', format('Problem statement %s is not on the active list.', v_ps_code));
    end if;
  end if;

  for v_member in select * from jsonb_array_elements(v_members)
  loop
    v_email      := lower(trim(v_member ->> 'email'));
    v_enrollment := upper(trim(v_member ->> 'enrollment_number'));
    v_phone      := regexp_replace(coalesce(v_member ->> 'phone', ''), '[^0-9]', '', 'g');

    if coalesce(trim(v_member ->> 'full_name'), '') = '' then
      return jsonb_build_object('ok', false, 'code', 'invalid', 'field', 'full_name',
        'message', 'Every member needs a full name.');
    end if;

    if v_email is null or v_email !~ ('^[^@[:space:]]+@' || replace(v_domain, '.', '\.') || '$') then
      return jsonb_build_object('ok', false, 'code', 'invalid', 'field', 'email',
        'message', format('%s is not a valid @%s address.',
                          coalesce(v_member ->> 'email', 'That address'), v_domain));
    end if;

    if length(v_phone) <> 10 then
      return jsonb_build_object('ok', false, 'code', 'invalid', 'field', 'phone',
        'message', 'Each phone number must be 10 digits.');
    end if;

    if v_enrollment = '' then
      return jsonb_build_object('ok', false, 'code', 'invalid', 'field', 'enrollment_number',
        'message', 'Every member needs an enrollment number.');
    end if;

    if coalesce(v_member ->> 'gender', '') = 'female' then
      v_female_count := v_female_count + 1;
    end if;

    if coalesce((v_member ->> 'is_lead')::boolean, false) then
      v_lead_count := v_lead_count + 1;
      if v_email <> lower(v_actor_email) then
        return jsonb_build_object('ok', false, 'code', 'invalid', 'field', 'is_lead',
          'message', 'The team lead entry must use the email you signed in with.');
      end if;
    end if;

    select 'x' into v_existing from public.members
     where upper(enrollment_number) = v_enrollment limit 1;
    if found then
      return jsonb_build_object('ok', false, 'code', 'duplicate', 'field', 'enrollment_number',
        'value', v_enrollment,
        'message', format('Enrollment number %s is already registered with another team.', v_enrollment));
    end if;

    select 'x' into v_existing from public.members
     where lower(email) = v_email limit 1;
    if found then
      return jsonb_build_object('ok', false, 'code', 'duplicate', 'field', 'email',
        'value', v_email,
        'message', format('%s is already registered with another team.', v_email));
    end if;

    select 'x' into v_existing from public.members
     where phone = v_phone limit 1;
    if found then
      return jsonb_build_object('ok', false, 'code', 'duplicate', 'field', 'phone',
        'value', v_phone,
        'message', format('Phone number %s is already registered with another team.', v_phone));
    end if;
  end loop;

  if (select count(distinct lower(m ->> 'email')) from jsonb_array_elements(v_members) m) <> 6 then
    return jsonb_build_object('ok', false, 'code', 'duplicate', 'field', 'email',
      'message', 'Two members share the same email address.');
  end if;

  if (select count(distinct upper(trim(m ->> 'enrollment_number')))
        from jsonb_array_elements(v_members) m) <> 6 then
    return jsonb_build_object('ok', false, 'code', 'duplicate', 'field', 'enrollment_number',
      'message', 'Two members share the same enrollment number.');
  end if;

  if (select count(distinct regexp_replace(m ->> 'phone', '[^0-9]', '', 'g'))
        from jsonb_array_elements(v_members) m) <> 6 then
    return jsonb_build_object('ok', false, 'code', 'duplicate', 'field', 'phone',
      'message', 'Two members share the same phone number.');
  end if;

  if v_lead_count <> 1 then
    return jsonb_build_object('ok', false, 'code', 'invalid', 'field', 'is_lead',
      'message', 'Exactly one member must be marked as the team lead.');
  end if;

  if v_female_count < 1 then
    return jsonb_build_object('ok', false, 'code', 'invalid', 'field', 'gender',
      'message', 'A team must include at least one female member.');
  end if;

  v_mentor := payload -> 'primary_mentor';
  if v_mentor is null or coalesce(trim(v_mentor ->> 'full_name'), '') = '' then
    return jsonb_build_object('ok', false, 'code', 'invalid', 'field', 'primary_mentor',
      'message', 'A primary mentor is required.');
  end if;

  if lower(coalesce(v_mentor ->> 'email', '')) !~ ('^[^@[:space:]]+@' || replace(v_domain, '.', '\.') || '$') then
    return jsonb_build_object('ok', false, 'code', 'invalid', 'field', 'primary_mentor_email',
      'message', format('The primary mentor must be PIEMR-affiliated (@%s address).', v_domain));
  end if;

  v_short_id := public.allocate_team_short_id();

  insert into public.teams (team_id_short, team_name, status, created_by, tentative_ps_id)
  values (v_short_id, v_team_name, 'submitted', v_actor, v_ps_uuid)
  returning id into v_team_id;

  for v_member in select * from jsonb_array_elements(v_members)
  loop
    insert into public.members (
      team_id, is_lead, full_name, gender, branch, year,
      enrollment_number, email, phone
    ) values (
      v_team_id,
      coalesce((v_member ->> 'is_lead')::boolean, false),
      trim(v_member ->> 'full_name'),
      v_member ->> 'gender',
      trim(v_member ->> 'branch'),
      trim(v_member ->> 'year'),
      upper(trim(v_member ->> 'enrollment_number')),
      lower(trim(v_member ->> 'email')),
      regexp_replace(v_member ->> 'phone', '[^0-9]', '', 'g')
    );
  end loop;

  insert into public.mentors (team_id, type, full_name, contact, email, affiliation, is_required)
  values (
    v_team_id, 'primary',
    trim(v_mentor ->> 'full_name'),
    trim(v_mentor ->> 'contact'),
    lower(trim(v_mentor ->> 'email')),
    'piemr', true
  );

  v_mentor := payload -> 'secondary_mentor';
  if v_mentor is not null and coalesce(trim(v_mentor ->> 'full_name'), '') <> '' then
    insert into public.mentors (team_id, type, full_name, contact, email, affiliation, is_required)
    values (
      v_team_id, 'secondary',
      trim(v_mentor ->> 'full_name'),
      trim(v_mentor ->> 'contact'),
      lower(trim(v_mentor ->> 'email')),
      coalesce(nullif(v_mentor ->> 'affiliation', ''), 'industry')::public.mentor_affiliation,
      false
    );
  end if;

  perform public.write_audit('team.registered', 'teams', v_team_id::text,
    jsonb_build_object('team_id_short', v_short_id, 'team_name', v_team_name));

  return jsonb_build_object(
    'ok', true,
    'team_id', v_team_id,
    'team_id_short', v_short_id
  );

exception
  when unique_violation then
    return jsonb_build_object(
      'ok', false,
      'code', 'duplicate',
      'field', case
        when sqlerrm like '%members_enrollment_unique%' then 'enrollment_number'
        when sqlerrm like '%members_email_unique%'      then 'email'
        when sqlerrm like '%members_phone_unique%'      then 'phone'
        when sqlerrm like '%teams_team_name_key%'       then 'team_name'
        else 'unknown'
      end,
      'message', 'Someone else just registered one of these details. Please re-check and try again.'
    );
end;
$$;

revoke all on function public.register_team(jsonb) from public;
grant execute on function public.register_team(jsonb) to authenticated;

-- ---------------------------------------------------------------------
create or replace function public.update_team(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor        uuid := auth.uid();
  v_team_id      uuid;
  v_short_id     text;
  v_team_name    text;
  v_members      jsonb;
  v_member       jsonb;
  v_mentor       jsonb;
  v_female_count integer := 0;
  v_lead_count   integer := 0;
  v_email        text;
  v_enrollment   text;
  v_phone        text;
  v_ps_uuid      uuid;
  v_ps_code      text;
  v_domain       text;
  v_conflict     text;
begin
  if v_actor is null then
    return jsonb_build_object('ok', false, 'code', 'unauthenticated',
      'message', 'You must be signed in.');
  end if;

  select id, team_id_short into v_team_id, v_short_id
    from public.teams where created_by = v_actor;

  if v_team_id is null then
    return jsonb_build_object('ok', false, 'code', 'not_found',
      'message', 'You have not registered a team yet.');
  end if;

  if not public.registration_editable(v_team_id) then
    return jsonb_build_object('ok', false, 'code', 'locked',
      'message', 'Registration is closed — your team details can no longer be edited.');
  end if;

  v_domain := coalesce(
    (select value #>> '{}' from public.settings where key = 'allowed_email_domain'),
    'piemr.edu.in');

  v_team_name := trim(payload ->> 'team_name');
  v_members   := payload -> 'members';

  if v_team_name is null or length(v_team_name) < 3 then
    return jsonb_build_object('ok', false, 'code', 'invalid', 'field', 'team_name',
      'message', 'Team name must be at least 3 characters.');
  end if;

  if exists (select 1 from public.teams
              where lower(team_name) = lower(v_team_name) and id <> v_team_id) then
    return jsonb_build_object('ok', false, 'code', 'duplicate', 'field', 'team_name',
      'message', 'That team name is already taken.');
  end if;

  if v_members is null or jsonb_array_length(v_members) <> 6 then
    return jsonb_build_object('ok', false, 'code', 'invalid', 'field', 'members',
      'message', 'A team must have exactly 6 members.');
  end if;

  v_ps_code := nullif(trim(coalesce(payload ->> 'tentative_ps_id', '')), '');
  if v_ps_code is not null and v_ps_code <> 'TBD' then
    select id into v_ps_uuid from public.problem_statements
     where ps_id = v_ps_code and is_active;

    if v_ps_uuid is null then
      return jsonb_build_object('ok', false, 'code', 'invalid', 'field', 'tentative_ps_id',
        'message', format('Problem statement %s is not on the active list.', v_ps_code));
    end if;
  end if;

  for v_member in select * from jsonb_array_elements(v_members)
  loop
    v_email      := lower(trim(v_member ->> 'email'));
    v_enrollment := upper(trim(v_member ->> 'enrollment_number'));
    v_phone      := regexp_replace(coalesce(v_member ->> 'phone', ''), '[^0-9]', '', 'g');

    if v_email !~ ('^[^@[:space:]]+@' || replace(v_domain, '.', '\.') || '$') then
      return jsonb_build_object('ok', false, 'code', 'invalid', 'field', 'email',
        'message', format('%s is not a valid @%s address.', v_email, v_domain));
    end if;

    if length(v_phone) <> 10 then
      return jsonb_build_object('ok', false, 'code', 'invalid', 'field', 'phone',
        'message', 'Each phone number must be 10 digits.');
    end if;

    if coalesce(v_member ->> 'gender', '') = 'female' then
      v_female_count := v_female_count + 1;
    end if;
    if coalesce((v_member ->> 'is_lead')::boolean, false) then
      v_lead_count := v_lead_count + 1;
    end if;

    select 'enrollment_number' into v_conflict from public.members
     where upper(enrollment_number) = v_enrollment and team_id <> v_team_id limit 1;
    if found then
      return jsonb_build_object('ok', false, 'code', 'duplicate', 'field', 'enrollment_number',
        'message', format('Enrollment number %s is already registered with another team.', v_enrollment));
    end if;

    select 'email' into v_conflict from public.members
     where lower(email) = v_email and team_id <> v_team_id limit 1;
    if found then
      return jsonb_build_object('ok', false, 'code', 'duplicate', 'field', 'email',
        'message', format('%s is already registered with another team.', v_email));
    end if;

    select 'phone' into v_conflict from public.members
     where phone = v_phone and team_id <> v_team_id limit 1;
    if found then
      return jsonb_build_object('ok', false, 'code', 'duplicate', 'field', 'phone',
        'message', format('Phone number %s is already registered with another team.', v_phone));
    end if;
  end loop;

  if v_lead_count <> 1 then
    return jsonb_build_object('ok', false, 'code', 'invalid', 'field', 'is_lead',
      'message', 'Exactly one member must be marked as the team lead.');
  end if;

  if v_female_count < 1 then
    return jsonb_build_object('ok', false, 'code', 'invalid', 'field', 'gender',
      'message', 'A team must include at least one female member.');
  end if;

  v_mentor := payload -> 'primary_mentor';
  if v_mentor is null or coalesce(trim(v_mentor ->> 'full_name'), '') = '' then
    return jsonb_build_object('ok', false, 'code', 'invalid', 'field', 'primary_mentor',
      'message', 'A primary mentor is required.');
  end if;

  if lower(coalesce(v_mentor ->> 'email', '')) !~ ('^[^@[:space:]]+@' || replace(v_domain, '.', '\.') || '$') then
    return jsonb_build_object('ok', false, 'code', 'invalid', 'field', 'primary_mentor_email',
      'message', format('The primary mentor must be PIEMR-affiliated (@%s address).', v_domain));
  end if;

  update public.teams
     set team_name = v_team_name,
         tentative_ps_id = v_ps_uuid
   where id = v_team_id;

  delete from public.members where team_id = v_team_id;

  for v_member in select * from jsonb_array_elements(v_members)
  loop
    insert into public.members (
      team_id, is_lead, full_name, gender, branch, year,
      enrollment_number, email, phone
    ) values (
      v_team_id,
      coalesce((v_member ->> 'is_lead')::boolean, false),
      trim(v_member ->> 'full_name'),
      v_member ->> 'gender',
      trim(v_member ->> 'branch'),
      trim(v_member ->> 'year'),
      upper(trim(v_member ->> 'enrollment_number')),
      lower(trim(v_member ->> 'email')),
      regexp_replace(v_member ->> 'phone', '[^0-9]', '', 'g')
    );
  end loop;

  delete from public.mentors where team_id = v_team_id;

  insert into public.mentors (team_id, type, full_name, contact, email, affiliation, is_required)
  values (v_team_id, 'primary', trim(v_mentor ->> 'full_name'), trim(v_mentor ->> 'contact'),
          lower(trim(v_mentor ->> 'email')), 'piemr', true);

  v_mentor := payload -> 'secondary_mentor';
  if v_mentor is not null and coalesce(trim(v_mentor ->> 'full_name'), '') <> '' then
    insert into public.mentors (team_id, type, full_name, contact, email, affiliation, is_required)
    values (v_team_id, 'secondary', trim(v_mentor ->> 'full_name'), trim(v_mentor ->> 'contact'),
            lower(trim(v_mentor ->> 'email')),
            coalesce(nullif(v_mentor ->> 'affiliation', ''), 'industry')::public.mentor_affiliation,
            false);
  end if;

  perform public.write_audit('team.updated', 'teams', v_team_id::text,
    jsonb_build_object('team_id_short', v_short_id));

  return jsonb_build_object('ok', true, 'team_id', v_team_id, 'team_id_short', v_short_id);

exception
  when unique_violation then
    return jsonb_build_object('ok', false, 'code', 'duplicate', 'field',
      case
        when sqlerrm like '%members_enrollment_unique%' then 'enrollment_number'
        when sqlerrm like '%members_email_unique%'      then 'email'
        when sqlerrm like '%members_phone_unique%'      then 'phone'
        else 'unknown'
      end,
      'message', 'Someone else just registered one of these details. Please re-check and try again.');
end;
$$;

revoke all on function public.update_team(jsonb) from public;
grant execute on function public.update_team(jsonb) to authenticated;
