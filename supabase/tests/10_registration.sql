\set ON_ERROR_STOP on
\pset pager off

-- Helper: run as a given authenticated user.
create or replace function test_as(p_user uuid) returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', coalesce(p_user::text, ''), false);
end; $$;

-- ---------------------------------------------------------------- users
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'lead.one@piemr.edu.in'),
  ('22222222-2222-2222-2222-222222222222', 'lead.two@piemr.edu.in'),
  ('33333333-3333-3333-3333-333333333333', 'coord@piemr.edu.in'),
  ('44444444-4444-4444-4444-444444444444', 'judge@piemr.edu.in');

update public.users set role = 'coordinator' where id = '33333333-3333-3333-3333-333333333333';
update public.users set role = 'judge'       where id = '44444444-4444-4444-4444-444444444444';

\echo '--- profiles auto-created by the auth trigger (all default to team_lead):'
select email, role from public.users order by email;

-- Reusable member list builder.
create or replace function test_members(
  prefix text, female_count int default 1, member_count int default 6,
  lead_email text default null
) returns jsonb
language sql as $$
  select jsonb_agg(jsonb_build_object(
    'is_lead', i = 1,
    'full_name', prefix || ' Member ' || i,
    'gender', case when i <= female_count then 'female' else 'male' end,
    'branch', 'Computer Science & Engineering',
    'year', '3rd Year',
    'enrollment_number', upper(prefix) || 'ENR' || i,
    'email', case when i = 1 and lead_email is not null
                  then lead_email else prefix || i || '@piemr.edu.in' end,
    'phone', '90000' || lpad((abs(hashtext(prefix)) % 90000 + i)::text, 5, '0'),
    'tentative_ps_id', 'TBD'
  )) from generate_series(1, member_count) i;
$$;

create or replace function test_payload(
  team text, prefix text, female_count int default 1, member_count int default 6,
  lead_email text default null
) returns jsonb
language sql as $$
  select jsonb_build_object(
    'team_name', team,
    'members', test_members(prefix, female_count, member_count, lead_email),
    'primary_mentor', jsonb_build_object(
      'full_name', 'Dr. Mentor', 'contact', '9876543210',
      'email', 'mentor@piemr.edu.in', 'affiliation', 'piemr')
  );
$$;

\echo ''
\echo '=== 1. Registration closed by default -> rejected'
select test_as('11111111-1111-1111-1111-111111111111');
select register_team(test_payload('Alpha', 'alpha', 1, 6, 'lead.one@piemr.edu.in')) ->> 'code' as code;

update public.settings set value = 'true'::jsonb where key = 'registration_open';

\echo ''
\echo '=== 2. Fewer than six members -> rejected'
select register_team(test_payload('Alpha', 'alpha', 1, 5, 'lead.one@piemr.edu.in')) ->> 'message' as message;

\echo ''
\echo '=== 3. Seven members -> rejected'
select register_team(test_payload('Alpha', 'alpha', 1, 7, 'lead.one@piemr.edu.in')) ->> 'message' as message;

\echo ''
\echo '=== 4. No female member -> rejected'
select register_team(test_payload('Alpha', 'alpha', 0, 6, 'lead.one@piemr.edu.in')) ->> 'message' as message;

\echo ''
\echo '=== 5. Non-institutional email -> rejected'
select register_team(
  jsonb_set(test_payload('Alpha', 'alpha', 1, 6, 'lead.one@piemr.edu.in'),
            '{members,3,email}', '"outsider@gmail.com"')) ->> 'message' as message;

\echo ''
\echo '=== 6. Primary mentor from outside PIEMR -> rejected'
select register_team(
  jsonb_set(test_payload('Alpha', 'alpha', 1, 6, 'lead.one@piemr.edu.in'),
            '{primary_mentor,email}', '"mentor@infosys.com"')) ->> 'message' as message;

\echo ''
\echo '=== 7. Valid team -> accepted, gets Team ID 001'
select register_team(test_payload('Alpha', 'alpha', 2, 6, 'lead.one@piemr.edu.in')) as result;

\echo ''
\echo '=== 8. Same lead registering again -> rejected'
select register_team(test_payload('Alpha Two', 'alpha2', 1, 6, 'lead.one@piemr.edu.in')) ->> 'code' as code;

\echo ''
\echo '=== 9. Second team reusing an enrollment number from team 001 -> rejected'
select test_as('22222222-2222-2222-2222-222222222222');
select register_team(
  jsonb_set(test_payload('Beta', 'beta', 1, 6, 'lead.two@piemr.edu.in'),
            '{members,2,enrollment_number}', '"ALPHAENR3"')) as result;

\echo ''
\echo '=== 10. Second team reusing a phone number from team 001 -> rejected'
select register_team(
  jsonb_set(test_payload('Beta', 'beta', 1, 6, 'lead.two@piemr.edu.in'),
            '{members,2,phone}',
            to_jsonb((select phone from public.members
                       where enrollment_number = 'ALPHAENR4')))) ->> 'field' as field;

\echo ''
\echo '=== 11. Second team reusing an email from team 001 -> rejected'
select register_team(
  jsonb_set(test_payload('Beta', 'beta', 1, 6, 'lead.two@piemr.edu.in'),
            '{members,2,email}', '"alpha5@piemr.edu.in"')) ->> 'field' as field;

\echo ''
\echo '=== 12. Duplicate team name -> rejected'
select register_team(test_payload('Alpha', 'beta', 1, 6, 'lead.two@piemr.edu.in')) ->> 'field' as field;

\echo ''
\echo '=== 13. Clean second team -> accepted, gets Team ID 002'
select register_team(test_payload('Beta', 'beta', 1, 6, 'lead.two@piemr.edu.in')) as result;

\echo ''
\echo '--- teams and their sizes:'
select t.team_id_short, t.team_name,
       count(*) filter (where m.id is not null) as members,
       count(*) filter (where m.gender = 'female') as female
  from public.teams t left join public.members m on m.team_id = t.id
 group by 1,2 order by 1;
