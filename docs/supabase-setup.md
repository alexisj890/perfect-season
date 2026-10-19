# Supabase setup (Milestone 6.7)

Your side of 6.7: everything done in the Supabase and Google dashboards. The
code side (sign-in pop-up, cloud saves) is built in steps 6.7a–d once the
project exists. Tick the boxes as you go.

**How it fits together**

- **Supabase Auth** handles accounts: email + password sign-up, and "Continue with Google".
- **Supabase Database** (Postgres) stores each signed-in player's runs in a `runs` table.
- **Row Level Security (RLS)** is what keeps it safe: every query is checked
  against the signed-in user, so players can only ever read or change their own
  runs. The browser key can't get around it.
- Guests keep playing without an account; their runs stay in the browser.

---

## A1. Create the project

- [ ] Sign up at [supabase.com](https://supabase.com) and create a **new project**.
- [ ] Pick the region closest to you.
- [ ] Save the **database password** in a password manager (rarely needed, hard to recover).
- [ ] If asked about the **Data API**, leave it enabled — it's how the app talks to the database.

> Free projects pause after about a week without use. Resume them from the dashboard.

## A2. Connect the app (keys)

- [ ] In the dashboard: **Project Settings → API Keys** (or the **Connect** button).
- [ ] Copy `.env.example` to **`.env.local`** (or `.env`) in the project folder and fill in:

```
NEXT_PUBLIC_SUPABASE_URL=https://<your-project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

- [ ] Restart `npm run dev` after changing env files (Next.js reads them at start-up).

| Key | Looks like | Where it may go |
|---|---|---|
| Publishable | `sb_publishable_...` | The app, including the browser. RLS limits it. |
| Secret | `sb_secret_...` | **Never in this app**, not even locally. It bypasses RLS. |

> The older `anon` / `service_role` keys are the legacy versions of these two
> (being retired by the end of 2026). Use the new ones.

> `NEXT_PUBLIC_` is how Next.js decides which env values the browser may see.
> Env files are in `.gitignore` (`.env*`), so they never reach GitHub; only
> `.env.example` (names, no values) is committed.

## A3. Allowed URLs

**Authentication → URL Configuration**

- [ ] **Site URL:** `http://localhost:3000`
- [ ] **Redirect URLs:** add `http://localhost:3000/**`

Supabase only sends people back to addresses on this list (after Google
sign-in or an email link). The real site address gets added when we deploy.

## A4. Email + password sign-up

Email sign-up and **Confirm email** are on by default. Leave both on. **Nothing
else is needed to start**: the app works with Supabase's default email templates.

- [ ] **Password rules** — in **Authentication → Providers → Email** (or **Sign In /
  Providers → Email**), set **Minimum password length** to 8 and **Password
  requirements** to *Lowercase, uppercase letters, digits and symbols*. The app
  checks this too, but the server rule is the one nobody can skip.

How the default emails work with this app:

- The link in a confirmation or reset email confirms you on Supabase, which then
  sends you to our `/auth/callback` route with a one-time code. That route signs
  you in (it's the same route Google sign-in uses).
- That code only works in **the same browser you signed up or asked for the
  reset in**, because the browser holds the matching secret (the "PKCE" flow).

Limits of Supabase's built-in email service:

- It only delivers to **members of your Supabase team**, so test with the email
  address you use for Supabase. Others get "Email address not authorized".
- At most **2 emails per hour**.
- Email templates can't be edited until a custom email server (SMTP) is set up.

### Later: custom SMTP and email templates (optional, before launch)

For real players, add an email provider (for example Resend, Postmark, or Gmail
with an app password) under **Authentication → Emails → SMTP Settings**. Then
point the two templates at our `/auth/confirm` route, which works from any
browser (it checks a token in the link instead of a browser-held secret):

- [ ] **Confirm signup** — set the link (the `href`) to:

```
{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next={{ .RedirectTo }}
```

- [ ] **Reset password** — set the link to:

```
{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/account/reset-password
```

## A5. Google sign-in

The fiddliest part — it's fine to do this after the rest.

In the [Google Cloud Console](https://console.cloud.google.com):

- [ ] Create a project (e.g. "Perfect Season").
- [ ] Open **Google Auth Platform** and fill in:
  - [ ] **Branding**: app name, support email.
  - [ ] **Audience**: External.
  - [ ] **Data Access** (scopes): add `openid` (email and profile are there by default). Don't add more — extra scopes need Google's review.
- [ ] **Clients → Create client → Web application**:
  - [ ] **Authorized JavaScript origins:** `http://localhost:3000`
  - [ ] **Authorized redirect URIs:** the callback URL shown on Supabase's
    **Authentication → Providers → Google** page — it looks like
    `https://<your-project-ref>.supabase.co/auth/v1/callback`
- [ ] Copy the **Client ID** and **Client Secret**.

Back in Supabase, **Authentication → Providers → Google**:

- [ ] Paste the Client ID and Client Secret, and **enable** Google.

> The Google Client Secret goes only into the Supabase dashboard — never into
> `.env` or the code.

## A6. The `runs` table and its security rules

**SQL Editor → New query**, paste, and **Run**. (A copy will also live in the
repo under `supabase/migrations/`, so the database's design is written down.)

```sql
-- One row per run. The whole game state (RunState) is stored as JSON.
create table public.runs (
  id uuid primary key,                       -- the run's own id
  user_id uuid not null default auth.uid()   -- whoever is signed in
    references auth.users (id) on delete cascade,
  state jsonb not null,
  difficulty text not null,
  finished boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index runs_by_user on public.runs (user_id, updated_at desc);

-- Keep updated_at honest (set by the database, not the browser's clock).
create function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end $$;
create trigger runs_touch before update on public.runs
  for each row execute function public.touch_updated_at();

-- Row Level Security: with no matching policy, nobody can touch a row.
alter table public.runs enable row level security;
create policy "Read own runs"   on public.runs for select to authenticated using ((select auth.uid()) = user_id);
create policy "Add own runs"    on public.runs for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Update own runs" on public.runs for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Delete own runs" on public.runs for delete to authenticated using ((select auth.uid()) = user_id);
```

What each part does:

- `references auth.users ... on delete cascade` — every run belongs to a real
  account; deleting the account deletes its runs.
- `default auth.uid()` — the database fills in the signed-in player, so the
  app can't save a run under someone else's id.
- `jsonb` — Postgres's JSON type; the run is stored whole, like in the browser.
- The trigger — stamps `updated_at` on every save, which decides which copy is
  newest when you play on two devices.
- `enable row level security` + the four policies — reading, adding, updating
  and deleting are each allowed only for your own rows. `to authenticated`
  means guests (not signed in) get nothing at all.

Then:

- [ ] **Table Editor → runs**: the table exists and shows **RLS enabled**.
- [ ] **Advisors → Security Advisor**: no warnings about `runs`.

---

## Done? Tell Claude

- **After A1–A2:** step 6.7a (connecting the app) can start.
- **After A3 and A6:** accounts and cloud saves can be tested end to end (A4 needs no changes).
- **A5 (Google)** can come any time; the "Continue with Google" button works once it's on.

## Troubleshooting

- **"Invalid API key"** — wrong key in `.env.local`, or the dev server wasn't restarted.
- **Google says `redirect_uri_mismatch`** — the redirect URI in Google Cloud must
  match Supabase's callback URL exactly (https, no trailing slash).
- **Sign-up email never arrives** — the built-in service only emails your Supabase
  team, at most 2 per hour; wait, or check **Authentication → Users** (you can
  confirm a user by hand there while testing).
- **"That sign-in link didn't work"** — the email link was opened in a different
  browser from the one you signed up in (or it was used already). Sign in with
  the password instead, or open the link in the original browser.
- **Signed in but nothing saves** — check A6 ran, and that the table shows RLS
  enabled with four policies.
