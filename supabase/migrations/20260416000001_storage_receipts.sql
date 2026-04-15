-- Storage bucket for donation receipt PDFs.
-- Bucket is private; URLs are served via signed URLs generated server-side.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'receipts',
  'receipts',
  false,
  5242880,  -- 5 MB per file
  array['application/pdf']
)
on conflict (id) do nothing;

-- Only the service role (server-side) may read/write. No direct client access.
-- RLS policies below are belt-and-suspenders; the service role bypasses RLS anyway.

create policy "service_role_select_receipts"
  on storage.objects for select
  using (bucket_id = 'receipts' and auth.role() = 'service_role');

create policy "service_role_insert_receipts"
  on storage.objects for insert
  with check (bucket_id = 'receipts' and auth.role() = 'service_role');

create policy "service_role_update_receipts"
  on storage.objects for update
  using (bucket_id = 'receipts' and auth.role() = 'service_role');
