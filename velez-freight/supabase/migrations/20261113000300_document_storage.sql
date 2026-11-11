-- Document files: a private storage bucket plus file details on each document record.
--
-- Security model
--   * The bucket is private and has no storage policies, so the public key and signed in
--     users cannot read, list or write files directly. Only the server (secret key) can.
--   * Staff upload through a one time signed upload URL that the server issues after checking
--     their session and the record they are attaching to. Files are named by random ID under
--     <entity type>/<entity id>/, never by the original file name.
--   * Staff open files through a short lived signed URL issued by the server after checking
--     access again. Every download is written to the audit log. W9 forms (taxpayer numbers)
--     open for owners and admins only.
--   * Only PDF and common image types up to 15 MB are accepted, enforced by the bucket.

do $storage$
begin
  if to_regclass('storage.buckets') is null then
    raise notice 'storage schema not present; skipping bucket creation';
    return;
  end if;
  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('documents', 'documents', false, 15728640,
          array['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'])
  on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;
end
$storage$;

alter table public.documents
  add column file_name text check (length(file_name) between 1 and 200),
  add column file_size integer check (file_size between 1 and 15728640),
  add column content_type text check (content_type in ('application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'));

-- A stored file must live under the folder of the record it belongs to, with a random name.
alter table public.documents add constraint documents_storage_path_format check (
  storage_path is null
  or storage_path ~ ('^' || entity_type || '/' || entity_id::text || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(pdf|jpg|png|webp|heic|heif)$'));
-- File details travel together.
alter table public.documents add constraint documents_file_details check (
  (storage_path is null and file_name is null and file_size is null and content_type is null)
  or (storage_path is not null and file_name is not null and file_size is not null and content_type is not null));
create unique index documents_storage_path_idx on public.documents (storage_path) where storage_path is not null;
