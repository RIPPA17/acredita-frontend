-- Estado derivado oficial y auditoría operacional de Acredita.
-- Esta migración ya fue aplicada en Supabase como domain_logic_and_audit_v1.

create or replace function public.requirement_is_blocking(
  p_is_required boolean,
  p_criticality text
)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select case
    when p_criticality = 'advertencia' then false
    when p_criticality in ('bloquea_pago','bloquea_acceso') then true
    else coalesce(p_is_required, true)
  end;
$$;

create or replace function public.effective_document_status(
  p_workflow_status text,
  p_expires_at date,
  p_alert_days integer
)
returns text
language sql
stable
security invoker
set search_path = ''
as $$
  select case
    when p_workflow_status is null then 'pendiente'
    when p_workflow_status = 'rechazado' then 'rechazado'
    when p_workflow_status = 'aprobado' and p_expires_at is not null and p_expires_at < current_date then 'vencido'
    when p_workflow_status = 'aprobado' and p_expires_at is not null
      and p_expires_at <= current_date + greatest(coalesce(p_alert_days, 0), 0) then 'por_vencer'
    when p_workflow_status = 'aprobado' then 'aprobado'
    when p_workflow_status = 'revision' then 'revision'
    when p_workflow_status = 'reemplazado' then 'reemplazado'
    else 'pendiente'
  end;
$$;

revoke all on function public.requirement_is_blocking(boolean,text) from public, anon;
revoke all on function public.effective_document_status(text,date,integer) from public, anon;
grant execute on function public.requirement_is_blocking(boolean,text) to authenticated, service_role;
grant execute on function public.effective_document_status(text,date,integer) to authenticated, service_role;

create or replace view public.document_statuses
with (security_invoker = true)
as
with latest_version as (
  select distinct on (dv.document_id)
    dv.id,
    dv.document_id,
    dv.version_number,
    dv.workflow_status,
    dv.issued_at,
    dv.expires_at,
    dv.uploaded_by,
    dv.uploaded_at,
    dv.reviewed_by,
    dv.reviewed_at,
    dv.rejection_reason,
    dv.rejection_explanation,
    dv.rejection_solution,
    dv.storage_bucket,
    dv.storage_path,
    dv.original_filename,
    dv.mime_type,
    dv.size_bytes,
    dv.metadata,
    dv.created_at
  from public.document_versions dv
  order by dv.document_id, dv.version_number desc, dv.created_at desc
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
  lv.id as version_id,
  lv.version_number,
  lv.workflow_status,
  lv.issued_at,
  lv.expires_at,
  lv.uploaded_by,
  lv.uploaded_at,
  lv.reviewed_by,
  lv.reviewed_at,
  lv.rejection_reason,
  lv.rejection_explanation,
  lv.rejection_solution,
  lv.storage_bucket,
  lv.storage_path,
  lv.original_filename,
  lv.mime_type,
  lv.size_bytes,
  lv.metadata,
  public.effective_document_status(lv.workflow_status, lv.expires_at, r.alert_days) as effective_status
from public.documents d
join public.accreditations a on a.id = d.accreditation_id
join public.requirements r on r.id = d.requirement_id
left join latest_version lv on lv.document_id = d.id;

create or replace view public.worker_accreditation_statuses
with (security_invoker = true)
as
with requirement_matrix as (
  select
    wa.id as assignment_id,
    wa.accreditation_id,
    a.project_id,
    a.contratista_id,
    wa.worker_id,
    w.full_name as worker_name,
    w.rut as worker_rut,
    r.id as requirement_id,
    (r.id is not null and public.requirement_is_blocking(r.is_required, r.criticality)) as is_blocking,
    ds.document_id,
    ds.version_id,
    coalesce(ds.effective_status, 'pendiente') as effective_status
  from public.worker_assignments wa
  join public.accreditations a on a.id = wa.accreditation_id
  join public.workers w on w.id = wa.worker_id
  left join public.requirements r
    on r.project_id = a.project_id
   and r.target = 'trabajador'
   and r.is_active = true
  left join public.document_statuses ds
    on ds.accreditation_id = wa.accreditation_id
   and ds.requirement_id = r.id
   and ds.worker_id = wa.worker_id
  where wa.is_active = true
    and a.is_active = true
    and w.is_active = true
), aggregated as (
  select
    assignment_id,
    accreditation_id,
    project_id,
    contratista_id,
    worker_id,
    worker_name,
    worker_rut,
    count(*) filter (where is_blocking) as required_count,
    count(*) filter (where is_blocking and version_id is not null) as submitted_count,
    count(*) filter (where is_blocking and effective_status in ('aprobado','por_vencer')) as satisfied_count,
    count(*) filter (where is_blocking and effective_status in ('rechazado','vencido')) as blocked_count,
    count(*) filter (where is_blocking and effective_status = 'por_vencer') as near_expiry_count
  from requirement_matrix
  group by assignment_id, accreditation_id, project_id, contratista_id, worker_id, worker_name, worker_rut
)
select
  assignment_id,
  accreditation_id,
  project_id,
  contratista_id,
  worker_id,
  worker_name,
  worker_rut,
  required_count,
  submitted_count,
  satisfied_count,
  greatest(required_count - satisfied_count - blocked_count, 0) as pending_count,
  blocked_count,
  near_expiry_count,
  case when required_count = 0 then 0::numeric
       else round((satisfied_count::numeric * 100) / required_count, 1)
  end as compliance_percent,
  case
    when required_count = 0 then 'en_proceso'
    when submitted_count = 0 then 'no_acreditado'
    when blocked_count > 0 then 'vencido_bloqueado'
    when satisfied_count = required_count then 'aprobado'
    else 'en_proceso'
  end as status
from aggregated;

create or replace view public.accreditation_statuses
with (security_invoker = true)
as
with company_stats as (
  select
    a.id as accreditation_id,
    count(r.id) filter (where public.requirement_is_blocking(r.is_required, r.criticality)) as company_required_count,
    count(r.id) filter (
      where public.requirement_is_blocking(r.is_required, r.criticality)
        and ds.version_id is not null
    ) as company_submitted_count,
    count(r.id) filter (
      where public.requirement_is_blocking(r.is_required, r.criticality)
        and coalesce(ds.effective_status, 'pendiente') in ('aprobado','por_vencer')
    ) as company_satisfied_count,
    count(r.id) filter (
      where public.requirement_is_blocking(r.is_required, r.criticality)
        and coalesce(ds.effective_status, 'pendiente') in ('rechazado','vencido')
    ) as company_blocked_count,
    count(r.id) filter (
      where public.requirement_is_blocking(r.is_required, r.criticality)
        and coalesce(ds.effective_status, 'pendiente') = 'por_vencer'
    ) as company_near_expiry_count
  from public.accreditations a
  left join public.requirements r
    on r.project_id = a.project_id
   and r.target = 'empresa'
   and r.is_active = true
  left join public.document_statuses ds
    on ds.accreditation_id = a.id
   and ds.requirement_id = r.id
   and ds.worker_id is null
  group by a.id
), worker_stats as (
  select
    a.id as accreditation_id,
    count(was.assignment_id) as active_worker_count,
    count(was.assignment_id) filter (where was.status = 'aprobado') as approved_worker_count,
    count(was.assignment_id) filter (where was.status = 'vencido_bloqueado') as blocked_worker_count,
    count(was.assignment_id) filter (where was.status in ('en_proceso','no_acreditado')) as incomplete_worker_count,
    coalesce(sum(was.required_count), 0) as worker_required_count,
    coalesce(sum(was.satisfied_count), 0) as worker_satisfied_count,
    coalesce(sum(was.blocked_count), 0) as worker_blocked_requirement_count,
    coalesce(sum(was.near_expiry_count), 0) as worker_near_expiry_count
  from public.accreditations a
  left join public.worker_accreditation_statuses was on was.accreditation_id = a.id
  group by a.id
), computed as (
  select
    a.id as accreditation_id,
    a.project_id,
    a.contratista_id,
    a.is_active,
    cs.company_required_count,
    cs.company_submitted_count,
    cs.company_satisfied_count,
    greatest(cs.company_required_count - cs.company_satisfied_count - cs.company_blocked_count, 0) as company_pending_count,
    cs.company_blocked_count,
    cs.company_near_expiry_count,
    ws.active_worker_count,
    ws.approved_worker_count,
    ws.blocked_worker_count,
    ws.incomplete_worker_count,
    ws.worker_required_count,
    ws.worker_satisfied_count,
    ws.worker_blocked_requirement_count,
    ws.worker_near_expiry_count,
    (cs.company_required_count + ws.worker_required_count) as total_required_count,
    (cs.company_satisfied_count + ws.worker_satisfied_count) as total_satisfied_count,
    (cs.company_near_expiry_count + ws.worker_near_expiry_count) as near_expiry_count,
    case
      when a.is_active = false then 'no_acreditado'
      when ws.active_worker_count = 0 then 'no_acreditado'
      when cs.company_blocked_count > 0 or ws.blocked_worker_count > 0 then 'vencido_bloqueado'
      when cs.company_required_count = 0 or ws.worker_required_count = 0 then 'en_proceso'
      when cs.company_satisfied_count = cs.company_required_count
       and ws.approved_worker_count = ws.active_worker_count then 'aprobado'
      else 'en_proceso'
    end as status
  from public.accreditations a
  join company_stats cs on cs.accreditation_id = a.id
  join worker_stats ws on ws.accreditation_id = a.id
)
select
  accreditation_id,
  project_id,
  contratista_id,
  is_active,
  status,
  company_required_count,
  company_submitted_count,
  company_satisfied_count,
  company_pending_count,
  company_blocked_count,
  active_worker_count,
  approved_worker_count,
  blocked_worker_count,
  incomplete_worker_count,
  worker_required_count,
  worker_satisfied_count,
  worker_blocked_requirement_count,
  total_required_count,
  total_satisfied_count,
  near_expiry_count,
  case when total_required_count = 0 then 0::numeric
       else round((total_satisfied_count::numeric * 100) / total_required_count, 1)
  end as compliance_percent,
  (status = 'aprobado') as access_allowed,
  (status = 'aprobado') as payment_allowed
from computed;

revoke all on public.document_statuses from anon;
revoke all on public.worker_accreditation_statuses from anon;
revoke all on public.accreditation_statuses from anon;
grant select on public.document_statuses to authenticated, service_role;
grant select on public.worker_accreditation_statuses to authenticated, service_role;
grant select on public.accreditation_statuses to authenticated, service_role;

create index if not exists idx_requirements_project_target_active
  on public.requirements(project_id, target)
  where is_active = true;
create index if not exists idx_worker_assignments_accreditation_active
  on public.worker_assignments(accreditation_id, worker_id)
  where is_active = true;
create index if not exists idx_document_versions_latest
  on public.document_versions(document_id, version_number desc);
create index if not exists idx_audit_logs_action_created_at
  on public.audit_logs(action, created_at desc);
create index if not exists idx_audit_logs_entity_created_at
  on public.audit_logs(entity_type, entity_id, created_at desc);

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
       and old.rejection_solution is not distinct from new.rejection_solution then
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
      'rejection_reason', new.rejection_reason,
      'rejection_explanation', new.rejection_explanation,
      'rejection_solution', new.rejection_solution,
      'original_filename', new.original_filename
    )
  );

  return new;
end;
$$;

create or replace function private.audit_worker_assignment_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_project_id uuid;
  v_action text;
begin
  select a.project_id into v_project_id
  from public.accreditations a
  where a.id = new.accreditation_id;

  if tg_op = 'INSERT' then
    v_action := 'worker_assigned';
  elsif old.is_active = false and new.is_active = true then
    v_action := 'worker_assigned';
  elsif old.is_active = true and new.is_active = false then
    v_action := 'worker_unassigned';
  else
    return new;
  end if;

  insert into public.audit_logs(
    actor_profile_id, action, entity_type, entity_id, project_id, accreditation_id, details
  ) values (
    (select auth.uid()),
    v_action,
    'worker_assignment',
    new.id,
    v_project_id,
    new.accreditation_id,
    jsonb_build_object('worker_id', new.worker_id, 'is_active', new.is_active)
  );

  return new;
end;
$$;

create or replace function private.audit_requirement_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_action text;
begin
  if tg_op = 'INSERT' then
    v_action := 'requirement_created';
  else
    if old.name is not distinct from new.name
       and old.target is not distinct from new.target
       and old.is_required is not distinct from new.is_required
       and old.frequency is not distinct from new.frequency
       and old.validity_days is not distinct from new.validity_days
       and old.alert_days is not distinct from new.alert_days
       and old.criticality is not distinct from new.criticality
       and old.is_active is not distinct from new.is_active then
      return new;
    end if;
    v_action := 'requirement_updated';
  end if;

  insert into public.audit_logs(
    actor_profile_id, action, entity_type, entity_id, project_id, accreditation_id, details
  ) values (
    (select auth.uid()),
    v_action,
    'requirement',
    new.id,
    new.project_id,
    null,
    jsonb_build_object(
      'name', new.name,
      'target', new.target,
      'is_required', new.is_required,
      'frequency', new.frequency,
      'validity_days', new.validity_days,
      'alert_days', new.alert_days,
      'criticality', new.criticality,
      'is_active', new.is_active
    )
  );

  return new;
end;
$$;

create or replace function private.audit_accreditation_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_action text;
begin
  if tg_op = 'INSERT' then
    v_action := 'accreditation_created';
  elsif old.is_active is distinct from new.is_active then
    v_action := case when new.is_active then 'accreditation_activated' else 'accreditation_deactivated' end;
  else
    return new;
  end if;

  insert into public.audit_logs(
    actor_profile_id, action, entity_type, entity_id, project_id, accreditation_id, details
  ) values (
    (select auth.uid()),
    v_action,
    'accreditation',
    new.id,
    new.project_id,
    new.id,
    jsonb_build_object('contratista_id', new.contratista_id, 'is_active', new.is_active)
  );

  return new;
end;
$$;

revoke all on function private.audit_document_version_change() from public, anon, authenticated;
revoke all on function private.audit_worker_assignment_change() from public, anon, authenticated;
revoke all on function private.audit_requirement_change() from public, anon, authenticated;
revoke all on function private.audit_accreditation_change() from public, anon, authenticated;

drop trigger if exists trg_audit_document_version_change on public.document_versions;
create trigger trg_audit_document_version_change
after insert or update of workflow_status, reviewed_by, reviewed_at, rejection_reason, rejection_explanation, rejection_solution
on public.document_versions
for each row execute function private.audit_document_version_change();

drop trigger if exists trg_audit_worker_assignment_change on public.worker_assignments;
create trigger trg_audit_worker_assignment_change
after insert or update of is_active, unassigned_at
on public.worker_assignments
for each row execute function private.audit_worker_assignment_change();

drop trigger if exists trg_audit_requirement_change on public.requirements;
create trigger trg_audit_requirement_change
after insert or update of name, target, is_required, frequency, validity_days, alert_days, criticality, is_active
on public.requirements
for each row execute function private.audit_requirement_change();

drop trigger if exists trg_audit_accreditation_change on public.accreditations;
create trigger trg_audit_accreditation_change
after insert or update of is_active
on public.accreditations
for each row execute function private.audit_accreditation_change();

comment on view public.document_statuses is 'Estado efectivo de la última versión documental, incluyendo vencimiento y próxima expiración.';
comment on view public.worker_accreditation_statuses is 'Estado derivado de acreditación por trabajador y proyecto.';
comment on view public.accreditation_statuses is 'Fuente oficial del estado global de acreditación, cumplimiento, acceso y pago.';
