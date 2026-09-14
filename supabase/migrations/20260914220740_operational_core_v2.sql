-- Núcleo operacional v2 de Acredita.
-- Añade servicios/contratos, asignaciones explícitas, obligaciones por período,
-- aplicabilidad, cierres y compuertas independientes sin eliminar datos legacy.

begin;

alter table public.projects
  add column if not exists location text,
  add column if not exists starts_at date,
  add column if not exists ends_at date;

alter table public.contratistas
  add column if not exists parent_contratista_id uuid references public.contratistas(id) on delete set null;

create index if not exists idx_contratistas_parent
  on public.contratistas(parent_contratista_id)
  where parent_contratista_id is not null;

alter table public.requirements
  add column if not exists description text,
  add column if not exists review_checklist jsonb not null default '[]'::jsonb,
  add column if not exists applicability jsonb not null default '{"categories":[]}'::jsonb,
  add column if not exists blocks_work boolean not null default false,
  add column if not exists blocks_assignment boolean not null default false,
  add column if not exists due_days integer not null default 5;

alter table public.requirements
  drop constraint if exists requirements_review_checklist_array,
  add constraint requirements_review_checklist_array check (jsonb_typeof(review_checklist) = 'array'),
  drop constraint if exists requirements_applicability_object,
  add constraint requirements_applicability_object check (jsonb_typeof(applicability) = 'object'),
  drop constraint if exists requirements_due_days_range,
  add constraint requirements_due_days_range check (due_days between 0 and 90);

do $$
declare
  item record;
begin
  for item in
    select conname from pg_constraint
    where conrelid = 'public.requirements'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%frequency%'
  loop
    execute format('alter table public.requirements drop constraint %I', item.conname);
  end loop;
end;
$$;
alter table public.requirements
  add constraint requirements_frequency_valid check (frequency in ('mensual','bimensual','trimestral','seis_meses','un_ano','por_obra','sin_vencimiento','personalizada'));

create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  accreditation_id uuid not null references public.accreditations(id) on delete cascade,
  integration_key text,
  code text not null,
  name text not null,
  category text,
  contractor_contact text,
  mandante_contact text,
  starts_at date,
  ends_at date,
  status text not null default 'activo' check (status in ('borrador','activo','suspendido','finalizado')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint services_dates_valid check (ends_at is null or starts_at is null or ends_at >= starts_at),
  constraint services_accreditation_code_unique unique (accreditation_id, code),
  constraint services_integration_key_unique unique (integration_key)
);

alter table public.requirements
  add column if not exists service_id uuid references public.services(id) on delete set null;
create index if not exists idx_requirements_service_active
  on public.requirements(service_id, target)
  where service_id is not null and is_active = true;
create index if not exists idx_requirements_service_id
  on public.requirements(service_id)
  where service_id is not null;

do $$
declare
  item record;
begin
  for item in
    select conname from pg_constraint
    where conrelid = 'public.requirements'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%criticality%'
  loop
    execute format('alter table public.requirements drop constraint %I', item.conname);
  end loop;
end;
$$;
alter table public.requirements
  add constraint requirements_criticality_valid check (criticality in ('bloquea_pago','bloquea_acceso','bloquea_ambas','advertencia'));

alter table public.worker_assignments
  add column if not exists service_id uuid references public.services(id) on delete set null,
  add column if not exists job_title text,
  add column if not exists categories text[] not null default '{}'::text[],
  add column if not exists assignment_status text not null default 'activa',
  add column if not exists access_status text not null default 'pendiente';

update public.worker_assignments
set assignment_status = case when is_active then 'activa' else 'inactiva' end
where assignment_status is null or assignment_status not in ('activa','inactiva','baja');

alter table public.worker_assignments
  drop constraint if exists worker_assignments_status_valid,
  add constraint worker_assignments_status_valid check (assignment_status in ('activa','inactiva','baja')),
  drop constraint if exists worker_assignments_access_status_valid,
  add constraint worker_assignments_access_status_valid check (access_status in ('habilitado','pendiente','bloqueado'));

create index if not exists idx_worker_assignments_service_active
  on public.worker_assignments(service_id, worker_id)
  where is_active = true;
create index if not exists idx_worker_assignments_service_id
  on public.worker_assignments(service_id)
  where service_id is not null;

create table if not exists public.document_obligations (
  id uuid primary key default gen_random_uuid(),
  accreditation_id uuid not null references public.accreditations(id) on delete cascade,
  service_id uuid references public.services(id) on delete cascade,
  worker_assignment_id uuid references public.worker_assignments(id) on delete cascade,
  requirement_id uuid not null references public.requirements(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  due_date date not null,
  status text not null default 'pendiente' check (status in ('pendiente','no_aplica')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint document_obligations_period_valid check (period_end >= period_start)
);

create unique index if not exists document_obligations_context_period_unique
  on public.document_obligations(
    accreditation_id,
    requirement_id,
    coalesce(service_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(worker_assignment_id, '00000000-0000-0000-0000-000000000000'::uuid),
    period_start,
    period_end
  ) where is_active;
create index if not exists idx_document_obligations_due
  on public.document_obligations(due_date, accreditation_id)
  where is_active = true and status <> 'no_aplica';
create index if not exists idx_document_obligations_assignment
  on public.document_obligations(worker_assignment_id, requirement_id, period_start desc)
  where worker_assignment_id is not null;
create index if not exists idx_document_obligations_service_id
  on public.document_obligations(service_id)
  where service_id is not null;
create index if not exists idx_document_obligations_requirement_id
  on public.document_obligations(requirement_id);
create index if not exists idx_document_obligations_worker_assignment_id
  on public.document_obligations(worker_assignment_id)
  where worker_assignment_id is not null;

alter table public.documents
  add column if not exists obligation_id uuid references public.document_obligations(id) on delete cascade;

-- Sustituye cualquier unicidad legacy que impida un documento distinto por período.
do $$
declare
  item record;
begin
  for item in
    select conname
    from pg_constraint
    where conrelid = 'public.documents'::regclass
      and contype = 'u'
      and pg_get_constraintdef(oid) ilike '%accreditation_id%requirement_id%worker_id%'
      and pg_get_constraintdef(oid) not ilike '%obligation_id%'
  loop
    execute format('alter table public.documents drop constraint %I', item.conname);
  end loop;
end;
$$;

create unique index if not exists documents_obligation_unique
  on public.documents(obligation_id)
  where obligation_id is not null;
create unique index if not exists documents_legacy_context_unique
  on public.documents(
    accreditation_id,
    requirement_id,
    coalesce(worker_id, '00000000-0000-0000-0000-000000000000'::uuid)
  ) where obligation_id is null;

create table if not exists public.compliance_periods (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  upload_deadline date,
  review_deadline date,
  status text not null default 'abierto' check (status in ('abierto','en_revision','cerrado','reabierto')),
  snapshot jsonb,
  closed_at timestamptz,
  closed_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint compliance_periods_dates_valid check (period_end >= period_start),
  constraint compliance_periods_project_period_unique unique (project_id, period_start, period_end)
);
create index if not exists idx_compliance_periods_closed_by
  on public.compliance_periods(closed_by)
  where closed_by is not null;

alter table public.services enable row level security;
alter table public.document_obligations enable row level security;
alter table public.compliance_periods enable row level security;

grant select, insert, update on public.services to authenticated, service_role;
grant select, update on public.document_obligations to authenticated, service_role;
grant insert on public.document_obligations to service_role;
grant select, insert, update on public.compliance_periods to authenticated, service_role;

drop policy if exists services_select_authorized on public.services;
create policy services_select_authorized on public.services for select to authenticated
using ((select private.can_access_accreditation(services.accreditation_id)));
drop policy if exists services_insert_managers on public.services;
create policy services_insert_managers on public.services for insert to authenticated
with check (
  (select private.is_acredita_staff())
  or exists (
    select 1 from public.accreditations a
    where a.id = services.accreditation_id
      and (select private.can_manage_project(a.project_id))
  )
);
drop policy if exists services_update_managers on public.services;
create policy services_update_managers on public.services for update to authenticated
using (
  (select private.is_acredita_staff())
  or exists (
    select 1 from public.accreditations a
    where a.id = services.accreditation_id
      and (select private.can_manage_project(a.project_id))
  )
)
with check (
  (select private.is_acredita_staff())
  or exists (
    select 1 from public.accreditations a
    where a.id = services.accreditation_id
      and (select private.can_manage_project(a.project_id))
  )
);

drop policy if exists document_obligations_select_authorized on public.document_obligations;
create policy document_obligations_select_authorized on public.document_obligations for select to authenticated
using ((select private.can_access_accreditation(document_obligations.accreditation_id)));
drop policy if exists document_obligations_insert_authorized on public.document_obligations;
drop policy if exists document_obligations_update_managers on public.document_obligations;
create policy document_obligations_update_managers on public.document_obligations for update to authenticated
using (
  (select private.is_acredita_staff())
  or exists (
    select 1 from public.accreditations a
    where a.id = document_obligations.accreditation_id
      and (select private.can_manage_project(a.project_id))
  )
)
with check (
  (select private.is_acredita_staff())
  or exists (
    select 1 from public.accreditations a
    where a.id = document_obligations.accreditation_id
      and (select private.can_manage_project(a.project_id))
  )
);

drop policy if exists compliance_periods_select_authorized on public.compliance_periods;
create policy compliance_periods_select_authorized on public.compliance_periods for select to authenticated
using ((select private.can_access_project(compliance_periods.project_id)));
drop policy if exists compliance_periods_write_managers on public.compliance_periods;
create policy compliance_periods_write_managers on public.compliance_periods for all to authenticated
using ((select private.is_acredita_staff()) or (select private.can_manage_project(compliance_periods.project_id)))
with check ((select private.is_acredita_staff()) or (select private.can_manage_project(compliance_periods.project_id)));

create or replace function private.touch_operational_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function private.touch_operational_updated_at() from public, anon, authenticated;

drop trigger if exists trg_services_touch on public.services;
create trigger trg_services_touch before update on public.services
for each row execute function private.touch_operational_updated_at();
drop trigger if exists trg_document_obligations_touch on public.document_obligations;
create trigger trg_document_obligations_touch before update on public.document_obligations
for each row execute function private.touch_operational_updated_at();
drop trigger if exists trg_compliance_periods_touch on public.compliance_periods;
create trigger trg_compliance_periods_touch before update on public.compliance_periods
for each row execute function private.touch_operational_updated_at();

create or replace function private.validate_operational_context()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  context_valid boolean;
begin
  if tg_table_name = 'requirements' and new.service_id is not null then
    select exists (
      select 1
      from public.services s
      join public.accreditations a on a.id = s.accreditation_id
      where s.id = new.service_id and a.project_id = new.project_id
    ) into context_valid;
  elsif tg_table_name = 'worker_assignments' and new.service_id is not null then
    select exists (
      select 1 from public.services s
      where s.id = new.service_id and s.accreditation_id = new.accreditation_id
    ) into context_valid;
  elsif tg_table_name = 'documents' and new.obligation_id is not null then
    select exists (
      select 1
      from public.document_obligations o
      left join public.worker_assignments wa on wa.id = o.worker_assignment_id
      where o.id = new.obligation_id
        and o.accreditation_id = new.accreditation_id
        and o.requirement_id = new.requirement_id
        and (
          (new.worker_id is null and o.worker_assignment_id is null)
          or (new.worker_id is not null and wa.worker_id = new.worker_id)
        )
    ) into context_valid;
  else
    return new;
  end if;

  if not coalesce(context_valid, false) then
    raise exception 'La relación operacional no pertenece al mismo contexto de acreditación';
  end if;
  return new;
end;
$$;

revoke all on function private.validate_operational_context() from public, anon, authenticated;

create or replace function private.validate_contractor_parent()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  creates_cycle boolean;
begin
  if new.parent_contratista_id is null then return new; end if;
  if new.parent_contratista_id = new.id then
    raise exception 'Un contratista no puede ser su propio contratista principal';
  end if;

  with recursive ancestors(id, parent_id, path) as (
    select c.id, c.parent_contratista_id, array[c.id]
    from public.contratistas c
    where c.id = new.parent_contratista_id
    union all
    select c.id, c.parent_contratista_id, ancestors.path || c.id
    from public.contratistas c
    join ancestors on c.id = ancestors.parent_id
    where not c.id = any(ancestors.path)
  )
  select exists(select 1 from ancestors where id = new.id) into creates_cycle;

  if creates_cycle then
    raise exception 'La relación de subcontratación produciría un ciclo';
  end if;
  return new;
end;
$$;

revoke all on function private.validate_contractor_parent() from public, anon, authenticated;

drop trigger if exists trg_requirements_validate_operational_context on public.requirements;
create trigger trg_requirements_validate_operational_context
before insert or update of project_id, service_id on public.requirements
for each row execute function private.validate_operational_context();
drop trigger if exists trg_assignments_validate_operational_context on public.worker_assignments;
create trigger trg_assignments_validate_operational_context
before insert or update of accreditation_id, service_id on public.worker_assignments
for each row execute function private.validate_operational_context();
drop trigger if exists trg_documents_validate_operational_context on public.documents;
create trigger trg_documents_validate_operational_context
before insert or update of accreditation_id, requirement_id, worker_id, obligation_id on public.documents
for each row execute function private.validate_operational_context();
drop trigger if exists trg_contratistas_validate_parent on public.contratistas;
create trigger trg_contratistas_validate_parent
before insert or update of parent_contratista_id on public.contratistas
for each row execute function private.validate_contractor_parent();

create or replace function public.set_contractor_parent(
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

revoke all on function public.set_contractor_parent(text,text,text) from public, anon;
grant execute on function public.set_contractor_parent(text,text,text) to authenticated, service_role;

create or replace function private.refresh_obligations_for_accreditation(
  p_accreditation_id uuid,
  p_from date default current_date,
  p_until date default (current_date + 365)
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  inserted_count integer := 0;
begin
  if p_until < p_from or p_until - p_from > 730 then
    raise exception 'El rango de obligaciones es inválido o supera 730 días';
  end if;

  with candidates as (
    select
      r.id as requirement_id,
      r.service_id,
      null::uuid as worker_assignment_id,
      greatest(p_from, coalesce(s.starts_at, p_from)) as starts_at,
      least(p_until, coalesce(s.ends_at, p_until)) as ends_at,
      r.frequency,
      r.due_days
    from public.accreditations a
    join public.requirements r on r.project_id = a.project_id and r.target = 'empresa' and r.is_active
    left join public.services s on s.id = r.service_id and s.accreditation_id = a.id and s.is_active and s.status = 'activo'
    where a.id = p_accreditation_id and a.is_active
      and (r.service_id is null or s.id is not null)
    union all
    select
      r.id,
      wa.service_id,
      wa.id,
      greatest(p_from, coalesce(wa.assigned_at::date, p_from), coalesce(s.starts_at, p_from)),
      least(p_until, coalesce(wa.unassigned_at::date, p_until), coalesce(s.ends_at, p_until)),
      r.frequency,
      r.due_days
    from public.worker_assignments wa
    join public.accreditations a on a.id = wa.accreditation_id and a.is_active
    left join public.services s on s.id = wa.service_id
    join public.requirements r on r.project_id = a.project_id and r.target = 'trabajador' and r.is_active
      and (r.service_id is null or r.service_id = wa.service_id)
      and (
        coalesce(jsonb_array_length(r.applicability -> 'categories'), 0) = 0
        or exists (
          select 1 from jsonb_array_elements_text(r.applicability -> 'categories') c(category)
          where lower(c.category) = any(select lower(category) from unnest(wa.categories) category)
             or lower(c.category) = 'general'
        )
      )
    where wa.accreditation_id = p_accreditation_id and wa.is_active and wa.assignment_status = 'activa'
      and (wa.service_id is null or (s.is_active and s.status = 'activo'))
  ), recurring as (
    select
      c.*,
      case c.frequency
        when 'mensual' then interval '1 month'
        when 'bimensual' then interval '2 months'
        when 'trimestral' then interval '3 months'
        when 'seis_meses' then interval '6 months'
        when 'un_ano' then interval '1 year'
        else null
      end as step
    from candidates c
  ), periods as (
    select
      r.requirement_id,
      r.service_id,
      r.worker_assignment_id,
      greatest(gs::date, r.starts_at) as period_start,
      least((gs + r.step - interval '1 day')::date, r.ends_at) as period_end,
      r.due_days
    from recurring r
    cross join lateral generate_series(date_trunc('month', r.starts_at)::date, r.ends_at, r.step) gs
    where r.step is not null and r.starts_at <= r.ends_at
    union all
    select requirement_id, service_id, worker_assignment_id, starts_at, ends_at, due_days
    from recurring
    where step is null and starts_at <= ends_at
  )
  insert into public.document_obligations(
    accreditation_id, service_id, worker_assignment_id, requirement_id,
    period_start, period_end, due_date
  )
  select
    p_accreditation_id, p.service_id, p.worker_assignment_id, p.requirement_id,
    p.period_start, p.period_end, p.period_end + p.due_days
  from periods p
  where not exists (
    select 1 from public.document_obligations existing
    where existing.accreditation_id = p_accreditation_id
      and existing.requirement_id = p.requirement_id
      and existing.service_id is not distinct from p.service_id
      and existing.worker_assignment_id is not distinct from p.worker_assignment_id
      and existing.period_start = p.period_start
      and existing.period_end = p.period_end
  );
  get diagnostics inserted_count = row_count;

  return inserted_count;
end;
$$;

revoke all on function private.refresh_obligations_for_accreditation(uuid,date,date) from public, anon, authenticated;

create or replace function public.refresh_document_obligations(
  p_accreditation_id uuid,
  p_from date default current_date,
  p_until date default (current_date + 365)
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not (select private.can_access_accreditation(p_accreditation_id)) then
    raise exception 'No tienes acceso a esta acreditación';
  end if;
  if p_from < current_date - 366 or p_until > current_date + 730 or p_until - p_from > 730 then
    raise exception 'El rango solicitado queda fuera de la ventana operacional permitida';
  end if;
  return private.refresh_obligations_for_accreditation(p_accreditation_id, p_from, p_until);
end;
$$;

revoke all on function public.refresh_document_obligations(uuid,date,date) from public, anon;
grant execute on function public.refresh_document_obligations(uuid,date,date) to authenticated, service_role;

create or replace function private.refresh_obligations_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  accreditation_id uuid;
begin
  if tg_table_name = 'worker_assignments' then
    accreditation_id := new.accreditation_id;
  elsif tg_table_name = 'services' then
    accreditation_id := new.accreditation_id;
  else
    for accreditation_id in select a.id from public.accreditations a where a.project_id = new.project_id and a.is_active loop
      perform private.refresh_obligations_for_accreditation(accreditation_id, current_date, current_date + 365);
    end loop;
    return new;
  end if;
  perform private.refresh_obligations_for_accreditation(accreditation_id, current_date, current_date + 365);
  return new;
end;
$$;

revoke all on function private.refresh_obligations_trigger() from public, anon, authenticated;

create or replace function private.retire_obligations_for_requirement_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.project_id is distinct from new.project_id
     or old.target is distinct from new.target
     or old.frequency is distinct from new.frequency
     or old.service_id is distinct from new.service_id
     or old.applicability is distinct from new.applicability
     or old.due_days is distinct from new.due_days then
    update public.document_obligations
    set is_active = false
    where requirement_id = new.id and is_active;
  end if;
  return new;
end;
$$;

revoke all on function private.retire_obligations_for_requirement_change() from public, anon, authenticated;

drop trigger if exists trg_requirements_refresh_obligations on public.requirements;
drop trigger if exists trg_requirements_retire_obligations on public.requirements;
create trigger trg_requirements_retire_obligations
before update of project_id, target, frequency, service_id, applicability, due_days on public.requirements
for each row execute function private.retire_obligations_for_requirement_change();
create trigger trg_requirements_refresh_obligations after insert or update of project_id, target, is_active, frequency, service_id, applicability, due_days on public.requirements
for each row execute function private.refresh_obligations_trigger();
drop trigger if exists trg_services_refresh_obligations on public.services;
create trigger trg_services_refresh_obligations after insert or update of is_active, status, starts_at, ends_at on public.services
for each row execute function private.refresh_obligations_trigger();
drop trigger if exists trg_worker_assignments_refresh_obligations on public.worker_assignments;
create trigger trg_worker_assignments_refresh_obligations after insert or update of is_active, assignment_status, service_id, categories on public.worker_assignments
for each row execute function private.refresh_obligations_trigger();
drop trigger if exists trg_accreditations_refresh_obligations on public.accreditations;
create trigger trg_accreditations_refresh_obligations after insert or update of is_active on public.accreditations
for each row execute function private.refresh_obligations_trigger();

create or replace view public.obligation_statuses
with (security_invoker = true)
as
with latest as (
  select distinct on (d.obligation_id)
    d.obligation_id,
    d.id as document_id,
    dv.id as version_id,
    dv.version_number,
    dv.workflow_status,
    dv.expires_at,
    dv.uploaded_at,
    dv.reviewed_at
  from public.documents d
  left join public.document_versions dv on dv.document_id = d.id
  where d.obligation_id is not null
  order by d.obligation_id, dv.version_number desc nulls last, dv.created_at desc nulls last
)
select
  o.id as obligation_id,
  o.accreditation_id,
  o.service_id,
  o.worker_assignment_id,
  o.requirement_id,
  o.period_start,
  o.period_end,
  o.due_date,
  (
    o.is_active
    and r.is_active
    and (o.service_id is null or (s.is_active and s.status = 'activo'))
    and (o.worker_assignment_id is null or (wa.is_active and wa.assignment_status = 'activa'))
  ) as is_active,
  r.target,
  r.is_required,
  r.criticality,
  r.blocks_work,
  r.blocks_assignment,
  latest.document_id,
  latest.version_id,
  latest.version_number,
  latest.workflow_status,
  latest.expires_at,
  latest.uploaded_at,
  latest.reviewed_at,
  case
    when o.status = 'no_aplica' then 'no_aplica'
    when latest.version_id is null and o.due_date < current_date then 'vencido'
    when latest.version_id is null then 'pendiente'
    else public.effective_document_status(latest.workflow_status, latest.expires_at, r.alert_days)
  end as effective_status
from public.document_obligations o
join public.requirements r on r.id = o.requirement_id
left join public.services s on s.id = o.service_id
left join public.worker_assignments wa on wa.id = o.worker_assignment_id
left join latest on latest.obligation_id = o.id;

revoke all on public.obligation_statuses from anon;
grant select on public.obligation_statuses to authenticated, service_role;

create or replace view public.worker_accreditation_statuses
with (security_invoker = true)
as
with stats as (
  select
    wa.id as assignment_id,
    wa.accreditation_id,
    a.project_id,
    a.contratista_id,
    wa.worker_id,
    w.full_name as worker_name,
    w.rut as worker_rut,
    count(os.obligation_id) filter (where os.is_required and os.criticality <> 'advertencia' and os.period_start <= current_date) as required_count,
    count(os.obligation_id) filter (where os.is_required and os.criticality <> 'advertencia' and os.period_start <= current_date and os.version_id is not null) as submitted_count,
    count(os.obligation_id) filter (where os.is_required and os.criticality <> 'advertencia' and os.period_start <= current_date and os.effective_status in ('aprobado','por_vencer','no_aplica')) as satisfied_count,
    count(os.obligation_id) filter (where os.is_required and os.criticality <> 'advertencia' and os.period_start <= current_date and os.effective_status in ('rechazado','vencido')) as blocked_count,
    count(os.obligation_id) filter (where os.is_required and os.criticality <> 'advertencia' and os.period_start <= current_date and os.effective_status = 'por_vencer') as near_expiry_count,
    count(os.obligation_id) filter (where os.is_required and os.criticality in ('bloquea_acceso','bloquea_ambas') and os.period_start <= current_date and os.effective_status in ('rechazado','vencido')) as access_blocked_count,
    count(os.obligation_id) filter (where os.is_required and os.criticality in ('bloquea_acceso','bloquea_ambas') and os.period_start <= current_date and os.effective_status in ('pendiente','revision')) as access_pending_count
  from public.worker_assignments wa
  join public.accreditations a on a.id = wa.accreditation_id
  join public.workers w on w.id = wa.worker_id
  left join public.obligation_statuses os on os.worker_assignment_id = wa.id and os.is_active
  where wa.is_active and wa.assignment_status = 'activa' and a.is_active and w.is_active
  group by wa.id, wa.accreditation_id, a.project_id, a.contratista_id, wa.worker_id, w.full_name, w.rut
)
select
  assignment_id,
  accreditation_id,
  project_id,
  contratista_id,
  worker_id,
  worker_name,
  worker_rut,
  required_count,
  submitted_count,
  satisfied_count,
  greatest(required_count - satisfied_count - blocked_count, 0) as pending_count,
  blocked_count,
  near_expiry_count,
  case when required_count = 0 then 0::numeric else round((satisfied_count::numeric * 100) / required_count, 1) end as compliance_percent,
  case
    when required_count = 0 then 'en_proceso'
    when submitted_count = 0 then 'no_acreditado'
    when blocked_count > 0 then 'vencido_bloqueado'
    when satisfied_count = required_count then 'aprobado'
    else 'en_proceso'
  end as status,
  access_blocked_count,
  access_pending_count,
  access_blocked_count = 0 and access_pending_count = 0 and required_count > 0 as access_allowed
from stats;

create or replace view public.accreditation_statuses
with (security_invoker = true)
as
with company_stats as (
  select
    a.id as accreditation_id,
    count(os.obligation_id) filter (where os.target = 'empresa' and os.is_required and os.criticality <> 'advertencia' and os.period_start <= current_date) as company_required_count,
    count(os.obligation_id) filter (where os.target = 'empresa' and os.is_required and os.criticality <> 'advertencia' and os.period_start <= current_date and os.version_id is not null) as company_submitted_count,
    count(os.obligation_id) filter (where os.target = 'empresa' and os.is_required and os.criticality <> 'advertencia' and os.period_start <= current_date and os.effective_status in ('aprobado','por_vencer','no_aplica')) as company_satisfied_count,
    count(os.obligation_id) filter (where os.target = 'empresa' and os.is_required and os.criticality <> 'advertencia' and os.period_start <= current_date and os.effective_status in ('rechazado','vencido')) as company_blocked_count,
    count(os.obligation_id) filter (where os.target = 'empresa' and os.is_required and os.criticality <> 'advertencia' and os.period_start <= current_date and os.effective_status = 'por_vencer') as company_near_expiry_count
  from public.accreditations a
  left join public.obligation_statuses os on os.accreditation_id = a.id and os.is_active
  group by a.id
), worker_stats as (
  select
    a.id as accreditation_id,
    count(was.assignment_id) as active_worker_count,
    count(was.assignment_id) filter (where was.status = 'aprobado') as approved_worker_count,
    count(was.assignment_id) filter (where was.status = 'vencido_bloqueado') as blocked_worker_count,
    count(was.assignment_id) filter (where was.status in ('en_proceso','no_acreditado')) as incomplete_worker_count,
    coalesce(sum(was.required_count), 0) as worker_required_count,
    coalesce(sum(was.satisfied_count), 0) as worker_satisfied_count,
    coalesce(sum(was.blocked_count), 0) as worker_blocked_requirement_count,
    coalesce(sum(was.near_expiry_count), 0) as worker_near_expiry_count
  from public.accreditations a
  left join public.worker_accreditation_statuses was on was.accreditation_id = a.id
  group by a.id
), gate_stats as (
  select
    a.id as accreditation_id,
    count(os.obligation_id) filter (where os.is_required and os.period_start <= current_date and os.criticality in ('bloquea_acceso','bloquea_ambas') and os.effective_status in ('rechazado','vencido')) as access_blocked_count,
    count(os.obligation_id) filter (where os.is_required and os.period_start <= current_date and os.criticality in ('bloquea_acceso','bloquea_ambas') and os.effective_status in ('pendiente','revision')) as access_pending_count,
    count(os.obligation_id) filter (where os.is_required and os.period_start <= current_date and os.criticality in ('bloquea_pago','bloquea_ambas') and os.effective_status in ('rechazado','vencido')) as payment_blocked_count,
    count(os.obligation_id) filter (where os.is_required and os.period_start <= current_date and os.criticality in ('bloquea_pago','bloquea_ambas') and os.effective_status in ('pendiente','revision')) as payment_pending_count
  from public.accreditations a
  left join public.obligation_statuses os on os.accreditation_id = a.id and os.is_active
  group by a.id
), computed as (
  select
    a.id as accreditation_id,
    a.project_id,
    a.contratista_id,
    a.is_active,
    cs.company_required_count,
    cs.company_submitted_count,
    cs.company_satisfied_count,
    greatest(cs.company_required_count - cs.company_satisfied_count - cs.company_blocked_count, 0) as company_pending_count,
    cs.company_blocked_count,
    ws.active_worker_count,
    ws.approved_worker_count,
    ws.blocked_worker_count,
    ws.incomplete_worker_count,
    ws.worker_required_count,
    ws.worker_satisfied_count,
    ws.worker_blocked_requirement_count,
    cs.company_required_count + ws.worker_required_count as total_required_count,
    cs.company_satisfied_count + ws.worker_satisfied_count as total_satisfied_count,
    cs.company_near_expiry_count + ws.worker_near_expiry_count as near_expiry_count,
    gs.access_blocked_count,
    gs.access_pending_count,
    gs.payment_blocked_count,
    gs.payment_pending_count,
    case
      when not a.is_active or ws.active_worker_count = 0 then 'no_acreditado'
      when cs.company_blocked_count > 0 or ws.blocked_worker_count > 0 then 'vencido_bloqueado'
      when cs.company_required_count = 0 or ws.worker_required_count = 0 then 'en_proceso'
      when cs.company_satisfied_count = cs.company_required_count and ws.approved_worker_count = ws.active_worker_count then 'aprobado'
      else 'en_proceso'
    end as status
  from public.accreditations a
  join company_stats cs on cs.accreditation_id = a.id
  join worker_stats ws on ws.accreditation_id = a.id
  join gate_stats gs on gs.accreditation_id = a.id
)
select
  accreditation_id,
  project_id,
  contratista_id,
  is_active,
  status,
  company_required_count,
  company_submitted_count,
  company_satisfied_count,
  company_pending_count,
  company_blocked_count,
  active_worker_count,
  approved_worker_count,
  blocked_worker_count,
  incomplete_worker_count,
  worker_required_count,
  worker_satisfied_count,
  worker_blocked_requirement_count,
  total_required_count,
  total_satisfied_count,
  near_expiry_count,
  case when total_required_count = 0 then 0::numeric else round((total_satisfied_count::numeric * 100) / total_required_count, 1) end as compliance_percent,
  access_blocked_count = 0 and access_pending_count = 0 and active_worker_count > 0 as access_allowed,
  payment_blocked_count = 0 and payment_pending_count = 0 and active_worker_count > 0 as payment_allowed,
  access_blocked_count,
  access_pending_count,
  payment_blocked_count,
  payment_pending_count
from computed;

revoke all on public.worker_accreditation_statuses from anon;
revoke all on public.accreditation_statuses from anon;
grant select on public.worker_accreditation_statuses to authenticated, service_role;
grant select on public.accreditation_statuses to authenticated, service_role;

create or replace function public.close_compliance_period(p_period_id uuid)
returns public.compliance_periods
language plpgsql
security invoker
set search_path = ''
as $$
declare
  period public.compliance_periods%rowtype;
begin
  select * into period from public.compliance_periods where id = p_period_id for update;
  if period.id is null then raise exception 'Período no encontrado'; end if;
  if not ((select private.is_acredita_staff()) or (select private.can_manage_project(period.project_id))) then
    raise exception 'No tienes permisos para cerrar este período';
  end if;
  update public.compliance_periods cp
  set status = 'cerrado', closed_at = now(), closed_by = (select auth.uid()),
      snapshot = (
        select jsonb_build_object(
          'generated_at', now(),
          'accreditations', coalesce((
            select jsonb_agg(to_jsonb(s))
            from public.accreditation_statuses s
            where s.project_id = period.project_id
          ), '[]'::jsonb),
          'obligations', coalesce((
            select jsonb_agg(to_jsonb(os))
            from public.obligation_statuses os
            join public.accreditations a on a.id = os.accreditation_id
            where a.project_id = period.project_id
              and os.period_start >= period.period_start
              and os.period_end <= period.period_end
          ), '[]'::jsonb)
        )
      )
  where cp.id = p_period_id
  returning * into period;
  return period;
end;
$$;

revoke all on function public.close_compliance_period(uuid) from public, anon;
grant execute on function public.close_compliance_period(uuid) to authenticated, service_role;

create or replace function private.ensure_compliance_periods_for_project(
  p_project_id uuid,
  p_until date default (current_date + 365)
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  inserted_count integer := 0;
begin
  insert into public.compliance_periods(project_id, period_start, period_end, upload_deadline, review_deadline)
  select
    p_project_id,
    month_start::date,
    (month_start + interval '1 month - 1 day')::date,
    (month_start + interval '1 month + 5 days')::date,
    (month_start + interval '1 month + 10 days')::date
  from generate_series(
    date_trunc('month', current_date),
    date_trunc('month', p_until),
    interval '1 month'
  ) month_start
  on conflict (project_id, period_start, period_end) do nothing;
  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$$;

revoke all on function private.ensure_compliance_periods_for_project(uuid,date) from public, anon, authenticated;

create or replace function private.ensure_compliance_periods_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.ensure_compliance_periods_for_project(new.id, current_date + 365);
  return new;
end;
$$;

revoke all on function private.ensure_compliance_periods_trigger() from public, anon, authenticated;

drop trigger if exists trg_projects_ensure_compliance_periods on public.projects;
create trigger trg_projects_ensure_compliance_periods
after insert or update on public.projects
for each row execute function private.ensure_compliance_periods_trigger();

do $$
declare
  project_id uuid;
begin
  for project_id in select id from public.projects loop
    perform private.ensure_compliance_periods_for_project(project_id, current_date + 365);
  end loop;
end;
$$;

do $$
declare
  accreditation_id uuid;
begin
  for accreditation_id in select id from public.accreditations where is_active loop
    perform private.refresh_obligations_for_accreditation(accreditation_id, current_date, current_date + 365);
  end loop;
end;
$$;

-- Conserva la versión vigente de cada documento legacy vinculándola a la
-- obligación exigible más reciente del mismo contexto.
update public.documents d
set obligation_id = (
  select o.id
  from public.document_obligations o
  left join public.worker_assignments wa on wa.id = o.worker_assignment_id
  where o.accreditation_id = d.accreditation_id
    and o.requirement_id = d.requirement_id
    and o.period_start <= current_date
    and (
      (d.worker_id is null and o.worker_assignment_id is null)
      or (d.worker_id is not null and wa.worker_id = d.worker_id)
    )
  order by o.period_start desc, o.created_at desc
  limit 1
)
where d.obligation_id is null
  and exists (
    select 1
    from public.document_obligations o
    left join public.worker_assignments wa on wa.id = o.worker_assignment_id
    where o.accreditation_id = d.accreditation_id
      and o.requirement_id = d.requirement_id
      and o.period_start <= current_date
      and ((d.worker_id is null and o.worker_assignment_id is null) or (d.worker_id is not null and wa.worker_id = d.worker_id))
  );

create or replace function private.prevent_closed_period_document_changes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  obligation_id uuid;
  is_closed boolean;
begin
  if tg_table_name = 'documents' then
    obligation_id := new.obligation_id;
  else
    select d.obligation_id into obligation_id
    from public.documents d
    where d.id = new.document_id;
  end if;
  if obligation_id is null then return new; end if;

  select exists (
    select 1
    from public.document_obligations o
    join public.accreditations a on a.id = o.accreditation_id
    join public.compliance_periods cp
      on cp.project_id = a.project_id
     and o.period_start >= cp.period_start
     and o.period_end <= cp.period_end
    where o.id = obligation_id and cp.status = 'cerrado'
  ) into is_closed;

  if is_closed then
    raise exception 'El período documental está cerrado. Debes reabrirlo antes de modificar sus documentos';
  end if;
  return new;
end;
$$;

revoke all on function private.prevent_closed_period_document_changes() from public, anon, authenticated;

drop trigger if exists trg_documents_prevent_closed_period_changes on public.documents;
create trigger trg_documents_prevent_closed_period_changes
before insert or update of obligation_id on public.documents
for each row execute function private.prevent_closed_period_document_changes();
drop trigger if exists trg_document_versions_prevent_closed_period_changes on public.document_versions;
create trigger trg_document_versions_prevent_closed_period_changes
before insert or update of workflow_status, expires_at, rejection_reason, rejection_explanation, rejection_solution on public.document_versions
for each row execute function private.prevent_closed_period_document_changes();

-- Amplía la auditoría existente para registrar el contexto operacional nuevo.
create or replace function private.audit_worker_assignment_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_project_id uuid;
  v_action text;
begin
  select a.project_id into v_project_id
  from public.accreditations a
  where a.id = new.accreditation_id;

  if tg_op = 'INSERT' or (old.is_active = false and new.is_active = true) then
    v_action := 'worker_assigned';
  elsif old.is_active = true and new.is_active = false then
    v_action := 'worker_unassigned';
  elsif old.service_id is distinct from new.service_id
     or old.job_title is distinct from new.job_title
     or old.categories is distinct from new.categories
     or old.assignment_status is distinct from new.assignment_status
     or old.access_status is distinct from new.access_status
     or old.assigned_at is distinct from new.assigned_at
     or old.unassigned_at is distinct from new.unassigned_at then
    v_action := 'worker_assignment_updated';
  else
    return new;
  end if;

  insert into public.audit_logs(
    actor_profile_id, action, entity_type, entity_id, project_id, accreditation_id, details
  ) values (
    (select auth.uid()), v_action, 'worker_assignment', new.id, v_project_id, new.accreditation_id,
    jsonb_build_object(
      'worker_id', new.worker_id,
      'service_id', new.service_id,
      'job_title', new.job_title,
      'categories', new.categories,
      'assignment_status', new.assignment_status,
      'access_status', new.access_status,
      'is_active', new.is_active
    )
  );
  return new;
end;
$$;

create or replace function private.audit_requirement_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_action text;
begin
  if tg_op = 'INSERT' then
    v_action := 'requirement_created';
  elsif old.name is distinct from new.name
     or old.target is distinct from new.target
     or old.is_required is distinct from new.is_required
     or old.frequency is distinct from new.frequency
     or old.validity_days is distinct from new.validity_days
     or old.alert_days is distinct from new.alert_days
     or old.criticality is distinct from new.criticality
     or old.is_active is distinct from new.is_active
     or old.description is distinct from new.description
     or old.review_checklist is distinct from new.review_checklist
     or old.applicability is distinct from new.applicability
     or old.blocks_work is distinct from new.blocks_work
     or old.blocks_assignment is distinct from new.blocks_assignment
     or old.service_id is distinct from new.service_id then
    v_action := 'requirement_updated';
  else
    return new;
  end if;

  insert into public.audit_logs(
    actor_profile_id, action, entity_type, entity_id, project_id, accreditation_id, details
  ) values (
    (select auth.uid()), v_action, 'requirement', new.id, new.project_id, null,
    jsonb_build_object(
      'name', new.name,
      'target', new.target,
      'is_required', new.is_required,
      'frequency', new.frequency,
      'validity_days', new.validity_days,
      'alert_days', new.alert_days,
      'criticality', new.criticality,
      'description', new.description,
      'review_checklist', new.review_checklist,
      'applicability', new.applicability,
      'blocks_work', new.blocks_work,
      'blocks_assignment', new.blocks_assignment,
      'service_id', new.service_id,
      'is_active', new.is_active
    )
  );
  return new;
end;
$$;

create or replace function private.audit_operational_entity_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_project_id uuid;
  v_accreditation_id uuid;
  v_action text;
  v_details jsonb;
begin
  if tg_table_name = 'services' then
    v_accreditation_id := new.accreditation_id;
    select a.project_id into v_project_id from public.accreditations a where a.id = new.accreditation_id;
    v_action := case when tg_op = 'INSERT' then 'service_created' else 'service_updated' end;
    v_details := jsonb_build_object('code', new.code, 'name', new.name, 'status', new.status, 'starts_at', new.starts_at, 'ends_at', new.ends_at);
  else
    v_project_id := new.project_id;
    v_action := case when tg_op = 'INSERT' then 'compliance_period_created' when new.status = 'cerrado' then 'compliance_period_closed' when new.status = 'reabierto' then 'compliance_period_reopened' else 'compliance_period_updated' end;
    v_details := jsonb_build_object('period_start', new.period_start, 'period_end', new.period_end, 'status', new.status, 'closed_at', new.closed_at);
  end if;

  insert into public.audit_logs(
    actor_profile_id, action, entity_type, entity_id, project_id, accreditation_id, details
  ) values (
    (select auth.uid()), v_action, tg_table_name, new.id, v_project_id, v_accreditation_id, v_details
  );
  return new;
end;
$$;

revoke all on function private.audit_operational_entity_change() from public, anon, authenticated;

drop trigger if exists trg_audit_worker_assignment_change on public.worker_assignments;
create trigger trg_audit_worker_assignment_change
after insert or update of is_active, service_id, job_title, categories, assignment_status, access_status, assigned_at, unassigned_at
on public.worker_assignments
for each row execute function private.audit_worker_assignment_change();

drop trigger if exists trg_audit_requirement_change on public.requirements;
create trigger trg_audit_requirement_change
after insert or update of name, target, is_required, frequency, validity_days, alert_days, criticality, is_active, description, review_checklist, applicability, blocks_work, blocks_assignment, service_id
on public.requirements
for each row execute function private.audit_requirement_change();

drop trigger if exists trg_audit_service_change on public.services;
create trigger trg_audit_service_change
after insert or update of code, name, category, contractor_contact, mandante_contact, starts_at, ends_at, status, is_active
on public.services
for each row execute function private.audit_operational_entity_change();

drop trigger if exists trg_audit_compliance_period_change on public.compliance_periods;
create trigger trg_audit_compliance_period_change
after update of upload_deadline, review_deadline, status, snapshot, closed_at, closed_by
on public.compliance_periods
for each row execute function private.audit_operational_entity_change();

comment on table public.services is 'Servicios o contratos ejecutados por un contratista dentro de un proyecto.';
comment on table public.document_obligations is 'Instancias periódicas generadas desde requisitos documentales.';
comment on table public.compliance_periods is 'Cierres documentales por proyecto con fotografía histórica.';
comment on view public.obligation_statuses is 'Estado efectivo de cada obligación y su última versión documental.';
comment on view public.accreditation_statuses is 'Estado oficial con compuertas independientes de acceso y pago.';

commit;
