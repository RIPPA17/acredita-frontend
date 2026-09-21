create or replace function public.get_payment_case_compliance(p_payment_case_id uuid)
returns jsonb
language plpgsql
stable
security invoker
set search_path=''
as $$
declare
  v_case public.payment_cases%rowtype;
  v_period public.compliance_periods%rowtype;
  v_item jsonb;
  v_allowed boolean := false;
  v_reason text;
begin
  if (select auth.uid()) is null then raise exception using errcode='28000', message='Sesión inválida.'; end if;
  select * into v_case from public.payment_cases where id=p_payment_case_id;
  if v_case.id is null then raise exception 'Pago no encontrado'; end if;
  select * into v_period from public.compliance_periods where id=v_case.compliance_period_id;
  if v_period.id is null then return jsonb_build_object('eligible',false,'periodStatus','missing','source','none','reason','El período de cumplimiento asociado no existe.'); end if;
  if v_period.status<>'cerrado' then
    return jsonb_build_object('eligible',false,'periodStatus',v_period.status,'source','live','periodStart',v_period.period_start,'periodEnd',v_period.period_end,'reason','El período documental debe cerrarse antes de liberar el pago.');
  end if;
  select value into v_item
  from jsonb_array_elements(coalesce(v_period.snapshot->'accreditations','[]'::jsonb)) item(value)
  where value->>'accreditation_id'=v_case.accreditation_id::text limit 1;
  if v_item is null then
    return jsonb_build_object('eligible',false,'periodStatus',v_period.status,'source','closed_period_snapshot','periodStart',v_period.period_start,'periodEnd',v_period.period_end,'generatedAt',v_period.snapshot->>'generated_at','reason','El snapshot del período no contiene el estado de esta acreditación.');
  end if;
  v_allowed := coalesce((v_item->>'payment_allowed')::boolean,false);
  v_reason := case
    when v_allowed then null
    when coalesce((v_item->>'payment_blocked_count')::integer,0)>0 then 'Existen requisitos obligatorios rechazados o vencidos que bloquean pago.'
    when coalesce((v_item->>'payment_pending_count')::integer,0)>0 then 'Existen requisitos obligatorios pendientes o en revisión que bloquean pago.'
    when coalesce((v_item->>'active_worker_count')::integer,0)=0 then 'La acreditación no tiene trabajadores activos para el período.'
    else 'La acreditación no cumple las condiciones documentales para liberar pago.'
  end;
  return jsonb_build_object(
    'eligible',v_allowed,'periodStatus',v_period.status,'source','closed_period_snapshot',
    'periodStart',v_period.period_start,'periodEnd',v_period.period_end,'generatedAt',v_period.snapshot->>'generated_at',
    'accreditationStatus',v_item->>'status','compliancePercent',coalesce((v_item->>'compliance_percent')::numeric,0),
    'paymentBlockedCount',coalesce((v_item->>'payment_blocked_count')::integer,0),
    'paymentPendingCount',coalesce((v_item->>'payment_pending_count')::integer,0),'eligibleReason',v_reason,'snapshot',v_item
  );
end;
$$;

create or replace function public.reopen_compliance_period(p_period_id uuid,p_reason text)
returns public.compliance_periods
language plpgsql
security invoker
set search_path=''
as $$
declare
  v_period public.compliance_periods%rowtype;
  v_reason text := nullif(btrim(coalesce(p_reason,'')),'');
  v_uid uuid := (select auth.uid());
  v_project_status text;
begin
  if v_uid is null then raise exception using errcode='28000', message='Sesión inválida.'; end if;
  select * into v_period from public.compliance_periods where id=p_period_id for update;
  if v_period.id is null then raise exception 'Período no encontrado'; end if;
  select p.status into v_project_status from public.projects p where p.id=v_period.project_id;
  if not (private.is_acredita_staff() or private.can_manage_project(v_period.project_id)) then
    raise exception using errcode='42501', message='No tienes permisos para reabrir este período.';
  end if;
  if v_project_status <> 'active' then
    raise exception using errcode='42501', message='Un proyecto histórico no admite cierres ni reaperturas de períodos.';
  end if;
  if v_period.status<>'cerrado' then raise exception using errcode='22023', message='Solo un período cerrado puede reabrirse.'; end if;
  if v_reason is null or char_length(v_reason)<3 then raise exception using errcode='22023', message='Indica el motivo de reapertura.'; end if;
  update public.compliance_periods
  set status='reabierto',reopened_at=now(),reopened_by=v_uid,reopen_reason=v_reason,closed_at=null,closed_by=null,updated_at=now()
  where id=p_period_id returning * into v_period;
  perform set_config('app.payment_transition_source','period_reopen',true);
  update public.payment_cases
  set status='retenido',
      block_reason='Período documental reabierto: '||v_reason,
      released_by=null,released_at=null,
      compliance_snapshot=jsonb_build_object(
        'eligible',false,'periodStatus','reabierto','source','live',
        'periodStart',v_period.period_start,'periodEnd',v_period.period_end,
        'reason','El período documental fue reabierto y debe cerrarse nuevamente antes de liberar el pago.'
      ),
      compliance_checked_at=now(),updated_at=now()
  where compliance_period_id=p_period_id and status='liberado';
  perform set_config('app.payment_transition_source','',true);
  return v_period;
end;
$$;

drop index if exists public.payment_cases_period_idx;