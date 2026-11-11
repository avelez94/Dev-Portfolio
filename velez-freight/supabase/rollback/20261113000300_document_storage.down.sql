-- Destructive: export files from the bucket first. Bucket removal requires it to be empty.
drop index if exists public.documents_storage_path_idx;
alter table public.documents drop constraint if exists documents_file_details;
alter table public.documents drop constraint if exists documents_storage_path_format;
alter table public.documents drop column if exists content_type, drop column if exists file_size, drop column if exists file_name;
-- delete from storage.buckets where id = 'documents';  -- only after the bucket is emptied
