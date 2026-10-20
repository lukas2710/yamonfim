-- Run in Supabase SQL Editor. Existing rows are preserved.
begin;

create or replace function public.yf_content_title(value text)
returns text language sql immutable parallel safe set search_path = '' as $$
  select trim(regexp_replace(
    replace(replace(lower(regexp_replace(
      normalize(regexp_replace(trim(coalesce(value, '')), '\s*\((18|19|20|21)[0-9]{2}\)\s*$', ''), NFKD),
      U&'[\0300-\036f]', '', 'g')), 'œ', 'oe'), 'æ', 'ae'),
    '[^[:alnum:]]+', ' ', 'g'));
$$;

create or replace function public.yf_tmdb_id(value text)
returns text language sql immutable parallel safe set search_path = '' as $$
  select case when trim(coalesce(value, '')) ~ '^[0-9]+$'
    then ltrim(trim(value), '0') else '' end;
$$;

create or replace function public.yf_same_content(a_title text, a_type text, a_tmdb text, b_title text, b_type text, b_tmdb text)
returns boolean language sql immutable parallel safe set search_path = '' as $$
  select coalesce(a_type = b_type, false) and case
    when public.yf_tmdb_id(a_tmdb) <> '' and public.yf_tmdb_id(b_tmdb) <> ''
      then public.yf_tmdb_id(a_tmdb) = public.yf_tmdb_id(b_tmdb)
    else public.yf_content_title(a_title) <> '' and public.yf_content_title(a_title) = public.yf_content_title(b_title)
  end;
$$;

create or replace function public.yf_guard_content_duplicates()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_table_name = 'requests' then
    if new.status = 'refuse' then return new; end if;
    if tg_op = 'UPDATE' then
      if new.title is not distinct from old.title and new.type is not distinct from old.type
        and new.tmdb_id is not distinct from old.tmdb_id and old.status is distinct from 'refuse'
      then return new; end if;
    end if;
  elsif tg_op = 'UPDATE' then
    if new.title is not distinct from old.title and new.type is not distinct from old.type
      and new.tmdb_id is not distinct from old.tmdb_id then return new; end if;
  end if;

  -- Serialize catalogue and request checks for the same type, including concurrent tabs.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('yf-content:' || coalesce(new.type::text, ''), 0));

  if exists (
    select 1 from public.media m
    where (tg_table_name <> 'media' or m.id::text is distinct from new.id::text)
      and public.yf_same_content(new.title, new.type::text, new.tmdb_id::text, m.title, m.type::text, m.tmdb_id::text)
  ) then
    raise exception using errcode = '23505', message = 'YF_DUPLICATE_MEDIA: ce titre est déjà disponible dans le catalogue.';
  end if;

  if tg_table_name = 'requests' and exists (
    select 1 from public.requests r
    where r.id::text is distinct from new.id::text and r.status is distinct from 'refuse'
      and public.yf_same_content(new.title, new.type::text, new.tmdb_id::text, r.title, r.type::text, r.tmdb_id::text)
  ) then
    raise exception using errcode = '23505', message = 'YF_DUPLICATE_REQUEST: ce titre a déjà été demandé.';
  end if;
  return new;
end;
$$;
revoke all on function public.yf_guard_content_duplicates() from public, anon, authenticated;

drop trigger if exists yf_prevent_duplicate_media on public.media;
create trigger yf_prevent_duplicate_media before insert or update of title, type, tmdb_id on public.media
  for each row execute function public.yf_guard_content_duplicates();
drop trigger if exists yf_prevent_duplicate_requests on public.requests;
create trigger yf_prevent_duplicate_requests before insert or update of title, type, tmdb_id, status on public.requests
  for each row execute function public.yf_guard_content_duplicates();

commit;
