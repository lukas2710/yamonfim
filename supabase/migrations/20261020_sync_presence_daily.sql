-- Run after 20261020_daily_activity.sql, including on an existing installation.
-- Capture presence from older clients which do not call record_daily_presence.
begin;

create or replace function public.capture_daily_presence()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Authenticated clients may only record their own account.
  if auth.uid() is null or new.user_id::text <> auth.uid()::text then
    return new;
  end if;

  insert into public.user_daily_activity (user_id, activity_date, last_seen)
  select u.id, (now() at time zone 'Europe/Paris')::date, now()
  from auth.users u where u.id::text = new.user_id::text
  on conflict (activity_date, user_id) do update
    set last_seen = greatest(public.user_daily_activity.last_seen, excluded.last_seen);
  return new;
end;
$$;
revoke all on function public.capture_daily_presence() from public, anon, authenticated;

drop trigger if exists capture_daily_presence on public.user_presence;
create trigger capture_daily_presence
  after insert or update of last_seen on public.user_presence
  for each row execute function public.capture_daily_presence();

-- Recover all known accounts already seen today, without duplicate rows.
-- Earlier dates remain in the separate, explicitly incomplete recovery report.
insert into public.user_daily_activity (user_id, activity_date, last_seen)
select u.id, (now() at time zone 'Europe/Paris')::date,
       max(least(p.last_seen, now()))
from public.user_presence p
join auth.users u on u.id::text = p.user_id::text
where p.last_seen >= ((now() at time zone 'Europe/Paris')::date::timestamp at time zone 'Europe/Paris')
  and p.last_seen <= now() + interval '1 minute'
group by u.id
on conflict (activity_date, user_id) do update
  set last_seen = greatest(public.user_daily_activity.last_seen, excluded.last_seen);

commit;
