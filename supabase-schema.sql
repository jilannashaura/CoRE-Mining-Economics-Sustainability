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

-- ---------- row level security ----------
-- Any signed-in team member can read & write the shared workspace.
-- (Data is NOT public — a valid login is required.)
alter table public.settings enable row level security;
alter table public.projects enable row level security;
alter table public.invoices enable row level security;

drop policy if exists "authenticated all" on public.settings;
drop policy if exists "authenticated all" on public.projects;
drop policy if exists "authenticated all" on public.invoices;

create policy "authenticated all" on public.settings
  for all to authenticated using (true) with check (true);
create policy "authenticated all" on public.projects
  for all to authenticated using (true) with check (true);
create policy "authenticated all" on public.invoices
  for all to authenticated using (true) with check (true);

-- ---------- realtime (live sync between teammates) ----------
alter publication supabase_realtime add table public.settings;
alter publication supabase_realtime add table public.projects;
alter publication supabase_realtime add table public.invoices;

-- ---------- seed the single settings row ----------
insert into public.settings (id, company, members)
values (
  'main',
  '{"name":"Unit Cost Research Team","address":"","email":"","currency":"Rp","city":"Bandung","signer":"Firly Rachmaditya Baskoro"}'::jsonb,
  '["Firly Rachmaditya Baskoro"]'::jsonb
)
on conflict (id) do nothing;
