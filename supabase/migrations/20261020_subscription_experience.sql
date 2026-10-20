-- Weekly free quota and real member reviews. Run once in Supabase SQL Editor.
begin;

create or replace function public.next_free_watch_reset(reference_time timestamptz default now())
returns timestamptz language sql stable set search_path = '' as $$
  select (
    date_trunc('day', reference_time at time zone 'Europe/Paris')
    + (case when extract(dow from reference_time at time zone 'Europe/Paris')::int = 0
            then 7 else 7 - extract(dow from reference_time at time zone 'Europe/Paris')::int end) * interval '1 day'
  ) at time zone 'Europe/Paris';
$$;
alter table public.profiles add column if not exists watch_reset_at timestamptz
  not null default public.next_free_watch_reset(now());

-- Direct client edits cannot move the server-managed reset deadline.
create or replace function public.protect_watch_reset_deadline()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if current_user in ('anon', 'authenticated') then
    if tg_op = 'INSERT' then new.watch_reset_at = public.next_free_watch_reset(now());
    else new.watch_reset_at = old.watch_reset_at;
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists protect_watch_reset_deadline on public.profiles;
create trigger protect_watch_reset_deadline before insert or update on public.profiles
  for each row execute function public.protect_watch_reset_deadline();

create or replace function public.get_my_subscription_status()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare member public.profiles%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select p.* into member from public.profiles p where p.id = auth.uid() for update;
  if not found then raise exception 'Profile not found'; end if;
  if member.watch_reset_at <= now() then
    update public.profiles
      set watch_count = case when coalesce(is_vip, false) then watch_count else 0 end,
          watch_reset_at = public.next_free_watch_reset(now())
      where id = auth.uid() returning * into member;
  end if;
  return to_jsonb(member);
end;
$$;
revoke all on function public.get_my_subscription_status() from public, anon;
grant execute on function public.get_my_subscription_status() to authenticated;

create table if not exists public.site_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  display_name text not null check (char_length(trim(display_name)) between 2 and 50),
  rating smallint not null check (rating between 1 and 5),
  comment text not null check (char_length(trim(comment)) between 10 and 1000),
  created_at timestamptz not null default now()
);
alter table public.site_reviews enable row level security;
revoke all on public.site_reviews from anon, authenticated;
grant select, insert, update on public.site_reviews to authenticated;
drop policy if exists site_reviews_read on public.site_reviews;
create policy site_reviews_read on public.site_reviews for select to authenticated using (true);
drop policy if exists site_reviews_insert on public.site_reviews;
create policy site_reviews_insert on public.site_reviews for insert to authenticated
  with check (user_id = (select auth.uid()));
drop policy if exists site_reviews_update on public.site_reviews;
create policy site_reviews_update on public.site_reviews for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

commit;
