-- Security: close the database to visitors and to members editing other accounts.
-- Run once in Supabase SQL Editor, AFTER deploying the site version that uses
-- increment_my_watch_count (members can no longer update their profile row directly).
-- Removes every existing policy on the tables below, then recreates strict ones.
begin;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from auth.users u where u.id = auth.uid() and u.email = 'lukas.leclerc312@gmail.com');
$$;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- Members consume a free viewing through this function only: they cannot
-- change is_vip, vip dates or reset their own counter.
create or replace function public.increment_my_watch_count(expected integer)
returns boolean language plpgsql security definer set search_path = '' as $$
declare changed integer;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  update public.profiles
    set watch_count = coalesce(watch_count, 0) + 1
    where id = auth.uid()
      and coalesce(is_vip, false) = false
      and coalesce(watch_count, 0) = expected
      and coalesce(watch_count, 0) < 5;
  get diagnostics changed = row_count;
  return changed = 1;
end;
$$;
revoke all on function public.increment_my_watch_count(integer) from public, anon;
grant execute on function public.increment_my_watch_count(integer) to authenticated;

do $$
declare t text; p record;
begin
  foreach t in array array['profiles','requests','comments','reports','watch_history','user_watched','user_profiles','user_presence','media','banners','promotions','media_collections'] loop
    if to_regclass('public.' || t) is null then continue; end if;
    for p in select policyname from pg_policies where schemaname = 'public' and tablename = t loop
      execute format('drop policy %I on public.%I', p.policyname, t);
    end loop;
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);
  end loop;
end $$;

-- Accounts: each member reads only their own row; only the admin edits.
create policy profiles_select on public.profiles for select to authenticated using (id = auth.uid() or public.is_admin());
create policy profiles_insert on public.profiles for insert to authenticated with check (id = auth.uid() and coalesce(is_vip, false) = false and vip_started_at is null);
create policy profiles_admin_update on public.profiles for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy profiles_admin_delete on public.profiles for delete to authenticated using (public.is_admin());

-- Personal data: owner only (admin may read for statistics).
do $$
declare t text;
begin
  foreach t in array array['watch_history','user_watched','user_profiles','user_presence'] loop
    if to_regclass('public.' || t) is null then continue; end if;
    execute format('create policy %I on public.%I for select to authenticated using (user_id = auth.uid() or public.is_admin())', t || '_select', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (user_id = auth.uid())', t || '_insert', t);
    execute format('create policy %I on public.%I for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())', t || '_update', t);
    execute format('create policy %I on public.%I for delete to authenticated using (user_id = auth.uid() or public.is_admin())', t || '_delete', t);
  end loop;
end $$;

-- Community requests and comments: visible to members, written by their author.
create policy requests_select on public.requests for select to authenticated using (true);
create policy requests_insert on public.requests for insert to authenticated with check (user_id = auth.uid());
create policy requests_admin_update on public.requests for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy requests_delete on public.requests for delete to authenticated using (user_id = auth.uid() or public.is_admin());

create policy comments_select on public.comments for select to authenticated using (true);
create policy comments_insert on public.comments for insert to authenticated with check (user_id = auth.uid());
create policy comments_delete on public.comments for delete to authenticated using (user_id = auth.uid() or public.is_admin());

-- Problem reports: the author and the admin only.
do $$
begin
  if to_regclass('public.reports') is null then return; end if;
  create policy reports_select on public.reports for select to authenticated using (user_id = auth.uid() or public.is_admin());
  create policy reports_insert on public.reports for insert to authenticated with check (user_id = auth.uid());
  create policy reports_admin_update on public.reports for update to authenticated using (public.is_admin()) with check (public.is_admin());
  create policy reports_delete on public.reports for delete to authenticated using (user_id = auth.uid() or public.is_admin());
end $$;

-- Catalogue and promotions: readable by everyone, edited by the admin only.
do $$
declare t text;
begin
  foreach t in array array['media','banners','promotions','media_collections'] loop
    if to_regclass('public.' || t) is null then continue; end if;
    execute format('grant select on public.%I to anon', t);
    execute format('create policy %I on public.%I for select to anon, authenticated using (true)', t || '_select', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (public.is_admin())', t || '_admin_insert', t);
    execute format('create policy %I on public.%I for update to authenticated using (public.is_admin()) with check (public.is_admin())', t || '_admin_update', t);
    execute format('create policy %I on public.%I for delete to authenticated using (public.is_admin())', t || '_admin_delete', t);
  end loop;
end $$;

commit;
