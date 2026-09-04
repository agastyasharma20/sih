\set ON_ERROR_STOP on
\pset pager off

-- Who may call what over the REST API. Supabase grants EXECUTE on new
-- public functions to anon and authenticated by default, so these have
-- to be revoked deliberately and asserted here.

\echo '=== anon must NOT be able to burn Team IDs or forge audit entries'
select
  has_function_privilege('anon', 'public.allocate_team_short_id()', 'EXECUTE') as anon_allocate_id,
  has_function_privilege('anon', 'public.write_audit(text,text,text,jsonb)', 'EXECUTE') as anon_write_audit,
  has_function_privilege('authenticated', 'public.allocate_team_short_id()', 'EXECUTE') as auth_allocate_id,
  has_function_privilege('authenticated', 'public.write_audit(text,text,text,jsonb)', 'EXECUTE') as auth_write_audit;

\echo ''
\echo '=== trigger functions are not callable by anyone over the API'
select
  has_function_privilege('anon', 'public.touch_updated_at()', 'EXECUTE') as anon_touch,
  has_function_privilege('authenticated', 'public.enforce_team_size()', 'EXECUTE') as auth_enforce,
  has_function_privilege('anon', 'public.handle_new_auth_user()', 'EXECUTE') as anon_new_user;

\echo ''
\echo '=== trigger functions have a pinned search_path'
select proname, coalesce(array_to_string(proconfig, ','), 'MUTABLE — fix this') as config
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public'
   and proname in ('touch_updated_at', 'enforce_team_size')
 order by proname;

\echo ''
\echo '=== the mutating RPCs are authenticated-only'
select
  has_function_privilege('anon', 'public.register_team(jsonb)', 'EXECUTE') as anon_register,
  has_function_privilege('authenticated', 'public.register_team(jsonb)', 'EXECUTE') as auth_register,
  has_function_privilege('anon', 'public.save_scores(jsonb)', 'EXECUTE') as anon_score,
  has_function_privilege('anon', 'public.set_result(jsonb)', 'EXECUTE') as anon_set_result;

\echo ''
\echo '=== the two deliberately public feeds are still reachable by anon'
select
  has_function_privilege('anon', 'public.public_stats()', 'EXECUTE') as anon_stats,
  has_function_privilege('anon', 'public.public_results()', 'EXECUTE') as anon_results;

\echo ''
\echo '=== and anon can still evaluate the policies it is subject to'
set role anon;
select set_config('request.jwt.claim.sub', '', false);
select count(*) as anon_can_read_active_ps from public.problem_statements;
select public.public_stats() ->> 'teams' as anon_sees_team_count;
reset role;

\echo ''
\echo '=== a signed-in team lead can still register and edit'
set role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
select count(*) as lead_sees_own_team from public.teams;
reset role;
