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
-- Guarded on the column still existing: migration 0007 moves the
-- tentative problem statement up to the team and drops this column, so on
-- a re-run of the full setup there is nothing here to attach a key to.
do $$ begin
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public'
       and table_name = 'members'
       and column_name = 'tentative_ps_id'
  ) then
    alter table public.members
      add constraint members_tentative_ps_fkey
      foreign key (tentative_ps_id)
      references public.problem_statements (id) on delete set null;
  end if;
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
