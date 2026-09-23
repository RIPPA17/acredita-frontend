
create or replace function private.apply_project_archive_lifecycle()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_obligations integer := 0;
  v_assignments integer := 0;
  v_services integer := 0;
  v_operators integer := 0;
  v_assets integer := 0;
  v_accreditations integer := 0;
  v_closed_periods integer := 0;
  v_cancelled_periods integer := 0;
begin
  if old.status='archived' or new.status<>'archived' then
    return new;
  end if;

  update public.worker_assignments wa
  set is_active=false,
      assignment_status='baja',
      access_status='bloqueado',
      unassigned_at=coalesce(wa.unassigned_at,now())
  from public.accreditations a
  where wa.accreditation_id=a.id
    and a.project_id=new.id
    and wa.is_active;
  get diagnostics v_assignments=row_count;

  update public.services s
  set is_active=false,
      status='finalizado',
      ends_at=case
        when s.starts_at is not null and coalesce(s.ends_at,current_date)<s.starts_at then s.starts_at
        when s.ends_at is null or s.ends_at>current_date then current_date
        else s.ends_at
      end,
      updated_at=now()
  from public.accreditations a
  where s.accreditation_id=a.id
    and a.project_id=new.id
    and (s.is_active or s.status<>'finalizado');
  get diagnostics v_services=row_count;

  update public.asset_operator_assignments ao
  set status='finalizado',
      valid_until=coalesce(ao.valid_until,greatest(ao.valid_from,current_date))
  from public.assets ast
  join public.accreditations a on a.id=ast.accreditation_id
  where ao.asset_id=ast.id
    and a.project_id=new.id
    and ao.status<>'finalizado';
  get diagnostics v_operators=row_count;

  update public.assets ast
  set is_active=false,
      status='inactivo',
      access_allowed=false,
      retired_at=coalesce(ast.retired_at,now()),
      retired_by=coalesce(ast.retired_by,v_uid),
      retirement_reason=coalesce(nullif(btrim(ast.retirement_reason),''),
        'Cierre de proyecto: '||coalesce(new.archive_reason,'cierre histórico')),
      updated_at=now()
  from public.accreditations a
  where ast.accreditation_id=a.id
    and a.project_id=new.id
    and ast.is_active;
  get diagnostics v_assets=row_count;

  update public.accreditations
  set is_active=false,
      parent_accreditation_id=null,
      updated_at=now()
  where project_id=new.id
    and is_active;
  get diagnostics v_accreditations=row_count;

  -- Worker/service triggers can refresh periodized obligations while the
  -- accreditation is still active. Deactivate obligations last, after the
  -- accreditation has become historical, so none can be regenerated.
  update public.document_obligations o
  set is_active=false,updated_at=now()
  from public.accreditations a
  where o.accreditation_id=a.id
    and a.project_id=new.id
    and o.is_active;
  get diagnostics v_obligations=row_count;

  update public.compliance_periods cp
  set status='cerrado',
      closed_at=coalesce(cp.closed_at,now()),
      closed_by=coalesce(cp.closed_by,v_uid),
      snapshot=coalesce(cp.snapshot,'{}'::jsonb) || jsonb_build_object(
        'projectArchived',true,
        'archivedAt',new.archived_at,
        'archiveReason',new.archive_reason,
        'periodStatusBeforeArchive',cp.status,
        'generatedAt',now(),
        'accreditations',coalesce((
          select jsonb_agg(to_jsonb(s))
          from public.accreditation_statuses s
          where s.project_id=new.id
        ),'[]'::jsonb),
        'obligations',coalesce((
          select jsonb_agg(to_jsonb(os))
          from public.obligation_statuses os
          join public.accreditations a on a.id=os.accreditation_id
          where a.project_id=new.id
            and os.period_start>=cp.period_start
            and os.period_end<=cp.period_end
        ),'[]'::jsonb)
      ),
      updated_at=now()
  where cp.project_id=new.id
    and cp.period_start<=current_date
    and cp.status<>'cerrado';
  get diagnostics v_closed_periods=row_count;

  update public.compliance_periods cp
  set status='cancelado',
      closed_at=coalesce(cp.closed_at,now()),
      closed_by=coalesce(cp.closed_by,v_uid),
      snapshot=coalesce(cp.snapshot,'{}'::jsonb) || jsonb_build_object(
        'projectArchived',true,
        'archivedAt',new.archived_at,
        'archiveReason',new.archive_reason,
        'periodStatusBeforeArchive',cp.status,
        'cancelledBeforeStart',true
      ),
      updated_at=now()
  where cp.project_id=new.id
    and cp.period_start>current_date
    and cp.status<>'cancelado';
  get diagnostics v_cancelled_periods=row_count;

  update public.notifications
  set status='resolved',
      resolved_at=coalesce(resolved_at,now()),
      updated_at=now()
  where project_id=new.id
    and status='active'
    and occurred_at < new.archived_at;

  insert into public.audit_logs(actor_profile_id,action,entity_type,entity_id,project_id,details)
  values (
    v_uid,'project_archived','project',new.id,new.id,
    jsonb_build_object(
      'reason',new.archive_reason,
      'archived_at',new.archived_at,
      'accreditations_closed',v_accreditations,
      'worker_assignments_closed',v_assignments,
      'services_finalized',v_services,
      'obligations_closed',v_obligations,
      'assets_retired',v_assets,
      'operator_assignments_closed',v_operators,
      'periods_closed',v_closed_periods,
      'future_periods_cancelled',v_cancelled_periods
    )
  );

  return new;
end;
$$;

revoke all on function private.apply_project_archive_lifecycle() from public,anon,authenticated;
