# Project Tracker — hosting guide (Supabase + Netlify)

This is your tracker rebuilt as a real website your whole team can use at the same time. Data lives in a shared **Supabase** database (free tier) with **live sync** — when one person changes something, everyone else sees it within a second. It's hosted on **Netlify** (free) at your own web address. Each teammate signs in with their own email + password.

You'll do five things once. Budget ~20 minutes. No coding required — just copying and pasting.

You need three free accounts: **GitHub**, **Supabase** (supabase.com), and **Netlify** (netlify.com).

---

## Step 1 — Create the database (Supabase)

1. Go to supabase.com → **New project**. Pick a name, a strong database password (save it somewhere), and the region closest to Indonesia (e.g. Singapore). Wait ~2 minutes for it to finish.
2. In the left menu open **SQL Editor** → **New query**.
3. Open the file `supabase-schema.sql` from this project, copy **all** of it, paste it into the editor, and click **Run**. You should see "Success". This creates the tables, security rules, live-sync, and one settings row.
4. Open **Authentication → Providers → Email** and make sure **Email** is enabled.
   - For a small private team, the easiest path is to turn **"Confirm email" OFF** (Authentication → Providers → Email) so new accounts work immediately without an email link.
5. Create your teammates' logins. Two options:
   - **Easiest:** Authentication → **Users** → **Add user** → enter each person's email + a temporary password. Do this for all four of you.
   - **Or** let people self-register from the app's "Create account" screen (see Step 5). If you use this, once everyone's in you can turn off open sign-ups: Authentication → **Sign In / Providers** → disable **"Allow new users to sign up"** so outsiders can't register.

## Step 2 — Copy your two keys

In Supabase open **Project Settings → API** and copy these two values (you'll paste them into Netlify in Step 4):

- **Project URL** → looks like `https://abcdxyz.supabase.co`
- **anon public** key (the long one labelled `anon` / `public`)

The `anon` key is safe to ship in a website — your data is still protected by the login rules from Step 1. (Never use the `service_role` key here.)

## Step 3 — Put the code on GitHub

1. Create a new **empty** repository on GitHub (e.g. `project-tracker`), private is fine.
2. Upload this whole project folder to it. If you're not comfortable with git, GitHub's website has **Add file → Upload files** — drag in everything **except** the `node_modules` folder (there isn't one yet, so just upload all the files you have here).

## Step 4 — Deploy on Netlify

1. Go to netlify.com → **Add new site → Import an existing project → GitHub**, and pick the repo you just created.
2. Netlify reads `netlify.toml` automatically, so the build settings should already be: **Build command** `npm run build`, **Publish directory** `dist`. Leave them.
3. Before the first deploy, open **Site configuration → Environment variables → Add a variable** and add these two (from Step 2):
   - `VITE_SUPABASE_URL` = your Project URL
   - `VITE_SUPABASE_ANON_KEY` = your anon public key
4. Click **Deploy**. In ~1 minute you'll get a live URL like `your-site.netlify.app`. You can rename it in **Site configuration → Change site name**, or add a custom domain later.

> If you added the env variables *after* the first deploy, trigger a fresh build: **Deploys → Trigger deploy → Deploy site** (the keys are read at build time).

## Step 5 — First sign-in

1. Open your Netlify URL. You'll see the sign-in screen.
2. Sign in with an account you created in Step 1 (or click **Create account** if you enabled self-registration).
3. Go to **Settings** and fill in your team member names (these feed the PIC / source / collaborator pickers), the company details, invoice city and signer. Save.
4. Start adding projects. Open the site on another device or have a teammate sign in — you'll see changes appear live on both. The little **Live** badge in the sidebar confirms sync is connected.

---

## Running it locally (optional, for testing)

You need Node.js 18+ installed.

```bash
cp .env.example .env      # then edit .env and paste your two keys
npm install
npm run dev               # opens http://localhost:5173
```

---

## How the privacy / security works

- The site is public, but the **data is not** — every read and write requires a valid login (enforced by Supabase Row Level Security from the schema).
- Any signed-in teammate can see and edit the whole shared workspace. That's the intended model for a small team.
- To control who can log in, manage accounts in **Supabase → Authentication → Users**, and keep public sign-ups disabled.
- Everyone shares one workspace; the "who am I" identity comes from the account you sign in with and is stamped on invoices you generate.

## Costs

Supabase and Netlify free tiers are comfortably enough for a 4-person tool. You may need to log into Supabase occasionally so the project isn't paused for inactivity (it emails you first).

## Troubleshooting

- **Blank page / "Missing VITE_SUPABASE…" in the browser console:** the env variables aren't set, or you didn't redeploy after adding them. Re-check Step 4.3 and trigger a new deploy.
- **Can sign in but no data loads / can't save:** make sure you ran the whole `supabase-schema.sql` (Step 1.3) and that the three policies were created.
- **Changes don't sync live between people:** confirm the `alter publication supabase_realtime add table …` lines ran (they're in the schema). You can re-run just those lines safely.
- **"Email not confirmed" on sign-in:** either confirm via the email link, or turn **Confirm email OFF** (Step 1.4) and recreate the user.

## What's in here

```
index.html            – app shell
netlify.toml          – Netlify build + SPA redirect
package.json          – dependencies
vite.config.js        – build tool config
supabase-schema.sql   – run once in Supabase
.env.example          – template for local keys
src/
  main.jsx            – entry point
  App.jsx             – the whole app (UI + logic)
  supabaseClient.js   – connects to your Supabase
  db.js               – reads/writes projects, invoices, settings
```
