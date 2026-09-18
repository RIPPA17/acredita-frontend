create table if not exists public.privacy_impact_assessments (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null unique references public.privacy_processing_activities(id) on delete cascade,
  assessment_key text not null unique,
  status text not null default 'screening'
    check (status in ('screening','draft','review','approved','not_required')),
  required_by_internal_decision boolean not null default false,
  systematic_evaluation boolean not null default false,
  large_scale boolean not null default false,
  public_area_monitoring boolean not null default false,
  sensitive_data_exception boolean not null default false,
  significant_automated_decision boolean not null default false,
  other_high_risk boolean not null default false,
  screening_reason text,
  processing_description text,
  necessity_proportionality text,
  risks text[] not null default '{}',
  mitigations text[] not null default '{}',
  residual_risk text,
  agency_consultation_recommended boolean not null default false,
  decision_notes text,
  created_by uuid references public.profiles(id) on delete set null,
  reviewed_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.privacy_impact_assessments enable row level security;

revoke all on table public.privacy_impact_assessments from anon, authenticated;
grant select, insert, update on table public.privacy_impact_assessments to authenticated;
grant all on table public.privacy_impact_assessments to service_role;

drop policy if exists privacy_impact_staff_select on public.privacy_impact_assessments;
create policy privacy_impact_staff_select on public.privacy_impact_assessments
for select to authenticated using ((select private.is_acredita_staff()));

drop policy if exists privacy_impact_staff_insert on public.privacy_impact_assessments;
create policy privacy_impact_staff_insert on public.privacy_impact_assessments
for insert to authenticated
with check ((select private.is_acredita_staff()) and created_by = (select auth.uid()));

drop policy if exists privacy_impact_staff_update on public.privacy_impact_assessments;
create policy privacy_impact_staff_update on public.privacy_impact_assessments
for update to authenticated
using ((select private.is_acredita_staff()))
with check ((select private.is_acredita_staff()));

create index if not exists privacy_impact_status_idx on public.privacy_impact_assessments(status);
create index if not exists privacy_impact_reviewed_by_idx on public.privacy_impact_assessments(reviewed_by);

update public.privacy_processing_activities
set role_assessment='controller',
    legal_basis='Evaluación preliminar: art. 13 letra d) para seguridad y administración de cuentas; art. 13 letra c) cuando el titular sea parte contractual. Requiere validación jurídica final.',
    notes=concat_ws(' ', nullif(notes,''), 'Acredita define directamente las finalidades de autenticación, seguridad de cuenta y administración de acceso; por ello se evalúa preliminarmente como responsable para este tratamiento.'),
    updated_at=now()
where activity_key='account_auth';

update public.privacy_processing_activities
set role_assessment='processor',
    legal_basis='La base de licitud corresponde primariamente al Mandante responsable según cada requisito. Evaluación preliminar: art. 13 letras b), c) o d) según obligación legal, relación contractual o interés legítimo aplicable. Acredita trata por encargo.',
    notes=concat_ws(' ', nullif(notes,''), 'Evaluación preliminar: Mandante responsable de la finalidad de acreditación; Acredita encargado cuando verifica conforme a instrucciones y requisitos definidos por el Mandante. Acredita sigue siendo responsable de sus tratamientos propios de cuenta, seguridad y defensa.'),
    updated_at=now()
where activity_key='contractor_accreditation';

update public.privacy_processing_activities
set role_assessment='processor',
    legal_basis='La base de licitud corresponde primariamente al Mandante responsable y debe documentarse por requisito. Evaluación preliminar: art. 13 letras b), c) o d), según corresponda. Evitar usar consentimiento como base por defecto en relaciones laborales.',
    notes=concat_ws(' ', nullif(notes,''), 'Evaluación preliminar: Mandante responsable de la finalidad y requisitos; Acredita encargado para recepción/verificación documental. Requiere cláusulas art. 15 bis y matriz requisito-base legal.'),
    updated_at=now()
where activity_key='worker_accreditation';

update public.privacy_processing_activities
set role_assessment='joint_or_mixed',
    legal_basis='Evaluación preliminar por operación: ejecución contractual, obligación legal y/o interés legítimo según módulo. Debe separarse la finalidad del Mandante de las finalidades propias de Acredita.',
    notes=concat_ws(' ', nullif(notes,''), 'Rol mixto: algunos tratamientos se realizan por encargo del Mandante y otros responden a finalidades propias de Acredita, como soporte, facturación, seguridad y defensa.'),
    updated_at=now()
where activity_key='operations_support';

update public.privacy_processing_activities
set role_assessment='controller',
    legal_basis='Evaluación preliminar: art. 13 letra b) para deberes legales de seguridad y acreditación de controles cuando sean aplicables, y letra d) para interés legítimo en seguridad, integridad, prevención de fraude y defensa.',
    notes=concat_ws(' ', nullif(notes,''), 'Acredita define esta finalidad de seguridad y trazabilidad, por lo que se evalúa preliminarmente como responsable.'),
    updated_at=now()
where activity_key='security_audit';

insert into public.privacy_impact_assessments (
  activity_id, assessment_key, status, required_by_internal_decision,
  significant_automated_decision, other_high_risk, screening_reason,
  processing_description, risks, mitigations, decision_notes
)
select id, 'eipd_worker_accreditation_v1', 'draft', true, true, true,
  'Decisión interna conservadora previa al go-live: la acreditación puede incidir en acceso a faena, trabajo, asignación o pago; además algunos requisitos pueden contener datos sensibles. Debe analizarse el grado real de automatización y las salvaguardas humanas.',
  'Recepción, almacenamiento, revisión humana de documentos, cálculo de estados de acreditación y propagación de bloqueos/alertas asociados a trabajadores.',
  array[
    'Bloqueo incorrecto por dato desactualizado, documento mal clasificado o error de revisión.',
    'Acceso excesivo a documentación de trabajadores.',
    'Tratamiento de datos sensibles no estrictamente necesarios.',
    'Uso del estado automatizado sin revisión humana suficiente para una decisión de alto impacto.',
    'Conservación documental superior a la necesaria.'
  ]::text[],
  array[
    'Revisión humana de cada documento y trazabilidad de aprobación/rechazo.',
    'RLS multi-tenant y Storage privado.',
    'Separación entre requisito, versión documental y estado global.',
    'Posibilidad operacional de corregir/re-subir documentación.',
    'Registro de auditoría y derechos de acceso/rectificación/oposición/bloqueo.',
    'Retención y eliminación sujetas a política aprobada y legal hold.'
  ]::text[],
  'No activar decisiones comerciales irreversibles basadas exclusivamente en el estado automático hasta cerrar la EIPD, contratos y mecanismo formal de revisión humana.'
from public.privacy_processing_activities where activity_key='worker_accreditation'
on conflict (activity_id) do nothing;

insert into public.privacy_impact_assessments (
  activity_id, assessment_key, status, required_by_internal_decision,
  significant_automated_decision, other_high_risk, screening_reason,
  processing_description, risks, mitigations, decision_notes
)
select id, 'eipd_contractor_accreditation_screening_v1', 'screening', false, false, true,
  'Screening previo al go-live por volumen potencial, documentos de representantes/personas naturales y efectos operacionales de la acreditación.',
  'Acreditación documental de empresas contratistas y propagación del estado de cumplimiento en proyectos.',
  array[
    'Exposición de datos personales contenidos en documentos societarios o laborales.',
    'Bloqueo operativo por requisito incorrecto o vencimiento mal parametrizado.'
  ]::text[],
  array['Revisión humana, RLS, Storage privado, trazabilidad y corrección documental.']::text[],
  'Determinar si el volumen y naturaleza real del primer cliente elevan este tratamiento a EIPD completa.'
from public.privacy_processing_activities where activity_key='contractor_accreditation'
on conflict (activity_id) do nothing;
