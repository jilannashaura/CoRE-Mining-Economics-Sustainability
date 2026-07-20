-- ============================================================
--  Project Tracker — Supabase schema
--  Run this ONCE in Supabase → SQL Editor → New query → Run.
-- ============================================================

create extension if not exists pgcrypto;

-- ---------- tables ----------
create table if not exists public.settings (
  id text primary key default 'main',
  company jsonb not null default '{}'::jsonb,
  members jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  client text default '',
  category text default 'Project',
  status text default 'Prospect',
  source text default '',
  pic text default '',
  collaborators jsonb default '[]'::jsonb,
  description text default '',
  data_room text default '',
  kickoff date,
  wrapup date,
  milestones jsonb default '[]'::jsonb,
  checklist jsonb default '[]'::jsonb,
  archived boolean default false,
  archived_at date,
  finished_at date,
  created_by text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  number text not null,
  date date not null,
  generated_by text default '',
  created_at timestamptz not null default now()
);

-- ---------- migrations (safe to re-run on an existing database) ----------
alter table public.projects add column if not exists archived boolean default false;
alter table public.projects add column if not exists archived_at date;
alter table public.projects add column if not exists finished_at date;

create table if not exists public.announcements (
  id uuid primary key,
  author text default '',
  text text default '',
  created_at timestamptz default now(),
  expires_at timestamptz,
  tags jsonb default '[]'::jsonb,
  edited_at timestamptz,
  comments jsonb default '[]'::jsonb
);
alter table public.announcements add column if not exists edited_at timestamptz;
alter table public.announcements add column if not exists comments jsonb default '[]'::jsonb;

create table if not exists public.notifications (
  id uuid primary key,
  to_member text default '',
  type text default '',
  text text default '',
  project_id uuid,
  created_at timestamptz default now()
);

create table if not exists public.transactions (
  id uuid primary key,
  date date,
  project_id uuid,
  description text default '',
  type text default 'Expense',
  category text default '',
  work_category text default '',
  amount numeric default 0,
  account text default '',
  account_other text default '',
  method text default '',
  receipt jsonb,
  created_by text default '',
  created_at timestamptz default now()
);

create table if not exists public.reports (
  id uuid primary key,
  type text,
  start_date date,
  end_date date,
  generated_by text default '',
  generated_at timestamptz default now(),
  snapshot jsonb default '{}'::jsonb
);

-- ---------- row level security ----------
-- Any signed-in team member can read & write the shared workspace.
-- (Data is NOT public — a valid login is required.)
alter table public.settings enable row level security;
alter table public.projects enable row level security;
alter table public.invoices enable row level security;
alter table public.announcements enable row level security;
alter table public.notifications enable row level security;
alter table public.transactions enable row level security;
alter table public.reports enable row level security;

drop policy if exists "authenticated all" on public.settings;
drop policy if exists "authenticated all" on public.projects;
drop policy if exists "authenticated all" on public.invoices;
drop policy if exists "authenticated all" on public.announcements;
drop policy if exists "authenticated all" on public.notifications;
drop policy if exists "authenticated all" on public.transactions;
drop policy if exists "authenticated all" on public.reports;

create policy "authenticated all" on public.settings
  for all to authenticated using (true) with check (true);
create policy "authenticated all" on public.projects
  for all to authenticated using (true) with check (true);
create policy "authenticated all" on public.invoices
  for all to authenticated using (true) with check (true);
create policy "authenticated all" on public.announcements
  for all to authenticated using (true) with check (true);
create policy "authenticated all" on public.notifications
  for all to authenticated using (true) with check (true);
create policy "authenticated all" on public.transactions
  for all to authenticated using (true) with check (true);
create policy "authenticated all" on public.reports
  for all to authenticated using (true) with check (true);

-- ---------- realtime (live sync between teammates) ----------
do $$
declare t text;
begin
  foreach t in array array['settings','projects','invoices','announcements','notifications','transactions','reports'] loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;

-- ---------- seed the single settings row ----------
insert into public.settings (id, company, members)
values (
  'main',
  '{"name":"Unit Cost Research Team","address":"","email":"","currency":"Rp","city":"Bandung","signer":"Firly Rachmaditya Baskoro"}'::jsonb,
  '["Firly Rachmaditya Baskoro"]'::jsonb
)
on conflict (id) do nothing;
