
alter table public.projects
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by uuid references public.profiles(id) on delete set null,
  add column if not exists archive_reason text;

update public.projects
set archived_at = coalesce(archived_at, updated_at, created_at, now()),
    archive_reason = coalesce(nullif(btrim(archive_reason), ''), 'Proyecto archivado antes del registro formal de cierre.')
where status = 'archived';

alter table public.compliance_periods
  drop constraint if exists compliance_periods_status_check;
alter table public.compliance_periods
  add constraint compliance_periods_status_check
  check (status = any (array['abierto'::text,'en_revision'::text,'cerrado'::text,'reabierto'::text,'cancelado'::text]));

create or replace function private.project_is_operational(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path=''
as $$
  select exists(
    select 1 from public.projects p
    where p.id=p_project_id and p.status='active'
  );
$$;

create or replace function private.accreditation_is_operational(p_accreditation_id uuid)
returns boolean
language sql
stable
security definer
set search_path=''
as $$
  select exists(
    select 1
    from public.accreditations a
    join public.projects p on p.id=a.project_id
    where a.id=p_accreditation_id
      and a.is_active
      and p.status='active'
  );
$$;

revoke all on function private.project_is_operational(uuid) from public,anon,authenticated;
revoke all on function private.accreditation_is_operational(uuid) from public,anon,authenticated;

create or replace function private.can_access_project(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path=''
as $$
  select (select auth.uid()) is not null
    and (
      private.is_acredita_staff()
      or exists (
        select 1
        from public.projects p
        join public.mandante_memberships mm on mm.mandante_id=p.mandante_id
        where p.id=p_project_id
          and mm.profile_id=(select auth.uid())
          and mm.is_active=true
      )
      or exists (
        select 1
        from public.accreditations a
        join public.contratista_memberships cm on cm.contratista_id=a.contratista_id
        where a.project_id=p_project_id
          and cm.profile_id=(select auth.uid())
          and cm.is_active=true
      )
    );
$$;

create or replace function private.can_access_mandante(p_mandante_id uuid)
returns boolean
language sql
stable
security definer
set search_path=''
as $$
  select (select auth.uid()) is not null
    and (
      private.is_acredita_staff()
      or private.has_mandante_access(p_mandante_id)
      or exists (
        select 1
        from public.projects p
        join public.accreditations a on a.project_id=p.id
        join public.contratista_memberships cm on cm.contratista_id=a.contratista_id
        where p.mandante_id=p_mandante_id
          and cm.profile_id=(select auth.uid())
          and cm.is_active=true
      )
    );
$$;

create or replace function private.can_access_worker(p_worker_id uuid)
returns boolean
language sql
stable
security definer
set search_path=''
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.workers w
      where w.id=p_worker_id
        and (
          private.is_acredita_staff()
          or private.has_contratista_access(w.contratista_id)
          or exists (
            select 1
            from public.worker_assignments wa
            join public.accreditations a on a.id=wa.accreditation_id
            join public.projects p on p.id=a.project_id
            join public.mandante_memberships mm on mm.mandante_id=p.mandante_id
            where wa.worker_id=w.id
              and mm.profile_id=(select auth.uid())
              and mm.is_active=true
          )
        )
    );
$$;

create or replace function private.can_upload_document(p_document_id uuid)
returns boolean
language sql
stable
security definer
set search_path=''
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.documents d
      join public.accreditations a on a.id=d.accreditation_id
      join public.projects p on p.id=a.project_id
      where d.id=p_document_id
        and a.is_active
        and p.status='active'
        and (
          private.is_acredita_staff()
          or private.has_contratista_access(a.contratista_id)
        )
    );
$$;

create or replace function private.guard_project_archive()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  if tg_op='UPDATE' and old.status='archived' then
    if new.mandante_id is distinct from old.mandante_id
       or new.name is distinct from old.name
       or new.code is distinct from old.code
       or new.description is distinct from old.description
       or new.status is distinct from old.status
       or new.starts_at is distinct from old.starts_at
       or new.ends_at is distinct from old.ends_at
       or new.integration_key is distinct from old.integration_key
       or new.location is distinct from old.location
       or new.data_environment is distinct from old.data_environment
       or new.responsible_name is distinct from old.responsible_name
       or new.responsible_email is distinct from old.responsible_email
       or new.responsible_phone is distinct from old.responsible_phone
       or new.archived_at is distinct from old.archived_at
       or new.archived_by is distinct from old.archived_by
       or new.archive_reason is distinct from old.archive_reason
    then
      raise exception using errcode='42501', message='Un proyecto archivado es histórico y no admite modificaciones ni reactivación.';
    end if;
    return new;
  end if;

  if new.status='archived' and (tg_op='INSERT' or old.status is distinct from 'archived') then
    new.archived_at := coalesce(new.archived_at, now());
    new.archived_by := coalesce(new.archived_by, (select auth.uid()));
    new.archive_reason := coalesce(nullif(btrim(new.archive_reason),''), 'Cierre histórico del proyecto');
    if new.ends_at is null or new.ends_at > current_date then
      new.ends_at := case
        when new.starts_at is not null and new.starts_at > current_date then new.starts_at
        else current_date
      end;
    end if;
  elsif new.status<>'archived' then
    new.archived_at := null;
    new.archived_by := null;
    new.archive_reason := null;
  end if;
  return new;
end;
$$;

revoke all on function private.guard_project_archive() from public,anon,authenticated;

drop trigger if exists projects_archive_guard on public.projects;
create trigger projects_archive_guard
before insert or update on public.projects
for each row execute function private.guard_project_archive();

create or replace function private.ensure_compliance_periods_for_project(p_project_id uuid, p_until date default (current_date + 365))
returns integer
language plpgsql
security definer
set search_path=''
as $$
declare
  inserted_count integer := 0;
  v_status text;
begin
  select p.status into v_status from public.projects p where p.id=p_project_id;
  if v_status is distinct from 'active' then
    return 0;
  end if;

  insert into public.compliance_periods(project_id,period_start,period_end,upload_deadline,review_deadline)
  select
    p_project_id,
    month_start::date,
    (month_start + interval '1 month - 1 day')::date,
    (month_start + interval '1 month + 5 days')::date,
    (month_start + interval '1 month + 10 days')::date
  from generate_series(
    date_trunc('month',current_date),
    date_trunc('month',p_until),
    interval '1 month'
  ) month_start
  on conflict (project_id,period_start,period_end) do nothing;
  get diagnostics inserted_count=row_count;
  return inserted_count;
end;
$$;

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

  update public.document_obligations o
  set is_active=false,updated_at=now()
  from public.accreditations a
  where o.accreditation_id=a.id
    and a.project_id=new.id
    and o.is_active;
  get diagnostics v_obligations=row_count;

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
  where project_id=new.id and status='active';

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

drop trigger if exists projects_apply_archive_lifecycle on public.projects;
create trigger projects_apply_archive_lifecycle
after update of status on public.projects
for each row execute function private.apply_project_archive_lifecycle();

create or replace function private.archive_project_impl(p_project_key text,p_reason text)
returns public.projects
language plpgsql
security definer
set search_path=''
as $$
declare
  v_project public.projects%rowtype;
  v_reason text := nullif(btrim(coalesce(p_reason,'')),'');
begin
  if (select auth.uid()) is null then
    raise exception using errcode='28000',message='Sesión inválida.';
  end if;
  if v_reason is null or char_length(v_reason)<3 then
    raise exception using errcode='22023',message='Indica un motivo de cierre de al menos 3 caracteres.';
  end if;

  select * into v_project
  from public.projects p
  where p.integration_key=p_project_key
  for update;

  if v_project.id is null then
    raise exception using errcode='22023',message='Proyecto no encontrado.';
  end if;
  if not (private.is_acredita_staff() or private.can_manage_project(v_project.id)) then
    raise exception using errcode='42501',message='No tienes permisos para archivar este proyecto.';
  end if;
  if v_project.status='archived' then
    return v_project;
  end if;

  update public.projects
  set status='archived',
      archive_reason=v_reason,
      archived_by=(select auth.uid())
  where id=v_project.id
  returning * into v_project;

  return v_project;
end;
$$;

revoke all on function private.archive_project_impl(text,text) from public,anon,authenticated;

create or replace function public.archive_project(p_project_key text,p_reason text)
returns public.projects
language sql
set search_path=''
as $$
  select private.archive_project_impl(p_project_key,p_reason);
$$;

revoke all on function public.archive_project(text,text) from public,anon;
grant execute on function public.archive_project(text,text) to authenticated;

drop policy if exists requirements_insert_manager on public.requirements;
create policy requirements_insert_manager on public.requirements for insert to authenticated
with check (private.can_manage_project(project_id) and private.project_is_operational(project_id));

drop policy if exists requirements_update_manager on public.requirements;
create policy requirements_update_manager on public.requirements for update to authenticated
using (private.can_manage_project(project_id) and private.project_is_operational(project_id))
with check (private.can_manage_project(project_id) and private.project_is_operational(project_id));

drop policy if exists compliance_periods_insert_managers on public.compliance_periods;
create policy compliance_periods_insert_managers on public.compliance_periods for insert to authenticated
with check ((private.is_acredita_staff() or private.can_manage_project(project_id)) and private.project_is_operational(project_id));

drop policy if exists compliance_periods_update_managers on public.compliance_periods;
create policy compliance_periods_update_managers on public.compliance_periods for update to authenticated
using ((private.is_acredita_staff() or private.can_manage_project(project_id)) and private.project_is_operational(project_id))
with check ((private.is_acredita_staff() or private.can_manage_project(project_id)) and private.project_is_operational(project_id));

drop policy if exists compliance_periods_delete_managers on public.compliance_periods;
create policy compliance_periods_delete_managers on public.compliance_periods for delete to authenticated
using ((private.is_acredita_staff() or private.can_manage_project(project_id)) and private.project_is_operational(project_id));

drop policy if exists services_insert_managers on public.services;
create policy services_insert_managers on public.services for insert to authenticated
with check (
  (private.is_acredita_staff() or exists(select 1 from public.accreditations a where a.id=accreditation_id and private.can_manage_project(a.project_id)))
  and private.accreditation_is_operational(accreditation_id)
);

drop policy if exists services_update_managers on public.services;
create policy services_update_managers on public.services for update to authenticated
using (
  (private.is_acredita_staff() or exists(select 1 from public.accreditations a where a.id=accreditation_id and private.can_manage_project(a.project_id)))
  and private.accreditation_is_operational(accreditation_id)
)
with check (
  (private.is_acredita_staff() or exists(select 1 from public.accreditations a where a.id=accreditation_id and private.can_manage_project(a.project_id)))
  and private.accreditation_is_operational(accreditation_id)
);

drop policy if exists worker_assignments_insert_contractor on public.worker_assignments;
create policy worker_assignments_insert_contractor on public.worker_assignments for insert to authenticated
with check (
  private.worker_matches_accreditation(worker_id,accreditation_id)
  and private.accreditation_is_operational(accreditation_id)
  and (private.is_acredita_staff() or private.owns_accreditation(accreditation_id))
);

drop policy if exists worker_assignments_update_contractor on public.worker_assignments;
create policy worker_assignments_update_contractor on public.worker_assignments for update to authenticated
using (
  private.accreditation_is_operational(accreditation_id)
  and (private.is_acredita_staff() or private.owns_accreditation(accreditation_id))
)
with check (
  private.worker_matches_accreditation(worker_id,accreditation_id)
  and private.accreditation_is_operational(accreditation_id)
  and (private.is_acredita_staff() or private.owns_accreditation(accreditation_id))
);

drop policy if exists documents_insert_contractor on public.documents;
create policy documents_insert_contractor on public.documents for insert to authenticated
with check (
  private.document_context_valid(accreditation_id,requirement_id,worker_id)
  and private.accreditation_is_operational(accreditation_id)
  and (private.is_acredita_staff() or private.owns_accreditation(accreditation_id))
);

drop policy if exists assets_update_authorized on public.assets;
create policy assets_update_authorized on public.assets for update to authenticated
using (private.can_access_accreditation(accreditation_id) and private.accreditation_is_operational(accreditation_id))
with check (private.can_access_accreditation(accreditation_id) and private.accreditation_is_operational(accreditation_id));

drop policy if exists asset_templates_insert on public.asset_requirement_templates;
create policy asset_templates_insert on public.asset_requirement_templates for insert to authenticated
with check ((private.is_acredita_staff() or private.can_manage_project(project_id)) and private.project_is_operational(project_id));

drop policy if exists asset_templates_update on public.asset_requirement_templates;
create policy asset_templates_update on public.asset_requirement_templates for update to authenticated
using ((private.is_acredita_staff() or private.can_manage_project(project_id)) and private.project_is_operational(project_id))
with check ((private.is_acredita_staff() or private.can_manage_project(project_id)) and private.project_is_operational(project_id));

drop policy if exists payments_insert on public.payment_cases;
create policy payments_insert on public.payment_cases for insert to authenticated
with check (
  private.accreditation_is_operational(accreditation_id)
  and (private.is_acredita_staff() or exists(select 1 from public.accreditations a where a.id=accreditation_id and private.can_manage_project(a.project_id)))
);

drop policy if exists payments_update on public.payment_cases;
create policy payments_update on public.payment_cases for update to authenticated
using (
  private.accreditation_is_operational(accreditation_id)
  and (private.is_acredita_staff() or exists(select 1 from public.accreditations a where a.id=accreditation_id and private.can_manage_project(a.project_id)))
)
with check (
  private.accreditation_is_operational(accreditation_id)
  and (private.is_acredita_staff() or exists(select 1 from public.accreditations a where a.id=accreditation_id and private.can_manage_project(a.project_id)))
);

drop policy if exists payment_approvals_insert on public.payment_approvals;
create policy payment_approvals_insert on public.payment_approvals for insert to authenticated
with check (
  decided_by=(select auth.uid())
  and exists(
    select 1 from public.payment_cases pc
    join public.accreditations a on a.id=pc.accreditation_id
    where pc.id=payment_case_id
      and private.accreditation_is_operational(a.id)
      and (private.is_acredita_staff() or private.can_manage_project(a.project_id))
  )
);

drop policy if exists tickets_insert on public.support_tickets;
create policy tickets_insert on public.support_tickets for insert to authenticated
with check (
  created_by=(select auth.uid())
  and private.project_is_operational(project_id)
  and private.can_access_project(project_id)
  and (accreditation_id is null or (
    private.can_access_accreditation(accreditation_id)
    and private.accreditation_is_operational(accreditation_id)
  ))
);

drop policy if exists tickets_update on public.support_tickets;
create policy tickets_update on public.support_tickets for update to authenticated
using (
  private.project_is_operational(project_id)
  and (private.is_acredita_staff() or private.can_manage_project(project_id))
)
with check (
  private.project_is_operational(project_id)
  and (private.is_acredita_staff() or private.can_manage_project(project_id))
);

drop policy if exists ticket_messages_insert on public.support_ticket_messages;
create policy ticket_messages_insert on public.support_ticket_messages for insert to authenticated
with check (
  author_id=(select auth.uid())
  and private.can_access_support_ticket(ticket_id)
  and exists(
    select 1 from public.support_tickets t
    where t.id=ticket_id
      and private.project_is_operational(t.project_id)
      and t.status<>'cerrado'
  )
  and (
    not is_internal
    or private.is_acredita_staff()
    or exists(select 1 from public.support_tickets t where t.id=ticket_id and private.can_manage_project(t.project_id))
  )
);

drop policy if exists operation_attachments_insert on public.operation_attachments;
create policy operation_attachments_insert on public.operation_attachments for insert to authenticated
with check (
  uploaded_by=(select auth.uid())
  and (
    (payment_case_id is not null and exists(
      select 1 from public.payment_cases pc
      where pc.id=payment_case_id
        and private.can_access_accreditation(pc.accreditation_id)
        and private.accreditation_is_operational(pc.accreditation_id)
    ))
    or (support_ticket_id is not null and exists(
      select 1 from public.support_tickets t
      where t.id=support_ticket_id
        and private.can_access_support_ticket(t.id)
        and private.project_is_operational(t.project_id)
    ))
    or (action_plan_id is not null and exists(
      select 1
      from public.evaluation_action_plans ap
      join public.contractor_evaluations e on e.id=ap.evaluation_id
      where ap.id=action_plan_id
        and private.can_access_accreditation(e.accreditation_id)
        and private.accreditation_is_operational(e.accreditation_id)
    ))
  )
);

drop policy if exists document_obligations_update_managers on public.document_obligations;
create policy document_obligations_update_managers on public.document_obligations for update to authenticated
using (
  private.accreditation_is_operational(accreditation_id)
  and (private.is_acredita_staff() or exists(select 1 from public.accreditations a where a.id=accreditation_id and private.can_manage_project(a.project_id)))
)
with check (
  private.accreditation_is_operational(accreditation_id)
  and (private.is_acredita_staff() or exists(select 1 from public.accreditations a where a.id=accreditation_id and private.can_manage_project(a.project_id)))
);
