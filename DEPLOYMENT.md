# Deploying the PIEMR Hackathon Platform

From an empty Supabase project to a public URL. Budget about 45 minutes
the first time. Everything below is free-tier except a custom domain.

---

## What you need

| Thing | Why | Cost |
|---|---|---|
| [Supabase](https://supabase.com) account | Database, auth, file storage | Free tier is enough for ~120 teams |
| [Vercel](https://vercel.com) account | Hosting the Next.js app | Free (Hobby) |
| [Resend](https://resend.com) account | Confirmation emails | Free: 100/day, 3,000/month |
| A domain (optional) | e.g. `hackathon.piemr.edu.in` | Only if you want a custom URL |

Sign in to Vercel with GitHub — it makes the import step one click.

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
select id from storage.buckets where id = 'submissions';  -- expect 1 row
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

Supabase's own sign-in emails are separate and rate-limited on the free
tier (a few per hour). For ~120 team leads signing in at once, go to
**Project Settings → Authentication → SMTP Settings** and point Supabase
at Resend as well, or leads will hit the limit.

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

| Resource | Expected | Free tier |
|---|---|---|
| Database | < 100 MB | 500 MB |
| Storage (PPTs, diagrams) | ~2 GB at 25 MB/team | 1 GB — **may need the $25/mo Pro plan** |
| Monthly active users | ~750 | 50,000 |
| Vercel bandwidth | Well under | 100 GB |

Storage is the one thing likely to exceed free tier. Options: lower the
25 MB cap in `0006_submissions_judging.sql`, ask teams to link Google
Drive instead of uploading, or upgrade for the event month and downgrade
after.

**Supabase free projects pause after 7 days of inactivity.** Log in to
the dashboard weekly in the run-up, or upgrade before the event so it
cannot pause the night before.

---

## Troubleshooting

**Sign-in link goes to localhost** — Site URL is still the default.
Fix in Authentication → URL Configuration.

**"Registration is closed" when it should not be** — `registration_open`
is false. Settings → tick it. It is false by default so nobody registers
before you are ready.

**Emails not arriving** — check the Resend dashboard for bounces, verify
the domain's DNS records are verified, and confirm `EMAIL_FROM` uses a
domain you verified. Team IDs are always shown on screen regardless.

**Sign-in emails stop during a rush** — Supabase's built-in mailer is
rate-limited. Configure custom SMTP (step 5).

**A build fails on Vercel** — check the build log for a missing
environment variable; that is the usual cause. All five must be set.

**Uploads fail** — file is over 25 MB or a type the bucket rejects
(PDF, PPT, PPTX, PNG, JPEG, WebP). Both limits live in
`0006_submissions_judging.sql`.

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
