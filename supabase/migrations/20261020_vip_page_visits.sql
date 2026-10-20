-- Tracks visits independently from VIP entitlement. Does not grant VIP access.
begin;
create table if not exists public.vip_page_visits (
  user_id uuid primary key references auth.users(id) on delete cascade,
  first_visited_at timestamptz not null default now(),
  last_visited_at timestamptz not null default now()
);
alter table public.vip_page_visits enable row level security;
revoke all on public.vip_page_visits from anon, authenticated;
grant select on public.vip_page_visits to authenticated;
drop policy if exists vip_page_visits_read on public.vip_page_visits;
create policy vip_page_visits_read on public.vip_page_visits
for select to authenticated using (
  user_id = (select auth.uid())
  or (select auth.jwt() ->> 'email') = 'lukas.leclerc312@gmail.com'
);
create or replace function public.record_vip_page_visit()
returns void language sql security definer set search_path = '' as $$
  insert into public.vip_page_visits (user_id, first_visited_at, last_visited_at)
  select auth.uid(), now(), now() where auth.uid() is not null
  on conflict (user_id) do update set last_visited_at = excluded.last_visited_at;
$$;
revoke all on function public.record_vip_page_visit() from public, anon;
grant execute on function public.record_vip_page_visit() to authenticated;
commit;
