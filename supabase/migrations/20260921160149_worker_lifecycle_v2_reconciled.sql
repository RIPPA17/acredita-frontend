begin;

alter table public.worker_assignments
  drop constraint if exists worker_assignments_unique;

create unique index if not exists worker_assignments_one_active_per_worker
  on public.worker_assignments(accreditation_id, worker_id)
  where is_active and assignment_status = 'activa';

create or replace function private.audit_worker_profile_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_action text;
begin
  if tg_op = 'INSERT' then
    v_action := 'worker_created';
  elsif old.full_name is distinct from new.full_name
     or old.job_title is distinct from new.job_title
     or old.contract_type is distinct from new.contract_type
     or old.contract_start_date is distinct from new.contract_start_date
     or old.contract_end_date is distinct from new.contract_end_date
     or old.contract_work_or_task is distinct from new.contract_work_or_task
     or old.special_labor_regime is distinct from new.special_labor_regime
     or old.special_labor_regime_detail is distinct from new.special_labor_regime_detail then
    v_action := 'worker_profile_updated';
  else
    return new;
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
    (select auth.uid()),
    v_action,
    'worker',
    new.id,
    null,
    null,
    jsonb_build_object(
      'contratista_id', new.contratista_id,
      'rut', new.rut,
      'before', case when tg_op = 'UPDATE' then jsonb_build_object(
        'full_name', old.full_name,
        'job_title', old.job_title,
        'contract_type', old.contract_type,
        'contract_start_date', old.contract_start_date,
        'contract_end_date', old.contract_end_date,
        'contract_work_or_task', old.contract_work_or_task,
        'special_labor_regime', old.special_labor_regime,
        'special_labor_regime_detail', old.special_labor_regime_detail
      ) else null end,
      'after', jsonb_build_object(
        'full_name', new.full_name,
        'job_title', new.job_title,
        'contract_type', new.contract_type,
        'contract_start_date', new.contract_start_date,
        'contract_end_date', new.contract_end_date,
        'contract_work_or_task', new.contract_work_or_task,
        'special_labor_regime', new.special_labor_regime,
        'special_labor_regime_detail', new.special_labor_regime_detail
      )
    )
  );

  return new;
end;
$function$;

revoke all on function private.audit_worker_profile_change() from public;
revoke all on function private.audit_worker_profile_change() from anon;
revoke all on function private.audit_worker_profile_change() from authenticated;

drop trigger if exists trg_audit_worker_profile_change on public.workers;
create trigger trg_audit_worker_profile_change
after insert or update on public.workers
for each row execute function private.audit_worker_profile_change();

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
      w.contract_type is not null
      and w.contract_start_date is not null
      and nullif(btrim(coalesce(wa.job_title, w.job_title, '')), '') is not null
      and coalesce(cardinality(wa.categories), 0) > 0
      and (w.contract_type is distinct from 'plazo_fijo' or w.contract_end_date is not null)
      and (w.contract_type is distinct from 'obra_faena' or nullif(btrim(w.contract_work_or_task), '') is not null)
      and (w.special_labor_regime is distinct from 'otro' or nullif(btrim(w.special_labor_regime_detail), '') is not null)
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
    (w.contract_end_date is not null and w.contract_end_date < current_date) as contract_expired
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
      where os.is_required
        and os.criticality <> 'advertencia'
        and os.period_start <= current_date
    ) as required_count,
    count(os.obligation_id) filter (
      where os.is_required
        and os.criticality <> 'advertencia'
        and os.period_start <= current_date
        and os.version_id is not null
    ) as submitted_count,
    count(os.obligation_id) filter (
      where os.is_required
        and os.criticality <> 'advertencia'
        and os.period_start <= current_date
        and os.effective_status = any(array['aprobado','por_vencer','no_aplica'])
    ) as satisfied_count,
    count(os.obligation_id) filter (
      where os.is_required
        and os.criticality <> 'advertencia'
        and os.period_start <= current_date
        and os.effective_status = any(array['rechazado','vencido'])
    ) as blocked_count,
    count(os.obligation_id) filter (
      where os.is_required
        and os.criticality <> 'advertencia'
        and os.period_start <= current_date
        and os.effective_status = 'por_vencer'
    ) as near_expiry_count,
    count(os.obligation_id) filter (
      where os.is_required
        and os.criticality = any(array['bloquea_acceso','bloquea_ambas'])
        and os.period_start <= current_date
        and os.effective_status = any(array['rechazado','vencido'])
    ) as access_blocked_count,
    count(os.obligation_id) filter (
      where os.is_required
        and os.criticality = any(array['bloquea_acceso','bloquea_ambas'])
        and os.period_start <= current_date
        and os.effective_status = any(array['pendiente','revision'])
    ) as access_pending_count
  from assignment_context ac
  left join public.obligation_statuses os
    on os.worker_assignment_id = ac.assignment_id
   and os.is_active
  group by
    ac.assignment_id,
    ac.accreditation_id,
    ac.project_id,
    ac.contratista_id,
    ac.worker_id,
    ac.worker_name,
    ac.worker_rut,
    ac.profile_complete,
    ac.contract_expired
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
  case
    when required_count = 0 then 0::numeric
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

commit;
