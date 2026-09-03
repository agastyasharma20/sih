-- =====================================================================
-- Seed data: settings defaults and the marking rubric.
--
-- Dates are intentionally null. The hackathon date, PS release date and
-- submission deadline are still TBD and are edited from the admin
-- settings screen — nothing here is hardcoded to a calendar.
-- =====================================================================

insert into public.settings (key, value, description, is_public) values
  ('registration_open',   'false'::jsonb,
   'Master switch for Module 1. While false, no team can register or edit.', true),
  ('hackathon_date',      'null'::jsonb,
   'Date of the internal hackathon. TBD.', true),
  ('ps_release_date',     'null'::jsonb,
   'Date the SIH problem statement list is published to teams. TBD.', true),
  ('submission_deadline', 'null'::jsonb,
   'Deadline for Module 2 idea/prototype submissions. TBD.', true),
  ('results_date',        'null'::jsonb,
   'Date results are published. TBD.', true),
  ('allowed_email_domain','"piemr.edu.in"'::jsonb,
   'Institutional email domain enforced on participants and primary mentors.', true),
  ('team_size',           '6'::jsonb,
   'Required number of members per team.', true),
  ('min_female_members',  '1'::jsonb,
   'Minimum female members per team.', true),
  ('max_ideas_per_team',  '2'::jsonb,
   'Number of problem statements a team may submit against.', true),
  ('event_name',          '"PIEMR Internal Hackathon"'::jsonb,
   'Display name used across the site and in emails.', true),
  ('ps_list_published',   'false'::jsonb,
   'When false, teams may leave the tentative PS choice as TBD.', true)
on conflict (key) do nothing;

-- ---------------------------------------------------------------------
-- Default marking rubric, SIH-style. Admin and Super-Admin can add,
-- edit, remove or reweight these at any time from settings — verify
-- against the current edition's official judging sheet before the event.
-- ---------------------------------------------------------------------
insert into public.marking_criteria (name, description, max_marks, display_order) values
  ('Problem Understanding & Relevance',
   'Grasp of the chosen problem statement and the significance of solving it.', 20, 1),
  ('Innovation & Novelty',
   'Originality of the approach compared to existing solutions.', 20, 2),
  ('Technical Feasibility & Complexity',
   'Soundness of the technical approach and the depth of engineering involved.', 20, 3),
  ('Clarity of Presentation',
   'Structure, clarity and confidence of the pitch and supporting material.', 20, 4),
  ('Execution & Prototype Readiness',
   'How much of the solution is actually working and demonstrable.', 20, 5)
on conflict do nothing;
