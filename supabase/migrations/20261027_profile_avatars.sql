begin;
create table if not exists public.profile_avatars (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 60),
  category text not null check (char_length(trim(category)) between 1 and 60),
  image_url text not null check (image_url like 'https://%'),
  created_at timestamptz not null default now()
);
alter table public.profile_avatars enable row level security;
grant select on public.profile_avatars to anon, authenticated;
grant insert, update, delete on public.profile_avatars to authenticated;
create policy avatars_read on public.profile_avatars for select using (true);
create policy avatars_admin on public.profile_avatars for all to authenticated
  using ((auth.jwt() ->> 'email') = 'lukas.leclerc312@gmail.com')
  with check ((auth.jwt() ->> 'email') = 'lukas.leclerc312@gmail.com');
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('profile-avatars', 'profile-avatars', true, 2097152, array['image/webp'])
on conflict (id) do nothing;
create policy avatars_images_read on storage.objects for select using (bucket_id = 'profile-avatars');
create policy avatars_images_admin on storage.objects for all to authenticated
  using (bucket_id = 'profile-avatars' and (auth.jwt() ->> 'email') = 'lukas.leclerc312@gmail.com')
  with check (bucket_id = 'profile-avatars' and (auth.jwt() ->> 'email') = 'lukas.leclerc312@gmail.com');
commit;
