begin;
alter table public.user_profiles add column if not exists profile_mode text not null default 'standard' check (profile_mode in ('standard','kids','junior'));
alter table public.media add column if not exists audience text not null default 'standard' check (audience in ('standard','kids','junior'));
alter table public.media add column if not exists release_year integer check (release_year between 1888 and 2100);
update public.media set release_year = substring(title from '\((18[0-9]{2}|19[0-9]{2}|20[0-9]{2}|2100)\)\s*$')::integer where release_year is null and title ~ '\((18[0-9]{2}|19[0-9]{2}|20[0-9]{2}|2100)\)\s*$';
create table if not exists public.site_feedback (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 rating integer not null check (rating between 1 and 5),
 discovery text not null check (discovery in ('tiktok','instagram','youtube','ami','recherche','autre')),
 message text not null default '' check (char_length(message) <= 2000),
 created_at timestamptz not null default now()
);
alter table public.site_feedback enable row level security;
grant insert, select on public.site_feedback to authenticated;
create policy feedback_insert on public.site_feedback for insert to authenticated with check (user_id = auth.uid());
create policy feedback_admin_read on public.site_feedback for select to authenticated using ((auth.jwt()->>'email') = 'lukas.leclerc312@gmail.com');
commit;
