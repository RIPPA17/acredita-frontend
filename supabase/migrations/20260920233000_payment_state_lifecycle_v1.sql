alter table public.payment_cases
  add column if not exists compliance_snapshot jsonb,
  add column if not exists compliance_checked_at timestamptz,
  add column if not exists paid_by uuid references public.profiles(id) on delete set null,
  add column if not exists payment_reference text,
  add column if not exists payment_note text,
  add column if not exists voided_by uuid references public.profiles(id) on delete set null,
  add column if not exists voided_at timestamptz,
  add column if not exists void_reason text;

alter table public.compliance_periods
  add column if not exists reopened_at timestamptz,
  add column if not exists reopened_by uuid references public.profiles(id) on delete set null,
  add column if not exists reopen_reason text;

create table if not exists public.payment_case_events (
  id uuid primary key default gen_random_uuid(),
  payment_case_id uuid not null references public.payment_cases(id) on delete cascade,
  event_type text not null check (event_type = any(array['creado','actualizado','observado','retenido','liberado','pagado','anulado']::text[])),
  from_status text,
  to_status text,
  reason text,
  compliance_snapshot jsonb,
  actor_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists payment_case_events_case_created_idx on public.payment_case_events(payment_case_id, created_at desc);
create index if not exists payment_case_events_actor_idx on public.payment_case_events(actor_profile_id) where actor_profile_id is not null;
create index if not exists payment_cases_compliance_period_idx on public.payment_cases(compliance_period_id) where compliance_period_id is not null;
create index if not exists payment_cases_paid_by_idx on public.payment_cases(paid_by) where paid_by is not null;
create index if not exists payment_cases_voided_by_idx on public.payment_cases(voided_by) where voided_by is not null;
create index if not exists compliance_periods_reopened_by_idx on public.compliance_periods(reopened_by) where reopened_by is not null;

alter table public.payment_case_events enable row level security;
revoke all on public.payment_case_events from anon, authenticated;
grant select on public.payment_case_events to authenticated;

drop policy if exists payment_case_events_select on public.payment_case_events;
create policy payment_case_events_select on public.payment_case_events
for select to authenticated
using (
  exists(
    select 1 from public.payment_cases pc
    where pc.id=payment_case_events.payment_case_id
      and private.can_access_accreditation(pc.accreditation_id)
  )
);

create or replace function private.payment_compliance_context(p_accreditation_id uuid,p_compliance_period_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  v_period public.compliance_periods%rowtype;
  v_item jsonb;
  v_allowed boolean := false;
  v_reason text;
begin
  select * into v_period from public.compliance_periods where id=p_compliance_period_id;
  if v_period.id is null then
    return jsonb_build_object('eligible',false,'periodStatus','missing','source','none','reason','El período de cumplimiento asociado no existe.');
  end if;
  if v_period.status <> 'cerrado' then
    return jsonb_build_object('eligible',false,'periodStatus',v_period.status,'source','live','periodStart',v_period.period_start,'periodEnd',v_period.period_end,'reason','El período documental debe cerrarse antes de liberar el pago.');
  end if;
  select value into v_item
  from jsonb_array_elements(coalesce(v_period.snapshot->'accreditations','[]'::jsonb)) as item(value)
  where value->>'accreditation_id'=p_accreditation_id::text limit 1;
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
    'paymentPendingCount',coalesce((v_item->>'payment_pending_count')::integer,0),
    'eligibleReason',v_reason,'snapshot',v_item
  );
end;
$$;
revoke all on function private.payment_compliance_context(uuid,uuid) from public,anon,authenticated;

create or replace function public.get_payment_case_compliance(p_payment_case_id uuid)
returns jsonb
language plpgsql
stable
set search_path=''
as $$
declare v_case public.payment_cases%rowtype;
begin
  select * into v_case from public.payment_cases where id=p_payment_case_id;
  if v_case.id is null then raise exception 'Pago no encontrado'; end if;
  if not private.can_access_accreditation(v_case.accreditation_id) then raise exception using errcode='42501', message='No tienes acceso a este pago.'; end if;
  return private.payment_compliance_context(v_case.accreditation_id,v_case.compliance_period_id);
end;
$$;
revoke all on function public.get_payment_case_compliance(uuid) from public,anon;
grant execute on function public.get_payment_case_compliance(uuid) to authenticated,service_role;

create or replace function private.guard_payment_case_lifecycle()
returns trigger
language plpgsql
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

drop trigger if exists payment_cases_guard_transition on public.payment_cases;
drop trigger if exists payment_cases_guard_lifecycle on public.payment_cases;
create trigger payment_cases_guard_lifecycle before insert or update or delete on public.payment_cases
for each row execute function private.guard_payment_case_lifecycle();

create or replace function private.guard_payment_approval()
returns trigger
language plpgsql
set search_path=''
as $$
declare v_status text;
begin
  select status into v_status from public.payment_cases where id=new.payment_case_id for update;
  if v_status is null then raise exception 'Pago no encontrado'; end if;
  if v_status in ('pagado','anulado') then raise exception using errcode='42501', message='No se pueden registrar nuevas decisiones sobre un pago pagado o anulado.'; end if;
  new.comment := nullif(btrim(coalesce(new.comment,'')),'');
  if new.decision in ('observado','rechazado') and (new.comment is null or char_length(new.comment)<3) then
    raise exception using errcode='22023', message='Indica el fundamento de la observación o rechazo.';
  end if;
  new.decided_by := coalesce(new.decided_by,(select auth.uid()));
  return new;
end;
$$;

drop trigger if exists payment_approvals_guard on public.payment_approvals;
create trigger payment_approvals_guard before insert on public.payment_approvals
for each row execute function private.guard_payment_approval();

create or replace function private.apply_payment_approval_state()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare v_case public.payment_cases%rowtype; v_ctx jsonb;
begin
  select * into v_case from public.payment_cases where id=new.payment_case_id for update;
  if v_case.id is null then raise exception 'Pago no encontrado'; end if;
  perform set_config('app.payment_transition_source','approval',true);
  if new.decision='aprobado' then
    v_ctx := private.payment_compliance_context(v_case.accreditation_id,v_case.compliance_period_id);
    if coalesce((v_ctx->>'eligible')::boolean,false) is not true then
      perform set_config('app.payment_transition_source','',true);
      raise exception using errcode='22023', message=coalesce(v_ctx->>'eligibleReason',v_ctx->>'reason','El período no habilita el pago.');
    end if;
    update public.payment_cases set status='liberado',block_reason=null,compliance_snapshot=v_ctx,compliance_checked_at=now(),
      released_by=new.decided_by,released_at=now(),updated_at=now() where id=new.payment_case_id;
  else
    update public.payment_cases set status='retenido',
      block_reason=coalesce(new.comment,case when new.decision='rechazado' then 'Aprobación de pago rechazada.' else 'Pago observado.' end),
      compliance_snapshot=private.payment_compliance_context(v_case.accreditation_id,v_case.compliance_period_id),
      compliance_checked_at=now(),released_by=null,released_at=null,updated_at=now() where id=new.payment_case_id;
  end if;
  perform set_config('app.payment_transition_source','',true);
  return new;
end;
$$;

create or replace function public.mark_payment_paid(p_payment_case_id uuid,p_reference text,p_note text default null)
returns void
language plpgsql
set search_path=''
as $$
declare v_reference text := nullif(btrim(coalesce(p_reference,'')),''); v_note text := nullif(btrim(coalesce(p_note,'')),''); v_count integer;
begin
  if (select auth.uid()) is null then raise exception using errcode='28000', message='Sesión inválida.'; end if;
  if v_reference is null or char_length(v_reference)<3 then raise exception using errcode='22023', message='Ingresa una referencia de pago válida.'; end if;
  perform set_config('app.payment_transition_source','mark_paid',true);
  update public.payment_cases set status='pagado',paid_by=(select auth.uid()),paid_at=now(),payment_reference=v_reference,payment_note=v_note,updated_at=now()
  where id=p_payment_case_id and status='liberado';
  get diagnostics v_count=row_count;
  perform set_config('app.payment_transition_source','',true);
  if v_count<>1 then raise exception using errcode='42501', message='El pago debe estar liberado y ser administrable por tu rol antes de marcarlo como pagado.'; end if;
end;
$$;
revoke all on function public.mark_payment_paid(uuid,text,text) from public,anon;
grant execute on function public.mark_payment_paid(uuid,text,text) to authenticated,service_role;
drop function if exists public.mark_payment_paid(uuid);

create or replace function public.void_payment_case(p_payment_case_id uuid,p_reason text)
returns void
language plpgsql
set search_path=''
as $$
declare v_reason text := nullif(btrim(coalesce(p_reason,'')),''); v_count integer;
begin
  if (select auth.uid()) is null then raise exception using errcode='28000', message='Sesión inválida.'; end if;
  if v_reason is null or char_length(v_reason)<3 then raise exception using errcode='22023', message='Indica el motivo de anulación.'; end if;
  perform set_config('app.payment_transition_source','void',true);
  update public.payment_cases set status='anulado',voided_by=(select auth.uid()),voided_at=now(),void_reason=v_reason,block_reason=v_reason,
    released_by=null,released_at=null,updated_at=now()
  where id=p_payment_case_id and status<>'pagado';
  get diagnostics v_count=row_count;
  perform set_config('app.payment_transition_source','',true);
  if v_count<>1 then raise exception using errcode='42501', message='El pago no puede anularse en su estado actual.'; end if;
end;
$$;
revoke all on function public.void_payment_case(uuid,text) from public,anon;
grant execute on function public.void_payment_case(uuid,text) to authenticated,service_role;

create or replace function public.reopen_compliance_period(p_period_id uuid,p_reason text)
returns public.compliance_periods
language plpgsql
set search_path=''
as $$
declare v_period public.compliance_periods%rowtype; v_reason text := nullif(btrim(coalesce(p_reason,'')),'');
begin
  select * into v_period from public.compliance_periods where id=p_period_id for update;
  if v_period.id is null then raise exception 'Período no encontrado'; end if;
  if not (private.is_acredita_staff() or private.can_manage_project(v_period.project_id)) then raise exception using errcode='42501', message='No tienes permisos para reabrir este período.'; end if;
  if v_period.status<>'cerrado' then raise exception using errcode='22023', message='Solo un período cerrado puede reabrirse.'; end if;
  if v_reason is null or char_length(v_reason)<3 then raise exception using errcode='22023', message='Indica el motivo de reapertura.'; end if;
  update public.compliance_periods set status='reabierto',reopened_at=now(),reopened_by=(select auth.uid()),reopen_reason=v_reason,
    closed_at=null,closed_by=null,updated_at=now() where id=p_period_id returning * into v_period;
  perform set_config('app.payment_transition_source','period_reopen',true);
  update public.payment_cases set status='retenido',block_reason='Período documental reabierto: '||v_reason,released_by=null,released_at=null,
    compliance_snapshot=private.payment_compliance_context(accreditation_id,compliance_period_id),compliance_checked_at=now(),updated_at=now()
  where compliance_period_id=p_period_id and status='liberado';
  perform set_config('app.payment_transition_source','',true);
  return v_period;
end;
$$;
revoke all on function public.reopen_compliance_period(uuid,text) from public,anon;
grant execute on function public.reopen_compliance_period(uuid,text) to authenticated,service_role;

create or replace function private.audit_payment_case_lifecycle()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare v_event text; v_reason text;
begin
  if tg_op='INSERT' then v_event:='creado'; v_reason:=new.block_reason;
  elsif new.status is distinct from old.status then
    v_event:=case new.status when 'observado' then 'observado' when 'retenido' then 'retenido' when 'liberado' then 'liberado' when 'pagado' then 'pagado' when 'anulado' then 'anulado' else 'actualizado' end;
    v_reason:=coalesce(new.block_reason,new.payment_note,new.void_reason);
  elsif new.amount is distinct from old.amount or new.currency is distinct from old.currency or new.invoice_number is distinct from old.invoice_number then
    v_event:='actualizado'; v_reason:='Datos económicos o referencia actualizados.';
  else return new;
  end if;
  insert into public.payment_case_events(payment_case_id,event_type,from_status,to_status,reason,compliance_snapshot,actor_profile_id)
  values(new.id,v_event,case when tg_op='UPDATE' then old.status else null end,new.status,v_reason,new.compliance_snapshot,
    coalesce((select auth.uid()),new.submitted_by,new.released_by,new.paid_by,new.voided_by));
  return new;
end;
$$;
drop trigger if exists audit_payment_case_lifecycle on public.payment_cases;
create trigger audit_payment_case_lifecycle after insert or update on public.payment_cases
for each row execute function private.audit_payment_case_lifecycle();

create or replace function public.close_compliance_period(p_period_id uuid)
returns public.compliance_periods
language plpgsql
set search_path=''
as $$
declare period public.compliance_periods%rowtype;
begin
  select * into period from public.compliance_periods where id=p_period_id for update;
  if period.id is null then raise exception 'Período no encontrado'; end if;
  if not (private.is_acredita_staff() or private.can_manage_project(period.project_id)) then raise exception using errcode='42501', message='No tienes permisos para cerrar este período.'; end if;
  if period.status='cerrado' then return period; end if;
  update public.compliance_periods cp set status='cerrado',closed_at=now(),closed_by=(select auth.uid()),
    snapshot=(select jsonb_build_object(
      'generated_at',now(),
      'accreditations',coalesce((select jsonb_agg(to_jsonb(s)) from public.accreditation_statuses s where s.project_id=period.project_id),'[]'::jsonb),
      'obligations',coalesce((select jsonb_agg(to_jsonb(os)) from public.obligation_statuses os join public.accreditations a on a.id=os.accreditation_id
        where a.project_id=period.project_id and os.period_start>=period.period_start and os.period_end<=period.period_end),'[]'::jsonb)
    )),updated_at=now()
  where cp.id=p_period_id returning * into period;
  return period;
end;
$$;

create or replace function private.notify_payment_case_change()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  if tg_op='UPDATE' and new.status is not distinct from old.status and new.block_reason is not distinct from old.block_reason then return new; end if;
  if new.status in ('retenido','observado') then
    perform private.resolve_contractor_notifications(new.accreditation_id,array['payment_released:'||new.id::text]::text[],null::uuid,null::uuid,new.id);
    perform private.emit_contractor_notification(new.accreditation_id,'payment_blocked:'||new.id::text,'payment_blocked:'||new.id::text,'accion',
      case when new.status='retenido' then 'critical' else 'action' end,
      case when new.status='retenido' then 'Pago retenido' else 'Pago observado' end,
      coalesce(new.block_reason,'Revisa el estado documental y las observaciones del período.'),
      'Ver pago','operacion',null,null,null,null,null,new.id,null,true);
  elsif new.status='liberado' then
    perform private.resolve_contractor_notifications(new.accreditation_id,array['payment_blocked:'||new.id::text]::text[],null::uuid,null::uuid,new.id);
    perform private.emit_contractor_notification(new.accreditation_id,'payment_released:'||new.id::text,'payment_released:'||new.id::text,'positiva','info',
      'Pago liberado','El período documental fue cerrado y aprobado para pago.','Ver pago','operacion',null,null,null,null,null,new.id,null,true);
  elsif new.status='pagado' then
    perform private.resolve_contractor_notifications(new.accreditation_id,array['payment_blocked:'||new.id::text,'payment_released:'||new.id::text]::text[],null::uuid,null::uuid,new.id);
    perform private.emit_contractor_notification(new.accreditation_id,'payment_paid:'||new.id::text,'payment_paid:'||new.id::text,'positiva','info',
      'Pago confirmado','El pago fue registrado con referencia '||coalesce(new.payment_reference,'sin referencia')||'.','Ver pago','operacion',null,null,null,null,null,new.id,null,true);
  elsif new.status='anulado' then
    perform private.resolve_contractor_notifications(new.accreditation_id,array['payment_blocked:'||new.id::text,'payment_released:'||new.id::text]::text[],null::uuid,null::uuid,new.id);
  end if;
  return new;
end;
$$;