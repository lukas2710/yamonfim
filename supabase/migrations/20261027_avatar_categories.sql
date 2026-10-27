-- Stores named categories independently of avatar images.
-- Existing avatars, profiles and other tables are not modified.
begin;
create table if not exists public.avatar_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 60 and name = trim(name)),
  created_at timestamptz not null default now()
);
create unique index if not exists avatar_categories_unique_name on public.avatar_categories (lower(name));
alter table public.avatar_categories enable row level security;
grant select on public.avatar_categories to anon, authenticated;
grant insert, update, delete on public.avatar_categories to authenticated;
drop policy if exists avatar_categories_read on public.avatar_categories;
drop policy if exists avatar_categories_admin on public.avatar_categories;
create policy avatar_categories_read on public.avatar_categories for select using (true);
create policy avatar_categories_admin on public.avatar_categories for all to authenticated
  using ((auth.jwt() ->> 'email') = 'lukas.leclerc312@gmail.com')
  with check ((auth.jwt() ->> 'email') = 'lukas.leclerc312@gmail.com');
commit;
