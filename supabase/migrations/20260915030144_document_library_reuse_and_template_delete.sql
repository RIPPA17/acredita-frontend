begin;

grant delete on public.asset_requirement_templates to authenticated;

create or replace function private.apply_library_document(
  p_library_document_id uuid,
  p_obligation_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  lib public.document_library%rowtype;
  obl public.document_obligations%rowtype;
  acc public.accreditations%rowtype;
  assignment public.worker_assignments%rowtype;
  target_document_id uuid;
  target_worker_id uuid;
  next_version integer;
begin
  if (select auth.uid()) is null then raise exception 'Debes iniciar sesión'; end if;
  select * into lib from public.document_library where id = p_library_document_id;
  select * into obl from public.document_obligations where id = p_obligation_id and is_active;
  if lib.id is null or obl.id is null then raise exception 'Documento de biblioteca u obligación no encontrada'; end if;
  select * into acc from public.accreditations where id = obl.accreditation_id and is_active;
  if acc.id is null or acc.contratista_id <> lib.contratista_id then raise exception 'La biblioteca y la obligación pertenecen a contratistas distintos'; end if;
  if not ((select private.is_acredita_staff()) or (select private.has_contratista_access(lib.contratista_id))) then raise exception 'No tienes permisos para reutilizar este documento'; end if;
  if lib.status <> 'vigente' or (lib.expires_at is not null and lib.expires_at < current_date) then raise exception 'El documento de biblioteca no está vigente'; end if;
  if obl.worker_assignment_id is not null then
    select * into assignment from public.worker_assignments where id = obl.worker_assignment_id;
    target_worker_id := assignment.worker_id;
  end if;
  select d.id into target_document_id from public.documents d where d.obligation_id = obl.id limit 1;
  if target_document_id is null then
    insert into public.documents(accreditation_id, requirement_id, worker_id, obligation_id)
    values (obl.accreditation_id, obl.requirement_id, target_worker_id, obl.id)
    returning id into target_document_id;
  end if;
  select coalesce(max(v.version_number), 0) + 1 into next_version from public.document_versions v where v.document_id = target_document_id;
  insert into public.document_versions(
    document_id, version_number, workflow_status, issued_at, expires_at, uploaded_by,
    storage_bucket, storage_path, original_filename, mime_type, size_bytes, metadata
  ) values (
    target_document_id, next_version, 'revision', lib.issued_at, lib.expires_at, (select auth.uid()),
    lib.storage_bucket, lib.storage_path, lib.document_name, lib.mime_type, lib.file_size,
    jsonb_build_object('source','document_library','library_document_id',lib.id)
  );
  delete from public.document_library_links where document_obligation_id = obl.id;
  insert into public.document_library_links(library_document_id, document_obligation_id, linked_by)
  values (lib.id, obl.id, (select auth.uid()));
  return target_document_id;
end;
$$;
revoke all on function private.apply_library_document(uuid,uuid) from public, anon;
grant execute on function private.apply_library_document(uuid,uuid) to authenticated, service_role;

create or replace function public.apply_library_document(
  p_library_document_id uuid,
  p_obligation_id uuid
)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select private.apply_library_document(p_library_document_id, p_obligation_id);
$$;
revoke all on function public.apply_library_document(uuid,uuid) from public, anon;
grant execute on function public.apply_library_document(uuid,uuid) to authenticated, service_role;

commit;
