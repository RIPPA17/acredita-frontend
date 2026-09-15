begin;

-- Tenant-scoped authorization helpers.
create or replace function private.has_mandante_project_access(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.projects p
      join public.mandante_memberships mm on mm.mandante_id = p.mandante_id
      where p.id = p_project_id
        and mm.profile_id = (select auth.uid())
        and mm.is_active = true
    );
$$;
revoke all on function private.has_mandante_project_access(uuid) from public, anon;
grant execute on function private.has_mandante_project_access(uuid) to authenticated, service_role;

create or replace function private.can_access_accreditation(p_accreditation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.accreditations a
      where a.id = p_accreditation_id
        and (
          (select private.is_acredita_staff())
          or (select private.has_contratista_access(a.contratista_id))
          or (select private.has_mandante_project_access(a.project_id))
        )
    );
$$;
revoke all on function private.can_access_accreditation(uuid) from public, anon;
grant execute on function private.can_access_accreditation(uuid) to authenticated, service_role;

create or replace function private.can_access_support_ticket(p_ticket_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.support_tickets t
      where t.id = p_ticket_id
        and (
          (select private.is_acredita_staff())
          or (select private.has_mandante_project_access(t.project_id))
          or t.created_by = (select auth.uid())
          or (t.accreditation_id is not null and (select private.can_access_accreditation(t.accreditation_id)))
        )
    );
$$;
revoke all on function private.can_access_support_ticket(uuid) from public, anon;
grant execute on function private.can_access_support_ticket(uuid) to authenticated, service_role;

create or replace function private.can_access_credential(p_credential_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.access_credentials cr
      where cr.id = p_credential_id
        and (
          (select private.is_acredita_staff())
          or (select private.has_mandante_project_access(cr.project_id))
          or (
            cr.worker_assignment_id is not null
            and exists (
              select 1 from public.worker_assignments wa
              where wa.id = cr.worker_assignment_id
                and (select private.can_access_accreditation(wa.accreditation_id))
            )
          )
          or (
            cr.asset_id is not null
            and exists (
              select 1 from public.assets a
              where a.id = cr.asset_id
                and (select private.can_access_accreditation(a.accreditation_id))
            )
          )
        )
    );
$$;
revoke all on function private.can_access_credential(uuid) from public, anon;
grant execute on function private.can_access_credential(uuid) to authenticated, service_role;

drop policy if exists accreditations_select_authorized on public.accreditations;
create policy accreditations_select_authorized
on public.accreditations for select to authenticated
using ((select private.can_access_accreditation(accreditations.id)));

drop policy if exists tickets_select on public.support_tickets;
create policy tickets_select on public.support_tickets for select to authenticated
using ((select private.can_access_support_ticket(support_tickets.id)));

drop policy if exists tickets_insert on public.support_tickets;
create policy tickets_insert on public.support_tickets for insert to authenticated
with check (
  created_by = (select auth.uid())
  and (select private.can_access_project(project_id))
  and (
    accreditation_id is null
    or exists (
      select 1 from public.accreditations a
      where a.id = support_tickets.accreditation_id
        and a.project_id = support_tickets.project_id
        and (select private.can_access_accreditation(a.id))
    )
  )
);

drop policy if exists tickets_update on public.support_tickets;
create policy tickets_update on public.support_tickets for update to authenticated
using (
  (select private.is_acredita_staff())
  or (select private.can_manage_project(project_id))
  or created_by = (select auth.uid())
)
with check (
  (select private.is_acredita_staff())
  or (select private.can_manage_project(project_id))
  or (
    created_by = (select auth.uid())
    and (select private.can_access_project(project_id))
    and (
      accreditation_id is null
      or exists (
        select 1 from public.accreditations a
        where a.id = support_tickets.accreditation_id
          and a.project_id = support_tickets.project_id
          and (select private.can_access_accreditation(a.id))
      )
    )
  )
);

drop policy if exists ticket_messages_select on public.support_ticket_messages;
create policy ticket_messages_select on public.support_ticket_messages for select to authenticated
using (
  (select private.can_access_support_ticket(ticket_id))
  and (
    not is_internal
    or (select private.is_acredita_staff())
    or exists (
      select 1 from public.support_tickets t
      where t.id = support_ticket_messages.ticket_id
        and (select private.can_manage_project(t.project_id))
    )
  )
);

drop policy if exists ticket_messages_insert on public.support_ticket_messages;
create policy ticket_messages_insert on public.support_ticket_messages for insert to authenticated
with check (
  author_id = (select auth.uid())
  and (select private.can_access_support_ticket(ticket_id))
  and (
    not is_internal
    or (select private.is_acredita_staff())
    or exists (
      select 1 from public.support_tickets t
      where t.id = support_ticket_messages.ticket_id
        and (select private.can_manage_project(t.project_id))
    )
  )
);

drop policy if exists operation_attachments_select on public.operation_attachments;
create policy operation_attachments_select on public.operation_attachments for select to authenticated
using (
  (payment_case_id is not null and exists(
    select 1 from public.payment_cases p
    where p.id = operation_attachments.payment_case_id
      and (select private.can_access_accreditation(p.accreditation_id))
  ))
  or (support_ticket_id is not null and (select private.can_access_support_ticket(support_ticket_id)))
  or (action_plan_id is not null and exists(
    select 1
    from public.evaluation_action_plans ap
    join public.contractor_evaluations e on e.id = ap.evaluation_id
    where ap.id = operation_attachments.action_plan_id
      and (select private.can_access_accreditation(e.accreditation_id))
  ))
);

drop policy if exists operation_attachments_insert on public.operation_attachments;
create policy operation_attachments_insert on public.operation_attachments for insert to authenticated
with check (
  uploaded_by = (select auth.uid())
  and (
    (payment_case_id is not null and exists(
      select 1 from public.payment_cases p
      where p.id = operation_attachments.payment_case_id
        and (select private.can_access_accreditation(p.accreditation_id))
    ))
    or (support_ticket_id is not null and (select private.can_access_support_ticket(support_ticket_id)))
    or (action_plan_id is not null and exists(
      select 1
      from public.evaluation_action_plans ap
      join public.contractor_evaluations e on e.id = ap.evaluation_id
      where ap.id = operation_attachments.action_plan_id
        and (select private.can_access_accreditation(e.accreditation_id))
    ))
  )
);

drop policy if exists credentials_select on public.access_credentials;
create policy credentials_select on public.access_credentials for select to authenticated
using ((select private.can_access_credential(access_credentials.id)));

drop policy if exists access_events_select on public.access_events;
create policy access_events_select on public.access_events for select to authenticated
using (
  (select private.is_acredita_staff())
  or (select private.has_mandante_project_access(project_id))
  or (credential_id is not null and (select private.can_access_credential(credential_id)))
);

drop policy if exists audit_logs_select_authorized on public.audit_logs;
create policy audit_logs_select_authorized on public.audit_logs for select to authenticated
using (
  (select private.is_acredita_staff())
  or (accreditation_id is not null and (select private.can_access_accreditation(accreditation_id)))
  or (
    accreditation_id is null
    and project_id is not null
    and (select private.has_mandante_project_access(project_id))
  )
);

drop policy if exists sync_runs_select on public.integration_sync_runs;
create policy sync_runs_select on public.integration_sync_runs for select to authenticated
using (
  exists (
    select 1 from public.integration_configs i
    where i.id = integration_sync_runs.integration_config_id
      and ((select private.is_acredita_staff()) or (select private.can_manage_project(i.project_id)))
  )
);

create or replace function private.can_access_library_document(p_document_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.document_library d
      where d.id = p_document_id
        and (
          (select private.is_acredita_staff())
          or (select private.has_contratista_access(d.contratista_id))
          or exists (
            select 1
            from public.document_library_links l
            join public.document_obligations o on o.id = l.document_obligation_id
            where l.library_document_id = d.id
              and (select private.can_access_accreditation(o.accreditation_id))
          )
        )
    );
$$;
revoke all on function private.can_access_library_document(uuid) from public, anon;
grant execute on function private.can_access_library_document(uuid) to authenticated, service_role;

create or replace function private.library_link_context_valid(p_library_document_id uuid, p_obligation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.document_library d
    join public.document_obligations o on o.id = p_obligation_id
    join public.accreditations a on a.id = o.accreditation_id
    where d.id = p_library_document_id
      and d.contratista_id = a.contratista_id
  );
$$;
revoke all on function private.library_link_context_valid(uuid,uuid) from public, anon;
grant execute on function private.library_link_context_valid(uuid,uuid) to authenticated, service_role;

drop policy if exists library_select on public.document_library;
create policy library_select on public.document_library for select to authenticated
using ((select private.can_access_library_document(id)));

drop policy if exists library_insert on public.document_library;
create policy library_insert on public.document_library for insert to authenticated
with check (
  uploaded_by = (select auth.uid())
  and ((select private.is_acredita_staff()) or (select private.has_contratista_access(contratista_id)))
);

drop policy if exists library_update on public.document_library;
create policy library_update on public.document_library for update to authenticated
using ((select private.is_acredita_staff()) or (select private.has_contratista_access(contratista_id)))
with check ((select private.is_acredita_staff()) or (select private.has_contratista_access(contratista_id)));

drop policy if exists library_links_select on public.document_library_links;
create policy library_links_select on public.document_library_links for select to authenticated
using (
  (select private.can_access_library_document(library_document_id))
  or exists (
    select 1 from public.document_obligations o
    where o.id = document_library_links.document_obligation_id
      and (select private.can_access_accreditation(o.accreditation_id))
  )
);

drop policy if exists library_links_insert on public.document_library_links;
create policy library_links_insert on public.document_library_links for insert to authenticated
with check (
  linked_by = (select auth.uid())
  and (select private.library_link_context_valid(library_document_id, document_obligation_id))
  and exists (
    select 1 from public.document_library d
    where d.id = document_library_links.library_document_id
      and ((select private.is_acredita_staff()) or (select private.has_contratista_access(d.contratista_id)))
  )
);

drop policy if exists library_files_select on storage.objects;
create policy library_files_select on storage.objects for select to authenticated
using (
  bucket_id = 'document-library'
  and exists (
    select 1 from public.document_library d
    where d.storage_path = name
      and (select private.can_access_library_document(d.id))
  )
);

create or replace function private.set_contractor_parent(
  p_project_key text,
  p_contractor_key text,
  p_parent_contractor_key text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  project_id uuid;
  contractor_id uuid;
  parent_id uuid;
begin
  select p.id into project_id from public.projects p where p.integration_key = p_project_key;
  select c.id into contractor_id from public.contratistas c where c.integration_key = p_contractor_key;
  if p_parent_contractor_key is not null then
    select c.id into parent_id from public.contratistas c where c.integration_key = p_parent_contractor_key;
  end if;
  if project_id is null or contractor_id is null or (p_parent_contractor_key is not null and parent_id is null) then
    raise exception 'Proyecto o contratista no encontrado';
  end if;
  if not ((select private.is_acredita_staff()) or (select private.can_manage_project(project_id))) then
    raise exception 'No tienes permisos para administrar este proyecto';
  end if;
  if not exists (
    select 1 from public.accreditations a
    where a.project_id = project_id and a.contratista_id = contractor_id and a.is_active
  ) or (parent_id is not null and not exists (
    select 1 from public.accreditations a
    where a.project_id = project_id and a.contratista_id = parent_id and a.is_active
  )) then
    raise exception 'Ambos contratistas deben estar activos en el proyecto';
  end if;
  update public.contratistas
  set parent_contratista_id = parent_id, updated_at = now()
  where id = contractor_id;
end;
$$;
revoke all on function private.set_contractor_parent(text,text,text) from public, anon;
grant execute on function private.set_contractor_parent(text,text,text) to authenticated, service_role;

create or replace function public.set_contractor_parent(
  p_project_key text,
  p_contractor_key text,
  p_parent_contractor_key text default null
)
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.set_contractor_parent(p_project_key, p_contractor_key, p_parent_contractor_key);
$$;
revoke all on function public.set_contractor_parent(text,text,text) from public, anon;
grant execute on function public.set_contractor_parent(text,text,text) to authenticated, service_role;

create unique index if not exists asset_requirement_templates_document_type_ci_unique
on public.asset_requirement_templates(project_id, asset_type, lower(document_type));

create or replace function private.asset_requirements_satisfied(
  p_asset_id uuid,
  p_accreditation_id uuid,
  p_asset_type text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  with required as (
    select t.id, t.document_type
    from public.accreditations ac
    join public.asset_requirement_templates t
      on t.project_id = ac.project_id
     and t.asset_type = p_asset_type
     and t.is_required = true
    where ac.id = p_accreditation_id
  ), status as (
    select r.id, ad.id as document_id, ad.status, ad.expires_at
    from required r
    left join public.asset_documents ad
      on ad.asset_id = p_asset_id
     and lower(ad.document_type) = lower(r.document_type)
  )
  select count(*) > 0
     and count(*) filter (
       where document_id is null
          or status <> 'aprobado'
          or (expires_at is not null and expires_at < current_date)
     ) = 0
  from status;
$$;
revoke all on function private.asset_requirements_satisfied(uuid,uuid,text) from public, anon, authenticated;
grant execute on function private.asset_requirements_satisfied(uuid,uuid,text) to service_role;

create or replace function private.refresh_asset_status(p_asset_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_project_id uuid;
  v_asset_type text;
  v_required integer := 0;
  v_unsatisfied integer := 0;
  v_blocked integer := 0;
begin
  select ac.project_id, a.asset_type into v_project_id, v_asset_type
  from public.assets a
  join public.accreditations ac on ac.id = a.accreditation_id
  where a.id = p_asset_id;
  if v_project_id is null then return; end if;
  select
    count(*) filter (where t.is_required),
    count(*) filter (
      where t.is_required
        and (ad.id is null or ad.status <> 'aprobado' or (ad.expires_at is not null and ad.expires_at < current_date))
    ),
    count(*) filter (
      where t.is_required and t.blocks_access and ad.id is not null
        and (ad.status in ('rechazado','vencido') or (ad.expires_at is not null and ad.expires_at < current_date))
    )
    into v_required, v_unsatisfied, v_blocked
  from public.asset_requirement_templates t
  left join public.asset_documents ad
    on ad.asset_id = p_asset_id and lower(ad.document_type) = lower(t.document_type)
  where t.project_id = v_project_id and t.asset_type = v_asset_type;
  update public.assets
  set status = case
      when v_required = 0 then 'pendiente'
      when v_blocked > 0 then 'bloqueado'
      when v_unsatisfied > 0 then 'en_revision'
      else 'habilitado'
    end,
    access_allowed = (v_required > 0 and v_unsatisfied = 0 and v_blocked = 0)
  where id = p_asset_id;
end;
$$;
revoke all on function private.refresh_asset_status(uuid) from public, anon, authenticated;

create or replace function private.guard_asset_operational_decision()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  project_id uuid;
  can_decide boolean;
  satisfied boolean;
begin
  select ac.project_id into project_id from public.accreditations ac where ac.id = new.accreditation_id;
  can_decide := (select auth.uid()) is null
    or (select private.is_acredita_staff())
    or (select private.can_manage_project(project_id));
  if tg_op = 'INSERT' and not can_decide and (new.status <> 'pendiente' or new.access_allowed) then
    raise exception 'El contratista no puede auto-habilitar un activo';
  end if;
  if tg_op = 'UPDATE' and not can_decide
     and (new.status is distinct from old.status or new.access_allowed is distinct from old.access_allowed) then
    raise exception 'El estado operacional se determina por la matriz documental';
  end if;
  if new.status = 'habilitado' or new.access_allowed then
    satisfied := private.asset_requirements_satisfied(new.id, new.accreditation_id, new.asset_type);
    if not coalesce(satisfied, false) then
      raise exception 'El activo no cumple todos los documentos obligatorios vigentes';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function private.guard_asset_operational_decision() from public, anon, authenticated;

create or replace function private.refresh_asset_after_document()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare target_asset uuid;
begin
  target_asset := case when tg_op = 'DELETE' then old.asset_id else new.asset_id end;
  perform private.refresh_asset_status(target_asset);
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;
revoke all on function private.refresh_asset_after_document() from public, anon, authenticated;

create or replace function private.refresh_assets_after_template()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  item record;
  old_project uuid;
  old_type text;
  new_project uuid;
  new_type text;
begin
  if tg_op <> 'INSERT' then old_project := old.project_id; old_type := old.asset_type; end if;
  if tg_op <> 'DELETE' then new_project := new.project_id; new_type := new.asset_type; end if;
  for item in
    select distinct a.id
    from public.assets a
    join public.accreditations ac on ac.id = a.accreditation_id
    where a.is_active
      and ((old_project is not null and ac.project_id = old_project and a.asset_type = old_type)
        or (new_project is not null and ac.project_id = new_project and a.asset_type = new_type))
  loop
    perform private.refresh_asset_status(item.id);
  end loop;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;
revoke all on function private.refresh_assets_after_template() from public, anon, authenticated;

create or replace function private.refresh_asset_after_context_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.refresh_asset_status(new.id);
  return new;
end;
$$;
revoke all on function private.refresh_asset_after_context_change() from public, anon, authenticated;

drop trigger if exists asset_templates_refresh_assets on public.asset_requirement_templates;
create trigger asset_templates_refresh_assets after insert or update or delete on public.asset_requirement_templates
for each row execute function private.refresh_assets_after_template();

drop trigger if exists assets_refresh_context on public.assets;
create trigger assets_refresh_context after insert or update of accreditation_id, asset_type on public.assets
for each row execute function private.refresh_asset_after_context_change();

create or replace function private.validate_asset_operator_context()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  asset_accreditation uuid;
  worker_accreditation uuid;
begin
  select a.accreditation_id into asset_accreditation from public.assets a where a.id = new.asset_id;
  select wa.accreditation_id into worker_accreditation from public.worker_assignments wa where wa.id = new.worker_assignment_id;
  if asset_accreditation is null or worker_accreditation is null or asset_accreditation <> worker_accreditation then
    raise exception 'El operador y el activo deben pertenecer a la misma acreditación';
  end if;
  return new;
end;
$$;
revoke all on function private.validate_asset_operator_context() from public, anon, authenticated;

drop trigger if exists asset_operator_context_guard on public.asset_operator_assignments;
create trigger asset_operator_context_guard before insert or update of asset_id, worker_assignment_id on public.asset_operator_assignments
for each row execute function private.validate_asset_operator_context();

create or replace view public.asset_requirement_statuses with (security_invoker = true) as
select
  a.id as asset_id,
  p.integration_key as project_key,
  c.integration_key as contractor_key,
  a.asset_type,
  t.id as template_id,
  t.document_type,
  t.validity_days,
  t.blocks_access,
  t.is_required,
  t.review_checklist,
  ad.id as document_id,
  ad.document_name,
  ad.issued_at,
  ad.expires_at,
  ad.rejection_reason,
  case
    when ad.id is null then 'pendiente'
    when ad.expires_at is not null and ad.expires_at < current_date then 'vencido'
    else ad.status
  end as effective_status,
  ad.status = 'aprobado' and (ad.expires_at is null or ad.expires_at >= current_date) as satisfied
from public.assets a
join public.accreditations ac on ac.id = a.accreditation_id
join public.projects p on p.id = ac.project_id
join public.contratistas c on c.id = ac.contratista_id
join public.asset_requirement_templates t on t.project_id = ac.project_id and t.asset_type = a.asset_type
left join public.asset_documents ad on ad.asset_id = a.id and lower(ad.document_type) = lower(t.document_type)
where a.is_active;
revoke all on public.asset_requirement_statuses from anon;
grant select on public.asset_requirement_statuses to authenticated, service_role;

create or replace view public.asset_operator_candidates with (security_invoker = true) as
select
  wa.id as worker_assignment_id,
  a.id as accreditation_id,
  p.integration_key as project_key,
  c.integration_key as contractor_key,
  w.id as worker_id,
  w.full_name,
  w.rut,
  coalesce(wa.job_title, w.job_title) as job_title,
  wa.access_status
from public.worker_assignments wa
join public.accreditations a on a.id = wa.accreditation_id
join public.projects p on p.id = a.project_id
join public.contratistas c on c.id = a.contratista_id
join public.workers w on w.id = wa.worker_id
where wa.is_active and wa.assignment_status = 'activa' and a.is_active and w.is_active;
revoke all on public.asset_operator_candidates from anon;
grant select on public.asset_operator_candidates to authenticated, service_role;

create index if not exists asset_inspections_inspected_by_idx on public.asset_inspections(inspected_by);
create index if not exists asset_maintenance_created_by_idx on public.asset_maintenance(created_by);
create index if not exists asset_operator_assignments_created_by_idx on public.asset_operator_assignments(created_by);
create index if not exists asset_operator_assignments_worker_idx on public.asset_operator_assignments(worker_assignment_id);
create index if not exists document_library_uploaded_by_idx on public.document_library(uploaded_by);
create index if not exists document_library_links_library_idx on public.document_library_links(library_document_id);
create index if not exists document_library_links_linked_by_idx on public.document_library_links(linked_by);
create index if not exists evaluation_action_plans_created_by_idx on public.evaluation_action_plans(created_by);
create index if not exists operation_attachments_action_plan_idx on public.operation_attachments(action_plan_id) where action_plan_id is not null;
create index if not exists operation_attachments_uploaded_by_idx on public.operation_attachments(uploaded_by);
create index if not exists payment_approvals_decided_by_idx on public.payment_approvals(decided_by);
create index if not exists payment_cases_submitted_by_idx on public.payment_cases(submitted_by) where submitted_by is not null;
create index if not exists support_ticket_messages_author_idx on public.support_ticket_messages(author_id);

do $$
declare item record;
begin
  for item in select id from public.assets where is_active loop
    perform private.refresh_asset_status(item.id);
  end loop;
end;
$$;

commit;
