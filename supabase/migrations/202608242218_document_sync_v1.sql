drop policy if exists document_versions_insert_uploader on public.document_versions;

create policy document_versions_insert_uploader
on public.document_versions
for insert
to authenticated
with check (
  (select private.can_upload_document(document_versions.document_id))
  and (
    (select private.is_acredita_staff())
    or (
      workflow_status in ('pendiente', 'revision')
      and uploaded_by = (select auth.uid())
    )
  )
);
