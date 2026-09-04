-- =====================================================================
-- Promote an account to Super-Admin
--
-- The easiest way to create your first admin account, and the way to
-- recover if you ever lose access to it.
--
-- STEP 1 — create the login in the Supabase dashboard:
--
--   Authentication → Users → "Add user" → "Create new user"
--     Email              your @piemr.edu.in address
--     Password           something long — save it in a password manager
--     Auto Confirm User  ON        <-- required, or you cannot sign in
--
-- STEP 2 — change the one email address below, then run this whole file
--          in the SQL Editor.
--
-- There is no Super-Admin option anywhere in the app's own UI, by
-- design. This file and the seed script are the only two ways in.
-- =====================================================================

do $$
declare
  -- vvvvvvvvvvvvvvvv  CHANGE THIS  vvvvvvvvvvvvvvvv
  v_email text := lower('you@piemr.edu.in');
  -- ^^^^^^^^^^^^^^^^  CHANGE THIS  ^^^^^^^^^^^^^^^^
  v_id uuid;
begin
  select id into v_id from auth.users where lower(email) = v_email;

  if v_id is null then
    raise exception
      'No account found for %. Create it first under Authentication -> Users -> Add user.',
      v_email;
  end if;

  -- The auth trigger creates every profile as team_lead; lift this one.
  insert into public.users (id, email, full_name, role, is_active)
  values (v_id, v_email, 'System Administrator', 'super_admin', true)
  on conflict (id) do update
    set role          = 'super_admin',
        admin_subtype = null,
        is_active     = true;

  insert into public.audit_log (actor_id, actor_role, action, target_table, target_id, metadata)
  values (v_id, 'super_admin', 'super_admin.promoted', 'users', v_id::text,
          jsonb_build_object('source', 'MAKE_SUPER_ADMIN.sql'));

  raise notice 'Super-admin ready: %', v_email;
end $$;

-- Confirm it worked. Expect exactly one row, role = super_admin.
select email, role, is_active from public.users where role = 'super_admin';
