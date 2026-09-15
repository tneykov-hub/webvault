-- WebVault: public icon delivery with owner-only upload and deletion.
-- Run once in the Supabase SQL editor after the core schema migrations.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'site-icons',
  'site-icons',
  true,
  2097152,
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Users can upload their site icons" on storage.objects;
create policy "Users can upload their site icons"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'site-icons'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "Users can update their site icons" on storage.objects;
create policy "Users can update their site icons"
on storage.objects for update to authenticated
using (
  bucket_id = 'site-icons'
  and (storage.foldername(name))[1] = (select auth.uid())::text
)
with check (
  bucket_id = 'site-icons'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "Users can delete their site icons" on storage.objects;
create policy "Users can delete their site icons"
on storage.objects for delete to authenticated
using (
  bucket_id = 'site-icons'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
