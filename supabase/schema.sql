-- Forge System OS — backend schema (run once in Supabase SQL editor).
-- One row per user holding the entire AppState blob. Last-write-wins.

create extension if not exists pgcrypto;

create table if not exists public.forge_state (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  state       jsonb not null,
  updated_at  timestamptz not null default now()
);

alter table public.forge_state enable row level security;

-- A user may only read/write their own row. RLS — not key secrecy — is what
-- protects the data, which is why the anon key is safe to ship in the app.
drop policy if exists "own row select" on public.forge_state;
drop policy if exists "own row insert" on public.forge_state;
drop policy if exists "own row update" on public.forge_state;

create policy "own row select" on public.forge_state
  for select using (auth.uid() = user_id);
create policy "own row insert" on public.forge_state
  for insert with check (auth.uid() = user_id);
create policy "own row update" on public.forge_state
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Community progress feed. This is intentionally separate from forge_state:
-- users explicitly share a small progress post; private journal/evidence stays
-- private unless the user copies it into the post text themselves.

create table if not exists public.community_posts (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  display_name text not null default 'Forge user',
  content      text not null check (char_length(content) between 1 and 700),
  quest_title  text,
  quest_domain text,
  outcome_type text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table if not exists public.community_comments (
  id           uuid primary key default gen_random_uuid(),
  post_id      uuid not null references public.community_posts(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  display_name text not null default 'Forge user',
  content      text not null check (char_length(content) between 1 and 320),
  created_at   timestamptz not null default now()
);

create table if not exists public.community_reactions (
  post_id    uuid not null references public.community_posts(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table if not exists public.community_reports (
  id          uuid primary key default gen_random_uuid(),
  post_id     uuid not null references public.community_posts(id) on delete cascade,
  reporter_id uuid not null references auth.users(id) on delete cascade,
  reason      text not null default 'reported',
  created_at  timestamptz not null default now(),
  unique (post_id, reporter_id)
);

alter table public.community_posts enable row level security;
alter table public.community_comments enable row level security;
alter table public.community_reactions enable row level security;
alter table public.community_reports enable row level security;

drop policy if exists "signed in can read posts" on public.community_posts;
drop policy if exists "own post insert" on public.community_posts;
drop policy if exists "own post update" on public.community_posts;
drop policy if exists "own post delete" on public.community_posts;
drop policy if exists "signed in can read comments" on public.community_comments;
drop policy if exists "own comment insert" on public.community_comments;
drop policy if exists "own comment delete" on public.community_comments;
drop policy if exists "signed in can read reactions" on public.community_reactions;
drop policy if exists "own reaction insert" on public.community_reactions;
drop policy if exists "own reaction delete" on public.community_reactions;
drop policy if exists "own report insert" on public.community_reports;

create policy "signed in can read posts" on public.community_posts
  for select using (auth.role() = 'authenticated');
create policy "own post insert" on public.community_posts
  for insert with check (auth.uid() = user_id);
create policy "own post update" on public.community_posts
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own post delete" on public.community_posts
  for delete using (auth.uid() = user_id);

create policy "signed in can read comments" on public.community_comments
  for select using (auth.role() = 'authenticated');
create policy "own comment insert" on public.community_comments
  for insert with check (auth.uid() = user_id);
create policy "own comment delete" on public.community_comments
  for delete using (auth.uid() = user_id);

create policy "signed in can read reactions" on public.community_reactions
  for select using (auth.role() = 'authenticated');
create policy "own reaction insert" on public.community_reactions
  for insert with check (auth.uid() = user_id);
create policy "own reaction delete" on public.community_reactions
  for delete using (auth.uid() = user_id);

create policy "own report insert" on public.community_reports
  for insert with check (auth.uid() = reporter_id);
