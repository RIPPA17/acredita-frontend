export type DefaultDocumentTemplate = {
  id: string;
  nombre: string;
  categoria: string;
  frecuencia: string;
  destino: 'empresa' | 'trabajador';
  activo: boolean;
};

/**
 * Plantillas mínimas de respaldo para construir checklists cuando todavía no
 * existe una plantilla hidratada desde Supabase. No contienen empresas,
 * personas, proyectos ni estados de negocio ficticios.
 */
export const DEFAULT_DOCUMENT_TEMPLATES: DefaultDocumentTemplate[] = [
  { id: 'liquidacion', nombre: 'Comprobante de Pago de Remuneraciones (Liquidación de Sueldo)', categoria: 'Laboral', frecuencia: 'Mensual', destino: 'trabajador', activo: false },
  { id: 'f30_1', nombre: 'Certificado de Cumplimiento de Obligaciones Laborales y Previsionales (F30-1)', categoria: 'Laboral', frecuencia: 'Mensual', destino: 'empresa', activo: true },
  { id: 'f30', nombre: 'Certificado de Antecedentes Laborales y Previsionales (F30)', categoria: 'Laboral', frecuencia: 'Por Proyecto', destino: 'empresa', activo: true },
  { id: 'contrato', nombre: 'Contrato Individual de Trabajo', categoria: 'Laboral', frecuencia: 'Por Proyecto', destino: 'trabajador', activo: true },
  { id: 'mutual', nombre: 'Certificado de adhesión o afiliación al organismo administrador de la Ley N° 16.744', categoria: 'Prevención', frecuencia: '1 año', destino: 'empresa', activo: true },
  { id: 'antecedentes', nombre: 'Certificado de Antecedentes para Fines Particulares', categoria: 'Laboral', frecuencia: 'Mensual', destino: 'trabajador', activo: false },
  { id: 'odi', nombre: 'Registro de Información de los Riesgos Laborales (ODI) — D.S. N° 44', categoria: 'Prevención', frecuencia: 'Por Proyecto', destino: 'trabajador', activo: true },
];
