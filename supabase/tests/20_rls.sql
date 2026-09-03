\set ON_ERROR_STOP on
\pset pager off

-- Give the two judges something to score so the coordinator has marks to
-- (fail to) read.
insert into public.submissions (team_id, idea_slot, submitted_at)
select id, 1, now() from public.teams;

insert into public.scores (submission_id, judge_id, criterion_id, marks_given, remarks)
select s.id, '44444444-4444-4444-4444-444444444444', c.id, 15, 'solid'
  from public.submissions s cross join public.marking_criteria c;

-- Add an admin and a super-admin.
insert into auth.users (id, email) values
  ('55555555-5555-5555-5555-555555555555', 'spoc@piemr.edu.in'),
  ('66666666-6666-6666-6666-666666666666', 'root@piemr.edu.in');
update public.users set role='admin', admin_subtype='spoc'
  where id='55555555-5555-5555-5555-555555555555';
update public.users set role='super_admin'
  where id='66666666-6666-6666-6666-666666666666';

\echo '=== Rows that exist in total (as owner, RLS bypassed):'
select (select count(*) from public.scores)  as scores,
       (select count(*) from public.teams)   as teams,
       (select count(*) from public.members) as members,
       (select count(*) from public.users)   as users;

\echo ''
\echo '=== COORDINATOR — may see the roster, must NOT see any marks'
set role authenticated;
select set_config('request.jwt.claim.sub', '33333333-3333-3333-3333-333333333333', false);
select (select count(*) from public.scores)  as scores_visible,
       (select count(*) from public.teams)   as teams_visible,
       (select count(*) from public.members) as members_visible;
reset role;

\echo ''
\echo '=== TEAM LEAD (team 001) — own team only, no marks'
set role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
select (select count(*) from public.scores)  as scores_visible,
       (select count(*) from public.teams)   as teams_visible,
       (select count(*) from public.members) as members_visible;
reset role;

\echo ''
\echo '=== JUDGE — only their own scores'
set role authenticated;
select set_config('request.jwt.claim.sub', '44444444-4444-4444-4444-444444444444', false);
select (select count(*) from public.scores) as scores_visible;
reset role;

\echo ''
\echo '=== ADMIN (SPOC) — full marks access, but super-admin rows are hidden'
set role authenticated;
select set_config('request.jwt.claim.sub', '55555555-5555-5555-5555-555555555555', false);
select (select count(*) from public.scores) as scores_visible,
       (select count(*) from public.users)  as users_visible,
       (select count(*) from public.users where role = 'super_admin') as super_admins_visible;
reset role;

\echo ''
\echo '=== SUPER-ADMIN — sees everything including its own tier'
set role authenticated;
select set_config('request.jwt.claim.sub', '66666666-6666-6666-6666-666666666666', false);
select (select count(*) from public.scores) as scores_visible,
       (select count(*) from public.users)  as users_visible,
       (select count(*) from public.audit_log) as audit_visible;
reset role;

\echo ''
\echo '=== ANON — public settings and PS list only; teams/members closed'
set role anon;
select set_config('request.jwt.claim.sub', '', false);
select (select count(*) from public.settings)           as settings_visible,
       (select count(*) from public.problem_statements) as ps_visible;
\echo '--- anon reading teams directly (must be refused):'
do $$
begin
  perform count(*) from public.teams;
  raise notice 'UNEXPECTED: anon read the teams table';
exception when others then
  raise notice 'BLOCKED as expected: %', sqlerrm;
end $$;

\echo '--- anon reading the aggregate counter function instead:'
select public.public_stats() as stats;
reset role;

\echo ''
\echo '=== COORDINATOR attempting to write a score directly'
set role authenticated;
select set_config('request.jwt.claim.sub', '33333333-3333-3333-3333-333333333333', false);
do $$
begin
  insert into public.scores (submission_id, judge_id, criterion_id, marks_given)
  select s.id, '33333333-3333-3333-3333-333333333333', c.id, 20
    from public.submissions s cross join public.marking_criteria c limit 1;
  raise notice 'UNEXPECTED: coordinator wrote a score';
exception when others then
  raise notice 'BLOCKED as expected: %', sqlerrm;
end $$;
reset role;

\echo ''
\echo '=== TEAM LEAD editing their own team while registration is open'
set role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
select public.update_team(jsonb_build_object(
  'team_name', 'Alpha Renamed',
  'members', test_members('alpha', 2, 6, 'lead.one@piemr.edu.in'),
  'primary_mentor', jsonb_build_object('full_name','Dr. Mentor','contact','9876543210',
                                       'email','mentor@piemr.edu.in','affiliation','piemr')
)) ->> 'ok' as ok;
reset role;

\echo ''
\echo '=== Once an admin closes registration, that same edit is refused'
update public.settings set value='false'::jsonb where key='registration_open';
set role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
select public.update_team(jsonb_build_object(
  'team_name', 'Alpha Renamed Again',
  'members', test_members('alpha', 2, 6, 'lead.one@piemr.edu.in'),
  'primary_mentor', jsonb_build_object('full_name','Dr. Mentor','contact','9876543210',
                                       'email','mentor@piemr.edu.in','affiliation','piemr')
)) ->> 'message' as message;
reset role;
