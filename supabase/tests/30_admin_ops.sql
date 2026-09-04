\set ON_ERROR_STOP on
\pset pager off

-- Exercises the surfaces the admin screens rely on: who may manage problem
-- statements, who may lock teams, and who may read the audit trail.

\echo '=== SPOC imports problem statements'
set role authenticated;
select set_config('request.jwt.claim.sub', '55555555-5555-5555-5555-555555555555', false);
insert into public.problem_statements (ps_id, title, category, theme)
values ('SIH1234', 'Smart water quality monitoring', 'software', 'Clean Water'),
       ('SIH1601', 'Assistive device', 'hardware', 'MedTech');
select count(*) as ps_after_import from public.problem_statements;
reset role;

\echo ''
\echo '=== COORDINATOR attempting to add a problem statement (must be refused)'
set role authenticated;
select set_config('request.jwt.claim.sub', '33333333-3333-3333-3333-333333333333', false);
do $$
begin
  insert into public.problem_statements (ps_id, title, category)
  values ('SIH9999', 'Not allowed', 'software');
  raise notice 'UNEXPECTED: coordinator wrote a problem statement';
exception when others then
  raise notice 'BLOCKED as expected: %', sqlerrm;
end $$;
reset role;

\echo ''
\echo '=== TEAM LEAD attempting to add a problem statement (must be refused)'
set role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
do $$
begin
  insert into public.problem_statements (ps_id, title, category)
  values ('SIH8888', 'Not allowed', 'software');
  raise notice 'UNEXPECTED: team lead wrote a problem statement';
exception when others then
  raise notice 'BLOCKED as expected: %', sqlerrm;
end $$;
reset role;

\echo ''
\echo '=== ANON can read the active list, but not retired entries'
set role authenticated;
select set_config('request.jwt.claim.sub', '55555555-5555-5555-5555-555555555555', false);
update public.problem_statements set is_active = false where ps_id = 'SIH1601';
reset role;

set role anon;
select set_config('request.jwt.claim.sub', '', false);
select count(*) as visible_to_anon from public.problem_statements;
reset role;

\echo ''
\echo '=== SPOC locks a team; the lead can then no longer edit'
set role authenticated;
select set_config('request.jwt.claim.sub', '55555555-5555-5555-5555-555555555555', false);
update public.settings set value = 'true'::jsonb where key = 'registration_open';
update public.teams set registration_locked_at = now() where team_id_short = '001';
reset role;

set role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
select public.update_team(jsonb_build_object(
  'team_name', 'Locked Out',
  'members', test_members('alpha', 2, 6, 'lead.one@piemr.edu.in'),
  'primary_mentor', jsonb_build_object('full_name','Dr. Mentor','contact','9876543210',
                                       'email','mentor@piemr.edu.in','affiliation','piemr')
)) ->> 'code' as code;
reset role;

\echo ''
\echo '=== Team 002 is still unlocked, so its lead can still edit'
set role authenticated;
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', false);
select public.update_team(jsonb_build_object(
  'team_name', 'Beta Renamed',
  'members', test_members('beta', 1, 6, 'lead.two@piemr.edu.in'),
  'primary_mentor', jsonb_build_object('full_name','Dr. Mentor','contact','9876543210',
                                       'email','mentor@piemr.edu.in','affiliation','piemr')
)) ->> 'ok' as ok;
reset role;

\echo ''
\echo '=== Audit trail: admin sees only their own actions, super-admin sees all'
set role authenticated;
select set_config('request.jwt.claim.sub', '55555555-5555-5555-5555-555555555555', false);
select count(*) as admin_sees from public.audit_log;
reset role;

set role authenticated;
select set_config('request.jwt.claim.sub', '66666666-6666-6666-6666-666666666666', false);
select count(*) as super_admin_sees from public.audit_log;
reset role;
