-- Run in Supabase SQL Editor. Does not change the existing media table.
begin;
create table if not exists public.media_streams (
  entry_key text primary key,
  media_id text not null,
  title text not null,
  media_type text not null check (media_type in ('movie', 'series')),
  season_number integer,
  episode_number integer,
  poster text not null default '',
  source_url text not null,
  stream_url text,
  expires_at timestamptz,
  status text not null default 'pending' check (status in ('pending', 'ready', 'error')),
  error_message text,
  checked_at timestamptz,
  updated_at timestamptz not null default now(),
  check (status <> 'ready' or stream_url is not null)
);
create index if not exists media_streams_media_id_idx on public.media_streams(media_id);
alter table public.media_streams enable row level security;
revoke all on public.media_streams from anon, authenticated;
grant all on public.media_streams to service_role;
commit;
