# PIEMR Internal Hackathon Platform

Registration, judging and results portal for the internal hackathon that
selects Prestige Institute of Engineering Management & Research (Indore)
teams for the Smart India Hackathon.

**All five modules are built**: team registration, idea submission with
file uploads, judge scoring against an editable rubric, results
publishing, and problem-statement management with analytics. Each stage
is gated by a switch an admin controls, so the round opens and closes
without a deploy.

**It runs at zero cost.** Teams link their slides and diagrams rather
than uploading them, and participants sign up with a password rather than
an emailed link — the two things that would otherwise push this onto a
paid Supabase plan. See **[DEPLOYMENT.md](DEPLOYMENT.md)**.

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

Set up the database: copy the **contents** of `supabase/SETUP_ALL.sql`
into the Supabase SQL Editor and press Run. That single file contains
every migration in the correct order.

(The individual files live in `supabase/migrations/` if you would rather
run them one at a time, or use `supabase db push` with the CLI.)

Then seed the super-admin (once per environment) and start the app:

```bash
SUPER_ADMIN_EMAIL=... SUPER_ADMIN_PASSWORD=... npm run seed:super-admin
npm run dev
```

Finally, sign in as the super-admin and open **Settings** to set the
hackathon date, PS release date and submission deadline, and to switch
registration on. None of those are set in code.

---

## Tests

Three suites, none of which need a cloud connection.

```bash
npm test                     # unit + component tests
npm run test:e2e             # browser tests, desktop and mobile
./supabase/tests/run.sh      # migrations + RLS, needs a local PostgreSQL 16

npm run test:all             # unit and browser together
```

**Browser tests** (`e2e/`) run a production build in real Chromium, at
both a desktop and a Pixel viewport. They assert that every public page
returns 200 and logs no script errors, that no page scrolls sideways on a
phone, that every protected route redirects a signed-out visitor and every
privileged API refuses one, that the theme toggle persists across a
reload, and that every form control is labelled and every image has alt
text.

Auth is deliberately **not** bypassed for them — that would mean shipping
an escape hatch to production. Screens behind auth are covered by
component tests instead, which drive the real registration form: the
six-member limit, the female-member rule, the fixed team-lead email, the
optional mentor section, and that an empty form never reaches the network.

**Unit tests** cover the logic most likely to break silently: the shared
registration schema (team size, the female-member rule, domain checks,
in-form duplicates, and the two form-encoding cases below), the CSV
reader used by the problem-statement importer (quoted fields, embedded
commas and newlines, doubled quotes, CRLF, BOM, tab-separated paste), and
the analytics aggregations.

**Database tests** spin up a throwaway Postgres, apply every migration in
order, and assert the real behaviour: a team of five is refused, a team
with no female member is refused, an enrollment number registered on one
team cannot be reused on another, a coordinator reads the roster but
**zero** score rows, an admin cannot see the super-admin account, a
coordinator cannot write a score or a problem statement, and locking one
team stops its lead editing while other teams carry on.

Two bugs found this way, both of which would have blocked every real
submission, are worth knowing about if you touch the form:

- A hidden input serialised `is_lead` as the string `"true"`, which
  `z.boolean()` rejects. The lead is now derived from the row position,
  and the schema accepts either form.
- Collapsing the optional secondary-mentor section left blank strings
  behind, so validation failed on three fields the user could not see.
  A blank mentor is now treated as absent, and completeness is checked
  only once the section has been started.

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
| Tentative PS is on the active list | ✓ | ✓ | ✓ |
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
      admin/
        page.tsx                overview + readiness warnings
        teams/                  rosters, per-team and bulk locking, export
        analytics/              charts and data-quality checks
        problem-statements/     bulk import and the active list
        settings/               dates, switches, account creation
        audit/                  activity trail
      coordinator/              roster + export, no marks
      judge/                    rubric; scoring lands here in Module 3
    api/
      teams/register            POST  — Module 1 write path
      teams/update              PUT   — team lead edits
      auth/otp, auth/password   rate-limited sign-in
      admin/users               account provisioning
      admin/settings            event configuration
      admin/problem-statements  single add + bulk CSV import
      admin/teams               lock / unlock
      admin/teams/export        roster CSV
  lib/
    validation/registration.ts  the Zod schema shared by form and API
    csv.ts                      delimited reader/writer for import + export
    analytics.ts                pure aggregations for the dashboard
    supabase/                   browser, server, service-role clients
    auth.ts                     server-side role resolution
    email.ts, rate-limit.ts
supabase/
  migrations/                   schema, RLS, functions, seed, grants
  tests/                        migration + policy test suite
tests/                          unit tests
scripts/seed-super-admin.ts
```

---

## Running the event

1. **Import the problem statements.** Admin → Problem statements. Paste
   CSV or spreadsheet rows with a `ps_id,title,category` header; `theme`
   and `description` are optional. Re-importing the same `ps_id` updates
   it rather than duplicating. Until at least one statement exists, teams
   can only choose “TBD”, and the admin overview says so.
2. **Set the dates and open registration** in Settings.
3. **Watch Analytics** for teams with the wrong roster size, and the
   female-member share.
4. **Export the roster** as CSV from the Teams screen (coordinators can
   too — it carries no marks).
5. **Lock teams** individually or in bulk when the roster is settled.
   Locking is enforced in the database, so a locked team cannot be edited
   through the API either.

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

## Modules 2-4

**Submission** (`/dashboard/team/submit`). Up to two ideas per team, each
against a different problem statement — the second slot cannot reuse the
first's. Teams paste links to their slides, architecture diagram, GitHub
repository and demo video rather than uploading files, which keeps the
deployment inside Supabase's free storage tier and means the artefacts
outlive the event. The form warns about link sharing up front, because a
restricted Drive file is the most common failure on presentation day.
Drafts save without a problem statement; finalising requires one, and
once finalised a later draft save cannot clear the submitted timestamp.

**Judging** (`/dashboard/judge`). A judge types the 3-digit Team ID,
reviews the artefacts, and scores each criterion with optional remarks.
`judge_lookup_team()` is SECURITY DEFINER and returns exactly one team's
submission summary, so a judge cannot enumerate the field. Marks are
validated against each criterion's own maximum in the database.

**Results** (`/dashboard/admin/results`, `/results`). Submissions ranked
by average marks across judges, via the `submission_scores` view — which
is `security_invoker`, so a coordinator opening it sees nothing. An admin
sets a verdict and publishes it per team; the team lead then sees their
own verdict and nobody else's. The public page lists selected teams and
never marks.

## Interface

- **Searchable problem statements.** The full SIH catalogue is a few
  hundred entries, so `/problem-statements` filters on PS number, title,
  theme, ministry and description as you type, with category and theme
  filters alongside. Everything runs client-side off one payload — no
  request per keystroke, and it stays usable on a phone.
- **Live countdown** to the hackathon, which appears only once a date is
  set and disappears once it passes.
- **Team search** on the admin roster, matching across team ID, name,
  member names, emails and enrollment numbers.
- **Light and dark**, remembered per visitor and applied before first
  paint so there is no flash of the wrong theme.
- **Motion** is defined once in `src/lib/motion.ts` and applied through
  `MotionProvider`, which sets Framer's `reducedMotion="user"`. A visitor
  who has asked their operating system for reduced motion gets opacity
  changes only — no movement — without that having to be remembered at
  each call site.

## Branding

`src/lib/branding.ts` and `src/lib/leadership.ts` hold everything
institution-specific. Both fall back to designed placeholders — a
monogram and an initials badge — so nothing ever renders as a broken
image:

- **PIEMR logo** — save it as `public/piemr-logo.png`, then set
  `PIEMR_LOGO` to `'/piemr-logo.png'`.
- **Leadership photos** — save square images into `public/leadership/`
  and set each `photo`, or paste an https URL from piemr.edu.in. Photos
  are cropped square and centred, so a portrait headshot works unedited.

A local file is preferred over hot-linking: if the institute rearranges
its site, a linked image breaks on every page here at once.

## Still to come

Once the first round has run: problem-statement popularity, judge scoring
spread to flag outlier judges, and the full registered → submitted →
selected funnel.
