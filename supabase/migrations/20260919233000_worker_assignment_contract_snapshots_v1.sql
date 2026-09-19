alter table public.worker_assignments
  add column if not exists contract_type_snapshot text,
  add column if not exists contract_start_date_snapshot date,
  add column if not exists contract_end_date_snapshot date,
  add column if not exists contract_work_or_task_snapshot text,
  add column if not exists special_labor_regime_snapshot text,
  add column if not exists special_labor_regime_detail_snapshot text;

update public.worker_assignments wa
set
  contract_type_snapshot = w.contract_type,
  contract_start_date_snapshot = w.contract_start_date,
  contract_end_date_snapshot = w.contract_end_date,
  contract_work_or_task_snapshot = w.contract_work_or_task,
  special_labor_regime_snapshot = w.special_labor_regime,
  special_labor_regime_detail_snapshot = w.special_labor_regime_detail
from public.workers w
where w.id = wa.worker_id
  and wa.is_active
  and wa.assignment_status = 'activa'
  and wa.contract_type_snapshot is null;

alter table public.worker_assignments
  drop constraint if exists worker_assignments_contract_type_snapshot_valid,
  drop constraint if exists worker_assignments_contract_dates_snapshot_valid,
  drop constraint if exists worker_assignments_fixed_term_snapshot_complete,
  drop constraint if exists worker_assignments_work_task_snapshot_complete,
  drop constraint if exists worker_assignments_special_regime_snapshot_complete,
  drop constraint if exists worker_assignments_entry_within_contract_snapshot,
  drop constraint if exists worker_assignments_entry_before_contract_end_snapshot;

alter table public.worker_assignments
  add constraint worker_assignments_contract_type_snapshot_valid
    check (contract_type_snapshot is null or contract_type_snapshot = any(array['indefinido','plazo_fijo','obra_faena'])),
  add constraint worker_assignments_contract_dates_snapshot_valid
    check (
      contract_start_date_snapshot is null
      or contract_end_date_snapshot is null
      or contract_end_date_snapshot >= contract_start_date_snapshot
    ),
  add constraint worker_assignments_fixed_term_snapshot_complete
    check (contract_type_snapshot is distinct from 'plazo_fijo' or contract_end_date_snapshot is not null),
  add constraint worker_assignments_work_task_snapshot_complete
    check (
      contract_type_snapshot is distinct from 'obra_faena'
      or nullif(btrim(contract_work_or_task_snapshot), '') is not null
    ),
  add constraint worker_assignments_special_regime_snapshot_complete
    check (
      special_labor_regime_snapshot is distinct from 'otro'
      or nullif(btrim(special_labor_regime_detail_snapshot), '') is not null
    ),
  add constraint worker_assignments_entry_within_contract_snapshot
    check (
      contract_start_date_snapshot is null
      or assigned_at::date >= contract_start_date_snapshot
    ),
  add constraint worker_assignments_entry_before_contract_end_snapshot
    check (
      contract_end_date_snapshot is null
      or assigned_at::date <= contract_end_date_snapshot
    );

create or replace function private.fill_worker_assignment_contract_snapshot()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_worker public.workers%rowtype;
begin
  select * into v_worker
  from public.workers
  where id = new.worker_id;

  if new.contract_type_snapshot is null then
    new.contract_type_snapshot := v_worker.contract_type;
  end if;
  if new.contract_start_date_snapshot is null then
    new.contract_start_date_snapshot := v_worker.contract_start_date;
  end if;
  if new.contract_end_date_snapshot is null then
    new.contract_end_date_snapshot := v_worker.contract_end_date;
  end if;
  if new.contract_work_or_task_snapshot is null then
    new.contract_work_or_task_snapshot := v_worker.contract_work_or_task;
  end if;
  if new.special_labor_regime_snapshot is null then
    new.special_labor_regime_snapshot := v_worker.special_labor_regime;
  end if;
  if new.special_labor_regime_detail_snapshot is null then
    new.special_labor_regime_detail_snapshot := v_worker.special_labor_regime_detail;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_fill_worker_assignment_contract_snapshot on public.worker_assignments;
create trigger trg_fill_worker_assignment_contract_snapshot
before insert on public.worker_assignments
for each row execute function private.fill_worker_assignment_contract_snapshot();

create or replace function private.guard_worker_assignment_period_reactivation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (old.is_active = false or old.assignment_status <> 'activa')
     and new.is_active = true
     and new.assignment_status = 'activa' then
    raise exception 'Un período histórico no puede reactivarse; crea una nueva asignación para el reingreso';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_worker_assignment_period_reactivation on public.worker_assignments;
create trigger trg_guard_worker_assignment_period_reactivation
before update of is_active, assignment_status on public.worker_assignments
for each row execute function private.guard_worker_assignment_period_reactivation();

create or replace function private.refresh_active_assignment_contract_snapshot()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.contract_type is not distinct from new.contract_type
     and old.contract_start_date is not distinct from new.contract_start_date
     and old.contract_end_date is not distinct from new.contract_end_date
     and old.contract_work_or_task is not distinct from new.contract_work_or_task
     and old.special_labor_regime is not distinct from new.special_labor_regime
     and old.special_labor_regime_detail is not distinct from new.special_labor_regime_detail then
    return new;
  end if;

  update public.worker_assignments
  set
    contract_type_snapshot = new.contract_type,
    contract_start_date_snapshot = new.contract_start_date,
    contract_end_date_snapshot = new.contract_end_date,
    contract_work_or_task_snapshot = new.contract_work_or_task,
    special_labor_regime_snapshot = new.special_labor_regime,
    special_labor_regime_detail_snapshot = new.special_labor_regime_detail
  where worker_id = new.id
    and is_active
    and assignment_status = 'activa';

  return new;
end;
$$;

revoke all on function private.refresh_active_assignment_contract_snapshot() from public, anon, authenticated;

drop trigger if exists trg_refresh_active_assignment_contract_snapshot on public.workers;
create trigger trg_refresh_active_assignment_contract_snapshot
after update of contract_type, contract_start_date, contract_end_date, contract_work_or_task, special_labor_regime, special_labor_regime_detail
on public.workers
for each row execute function private.refresh_active_assignment_contract_snapshot();

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
  elsif old.is_active = true and new.is_active = false then
    v_action := 'worker_unassigned';
  elsif old.service_id is distinct from new.service_id
     or old.job_title is distinct from new.job_title
     or old.categories is distinct from new.categories
     or old.assignment_status is distinct from new.assignment_status
     or old.access_status is distinct from new.access_status
     or old.assigned_at is distinct from new.assigned_at
     or old.unassigned_at is distinct from new.unassigned_at
     or old.contract_type_snapshot is distinct from new.contract_type_snapshot
     or old.contract_start_date_snapshot is distinct from new.contract_start_date_snapshot
     or old.contract_end_date_snapshot is distinct from new.contract_end_date_snapshot
     or old.contract_work_or_task_snapshot is distinct from new.contract_work_or_task_snapshot
     or old.special_labor_regime_snapshot is distinct from new.special_labor_regime_snapshot
     or old.special_labor_regime_detail_snapshot is distinct from new.special_labor_regime_detail_snapshot then
    v_action := 'worker_assignment_updated';
  else
    return new;
  end if;

  insert into public.audit_logs(
    actor_profile_id, action, entity_type, entity_id, project_id, accreditation_id, details
  ) values (
    (select auth.uid()), v_action, 'worker_assignment', new.id, v_project_id, new.accreditation_id,
    jsonb_build_object(
      'worker_id', new.worker_id,
      'service_id', new.service_id,
      'job_title', new.job_title,
      'categories', new.categories,
      'assignment_status', new.assignment_status,
      'access_status', new.access_status,
      'is_active', new.is_active,
      'assigned_at', new.assigned_at,
      'unassigned_at', new.unassigned_at,
      'contract_snapshot', jsonb_build_object(
        'type', new.contract_type_snapshot,
        'start_date', new.contract_start_date_snapshot,
        'end_date', new.contract_end_date_snapshot,
        'work_or_task', new.contract_work_or_task_snapshot,
        'special_regime', new.special_labor_regime_snapshot,
        'special_regime_detail', new.special_labor_regime_detail_snapshot
      )
    )
  );
  return new;
end;
$$;

revoke all on function private.audit_worker_assignment_change() from public, anon, authenticated;

drop trigger if exists trg_audit_worker_assignment_change on public.worker_assignments;
create trigger trg_audit_worker_assignment_change
after insert or update of is_active, service_id, job_title, categories, assignment_status, access_status, assigned_at, unassigned_at, contract_type_snapshot, contract_start_date_snapshot, contract_end_date_snapshot, contract_work_or_task_snapshot, special_labor_regime_snapshot, special_labor_regime_detail_snapshot
on public.worker_assignments
for each row execute function private.audit_worker_assignment_change();

create or replace view public.worker_accreditation_statuses
with (security_invoker = true)
as
with assignment_context as (
  select
    wa.id as assignment_id,
    wa.accreditation_id,
    a.project_id,
    a.contratista_id,
    wa.worker_id,
    w.full_name as worker_name,
    w.rut as worker_rut,
    (
      coalesce(wa.contract_type_snapshot, w.contract_type) is not null
      and coalesce(wa.contract_start_date_snapshot, w.contract_start_date) is not null
      and nullif(btrim(coalesce(wa.job_title, w.job_title, '')), '') is not null
      and coalesce(cardinality(wa.categories), 0) > 0
      and (
        coalesce(wa.contract_type_snapshot, w.contract_type) is distinct from 'plazo_fijo'
        or coalesce(wa.contract_end_date_snapshot, w.contract_end_date) is not null
      )
      and (
        coalesce(wa.contract_type_snapshot, w.contract_type) is distinct from 'obra_faena'
        or nullif(btrim(coalesce(wa.contract_work_or_task_snapshot, w.contract_work_or_task, '')), '') is not null
      )
      and (
        coalesce(wa.special_labor_regime_snapshot, w.special_labor_regime) is distinct from 'otro'
        or nullif(btrim(coalesce(wa.special_labor_regime_detail_snapshot, w.special_labor_regime_detail, '')), '') is not null
      )
      and (
        coalesce(wa.contract_start_date_snapshot, w.contract_start_date) is null
        or wa.assigned_at::date >= coalesce(wa.contract_start_date_snapshot, w.contract_start_date)
      )
      and (
        coalesce(wa.contract_end_date_snapshot, w.contract_end_date) is null
        or wa.assigned_at::date <= coalesce(wa.contract_end_date_snapshot, w.contract_end_date)
      )
      and (
        not exists (
          select 1
          from public.services s
          where s.accreditation_id = wa.accreditation_id
            and s.is_active
        )
        or wa.service_id is not null
      )
    ) as profile_complete,
    (
      coalesce(wa.contract_end_date_snapshot, w.contract_end_date) is not null
      and coalesce(wa.contract_end_date_snapshot, w.contract_end_date) < current_date
    ) as contract_expired
  from public.worker_assignments wa
  join public.accreditations a on a.id = wa.accreditation_id
  join public.workers w on w.id = wa.worker_id
  where wa.is_active
    and wa.assignment_status = 'activa'
    and a.is_active
    and w.is_active
),
stats as (
  select
    ac.assignment_id,
    ac.accreditation_id,
    ac.project_id,
    ac.contratista_id,
    ac.worker_id,
    ac.worker_name,
    ac.worker_rut,
    ac.profile_complete,
    ac.contract_expired,
    count(os.obligation_id) filter (
      where os.is_required and os.criticality <> 'advertencia' and os.period_start <= current_date
    ) as required_count,
    count(os.obligation_id) filter (
      where os.is_required and os.criticality <> 'advertencia' and os.period_start <= current_date and os.version_id is not null
    ) as submitted_count,
    count(os.obligation_id) filter (
      where os.is_required and os.criticality <> 'advertencia' and os.period_start <= current_date
        and os.effective_status = any(array['aprobado','por_vencer','no_aplica'])
    ) as satisfied_count,
    count(os.obligation_id) filter (
      where os.is_required and os.criticality <> 'advertencia' and os.period_start <= current_date
        and os.effective_status = any(array['rechazado','vencido'])
    ) as blocked_count,
    count(os.obligation_id) filter (
      where os.is_required and os.criticality <> 'advertencia' and os.period_start <= current_date
        and os.effective_status = 'por_vencer'
    ) as near_expiry_count,
    count(os.obligation_id) filter (
      where os.is_required and os.criticality = any(array['bloquea_acceso','bloquea_ambas'])
        and os.period_start <= current_date and os.effective_status = any(array['rechazado','vencido'])
    ) as access_blocked_count,
    count(os.obligation_id) filter (
      where os.is_required and os.criticality = any(array['bloquea_acceso','bloquea_ambas'])
        and os.period_start <= current_date and os.effective_status = any(array['pendiente','revision'])
    ) as access_pending_count
  from assignment_context ac
  left join public.obligation_statuses os
    on os.worker_assignment_id = ac.assignment_id and os.is_active
  group by
    ac.assignment_id, ac.accreditation_id, ac.project_id, ac.contratista_id,
    ac.worker_id, ac.worker_name, ac.worker_rut, ac.profile_complete, ac.contract_expired
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
  greatest(required_count - satisfied_count - blocked_count, 0::bigint) as pending_count,
  blocked_count,
  near_expiry_count,
  case when required_count = 0 then 0::numeric
       else round(satisfied_count::numeric * 100::numeric / required_count::numeric, 1)
  end as compliance_percent,
  case
    when contract_expired then 'vencido_bloqueado'::text
    when blocked_count > 0 then 'vencido_bloqueado'::text
    when not profile_complete then 'en_proceso'::text
    when required_count = 0 then 'en_proceso'::text
    when submitted_count = 0 then 'no_acreditado'::text
    when satisfied_count = required_count then 'aprobado'::text
    else 'en_proceso'::text
  end as status,
  access_blocked_count,
  access_pending_count,
  (
    not contract_expired
    and profile_complete
    and access_blocked_count = 0
    and access_pending_count = 0
    and required_count > 0
  ) as access_allowed
from stats;
