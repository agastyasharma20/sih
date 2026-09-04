\set ON_ERROR_STOP on
\pset pager off

-- Modules 2-4: a team submits an idea, a judge scores it, an admin
-- publishes the verdict. Runs on the state left by the earlier files.

\echo '=== Submissions are closed by default -> refused'
set role authenticated;
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', false);
select public.submit_idea(jsonb_build_object('idea_slot', 1, 'ps_id', 'SIH1234')) ->> 'code' as code;
reset role;

update public.settings set value = 'true'::jsonb where key = 'submissions_open';

\echo ''
\echo '=== Unknown problem statement -> refused'
set role authenticated;
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', false);
select public.submit_idea(jsonb_build_object('idea_slot', 1, 'ps_id', 'NOPE')) ->> 'message' as message;

\echo ''
\echo '=== Finalising without a problem statement -> refused'
select public.submit_idea(jsonb_build_object('idea_slot', 1, 'final', true)) ->> 'message' as message;

\echo ''
\echo '=== Draft save without a PS is allowed'
select public.submit_idea(jsonb_build_object(
  'idea_slot', 1, 'github_url', 'https://github.com/team/repo')) ->> 'ok' as ok;

\echo ''
\echo '=== Finalising slot 1 with a valid PS'
select public.submit_idea(jsonb_build_object(
  'idea_slot', 1, 'ps_id', 'SIH1234', 'final', true,
  'github_url', 'https://github.com/team/repo',
  'video_url', 'https://youtu.be/demo')) ->> 'ok' as ok;

\echo ''
\echo '=== Reusing the same PS for slot 2 -> refused'
select public.submit_idea(jsonb_build_object(
  'idea_slot', 2, 'ps_id', 'SIH1234', 'final', true)) ->> 'message' as message;

\echo ''
\echo '=== Slot 3 is beyond max_ideas_per_team -> refused'
select public.submit_idea(jsonb_build_object('idea_slot', 3, 'ps_id', 'SIH1234')) ->> 'message' as message;

\echo ''
\echo '=== A later draft save cannot clear the finalised timestamp'
select public.submit_idea(jsonb_build_object(
  'idea_slot', 1, 'ps_id', 'SIH1234', 'github_url', 'https://github.com/team/repo2')) ->> 'ok' as ok;
select (submitted_at is not null) as still_final
  from public.submissions s join public.teams t on t.id = s.team_id
 where t.team_id_short = '002' and s.idea_slot = 1;
reset role;

\echo ''
\echo '=== Judge looks up team 002 by its 3-digit ID'
set role authenticated;
select set_config('request.jwt.claim.sub', '44444444-4444-4444-4444-444444444444', false);
select jsonb_pretty(public.judge_lookup_team('2')) as lookup;

\echo ''
\echo '=== Judging is closed -> scores refused'
select public.save_scores(jsonb_build_object(
  'submission_id', (select s.id from public.submissions s
                      join public.teams t on t.id = s.team_id
                     where t.team_id_short='002' and s.idea_slot=1),
  'scores', jsonb_build_array(jsonb_build_object(
    'criterion_id', (select id from public.marking_criteria order by display_order limit 1),
    'marks_given', 15)))) ->> 'code' as code;
reset role;

update public.settings set value = 'true'::jsonb where key = 'judging_open';

\echo ''
\echo '=== Marks above a criterion maximum -> refused'
set role authenticated;
select set_config('request.jwt.claim.sub', '44444444-4444-4444-4444-444444444444', false);
select public.save_scores(jsonb_build_object(
  'submission_id', (select s.id from public.submissions s
                      join public.teams t on t.id = s.team_id
                     where t.team_id_short='002' and s.idea_slot=1),
  'scores', jsonb_build_array(jsonb_build_object(
    'criterion_id', (select id from public.marking_criteria order by display_order limit 1),
    'marks_given', 50)))) ->> 'message' as message;

\echo ''
\echo '=== Valid scores across every criterion'
select public.save_scores(jsonb_build_object(
  'submission_id', (select s.id from public.submissions s
                      join public.teams t on t.id = s.team_id
                     where t.team_id_short='002' and s.idea_slot=1),
  'scores', (select jsonb_agg(jsonb_build_object(
               'criterion_id', id, 'marks_given', 16, 'remarks', 'Clear articulation'))
               from public.marking_criteria where is_active)
)) as result;
reset role;

\echo ''
\echo '=== A COORDINATOR still sees no scores after all that'
set role authenticated;
select set_config('request.jwt.claim.sub', '33333333-3333-3333-3333-333333333333', false);
select count(*) as coordinator_sees_scores from public.scores;
select count(*) as coordinator_sees_score_rows from public.submission_scores
 where average_marks is not null;
reset role;

\echo ''
\echo '=== ADMIN sees the aggregate'
set role authenticated;
select set_config('request.jwt.claim.sub', '55555555-5555-5555-5555-555555555555', false);
select team_id_short, idea_slot, judge_count, total_marks, average_marks
  from public.submission_scores where total_marks > 0 order by team_id_short;

\echo ''
\echo '--- admin publishes a verdict'
select public.set_result(jsonb_build_object(
  'team_id', (select id from public.teams where team_id_short='002'),
  'idea_slot', 1, 'final_verdict', 'selected', 'is_published', true)) ->> 'ok' as ok;
reset role;

\echo ''
\echo '=== Team lead sees their own published verdict'
set role authenticated;
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', false);
select final_verdict, is_published from public.results;
reset role;

\echo ''
\echo '=== The OTHER team lead sees nothing of it'
set role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
select count(*) as other_lead_sees from public.results;
reset role;

\echo ''
\echo '=== Public results feed stays closed until results_published'
set role anon;
select set_config('request.jwt.claim.sub', '', false);
select public.public_results() ->> 'published' as published_before;
reset role;

update public.settings set value = 'true'::jsonb where key = 'results_published';

set role anon;
select set_config('request.jwt.claim.sub', '', false);
select jsonb_pretty(public.public_results()) as public_feed;
reset role;
