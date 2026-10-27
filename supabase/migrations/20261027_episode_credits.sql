begin;
create table if not exists public.episode_credits (
  episode_key text not null,
  season integer not null check (season between 1 and 1000),
  episode integer not null check (episode between 1 and 10000),
  duration_ms bigint not null default 0 check (duration_ms between 0 and 28800000),
  start_sec double precision check (start_sec >= 0 and start_sec < 28800),
  source text not null check (source in ('admin', 'TheIntroDB', 'IntroDB', 'missing')),
  checked_at timestamptz not null default now(),
  expires_at timestamptz,
  primary key (episode_key, season, episode, duration_ms),
  check ((source = 'admin' and duration_ms = 0 and start_sec is not null) or (source <> 'admin' and duration_ms >= 300000)),
  check ((source = 'missing' and start_sec is null) or (source <> 'missing' and start_sec is not null))
);
alter table public.episode_credits enable row level security;
grant select on public.episode_credits to anon, authenticated;
grant insert, update, delete on public.episode_credits to authenticated;
grant all on public.episode_credits to service_role;
create policy episode_credits_read on public.episode_credits for select using (true);
create policy episode_credits_admin_insert on public.episode_credits for insert to authenticated
  with check (auth.jwt()->>'email' = 'lukas.leclerc312@gmail.com' and source = 'admin');
create policy episode_credits_admin_update on public.episode_credits for update to authenticated
  using (auth.jwt()->>'email' = 'lukas.leclerc312@gmail.com' and source = 'admin')
  with check (auth.jwt()->>'email' = 'lukas.leclerc312@gmail.com' and source = 'admin');
create policy episode_credits_admin_delete on public.episode_credits for delete to authenticated
  using (auth.jwt()->>'email' = 'lukas.leclerc312@gmail.com' and source = 'admin');
commit;
