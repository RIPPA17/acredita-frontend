
insert into public.privacy_retention_rules
(data_domain, description, trigger_event, retention_days, action_at_expiry, retention_basis, status, legal_validation_required)
values
('f30_1_compliance_evidence',
 'Certificados F30-1 o equivalente que acreditan cumplimiento laboral y previsional de contratistas.',
 'término de los servicios o cierre del proyecto, considerando el último período certificado',
 1825,
 'review',
 'Plazo preliminar de 5 años alineado con la prescripción de acciones de cobro de cotizaciones de seguridad social. Mantener legal hold si existe controversia. Requiere validación jurídica final.',
 'draft', true),
('safety_compliance_evidence',
 'Evidencia de cumplimiento preventivo: ODI y acreditación del organismo administrador de la Ley 16.744.',
 'término de la faena/proyecto o baja de la relación pertinente',
 1825,
 'review',
 'Plazo preliminar de 5 años por la relevancia probatoria en seguridad y salud laboral y ventanas legales asociadas a accidentes/enfermedades profesionales. Requiere validación jurídica final.',
 'draft', true),
('worker_relationship_verification',
 'Documento bruto usado únicamente para verificar relación laboral/asignación; conservar preferentemente sólo resultado y campos mínimos.',
 'verificación satisfactoria o término del proceso de corrección',
 30,
 'delete',
 'Minimización: el contrato completo puede contener remuneración y otros datos no necesarios para el Mandante. Conservar el binario sólo el tiempo operacional mínimo y mantener metadatos de verificación separados.',
 'draft', true),
('payroll_verification_exception',
 'Liquidación de remuneraciones sólo para excepción contractual/jurídica expresamente justificada.',
 'verificación satisfactoria o término del proceso de corrección',
 30,
 'delete',
 'Documento con información socioeconómica sensible. No usar como requisito estándar cuando el F30-1 permite acreditar cumplimiento. El plazo aplica sólo a una excepción aprobada.',
 'draft', true),
('criminal_background_exception',
 'Certificado de antecedentes penales únicamente para funciones donde sea indispensable para capacidad/idoneidad.',
 'verificación satisfactoria',
 30,
 'delete',
 'No usar como requisito general. La DT limita su exigencia a funciones donde sea absolutamente indispensable. El plazo aplica sólo a excepciones aprobadas.',
 'draft', true)
on conflict (data_domain) do update set
 description=excluded.description,
 trigger_event=excluded.trigger_event,
 retention_days=excluded.retention_days,
 action_at_expiry=excluded.action_at_expiry,
 retention_basis=excluded.retention_basis,
 updated_at=now();

update public.requirements
set name='F30-1 DT — Cumplimiento laboral y previsional (mes vigente)',
    category='Laboral',
    description='Certificado de Cumplimiento de Obligaciones Laborales y Previsionales emitido por la Dirección del Trabajo o medio idóneo conforme al art. 183-C del Código del Trabajo. Sustituye la referencia incorrecta a “F30 SII”.',
    updated_at=now()
where lower(name) like 'f30%';

update public.document_templates
set name='F30-1 DT — Cumplimiento laboral y previsional',
    category='Laboral',
    updated_at=now()
where lower(name) like 'f30%';

update public.requirements
set name='Acreditación organismo administrador Ley 16.744',
    category='Prevención',
    frequency='un_ano',
    validity_days=365,
    description='Acredita el organismo administrador del seguro de la Ley 16.744 (Mutualidad o ISL). Debe actualizarse si cambia durante la faena.',
    updated_at=now()
where lower(name) like '%mutual%';

update public.document_templates
set name='Acreditación organismo administrador Ley 16.744',
    category='Prevención',
    updated_at=now()
where lower(name) like '%mutual%';

update public.requirements
set is_required=false,
    criticality='advertencia',
    description='No usar como requisito general. Sólo procede cuando la ausencia de antecedentes penales sea absolutamente indispensable para la capacidad o idoneidad de la función concreta y exista evaluación jurídica específica.',
    updated_at=now()
where lower(name) like '%antecedent%';

update public.document_templates
set is_active=false, updated_at=now()
where lower(name) like '%antecedent%';

update public.requirements
set is_required=false,
    criticality='advertencia',
    description='No usar por defecto para acreditar cumplimiento laboral/previsional. Preferir F30-1. Sólo habilitar si existe una necesidad contractual o jurídica específica, documentada y proporcional.',
    updated_at=now()
where lower(name) like '%liquidaci%';

update public.document_templates
set is_active=false, updated_at=now()
where lower(name) like '%liquidaci%';

update public.requirements
set frequency='por_obra',
    validity_days=null,
    description='Verificación de existencia de relación laboral/asignación. En producción debe minimizarse el tratamiento: preferir verificación y extracción de campos esenciales en vez de conservar el contrato completo.',
    updated_at=now()
where lower(name) like '%contrato de trabajo%';

update public.requirements
set description='Evidencia de que la persona trabajadora recibió información de riesgos, medidas preventivas y procedimientos antes de iniciar labores, conforme al DS 44. Preferir registro estructurado de trabajador, fecha, versión y aceptación.',
    updated_at=now()
where lower(name) like 'odi%';

update public.requirement_privacy_assessments a
set
 status='review',
 purpose='Acreditar el monto y estado de cumplimiento de obligaciones laborales y previsionales del contratista para ejercer el derecho de información y gestionar estados de pago/responsabilidad en subcontratación.',
 legal_basis='Base preliminar: art. 13 letra d) de la Ley 19.628 reformada por Ley 21.719, interés legítimo del Mandante en ejercer el derecho de información y gestionar su exposición conforme a los arts. 183-C y 183-D del Código del Trabajo. Si una norma especial impone el tratamiento, aplicar art. 13 letra b).',
 necessity_assessment='Necesario y proporcionado cuando existe régimen de subcontratación. El F30-1 es un certificado específicamente diseñado para acreditar cumplimiento y resulta menos intrusivo que recopilar liquidaciones individuales.',
 minimization_strategy='full_document_justified',
 minimization_notes='Conservar el certificado F30-1 o equivalente, no antecedentes salariales individuales adicionales salvo excepción justificada.',
 sensitive_data_possible=false,
 special_category_notes=null,
 recipients=array['Mandante: administración/contratos autorizada','Acredita: verificador autorizado'],
 human_review_required=true,
 human_override_available=true,
 retention_rule_id=(select id from public.privacy_retention_rules where data_domain='f30_1_compliance_evidence'),
 reviewer_notes='Sustento: Código del Trabajo art. 183-C; Reglamento DS 319; DT identifica F30-1 como certificado de cumplimiento por obra/faena/servicio. Nombre operativo corregido desde “F30 SII”.',
 updated_at=now()
from public.requirements r
where r.id=a.requirement_id and lower(r.name) like 'f30-1 dt%';

update public.requirement_privacy_assessments a
set
 status='review',
 purpose='Acreditar que la persona trabajadora recibió antes de iniciar labores la información sobre riesgos, medidas preventivas y procedimientos de trabajo aplicables a la faena.',
 legal_basis='Art. 13 letra b) de la Ley 19.628 reformada: tratamiento necesario para cumplimiento de obligaciones legales de seguridad y salud. DS 44 art. 15; Código del Trabajo art. 183-E; Ley 16.744 art. 66 bis y DS 76 para vigilancia/coordinación de la empresa principal.',
 necessity_assessment='La evidencia de información de riesgos es necesaria para la gestión preventiva. No es necesario conservar un documento extenso si se puede acreditar trabajador, fecha, contenido/versión y aceptación.',
 minimization_strategy='extract_fields',
 minimization_notes='Objetivo de producto: conservar trabajador, fecha/hora, versión ODI, faena y aceptación; evitar datos ajenos a prevención.',
 sensitive_data_possible=false,
 special_category_notes=null,
 recipients=array['Mandante: prevención de riesgos autorizada','Acredita: verificador autorizado'],
 human_review_required=true,
 human_override_available=true,
 retention_rule_id=(select id from public.privacy_retention_rules where data_domain='safety_compliance_evidence'),
 reviewer_notes='Sustento principal: DS 44 art. 15, vigente desde 01-02-2025; deberes de empresa principal en art. 183-E CT, art. 66 bis Ley 16.744 y DS 76.',
 updated_at=now()
from public.requirements r
where r.id=a.requirement_id and lower(r.name) like 'odi%';

update public.requirement_privacy_assessments a
set
 status='review',
 purpose='Acreditar el organismo administrador de la Ley 16.744 al que se encuentra adherida/afiliada la empresa contratista durante la faena.',
 legal_basis='Art. 13 letra b) de la Ley 19.628 reformada: el DS 76 art. 5 exige a la empresa principal mantener en la faena un registro actualizado que incluya el organismo administrador de la Ley 16.744 de contratistas/subcontratistas.',
 necessity_assessment='Dato necesario para el registro y coordinación preventiva de la empresa principal. Basta acreditar organismo administrador y vigencia; no se requieren datos médicos de trabajadores.',
 minimization_strategy='full_document_justified',
 minimization_notes='Aceptar certificado empresarial o evidencia equivalente. No pedir antecedentes clínicos ni evaluaciones de salud para este requisito.',
 sensitive_data_possible=false,
 special_category_notes=null,
 recipients=array['Mandante: prevención/administración autorizada','Acredita: verificador autorizado'],
 human_review_required=true,
 human_override_available=true,
 retention_rule_id=(select id from public.privacy_retention_rules where data_domain='safety_compliance_evidence'),
 reviewer_notes='Sustento: DS 76 art. 5 letra c.1 y Ley 16.744. Se generaliza “ACHS” para admitir cualquier organismo administrador aplicable.',
 updated_at=now()
from public.requirements r
where r.id=a.requirement_id and lower(r.name) like 'acreditación organismo administrador%';

update public.requirement_privacy_assessments a
set
 status='review',
 purpose='Verificar que el trabajador mantiene una relación laboral con el contratista y corresponde a la asignación declarada para la obra/faena.',
 legal_basis='Base preliminar limitada: art. 13 letra d) de la Ley 19.628 reformada, interés legítimo del Mandante en verificar la relación/asignación y gestionar obligaciones de subcontratación. El art. 183-C no autoriza por sí solo a conservar el contrato completo.',
 necessity_assessment='Puede ser necesario verificar identidad, empleador, vigencia y cargo, pero normalmente no es necesario que el Mandante conserve el contrato completo ni datos de remuneración.',
 minimization_strategy='verification_only',
 minimization_notes='Objetivo: verificación temporal del documento y conservación posterior sólo del resultado y campos mínimos. La implementación productiva debe impedir retención indefinida del PDF.',
 sensitive_data_possible=true,
 special_category_notes='El contrato puede revelar remuneración y, por tanto, situación socioeconómica, categoría sensible bajo la Ley 21.719.',
 recipients=array['Acredita: verificador autorizado','Mandante: sólo estado y campos mínimos necesarios'],
 human_review_required=true,
 human_override_available=true,
 retention_rule_id=(select id from public.privacy_retention_rules where data_domain='worker_relationship_verification'),
 reviewer_notes='No aprobar almacenamiento permanente del contrato completo. Antes de producción debe implementarse eliminación del binario o extracción de campos mínimos.',
 updated_at=now()
from public.requirements r
where r.id=a.requirement_id and lower(r.name) like '%contrato de trabajo%';

update public.requirement_privacy_assessments a
set
 status='rejected',
 purpose='No recopilar por defecto. Si existe una excepción, verificar cumplimiento remuneracional/previsional estrictamente necesario para una obligación contractual o legal específica.',
 legal_basis='No existe base genérica suficiente para conservar liquidaciones individuales cuando el F30-1 permite acreditar cumplimiento. Una excepción deberá justificar necesidad bajo art. 13 y, por contener situación socioeconómica, cumplir además art. 16, especialmente letra e) cuando corresponda al ámbito laboral/seguridad social.',
 necessity_assessment='No supera el test de minimización como requisito estándar: revela remuneración individual y existe un medio menos intrusivo, el F30-1. Requiere excepción documentada por proyecto.',
 minimization_strategy='no_collection',
 minimization_notes='Deshabilitado como plantilla estándar. Para excepción aprobada, preferir verificación temporal y eliminar binario en máximo 30 días.',
 sensitive_data_possible=true,
 special_category_notes='La remuneración permite conocer situación socioeconómica, expresamente incluida entre los datos sensibles por la Ley 21.719.',
 recipients='{}'::text[],
 decision_effects='{}'::text[],
 human_review_required=true,
 human_override_available=true,
 retention_rule_id=(select id from public.privacy_retention_rules where data_domain='payroll_verification_exception'),
 reviewer_notes='Requisito estándar rechazado por minimización. F30-1 es el medio preferente para art. 183-C. Puede existir excepción específica si el Mandante acredita necesidad y base jurídica.',
 updated_at=now()
from public.requirements r
where r.id=a.requirement_id and lower(r.name) like '%liquidaci%';

update public.requirement_privacy_assessments a
set
 status='rejected',
 purpose='No recopilar como requisito general. Evaluar únicamente para una función específica en que la ausencia de antecedentes penales sea absolutamente indispensable para capacidad o idoneidad.',
 legal_basis='No existe base genérica para exigirlo a todos los trabajadores. Cualquier excepción debe acreditar necesidad, proporcionalidad, relación directa con la función y una fuente de licitud aplicable bajo la Ley 19.628 reformada.',
 necessity_assessment='La Dirección del Trabajo sostiene que, por regla general, no corresponde exigir certificado de antecedentes; sólo se admite cuando sea absolutamente indispensable para la función concreta.',
 minimization_strategy='no_collection',
 minimization_notes='Deshabilitado como plantilla estándar. Si una función excepcional lo requiere, crear un requisito específico separado con evaluación jurídica propia y retención mínima.',
 sensitive_data_possible=true,
 special_category_notes='Información penal y de vida privada requiere protección reforzada; además existe riesgo de discriminación laboral.',
 recipients='{}'::text[],
 decision_effects='{}'::text[],
 human_review_required=true,
 human_override_available=true,
 retention_rule_id=(select id from public.privacy_retention_rules where data_domain='criminal_background_exception'),
 reviewer_notes='Requisito genérico rechazado conforme a doctrina vigente de la Dirección del Trabajo sobre no discriminación e idoneidad.',
 updated_at=now()
from public.requirements r
where r.id=a.requirement_id and lower(r.name) like '%antecedent%';

create or replace function private.ensure_requirement_privacy_assessment()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  insert into public.requirement_privacy_assessments (
    requirement_id, purpose, legal_basis, necessity_assessment, minimization_strategy,
    sensitive_data_possible, recipients, decision_effects, human_review_required,
    human_override_available, reviewer_notes
  )
  values (
    new.id,
    'Verificar el requisito documental "' || new.name || '" definido para el proyecto.',
    'Pendiente de validación jurídica por el responsable antes de producción.',
    'Pendiente: justificar necesidad, proporcionalidad y alternativa menos intrusiva.',
    'pending',
    null,
    '{}'::text[],
    array_remove(array[
      case when new.criticality in ('bloquea_acceso','bloquea_ambas') then 'acceso' end,
      case when new.criticality in ('bloquea_pago','bloquea_ambas') then 'pago' end,
      case when new.blocks_work then 'trabajo' end,
      case when new.blocks_assignment then 'asignacion' end
    ], null),
    true,
    false,
    'Creado automáticamente. El requisito no puede utilizarse con datos reales de producción hasta completar y aprobar esta evaluación.'
  )
  on conflict (requirement_id) do nothing;
  return new;
end;
$$;

revoke all on function private.ensure_requirement_privacy_assessment() from public, anon, authenticated;

drop trigger if exists trg_requirements_privacy_assessment on public.requirements;
create trigger trg_requirements_privacy_assessment
after insert on public.requirements
for each row execute function private.ensure_requirement_privacy_assessment();

create or replace function private.assert_requirement_privacy_ready(p_requirement_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_environment text;
  v_status text;
  v_strategy text;
begin
  if p_requirement_id is null then return; end if;

  select p.data_environment, a.status, a.minimization_strategy
    into v_environment, v_status, v_strategy
  from public.requirements r
  join public.projects p on p.id=r.project_id
  left join public.requirement_privacy_assessments a on a.requirement_id=r.id
  where r.id=p_requirement_id;

  if v_environment='production' then
    if v_status is distinct from 'approved' then
      raise exception 'privacy_gate: requirement % is not approved for production data', p_requirement_id
        using errcode='42501';
    end if;
    if v_strategy in ('pending','no_collection') or v_strategy is null then
      raise exception 'privacy_gate: requirement % does not permit document collection', p_requirement_id
        using errcode='42501';
    end if;
  end if;
end;
$$;

revoke all on function private.assert_requirement_privacy_ready(uuid) from public, anon, authenticated;

create or replace function private.enforce_document_privacy_gate()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  perform private.assert_requirement_privacy_ready(new.requirement_id);
  return new;
end;
$$;

revoke all on function private.enforce_document_privacy_gate() from public, anon, authenticated;

drop trigger if exists trg_documents_privacy_gate on public.documents;
create trigger trg_documents_privacy_gate
before insert or update of requirement_id on public.documents
for each row execute function private.enforce_document_privacy_gate();

create or replace function private.enforce_document_version_privacy_gate()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_requirement_id uuid;
begin
  select d.requirement_id into v_requirement_id
  from public.documents d
  where d.id=new.document_id;

  perform private.assert_requirement_privacy_ready(v_requirement_id);
  return new;
end;
$$;

revoke all on function private.enforce_document_version_privacy_gate() from public, anon, authenticated;

drop trigger if exists trg_document_versions_privacy_gate on public.document_versions;
create trigger trg_document_versions_privacy_gate
before insert on public.document_versions
for each row execute function private.enforce_document_version_privacy_gate();
