
-- Canonical document names based on current official Chilean terminology.

-- 1) Separate F30-1 from F30 in the reusable catalog.
update public.document_templates
set integration_key = 'f30_1',
    name = 'Certificado de Cumplimiento de Obligaciones Laborales y Previsionales (F30-1)',
    updated_at = now()
where integration_key = 'f30'
  and lower(name) like '%f30-1%';

update public.document_templates
set name = 'Certificado de Cumplimiento de Obligaciones Laborales y Previsionales (F30-1)',
    updated_at = now()
where integration_key = 'f30_1';

insert into public.document_templates (integration_key, name, category, target, is_active)
values (
  'f30',
  'Certificado de Antecedentes Laborales y Previsionales (F30)',
  'Laboral',
  'empresa',
  true
)
on conflict (integration_key) do update
set name = excluded.name,
    category = excluded.category,
    target = excluded.target,
    is_active = excluded.is_active,
    updated_at = now();

-- 2) Normalize the rest of the reusable catalog.
update public.document_templates
set name = 'Certificado de adhesión o afiliación al organismo administrador de la Ley N° 16.744',
    updated_at = now()
where integration_key = 'mutual';

update public.document_templates
set name = 'Contrato Individual de Trabajo',
    updated_at = now()
where integration_key = 'contrato';

update public.document_templates
set name = 'Registro de Información de los Riesgos Laborales (ODI) — D.S. N° 44',
    updated_at = now()
where integration_key = 'odi';

update public.document_templates
set name = 'Comprobante de Pago de Remuneraciones (Liquidación de Sueldo)',
    updated_at = now()
where integration_key = 'liquidacion';

update public.document_templates
set name = 'Certificado de Antecedentes para Fines Particulares',
    updated_at = now()
where integration_key = 'antecedentes';

-- 3) Normalize names of requirements already assigned to projects.
-- Do not change required/optional, criticality, frequency or validity here.
update public.requirements
set name = 'Certificado de Cumplimiento de Obligaciones Laborales y Previsionales (F30-1)',
    updated_at = now()
where lower(name) like '%f30-1%'
   or lower(name) like 'f30-1%';

update public.requirements
set name = 'Certificado de adhesión o afiliación al organismo administrador de la Ley N° 16.744',
    updated_at = now()
where lower(name) like '%organismo administrador%ley 16.744%'
   or lower(name) like '%mutual%';

update public.requirements
set name = 'Contrato Individual de Trabajo',
    updated_at = now()
where lower(name) = 'contrato de trabajo';

update public.requirements
set name = 'Registro de Información de los Riesgos Laborales (ODI) — D.S. N° 44',
    updated_at = now()
where lower(name) like 'odi%';

update public.requirements
set name = 'Comprobante de Pago de Remuneraciones (Liquidación de Sueldo)',
    updated_at = now()
where lower(name) like 'liquidación de sueldo%'
   or lower(name) like 'liquidacion de sueldo%';

update public.requirements
set name = 'Certificado de Antecedentes para Fines Particulares',
    updated_at = now()
where lower(name) = 'certificado de antecedentes';
