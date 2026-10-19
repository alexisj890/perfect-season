-- Saved runs for signed-in players. Run once in the Supabase SQL Editor
-- (docs/supabase-setup.md, step A6). Each later change gets a new, dated file.

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
