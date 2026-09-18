
create table if not exists public.privacy_decision_reviews (
  id uuid primary key default gen_random_uuid(),
  accreditation_id uuid not null references public.accreditations(id) on delete cascade,
  worker_id uuid references public.workers(id) on delete cascade,
  decision_type text not null
    check (decision_type in ('accreditation','access','payment','work','assignment')),
  automated_state_snapshot text not null,
  explanation_snapshot jsonb not null default '{}'::jsonb,
  request_reason text not null,
  requester_viewpoint text,
  status text not null default 'requested'
    check (status in ('requested','in_review','upheld','overridden','closed')),
  override_value text,
  override_reason text,
  override_until timestamptz,
  requested_by uuid not null references public.profiles(id) on delete restrict,
  reviewed_by uuid references public.profiles(id) on delete set null,
  requested_at timestamptz not null default now(),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.privacy_decision_reviews enable row level security;

revoke all on table public.privacy_decision_reviews from anon, authenticated;
grant select, insert, update on table public.privacy_decision_reviews to authenticated;
grant all on table public.privacy_decision_reviews to service_role;

drop policy if exists privacy_decision_reviews_select_authorized on public.privacy_decision_reviews;
create policy privacy_decision_reviews_select_authorized
on public.privacy_decision_reviews for select to authenticated
using ((select private.can_access_accreditation(accreditation_id)));

drop policy if exists privacy_decision_reviews_insert_authorized on public.privacy_decision_reviews;
create policy privacy_decision_reviews_insert_authorized
on public.privacy_decision_reviews for insert to authenticated
with check (
  requested_by=(select auth.uid())
  and (select private.can_access_accreditation(accreditation_id))
  and (
    worker_id is null
    or (select private.worker_matches_accreditation(worker_id, accreditation_id))
  )
);

drop policy if exists privacy_decision_reviews_update_reviewer on public.privacy_decision_reviews;
create policy privacy_decision_reviews_update_reviewer
on public.privacy_decision_reviews for update to authenticated
using (
  (select private.is_acredita_staff())
  or exists (
    select 1
    from public.accreditations a
    where a.id=privacy_decision_reviews.accreditation_id
      and (select private.can_manage_project(a.project_id))
  )
)
with check (
  (select private.is_acredita_staff())
  or exists (
    select 1
    from public.accreditations a
    where a.id=privacy_decision_reviews.accreditation_id
      and (select private.can_manage_project(a.project_id))
  )
);

create index if not exists privacy_decision_reviews_accreditation_idx
on public.privacy_decision_reviews(accreditation_id);

create index if not exists privacy_decision_reviews_worker_idx
on public.privacy_decision_reviews(worker_id);

create index if not exists privacy_decision_reviews_status_idx
on public.privacy_decision_reviews(status);

create index if not exists privacy_decision_reviews_requested_by_idx
on public.privacy_decision_reviews(requested_by);

create index if not exists privacy_decision_reviews_reviewed_by_idx
on public.privacy_decision_reviews(reviewed_by);

drop trigger if exists privacy_decision_reviews_set_updated_at on public.privacy_decision_reviews;
create trigger privacy_decision_reviews_set_updated_at
before update on public.privacy_decision_reviews
for each row execute function private.set_updated_at();

update public.privacy_impact_assessments i
set
  status='review',
  systematic_evaluation=true,
  sensitive_data_exception=true,
  significant_automated_decision=true,
  other_high_risk=true,
  necessity_proportionality=
    'La finalidad legítima es verificar cumplimiento documental exigible para acceso, trabajo, asignación y pago en subcontratación. La evaluación concluye que no todo documento inicialmente configurado es necesario: F30-1 y evidencia preventiva se mantienen; liquidaciones y antecedentes penales salen del estándar; contratos se someten a verificación temporal/minimizada. Los estados automáticos sólo consolidan resultados previamente revisados y no deben operar como decisión humana final irreversible.',
  risks=array[
    'Bloqueo incorrecto de acceso, trabajo, asignación o pago por documento mal clasificado, vencimiento incorrecto o error de revisión.',
    'Conservación excesiva de contratos de trabajo u otros documentos que contengan información socioeconómica sensible.',
    'Exigencia discriminatoria o desproporcionada de antecedentes penales.',
    'Acceso de usuarios de un Mandante o contratista a documentación ajena a su proyecto o función.',
    'Uso del estado automatizado como decisión definitiva sin explicación, intervención humana o posibilidad de revisión.',
    'Retención superior a la necesaria o falta de eliminación del binario cuando la estrategia aprobada sea verificación temporal.',
    'Transferencias/subencargos no documentados contractualmente antes del tratamiento comercial.'
  ]::text[],
  mitigations=array[
    'Revisión humana obligatoria de documentos y trazabilidad de aprobación/rechazo/versiones.',
    'Matriz de privacidad individual por requisito y gate que impide recopilar documentos en proyectos productivos sin aprobación previa.',
    'F30 corregido a F30-1 DT y uso preferente frente a antecedentes salariales individuales.',
    'Liquidaciones de sueldo y certificados de antecedentes eliminados como plantillas estándar y clasificados no_collection.',
    'Contratos de trabajo clasificados verification_only con objetivo de conservar sólo resultado/campos mínimos.',
    'RLS multi-tenant y Storage privado ya auditados.',
    'Canal de corrección/re-subida documental.',
    'Registro formal privacy_decision_reviews para intervención humana, explicación, punto de vista del afectado y eventual override.',
    'Legal holds para suspender eliminación cuando exista controversia legítima.',
    'Borrado automático permanece desactivado hasta aprobar y probar las reglas de retención.'
  ]::text[],
  residual_risk=
    'Riesgo residual medio antes del go-live: falta cerrar retención definitiva, tratamiento efímero/extracción para verification_only, contrato responsable-encargado, subencargados/transferencias y prueba operativa del nuevo flujo de revisión humana. No usar documentación sensible real hasta cerrar esos puntos.',
  decision_notes=
    'EIPD avanzada a revisión. No se aprueba todavía. Para aprobación final se requiere: 1) prueba E2E de revisión/override humano; 2) implementación de minimización de binarios verification_only; 3) retención aprobada; 4) DPA Mandante-Acredita y subencargados; 5) inventario de transferencias.',
  updated_at=now()
from public.privacy_processing_activities p
where p.id=i.activity_id and p.activity_key='worker_accreditation';
