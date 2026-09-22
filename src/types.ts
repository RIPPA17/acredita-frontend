import React from 'react';

/**
 * Reusable utility types and shared constants
 */
export type NavItem = {
  id: string;
  label: string;
  icon: React.ElementType;
  badge?: string | number;
  badgeVariant?: 'danger' | 'warning';
};

export interface Mandante {
  id: string;
  nombre: string;
  rut: string;
  plan?: string; // No forma parte del alta MVP de un mandante — solo la usan pantallas de facturación existentes
  proyectos: string[]; // IDs de proyectos asociados
}

export interface Proyecto {
  id: string;
  nombre: string;
  mandanteId: string;
  estado: string; // e.g. "Activo"
  urgenciaBadge?: string; // "b-red" | "b-yellow" | "b-green"
  urgenciaLabel?: string; // e.g. "3 urgentes", "1 normal", "Al día"
  contratistas: string[]; // IDs de contratistas asociados, incluidos históricos visibles
  contratistasActivos?: string[]; // IDs con acreditación/relación activa en el proyecto
  contratistasHistoricos?: string[]; // IDs cuya relación con el proyecto terminó, conservados para trazabilidad
  ubicacion?: string;
  fechaInicio?: string;
  fechaTermino?: string;
  descripcion?: string;
  responsableNombre?: string;
  responsableEmail?: string;
  responsableTelefono?: string;
}

export type EstadoAsignacion = 'activa' | 'inactiva' | 'baja';
export type EstadoAcceso = 'habilitado' | 'pendiente' | 'bloqueado';

export interface AsignacionTrabajador {
  id: string;
  proyectoId: string;
  servicioId?: string;
  cargo?: string;
  categorias: string[];
  fechaIngreso?: string;
  fechaSalida?: string;
  estado: EstadoAsignacion;
  estadoAcceso: EstadoAcceso;
  tipoContrato?: TipoContratoLaboral;
  fechaInicioContrato?: string;
  fechaTerminoContrato?: string;
  obraFaenaContrato?: string;
  regimenEspecial?: RegimenEspecialLaboral;
  detalleRegimenEspecial?: string;
}

export type TipoContratoLaboral = 'indefinido' | 'plazo_fijo' | 'obra_faena';

export type RegimenEspecialLaboral =
  | 'servicios_transitorios'
  | 'aprendizaje'
  | 'agricola_temporada'
  | 'casa_particular'
  | 'gente_mar_portuario_buceo'
  | 'artes_espectaculos'
  | 'deportista_profesional'
  | 'tripulacion_aerea'
  | 'plataforma_digital_dependiente'
  | 'otro';

export interface Trabajador {
  id?: string;
  nombre: string;
  rut: string;
  estado: 'aprobado' | 'por_vencer' | 'rechazado' | 'pendiente';
  cargo?: string;
  faena?: string;
  tipoContrato?: TipoContratoLaboral;
  fechaInicioContrato?: string;
  fechaTerminoContrato?: string;
  obraFaenaContrato?: string;
  regimenEspecial?: RegimenEspecialLaboral;
  detalleRegimenEspecial?: string;
  cumplimiento?: number;
  detalle?: string;
  documentos?: Documento[];
  asignaciones?: AsignacionTrabajador[];
}

export interface HistorialVersionDocumento {
  version: number;
  estado: Documento['estado'];
  fecha: string;
  emitido?: string;
  vencimientoIso?: string;
  archivoReferencia?: string;
  motivoRechazo?: string;
  explicacionRechazo?: string;
  solucionRechazo?: string;
  verificador?: string;
}

export interface Documento {
  id: string; // e.g. "d1", "d2"
  nombre: string;
  categoria: 'Laboral' | 'Tributario' | 'Prevención';
  estado: 'aprobado' | 'por_vencer' | 'rechazado' | 'pendiente' | 'revision';
  vencimiento: string;
  vencimientoIso?: string;
  emitido?: string;
  subido?: string;
  motivo?: string;      // Explicación de rechazo (también usado como observacion)
  observacion?: string; // Alias o copia para compatibilidad con vistas contratista
  revisor?: string;
  fechaRevisado?: string;
  motivoRechazo?: string;
  explicacionRechazo?: string;
  solucionRechazo?: string;
  proyectoId?: string;  // Associated project context
  archivoReferencia?: string;
  version?: number;                          // Defaults to 1 when absent
  historial?: HistorialVersionDocumento[];    // Versiones anteriores (superadas por una nueva carga)
  versionEnTramite?: HistorialVersionDocumento; // Renovación/corrección más nueva sin reemplazar aún una versión aprobada vigente
  obligacionId?: string;
  periodoEtiqueta?: string;
  periodoInicio?: string;
  periodoFin?: string;
  fechaLimite?: string;
}

export interface Requisito {
  id: string; // e.g. `${proyectoId}_${plantillaId}`
  nombre: string;
  categoria: 'Laboral' | 'Tributario' | 'Prevención';
  destino: 'empresa' | 'trabajador';
  obligatorio: boolean;
  frecuencia: string;
  diasVigencia?: number;
  alertaDias: number;
  criticidad: 'bloquea_pago' | 'bloquea_acceso' | 'advertencia' | 'bloquea_ambas';
  proyectoId: string;
  activo?: boolean;
  descripcion?: string;
  checklistRevision?: string[];
  categoriasAplicables?: string[];
  bloqueaTrabajo?: boolean;
  bloqueaAsignacion?: boolean;
  servicioId?: string;
  diasPlazo?: number;
}

export interface ServicioContrato {
  id: string;
  proyectoId: string;
  contratistaId: string;
  nombre: string;
  codigo: string;
  categoria?: string;
  responsableContratista?: string;
  responsableMandante?: string;
  fechaInicio?: string;
  fechaTermino?: string;
  estado: 'borrador' | 'activo' | 'suspendido' | 'finalizado';
  activo: boolean;
}

export interface ObligacionDocumental {
  id: string;
  proyectoId: string;
  contratistaId: string;
  requisitoId: string;
  servicioId?: string;
  asignacionId?: string;
  trabajadorRut?: string;
  periodoInicio: string;
  periodoFin: string;
  fechaLimite: string;
  periodoEtiqueta: string;
  estado: 'pendiente' | 'revision' | 'aprobado' | 'rechazado' | 'vencido' | 'por_vencer' | 'no_aplica';
  versionActual?: number;
  activo: boolean;
}

export interface CierreDocumental {
  id: string;
  proyectoId: string;
  periodoInicio: string;
  periodoFin: string;
  estado: 'abierto' | 'en_revision' | 'cerrado' | 'reabierto';
  fechaCargaHasta?: string;
  fechaCierre?: string;
  snapshot?: Record<string, unknown>;
}

export interface Contratista {
  id: string;
  nombre: string;
  rut: string;
  proyectos: string[]; // IDs de proyectos asociados
  documentos: Documento[];
  trabajadores?: Trabajador[];
  isNew?: boolean;
  contratistaPadreId?: string; // Legado: no usar para decisiones por proyecto
  contratistaPadrePorProyecto?: Record<string, string>;
}

export interface PreferenciasNotificacionesContratista {
  documentoRechazado: boolean;
  documentoPorVencer: boolean;
  documentoActualizado: boolean;
  acreditacionAprobada: boolean;
  cambioEstadoTrabajador: boolean;
  estadoPago: boolean;
  soporteActualizado: boolean;
  correoHabilitado: boolean;
  correoSoloCriticas: boolean;
}

export interface Verificador {
  id: string;
  nombre: string;
  email: string;
  rol: 'verificador' | 'supervisor';
  estado: 'online' | 'offline';
  activo: boolean;
}

// Un documento "tomado" en la Cola de revisión: se identifica por la misma
// key estable que usa el resto del frontend (buildDocumentoQueueKey), nunca
// por nombre, para que sobreviva a reconstrucciones de la lista y a reloads.
export interface ClaimRevision {
  documentoKey: string;
  verificadorId: string;
  claimedAt: number;
}

// Registro mínimo de actividad operacional (no reemplaza a Auditoría, que
// sigue intacta): una fila por decisión de aprobar/rechazar, para que
// Verificadores pueda mostrar "Revisados hoy" sin parsear texto ni depender
// de nombres como identidad.
export interface ActividadVerificador {
  id: string;
  verificadorId: string;
  documentoKey: string;
  accion: 'aprobado' | 'rechazado';
  fecha: string;
}

// Catálogo reutilizable para configurar requisitos de proyecto — solo el
// nombre/categoría/destino sugerido. Vigencia, alertas, obligatoriedad y
// criticidad son atributos del requisito concreto (Proyecto → Requisitos),
// nunca de la plantilla base.
export interface PlantillaBase {
  id: string;
  nombre: string;
  categoria: 'Laboral' | 'Tributario' | 'Prevención';
  destino: 'empresa' | 'trabajador';
  activo: boolean;
}

export interface Invitacion {
  id: string;
  contratistaId: string;
  contratistaNombre: string;
  contratistaRut: string;
  proyectoId: string;
  proyectoNombre: string;
  mandanteId: string;
  mandanteNombre: string;
  estado: 'pendiente' | 'aceptada' | 'rechazada';
  mensaje?: string;
  email?: string;
  fecha: string;
  fechaCreacion?: string;
}
