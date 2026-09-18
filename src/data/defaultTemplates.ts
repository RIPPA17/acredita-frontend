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
  { id: 'liquidacion', nombre: 'Liquidación de sueldo (excepción justificada)', categoria: 'Laboral', frecuencia: 'Mensual', destino: 'trabajador', activo: false },
  { id: 'f30', nombre: 'F30-1 DT — Cumplimiento laboral y previsional (mes vigente)', categoria: 'Laboral', frecuencia: 'Mensual', destino: 'empresa', activo: true },
  { id: 'contrato', nombre: 'Contrato de Trabajo', categoria: 'Laboral', frecuencia: 'Por Proyecto', destino: 'trabajador', activo: true },
  { id: 'mutual', nombre: 'Acreditación organismo administrador Ley 16.744', categoria: 'Prevención', frecuencia: '1 año', destino: 'empresa', activo: true },
  { id: 'antecedentes', nombre: 'Certificado de Antecedentes (excepción justificada)', categoria: 'Laboral', frecuencia: 'Mensual', destino: 'trabajador', activo: false },
  { id: 'odi', nombre: 'ODI 2026', categoria: 'Prevención', frecuencia: 'Por Proyecto', destino: 'trabajador', activo: true },
];
