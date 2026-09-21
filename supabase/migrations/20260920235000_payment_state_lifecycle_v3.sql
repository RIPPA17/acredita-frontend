
create or replace function private.guard_payment_case_lifecycle()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  v_project_id uuid;
  v_acc_active boolean;
  v_project_status text;
  v_period public.compliance_periods%rowtype;
  v_source text := coalesce(current_setting('app.payment_transition_source',true),'');
  v_approvals integer;
begin
  if tg_op='DELETE' then
    select count(*) into v_approvals from public.payment_approvals where payment_case_id=old.id;
    if old.status <> 'observado' or v_approvals>0 then
      raise exception using errcode='42501', message='Un pago con decisiones o avance de estado no puede eliminarse; anúlalo para conservar trazabilidad.';
    end if;
    return old;
  end if;

  select a.project_id,a.is_active,p.status into v_project_id,v_acc_active,v_project_status
  from public.accreditations a join public.projects p on p.id=a.project_id where a.id=new.accreditation_id;
  if v_project_id is null then raise exception using errcode='23503', message='La acreditación asociada no existe.'; end if;

  if tg_op='INSERT' then
    if v_acc_active is distinct from true or v_project_status is distinct from 'active' then
      raise exception using errcode='42501', message='Solo puedes crear estados de pago para una relación activa en un proyecto activo.';
    end if;
    if new.period_end < new.period_start then raise exception using errcode='22023', message='La fecha de término no puede ser anterior al inicio.'; end if;
    select * into v_period from public.compliance_periods
    where project_id=v_project_id and period_start=new.period_start and period_end=new.period_end limit 1;
    if v_period.id is null then
      raise exception using errcode='22023', message='El pago debe corresponder exactamente a un período documental configurado para el proyecto.';
    end if;
    new.compliance_period_id := v_period.id;
    new.status := 'observado';
    new.submitted_by := coalesce(new.submitted_by,(select auth.uid()));
    new.submitted_at := coalesce(new.submitted_at,now());
    new.released_by := null; new.released_at := null; new.paid_by := null; new.paid_at := null;
    new.payment_reference := null; new.payment_note := null; new.voided_by := null; new.voided_at := null; new.void_reason := null;
    new.compliance_snapshot := private.payment_compliance_context(new.accreditation_id,new.compliance_period_id);
    new.compliance_checked_at := now();
    if nullif(btrim(coalesce(new.block_reason,'')),'') is null then
      new.block_reason := coalesce(new.compliance_snapshot->>'eligibleReason',new.compliance_snapshot->>'reason','Pendiente de revisión y aprobación del período.');
    end if;
    return new;
  end if;

  if new.accreditation_id is distinct from old.accreditation_id
     or new.compliance_period_id is distinct from old.compliance_period_id
     or new.period_start is distinct from old.period_start
     or new.period_end is distinct from old.period_end
     or new.submitted_by is distinct from old.submitted_by
     or new.submitted_at is distinct from old.submitted_at then
    raise exception using errcode='42501', message='La acreditación y el período de un pago no pueden modificarse después de crearlo.';
  end if;

  if old.status in ('pagado','anulado') and (
    new.amount is distinct from old.amount or new.currency is distinct from old.currency
    or new.invoice_number is distinct from old.invoice_number or new.status is distinct from old.status
    or new.block_reason is distinct from old.block_reason
  ) then
    raise exception using errcode='42501', message='Un pago pagado o anulado es histórico y no puede editarse.';
  end if;

  if v_source='' then
    if new.status is distinct from old.status or new.block_reason is distinct from old.block_reason
       or new.released_by is distinct from old.released_by or new.released_at is distinct from old.released_at
       or new.paid_by is distinct from old.paid_by or new.paid_at is distinct from old.paid_at
       or new.payment_reference is distinct from old.payment_reference or new.payment_note is distinct from old.payment_note
       or new.voided_by is distinct from old.voided_by or new.voided_at is distinct from old.voided_at
       or new.void_reason is distinct from old.void_reason
       or new.compliance_snapshot is distinct from old.compliance_snapshot or new.compliance_checked_at is distinct from old.compliance_checked_at then
      raise exception using errcode='42501', message='Estado, fundamento y trazabilidad del pago solo pueden cambiar mediante el flujo de decisiones.';
    end if;
    if old.status not in ('observado','retenido')
       and (new.amount is distinct from old.amount or new.currency is distinct from old.currency or new.invoice_number is distinct from old.invoice_number) then
      raise exception using errcode='42501', message='Monto y referencia solo pueden corregirse mientras el pago esté observado o retenido.';
    end if;
  elsif v_source='approval' then
    if new.status not in ('liberado','retenido') then raise exception using errcode='22023', message='Transición inválida desde una decisión de pago.'; end if;
  elsif v_source='mark_paid' then
    if old.status<>'liberado' or new.status<>'pagado' then raise exception using errcode='22023', message='Solo un pago liberado puede marcarse como pagado.'; end if;
  elsif v_source='void' then
    if old.status='pagado' or new.status<>'anulado' then raise exception using errcode='22023', message='Un pago pagado no puede anularse.'; end if;
  elsif v_source='period_reopen' then
    if old.status='liberado' and new.status<>'retenido' then raise exception using errcode='22023', message='Reabrir el período debe volver a retener un pago liberado.'; end if;
  else
    raise exception using errcode='42501', message='Origen de transición de pago no reconocido.';
  end if;
  return new;
end;
$$;

create or replace function public.get_payment_case_compliance(p_payment_case_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare v_case public.payment_cases%rowtype;
begin
  if (select auth.uid()) is null then raise exception using errcode='28000', message='Sesión inválida.'; end if;
  select * into v_case from public.payment_cases where id=p_payment_case_id;
  if v_case.id is null then raise exception 'Pago no encontrado'; end if;
  if not private.can_access_accreditation(v_case.accreditation_id) then
    raise exception using errcode='42501', message='No tienes acceso a este pago.';
  end if;
  return private.payment_compliance_context(v_case.accreditation_id,v_case.compliance_period_id);
end;
$$;
revoke all on function public.get_payment_case_compliance(uuid) from public,anon;
grant execute on function public.get_payment_case_compliance(uuid) to authenticated,service_role;
