create or replace function private.mirror_contractor_notification_to_mandante()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  v_mandante_id uuid;
  v_project_name text;
  v_contractor_name text;
  v_profile_id uuid;
  v_key text;
  v_title text;
  v_body text;
  v_action_payload jsonb;
  v_plan_id uuid;
  v_evaluation_id uuid;
begin
  if new.audience <> 'contratista' then
    return new;
  end if;

  if not (
    new.event_type in (
      'document_rejected','document_expired','document_expiring','document_in_review',
      'worker_blocked','worker_contract_expiring','worker_contract_expired',
      'accreditation_blocked','payment_blocked','payment_released'
    )
    or new.event_type like 'action_plan_submitted:%'
    or new.event_type like 'action_plan_due:%'
    or new.event_type like 'action_plan_overdue:%'
  ) then
    return new;
  end if;

  select p.mandante_id,p.name,c.name
  into v_mandante_id,v_project_name,v_contractor_name
  from public.projects p
  left join public.contratistas c on c.id=new.contratista_id
  where p.id=new.project_id;

  if v_mandante_id is null then
    return new;
  end if;

  if new.event_type like 'action_plan_submitted:%'
     or new.event_type like 'action_plan_due:%'
     or new.event_type like 'action_plan_overdue:%' then
    begin
      v_plan_id := split_part(new.event_type,':',2)::uuid;
      select ap.evaluation_id into v_evaluation_id
      from public.evaluation_action_plans ap
      where ap.id=v_plan_id;
    exception when invalid_text_representation then
      v_plan_id := null;
      v_evaluation_id := null;
    end;
  end if;

  v_key := 'mandante:'||new.notification_key||':'||coalesce(new.contratista_id::text,'project');
  v_title := coalesce(v_contractor_name,'Contratista')||' · '||new.title;
  v_body := case
    when new.event_type='document_rejected' then
      'Un documento fue rechazado en '||coalesce(v_project_name,'el proyecto')||'. Revisa el requisito afectado y su impacto operativo.'
    when new.event_type='document_expired' then
      'Un documento venció en '||coalesce(v_project_name,'el proyecto')||'. Revisa si está bloqueando ingreso, trabajo, asignación o pago.'
    when new.event_type='document_expiring' then
      'Hay un documento próximo a vencer en '||coalesce(v_project_name,'el proyecto')||'. Conviene hacer seguimiento antes de que genere un bloqueo.'
    when new.event_type='document_in_review' then
      'Hay documentación en revisión por Acredita en '||coalesce(v_project_name,'el proyecto')||'.'
    when new.event_type='worker_blocked' then
      'Un trabajador de '||coalesce(v_contractor_name,'la empresa')||' perdió su habilitación en '||coalesce(v_project_name,'el proyecto')||'.'
    when new.event_type='worker_contract_expiring' then
      'Un contrato laboral está próximo a vencer en '||coalesce(v_project_name,'el proyecto')||'.'
    when new.event_type='worker_contract_expired' then
      'Un contrato laboral venció en '||coalesce(v_project_name,'el proyecto')||' y puede afectar la habilitación del trabajador.'
    when new.event_type='accreditation_blocked' then
      coalesce(v_contractor_name,'La empresa')||' tiene su acreditación bloqueada en '||coalesce(v_project_name,'el proyecto')||'.'
    when new.event_type='payment_blocked' then
      'Hay un estado de pago retenido u observado para '||coalesce(v_contractor_name,'la empresa')||'. '||coalesce(new.body,'Revisa el período documental y el motivo.')
    when new.event_type='payment_released' then
      'El estado de pago de '||coalesce(v_contractor_name,'la empresa')||' quedó liberado.'
    when new.event_type like 'action_plan_submitted:%' then
      'El contratista envió evidencia de un plan de acción. Corresponde revisar y decidir su cierre.'
    when new.event_type like 'action_plan_due:%' then
      'Un plan de acción de '||coalesce(v_contractor_name,'la empresa')||' está próximo a vencer. Revisa su avance.'
    when new.event_type like 'action_plan_overdue:%' then
      'Un plan de acción de '||coalesce(v_contractor_name,'la empresa')||' está vencido y sigue pendiente.'
    else new.body
  end;

  v_action_payload := jsonb_strip_nulls(
    coalesce(new.action_payload,'{}'::jsonb)
    || jsonb_build_object(
      'projectKey',new.project_key,
      'contractorKey',new.contractor_key,
      'workerRut',new.worker_rut,
      'requirementKey',new.requirement_key,
      'paymentCaseId',new.payment_case_id,
      'supportTicketId',new.support_ticket_id,
      'actionPlanId',v_plan_id,
      'evaluationId',v_evaluation_id
    )
  );

  for v_profile_id in
    select mm.profile_id
    from public.mandante_memberships mm
    join public.profiles pr on pr.id=mm.profile_id and pr.is_active
    where mm.mandante_id=v_mandante_id and mm.is_active
  loop
    insert into public.notifications(
      recipient_profile_id,notification_key,audience,event_type,category,severity,status,
      title,body,action_label,action_kind,action_payload,
      project_id,project_key,contratista_id,contractor_key,worker_id,worker_rut,
      requirement_id,requirement_key,obligation_id,document_id,document_version_id,
      payment_case_id,support_ticket_id,occurred_at,resolved_at,occurrence_count,email_eligible
    ) values (
      v_profile_id,v_key,'mandante',new.event_type,new.category,new.severity,new.status,
      v_title,v_body,
      case
        when new.event_type like 'action_plan_submitted:%' then 'Revisar plan'
        when new.event_type like 'action_plan_due:%' or new.event_type like 'action_plan_overdue:%' then 'Ver plan'
        else new.action_label
      end,
      new.action_kind,v_action_payload,
      new.project_id,new.project_key,new.contratista_id,new.contractor_key,new.worker_id,new.worker_rut,
      new.requirement_id,new.requirement_key,new.obligation_id,new.document_id,new.document_version_id,
      new.payment_case_id,new.support_ticket_id,new.occurred_at,new.resolved_at,new.occurrence_count,false
    )
    on conflict (recipient_profile_id,notification_key) do update set
      event_type=excluded.event_type,
      category=excluded.category,
      severity=excluded.severity,
      status=excluded.status,
      title=excluded.title,
      body=excluded.body,
      action_label=excluded.action_label,
      action_kind=excluded.action_kind,
      action_payload=excluded.action_payload,
      project_id=excluded.project_id,
      project_key=excluded.project_key,
      contratista_id=excluded.contratista_id,
      contractor_key=excluded.contractor_key,
      worker_id=excluded.worker_id,
      worker_rut=excluded.worker_rut,
      requirement_id=excluded.requirement_id,
      requirement_key=excluded.requirement_key,
      obligation_id=excluded.obligation_id,
      document_id=excluded.document_id,
      document_version_id=excluded.document_version_id,
      payment_case_id=excluded.payment_case_id,
      support_ticket_id=excluded.support_ticket_id,
      occurred_at=excluded.occurred_at,
      resolved_at=excluded.resolved_at,
      occurrence_count=excluded.occurrence_count,
      updated_at=now();

    if new.status='active' and (tg_op='INSERT' or coalesce(old.status,'resolved')='resolved') then
      delete from public.notification_reads
      where profile_id=v_profile_id and notification_key=v_key;
    end if;
  end loop;

  return new;
end
$$;

revoke all on function private.mirror_contractor_notification_to_mandante() from public,anon,authenticated;

drop trigger if exists notifications_mirror_to_mandante on public.notifications;
create trigger notifications_mirror_to_mandante
after insert or update of status,title,body,severity,category,action_label,action_kind,action_payload,occurred_at,resolved_at,occurrence_count
on public.notifications
for each row execute function private.mirror_contractor_notification_to_mandante();

create or replace function private.notify_mandante_support_reply()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  v_ticket public.support_tickets%rowtype;
  v_project_key text;
  v_mandante_id uuid;
  v_contractor_id uuid;
  v_contractor_key text;
  v_contractor_name text;
  v_is_contractor_author boolean := false;
  v_profile_id uuid;
  v_key text;
begin
  if new.is_internal then return new; end if;

  select * into v_ticket from public.support_tickets where id=new.ticket_id;
  if v_ticket.id is null then return new; end if;

  select p.integration_key,p.mandante_id
  into v_project_key,v_mandante_id
  from public.projects p where p.id=v_ticket.project_id;

  if v_ticket.accreditation_id is not null then
    select a.contratista_id,c.integration_key,c.name,
      exists(
        select 1 from public.contratista_memberships cm
        where cm.contratista_id=a.contratista_id
          and cm.profile_id=new.author_id
          and cm.is_active
      )
    into v_contractor_id,v_contractor_key,v_contractor_name,v_is_contractor_author
    from public.accreditations a
    join public.contratistas c on c.id=a.contratista_id
    where a.id=v_ticket.accreditation_id;
  end if;

  if v_is_contractor_author then
    v_key := 'mandante:support_reply:'||new.id::text;
    for v_profile_id in
      select mm.profile_id
      from public.mandante_memberships mm
      join public.profiles pr on pr.id=mm.profile_id and pr.is_active
      where mm.mandante_id=v_mandante_id and mm.is_active
    loop
      insert into public.notifications(
        recipient_profile_id,notification_key,audience,event_type,category,severity,status,
        title,body,action_label,action_kind,action_payload,
        project_id,project_key,contratista_id,contractor_key,support_ticket_id,
        occurred_at,resolved_at,occurrence_count,email_eligible
      ) values (
        v_profile_id,v_key,'mandante','support_contractor_reply','accion','action','active',
        'Nueva respuesta de '||coalesce(v_contractor_name,'contratista'),
        coalesce(v_ticket.subject,'Soporte')||': '||left(new.body,260),
        'Ver conversación','soporte',
        jsonb_strip_nulls(jsonb_build_object(
          'projectKey',v_project_key,
          'contractorKey',v_contractor_key,
          'supportTicketId',v_ticket.id
        )),
        v_ticket.project_id,v_project_key,v_contractor_id,v_contractor_key,v_ticket.id,
        new.created_at,null,1,false
      )
      on conflict (recipient_profile_id,notification_key) do nothing;
    end loop;
  else
    update public.notifications n
    set status='resolved',resolved_at=coalesce(n.resolved_at,now()),updated_at=now()
    where n.audience='mandante'
      and n.event_type='support_contractor_reply'
      and n.support_ticket_id=v_ticket.id
      and n.status='active';
  end if;

  return new;
end
$$;

revoke all on function private.notify_mandante_support_reply() from public,anon,authenticated;

drop trigger if exists support_ticket_messages_notify_mandante_reply on public.support_ticket_messages;
create trigger support_ticket_messages_notify_mandante_reply
after insert on public.support_ticket_messages
for each row execute function private.notify_mandante_support_reply();

create or replace function private.resolve_mandante_support_on_ticket_close()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  if old.status is distinct from new.status and new.status in ('resuelto','cerrado') then
    update public.notifications n
    set status='resolved',resolved_at=coalesce(n.resolved_at,now()),updated_at=now()
    where n.audience='mandante'
      and n.event_type='support_contractor_reply'
      and n.support_ticket_id=new.id
      and n.status='active';
  end if;
  return new;
end
$$;

revoke all on function private.resolve_mandante_support_on_ticket_close() from public,anon,authenticated;

drop trigger if exists support_tickets_resolve_mandante_notifications on public.support_tickets;
create trigger support_tickets_resolve_mandante_notifications
after update of status on public.support_tickets
for each row execute function private.resolve_mandante_support_on_ticket_close();
