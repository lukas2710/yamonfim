-- Run once in the Supabase SQL editor. Does not reconstruct past visits.
begin;

create table if not exists public.user_daily_activity (
  user_id uuid not null references auth.users(id) on delete cascade,
  activity_date date not null,
  last_seen timestamptz not null default now(),
  primary key (activity_date, user_id)
);
create index if not exists user_daily_activity_user_date_idx
  on public.user_daily_activity (user_id, activity_date);

alter table public.user_daily_activity enable row level security;
revoke all on public.user_daily_activity from anon, authenticated;
grant select, insert, update on public.user_daily_activity to authenticated;

drop policy if exists daily_activity_read on public.user_daily_activity;
create policy daily_activity_read on public.user_daily_activity
  for select to authenticated using (
    user_id = (select auth.uid())
    or (select auth.jwt() ->> 'email') = 'lukas.leclerc312@gmail.com'
  );
drop policy if exists daily_activity_insert on public.user_daily_activity;
create policy daily_activity_insert on public.user_daily_activity
  for insert to authenticated with check (
    user_id = (select auth.uid())
    and activity_date = (now() at time zone 'Europe/Paris')::date
    and last_seen = now()
  );
drop policy if exists daily_activity_update on public.user_daily_activity;
create policy daily_activity_update on public.user_daily_activity
  for update to authenticated using (
    user_id = (select auth.uid())
    and activity_date = (now() at time zone 'Europe/Paris')::date
  ) with check (
    user_id = (select auth.uid())
    and activity_date = (now() at time zone 'Europe/Paris')::date
    and last_seen = now()
  );

-- Server determines identity, date and time, and deduplicates multiple tabs.
create or replace function public.record_daily_presence()
returns void language sql security invoker set search_path = '' as $$
  insert into public.user_daily_activity (user_id, activity_date, last_seen)
  values (auth.uid(), (now() at time zone 'Europe/Paris')::date, now())
  on conflict (activity_date, user_id) do update set last_seen = excluded.last_seen;
$$;
revoke all on function public.record_daily_presence() from public, anon;
grant execute on function public.record_daily_presence() to authenticated;

commit;
