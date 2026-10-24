-- Home carousel: choose the 5 highlighted titles (custom list or most watched).
-- Run once in Supabase SQL Editor. Creates a settings table and a statistics
-- function; no existing data is modified or deleted.
begin;

create table if not exists public.site_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.site_settings enable row level security;
grant select on public.site_settings to anon, authenticated;
grant insert, update, delete on public.site_settings to authenticated;

drop policy if exists site_settings_select on public.site_settings;
drop policy if exists site_settings_admin_insert on public.site_settings;
drop policy if exists site_settings_admin_update on public.site_settings;
drop policy if exists site_settings_admin_delete on public.site_settings;
create policy site_settings_select on public.site_settings for select to anon, authenticated using (true);
create policy site_settings_admin_insert on public.site_settings for insert to authenticated
  with check ((auth.jwt() ->> 'email') = 'lukas.leclerc312@gmail.com');
create policy site_settings_admin_update on public.site_settings for update to authenticated
  using ((auth.jwt() ->> 'email') = 'lukas.leclerc312@gmail.com')
  with check ((auth.jwt() ->> 'email') = 'lukas.leclerc312@gmail.com');
create policy site_settings_admin_delete on public.site_settings for delete to authenticated
  using ((auth.jwt() ->> 'email') = 'lukas.leclerc312@gmail.com');

-- Most watched titles: distinct accounts with a saved progression in the period.
-- Returns only totals per title, never who watched what.
create or replace function public.top_watched_media(days integer default 30, max_items integer default 5)
returns table (media_id text, viewers bigint, progressions bigint)
language sql stable security definer set search_path = '' as $$
  select h.media_id::text, count(distinct h.user_id), count(*)
  from public.watch_history h
  where h.media_id is not null
    and (days is null or days <= 0 or h.updated_at >= now() - make_interval(days => days))
  group by h.media_id
  order by count(distinct h.user_id) desc, count(*) desc
  limit least(greatest(coalesce(max_items, 5), 1), 20);
$$;
revoke all on function public.top_watched_media(integer, integer) from public;
grant execute on function public.top_watched_media(integer, integer) to anon, authenticated;

commit;
