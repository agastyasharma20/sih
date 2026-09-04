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
-- Storage for PPTs and architecture diagrams.
--
-- Guarded so this migration also applies to a plain Postgres instance
-- (the test harness), where the storage schema does not exist.
-- =====================================================================
do $$
begin
  if exists (select 1 from information_schema.schemata where schema_name = 'storage') then

    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values (
      'submissions', 'submissions', false,
      26214400,  -- 25 MB
      array[
        'application/pdf',
        'application/vnd.ms-powerpoint',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'image/png', 'image/jpeg', 'image/webp'
      ]
    )
    on conflict (id) do update set
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

    -- Files live under <team_id>/..., so a team lead can only reach their
    -- own folder. Staff get read access for judging and verification.
    execute $p$
      create policy submissions_team_rw on storage.objects
        for all to authenticated
        using (
          bucket_id = 'submissions'
          and public.owns_team((storage.foldername(name))[1]::uuid)
        )
        with check (
          bucket_id = 'submissions'
          and public.owns_team((storage.foldername(name))[1]::uuid)
        )
    $p$;

    execute $p$
      create policy submissions_staff_read on storage.objects
        for select to authenticated
        using (bucket_id = 'submissions' and public.is_roster_viewer())
    $p$;

  end if;
end $$;
