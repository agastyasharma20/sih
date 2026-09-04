\set ON_ERROR_STOP on
\pset pager off

-- The tentative problem statement moved from the member to the team.
-- Runs after 30_admin_ops.sql, which creates SIH1234 (active) and
-- SIH1601 (retired).

\echo '=== members no longer carries a per-member PS column'
select count(*) as member_ps_columns
  from information_schema.columns
 where table_schema = 'public' and table_name = 'members'
   and column_name = 'tentative_ps_id';

\echo ''
\echo '=== teams does carry one'
select count(*) as team_ps_columns
  from information_schema.columns
 where table_schema = 'public' and table_name = 'teams'
   and column_name = 'tentative_ps_id';

-- A fresh lead so we can register a new team.
insert into auth.users (id, email)
values ('77777777-7777-7777-7777-777777777777', 'lead.three@piemr.edu.in');

update public.settings set value = 'true'::jsonb where key = 'registration_open';
update public.teams set registration_locked_at = null;

\echo ''
\echo '=== an unknown PS code is rejected'
set role authenticated;
select set_config('request.jwt.claim.sub', '77777777-7777-7777-7777-777777777777', false);
select public.register_team(
  test_payload('Gamma', 'gamma', 1, 6, 'lead.three@piemr.edu.in')
  || jsonb_build_object('tentative_ps_id', 'NOT-A-REAL-PS')) ->> 'message' as message;

\echo ''
\echo '=== a retired PS is rejected too'
select public.register_team(
  test_payload('Gamma', 'gamma', 1, 6, 'lead.three@piemr.edu.in')
  || jsonb_build_object('tentative_ps_id', 'SIH1601')) ->> 'field' as field;

\echo ''
\echo '=== TBD is accepted, for teams that have not decided'
select public.register_team(
  test_payload('Gamma', 'gamma', 1, 6, 'lead.three@piemr.edu.in')
  || jsonb_build_object('tentative_ps_id', 'TBD')) ->> 'ok' as ok;

select t.team_id_short, (t.tentative_ps_id is null) as ps_is_null
  from public.teams t where t.team_name = 'Gamma';
reset role;

\echo ''
\echo '=== the lead can then choose a real PS for the whole team'
set role authenticated;
select set_config('request.jwt.claim.sub', '77777777-7777-7777-7777-777777777777', false);
select public.update_team(jsonb_build_object(
  'team_name', 'Gamma',
  'tentative_ps_id', 'SIH1234',
  'members', test_members('gamma', 1, 6, 'lead.three@piemr.edu.in'),
  'primary_mentor', jsonb_build_object('full_name','Dr. Mentor','contact','9876543210',
                                       'email','mentor@piemr.edu.in','affiliation','piemr')
)) ->> 'ok' as ok;
reset role;

select t.team_name, ps.ps_id as chosen_ps
  from public.teams t
  left join public.problem_statements ps on ps.id = t.tentative_ps_id
 where t.team_name = 'Gamma';

\echo ''
\echo '=== one choice per team, not six — exactly one row records it'
select count(*) as ps_choices_for_gamma
  from public.teams where team_name = 'Gamma' and tentative_ps_id is not null;
