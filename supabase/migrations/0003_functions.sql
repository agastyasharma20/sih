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
