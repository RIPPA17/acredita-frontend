
alter table public.payment_cases
  alter column compliance_period_id set not null,
  alter column submitted_by set not null,
  alter column submitted_at set not null;

create or replace function private.notify_payment_case_change()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  if tg_op='UPDATE' and new.status is not distinct from old.status
     and new.block_reason is not distinct from old.block_reason then
    return new;
  end if;

  if new.status in ('retenido','observado') then
    perform private.resolve_contractor_notifications(
      new.accreditation_id,
      array['payment_released']::text[],
      null::uuid,
      null::uuid,
      new.id
    );
    perform private.emit_contractor_notification(
      new.accreditation_id,
      'payment_blocked:'||new.id::text,
      'payment_blocked',
      'accion',
      case when new.status='retenido' then 'critical' else 'action' end,
      case when new.status='retenido' then 'Pago retenido' else 'Pago observado' end,
      coalesce(new.block_reason,'Revisa el estado documental y las observaciones del período.'),
      'Ver pago',
      'operacion',
      null,null,null,null,null,new.id,null,true
    );
  elsif new.status='liberado' then
    perform private.resolve_contractor_notifications(
      new.accreditation_id,
      array['payment_blocked']::text[],
      null::uuid,
      null::uuid,
      new.id
    );
    perform private.emit_contractor_notification(
      new.accreditation_id,
      'payment_released:'||new.id::text,
      'payment_released',
      'positiva',
      'info',
      'Pago liberado',
      'El período documental fue cerrado y aprobado para pago.',
      'Ver pago',
      'operacion',
      null,null,null,null,null,new.id,null,true
    );
  elsif new.status='pagado' then
    perform private.resolve_contractor_notifications(
      new.accreditation_id,
      array['payment_blocked','payment_released']::text[],
      null::uuid,
      null::uuid,
      new.id
    );
    perform private.emit_contractor_notification(
      new.accreditation_id,
      'payment_paid:'||new.id::text,
      'payment_paid',
      'positiva',
      'info',
      'Pago confirmado',
      'El pago fue registrado con referencia '||coalesce(new.payment_reference,'sin referencia')||'.',
      'Ver pago',
      'operacion',
      null,null,null,null,null,new.id,null,true
    );
  elsif new.status='anulado' then
    perform private.resolve_contractor_notifications(
      new.accreditation_id,
      array['payment_blocked','payment_released']::text[],
      null::uuid,
      null::uuid,
      new.id
    );
  end if;
  return new;
end;
$$;
