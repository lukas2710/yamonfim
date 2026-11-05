-- Favoris et « À regarder plus tard », par profil. Chaque membre ne voit et ne
-- modifie que ses propres listes.
begin;
create table if not exists public.user_lists (
  user_id uuid not null references auth.users (id) on delete cascade,
  profile_id text not null,
  media_id text not null,
  list text not null check (list in ('favorite', 'later')),
  created_at timestamptz not null default now(),
  primary key (user_id, profile_id, media_id, list)
);
create index if not exists user_lists_profile_recent on public.user_lists (user_id, profile_id, created_at desc);
alter table public.user_lists enable row level security;
revoke all on public.user_lists from anon;
grant select, insert, delete on public.user_lists to authenticated;
drop policy if exists user_lists_select on public.user_lists;
drop policy if exists user_lists_insert on public.user_lists;
drop policy if exists user_lists_delete on public.user_lists;
create policy user_lists_select on public.user_lists for select to authenticated using (user_id = auth.uid());
create policy user_lists_insert on public.user_lists for insert to authenticated with check (user_id = auth.uid());
create policy user_lists_delete on public.user_lists for delete to authenticated using (user_id = auth.uid());
commit;
