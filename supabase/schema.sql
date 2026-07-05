-- Momentum Supabase MVP schema.
-- Prototype only: RLS is disabled for the simplest Phase 1.5 User ID flow.
-- Do not use these public write permissions for production.

create extension if not exists pgcrypto;

create table if not exists profiles (
  id uuid primary key default gen_random_uuid(),
  user_id text unique not null,
  display_name text,
  created_at timestamptz default now()
);

create table if not exists daily_entries (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  entry_date date not null,
  data jsonb not null,
  updated_at timestamptz default now(),
  unique(user_id, entry_date)
);

create table if not exists journal_entries (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  entry_date date not null,
  content text,
  mood numeric,
  tags text[],
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists job_applications (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  company text,
  role text,
  status text,
  notes text,
  applied_date date,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists profiles_user_id_idx
  on profiles(user_id);

create index if not exists daily_entries_user_id_entry_date_idx
  on daily_entries(user_id, entry_date);

create index if not exists journal_entries_user_id_entry_date_idx
  on journal_entries(user_id, entry_date);

create index if not exists job_applications_user_id_created_at_idx
  on job_applications(user_id, created_at);

alter table profiles disable row level security;
alter table daily_entries disable row level security;
alter table journal_entries disable row level security;
alter table job_applications disable row level security;
