-- ============================================================
--  Project Tracker — Supabase schema
--  Safe to re-run: paste the whole file into Supabase → SQL Editor → New query → Run.
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
alter table public.projects add column if not exists sub_status text default '';
alter table public.projects add column if not exists priority text default 'Moderate';
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

-- ---------- team access (access code + admin password, checked on the server) ----------
-- Codes are stored bcrypt-hashed in a table no client can read.
set search_path = public, extensions;

create table if not exists public.team_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text,
  name text,
  joined_at timestamptz not null default now()
);

create table if not exists public.app_secrets (
  key text primary key,
  hash text not null
);
alter table public.app_secrets enable row level security;   -- no policies => invisible to the app
revoke all on public.app_secrets from anon, authenticated;

insert into public.app_secrets (key, hash) values
  ('access', crypt('CoreMEM2026', gen_salt('bf'))),
  ('admin',  crypt('AdminMEM2026', gen_salt('bf')))
on conflict (key) do nothing;

create or replace function public.is_member() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.team_members where user_id = auth.uid());
$$;

create or replace function public.verify_access_code(code text) returns boolean
language sql stable security definer set search_path = public, extensions as $$
  select exists (select 1 from public.app_secrets s where s.key = 'access' and s.hash = crypt(code, s.hash));
$$;

create or replace function public.join_team(code text) returns boolean
language plpgsql security definer set search_path = public, extensions as $$
declare u record;
begin
  if auth.uid() is null then return false; end if;
  if not public.verify_access_code(code) then return false; end if;
  select id, email, raw_user_meta_data into u from auth.users where id = auth.uid();
  insert into public.team_members (user_id, email, name)
  values (u.id, u.email, coalesce(nullif(u.raw_user_meta_data->>'full_name', ''), u.email))
  on conflict (user_id) do update set email = excluded.email, name = excluded.name;
  return true;
end $$;

create or replace function public.check_admin(code text) returns boolean
language sql stable security definer set search_path = public, extensions as $$
  select public.is_member()
     and exists (select 1 from public.app_secrets s where s.key = 'admin' and s.hash = crypt(code, s.hash));
$$;

revoke all on function public.verify_access_code(text) from public;
revoke all on function public.join_team(text) from public;
revoke all on function public.check_admin(text) from public;
grant execute on function public.verify_access_code(text) to anon, authenticated;
grant execute on function public.join_team(text) to authenticated;
grant execute on function public.check_admin(text) to authenticated;
grant execute on function public.is_member() to authenticated;

-- ---------- row level security ----------
-- Only signed-in users who have entered the access code (team_members) can read & write.
do $$
declare t text;
begin
  foreach t in array array['settings','projects','invoices','announcements','notifications','transactions','reports'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "authenticated all" on public.%I', t);
    execute format('drop policy if exists "members all" on public.%I', t);
    execute format('create policy "members all" on public.%I for all to authenticated using (public.is_member()) with check (public.is_member())', t);
  end loop;
end $$;

alter table public.team_members enable row level security;
drop policy if exists "members read" on public.team_members;
create policy "members read" on public.team_members for select to authenticated using (public.is_member());

-- ---------- realtime (live sync between teammates) ----------
do $$
declare t text;
begin
  foreach t in array array['settings','projects','invoices','announcements','notifications','transactions','reports','team_members'] loop
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
