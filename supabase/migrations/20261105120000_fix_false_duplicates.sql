-- Corrige les titres refusés à tort comme « déjà disponibles ».
-- Aucune ligne n'est supprimée. Aucun identifiant déjà renseigné n'est modifié :
-- seul un tmdb_id vide est rempli, avec le numéro lu dans le lien de la fiche.
begin;

-- « Dune (2021) » donne 2021. Sans année dans le titre, la colonne release_year prend le relais.
create or replace function public.yf_title_year(value text, release_year integer default null)
returns text language sql immutable parallel safe set search_path = '' as $$
  select coalesce((regexp_match(trim(coalesce(value, '')), '\(((?:18|19|20|21)[0-9]{2})\)$'))[1], release_year::text, '');
$$;

-- Numéro TMDB porté par un lien de lecteur (même règle que contentTmdbId).
create or replace function public.yf_link_tmdb(value text, kind text)
returns text language sql immutable parallel safe set search_path = '' as $$
  select public.yf_tmdb_id(coalesce(
    (regexp_match(coalesce(value, ''), case when kind = 'movie'
      then 'https://api\.moviez\.ac/([0-9]+)/?(?:[?#"'' ]|$)'
      else 'https://api\.moviez\.ac/serie/([0-9]+)/[0-9]+/[0-9]+/?(?:[?#"'' ]|$)' end))[1],
    (regexp_match(coalesce(value, ''), case when kind = 'movie'
      then '/api/catalogue-player\?(?=[^"'']*type=movie)(?:[^"'']*[?&;])?tmdb=([0-9]+)'
      else '/api/catalogue-player\?(?=[^"'']*type=tv)(?:[^"'']*[?&;])?tmdb=([0-9]+)' end))[1],
    ''));
$$;

create or replace function public.yf_guard_content_duplicates()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  candidate_tmdb text := public.yf_tmdb_id(new.tmdb_id::text);
  candidate_title text := public.yf_content_title(new.title);
  candidate_year text := public.yf_title_year(new.title);
  existing text;
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
    select m.title into existing from public.media m
    where m.type = new.type and (tg_table_name <> 'media' or m.id::text is distinct from new.id::text)
      and public.yf_tmdb_id(m.tmdb_id::text) = candidate_tmdb
    limit 1;
  end if;
  if existing is null and candidate_title <> '' then
    select m.title into existing from public.media m
    where m.type = new.type and (tg_table_name <> 'media' or m.id::text is distinct from new.id::text)
      and public.yf_content_title(m.title) = candidate_title
      -- Two different years are two different titles, as for a remake.
      and (candidate_year = '' or public.yf_title_year(m.title, m.release_year) in ('', candidate_year))
      -- A row identified by its column or its link is another title than this identifier.
      and (candidate_tmdb = '' or (public.yf_tmdb_id(m.tmdb_id::text) = ''
        and public.yf_link_tmdb(m.url, m.type::text) = '' and public.yf_link_tmdb(m."embedUrl", m.type::text) = ''))
      -- A film card without any link or identifier is empty: it does not hold the title.
      and (m.type <> 'movie' or public.yf_tmdb_id(m.tmdb_id::text) <> ''
        or coalesce(trim(m.url), '') <> '' or coalesce(trim(m."embedUrl"), '') <> '')
    limit 1;
  end if;
  if existing is not null then
    raise exception using errcode = '23505', message = 'YF_DUPLICATE_MEDIA: ce titre est déjà disponible dans le catalogue.', detail = existing;
  end if;

  if tg_table_name = 'requests' then
    if candidate_tmdb <> '' then
      select r.title into existing from public.requests r
      where r.type = new.type and r.id::text is distinct from new.id::text and r.status is distinct from 'refuse'
        and public.yf_tmdb_id(r.tmdb_id::text) = candidate_tmdb
      limit 1;
    end if;
    if existing is null and candidate_title <> '' then
      select r.title into existing from public.requests r
      where r.type = new.type and r.id::text is distinct from new.id::text and r.status is distinct from 'refuse'
        and public.yf_content_title(r.title) = candidate_title
        and (candidate_year = '' or public.yf_title_year(r.title) in ('', candidate_year))
        and (candidate_tmdb = '' or public.yf_tmdb_id(r.tmdb_id::text) = '')
      limit 1;
    end if;
    if existing is not null then
      raise exception using errcode = '23505', message = 'YF_DUPLICATE_REQUEST: ce titre a déjà été demandé.', detail = existing;
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.yf_guard_content_duplicates() from public, anon, authenticated;

-- Remplit les identifiants manquants. Le contrôle est suspendu le temps de cette
-- seule commande, qui écarte elle-même tout numéro déjà utilisé.
alter table public.media disable trigger yf_prevent_duplicate_media;

with found as (
  select m.id, m.type::text as kind,
    coalesce(nullif(public.yf_link_tmdb(m.url, m.type::text), ''), public.yf_link_tmdb(m."embedUrl", m.type::text)) as tmdb
  from public.media m
  where m.type = 'movie' and public.yf_tmdb_id(m.tmdb_id::text) = ''
  union all
  -- Séries : tous les épisodes doivent porter le même numéro.
  select m.id, m.type::text, min(public.yf_link_tmdb(episode ->> 'embedUrl', 'series'))
  from public.media m
  cross join lateral jsonb_array_elements(case when jsonb_typeof(m.seasons::jsonb) = 'array' then m.seasons::jsonb else '[]'::jsonb end) season
  cross join lateral jsonb_array_elements(case when jsonb_typeof(season -> 'episodes') = 'array' then season -> 'episodes' else '[]'::jsonb end) episode
  where m.type = 'series' and public.yf_tmdb_id(m.tmdb_id::text) = ''
    and public.yf_link_tmdb(episode ->> 'embedUrl', 'series') <> ''
  group by m.id, m.type
  having count(distinct public.yf_link_tmdb(episode ->> 'embedUrl', 'series')) = 1
), taken as (
  select distinct m.type::text as kind, public.yf_tmdb_id(m.tmdb_id::text) as tmdb
  from public.media m where public.yf_tmdb_id(m.tmdb_id::text) <> ''
), usable as (
  select f.id, f.tmdb from found f
  where f.tmdb <> ''
    and (select count(*) from found other where other.kind = f.kind and other.tmdb = f.tmdb) = 1
    and not exists (select 1 from taken t where t.kind = f.kind and t.tmdb = f.tmdb)
)
update public.media m set tmdb_id = usable.tmdb from usable where m.id = usable.id;

alter table public.media enable trigger yf_prevent_duplicate_media;

commit;
