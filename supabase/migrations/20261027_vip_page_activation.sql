-- Intentional free VIP: visiting /vip grants the signed-in account one year.
-- Existing RLS policies stay unchanged. No account ID can be supplied.
begin;

create or replace function public.activate_my_vip()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  member_id uuid := auth.uid();
  changed integer;
begin
  if member_id is null then
    raise exception 'Connexion requise' using errcode = '42501';
  end if;

  update public.profiles
    set is_vip = true,
        vip_started_at = now(),
        vip_duration = '1y'
    where id = member_id;
  get diagnostics changed = row_count;
  if changed <> 1 then
    raise exception 'Compte introuvable' using errcode = 'P0002';
  end if;
  return true;
end;
$$;

revoke all on function public.activate_my_vip() from public, anon, authenticated;
grant execute on function public.activate_my_vip() to authenticated;

commit;
