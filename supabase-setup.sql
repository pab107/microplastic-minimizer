-- supabase-setup.sql — sets up saving in Supabase. Run it ONCE:
-- Supabase dashboard → SQL Editor → New query → paste this whole file → Run.
--
-- It creates:
--   1. a "scans" TABLE in the database (one row per saved scan)
--   2. a private "scan-photos" STORAGE BUCKET (a folder in the cloud for photos)
--   3. SECURITY RULES ("Row Level Security" policies) so each user can only
--      see, add and delete THEIR OWN scans and photos — nobody else's.
--
-- Lines starting with "--" are comments; the database ignores them.


-- ---------- 1. The scans table ----------
create table public.scans (
  id           uuid primary key default gen_random_uuid(),   -- unique ID, made automatically
  user_id      uuid not null default auth.uid()               -- who saved it (filled in automatically
               references auth.users (id) on delete cascade, --  from the logged-in user; deleted with the account)
  created_at   timestamptz not null default now(),           -- when it was saved
  scanned_text text,                                         -- the text the OCR read from the photo
  found        jsonb not null default '[]',                  -- the flagged polymers (name, level, found as)
  photo_path   text                                          -- where the photo is in the scan-photos bucket
);

-- Turn on Row Level Security: from now on, NOBODY can read or change rows
-- unless a policy below allows it.
alter table public.scans enable row level security;

-- Policies: a logged-in user may see / add / delete a row only if it's theirs.
create policy "Users can view their own scans"
  on public.scans for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can add their own scans"
  on public.scans for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own scans"
  on public.scans for delete to authenticated
  using ((select auth.uid()) = user_id);

-- Let logged-in users use the table at all (the policies above still apply).
grant select, insert, delete on public.scans to authenticated;


-- ---------- 2. The photo storage bucket ----------
-- public = false means photos are private: they can only be viewed through
-- short-lived links that the app creates for the photo's owner.
insert into storage.buckets (id, name, public)
values ('scan-photos', 'scan-photos', false);


-- ---------- 3. Photo security rules ----------
-- Each user's photos go in a folder named after their user ID, e.g.
-- "3f2a.../1731400000000.jpg". These rules only allow access to your own folder.
create policy "Users can upload their own photos"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'scan-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "Users can view their own photos"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'scan-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "Users can delete their own photos"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'scan-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
