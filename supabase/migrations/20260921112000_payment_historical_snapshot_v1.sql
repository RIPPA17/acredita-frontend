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
  if (select auth.uid()) is null then
    raise exception using errcode='28000', message='Sesión inválida.';
  end if;

  select * into v_case
  from public.payment_cases
  where id=p_payment_case_id;

  if v_case.id is null then
    raise exception 'Pago no encontrado';
  end if;

  if v_case.status in ('pagado','anulado') and v_case.compliance_snapshot is not null then
    return v_case.compliance_snapshot || jsonb_build_object(
      'source','payment_case_snapshot',
      'historical',true,
      'paymentStatus',v_case.status,
      'complianceCheckedAt',v_case.compliance_checked_at
    );
  end if;

  select * into v_period
  from public.compliance_periods
  where id=v_case.compliance_period_id;

  if v_period.id is null then
    return jsonb_build_object(
      'eligible',false,'periodStatus','missing','source','none',
      'reason','El período de cumplimiento asociado no existe.'
    );
  end if;

  if v_period.status<>'cerrado' then
    return jsonb_build_object(
      'eligible',false,'periodStatus',v_period.status,'source','live',
      'periodStart',v_period.period_start,'periodEnd',v_period.period_end,
      'reason','El período documental debe cerrarse antes de liberar el pago.'
    );
  end if;

  select value into v_item
  from jsonb_array_elements(coalesce(v_period.snapshot->'accreditations','[]'::jsonb)) item(value)
  where value->>'accreditation_id'=v_case.accreditation_id::text
  limit 1;

  if v_item is null then
    return jsonb_build_object(
      'eligible',false,'periodStatus',v_period.status,'source','closed_period_snapshot',
      'periodStart',v_period.period_start,'periodEnd',v_period.period_end,
      'generatedAt',v_period.snapshot->>'generated_at',
      'reason','El snapshot del período no contiene el estado de esta acreditación.'
    );
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
    'periodStart',v_period.period_start,'periodEnd',v_period.period_end,
    'generatedAt',v_period.snapshot->>'generated_at',
    'accreditationStatus',v_item->>'status',
    'compliancePercent',coalesce((v_item->>'compliance_percent')::numeric,0),
    'paymentBlockedCount',coalesce((v_item->>'payment_blocked_count')::integer,0),
    'paymentPendingCount',coalesce((v_item->>'payment_pending_count')::integer,0),
    'eligibleReason',v_reason,'snapshot',v_item
  );
end;
$$;

create or replace function private.notification_event_enabled(
  p_profile_id uuid,
  p_event_type text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when p_event_type in ('document_rejected','document_expired') then coalesce(np.document_rejected, true)
    when p_event_type = 'document_expiring' then coalesce(np.document_expiring, true)
    when p_event_type in ('document_approved','document_in_review') then coalesce(np.document_updates, true)
    when p_event_type in ('accreditation_approved','accreditation_blocked') then coalesce(np.accreditation_approved, true)
    when p_event_type in ('worker_blocked','worker_enabled','worker_contract_expiring','worker_contract_expired') then coalesce(np.worker_status, false)
    when p_event_type in ('payment_blocked','payment_released','payment_paid','payment_voided') then coalesce(np.payment_status, true)
    when p_event_type = 'support_reply' then coalesce(np.support_updates, true)
    when p_event_type = 'requirement_changed' then true
    else true
  end
  from (select p_profile_id as profile_id) x
  left join public.notification_preferences np on np.profile_id = x.profile_id;
$$;

create or replace function private.notify_payment_case_change()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  if tg_op='UPDATE'
     and new.status is not distinct from old.status
     and new.block_reason is not distinct from old.block_reason then
    return new;
  end if;

  if new.status in ('retenido','observado') then
    perform private.resolve_contractor_notifications(
      new.accreditation_id,
      array['payment_released','payment_voided']::text[],
      null::uuid,null::uuid,new.id
    );
    perform private.emit_contractor_notification(
      new.accreditation_id,
      'payment_blocked:'||new.id::text,
      'payment_blocked',
      'accion',
      case when new.status='retenido' then 'critical' else 'action' end,
      case when new.status='retenido' then 'Pago retenido' else 'Pago observado' end,
      coalesce(new.block_reason,'Revisa el estado documental y las observaciones del período.'),
      'Ver pago','operacion',
      null,null,null,null,null,new.id,null,true
    );
  elsif new.status='liberado' then
    perform private.resolve_contractor_notifications(
      new.accreditation_id,
      array['payment_blocked','payment_voided']::text[],
      null::uuid,null::uuid,new.id
    );
    perform private.emit_contractor_notification(
      new.accreditation_id,
      'payment_released:'||new.id::text,
      'payment_released','positiva','info',
      'Pago liberado',
      'El período documental fue cerrado y aprobado para pago.',
      'Ver pago','operacion',
      null,null,null,null,null,new.id,null,true
    );
  elsif new.status='pagado' then
    perform private.resolve_contractor_notifications(
      new.accreditation_id,
      array['payment_blocked','payment_released','payment_voided']::text[],
      null::uuid,null::uuid,new.id
    );
    perform private.emit_contractor_notification(
      new.accreditation_id,
      'payment_paid:'||new.id::text,
      'payment_paid','positiva','info',
      'Pago confirmado',
      'El pago fue registrado con referencia '||coalesce(new.payment_reference,'sin referencia')||'.',
      'Ver pago','operacion',
      null,null,null,null,null,new.id,null,true
    );
  elsif new.status='anulado' then
    perform private.resolve_contractor_notifications(
      new.accreditation_id,
      array['payment_blocked','payment_released']::text[],
      null::uuid,null::uuid,new.id
    );
    perform private.emit_contractor_notification(
      new.accreditation_id,
      'payment_voided:'||new.id::text,
      'payment_voided','informativa','info',
      'Estado de pago anulado',
      coalesce(new.void_reason,'El estado de pago fue anulado y quedó conservado como historial.'),
      'Ver pago','operacion',
      null,null,null,null,null,new.id,null,true
    );
  end if;

  return new;
end;
$$;