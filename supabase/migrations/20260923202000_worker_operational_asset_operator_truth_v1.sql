-- Punto 6 Mandante: una sola verdad operacional para trabajadores que operan activos.
-- Separa ingreso del activo de la habilitación del operador y evita usar worker_assignments.access_status,
-- campo histórico que no representa el estado documental derivado actual.

create or replace view public.worker_accreditation_statuses
with (security_invoker=true) as
with assignment_context as (
  select
    wa.id as assignment_id,
    wa.accreditation_id,
    a.project_id,
    a.contratista_id,
    wa.worker_id,
    w.full_name as worker_name,
    w.rut as worker_rut,
    coalesce(wa.contract_type_snapshot,w.contract_type) is not null
      and coalesce(wa.contract_start_date_snapshot,w.contract_start_date) is not null
      and nullif(btrim(coalesce(wa.job_title,w.job_title,'')),'') is not null
      and coalesce(cardinality(wa.categories),0)>0
      and (
        coalesce(wa.contract_type_snapshot,w.contract_type) is distinct from 'plazo_fijo'
        or coalesce(wa.contract_end_date_snapshot,w.contract_end_date) is not null
      )
      and (
        coalesce(wa.contract_type_snapshot,w.contract_type) is distinct from 'obra_faena'
        or nullif(btrim(coalesce(wa.contract_work_or_task_snapshot,w.contract_work_or_task,'')),'') is not null
      )
      and (
        coalesce(wa.special_labor_regime_snapshot,w.special_labor_regime) is distinct from 'otro'
        or nullif(btrim(coalesce(wa.special_labor_regime_detail_snapshot,w.special_labor_regime_detail,'')),'') is not null
      )
      and (
        not exists(select 1 from public.services s where s.accreditation_id=wa.accreditation_id and s.is_active)
        or wa.service_id is not null
      ) as profile_complete,
    coalesce(wa.contract_start_date_snapshot,w.contract_start_date) is not null
      and coalesce(wa.contract_start_date_snapshot,w.contract_start_date)>current_date as contract_not_started,
    coalesce(wa.contract_end_date_snapshot,w.contract_end_date) is not null
      and coalesce(wa.contract_end_date_snapshot,w.contract_end_date)<current_date as contract_expired
  from public.worker_assignments wa
  join public.accreditations a on a.id=wa.accreditation_id
  join public.workers w on w.id=wa.worker_id
  where wa.is_active
    and wa.assignment_status='activa'
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
    ac.contract_not_started,
    ac.contract_expired,
    count(os.obligation_id) filter (
      where os.is_required and os.criticality<>'advertencia' and os.period_start<=current_date
    ) as required_count,
    count(os.obligation_id) filter (
      where os.is_required and os.criticality<>'advertencia' and os.period_start<=current_date and os.version_id is not null
    ) as submitted_count,
    count(os.obligation_id) filter (
      where os.is_required and os.criticality<>'advertencia' and os.period_start<=current_date
        and os.effective_status in ('aprobado','por_vencer','no_aplica')
    ) as satisfied_count,
    count(os.obligation_id) filter (
      where os.is_required and os.criticality<>'advertencia' and os.period_start<=current_date
        and os.effective_status in ('rechazado','vencido')
    ) as blocked_count,
    count(os.obligation_id) filter (
      where os.is_required and os.criticality<>'advertencia' and os.period_start<=current_date
        and os.effective_status='por_vencer'
    ) as near_expiry_count,
    count(os.obligation_id) filter (
      where os.is_required and os.criticality in ('bloquea_acceso','bloquea_ambas') and os.period_start<=current_date
        and os.effective_status in ('rechazado','vencido')
    ) as access_blocked_count,
    count(os.obligation_id) filter (
      where os.is_required and os.criticality in ('bloquea_acceso','bloquea_ambas') and os.period_start<=current_date
        and os.effective_status in ('pendiente','revision')
    ) as access_pending_count
  from assignment_context ac
  left join public.obligation_statuses os
    on os.worker_assignment_id=ac.assignment_id and os.is_active
  group by
    ac.assignment_id,ac.accreditation_id,ac.project_id,ac.contratista_id,ac.worker_id,
    ac.worker_name,ac.worker_rut,ac.profile_complete,ac.contract_not_started,ac.contract_expired
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
  greatest(required_count-satisfied_count-blocked_count,0::bigint) as pending_count,
  blocked_count,
  near_expiry_count,
  case when required_count=0 then 0::numeric else round(satisfied_count::numeric*100::numeric/required_count::numeric,1) end as compliance_percent,
  case
    when contract_expired then 'vencido_bloqueado'
    when blocked_count>0 then 'vencido_bloqueado'
    when contract_not_started then 'en_proceso'
    when not profile_complete then 'en_proceso'
    when required_count=0 then 'en_proceso'
    when submitted_count=0 then 'no_acreditado'
    when satisfied_count=required_count then 'aprobado'
    else 'en_proceso'
  end as status,
  access_blocked_count,
  access_pending_count,
  not contract_expired
    and not contract_not_started
    and profile_complete
    and access_blocked_count=0
    and access_pending_count=0
    and required_count>0 as access_allowed
from stats;

revoke all on public.worker_accreditation_statuses from anon;
grant select on public.worker_accreditation_statuses to authenticated,service_role;

create or replace view public.worker_operational_permissions
with (security_invoker=true) as
with applicable_gate_requirements as (
  select
    wa.id as worker_assignment_id,
    r.id as requirement_id,
    r.blocks_work,
    r.blocks_assignment
  from public.worker_assignments wa
  join public.accreditations a on a.id=wa.accreditation_id
  join public.requirements r
    on r.project_id=a.project_id
    and r.target='trabajador'
    and r.is_active
    and r.is_required
  where wa.is_active
    and wa.assignment_status='activa'
    and (r.service_id is null or r.service_id=wa.service_id)
    and (
      case
        when jsonb_typeof(r.applicability->'categories')='array' then
          jsonb_array_length(r.applicability->'categories')=0
          or exists (
            select 1
            from jsonb_array_elements_text(r.applicability->'categories') cat(value)
            where lower(btrim(cat.value))='general'
               or exists (
                 select 1
                 from unnest(coalesce(wa.categories,array[]::text[])) worker_category
                 where lower(btrim(worker_category))=lower(btrim(cat.value))
               )
          )
        else true
      end
    )
),
gate_states as (
  select
    agr.worker_assignment_id,
    agr.requirement_id,
    agr.blocks_work,
    agr.blocks_assignment,
    coalesce(current_obligation.effective_status,'pendiente') as effective_status
  from applicable_gate_requirements agr
  left join lateral (
    select os.effective_status
    from public.obligation_statuses os
    where os.worker_assignment_id=agr.worker_assignment_id
      and os.requirement_id=agr.requirement_id
      and os.is_active
      and os.period_start<=current_date
    order by os.period_start desc,os.due_date desc
    limit 1
  ) current_obligation on true
),
gate_counts as (
  select
    worker_assignment_id,
    count(*) filter (
      where blocks_work and effective_status in ('rechazado','vencido')
    ) as work_blocked_count,
    count(*) filter (
      where blocks_work and effective_status not in ('aprobado','por_vencer','no_aplica','rechazado','vencido')
    ) as work_pending_count,
    count(*) filter (
      where blocks_assignment and effective_status in ('rechazado','vencido')
    ) as assignment_blocked_count,
    count(*) filter (
      where blocks_assignment and effective_status not in ('aprobado','por_vencer','no_aplica','rechazado','vencido')
    ) as assignment_pending_count
  from gate_states
  group by worker_assignment_id
)
select
  was.worker_assignment_id,
  was.accreditation_id,
  was.project_id,
  was.contratista_id,
  was.worker_id,
  was.worker_name,
  was.worker_rut,
  was.access_allowed,
  was.access_allowed
    and coalesce(gc.work_blocked_count,0)=0
    and coalesce(gc.work_pending_count,0)=0 as work_allowed,
  was.access_allowed
    and coalesce(gc.assignment_blocked_count,0)=0
    and coalesce(gc.assignment_pending_count,0)=0 as assignment_allowed,
  coalesce(gc.work_blocked_count,0)::integer as work_blocked_count,
  coalesce(gc.work_pending_count,0)::integer as work_pending_count,
  coalesce(gc.assignment_blocked_count,0)::integer as assignment_blocked_count,
  coalesce(gc.assignment_pending_count,0)::integer as assignment_pending_count
from public.worker_accreditation_statuses was
left join gate_counts gc on gc.worker_assignment_id=was.worker_assignment_id;

revoke all on public.worker_operational_permissions from anon;
grant select on public.worker_operational_permissions to authenticated,service_role;

create or replace view public.asset_operator_candidates
with (security_invoker=true) as
select
  wa.id as worker_assignment_id,
  a.id as accreditation_id,
  p.integration_key as project_key,
  c.integration_key as contractor_key,
  w.id as worker_id,
  w.full_name,
  w.rut,
  coalesce(wa.job_title,w.job_title) as job_title,
  'habilitado'::text as access_status
from public.worker_assignments wa
join public.accreditations a on a.id=wa.accreditation_id
join public.projects p on p.id=a.project_id
join public.contratistas c on c.id=a.contratista_id
join public.workers w on w.id=wa.worker_id
join public.worker_operational_permissions perm on perm.worker_assignment_id=wa.id
where wa.is_active
  and wa.assignment_status='activa'
  and perm.access_allowed
  and perm.work_allowed
  and perm.assignment_allowed
  and a.is_active
  and p.status='active'
  and w.is_active
  and (coalesce(wa.contract_start_date_snapshot,w.contract_start_date) is null or coalesce(wa.contract_start_date_snapshot,w.contract_start_date)<=current_date)
  and (coalesce(wa.contract_end_date_snapshot,w.contract_end_date) is null or coalesce(wa.contract_end_date_snapshot,w.contract_end_date)>=current_date);

revoke all on public.asset_operator_candidates from anon;
grant select on public.asset_operator_candidates to authenticated,service_role;

create or replace view public.asset_operator_assignment_details
with (security_invoker=true) as
select
  ao.id,
  ao.asset_id,
  ao.worker_assignment_id,
  w.full_name,
  w.rut,
  coalesce(wa.job_title,w.job_title) as job_title,
  ao.valid_from,
  ao.valid_until,
  ao.status,
  ao.created_at,
  case
    when ao.status='finalizado' then 'finalizado'
    when ao.status='suspendido' then 'suspendido'
    when ao.valid_from>current_date then 'suspendido'
    when ao.valid_until is not null and ao.valid_until<current_date then 'suspendido'
    when not ast.is_active or not ac.is_active or p.status<>'active' then 'suspendido'
    when not coalesce(perm.access_allowed,false) then 'suspendido'
    when not coalesce(perm.work_allowed,false) then 'suspendido'
    when not coalesce(perm.assignment_allowed,false) then 'suspendido'
    else 'activo'
  end as effective_status,
  ao.status='activo'
    and ao.valid_from<=current_date
    and (ao.valid_until is null or ao.valid_until>=current_date)
    and ast.is_active
    and ac.is_active
    and p.status='active'
    and coalesce(perm.access_allowed,false)
    and coalesce(perm.work_allowed,false)
    and coalesce(perm.assignment_allowed,false) as operationally_eligible,
  case
    when ao.status='finalizado' then 'Asignación finalizada.'
    when ao.status='suspendido' then 'Asignación suspendida.'
    when ao.valid_from>current_date then 'La vigencia del operador aún no comienza.'
    when ao.valid_until is not null and ao.valid_until<current_date then 'La vigencia del operador finalizó.'
    when not ast.is_active then 'El activo está retirado.'
    when not ac.is_active or p.status<>'active' then 'El proyecto o la relación del contratista está en modo histórico.'
    when not coalesce(perm.access_allowed,false) then 'El trabajador no tiene ingreso habilitado.'
    when not coalesce(perm.work_allowed,false) then 'El trabajador no está habilitado para trabajar.'
    when not coalesce(perm.assignment_allowed,false) then 'El trabajador no está habilitado para esta asignación operativa.'
    else null
  end as issue_reason
from public.asset_operator_assignments ao
join public.worker_assignments wa on wa.id=ao.worker_assignment_id
join public.workers w on w.id=wa.worker_id
join public.assets ast on ast.id=ao.asset_id
join public.accreditations ac on ac.id=ast.accreditation_id
join public.projects p on p.id=ac.project_id
left join public.worker_operational_permissions perm on perm.worker_assignment_id=wa.id;

revoke all on public.asset_operator_assignment_details from anon;
grant select on public.asset_operator_assignment_details to authenticated,service_role;

create or replace function private.validate_asset_operator_context()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  v_asset_acc uuid;
  v_asset_active boolean;
  v_acc_active boolean;
  v_project_status text;
  v_worker_acc uuid;
  v_assignment_active boolean;
  v_assignment_status text;
  v_worker_active boolean;
  v_contract_start date;
  v_contract_end date;
  v_access_allowed boolean;
  v_work_allowed boolean;
  v_assignment_allowed boolean;
begin
  if tg_op='UPDATE' then
    if new.asset_id is distinct from old.asset_id
       or new.worker_assignment_id is distinct from old.worker_assignment_id
       or new.valid_from is distinct from old.valid_from
       or new.created_by is distinct from old.created_by then
      raise exception 'La identidad de una asignación de operador es inmutable';
    end if;
    if old.status='finalizado' and new.status<>'finalizado' then
      raise exception 'Una asignación de operador finalizada no puede reactivarse';
    end if;
    if new.status='finalizado' then
      new.valid_until:=coalesce(new.valid_until,current_date);
      return new;
    end if;
  end if;

  select ast.accreditation_id,ast.is_active,ac.is_active,p.status
  into v_asset_acc,v_asset_active,v_acc_active,v_project_status
  from public.assets ast
  join public.accreditations ac on ac.id=ast.accreditation_id
  join public.projects p on p.id=ac.project_id
  where ast.id=new.asset_id;

  select
    wa.accreditation_id,
    wa.is_active,
    wa.assignment_status,
    w.is_active,
    coalesce(wa.contract_start_date_snapshot,w.contract_start_date),
    coalesce(wa.contract_end_date_snapshot,w.contract_end_date),
    coalesce(perm.access_allowed,false),
    coalesce(perm.work_allowed,false),
    coalesce(perm.assignment_allowed,false)
  into
    v_worker_acc,v_assignment_active,v_assignment_status,v_worker_active,
    v_contract_start,v_contract_end,v_access_allowed,v_work_allowed,v_assignment_allowed
  from public.worker_assignments wa
  join public.workers w on w.id=wa.worker_id
  left join public.worker_operational_permissions perm on perm.worker_assignment_id=wa.id
  where wa.id=new.worker_assignment_id;

  if v_asset_acc is null or v_worker_acc is null or v_asset_acc<>v_worker_acc then
    raise exception 'El operador y el activo deben pertenecer a la misma acreditación';
  end if;
  if not v_asset_active or not v_acc_active or v_project_status<>'active' then
    raise exception 'No se pueden asignar operadores a un activo o proyecto histórico';
  end if;
  if not v_assignment_active or v_assignment_status<>'activa' or not v_worker_active then
    raise exception 'Solo un trabajador con asignación activa puede operar el activo';
  end if;
  if not v_access_allowed then
    raise exception 'El trabajador no tiene ingreso habilitado';
  end if;
  if not v_work_allowed then
    raise exception 'El trabajador no está habilitado para trabajar';
  end if;
  if not v_assignment_allowed then
    raise exception 'El trabajador no está habilitado para esta asignación operativa';
  end if;
  if v_contract_start is not null and new.valid_from<v_contract_start then
    raise exception 'La vigencia del operador no puede comenzar antes de su contrato';
  end if;
  if v_contract_end is not null then
    if new.valid_from>v_contract_end then
      raise exception 'El contrato del operador ya finalizó';
    end if;
    if new.valid_until is null then
      new.valid_until:=v_contract_end;
    elsif new.valid_until>v_contract_end then
      raise exception 'La vigencia del operador no puede superar el término de su contrato';
    end if;
  end if;
  return new;
end
$$;

revoke all on function private.validate_asset_operator_context() from public,anon,authenticated;

create or replace function private.finalize_asset_operators_after_worker_withdrawal()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  if (old.is_active and not new.is_active)
     or (old.assignment_status='activa' and new.assignment_status<>'activa') then
    update public.asset_operator_assignments
    set status='finalizado',
        valid_until=case
          when valid_until is null or valid_until>current_date then current_date
          else valid_until
        end
    where worker_assignment_id=new.id
      and status<>'finalizado';
  end if;
  return new;
end
$$;

revoke all on function private.finalize_asset_operators_after_worker_withdrawal() from public,anon,authenticated;

drop trigger if exists worker_assignments_finalize_asset_operators on public.worker_assignments;
create trigger worker_assignments_finalize_asset_operators
after update of is_active,assignment_status on public.worker_assignments
for each row execute function private.finalize_asset_operators_after_worker_withdrawal();

create or replace view public.asset_registry
with (security_invoker=true) as
select
  a.id,
  a.integration_key,
  p.integration_key as project_key,
  c.integration_key as contractor_key,
  s.integration_key as service_key,
  a.accreditation_id,
  a.service_id,
  a.asset_type,
  a.identifier,
  a.name,
  a.brand,
  a.model,
  a.year,
  a.owner_name,
  a.operator_name,
  case
    when not a.is_active or not ac.is_active or p.status<>'active' then 'inactivo'
    when a.service_id is not null and not coalesce(svc.operational,false) then 'bloqueado'
    when coalesce(ins.blocked,false) or coalesce(maint.blocked,false) or coalesce(d.blocked_documents,0)>0 then 'bloqueado'
    when coalesce(ins.pending,false) or coalesce(d.unsatisfied_documents,0)>0 then 'en_revision'
    when coalesce(d.required_documents,0)=0 then 'pendiente'
    else 'habilitado'
  end as status,
  a.is_active
    and ac.is_active
    and p.status='active'
    and (a.service_id is null or coalesce(svc.operational,false))
    and coalesce(d.required_documents,0)>0
    and coalesce(d.access_unsatisfied_documents,0)=0
    and not coalesce(ins.blocked,false)
    and not coalesce(ins.pending,false)
    and not coalesce(maint.blocked,false) as access_allowed,
  a.notes,
  a.is_active,
  coalesce(d.required_documents,0)::integer as total_documents,
  coalesce(d.satisfied_documents,0)::integer as approved_documents,
  coalesce(d.blocked_documents,0)::integer as blocking_documents,
  d.next_expiry,
  a.retired_at,
  a.retired_by,
  a.retirement_reason,
  coalesce(d.unsatisfied_documents,0)::integer as pending_documents,
  ins.result as inspection_status,
  ins.next_inspection_date,
  maint.next_due_at as next_maintenance_date,
  coalesce(op.active_operators,0)::integer as active_operators,
  a.service_id is null or coalesce(svc.operational,false) as service_operational
from public.assets a
join public.accreditations ac on ac.id=a.accreditation_id
join public.projects p on p.id=ac.project_id
join public.contratistas c on c.id=ac.contratista_id
left join public.services s on s.id=a.service_id
left join lateral (
  select s2.id is not null
    and s2.accreditation_id=a.accreditation_id
    and s2.is_active
    and s2.status='activo'
    and (s2.starts_at is null or s2.starts_at<=current_date)
    and (s2.ends_at is null or s2.ends_at>=current_date) as operational
  from public.services s2
  where s2.id=a.service_id
) svc on true
left join lateral (
  select
    count(*) filter (where t.is_required) as required_documents,
    count(*) filter (
      where t.is_required and ad.id is not null and ad.status='aprobado'
        and (ad.expires_at is null or ad.expires_at>=current_date)
    ) as satisfied_documents,
    count(*) filter (
      where t.is_required and (
        ad.id is null or ad.status<>'aprobado' or (ad.expires_at is not null and ad.expires_at<current_date)
      )
    ) as unsatisfied_documents,
    count(*) filter (
      where t.is_required and t.blocks_access and (
        ad.id is null or ad.status<>'aprobado' or (ad.expires_at is not null and ad.expires_at<current_date)
      )
    ) as access_unsatisfied_documents,
    count(*) filter (
      where t.is_required and t.blocks_access and ad.id is not null
        and (ad.status in ('rechazado','vencido') or (ad.expires_at is not null and ad.expires_at<current_date))
    ) as blocked_documents,
    min(ad.expires_at) filter (
      where t.is_required and ad.status='aprobado' and ad.expires_at>=current_date
    ) as next_expiry
  from public.asset_requirement_templates t
  left join public.asset_documents ad
    on ad.asset_id=a.id and lower(btrim(ad.document_type))=lower(btrim(t.document_type))
  where t.project_id=ac.project_id and t.asset_type=a.asset_type and t.is_active
) d on true
left join lateral (
  select
    ai.result,
    ai.next_inspection_date,
    ai.result='rechazado' or (ai.next_inspection_date is not null and ai.next_inspection_date<current_date) as blocked,
    ai.result='observado' as pending
  from public.asset_inspections ai
  where ai.asset_id=a.id
  order by ai.inspection_date desc,ai.created_at desc
  limit 1
) ins on true
left join lateral (
  select
    am.next_due_at,
    am.next_due_at is not null and am.next_due_at<current_date as blocked
  from public.asset_maintenance am
  where am.asset_id=a.id
  order by am.performed_at desc,am.created_at desc
  limit 1
) maint on true
left join lateral (
  select count(*) as active_operators
  from public.asset_operator_assignments ao
  join public.worker_operational_permissions perm on perm.worker_assignment_id=ao.worker_assignment_id
  where ao.asset_id=a.id
    and ao.status='activo'
    and ao.valid_from<=current_date
    and (ao.valid_until is null or ao.valid_until>=current_date)
    and perm.access_allowed
    and perm.work_allowed
    and perm.assignment_allowed
) op on true;

revoke all on public.asset_registry from anon;
grant select on public.asset_registry to authenticated,service_role;

-- Recalcular estados materiales de activos existentes sin cambiar su historial.
do $$
declare item record;
begin
  for item in select id from public.assets loop
    perform private.refresh_asset_status(item.id);
  end loop;
end
$$;
