-- =====================================================================
-- Lock down function execution.
--
-- Supabase grants EXECUTE on new functions in `public` to anon and
-- authenticated by default, so `revoke ... from public` — which only
-- drops the PUBLIC grant — left every function reachable over
-- /rest/v1/rpc/. Two of those are genuinely dangerous:
--
--   allocate_team_short_id()  hands out the next 3-digit Team ID from a
--                             sequence. Anyone could call it in a loop
--                             and burn through 001-999, after which no
--                             team can register at all.
--   write_audit(...)          appends to the audit trail. Anyone could
--                             forge entries, which is exactly the record
--                             you would want to trust after an incident.
--
-- The RLS helper predicates stay executable on purpose: policies are
-- evaluated as the calling role, so revoking EXECUTE from them would
-- break every policy that uses one. They reveal only the caller's own
-- role, which the caller already knows.
-- =====================================================================

-- ------------------------------------------- trigger functions: internal
-- Never called directly; only fired by triggers, which run as the table
-- owner regardless of these grants.
revoke all on function public.touch_updated_at() from public, anon, authenticated;
revoke all on function public.enforce_team_size() from public, anon, authenticated;
revoke all on function public.handle_new_auth_user() from public, anon, authenticated;

-- A mutable search_path in a function that runs as its owner lets a
-- caller who can create objects shadow the tables it references.
alter function public.touch_updated_at() set search_path = public, pg_temp;
alter function public.enforce_team_size() set search_path = public, pg_temp;

-- --------------------------------------------------- privileged helpers
-- Called only from inside other SECURITY DEFINER functions, which run as
-- the owner and so keep working with no grant of their own.
revoke all on function public.allocate_team_short_id() from public, anon, authenticated;
revoke all on function public.write_audit(text, text, text, jsonb)
  from public, anon, authenticated;

-- ------------------------------------------------ authenticated-only RPC
-- Each of these already refuses an anonymous caller internally; this
-- stops the request reaching them at all.
revoke all on function public.register_team(jsonb) from public, anon;
revoke all on function public.update_team(jsonb) from public, anon;
revoke all on function public.submit_idea(jsonb) from public, anon;
revoke all on function public.save_scores(jsonb) from public, anon;
revoke all on function public.set_result(jsonb) from public, anon;
revoke all on function public.judge_lookup_team(text) from public, anon;

grant execute on function public.register_team(jsonb)      to authenticated;
grant execute on function public.update_team(jsonb)        to authenticated;
grant execute on function public.submit_idea(jsonb)        to authenticated;
grant execute on function public.save_scores(jsonb)        to authenticated;
grant execute on function public.set_result(jsonb)         to authenticated;
grant execute on function public.judge_lookup_team(text)   to authenticated;

-- ------------------------------------------------------ deliberately open
-- The landing page and results page are served to logged-out visitors.
-- Both return aggregates or published names only, never a table row.
grant execute on function public.public_stats()   to anon, authenticated;
grant execute on function public.public_results() to anon, authenticated;

-- --------------------------------------------------------- RLS helpers
-- Left executable because policies need them. Stated explicitly so the
-- next person does not "tidy" them away and silently break access.
grant execute on function public.current_app_role()              to anon, authenticated;
grant execute on function public.is_super_admin()                to anon, authenticated;
grant execute on function public.is_admin_tier()                 to anon, authenticated;
grant execute on function public.is_spoc()                       to anon, authenticated;
grant execute on function public.is_roster_viewer()              to anon, authenticated;
grant execute on function public.owns_team(uuid)                 to anon, authenticated;
grant execute on function public.registration_editable(uuid)     to anon, authenticated;
grant execute on function public.submissions_editable()          to anon, authenticated;

-- Stop the same default from re-opening anything created from here on.
alter default privileges in schema public revoke execute on functions from anon;
