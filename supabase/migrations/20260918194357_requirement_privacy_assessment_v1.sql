create table if not exists public.requirement_privacy_assessments (
  id uuid primary key default gen_random_uuid(),
  requirement_id uuid not null unique references public.requirements(id) on delete cascade,
  status text not null default 'draft' check (status in ('draft','review','approved','rejected')),
  purpose text not null,
  legal_basis text not null default 'Pendiente de validación jurídica por el responsable antes de producción.',
  necessity_assessment text not null default 'Pendiente: justificar necesidad y proporcionalidad del requisito.',
  minimization_strategy text not null default 'pending'
    check (minimization_strategy in ('pending','full_document_justified','extract_fields','verification_only','no_collection')),
  minimization_notes text,
  sensitive_data_possible boolean,
  special_category_notes text,
  recipients text[] not null default '{}',
  decision_effects text[] not null default '{}',
  human_review_required boolean not null default true,
  human_override_available boolean not null default false,
  retention_rule_id uuid references public.privacy_retention_rules(id) on delete set null,
  mandante_instruction_reference text,
  reviewer_notes text,
  reviewed_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.requirement_privacy_assessments enable row level security;

revoke all on table public.requirement_privacy_assessments from anon, authenticated;
grant select, insert, update on table public.requirement_privacy_assessments to authenticated;
grant all on table public.requirement_privacy_assessments to service_role;

drop policy if exists requirement_privacy_select_manager on public.requirement_privacy_assessments;
create policy requirement_privacy_select_manager on public.requirement_privacy_assessments
for select to authenticated
using (
  exists (
    select 1 from public.requirements r
    where r.id = requirement_privacy_assessments.requirement_id
      and (select private.can_manage_project(r.project_id))
  )
);

drop policy if exists requirement_privacy_insert_manager on public.requirement_privacy_assessments;
create policy requirement_privacy_insert_manager on public.requirement_privacy_assessments
for insert to authenticated
with check (
  exists (
    select 1 from public.requirements r
    where r.id = requirement_privacy_assessments.requirement_id
      and (select private.can_manage_project(r.project_id))
  )
);

drop policy if exists requirement_privacy_update_manager on public.requirement_privacy_assessments;
create policy requirement_privacy_update_manager on public.requirement_privacy_assessments
for update to authenticated
using (
  exists (
    select 1 from public.requirements r
    where r.id = requirement_privacy_assessments.requirement_id
      and (select private.can_manage_project(r.project_id))
  )
)
with check (
  exists (
    select 1 from public.requirements r
    where r.id = requirement_privacy_assessments.requirement_id
      and (select private.can_manage_project(r.project_id))
  )
);

create index if not exists requirement_privacy_status_idx on public.requirement_privacy_assessments(status);
create index if not exists requirement_privacy_reviewed_by_idx on public.requirement_privacy_assessments(reviewed_by);
create index if not exists requirement_privacy_retention_rule_idx on public.requirement_privacy_assessments(retention_rule_id);

insert into public.requirement_privacy_assessments (
  requirement_id, purpose, legal_basis, necessity_assessment, minimization_strategy,
  sensitive_data_possible, special_category_notes, recipients, decision_effects,
  human_review_required, human_override_available, reviewer_notes
)
select
  r.id,
  'Verificar el requisito documental "' || r.name || '" definido por el Mandante para el proyecto.',
  'Pendiente de validación por el Mandante responsable y revisión jurídica antes de utilizar este requisito con datos reales.',
  'Pendiente: documentar por qué este requisito es necesario, si debe recopilarse el documento completo y si existe una alternativa menos intrusiva.',
  'pending',
  null,
  case
    when lower(r.name) like '%antecedent%' then 'Revisión reforzada requerida antes de producción por la naturaleza del documento. No presumir licitud ni necesidad.'
    when lower(r.name) like '%salud%' or lower(r.name) like '%médic%' or lower(r.name) like '%medic%' then 'Puede contener información especialmente protegida; revisión jurídica y minimización obligatorias antes de producción.'
    else null
  end,
  '{}'::text[],
  array_remove(array[
    case when r.criticality = 'bloquea_acceso' then 'acceso' end,
    case when r.criticality = 'bloquea_pago' then 'pago' end,
    case when r.blocks_work then 'trabajo' end,
    case when r.blocks_assignment then 'asignacion' end
  ], null),
  true,
  false,
  'Registro generado automáticamente como borrador. Debe completarse requisito por requisito antes del go-live.'
from public.requirements r
on conflict (requirement_id) do nothing;
