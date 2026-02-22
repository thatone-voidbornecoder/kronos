-- ════════════════════════════════════════════
-- KRONOS — Supabase Schema
-- Run this entire file in Supabase > SQL Editor
-- Safe to re-run: uses IF NOT EXISTS + DROP IF EXISTS
-- ════════════════════════════════════════════

-- ────────────────────────────────────────────
-- PROFILES
-- user_id (not id) so app upserts work correctly
-- ────────────────────────────────────────────
create table if not exists profiles (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  name         text,
  display_name text,
  username     text unique,
  programme    text default 'DP' check (programme in ('MYP','DP','CP')),
  created_at   timestamptz default now()
);

-- ────────────────────────────────────────────
-- TIMETABLES
-- day column has NO check constraint so it accepts
-- both legacy keys ('Mon') and W1/W2 keys ('Mon_W1')
-- ────────────────────────────────────────────
create table if not exists timetables (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users(id) on delete cascade not null,
  day        text not null,
  periods    jsonb default '[]',
  updated_at timestamptz default now(),
  unique (user_id, day)
);

-- ────────────────────────────────────────────
-- TODOS
-- ────────────────────────────────────────────
create table if not exists todos (
  id         bigint primary key generated always as identity,
  user_id    uuid references auth.users(id) on delete cascade not null,
  text       text not null,
  done       boolean default false,
  due        date,
  created_at timestamptz default now()
);

-- ────────────────────────────────────────────
-- GRADES
-- ────────────────────────────────────────────
create table if not exists grades (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users(id) on delete cascade not null,
  data       jsonb default '{}',
  updated_at timestamptz default now(),
  unique (user_id)
);

-- ────────────────────────────────────────────
-- FRIENDSHIPS
-- ────────────────────────────────────────────
create table if not exists friendships (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users(id) on delete cascade,
  friend_id  uuid references auth.users(id) on delete cascade,
  status     text default 'accepted',
  created_at timestamptz default now(),
  unique (user_id, friend_id)
);

-- ════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- ════════════════════════════════════════════

alter table profiles    enable row level security;
alter table timetables  enable row level security;
alter table todos       enable row level security;
alter table grades      enable row level security;
alter table friendships enable row level security;

-- Profiles: users can read all (for username search),
-- but only write their own row
drop policy if exists "profiles: own"        on profiles;
drop policy if exists "profiles: public read" on profiles;
create policy "profiles: own" on profiles
  for all using (auth.uid() = user_id);
create policy "profiles: public read" on profiles
  for select using (true);

-- Timetables
drop policy if exists "timetables: own" on timetables;
create policy "timetables: own" on timetables
  for all using (auth.uid() = user_id);

-- Todos
drop policy if exists "todos: own" on todos;
create policy "todos: own" on todos
  for all using (auth.uid() = user_id);

-- Grades
drop policy if exists "grades: own" on grades;
create policy "grades: own" on grades
  for all using (auth.uid() = user_id);

-- Friendships
drop policy if exists "friendships: own" on friendships;
create policy "friendships: own" on friendships
  for all using (auth.uid() = user_id or auth.uid() = friend_id);

-- ════════════════════════════════════════════
-- AUTO-UPDATE TIMESTAMPS
-- ════════════════════════════════════════════

create or replace function update_updated_at()
returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

drop trigger if exists timetables_updated_at on timetables;
create trigger timetables_updated_at before update on timetables
  for each row execute function update_updated_at();

drop trigger if exists grades_updated_at on grades;
create trigger grades_updated_at before update on grades
  for each row execute function update_updated_at();

-- ════════════════════════════════════════════
-- MIGRATIONS (safe to run on existing DB)
-- Adds columns/fixes that didn't exist in v1
-- ════════════════════════════════════════════

-- profiles: add user_id if table was created with old 'id' column
do $$ begin
  if not exists (
    select 1 from information_schema.columns
    where table_name='profiles' and column_name='user_id'
  ) then
    alter table profiles add column user_id uuid references auth.users(id) on delete cascade;
    update profiles set user_id = id where user_id is null;
    create unique index if not exists profiles_user_id_idx on profiles(user_id);
  end if;
end $$;

-- profiles: add new columns if missing
alter table profiles add column if not exists username     text unique;
alter table profiles add column if not exists display_name text;
alter table profiles add column if not exists programme    text default 'DP' check (programme in ('MYP','DP','CP'));

-- timetables: drop old day check constraint so W1/W2 keys work
alter table timetables drop constraint if exists timetables_day_check;
