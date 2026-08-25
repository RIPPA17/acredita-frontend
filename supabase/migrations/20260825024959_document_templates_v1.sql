create table public.document_templates (
  id uuid primary key default gen_random_uuid(),
  integration_key text not null unique,
  name text not null,
  category text not null check (category in ('Laboral','Tributario','Prevención')),
  target text not null check (target in ('empresa','trabajador')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index document_templates_name_ci_key
  on public.document_templates (lower(name));

alter table public.document_templates enable row level security;

revoke all on table public.document_templates from anon, authenticated;
grant select, insert, update on table public.document_templates to authenticated;
grant select, insert, update, delete on table public.document_templates to service_role;

create policy document_templates_select_staff
on public.document_templates
for select
to authenticated
using ((select private.is_acredita_staff()));

create policy document_templates_insert_staff
on public.document_templates
for insert
to authenticated
with check ((select private.is_acredita_staff()));

create policy document_templates_update_staff
on public.document_templates
for update
to authenticated
using ((select private.is_acredita_staff()))
with check ((select private.is_acredita_staff()));

create or replace function private.touch_document_template_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function private.touch_document_template_updated_at() from public;

create trigger trg_document_templates_updated_at
before update on public.document_templates
for each row execute function private.touch_document_template_updated_at();

insert into public.document_templates (integration_key, name, category, target, is_active)
values
  ('liquidacion', 'Liquidación de sueldo (mes vigente)', 'Laboral', 'trabajador', true),
  ('f30', 'F30 SII (mes vigente)', 'Tributario', 'empresa', true),
  ('contrato', 'Contrato de Trabajo', 'Laboral', 'trabajador', true),
  ('mutual', 'Registro Mutual ACHS', 'Prevención', 'empresa', true),
  ('antecedentes', 'Certificado de Antecedentes', 'Laboral', 'trabajador', true),
  ('odi', 'ODI 2026', 'Prevención', 'trabajador', true)
on conflict (integration_key) do update set
  name = excluded.name,
  category = excluded.category,
  target = excluded.target,
  is_active = excluded.is_active,
  updated_at = now();
