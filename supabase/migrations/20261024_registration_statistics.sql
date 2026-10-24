-- Run in Supabase SQL Editor. Read-only statistics: no account is modified.
begin;

create or replace function public.admin_registration_statistics()
returns table (registration_date date, registrations bigint)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if auth.uid() is null or not exists (
    select 1 from auth.users u
    where u.id = auth.uid() and u.email = 'lukas.leclerc312@gmail.com'
  ) then
    raise exception 'Accès administrateur requis' using errcode = '42501';
  end if;
  return query
    select (u.created_at at time zone 'Europe/Paris')::date, count(*)
    from auth.users u
    where u.created_at is not null and u.created_at <= now()
    group by 1 order by 1;
end;
$$;

revoke all on function public.admin_registration_statistics() from public, anon;
grant execute on function public.admin_registration_statistics() to authenticated;
commit;
