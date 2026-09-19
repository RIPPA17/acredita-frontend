create or replace function private.enforce_document_approval_validity()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_validity_days integer;
begin
  if new.workflow_status <> 'aprobado' then
    return new;
  end if;

  select r.validity_days
    into v_validity_days
  from public.documents d
  join public.requirements r on r.id = d.requirement_id
  where d.id = new.document_id;

  if v_validity_days is not null and v_validity_days > 0 then
    if new.issued_at is null then
      raise exception 'Debes confirmar la fecha de emisión antes de aprobar este documento';
    end if;
    if new.expires_at is null then
      new.expires_at := new.issued_at + v_validity_days;
    end if;
  end if;

  if new.issued_at is not null and new.expires_at is not null and new.expires_at < new.issued_at then
    raise exception 'La fecha de vencimiento no puede ser anterior a la fecha de emisión';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_document_versions_approval_validity on public.document_versions;
create trigger trg_document_versions_approval_validity
before insert or update of workflow_status, issued_at, expires_at
on public.document_versions
for each row execute function private.enforce_document_approval_validity();

drop function if exists public.review_document_version(uuid,text,text,text,text,text);

create function public.review_document_version(
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
as $$
declare
  v_uid uuid := (select auth.uid());
  v_claim public.review_claims%rowtype;
  v_status text;
  v_count integer;
  v_reviewed_at timestamptz := now();
  v_validity_days integer;
  v_existing_issued_at date;
  v_existing_expires_at date;
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

  select r.validity_days, dv.issued_at, dv.expires_at
    into v_validity_days, v_existing_issued_at, v_existing_expires_at
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
      rejection_explanation = case when p_action = 'reject' then coalesce(nullif(trim(p_explanation), ''), trim(p_reason)) else null end,
      rejection_solution = case when p_action = 'reject' then coalesce(nullif(trim(p_solution), ''), nullif(trim(p_explanation), '')) else null end,
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
$$;

revoke all on function public.review_document_version(uuid,text,text,text,text,text,date,date) from public, anon;
grant execute on function public.review_document_version(uuid,text,text,text,text,text,date,date) to authenticated, service_role;

create or replace function private.audit_document_version_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_document public.documents%rowtype;
  v_project_id uuid;
  v_accreditation_id uuid;
  v_action text;
  v_actor uuid;
begin
  select d.* into v_document
  from public.documents d
  where d.id = new.document_id;

  if v_document.id is null then
    return new;
  end if;

  select a.project_id, a.id
    into v_project_id, v_accreditation_id
  from public.accreditations a
  where a.id = v_document.accreditation_id;

  if tg_op = 'INSERT' then
    v_action := case
      when new.version_number > 1 then 'document_resubmitted'
      else 'document_submitted'
    end;
    v_actor := coalesce(new.uploaded_by, (select auth.uid()));
  else
    if old.workflow_status is not distinct from new.workflow_status
       and old.reviewed_by is not distinct from new.reviewed_by
       and old.reviewed_at is not distinct from new.reviewed_at
       and old.rejection_reason is not distinct from new.rejection_reason
       and old.rejection_explanation is not distinct from new.rejection_explanation
       and old.rejection_solution is not distinct from new.rejection_solution
       and old.issued_at is not distinct from new.issued_at
       and old.expires_at is not distinct from new.expires_at then
      return new;
    end if;

    v_action := case
      when new.workflow_status = 'aprobado' and old.workflow_status is distinct from new.workflow_status then 'document_approved'
      when new.workflow_status = 'rechazado' and old.workflow_status is distinct from new.workflow_status then 'document_rejected'
      else 'document_review_updated'
    end;
    v_actor := coalesce(new.reviewed_by, (select auth.uid()), new.uploaded_by);
  end if;

  insert into public.audit_logs(
    actor_profile_id,
    action,
    entity_type,
    entity_id,
    project_id,
    accreditation_id,
    details
  ) values (
    v_actor,
    v_action,
    'document_version',
    new.id,
    v_project_id,
    v_accreditation_id,
    jsonb_build_object(
      'document_id', new.document_id,
      'requirement_id', v_document.requirement_id,
      'worker_id', v_document.worker_id,
      'version_number', new.version_number,
      'old_status', case when tg_op = 'UPDATE' then old.workflow_status else null end,
      'new_status', new.workflow_status,
      'issued_at', new.issued_at,
      'expires_at', new.expires_at,
      'rejection_reason', new.rejection_reason,
      'rejection_explanation', new.rejection_explanation,
      'rejection_solution', new.rejection_solution,
      'original_filename', new.original_filename
    )
  );

  return new;
end;
$$;

drop trigger if exists trg_audit_document_version_change on public.document_versions;
create trigger trg_audit_document_version_change
after insert or update of workflow_status, reviewed_by, reviewed_at, rejection_reason, rejection_explanation, rejection_solution, issued_at, expires_at
on public.document_versions
for each row execute function private.audit_document_version_change();

create or replace view public.document_statuses
with (security_invoker = true)
as
with latest_submission as (
  select distinct on (dv.document_id) dv.*
  from public.document_versions dv
  order by dv.document_id, dv.version_number desc, dv.created_at desc
),
valid_approved as (
  select distinct on (dv.document_id) dv.*
  from public.document_versions dv
  where dv.workflow_status = 'aprobado'
    and (dv.expires_at is null or dv.expires_at >= current_date)
  order by dv.document_id, dv.version_number desc, dv.created_at desc
),
effective_version as (
  select
    d.id as document_id,
    case
      when ls.id is not null
       and ls.workflow_status in ('revision','rechazado','pendiente','reemplazado')
       and va.id is not null
       and va.version_number < ls.version_number
        then va.id
      else ls.id
    end as effective_version_id
  from public.documents d
  left join latest_submission ls on ls.document_id = d.id
  left join valid_approved va on va.document_id = d.id
)
select
  d.id as document_id,
  d.accreditation_id,
  a.project_id,
  a.contratista_id,
  d.requirement_id,
  d.worker_id,
  r.name as requirement_name,
  r.target,
  r.is_required,
  r.criticality,
  r.alert_days,
  public.requirement_is_blocking(r.is_required, r.criticality) as is_blocking,
  ev.id as version_id,
  ev.version_number,
  ev.workflow_status,
  ev.issued_at,
  ev.expires_at,
  ev.uploaded_by,
  ev.uploaded_at,
  ev.reviewed_by,
  ev.reviewed_at,
  ev.rejection_reason,
  ev.rejection_explanation,
  ev.rejection_solution,
  ev.storage_bucket,
  ev.storage_path,
  ev.original_filename,
  ev.mime_type,
  ev.size_bytes,
  ev.metadata,
  public.effective_document_status(ev.workflow_status, ev.expires_at, r.alert_days) as effective_status
from public.documents d
join public.accreditations a on a.id = d.accreditation_id
join public.requirements r on r.id = d.requirement_id
left join effective_version pick on pick.document_id = d.id
left join public.document_versions ev on ev.id = pick.effective_version_id;

create or replace view public.obligation_statuses
with (security_invoker = true)
as
with version_candidates as (
  select
    d.obligation_id,
    d.id as source_document_id,
    dv.id as version_id,
    dv.version_number,
    dv.workflow_status,
    dv.expires_at,
    dv.uploaded_at,
    dv.reviewed_at,
    dv.created_at
  from public.documents d
  left join public.document_versions dv on dv.document_id = d.id
  where d.obligation_id is not null
),
latest_submission as (
  select distinct on (vc.obligation_id)
    vc.obligation_id,
    vc.source_document_id as document_id,
    vc.version_id,
    vc.version_number,
    vc.workflow_status,
    vc.expires_at,
    vc.uploaded_at,
    vc.reviewed_at
  from version_candidates vc
  order by vc.obligation_id, vc.version_number desc nulls last, vc.created_at desc nulls last
),
valid_approved as (
  select distinct on (vc.obligation_id)
    vc.obligation_id,
    vc.source_document_id as document_id,
    vc.version_id,
    vc.version_number,
    vc.workflow_status,
    vc.expires_at,
    vc.uploaded_at,
    vc.reviewed_at
  from version_candidates vc
  where vc.workflow_status = 'aprobado'
    and (vc.expires_at is null or vc.expires_at >= current_date)
  order by vc.obligation_id, vc.version_number desc, vc.created_at desc
),
effective as (
  select
    ls.obligation_id,
    case
      when ls.version_id is not null
       and ls.workflow_status in ('revision','rechazado','pendiente','reemplazado')
       and va.version_id is not null
       and va.version_number < ls.version_number
        then va.document_id
      else ls.document_id
    end as document_id,
    case
      when ls.version_id is not null
       and ls.workflow_status in ('revision','rechazado','pendiente','reemplazado')
       and va.version_id is not null
       and va.version_number < ls.version_number
        then va.version_id
      else ls.version_id
    end as version_id,
    case
      when ls.version_id is not null
       and ls.workflow_status in ('revision','rechazado','pendiente','reemplazado')
       and va.version_id is not null
       and va.version_number < ls.version_number
        then va.version_number
      else ls.version_number
    end as version_number,
    case
      when ls.version_id is not null
       and ls.workflow_status in ('revision','rechazado','pendiente','reemplazado')
       and va.version_id is not null
       and va.version_number < ls.version_number
        then va.workflow_status
      else ls.workflow_status
    end as workflow_status,
    case
      when ls.version_id is not null
       and ls.workflow_status in ('revision','rechazado','pendiente','reemplazado')
       and va.version_id is not null
       and va.version_number < ls.version_number
        then va.expires_at
      else ls.expires_at
    end as expires_at,
    case
      when ls.version_id is not null
       and ls.workflow_status in ('revision','rechazado','pendiente','reemplazado')
       and va.version_id is not null
       and va.version_number < ls.version_number
        then va.uploaded_at
      else ls.uploaded_at
    end as uploaded_at,
    case
      when ls.version_id is not null
       and ls.workflow_status in ('revision','rechazado','pendiente','reemplazado')
       and va.version_id is not null
       and va.version_number < ls.version_number
        then va.reviewed_at
      else ls.reviewed_at
    end as reviewed_at
  from latest_submission ls
  left join valid_approved va on va.obligation_id = ls.obligation_id
)
select
  o.id as obligation_id,
  o.accreditation_id,
  o.service_id,
  o.worker_assignment_id,
  o.requirement_id,
  o.period_start,
  o.period_end,
  o.due_date,
  (
    o.is_active
    and r.is_active
    and (o.service_id is null or (s.is_active and s.status = 'activo'))
    and (o.worker_assignment_id is null or (wa.is_active and wa.assignment_status = 'activa'))
  ) as is_active,
  r.target,
  r.is_required,
  r.criticality,
  r.blocks_work,
  r.blocks_assignment,
  effective.document_id,
  effective.version_id,
  effective.version_number,
  effective.workflow_status,
  effective.expires_at,
  effective.uploaded_at,
  effective.reviewed_at,
  case
    when o.status = 'no_aplica' then 'no_aplica'
    when effective.version_id is null and o.due_date < current_date then 'vencido'
    when effective.version_id is null then 'pendiente'
    else public.effective_document_status(effective.workflow_status, effective.expires_at, r.alert_days)
  end as effective_status
from public.document_obligations o
join public.requirements r on r.id = o.requirement_id
left join public.services s on s.id = o.service_id
left join public.worker_assignments wa on wa.id = o.worker_assignment_id
left join effective on effective.obligation_id = o.id;
