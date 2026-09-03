# PIEMR Internal Hackathon Platform

Registration, judging and results portal for the internal hackathon that
selects Prestige Institute of Engineering Management & Research (Indore)
teams for the Smart India Hackathon.

**This pass ships Module 1 (Team Registration) end-to-end.** Modules 2–5
are specified and their tables, roles and policies already exist, so
switching them on needs no data migration.

---

## Stack

| Concern | Choice |
|---|---|
| Framework | Next.js 14 (App Router), TypeScript |
| Database / Auth | Supabase — Postgres, Supabase Auth, Row-Level Security |
| Styling / motion | Tailwind CSS, Framer Motion |
| Forms / validation | React Hook Form + Zod (one schema, client and server) |
| Email | Resend |
| Charts (Module 5) | Recharts |
| Hosting | Vercel + Supabase |

---

## Getting started

```bash
npm install
cp .env.example .env.local     # fill in your Supabase project values
```

Apply the migrations to your Supabase project, in order:

```
supabase/migrations/0001_schema.sql      tables, enums, constraints
supabase/migrations/0002_rls.sql         row-level security policies
supabase/migrations/0003_functions.sql   registration RPCs, auth trigger
supabase/migrations/0004_seed.sql        settings defaults, marking rubric
supabase/migrations/0005_grants.sql      role grants, public counters
```

Either paste them into the Supabase SQL editor in order, or run
`supabase db push` if you use the Supabase CLI.

Then seed the super-admin (once per environment) and start the app:

```bash
SUPER_ADMIN_EMAIL=... SUPER_ADMIN_PASSWORD=... npm run seed:super-admin
npm run dev
```

Finally, sign in as the super-admin and open **Settings** to set the
hackathon date, PS release date and submission deadline, and to switch
registration on. None of those are set in code.

---

## Verifying the database layer

The migrations and their security policies are covered by a suite that
spins up a throwaway Postgres, applies every migration, and asserts the
Module 1 rules and the RLS boundaries:

```bash
./supabase/tests/run.sh      # needs a local PostgreSQL 16 binary
```

It checks, among others, that a team of five is refused, that a team with
no female member is refused, that an enrollment number registered on one
team cannot be reused on another, that a coordinator reads the roster but
**zero** score rows, and that an admin cannot see the super-admin account.

---

## Roles

One login page serves everyone. The role is resolved server-side after
authentication and decides only where you land — the login screen carries
no role selector and no hint of which tiers exist.

| Role | Creates accounts | Sees marks | Edits criteria | Analytics |
|---|---|---|---|---|
| Super-Admin | all roles | yes | yes | yes |
| Admin — *SIH SPOC* | coordinator, judge | yes | yes | yes |
| Admin — *Sr. Director* | no | yes | yes | yes |
| Coordinator | no | **no** | no | non-marks only |
| Team Lead | self-registers | no | no | no |
| Judge | no | own scores only | no | no |

The two admin sub-types share the `admin` role and differ by the
`admin_subtype` flag (`spoc` \| `director`), so screens gate on a
permission flag rather than a separate role.

### The super-admin tier

- Seeded once by `scripts/seed-super-admin.ts`, reading credentials from
  environment variables at deploy time. No password appears in this repo.
- Unreachable from any HTTP path: `/api/admin/users` accepts only
  `admin`, `coordinator` and `judge`, so the tier cannot be minted through
  the application.
- Filtered out of the account list an admin sees — enforced by the
  `users_select_admin` policy in Postgres, not by hiding a table row.
- Every action is written to `audit_log`, readable only by super-admin.

---

## Module 1 — what is enforced, and where

Validation runs in three places. The browser copy exists for fast
feedback; the database copy is the one that counts.

| Rule | Browser | API route | Postgres |
|---|:--:|:--:|:--:|
| Exactly 6 members | ✓ | ✓ | ✓ |
| At least one female member | ✓ | ✓ | ✓ |
| `@piemr.edu.in` on every member | ✓ | ✓ | ✓ |
| Primary mentor required, PIEMR-affiliated | ✓ | ✓ | ✓ + `CHECK` |
| Enrollment unique across **all** teams | in-form only | ✓ | ✓ + unique index |
| Phone unique across **all** teams | in-form only | ✓ | ✓ + unique index |
| Email unique across **all** teams | in-form only | ✓ | ✓ + unique index |
| Registration window open | ✓ | — | ✓ |
| One team per team lead | — | — | ✓ |

`public.register_team(jsonb)` performs the whole registration in one
transaction: it validates, allocates the next 3-digit Team ID, and writes
the team, six members and mentors together. Rejections return
`{ok:false, code, field, message}` and write nothing. A collision that
slips past the up-front checks (two leads submitting the same student at
the same instant) is caught at the unique index and mapped back to the
field that collided — the message names the field but never which team
already holds it.

### Team ID

Allocated from a Postgres sequence as a zero-padded `001`–`999`. This is
the ID judges type at presentation time. When a team submits two ideas in
Module 2, submissions are distinguished as `001-1` / `001-2` while the
base Team ID stays three digits.

### Team Lead self-service

After registering, the lead signs back in and edits the same form at
`/dashboard/team`. Editing stays open until an admin closes registration
or locks the team — `registration_editable()` gates this in the RLS
policies, so a lead cannot edit past the deadline via the API either.

### Confirmation email

All six members receive the Team ID and a summary, sent as one message
per member so no participant sees the others' addresses. Mail failure is
reported to the lead but never rolls back a completed registration. With
`RESEND_API_KEY` unset, sends are logged and skipped.

---

## Security notes

- **RLS everywhere.** Every table has policies; the `scores` table has no
  policy admitting coordinators or team leads, so marks are unreachable
  for them through any client.
- **No privilege escalation at signup.** The `auth.users` trigger always
  creates profiles as `team_lead`, because signup metadata is
  attacker-controlled. Elevation happens only through the service-role
  admin API, after the caller's own role has been checked.
- **Domain restriction is server-side.** `/api/auth/otp` checks the
  institutional domain before sending a link; existing staff accounts are
  exempt so they are not locked out.
- **Rate limiting** on login (per IP and per account), registration and
  team updates. It is in-memory and therefore per serverless instance —
  good against duplicate submissions and casual brute force. Move it to
  Upstash Redis if the deployment spans regions.
- **Service-role key** is confined to `src/lib/supabase/admin.ts` and
  never imported into a Client Component.

---

## Layout

```
src/
  app/
    page.tsx                    landing — hero, counters, key dates
    login/                      single login page, all roles
    register/                   Module 1 registration form
    problem-statements/         public, filterable PS list
    dashboard/
      team/                     team lead: view + edit
      admin/                    overview, teams, settings, accounts
      coordinator/              roster, no marks
      judge/                    rubric; scoring lands here in Module 3
    api/
      teams/register            POST — Module 1 write path
      teams/update              PUT  — team lead edits
      auth/otp, auth/password   rate-limited sign-in
      admin/users, admin/settings
  lib/
    validation/registration.ts  the Zod schema shared by form and API
    supabase/                   browser, server, service-role clients
    auth.ts                     server-side role resolution
    email.ts, rate-limit.ts
supabase/
  migrations/                   schema, RLS, functions, seed, grants
  tests/                        migration + policy test suite
scripts/seed-super-admin.ts
```

---

## Still to confirm

These are open in the spec and deliberately not baked in:

- Hackathon date, PS release date, submission deadline — set them in
  **Settings**; they default to TBD.
- The marking rubric is seeded with five criteria at 20 marks each
  (100 total). Check it against the current edition's official SIH
  judging sheet before the event; admins can reweight it at any time.
- Team Lead sign-in currently offers both a magic link and a password.
  Magic link is the default and needs no password-reset support.
- Mentors are free text validated by email domain. If a PIEMR faculty
  list becomes available, swap the mentor inputs for a picklist against
  it — the `mentors` table needs no change.

---

## Roadmap

- **Module 2** — admin-built idea and prototype submission forms, up to
  two ideas per team (`submissions.idea_slot`).
- **Module 3** — judges enter a Team ID, score against
  `marking_criteria`, leave per-criterion remarks.
- **Module 4** — results publishing; leads see their own verdict once
  `results.is_published` is set.
- **Module 5** — PS bulk import and the analytics dashboard
  (registrations over time, PS popularity, branch/year/gender
  distribution, judge scoring spread, funnel).
