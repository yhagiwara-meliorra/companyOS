-- ============================================================
-- Migration: Create storage bucket for evidence files
-- ============================================================

-- Create the evidence bucket (private by default)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'evidence',
  'evidence',
  false,
  52428800, -- 50 MB
  array[
    'application/pdf',
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/tiff',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'text/csv',
    'application/json',
    'application/geo+json',
    'application/zip'
  ]
)
on conflict (id) do nothing;

-- ── Storage RLS ──────────────────────────────────────────────
-- Upload/download is done server-side via service_role (admin client).
-- For direct browser access (signed URLs), workspace members can read.
create policy "evidence_read"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'evidence'
    and (storage.foldername(name))[1] is not null
    and public.is_workspace_member(
      ((storage.foldername(name))[1])::uuid
    )
  );

-- Workspace members with write roles can upload
create policy "evidence_upload"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'evidence'
    and (storage.foldername(name))[1] is not null
    and public.has_workspace_role(
      ((storage.foldername(name))[1])::uuid,
      array['owner','admin','analyst','reviewer','supplier_manager']
    )
  );

-- Workspace owners/admins can delete
create policy "evidence_delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'evidence'
    and (storage.foldername(name))[1] is not null
    and public.has_workspace_role(
      ((storage.foldername(name))[1])::uuid,
      array['owner','admin']
    )
  );
