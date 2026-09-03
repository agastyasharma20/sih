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
