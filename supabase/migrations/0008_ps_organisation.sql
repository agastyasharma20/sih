-- =====================================================================
-- Problem statements: record the sponsoring organisation.
--
-- Every SIH problem statement is put up by a ministry, department or
-- PSU, and their export carries that column. Teams choose partly on it,
-- and the SPOC needs it when filing the national-round entry.
-- =====================================================================

alter table public.problem_statements
  add column if not exists organisation text;

create index if not exists problem_statements_theme_idx
  on public.problem_statements (theme) where is_active;
