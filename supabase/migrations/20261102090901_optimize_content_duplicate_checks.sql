begin;

-- Indexed probes for exact client-side checks and the normalized server guard.
create index if not exists media_type_tmdb_lookup_idx on public.media (type, tmdb_id);
create index if not exists media_type_title_lookup_idx on public.media (type, title);
create index if not exists media_type_tmdb_normalized_idx
  on public.media (type, public.yf_tmdb_id(tmdb_id::text))
  where public.yf_tmdb_id(tmdb_id::text) <> '';
create index if not exists media_type_title_normalized_idx
  on public.media (type, public.yf_content_title(title))
  where public.yf_content_title(title) <> '';

create index if not exists requests_type_tmdb_lookup_idx on public.requests (type, tmdb_id);
create index if not exists requests_type_title_lookup_idx on public.requests (type, title);
create index if not exists requests_type_tmdb_normalized_idx
  on public.requests (type, public.yf_tmdb_id(tmdb_id::text))
  where status is distinct from 'refuse' and public.yf_tmdb_id(tmdb_id::text) <> '';
create index if not exists requests_type_title_normalized_idx
  on public.requests (type, public.yf_content_title(title))
  where status is distinct from 'refuse' and public.yf_content_title(title) <> '';

create or replace function public.yf_guard_content_duplicates()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  candidate_tmdb text := public.yf_tmdb_id(new.tmdb_id::text);
  candidate_title text := public.yf_content_title(new.title);
  duplicate_exists boolean := false;
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

  -- Serialize checks for one media type so concurrent imports cannot race.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('yf-content:' || coalesce(new.type::text, ''), 0));

  if candidate_tmdb <> '' then
    select exists (
      select 1 from public.media m
      where m.type = new.type and (tg_table_name <> 'media' or m.id::text is distinct from new.id::text)
        and public.yf_tmdb_id(m.tmdb_id::text) = candidate_tmdb
    ) into duplicate_exists;
    if not duplicate_exists and candidate_title <> '' then
      select exists (
        select 1 from public.media m
        where m.type = new.type and (tg_table_name <> 'media' or m.id::text is distinct from new.id::text)
          and public.yf_tmdb_id(m.tmdb_id::text) = ''
          and public.yf_content_title(m.title) = candidate_title
      ) into duplicate_exists;
    end if;
  elsif candidate_title <> '' then
    select exists (
      select 1 from public.media m
      where m.type = new.type and (tg_table_name <> 'media' or m.id::text is distinct from new.id::text)
        and public.yf_content_title(m.title) = candidate_title
    ) into duplicate_exists;
  end if;
  if duplicate_exists then
    raise exception using errcode = '23505', message = 'YF_DUPLICATE_MEDIA: ce titre est déjà disponible dans le catalogue.';
  end if;

  if tg_table_name = 'requests' then
    duplicate_exists := false;
    if candidate_tmdb <> '' then
      select exists (
        select 1 from public.requests r
        where r.type = new.type and r.id::text is distinct from new.id::text and r.status is distinct from 'refuse'
          and public.yf_tmdb_id(r.tmdb_id::text) = candidate_tmdb
      ) into duplicate_exists;
      if not duplicate_exists and candidate_title <> '' then
        select exists (
          select 1 from public.requests r
          where r.type = new.type and r.id::text is distinct from new.id::text and r.status is distinct from 'refuse'
            and public.yf_tmdb_id(r.tmdb_id::text) = ''
            and public.yf_content_title(r.title) = candidate_title
        ) into duplicate_exists;
      end if;
    elsif candidate_title <> '' then
      select exists (
        select 1 from public.requests r
        where r.type = new.type and r.id::text is distinct from new.id::text and r.status is distinct from 'refuse'
          and public.yf_content_title(r.title) = candidate_title
      ) into duplicate_exists;
    end if;
    if duplicate_exists then
      raise exception using errcode = '23505', message = 'YF_DUPLICATE_REQUEST: ce titre a déjà été demandé.';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.yf_guard_content_duplicates() from public, anon, authenticated;
commit;
