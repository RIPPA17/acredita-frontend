create index if not exists notifications_project_id_idx on public.notifications(project_id) where project_id is not null;
create index if not exists notifications_worker_id_idx on public.notifications(worker_id) where worker_id is not null;
create index if not exists notifications_requirement_id_idx on public.notifications(requirement_id) where requirement_id is not null;
create index if not exists notifications_obligation_id_idx on public.notifications(obligation_id) where obligation_id is not null;
create index if not exists notifications_document_version_id_idx on public.notifications(document_version_id) where document_version_id is not null;
create index if not exists notifications_payment_case_id_idx on public.notifications(payment_case_id) where payment_case_id is not null;
create index if not exists notifications_support_ticket_id_idx on public.notifications(support_ticket_id) where support_ticket_id is not null;
create index if not exists notification_email_outbox_recipient_idx on public.notification_email_outbox(recipient_profile_id);

drop policy if exists notification_email_outbox_deny_authenticated on public.notification_email_outbox;
create policy notification_email_outbox_deny_authenticated
on public.notification_email_outbox
for select to authenticated
using (false);

drop function if exists private.resolve_contractor_notifications(uuid,text[],uuid,uuid);

create function private.resolve_contractor_notifications(
  p_accreditation_id uuid,
  p_event_types text[],
  p_document_id uuid default null,
  p_worker_id uuid default null,
  p_payment_case_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.notifications n
  set status = 'resolved',
      resolved_at = coalesce(n.resolved_at, now()),
      updated_at = now()
  where n.status = 'active'
    and n.event_type = any(p_event_types)
    and n.contratista_id = (
      select a.contratista_id from public.accreditations a where a.id = p_accreditation_id
    )
    and n.project_id = (
      select a.project_id from public.accreditations a where a.id = p_accreditation_id
    )
    and (p_document_id is null or n.document_id = p_document_id)
    and (p_worker_id is null or n.worker_id = p_worker_id)
    and (p_payment_case_id is null or n.payment_case_id = p_payment_case_id);
end;
$$;

create or replace function private.sync_worker_notification_state(p_assignment_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_state record;
begin
  select was.assignment_id, was.accreditation_id, was.worker_id, was.worker_name, was.status
    into v_state
  from public.worker_accreditation_statuses was
  where was.assignment_id = p_assignment_id;

  if v_state.assignment_id is null then return; end if;

  if v_state.status = 'vencido_bloqueado' then
    perform private.resolve_contractor_notifications(
      v_state.accreditation_id, array['worker_enabled']::text[], null::uuid, v_state.worker_id, null::uuid
    );
    perform private.emit_contractor_notification(
      v_state.accreditation_id,
      'worker_blocked:' || v_state.assignment_id::text,
      'worker_blocked','accion','critical',
      coalesce(v_state.worker_name,'Trabajador') || ' quedó bloqueado',
      'El estado actual del trabajador bloquea su habilitación. Revisa contrato, ficha y documentos obligatorios.',
      'Ver trabajador','trabajador',
      v_state.worker_id,null,null,null,null,null,null,true
    );
  elsif v_state.status = 'aprobado' then
    perform private.resolve_contractor_notifications(
      v_state.accreditation_id, array['worker_blocked']::text[], null::uuid, v_state.worker_id, null::uuid
    );
    perform private.emit_contractor_notification(
      v_state.accreditation_id,
      'worker_enabled:' || v_state.assignment_id::text,
      'worker_enabled','positiva','info',
      coalesce(v_state.worker_name,'Trabajador') || ' quedó habilitado',
      'El estado actual permite su acceso a faena.',
      'Ver trabajador','trabajador',
      v_state.worker_id,null,null,null,null,null,null,true
    );
  else
    perform private.resolve_contractor_notifications(
      v_state.accreditation_id, array['worker_blocked','worker_enabled']::text[], null::uuid, v_state.worker_id, null::uuid
    );
  end if;
end;
$$;

create or replace function private.sync_accreditation_notification_state(p_accreditation_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
  v_project_name text;
  v_contractor_name text;
begin
  select s.status, p.name, c.name
  into v_status, v_project_name, v_contractor_name
  from public.accreditation_statuses s
  join public.projects p on p.id = s.project_id
  join public.contratistas c on c.id = s.contratista_id
  where s.accreditation_id = p_accreditation_id;

  if v_status is null then return; end if;

  if v_status = 'vencido_bloqueado' then
    perform private.resolve_contractor_notifications(
      p_accreditation_id, array['accreditation_approved']::text[]
    );
    perform private.emit_contractor_notification(
      p_accreditation_id,
      'accreditation_blocked:' || p_accreditation_id::text,
      'accreditation_blocked','accion','critical',
      'Acreditación bloqueada',
      'La acreditación de ' || coalesce(v_project_name,'tu proyecto') || ' tiene obligaciones obligatorias rechazadas o vencidas. Revisa el detalle para recuperar acceso y/o pago.',
      'Ver acreditación','acreditacion',
      null,null,null,null,null,null,null,true
    );
  elsif v_status = 'aprobado' then
    perform private.resolve_contractor_notifications(
      p_accreditation_id, array['accreditation_blocked']::text[]
    );
    perform private.emit_contractor_notification(
      p_accreditation_id,
      'accreditation_approved:' || p_accreditation_id::text,
      'accreditation_approved','positiva','info',
      'Acreditación aprobada',
      coalesce(v_contractor_name,'La empresa') || ' cumple los requisitos obligatorios de ' || coalesce(v_project_name,'el proyecto') || '.',
      'Ver acreditación','acreditacion',
      null,null,null,null,null,null,null,true
    );
  else
    perform private.resolve_contractor_notifications(
      p_accreditation_id, array['accreditation_blocked','accreditation_approved']::text[]
    );
  end if;
end;
$$;

create or replace function private.notify_worker_assignment_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.sync_worker_notification_state(new.id);
  perform private.sync_accreditation_notification_state(new.accreditation_id);
  return new;
end;
$$;

drop trigger if exists worker_assignments_notification_events on public.worker_assignments;
create trigger worker_assignments_notification_events
after insert or update of access_status, assignment_status, is_active, contract_end_date_snapshot
on public.worker_assignments
for each row execute function private.notify_worker_assignment_change();

create or replace function private.notify_document_worker_state_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_assignment_id uuid;
begin
  select o.worker_assignment_id
    into v_assignment_id
  from public.documents d
  left join public.document_obligations o on o.id=d.obligation_id
  where d.id=new.document_id;

  if v_assignment_id is not null then
    perform private.sync_worker_notification_state(v_assignment_id);
  end if;
  return new;
end;
$$;

drop trigger if exists document_versions_worker_notification_state on public.document_versions;
create trigger document_versions_worker_notification_state
after insert or update of workflow_status, expires_at, rejection_reason
on public.document_versions
for each row execute function private.notify_document_worker_state_change();

create or replace function private.notify_payment_case_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.status is not distinct from old.status
     and new.block_reason is not distinct from old.block_reason then
    return new;
  end if;

  if new.status in ('retenido','observado') then
    perform private.emit_contractor_notification(
      new.accreditation_id,
      'payment_blocked:' || new.id::text,
      'payment_blocked','accion','critical',
      case when new.status='retenido' then 'Pago retenido' else 'Pago observado' end,
      coalesce(new.block_reason,'Revisa el estado documental y las observaciones del período.'),
      'Ver pago','operacion',
      null,null,null,null,null,new.id,null,true
    );
  elsif new.status = 'liberado' then
    perform private.resolve_contractor_notifications(
      new.accreditation_id, array['payment_blocked']::text[], null::uuid, null::uuid, new.id
    );
    perform private.emit_contractor_notification(
      new.accreditation_id,
      'payment_released:' || new.id::text,
      'payment_released','positiva','info',
      'Pago liberado',
      'El período de pago fue liberado y ya puede continuar al siguiente paso.',
      'Ver pago','operacion',
      null,null,null,null,null,new.id,null,true
    );
  elsif new.status = 'pagado' then
    perform private.resolve_contractor_notifications(
      new.accreditation_id, array['payment_blocked','payment_released']::text[], null::uuid, null::uuid, new.id
    );
    perform private.emit_contractor_notification(
      new.accreditation_id,
      'payment_paid:' || new.id::text,
      'payment_paid','positiva','info',
      'Pago confirmado',
      'El período fue marcado como pagado.',
      'Ver pago','operacion',
      null,null,null,null,null,new.id,null,true
    );
  end if;
  return new;
end;
$$;

do $$
declare
  r record;
begin
  for r in select assignment_id from public.worker_accreditation_statuses loop
    perform private.sync_worker_notification_state(r.assignment_id);
  end loop;
  for r in select id from public.accreditations where is_active loop
    perform private.sync_accreditation_notification_state(r.id);
  end loop;
end $$;