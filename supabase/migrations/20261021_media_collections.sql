-- Creates only collection storage; existing catalogue, accounts and history are preserved.
begin;
create table if not exists public.media_collections (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(trim(title)) between 1 and 100),
  description text not null default '' check (char_length(description) <= 1000),
  cover_url text not null default '' check (cover_url = '' or cover_url ~ '^https?://'),
  media_ids text[] not null check (cardinality(media_ids) between 1 and 200 and array_position(media_ids, null) is null),
  active boolean not null default false,
  position integer not null default 0 check (position between 0 and 9999),
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now()
);
create unique index if not exists media_collections_unique_title on public.media_collections (lower(trim(title)));
create index if not exists media_collections_display_order on public.media_collections (position, created_at);
alter table public.media_collections enable row level security;
revoke all on public.media_collections from anon;
grant select, insert, update, delete on public.media_collections to authenticated;
drop policy if exists collections_read on public.media_collections;
create policy collections_read on public.media_collections for select to authenticated
  using (active or lower(coalesce(auth.jwt()->>'email', '')) = 'lukas.leclerc312@gmail.com');
drop policy if exists collections_admin_insert on public.media_collections;
create policy collections_admin_insert on public.media_collections for insert to authenticated
  with check (lower(coalesce(auth.jwt()->>'email', '')) = 'lukas.leclerc312@gmail.com' and created_by = auth.uid());
drop policy if exists collections_admin_update on public.media_collections;
create policy collections_admin_update on public.media_collections for update to authenticated
  using (lower(coalesce(auth.jwt()->>'email', '')) = 'lukas.leclerc312@gmail.com')
  with check (lower(coalesce(auth.jwt()->>'email', '')) = 'lukas.leclerc312@gmail.com');
drop policy if exists collections_admin_delete on public.media_collections;
create policy collections_admin_delete on public.media_collections for delete to authenticated
  using (lower(coalesce(auth.jwt()->>'email', '')) = 'lukas.leclerc312@gmail.com');
commit;
