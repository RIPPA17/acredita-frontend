begin;

create table public.assets (
  id uuid primary key default gen_random_uuid(),
  accreditation_id uuid not null references public.accreditations(id) on delete cascade,
  service_id uuid references public.services(id) on delete set null,
  integration_key text unique,
  asset_type text not null check (asset_type in ('vehiculo','maquinaria','equipo')),
  identifier text not null,
  name text not null,
  brand text,
  model text,
  year integer check (year is null or year between 1900 and 2100),
  owner_name text,
  operator_name text,
  status text not null default 'pendiente' check (status in ('pendiente','en_revision','habilitado','bloqueado','inactivo')),
  access_allowed boolean not null default false,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (accreditation_id, asset_type, identifier)
);

create table public.asset_documents (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.assets(id) on delete cascade,
  document_type text not null,
  document_name text,
  status text not null default 'pendiente' check (status in ('pendiente','en_revision','aprobado','rechazado','vencido')),
  issued_at date,
  expires_at date,
  storage_bucket text,
  storage_path text,
  rejection_reason text,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint asset_documents_dates_valid check (expires_at is null or issued_at is null or expires_at >= issued_at),
  unique (asset_id, document_type)
);

create index assets_accreditation_status_idx on public.assets(accreditation_id, status) where is_active;
create index assets_service_idx on public.assets(service_id) where service_id is not null and is_active;
create index asset_documents_asset_status_idx on public.asset_documents(asset_id, status);
create index asset_documents_expiry_idx on public.asset_documents(expires_at) where expires_at is not null;

create or replace function private.guard_asset_operational_decision()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  project_id uuid;
  can_decide boolean;
begin
  select ac.project_id into project_id
  from public.accreditations ac
  where ac.id = new.accreditation_id;
  can_decide := (select private.is_acredita_staff()) or (select private.can_manage_project(project_id));

  if tg_op = 'INSERT' and not can_decide and (new.status <> 'pendiente' or new.access_allowed) then
    raise exception 'El contratista no puede auto-habilitar un activo';
  end if;
  if tg_op = 'UPDATE' and not can_decide
    and (new.status is distinct from old.status or new.access_allowed is distinct from old.access_allowed) then
    raise exception 'Solo el mandante o Acredita pueden cambiar el estado operacional';
  end if;
  return new;
end;
$$;

alter table public.assets enable row level security;
alter table public.asset_documents enable row level security;

create policy assets_select_authorized on public.assets for select to authenticated
using ((select private.can_access_accreditation(assets.accreditation_id)));
create policy assets_insert_authorized on public.assets for insert to authenticated
with check ((select private.can_access_accreditation(assets.accreditation_id)));
create policy assets_update_authorized on public.assets for update to authenticated
using ((select private.can_access_accreditation(assets.accreditation_id)))
with check ((select private.can_access_accreditation(assets.accreditation_id)));

create policy asset_documents_select_authorized on public.asset_documents for select to authenticated
using (exists (
  select 1 from public.assets a
  where a.id = asset_documents.asset_id
    and (select private.can_access_accreditation(a.accreditation_id))
));
create policy asset_documents_insert_authorized on public.asset_documents for insert to authenticated
with check (exists (
  select 1 from public.assets a
  where a.id = asset_documents.asset_id
    and (select private.can_access_accreditation(a.accreditation_id))
));
create policy asset_documents_update_authorized on public.asset_documents for update to authenticated
using (exists (
  select 1 from public.assets a
  where a.id = asset_documents.asset_id
    and (select private.can_access_accreditation(a.accreditation_id))
))
with check (exists (
  select 1 from public.assets a
  where a.id = asset_documents.asset_id
    and (select private.can_access_accreditation(a.accreditation_id))
));

create trigger trg_assets_touch_updated_at before update on public.assets
for each row execute function private.touch_operational_updated_at();
create trigger trg_assets_guard_operational_decision before insert or update on public.assets
for each row execute function private.guard_asset_operational_decision();
create trigger trg_asset_documents_touch_updated_at before update on public.asset_documents
for each row execute function private.touch_operational_updated_at();

create or replace view public.asset_registry
with (security_invoker = true)
as
select
  a.id,
  a.integration_key,
  p.integration_key as project_key,
  c.integration_key as contractor_key,
  s.integration_key as service_key,
  a.accreditation_id,
  a.service_id,
  a.asset_type,
  a.identifier,
  a.name,
  a.brand,
  a.model,
  a.year,
  a.owner_name,
  a.operator_name,
  a.status,
  a.access_allowed,
  a.notes,
  a.is_active,
  coalesce(d.total_documents, 0)::integer as total_documents,
  coalesce(d.approved_documents, 0)::integer as approved_documents,
  coalesce(d.blocking_documents, 0)::integer as blocking_documents,
  d.next_expiry
from public.assets a
join public.accreditations ac on ac.id = a.accreditation_id
join public.projects p on p.id = ac.project_id
join public.contratistas c on c.id = ac.contratista_id
left join public.services s on s.id = a.service_id
left join lateral (
  select
    count(*) as total_documents,
    count(*) filter (where ad.status = 'aprobado' and (ad.expires_at is null or ad.expires_at >= current_date)) as approved_documents,
    count(*) filter (where ad.status in ('rechazado','vencido') or (ad.expires_at is not null and ad.expires_at < current_date)) as blocking_documents,
    min(ad.expires_at) filter (where ad.expires_at >= current_date) as next_expiry
  from public.asset_documents ad where ad.asset_id = a.id
) d on true;

grant select, insert, update on public.assets to authenticated;
grant select, insert, update on public.asset_documents to authenticated;
grant select on public.asset_registry to authenticated;
revoke all on public.assets, public.asset_documents, public.asset_registry from anon;

commit;
