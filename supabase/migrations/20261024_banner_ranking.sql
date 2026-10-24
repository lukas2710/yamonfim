-- Banners shown as a numbered top (1, 2, 3…). Run once in Supabase SQL Editor.
-- Adds one column with a default value; no existing data is modified or deleted.
alter table public.banners add column if not exists ranked boolean not null default false;
