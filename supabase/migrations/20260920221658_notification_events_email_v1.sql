create extension if not exists pg_cron with schema pg_catalog;

alter table public.notification_preferences
  add column if not exists document_updates boolean not null default true,
  add column if not exists payment_status boolean not null default true,
  add column if not exists support_updates boolean not null default true,
  add column if not exists email_enabled boolean not null default false,
  add column if not exists email_critical_only boolean not null default true;

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_profile_id uuid not null references public.profiles(id) on delete cascade,
  notification_key text not null,
  audience text not null default 'contratista'
    check (audience in ('contratista','mandante','acredita')),
  event_type text not null,
  category text not null
    check (category in ('accion','preventiva','revision','positiva','informativa')),
  severity text not null
    check (severity in ('critical','action','preventive','info')),
  status text not null default 'active'
    check (status in ('active','resolved')),
  title text not null,
  body text not null,
  action_label text not null default 'Ver',
  action_kind text not null default 'acreditacion'
    check (action_kind in ('documentos','trabajador','acreditacion','operacion','soporte','proyecto')),
  action_payload jsonb not null default '{}'::jsonb,
  project_id uuid references public.projects(id) on delete cascade,
  project_key text,
  contratista_id uuid references public.contratistas(id) on delete cascade,
  contractor_key text,
  worker_id uuid references public.workers(id) on delete set null,
  worker_rut text,
  requirement_id uuid references public.requirements(id) on delete set null,
  requirement_key text,
  obligation_id uuid references public.document_obligations(id) on delete set null,
  document_id uuid references public.documents(id) on delete set null,
  document_version_id uuid references public.document_versions(id) on delete set null,
  payment_case_id uuid references public.payment_cases(id) on delete set null,
  support_ticket_id uuid references public.support_tickets(id) on delete set null,
  occurred_at timestamptz not null default now(),
  resolved_at timestamptz,
  occurrence_count integer not null default 1 check (occurrence_count > 0),
  email_eligible boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (recipient_profile_id, notification_key)
);

create index if not exists notifications_recipient_status_occurred_idx
  on public.notifications(recipient_profile_id, status, occurred_at desc);
create index if not exists notifications_contractor_project_idx
  on public.notifications(contratista_id, project_id, occurred_at desc);
create index if not exists notifications_document_idx
  on public.notifications(document_id, occurred_at desc) where document_id is not null;

create table if not exists public.notification_email_outbox (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null references public.notifications(id) on delete cascade,
  recipient_profile_id uuid not null references public.profiles(id) on delete cascade,
  occurrence_number integer not null default 1 check (occurrence_number > 0),
  status text not null default 'pending'
    check (status in ('pending','sending','sent','failed','skipped')),
  attempts integer not null default 0 check (attempts >= 0),
  next_attempt_at timestamptz not null default now(),
  last_error text,
  provider_message_id text,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  unique (notification_id, occurrence_number)
);

create index if not exists notification_email_outbox_pending_idx
  on public.notification_email_outbox(status, next_attempt_at, created_at)
  where status in ('pending','failed');

alter table public.notifications enable row level security;
alter table public.notification_email_outbox enable row level security;

revoke all privileges on table public.notifications from anon;
revoke all privileges on table public.notification_email_outbox from anon, authenticated;
grant select on table public.notifications to authenticated;

drop policy if exists notifications_select_own on public.notifications;
create policy notifications_select_own
on public.notifications for select to authenticated
using (recipient_profile_id = (select auth.uid()));

create table if not exists private.notification_dispatch_config (
  singleton boolean primary key default true check (singleton),
  secret text not null,
  created_at timestamptz not null default now()
);

insert into private.notification_dispatch_config(singleton, secret)
values (true, encode(gen_random_bytes(32), 'hex'))
on conflict (singleton) do nothing;

create or replace function public.validate_notification_dispatch_secret(p_secret text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists(
    select 1
    from private.notification_dispatch_config c
    where c.singleton and c.secret = p_secret
  );
$$;

revoke all on function public.validate_notification_dispatch_secret(text) from public, anon, authenticated;
grant execute on function public.validate_notification_dispatch_secret(text) to service_role;

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
    when p_event_type in ('payment_blocked','payment_released','payment_paid') then coalesce(np.payment_status, true)
    when p_event_type = 'support_reply' then coalesce(np.support_updates, true)
    when p_event_type = 'requirement_changed' then true
    else true
  end
  from (select p_profile_id as profile_id) x
  left join public.notification_preferences np on np.profile_id = x.profile_id;
$$;

create or replace function private.queue_notification_email(
  p_notification_id uuid,
  p_profile_id uuid,
  p_occurrence integer,
  p_severity text,
  p_event_type text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_enabled boolean := false;
  v_critical_only boolean := true;
  v_event_enabled boolean := false;
begin
  select coalesce(np.email_enabled,false), coalesce(np.email_critical_only,true)
  into v_enabled, v_critical_only
  from (select p_profile_id as profile_id) x
  left join public.notification_preferences np on np.profile_id = x.profile_id;

  v_event_enabled := private.notification_event_enabled(p_profile_id, p_event_type);

  if not v_enabled or not v_event_enabled then
    return;
  end if;
  if v_critical_only and p_severity not in ('critical','action') then
    return;
  end if;

  insert into public.notification_email_outbox(
    notification_id, recipient_profile_id, occurrence_number, status, next_attempt_at
  ) values (
    p_notification_id, p_profile_id, p_occurrence, 'pending', now()
  )
  on conflict (notification_id, occurrence_number) do nothing;
end;
$$;

create or replace function private.emit_contractor_notification(
  p_accreditation_id uuid,
  p_notification_key text,
  p_event_type text,
  p_category text,
  p_severity text,
  p_title text,
  p_body text,
  p_action_label text,
  p_action_kind text,
  p_worker_id uuid default null,
  p_requirement_id uuid default null,
  p_obligation_id uuid default null,
  p_document_id uuid default null,
  p_document_version_id uuid default null,
  p_payment_case_id uuid default null,
  p_support_ticket_id uuid default null,
  p_email_eligible boolean default false
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_project_id uuid;
  v_project_key text;
  v_contratista_id uuid;
  v_contractor_key text;
  v_worker_rut text;
  v_requirement_key text;
  v_profile_id uuid;
  v_enabled boolean;
  v_notification_id uuid;
  v_old_status text;
  v_occurrence integer;
begin
  select a.project_id, p.integration_key, a.contratista_id, c.integration_key
  into v_project_id, v_project_key, v_contratista_id, v_contractor_key
  from public.accreditations a
  join public.projects p on p.id = a.project_id
  join public.contratistas c on c.id = a.contratista_id
  where a.id = p_accreditation_id;

  if v_project_id is null then return; end if;

  if p_worker_id is not null then
    select w.rut into v_worker_rut from public.workers w where w.id = p_worker_id;
  end if;
  if p_requirement_id is not null then
    select coalesce(r.integration_key, r.id::text) into v_requirement_key
    from public.requirements r where r.id = p_requirement_id;
  end if;

  for v_profile_id in
    select cm.profile_id
    from public.contratista_memberships cm
    join public.profiles pr on pr.id = cm.profile_id and pr.is_active
    where cm.contratista_id = v_contratista_id and cm.is_active
  loop
    v_enabled := private.notification_event_enabled(v_profile_id, p_event_type);
    if not v_enabled then continue; end if;

    select n.id, n.status, n.occurrence_count
      into v_notification_id, v_old_status, v_occurrence
    from public.notifications n
    where n.recipient_profile_id = v_profile_id
      and n.notification_key = p_notification_key;

    if v_notification_id is null then
      insert into public.notifications(
        recipient_profile_id, notification_key, audience, event_type, category, severity,
        status, title, body, action_label, action_kind, action_payload,
        project_id, project_key, contratista_id, contractor_key,
        worker_id, worker_rut, requirement_id, requirement_key,
        obligation_id, document_id, document_version_id, payment_case_id, support_ticket_id,
        occurred_at, resolved_at, occurrence_count, email_eligible
      ) values (
        v_profile_id, p_notification_key, 'contratista', p_event_type, p_category, p_severity,
        'active', p_title, p_body, p_action_label, p_action_kind,
        jsonb_strip_nulls(jsonb_build_object(
          'projectKey', v_project_key,
          'workerRut', v_worker_rut,
          'requirementKey', v_requirement_key
        )),
        v_project_id, v_project_key, v_contratista_id, v_contractor_key,
        p_worker_id, v_worker_rut, p_requirement_id, v_requirement_key,
        p_obligation_id, p_document_id, p_document_version_id, p_payment_case_id, p_support_ticket_id,
        now(), null, 1, p_email_eligible
      ) returning id, occurrence_count into v_notification_id, v_occurrence;

      delete from public.notification_reads
      where profile_id = v_profile_id and notification_key = p_notification_key;

      if p_email_eligible then
        perform private.queue_notification_email(v_notification_id, v_profile_id, v_occurrence, p_severity, p_event_type);
      end if;
    else
      if v_old_status = 'resolved' then
        v_occurrence := v_occurrence + 1;
        update public.notifications set
          event_type = p_event_type,
          category = p_category,
          severity = p_severity,
          status = 'active',
          title = p_title,
          body = p_body,
          action_label = p_action_label,
          action_kind = p_action_kind,
          action_payload = jsonb_strip_nulls(jsonb_build_object(
            'projectKey', v_project_key,
            'workerRut', v_worker_rut,
            'requirementKey', v_requirement_key
          )),
          worker_id = p_worker_id,
          worker_rut = v_worker_rut,
          requirement_id = p_requirement_id,
          requirement_key = v_requirement_key,
          obligation_id = p_obligation_id,
          document_id = p_document_id,
          document_version_id = p_document_version_id,
          payment_case_id = p_payment_case_id,
          support_ticket_id = p_support_ticket_id,
          occurred_at = now(),
          resolved_at = null,
          occurrence_count = v_occurrence,
          email_eligible = p_email_eligible,
          updated_at = now()
        where id = v_notification_id;

        delete from public.notification_reads
        where profile_id = v_profile_id and notification_key = p_notification_key;

        if p_email_eligible then
          perform private.queue_notification_email(v_notification_id, v_profile_id, v_occurrence, p_severity, p_event_type);
        end if;
      else
        update public.notifications set
          title = p_title,
          body = p_body,
          severity = p_severity,
          category = p_category,
          action_label = p_action_label,
          action_kind = p_action_kind,
          updated_at = now()
        where id = v_notification_id;
      end if;
    end if;
  end loop;
end;
$$;

create or replace function private.resolve_contractor_notifications(
  p_accreditation_id uuid,
  p_event_types text[],
  p_document_id uuid default null,
  p_worker_id uuid default null
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
    and (p_worker_id is null or n.worker_id = p_worker_id);
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
      p_accreditation_id, array['accreditation_approved']::text[]
    );
  end if;
end;
$$;

create or replace function private.notify_document_version_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_doc public.documents%rowtype;
  v_req public.requirements%rowtype;
  v_worker_name text;
  v_has_prior_valid boolean := false;
  v_body text;
  v_severity text;
begin
  if tg_op = 'UPDATE' and new.workflow_status is not distinct from old.workflow_status
     and new.rejection_reason is not distinct from old.rejection_reason
     and new.rejection_explanation is not distinct from old.rejection_explanation then
    return new;
  end if;

  select * into v_doc from public.documents where id = new.document_id;
  if v_doc.id is null then return new; end if;
  select * into v_req from public.requirements where id = v_doc.requirement_id;
  if v_doc.worker_id is not null then
    select full_name into v_worker_name from public.workers where id = v_doc.worker_id;
  end if;

  select exists(
    select 1 from public.document_versions prior
    where prior.document_id = new.document_id
      and prior.id <> new.id
      and prior.version_number < new.version_number
      and prior.workflow_status = 'aprobado'
      and (prior.expires_at is null or prior.expires_at >= current_date)
  ) into v_has_prior_valid;

  if new.workflow_status = 'rechazado' then
    v_severity := case
      when coalesce(v_req.is_required,false)
       and v_req.criticality in ('bloquea_acceso','bloquea_pago','bloquea_ambas')
       and not v_has_prior_valid then 'critical'
      else 'action'
    end;
    v_body := coalesce(new.rejection_explanation, new.rejection_reason, 'Debes corregir el documento.');
    if v_has_prior_valid then
      v_body := v_body || ' La versión aprobada anterior continúa vigente hasta su vencimiento.';
    elsif v_severity = 'critical' then
      v_body := v_body || ' Este requisito bloquea ' ||
        case v_req.criticality
          when 'bloquea_acceso' then 'el acceso a faena.'
          when 'bloquea_pago' then 'el pago.'
          else 'el acceso a faena y el pago.'
        end;
    end if;

    perform private.emit_contractor_notification(
      v_doc.accreditation_id,
      'document_rejected:' || new.id::text,
      'document_rejected','accion',v_severity,
      case when v_doc.worker_id is null
        then coalesce(v_req.name,'Documento') || ' fue rechazado'
        else coalesce(v_req.name,'Documento') || ' de ' || coalesce(v_worker_name,'trabajador') || ' fue rechazado'
      end,
      v_body,
      case when v_doc.worker_id is null then 'Corregir documento' else 'Ver trabajador' end,
      case when v_doc.worker_id is null then 'documentos' else 'trabajador' end,
      v_doc.worker_id,v_doc.requirement_id,v_doc.obligation_id,v_doc.id,new.id,null,null,true
    );
  elsif new.workflow_status = 'revision' then
    perform private.emit_contractor_notification(
      v_doc.accreditation_id,
      'document_in_review:' || new.id::text,
      'document_in_review','revision','info',
      case when v_has_prior_valid then 'Renovación en revisión' else 'Documento en revisión' end,
      coalesce(v_req.name,'Documento') ||
        case when v_doc.worker_id is not null then ' · ' || coalesce(v_worker_name,'Trabajador') else '' end ||
        case when v_has_prior_valid then '. La versión vigente anterior mantiene su efecto mientras se revisa la renovación.' else '. Acredita está revisando la carga.' end,
      'Ver','documentos',
      v_doc.worker_id,v_doc.requirement_id,v_doc.obligation_id,v_doc.id,new.id,null,null,false
    );
  elsif new.workflow_status = 'aprobado' then
    perform private.resolve_contractor_notifications(
      v_doc.accreditation_id,
      array['document_rejected','document_in_review','document_expired','document_expiring']::text[],
      v_doc.id, null
    );
    perform private.emit_contractor_notification(
      v_doc.accreditation_id,
      'document_approved:' || new.id::text,
      'document_approved','positiva','info',
      case when v_doc.worker_id is null
        then coalesce(v_req.name,'Documento') || ' aprobado'
        else coalesce(v_req.name,'Documento') || ' de ' || coalesce(v_worker_name,'trabajador') || ' aprobado'
      end,
      'La versión ' || new.version_number || ' fue aprobada por Acredita' ||
        case when new.expires_at is not null then ' y vence el ' || new.expires_at::text || '.' else '.' end,
      'Ver','documentos',
      v_doc.worker_id,v_doc.requirement_id,v_doc.obligation_id,v_doc.id,new.id,null,null,true
    );
  end if;

  perform private.sync_accreditation_notification_state(v_doc.accreditation_id);
  return new;
end;
$$;

drop trigger if exists document_versions_notification_events on public.document_versions;
create trigger document_versions_notification_events
after insert or update of workflow_status, rejection_reason, rejection_explanation
on public.document_versions
for each row execute function private.notify_document_version_change();

create or replace function private.notify_worker_assignment_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text;
begin
  if tg_op = 'UPDATE' and new.access_status is not distinct from old.access_status then
    return new;
  end if;
  select full_name into v_name from public.workers where id = new.worker_id;

  if new.access_status = 'bloqueado' then
    perform private.emit_contractor_notification(
      new.accreditation_id,
      'worker_blocked:' || new.id::text,
      'worker_blocked','accion','critical',
      coalesce(v_name,'Trabajador') || ' quedó bloqueado',
      'El trabajador no tiene acceso habilitado. Revisa su ficha laboral y requisitos documentales.',
      'Ver trabajador','trabajador',
      new.worker_id,null,null,null,null,null,null,true
    );
  elsif new.access_status = 'habilitado' then
    perform private.resolve_contractor_notifications(
      new.accreditation_id, array['worker_blocked']::text[], null, new.worker_id
    );
    perform private.emit_contractor_notification(
      new.accreditation_id,
      'worker_enabled:' || new.id::text,
      'worker_enabled','positiva','info',
      coalesce(v_name,'Trabajador') || ' quedó habilitado',
      'El estado actual permite su acceso a faena.',
      'Ver trabajador','trabajador',
      new.worker_id,null,null,null,null,null,null,true
    );
  end if;

  perform private.sync_accreditation_notification_state(new.accreditation_id);
  return new;
end;
$$;

drop trigger if exists worker_assignments_notification_events on public.worker_assignments;
create trigger worker_assignments_notification_events
after insert or update of access_status
on public.worker_assignments
for each row execute function private.notify_worker_assignment_change();

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
      new.accreditation_id, array['payment_blocked']::text[]
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
      new.accreditation_id, array['payment_blocked','payment_released']::text[]
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

drop trigger if exists payment_cases_notification_events on public.payment_cases;
create trigger payment_cases_notification_events
after insert or update of status, block_reason
on public.payment_cases
for each row execute function private.notify_payment_case_change();

create or replace function private.notify_support_reply()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ticket public.support_tickets%rowtype;
  v_acc uuid;
  v_is_contractor_author boolean := false;
begin
  if new.is_internal then return new; end if;
  select * into v_ticket from public.support_tickets where id = new.ticket_id;
  v_acc := v_ticket.accreditation_id;
  if v_acc is null then return new; end if;

  select exists(
    select 1
    from public.contratista_memberships cm
    join public.accreditations a on a.contratista_id = cm.contratista_id
    where a.id = v_acc and cm.profile_id = new.author_id and cm.is_active
  ) into v_is_contractor_author;

  if not v_is_contractor_author then
    perform private.emit_contractor_notification(
      v_acc,
      'support_reply:' || new.id::text,
      'support_reply','informativa','info',
      'Nueva respuesta de soporte',
      coalesce(v_ticket.subject,'Tu solicitud') || ': ' || left(new.body, 260),
      'Ver conversación','soporte',
      null,null,null,null,null,null,v_ticket.id,true
    );
  end if;
  return new;
end;
$$;

drop trigger if exists support_ticket_messages_notification_events on public.support_ticket_messages;
create trigger support_ticket_messages_notification_events
after insert on public.support_ticket_messages
for each row execute function private.notify_support_reply();

create or replace function private.notify_requirement_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_acc uuid;
  v_project_name text;
  v_key text;
begin
  if not new.is_active then return new; end if;

  if tg_op = 'UPDATE'
     and new.name is not distinct from old.name
     and new.is_required is not distinct from old.is_required
     and new.frequency is not distinct from old.frequency
     and new.validity_days is not distinct from old.validity_days
     and new.alert_days is not distinct from old.alert_days
     and new.criticality is not distinct from old.criticality
     and new.applicability is not distinct from old.applicability
     and new.service_id is not distinct from old.service_id then
    return new;
  end if;

  select name into v_project_name from public.projects where id = new.project_id;
  v_key := 'requirement_changed:' || new.id::text || ':' ||
    coalesce(to_char(new.updated_at at time zone 'UTC','YYYYMMDDHH24MISSUS'), to_char(clock_timestamp(),'YYYYMMDDHH24MISSUS'));

  for v_acc in
    select a.id from public.accreditations a
    where a.project_id = new.project_id and a.is_active
  loop
    perform private.emit_contractor_notification(
      v_acc,
      v_key,
      'requirement_changed','informativa','action',
      case when tg_op='INSERT' then 'Nuevo requisito documental' else 'Requisito documental actualizado' end,
      coalesce(new.name,'Requisito') || ' · ' || coalesce(v_project_name,'Proyecto') ||
        '. Revisa obligatoriedad, vigencia y alcance antes de tu próxima carga.',
      'Ver documentos','documentos',
      null,new.id,null,null,null,null,null,true
    );
    perform private.sync_accreditation_notification_state(v_acc);
  end loop;
  return new;
end;
$$;

drop trigger if exists requirements_notification_events on public.requirements;
create trigger requirements_notification_events
after insert or update of name, is_required, frequency, validity_days, alert_days, criticality, applicability, service_id, is_active
on public.requirements
for each row execute function private.notify_requirement_change();

create or replace function private.sync_expiry_notifications()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
  v_days integer;
  v_milestone integer;
begin
  for r in
    select ds.*, w.full_name as worker_name
    from public.document_statuses ds
    join public.accreditations a on a.id = ds.accreditation_id
    join public.projects p on p.id = ds.project_id
    left join public.workers w on w.id = ds.worker_id
    where a.is_active and p.status='active'
      and ds.version_id is not null
      and ds.expires_at is not null
      and ds.workflow_status = 'aprobado'
      and ds.alert_days is not null
  loop
    v_days := r.expires_at - current_date;
    if v_days <= 0 then
      perform private.emit_contractor_notification(
        r.accreditation_id,
        'document_expired:' || r.document_id::text || ':' || r.expires_at::text,
        'document_expired','accion',
        case when r.is_blocking then 'critical' else 'action' end,
        case when r.worker_id is null
          then r.requirement_name || ' está vencido'
          else r.requirement_name || ' de ' || coalesce(r.worker_name,'trabajador') || ' está vencido'
        end,
        case when r.is_blocking
          then 'El documento venció y bloquea una habilitación obligatoria. Debes renovarlo.'
          else 'El documento venció. Debes renovarlo para mantener el expediente actualizado.'
        end,
        case when r.worker_id is null then 'Renovar' else 'Ver trabajador' end,
        case when r.worker_id is null then 'documentos' else 'trabajador' end,
        r.worker_id,r.requirement_id,null,r.document_id,r.version_id,null,null,true
      );
      perform private.resolve_contractor_notifications(
        r.accreditation_id, array['document_expiring']::text[], r.document_id, null
      );
    elsif v_days <= r.alert_days then
      v_milestone := case
        when v_days <= 7 then 7
        when v_days <= 15 then 15
        else r.alert_days
      end;
      perform private.emit_contractor_notification(
        r.accreditation_id,
        'document_expiring:' || r.document_id::text || ':' || r.expires_at::text || ':' || v_milestone::text,
        'document_expiring','preventiva','preventive',
        case when r.worker_id is null
          then r.requirement_name || ' vence en ' || v_days || ' días'
          else r.requirement_name || ' de ' || coalesce(r.worker_name,'trabajador') || ' vence en ' || v_days || ' días'
        end,
        'El documento sigue vigente hasta ' || r.expires_at::text || '. Renueva con anticipación para evitar interrupciones.',
        'Renovar',
        case when r.worker_id is null then 'documentos' else 'trabajador' end,
        r.worker_id,r.requirement_id,null,r.document_id,r.version_id,null,null,true
      );
    end if;
  end loop;

  for r in
    select wa.id as assignment_id, wa.accreditation_id, wa.worker_id,
           wa.contract_end_date_snapshot as ends_at, w.full_name
    from public.worker_assignments wa
    join public.accreditations a on a.id=wa.accreditation_id and a.is_active
    join public.projects p on p.id=a.project_id and p.status='active'
    join public.workers w on w.id=wa.worker_id
    where wa.is_active and wa.assignment_status='activa'
      and wa.contract_end_date_snapshot is not null
  loop
    v_days := r.ends_at - current_date;
    if v_days < 0 then
      perform private.emit_contractor_notification(
        r.accreditation_id,
        'worker_contract_expired:' || r.assignment_id::text || ':' || r.ends_at::text,
        'worker_contract_expired','accion','critical',
        'Contrato de ' || r.full_name || ' vencido',
        'El contrato terminó el ' || r.ends_at::text || '. El trabajador no debe permanecer habilitado sin una nueva relación laboral válida.',
        'Ver trabajador','trabajador',
        r.worker_id,null,null,null,null,null,null,true
      );
    elsif v_days <= 30 then
      v_milestone := case when v_days <= 7 then 7 when v_days <= 15 then 15 else 30 end;
      perform private.emit_contractor_notification(
        r.accreditation_id,
        'worker_contract_expiring:' || r.assignment_id::text || ':' || r.ends_at::text || ':' || v_milestone::text,
        'worker_contract_expiring','preventiva','preventive',
        case when v_days=0 then 'Contrato de ' || r.full_name || ' vence hoy'
             else 'Contrato de ' || r.full_name || ' vence en ' || v_days || ' días' end,
        'Actualiza o registra el nuevo período antes del vencimiento para evitar pérdida de habilitación.',
        'Ver trabajador','trabajador',
        r.worker_id,null,null,null,null,null,null,true
      );
    end if;
  end loop;

  for r in select id from public.accreditations where is_active
  loop
    perform private.sync_accreditation_notification_state(r.id);
  end loop;
end;
$$;

create or replace function private.touch_notification_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists notifications_touch_updated_at on public.notifications;
create trigger notifications_touch_updated_at
before update on public.notifications
for each row execute function private.touch_notification_updated_at();

create or replace function private.request_notification_email_dispatch()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_secret text;
begin
  select c.secret into v_secret
  from private.notification_dispatch_config c
  where c.singleton;

  if v_secret is null then return; end if;

  perform net.http_post(
    url := 'https://jwlscxbmttpicwljozwf.supabase.co/functions/v1/dispatch-notification-emails',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'x-acredita-dispatch-secret',v_secret
    ),
    body := '{"source":"database"}'::jsonb,
    timeout_milliseconds := 15000
  );
end;
$$;

create or replace function private.notification_outbox_dispatch_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.request_notification_email_dispatch();
  return new;
end;
$$;

drop trigger if exists notification_email_outbox_dispatch on public.notification_email_outbox;
create trigger notification_email_outbox_dispatch
after insert on public.notification_email_outbox
for each statement execute function private.notification_outbox_dispatch_trigger();

do $$
declare
  v_job bigint;
begin
  select jobid into v_job from cron.job where jobname='acredita-notification-expiry-sync';
  if v_job is not null then perform cron.unschedule(v_job); end if;
  select jobid into v_job from cron.job where jobname='acredita-notification-email-dispatch';
  if v_job is not null then perform cron.unschedule(v_job); end if;

  perform cron.schedule(
    'acredita-notification-expiry-sync',
    '30 11 * * *',
    'select private.sync_expiry_notifications();'
  );
  perform cron.schedule(
    'acredita-notification-email-dispatch',
    '*/5 * * * *',
    'select private.request_notification_email_dispatch();'
  );
end $$;

select private.sync_expiry_notifications();
