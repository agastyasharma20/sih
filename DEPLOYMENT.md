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

## 2. Apply the database migrations

Open **SQL Editor** in the Supabase dashboard. Run each file from
`supabase/migrations/` **in numerical order**, one at a time, waiting for
each to succeed:

```
0001_schema.sql            tables, enums, constraints
0002_rls.sql               row-level security policies
0003_functions.sql         registration RPCs, auth trigger
0004_seed.sql              settings defaults, marking rubric
0005_grants.sql            role grants, public counters
0006_submissions_judging.sql  submissions, judging, results, storage
```

Order matters — later files depend on earlier ones. If a file errors,
**stop and fix it** rather than continuing.

Prefer the CLI? With the [Supabase CLI](https://supabase.com/docs/guides/cli)
installed:

```bash
supabase link --project-ref <your-project-ref>
supabase db push
```

**Verify it worked.** In the SQL Editor:

```sql
select count(*) from public.settings;         -- expect 14
select count(*) from public.marking_criteria; -- expect 5
select count(*) from pg_proc where proname = 'register_team';  -- expect 1
```

---

## 3. Collect your keys

**Project Settings → API**:

| Key | Where it goes | Secret? |
|---|---|---|
| Project URL | `NEXT_PUBLIC_SUPABASE_URL` | No |
| `anon` / `public` key | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | No — safe in the browser, RLS protects the data |
| `service_role` key | `SUPABASE_SERVICE_ROLE_KEY` | **Yes.** Bypasses all security. Server only. Never commit it, never put it in a `NEXT_PUBLIC_` variable |

---

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
NEXT_PUBLIC_SUPABASE_URL       https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY  eyJhbGci...
SUPABASE_SERVICE_ROLE_KEY      eyJhbGci...
RESEND_API_KEY                 re_...
EMAIL_FROM                     PIEMR Hackathon <hackathon@piemr.edu.in>
```

4. **Deploy**. First build takes 2–3 minutes.
5. Go back to **step 4** and set the Site URL and redirect URL to your new
   Vercel URL.

Set the branch Vercel deploys from under Settings → Git. Every push to it
redeploys automatically.

---

## 7. Seed the super-admin

This account is not creatable from any screen — it exists only via this
script. Run it **once**, from your own machine:

```bash
git clone https://github.com/agastyasharma20/sih.git
cd sih
npm install

cat > .env.local <<'ENV'
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...
ENV

SUPER_ADMIN_EMAIL=you@piemr.edu.in \
SUPER_ADMIN_PASSWORD='<a long random password>' \
npm run seed:super-admin
```

The password must be at least 16 characters. Store it in a password
manager — there is no reset flow for this tier. Then **delete
`.env.local`**, or at least confirm it is git-ignored (it is).

---

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
environment variable; that is the usual cause. All five must be set.

**A submission will not finalise** — a problem statement must be chosen
first. Drafts save without one.

---

## Security notes for whoever runs this

- The `service_role` key bypasses every security policy. It belongs only
  in Vercel's server-side environment variables. If it leaks, rotate it
  immediately in Supabase → Settings → API.
- The super-admin tier is invisible by design: it is filtered out of the
  account list admins see, by a database policy rather than by hiding a
  row in the UI.
- Every admin and super-admin action is written to `audit_log`.
- Coordinators cannot read marks. This is enforced by row-level security,
  so it holds even if someone calls the API directly.
- This system holds student names, enrollment numbers, emails and phone
  numbers. Keep the repository private, keep the roster export off shared
  drives, and delete test data before going live.
