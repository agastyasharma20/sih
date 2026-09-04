# Deploying the PIEMR Hackathon Platform

From an empty Supabase project to a public URL. Budget about 45 minutes
the first time.

**This runs at zero cost, permanently.** Not a trial — the free tiers
below are ongoing. The app is deliberately built to stay inside them:
teams link their slides and diagrams rather than uploading, because file
storage is the only thing that would have forced a paid plan.

---

## What you need

| Thing | Why | Cost |
|---|---|---|
| [Supabase](https://supabase.com) account | Database, auth, file storage | Free tier is enough for ~120 teams |
| [Vercel](https://vercel.com) account | Hosting the Next.js app | Free (Hobby) |
| [Resend](https://resend.com) account | Confirmation emails | Free: 100/day, 3,000/month |
| A domain (optional) | e.g. `hackathon.piemr.edu.in` | Only if you want a custom URL |

Sign in to Vercel with GitHub — it makes the import step one click.

### Why this fits the free tier

The two things that normally push a project like this onto a paid plan
are file storage and transactional email. Both are designed around:

| Pressure | How it is avoided |
|---|---|
| **File storage** — 120 teams × 25 MB ≈ 2 GB, against 1 GB free | Teams paste Drive/GitHub/YouTube links. Nothing is uploaded, so storage usage is zero. Links also outlive the event. |
| **Auth emails** — Supabase's free mailer sends only a few per hour, and 120 leads signing in would jam it | Participants sign up with a password, so no auth email is sent at all. The sign-in link is still there for anyone who prefers it. |
| **Confirmation emails** — 120 teams × 6 members = 720 | Resend's free tier covers 3,000/month. Comfortably inside. |

Actual usage at ~120 teams: under 100 MB of database against 500 MB free,
about 750 monthly users against 50,000, and no storage at all.

---

## 1. Create the Supabase project

1. [supabase.com/dashboard](https://supabase.com/dashboard) → **New project**.
2. Name it `piemr-hackathon`.
3. Set a strong database password and **save it in a password manager** —
   it is shown only once.
4. Region: **South Asia (Mumbai)** — closest to Indore, so the fastest.
5. Wait ~2 minutes for provisioning.

---

## 2. Set up the database

Open **SQL Editor** in the Supabase dashboard, click **New query**, then:

1. Open **[`supabase/SETUP_ALL.sql`](supabase/SETUP_ALL.sql)** in this repo.
2. Click the **Raw** button on GitHub, select all (Ctrl+A), copy (Ctrl+C).
3. Paste the whole thing into the SQL Editor and press **Run** (Ctrl+Enter).

That one file contains every migration in the right order, so there is
nothing to sequence by hand. It takes a few seconds.

> **Paste the file's contents, not its name.** The editor needs the SQL
> itself — about 1,700 lines starting with
> `create extension if not exists "pgcrypto";`. If you see
> `ERROR: 42601: trailing junk after numeric literal`, you have pasted a
> filename or a line from a table in this guide instead of the SQL.

**Safe to run again.** Every statement is idempotent — existing objects
are left alone and missing ones are created. If a run fails part-way
(a dropped connection, a Supabase incident), just run the same file
again; it picks up where it stopped. You will see `NOTICE: ... already
exists, skipping` lines, which are informational, not errors.

**Verify it worked.** In a new query, run this — one query, because the
SQL Editor only shows the result of the *last* statement you run:

```sql
select
  (select count(*) from public.settings)                         as settings,
  (select count(*) from public.marking_criteria)                 as criteria,
  (select count(*) from pg_policies where schemaname = 'public') as policies,
  (select count(*) from information_schema.tables
    where table_schema = 'public' and table_type = 'BASE TABLE') as tables;
```

Expected: **14, 5, 40, 12**.

If any of those come back wrong, something did not run. Scroll up in the
SQL Editor output for the first red error and fix that one — later
statements depend on earlier ones.

<details>
<summary>Prefer to run the migrations separately?</summary>

The individual files in `supabase/migrations/` must be run **in numerical
order**, one at a time, waiting for each to succeed:

```
0001_schema.sql               tables, enums, constraints
0002_rls.sql                  row-level security policies
0003_functions.sql            registration RPCs, auth trigger
0004_seed.sql                 settings defaults, marking rubric
0005_grants.sql               role grants, public counters
0006_submissions_judging.sql  submissions, judging, results
```

Or, with the [Supabase CLI](https://supabase.com/docs/guides/cli):

```bash
supabase link --project-ref <your-project-ref>
supabase db push
```

`SETUP_ALL.sql` is generated from these files, so the two are equivalent.

</details>

## 3. Collect your keys

**Project Settings → API Keys.**

Supabase renamed these in 2025, and projects created from November 2025
onwards only have the new form. You will see:

| In the dashboard | Environment variable | Secret? |
|---|---|---|
| Project URL (Settings → General / Data API) | `NEXT_PUBLIC_SUPABASE_URL` | No |
| **Publishable key** — `sb_publishable_…` | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | No — safe in the browser, RLS gates every query |
| **Secret key** — `sb_secret_…` | `SUPABASE_SECRET_KEY` | **Yes.** Carries BYPASSRLS: it ignores every policy you just installed |

Older projects that still show `anon` and `service_role` work too — the
app accepts `NEXT_PUBLIC_SUPABASE_ANON_KEY` and
`SUPABASE_SERVICE_ROLE_KEY` as fallbacks.

**About the secret key.** It bypasses all 40 policies, so it belongs only
in Vercel's server-side environment variables. Never prefix it with
`NEXT_PUBLIC_`, never commit it, and do not paste it into a screenshot or
a chat. If it is ever exposed, rotate it immediately from this same page.
(Supabase now rejects secret keys sent from a browser by inspecting the
User-Agent, but do not rely on that.)

## 4. Configure auth

**Authentication → Providers → Email**: make sure Email is enabled.

**Authentication → URL Configuration**, once you know your Vercel URL:

- **Site URL**: `https://your-app.vercel.app`
- **Redirect URLs**: add `https://your-app.vercel.app/auth/callback`

Sign-in links break if the redirect URL is missing. Come back and do this
after step 6 if you do not have the URL yet.

**Restrict signups to your institution.** Authentication → Providers →
Email → **Restrict sign-ups to these domains**: `piemr.edu.in`. The app
enforces this server-side too, but defence in depth is free here.

**Turn off "Confirm email"** (Authentication → Providers → Email). The
app creates participant accounts already confirmed so that no auth email
is needed. Leaving confirmation on will not break signup, but it will
send mail you do not need and can hit the free-tier rate limit.

---

## 5. Set up email (Resend)

1. [resend.com](https://resend.com) → **Domains** → add `piemr.edu.in`.
2. Add the DNS records it gives you (ask whoever runs the PIEMR DNS).
3. **API Keys** → create one → copy it into `RESEND_API_KEY`.
4. Set `EMAIL_FROM` to `PIEMR Hackathon <hackathon@piemr.edu.in>`.

**Not ready?** Leave `RESEND_API_KEY` blank. Registration still works and
Team IDs are shown on screen and on the dashboard — confirmation emails
are logged and skipped rather than failing the registration. You can add
the key later without redeploying anything else.

**You do not need to configure Supabase SMTP.** Participants sign up with
a password, so Supabase sends no auth email. If you later want the
sign-in-link option used heavily, point Supabase at Resend under
**Project Settings → Authentication → SMTP Settings** — otherwise its
built-in mailer will rate-limit.

---

## 6. Deploy to Vercel

1. [vercel.com/new](https://vercel.com/new) → import `agastyasharma20/sih`.
2. Framework preset: **Next.js** (auto-detected). Leave build settings alone.
3. Expand **Environment Variables** and add all five:

```
NEXT_PUBLIC_SUPABASE_URL              https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY  sb_publishable_...
SUPABASE_SECRET_KEY                   sb_secret_...
RESEND_API_KEY                        re_...
EMAIL_FROM                            PIEMR Hackathon <hackathon@piemr.edu.in>
```

4. **Deploy**. First build takes 2–3 minutes.
5. Go back to **step 4** and set the Site URL and redirect URL to your new
   Vercel URL.

Set the branch Vercel deploys from under Settings → Git. Every push to it
redeploys automatically.

---

## 7. Create your super-admin account

There is no Super-Admin option anywhere in the app's UI, by design. Two
ways in — pick one.

### Option A — through the dashboard (no local setup)

**1.** Supabase → **Authentication → Users → Add user → Create new user**

| Field | Value |
|---|---|
| Email | your `@piemr.edu.in` address |
| Password | something long — save it in a password manager |
| **Auto Confirm User** | **ON** — without this you cannot sign in |

**2.** SQL Editor → paste **[`supabase/MAKE_SUPER_ADMIN.sql`](supabase/MAKE_SUPER_ADMIN.sql)**,
change the one email address near the top, and Run.

It prints `Super-admin ready: …` and returns one row with
`role = super_admin`. Safe to run more than once.

### Option B — the seed script (needs Node locally)

```bash
git clone https://github.com/agastyasharma20/sih.git
cd sih
npm install

cat > .env.local <<'ENV'
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
SUPABASE_SECRET_KEY=sb_secret_...
ENV

SUPER_ADMIN_EMAIL=you@piemr.edu.in \
SUPER_ADMIN_PASSWORD='<at least 16 characters>' \
npm run seed:super-admin
```

Then **delete `.env.local`**, or at least confirm it is git-ignored (it is).

Either way: there is no password reset for this tier. Store it properly.

### Creating everyone else

Once you can sign in as super-admin, every other account is made from
inside the app: **Settings → Create an account**, choosing Judge,
Coordinator, or Admin. Passwords are set by you and handed over directly —
nothing is emailed. Participants create their own accounts from the login
page.

Only a super-admin can create Admin accounts. An Admin can create Judges
and Coordinators.

## 8. First-run checklist

Sign in at `https://your-app.vercel.app/login` with the super-admin
account, then, in order:

- [ ] **Settings** → set the event name and the dates you know
- [ ] **Problem statements** → paste the SIH list (CSV with a
      `ps_id,title,category` header). Until you do, teams can only pick "TBD"
- [ ] **Settings** → create accounts for the SIH SPOC, coordinators and judges,
      and hand over the passwords directly
- [ ] **Settings** → tick **Team registration is open**
- [ ] Register a throwaway team end-to-end and confirm the email arrives
- [ ] Delete the test team from the SQL Editor before announcing

Then, as the event runs:

| Stage | Switch to turn on |
|---|---|
| Teams register | `registration_open` |
| Rosters frozen | Lock teams (Teams screen) |
| Ideas submitted | `submissions_open` |
| Presentation day | `judging_open` |
| Results out | Publish verdicts, then `results_published` |

---

## 9. Going public

**Custom domain.** Vercel → Settings → Domains → add
`hackathon.piemr.edu.in`, then have PIEMR's DNS admin add the CNAME Vercel
shows. Update the Supabase Site URL and redirect URL to match, or sign-in
links will break.

**Before you announce it:**

- [ ] Test a full registration on a phone — most students will use one
- [ ] Confirm `SUPABASE_SERVICE_ROLE_KEY` is **not** in any
      `NEXT_PUBLIC_` variable (`vercel env ls` to check)
- [ ] Sign in as a coordinator and confirm no marks appear anywhere
- [ ] Supabase → Database → **Backups**: verify daily backups are on
- [ ] Do a dry run of the judge flow with a fake team

---

## Scale and cost

For ~120 teams (720 students):

| Resource | Expected | Free tier | Headroom |
|---|---|---|---|
| Database | < 100 MB | 500 MB | 5× |
| File storage | **0** — links only | 1 GB | n/a |
| Monthly active users | ~750 | 50,000 | 65× |
| Confirmation emails | ~750/month | 3,000/month | 4× |
| Vercel bandwidth | A few GB | 100 GB | comfortable |

Nothing here is close to a limit. **Total cost: ₹0.**

### The one thing that can bite you

**Supabase free projects pause after 7 days of inactivity.** If it pauses
the night before the event, you restore it from the dashboard in about a
minute — but only if you notice. Two ways to avoid it entirely:

- Open the Supabase dashboard once a week during the run-up. Any activity
  resets the timer.
- Or, in the last fortnight, just use the site occasionally yourself.

During the event it will be active daily, so this only matters beforehand.

### If the institute later funds a paid plan

The one feature worth buying back is real file uploads instead of links
(Supabase Pro, $25/mo, 100 GB). `0006_submissions_judging.sql` documents
exactly what to add — a bucket plus a policy scoping writes to the team's
own folder. The `submissions` table already stores plain URLs, so nothing
else changes.

---

## Making it fast

Two things dominate page load, and both are already configured — but the
first only takes effect on a redeploy.

**1. Run the app in the same region as the database.** This is the big
one. Vercel's Hobby plan defaults to Washington DC (`iad1`); your Supabase
project is in Mumbai (`ap-south-1`). Every query then crosses the planet
and back — roughly 250 ms each, several per page. `vercel.json` pins the
functions to Mumbai (`bom1`):

```json
{ "regions": ["bom1"] }
```

Check it applied: Vercel → your project → Settings → Functions → Region
should read Mumbai. If you ever move the Supabase project, change both.

**2. The database work is done.** Migration `0010` fixes eight policies
that re-evaluated `auth.uid()` once per row rather than once per query,
and adds covering indexes for five foreign keys plus the judge's
Team ID lookup.

**3. Charts load on demand.** Recharts is ~110 kB and only appears on the
analytics screen, so it is loaded dynamically. That took the analytics
page from 208 kB of first-load JavaScript to 89 kB, and keeps it out of
every other page — including the registration form students actually use
on their phones.

If a page still feels slow after a redeploy, the first thing to check is
whether the Supabase project has gone to sleep (free projects pause after
7 days idle) — the first request after a pause takes several seconds.

---

## Is it working? Check `/api/health`

Open `https://your-app.vercel.app/api/health` in a browser. It reports
which configuration is present and whether the database answers:

```json
{
  "healthy": true,
  "checks": {
    "supabase_url": "set",
    "publishable_key": "set",
    "secret_key": "set",
    "database": "ready (14 settings)",
    "admin_access": "working"
  }
}
```

Anything reading `MISSING`, `WRONG KEY`, `ERROR` or `INCOMPLETE` names the
problem directly. It returns presence only — no key or value is ever
exposed — so it is safe to leave reachable.

**Environment variables in Vercel only take effect on a new deployment.**
After adding or changing one, go to Deployments → ⋯ → **Redeploy**.
Vercel says this in a toast and it is the single easiest thing to miss.

`SUPER_ADMIN_EMAIL` and `SUPER_ADMIN_PASSWORD` do **not** belong in
Vercel. They are read only by the local seed script. Setting them in the
hosting environment does nothing and leaves a password sitting where it
serves no purpose — delete them.

---

## Troubleshooting

**Sign-in link goes to localhost** — Site URL is still the default.
Fix in Authentication → URL Configuration.

**"Registration is closed" when it should not be** — `registration_open`
is false. Settings → tick it. It is false by default so nobody registers
before you are ready.

**Emails not arriving** — check the Resend dashboard for bounces, verify
the domain's DNS records are verified, and confirm `EMAIL_FROM` uses a
domain you verified. Team IDs are always shown on screen regardless, so
registration is never blocked by mail problems.

**Sign-in emails stop during a rush** — that is Supabase's built-in
mailer rate-limiting. Tell people to use the password option, which sends
no email at all, or configure custom SMTP (step 5).

**A judge cannot open a team's slides** — the team's Drive link is not
shared. This is the most common failure on presentation day, which is why
the submission form warns about it. An admin can see every link on the
Teams screen and chase the team before they present.

**A build fails on Vercel** — check the build log for a missing
environment variable; that is the usual cause.

**`relation "public.users" does not exist`, but you can see the table** —
you have more than one Supabase project and are looking at a different
one from the app. The project reference appears in the dashboard URL
(`/dashboard/project/<ref>/…`) and in `NEXT_PUBLIC_SUPABASE_URL`
(`https://<ref>.supabase.co`). They must match. `/api/health` reports the
one the deployment is actually using, as `supabase_project`.

Creating a second project by accident is easy — decide which one is real,
run `SETUP_ALL.sql` there, point Vercel's variables at it, redeploy, and
delete the other so it cannot confuse you later.

**`/api/health` returns 404** — the deployment predates that route.
Vercel → Deployments → ⋯ → Redeploy, and check it is building the branch
you expect.

**Sign-up fails with `Unexpected token '<' … is not valid JSON`** — the
server returned an HTML error page instead of JSON, which means the route
crashed. Almost always the database it points at has no tables (wrong
project) or the secret key is unset. `/api/health` distinguishes the two.

**A submission will not finalise** — a problem statement must be chosen
first. Drafts save without one.

---

## Security notes for whoever runs this

- The secret key (`sb_secret_…`, formerly `service_role`) bypasses every
  security policy. It belongs only in Vercel's server-side environment
  variables. If it leaks, rotate it immediately in Supabase → Project
  Settings → API Keys.
- The super-admin tier is invisible by design: it is filtered out of the
  account list admins see, by a database policy rather than by hiding a
  row in the UI.
- Every admin and super-admin action is written to `audit_log`.
- Coordinators cannot read marks. This is enforced by row-level security,
  so it holds even if someone calls the API directly.
- This system holds student names, enrollment numbers, emails and phone
  numbers. Keep the repository private, keep the roster export off shared
  drives, and delete test data before going live.
