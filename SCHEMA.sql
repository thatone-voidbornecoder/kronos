-- ════════════════════════════════════════════
-- KRONOS — Supabase Schema
-- Run this entire file in Supabase > SQL Editor
-- ════════════════════════════════════════════

-- Profiles (auto-created on signup)
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text,
  created_at timestamptz default now()
);

-- Timetables (one row per user per day)
create table if not exists timetables (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  day text not null check (day in ('Mon','Tue','Wed','Thu','Fri')),
  periods jsonb default '[]',
  updated_at timestamptz default now(),
  unique (user_id, day)
);

-- Todos
create table if not exists todos (
  id bigint primary key generated always as identity,
  user_id uuid references auth.users(id) on delete cascade not null,
  text text not null,
  done boolean default false,
  due date,
  created_at timestamptz default now()
);

-- Grades (one row per user, entire grade blob stored as jsonb)
create table if not exists grades (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  data jsonb default '{}',
  updated_at timestamptz default now(),
  unique (user_id)
);

-- ════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- Users can only see/edit their own data
-- ════════════════════════════════════════════

alter table profiles  enable row level security;
alter table timetables enable row level security;
alter table todos      enable row level security;
alter table grades     enable row level security;

-- Profiles
create policy "profiles: own" on profiles
  for all using (auth.uid() = id);

-- Timetables
create policy "timetables: own" on timetables
  for all using (auth.uid() = user_id);

-- Todos
create policy "todos: own" on todos
  for all using (auth.uid() = user_id);

-- Grades
create policy "grades: own" on grades
  for all using (auth.uid() = user_id);

-- ════════════════════════════════════════════
-- Auto-update timestamps
-- ════════════════════════════════════════════

create or replace function update_updated_at()
returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

create trigger timetables_updated_at before update on timetables
  for each row execute function update_updated_at();

create trigger grades_updated_at before update on grades
  for each row execute function update_updated_at();
