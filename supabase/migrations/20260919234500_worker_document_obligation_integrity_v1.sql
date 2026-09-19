create unique index if not exists documents_one_per_obligation
  on public.documents(obligation_id)
  where obligation_id is not null;

create or replace function private.validate_document_obligation_context()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_target text;
  v_obligation public.document_obligations%rowtype;
  v_assignment public.worker_assignments%rowtype;
begin
  select r.target into v_target
  from public.requirements r
  where r.id = new.requirement_id;

  if v_target is null then
    raise exception 'El requisito documental no existe';
  end if;

  if v_target = 'trabajador' then
    if new.worker_id is null then
      raise exception 'Un requisito de trabajador debe identificar al trabajador';
    end if;
    if new.obligation_id is null then
      raise exception 'El documento del trabajador debe vincularse a una obligación documental activa';
    end if;

    select * into v_obligation
    from public.document_obligations o
    where o.id = new.obligation_id;

    if v_obligation.id is null
       or not v_obligation.is_active
       or v_obligation.accreditation_id <> new.accreditation_id
       or v_obligation.requirement_id <> new.requirement_id
       or v_obligation.worker_assignment_id is null then
      raise exception 'La obligación documental no corresponde al requisito y acreditación del trabajador';
    end if;

    select * into v_assignment
    from public.worker_assignments wa
    where wa.id = v_obligation.worker_assignment_id;

    if v_assignment.id is null
       or v_assignment.worker_id <> new.worker_id
       or v_assignment.accreditation_id <> new.accreditation_id
       or not v_assignment.is_active
       or v_assignment.assignment_status <> 'activa' then
      raise exception 'La obligación documental no corresponde a la asignación activa del trabajador';
    end if;
  elsif v_target = 'empresa' then
    if new.worker_id is not null then
      raise exception 'Un requisito de empresa no puede asociarse a un trabajador';
    end if;

    if new.obligation_id is not null then
      select * into v_obligation
      from public.document_obligations o
      where o.id = new.obligation_id;

      if v_obligation.id is null
         or v_obligation.accreditation_id <> new.accreditation_id
         or v_obligation.requirement_id <> new.requirement_id
         or v_obligation.worker_assignment_id is not null then
        raise exception 'La obligación documental no corresponde al requisito de empresa';
      end if;
    end if;
  else
    raise exception 'Destino documental inválido';
  end if;

  return new;
end;
$$;

revoke all on function private.validate_document_obligation_context() from public, anon, authenticated;

drop trigger if exists trg_validate_document_obligation_context on public.documents;
create trigger trg_validate_document_obligation_context
before insert or update of accreditation_id, requirement_id, worker_id, obligation_id
on public.documents
for each row execute function private.validate_document_obligation_context();

create or replace function public.review_document_version(
  p_document_version_id uuid,
  p_action text,
  p_reason text default null,
  p_explanation text default null,
  p_solution text default null,
  p_reviewer_name text default null,
  p_issued_at date default null,
  p_expires_at date default null
)
returns jsonb
language plpgsql
set search_path = ''
as $function$
declare
  v_uid uuid := (select auth.uid());
  v_claim public.review_claims%rowtype;
  v_status text;
  v_count integer;
  v_reviewed_at timestamptz := now();
  v_validity_days integer;
  v_existing_issued_at date;
  v_existing_expires_at date;
  v_storage_path text;
  v_metadata jsonb;
  v_issued_at date;
  v_expires_at date;
begin
  if v_uid is null or not (select private.is_acredita_staff()) then
    raise exception 'Solo Acredita puede aprobar o rechazar documentos';
  end if;

  if p_action not in ('approve','reject') then
    raise exception 'Decisión de revisión inválida';
  end if;

  if p_action = 'reject' and coalesce(trim(p_reason), '') = '' then
    raise exception 'Debes indicar un motivo de rechazo';
  end if;

  if p_action = 'reject' and coalesce(trim(p_explanation), '') = '' then
    raise exception 'Debes indicar qué debe corregir el contratista';
  end if;

  select r.validity_days, dv.issued_at, dv.expires_at, dv.storage_path, dv.metadata
    into v_validity_days, v_existing_issued_at, v_existing_expires_at, v_storage_path, v_metadata
  from public.document_versions dv
  join public.documents d on d.id = dv.document_id
  join public.requirements r on r.id = d.requirement_id
  where dv.id = p_document_version_id;

  if not found then
    raise exception 'La versión documental no existe';
  end if;

  select * into v_claim
  from public.review_claims
  where document_version_id = p_document_version_id
    and claimed_by = v_uid
    and expires_at > now()
  limit 1;

  if v_claim.document_key is null then
    raise exception 'Debes tomar esta revisión antes de decidirla';
  end if;

  v_status := case when p_action = 'approve' then 'aprobado' else 'rechazado' end;

  if p_action = 'approve' then
    if v_storage_path is null and coalesce((v_metadata ->> 'legacy_import')::boolean, false) is not true then
      raise exception 'No puedes aprobar una versión sin archivo almacenado';
    end if;

    v_issued_at := coalesce(p_issued_at, v_existing_issued_at);
    if v_validity_days is not null and v_validity_days > 0 and v_issued_at is null then
      raise exception 'Debes confirmar la fecha de emisión antes de aprobar este documento';
    end if;

    v_expires_at := coalesce(
      p_expires_at,
      v_existing_expires_at,
      case
        when v_validity_days is not null and v_validity_days > 0 and v_issued_at is not null
          then v_issued_at + v_validity_days
        else null
      end
    );

    if v_issued_at is not null and v_expires_at is not null and v_expires_at < v_issued_at then
      raise exception 'La fecha de vencimiento no puede ser anterior a la fecha de emisión';
    end if;
  else
    v_issued_at := v_existing_issued_at;
    v_expires_at := v_existing_expires_at;
  end if;

  update public.document_versions
  set workflow_status = v_status,
      issued_at = v_issued_at,
      expires_at = v_expires_at,
      reviewed_by = v_uid,
      reviewed_at = v_reviewed_at,
      rejection_reason = case when p_action = 'reject' then trim(p_reason) else null end,
      rejection_explanation = case when p_action = 'reject' then trim(p_explanation) else null end,
      rejection_solution = case when p_action = 'reject' then coalesce(nullif(trim(p_solution), ''), trim(p_explanation)) else null end,
      metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
        'reviewer_name', coalesce(nullif(trim(p_reviewer_name), ''), 'Acredita'),
        'backend_review_decision', true,
        'reviewed_at', v_reviewed_at,
        'validity_days', v_validity_days,
        'validity_confirmed', p_action = 'approve'
      )
  where id = p_document_version_id
    and workflow_status = 'revision';

  get diagnostics v_count = row_count;
  if v_count <> 1 then
    raise exception 'La versión cambió mientras la revisabas. Recarga la cola';
  end if;

  insert into public.review_activity(reviewer_id, document_version_id, document_key, action)
  values (v_uid, p_document_version_id, v_claim.document_key, v_status);

  delete from public.review_claims
  where document_key = v_claim.document_key
    and claimed_by = v_uid;

  return jsonb_build_object(
    'version_id', p_document_version_id,
    'status', v_status,
    'reviewed_at', v_reviewed_at,
    'document_key', v_claim.document_key,
    'issued_at', v_issued_at,
    'expires_at', v_expires_at
  );
end;
$function$;
