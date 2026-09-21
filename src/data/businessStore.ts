import { DEFAULT_DOCUMENT_TEMPLATES } from './defaultTemplates';
import { Contratista, Proyecto, Mandante, Documento, Trabajador, Requisito, HistorialVersionDocumento } from '../types';
import { backendAccreditationLabel, clearDerivedStateCache, getBackendAccreditationState, getBackendWorkerStateForProject } from './supabaseDerivedState';
import { getRuntimeArray, setRuntimeArray } from './businessRuntimeCache';
import { requestBusinessPersistence } from './supabasePersistence';
import { clearSupabaseSession, getStoredSupabaseSession, type SupabaseUserSession } from './supabaseAuth';
import { getAsignacionProyecto, getServiciosProyecto } from './operationalCore';
import { getActiveProjectDecisionOverride } from './supabaseDecisionReviews';
import {
  esDocumentoCumplido,
  esPorVencerPorFecha,
  esVencidoPorFecha,
  getBusinessToday,
  nombresDocumentoCoinciden,
  obtenerDiasRestantes,
  parseVencimientoDate,
} from '../domain/documentRules';

export {
  esDocumentoCumplido,
  esPorVencerPorFecha,
  esVencidoPorFecha,
  getBusinessToday,
  nombresDocumentoCoinciden,
  obtenerDiasRestantes,
  parseVencimientoDate,
} from '../domain/documentRules';

export const REGLAS_DEFAULT = [
  { id: 1, documento: "Certificado de Cumplimiento de Obligaciones Laborales y Previsionales (F30-1)", diasVigencia: 30, alertaDias: 7, criticidad: "bloquea_pago" },
  { id: 2, documento: "Registro de Información de los Riesgos Laborales (ODI) — D.S. N° 44", diasVigencia: null, alertaDias: 30, criticidad: "bloquea_acceso" },
  { id: 3, documento: "Certificado de adhesión o afiliación al organismo administrador de la Ley N° 16.744", diasVigencia: 365, alertaDias: 30, criticidad: "bloquea_acceso" }
];

// Datos de negocio: memoria efímera hidratada desde Supabase.

export function getContratistas(): Contratista[] {
  return getRuntimeArray<Contratista>('acredita_contratistas', []);
}

function snapshotContractorStates(contratistas: Contratista[]): Record<string, { acreditacion: string; accesoBloqueado: boolean; pagoBloqueado: boolean }> {
  const snapshot: Record<string, { acreditacion: string; accesoBloqueado: boolean; pagoBloqueado: boolean }> = {};
  if (!contratistas || !Array.isArray(contratistas)) return snapshot;
  contratistas.forEach(c => {
    const pIds = c.proyectos || [];
    pIds.forEach(pId => {
      const key = `${c.id}_${pId}`;
      const accessPago = calcularAccesoPago(c, pId);
      const acreditacion = calcularEstadoAcreditacion(c, pId);
      snapshot[key] = {
        acreditacion,
        accesoBloqueado: accessPago.accesoBloqueado,
        pagoBloqueado: accessPago.pagoBloqueado
      };
    });
  });
  return snapshot;
}

export function saveContratistas(data: Contratista[]) {
  setRuntimeArray('acredita_contratistas', data);
  requestBusinessPersistence('all');
}

export function getProyectos(): Proyecto[] {
  return getRuntimeArray<Proyecto>('acredita_proyectos', []);
}

export function saveProyectos(data: Proyecto[]) {
  setRuntimeArray('acredita_proyectos', data);
  requestBusinessPersistence('core');
}

export function getMandantes(): Mandante[] {
  return getRuntimeArray<Mandante>('acredita_mandantes', []);
}

export function saveMandantes(data: Mandante[]) {
  setRuntimeArray('acredita_mandantes', data);
  requestBusinessPersistence('core');
}

export function getPlantillas(): any[] {
  return getRuntimeArray<any>('acredita_plantillas', DEFAULT_DOCUMENT_TEMPLATES);
}

export function savePlantillas(data: any[]) {
  setRuntimeArray('acredita_plantillas', data);
}

export function getRequisitos(): Requisito[] {
  return getRuntimeArray<Requisito>('acredita_requisitos', []);
}

export function saveRequisitos(data: Requisito[]) {
  setRuntimeArray('acredita_requisitos', data);
  requestBusinessPersistence('core');
}

function getReglas(): any[] {
  return REGLAS_DEFAULT;
}

export function esRequisitoObligatorio(docNombre: string, proyectoId?: string): boolean {
  const reqs = getRequisitos();
  const rule = reqs.find(r => 
    (!proyectoId || r.proyectoId === proyectoId) && 
    nombresDocumentoCoinciden(docNombre, r.nombre)
  );
  if (!rule) return true;
  return rule.obligatorio;
}

export function esReglaBloqueante(docNombre: string, proyectoId?: string): boolean {
  const reqs = getRequisitos();
  const rule = reqs.find(r => 
    (!proyectoId || r.proyectoId === proyectoId) && 
    nombresDocumentoCoinciden(docNombre, r.nombre)
  );
  if (!rule) return false;
  return rule.criticidad === 'bloquea_acceso' || rule.criticidad === 'bloquea_pago' || rule.criticidad === 'bloquea_ambas';
}

export function requisitoAplicaATrabajador(req: Requisito, trabajador: Trabajador, proyectoId: string): boolean {
  const assignment = getAsignacionProyecto(trabajador, proyectoId);
  if (req.servicioId && req.servicioId !== assignment?.servicioId) return false;

  const requiredCategories = (req.categoriasAplicables || []).map(item => item.trim().toLocaleLowerCase('es')).filter(Boolean);
  if (requiredCategories.length === 0 || requiredCategories.includes('general')) return true;
  const workerCategories = (assignment?.categorias || []).map(item => item.trim().toLocaleLowerCase('es'));
  return requiredCategories.some(category => workerCategories.includes(category));
}

export function contratoTrabajadorVencido(w: Trabajador): boolean {
  return Boolean(w.fechaTerminoContrato && esVencidoPorFecha(w.fechaTerminoContrato));
}

export function getProblemasFichaTrabajador(w: Trabajador, proyectoId: string, contratistaId?: string): string[] {
  const problemas: string[] = [];
  const assignment = getAsignacionProyecto(w, proyectoId);
  const projectReqs = getRequisitos().filter(
    r => r.proyectoId === proyectoId && r.destino === 'trabajador' && r.activo !== false
  );

  if (!w.tipoContrato) problemas.push('tipo de contrato');
  if (!w.fechaInicioContrato) problemas.push('fecha de inicio del contrato');
  if (w.tipoContrato === 'plazo_fijo' && !w.fechaTerminoContrato) problemas.push('fecha de término del contrato');
  if (w.tipoContrato === 'obra_faena' && !w.obraFaenaContrato?.trim()) problemas.push('obra o faena determinada');
  if (w.regimenEspecial === 'otro' && !w.detalleRegimenEspecial?.trim()) problemas.push('detalle del régimen especial');
  if (!(assignment?.cargo || w.cargo || '').trim()) problemas.push('cargo');
  if (!assignment || (assignment.categorias || []).length === 0) problemas.push('categoría');

  const requiereServicio = projectReqs.some(r => Boolean(r.servicioId))
    || Boolean(contratistaId && getServiciosProyecto(proyectoId, contratistaId).length > 0);
  if (requiereServicio && !assignment?.servicioId) problemas.push('servicio o contrato');

  return Array.from(new Set(problemas));
}

export function calcularEstadoTrabajador(w: Trabajador, proyectoId: string): 'aprobado' | 'por_vencer' | 'rechazado' | 'pendiente' {
  const backendState = getBackendWorkerStateForProject(proyectoId, w.rut);
  if (backendState) {
    if (backendState.status === 'vencido_bloqueado') return 'rechazado';
    if (backendState.requiredCount === 0) return 'pendiente';
    if (backendState.status === 'aprobado') return backendState.nearExpiryCount > 0 ? 'por_vencer' : 'aprobado';
    return 'pendiente';
  }

  // En una sesión autenticada Supabase es la única fuente de verdad.
  // Si la vista derivada no está disponible, fallamos en modo conservador y nunca
  // reconstruimos un estado operacional alternativo en el navegador.
  if (getStoredSupabaseSession()) return 'pendiente';

  // Compatibilidad exclusiva para pruebas de dominio sin sesión autenticada.
  if (contratoTrabajadorVencido(w)) return 'rechazado';
  const problemasFicha = getProblemasFichaTrabajador(w, proyectoId);
  const configuredWorkerReqs = getRequisitos().filter(
    r => r.proyectoId === proyectoId && r.destino === 'trabajador' && r.activo !== false
  );
  if (configuredWorkerReqs.length === 0) return 'pendiente';

  const reqs = getRequisitos().filter(r => r.proyectoId === proyectoId && r.destino === 'trabajador' && r.activo !== false && requisitoAplicaATrabajador(r, w, proyectoId));
  const documentos = w.documentos || [];

  if (reqs.length === 0) return 'pendiente';

  let hasRechazado = false;
  let hasPendiente = false;
  let hasPorVencer = false;

  reqs.forEach(req => {
    const doc = documentos.find(d =>
      d.proyectoId === proyectoId &&
      nombresDocumentoCoinciden(d.nombre, req.nombre)
    );

    if (!doc) {
      if (req.obligatorio) hasPendiente = true;
      return;
    }

    const cumplido = esDocumentoCumplido(doc, req);
    if (!cumplido && req.obligatorio) {
      const isVencido = esVencidoPorFecha(doc.vencimiento);
      if (doc.estado === 'rechazado' || isVencido) hasRechazado = true;
      else hasPendiente = true;
    } else if (cumplido && req.obligatorio && (doc.estado === 'por_vencer' || esPorVencerPorFecha(doc.vencimiento, req.alertaDias))) {
      hasPorVencer = true;
    }
  });

  if (hasRechazado) return 'rechazado';
  if (problemasFicha.length > 0) return 'pendiente';
  if (hasPendiente) return 'pendiente';
  if (hasPorVencer) return 'por_vencer';
  return 'aprobado';
}
export function esTrabajadorAsignado(w: Trabajador, proyectoId: string, proyectos?: Proyecto[]): boolean {
  if (w.asignaciones !== undefined) return Boolean(getAsignacionProyecto(w, proyectoId));
  const hasDocs = w.documentos?.some(d => d.proyectoId === proyectoId);
  if (hasDocs) return true;

  const wFaena = (w.faena || '').toLowerCase().trim();
  if (!wFaena) return false;

  const projs = proyectos || getProyectos();
  const proyecto = projs.find(p => p.id === proyectoId);
  const projName = proyecto ? proyecto.nombre : '';
  const cleanProjName = projName ? projName.replace("Proyecto ", "").trim() : '';

  return (
    wFaena === proyectoId.toLowerCase().trim() ||
    (projName && wFaena === projName.toLowerCase().trim()) ||
    (cleanProjName && wFaena === cleanProjName.toLowerCase().trim())
  );
}

export function esTrabajadorAcreditado(w: Trabajador, proyectoId: string): boolean {
  const estado = calcularEstadoTrabajador(w, proyectoId);
  return estado === 'aprobado' || estado === 'por_vencer';
}

export function calcularEstadoAcreditacion(c: Contratista, proyectoId: string): 'No acreditado' | 'En proceso' | 'Aprobado' | 'Vencido/Bloqueado' {
  const backendState = getBackendAccreditationState(c.id, proyectoId);
  if (backendState) return backendAccreditationLabel(backendState);

  // En producción no existe un segundo motor de acreditación en el navegador.
  // Un estado backend ausente se trata como no resuelto y nunca como aprobado.
  if (getStoredSupabaseSession()) return 'En proceso';

  const proyectos = getProyectos();
  const projectWorkers = (c.trabajadores || []).filter(w => esTrabajadorAsignado(w, proyectoId, proyectos));
  const workerReqsConfigured = getRequisitos().filter(
    r => r.proyectoId === proyectoId && r.destino === 'trabajador' && r.activo !== false
  );
  if (projectWorkers.length > 0 && workerReqsConfigured.length === 0) return 'En proceso';
  const reqs = getRequisitos().filter(r => r.proyectoId === proyectoId && r.destino === 'empresa' && r.activo !== false);
  const documentos = c.documentos || [];
  const trabajadores = c.trabajadores || [];

  const tieneTrabajadorRechazado = trabajadores.some(w => 
    esTrabajadorAsignado(w, proyectoId, proyectos) && 
    calcularEstadoTrabajador(w, proyectoId) === 'rechazado'
  );

  let hasReRechazado = false;
  let hasRePendiente = false;

  reqs.forEach(req => {
    const doc = documentos.find(d => 
      d.proyectoId === proyectoId &&
      nombresDocumentoCoinciden(d.nombre, req.nombre)
    );
    if (!doc) {
      if (req.obligatorio) {
        hasRePendiente = true;
      }
      return;
    }

    const cumplido = esDocumentoCumplido(doc, req);
    if (!cumplido && req.obligatorio) {
      const isVencido = esVencidoPorFecha(doc.vencimiento);
      if (doc.estado === 'rechazado' || isVencido) {
        hasReRechazado = true;
      } else {
        hasRePendiente = true;
      }
    }
  });

  // Prioridad 1: Vencido/Bloqueado
  if (hasReRechazado || tieneTrabajadorRechazado) {
    return 'Vencido/Bloqueado';
  }

  const assignedWorkers = trabajadores.filter(w => 
    esTrabajadorAsignado(w, proyectoId, proyectos)
  );

  // Prioridad 2: toda aprobación obligatoria faltante o pendiente está En proceso.
  if (assignedWorkers.length === 0) {
    return 'En proceso';
  }

  // Si tiene trabajadores asignados, pero la empresa no ha subido NINGÚN documento obligatorio:
  const mandatoryCompanyReqs = reqs.filter(r => r.obligatorio);
  const uploadedCompanyMandatory = mandatoryCompanyReqs.filter(req => 
    documentos.some(d => 
      d.proyectoId === proyectoId &&
      nombresDocumentoCoinciden(d.nombre, req.nombre)
    )
  );
  const noneUploaded = mandatoryCompanyReqs.length > 0 && uploadedCompanyMandatory.length === 0;

  if (noneUploaded) {
    return 'En proceso';
  }

  const tieneTrabajadorPendiente = assignedWorkers.some(w => calcularEstadoTrabajador(w, proyectoId) === 'pendiente');

  if (hasRePendiente || tieneTrabajadorPendiente) {
    return 'En proceso';
  }

  return 'Aprobado';
}

export function calcularPrioridadDocumento(d: Documento, r?: any): 'Alta' | 'Normal' | 'Baja' {
  let rule = r;
  if (!rule) {
    const reqs = getRequisitos();
    rule = reqs.find(reg => 
      (!d.proyectoId || reg.proyectoId === d.proyectoId) && 
      nombresDocumentoCoinciden(d.nombre, reg.nombre)
    );
  }

  const criticidad = rule ? rule.criticidad : 'bloquea_acceso';
  const isVencido = esVencidoPorFecha(d.vencimiento);
  const isPorVencer = d.estado === 'por_vencer';

  let esAntiguo = false;
  if (d.subido && d.subido !== '—') {
    const parts = d.subido.trim().split(' ');
    if (parts.length >= 3) {
      const day = parseInt(parts[0]);
      const year = parseInt(parts[2]);
      const months: Record<string, number> = {
        'ene': 0, 'feb': 1, 'mar': 2, 'abr': 3, 'may': 4, 'jun': 5,
        'jul': 6, 'ago': 7, 'sep': 8, 'oct': 9, 'nov': 10, 'dic': 11
      };
      const monthStr = parts[1].substring(0, 3).toLowerCase();
      const month = months[monthStr] !== undefined ? months[monthStr] : 0;
      const uploadDate = new Date(year, month, day);
      const diffTime = Math.abs(getBusinessToday().getTime() - uploadDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      if (diffDays >= 3) {
        esAntiguo = true;
      }
    }
  }

  if (criticidad === 'bloquea_acceso' || isVencido || esAntiguo) {
    return 'Alta';
  }
  if (criticidad === 'bloquea_pago' || isPorVencer) {
    return 'Normal';
  }
  return 'Baja';
}

function estadoBloqueanteRequisito(req: Requisito, doc: Documento | undefined): 'Rechazado' | 'Vencido' | null {
  if (!req.obligatorio || !doc) return null;
  if (doc.estado === 'rechazado') return 'Rechazado';
  if (esVencidoPorFecha(doc.vencimiento)) return 'Vencido';
  return null;
}

type EstadoCompuerta = 'habilitado' | 'pendiente' | 'bloqueado';

function estadoRequisitoCompuerta(req: Requisito, doc: Documento | undefined): EstadoCompuerta | null {
  if (!req.obligatorio) return null;
  if (!doc) return 'pendiente';
  if (estadoBloqueanteRequisito(req, doc)) return 'bloqueado';
  if (doc.estado === 'aprobado' || doc.estado === 'por_vencer') return 'habilitado';
  return 'pendiente';
}

function requisitoAplicaACompuerta(req: Requisito, compuerta: 'acceso' | 'pago'): boolean {
  return req.criticidad === 'bloquea_ambas' || req.criticidad === `bloquea_${compuerta}`;
}

function buscarDocumentoRequisito(documentos: Documento[], req: Requisito, proyectoId: string): Documento | undefined {
  return documentos.find(doc => doc.proyectoId === proyectoId && nombresDocumentoCoinciden(doc.nombre, req.nombre));
}

export function calcularAccesoPago(c: Contratista, proyectoId: string): {
  accesoEstado: EstadoCompuerta;
  accesoBloqueado: boolean;
  accesoPendiente: boolean;
  motivoAcceso?: string;
  pagoEstado: EstadoCompuerta;
  pagoBloqueado: boolean;
  pagoPendiente: boolean;
  motivoPago?: string;
} {
  const accessOverride = getActiveProjectDecisionOverride(c.id, proyectoId, 'access');
  const paymentOverride = getActiveProjectDecisionOverride(c.id, proyectoId, 'payment');
  const backendState = getBackendAccreditationState(c.id, proyectoId);
  if (backendState) {
    const accesoBloqueado = backendState.accessBlockedCount > 0;
    const pagoBloqueado = backendState.paymentBlockedCount > 0;
    const accesoPendiente = backendState.accessPendingCount > 0;
    const pagoPendiente = backendState.paymentPendingCount > 0;
    return {
      accesoEstado: accessOverride ? 'habilitado' : backendState.accessAllowed ? 'habilitado' : accesoBloqueado ? 'bloqueado' : 'pendiente',
      accesoBloqueado: accessOverride ? false : accesoBloqueado,
      accesoPendiente: accessOverride ? false : accesoPendiente,
      motivoAcceso: accessOverride
        ? `Excepción humana vigente hasta ${new Date(accessOverride.overrideUntil).toLocaleString('es-CL')}: ${accessOverride.overrideReason}`
        : backendState.accessAllowed ? undefined : accesoBloqueado ? `${backendState.accessBlockedCount} obligación(es) de acceso rechazada(s) o vencida(s)` : `${backendState.accessPendingCount} obligación(es) de acceso pendiente(s)`,
      pagoEstado: paymentOverride ? 'habilitado' : backendState.paymentAllowed ? 'habilitado' : pagoBloqueado ? 'bloqueado' : 'pendiente',
      pagoBloqueado: paymentOverride ? false : pagoBloqueado,
      pagoPendiente: paymentOverride ? false : pagoPendiente,
      motivoPago: paymentOverride
        ? `Excepción humana vigente hasta ${new Date(paymentOverride.overrideUntil).toLocaleString('es-CL')}: ${paymentOverride.overrideReason}`
        : backendState.paymentAllowed ? undefined : pagoBloqueado ? `${backendState.paymentBlockedCount} obligación(es) de pago rechazada(s) o vencida(s)` : `${backendState.paymentPendingCount} obligación(es) de pago pendiente(s)`,
    };
  }
  if (getStoredSupabaseSession()) {
    return {
      accesoEstado: 'pendiente',
      accesoBloqueado: false,
      accesoPendiente: true,
      motivoAcceso: 'Estado operacional pendiente de sincronización con Supabase.',
      pagoEstado: 'pendiente',
      pagoBloqueado: false,
      pagoPendiente: true,
      motivoPago: 'Estado operacional pendiente de sincronización con Supabase.',
    };
  }

  // Compatibilidad exclusiva para pruebas de dominio sin sesión autenticada.
  const reqs = getRequisitos().filter(r => r.proyectoId === proyectoId && r.activo !== false);
  const documentos = c.documentos || [];
  const trabajadores = c.trabajadores || [];
  const proyectos = getProyectos();

  let accesoBloqueado = false;
  let pagoBloqueado = false;
  let accesoPendiente = false;
  let pagoPendiente = false;
  const motivosAcceso: string[] = [];
  const motivosPago: string[] = [];

  // 1. Evaluar requisitos de empresa
  reqs.filter(r => r.destino === 'empresa').forEach(req => {
    const doc = buscarDocumentoRequisito(documentos, req, proyectoId);
    const estadoBloqueante = estadoBloqueanteRequisito(req, doc);
    const estadoRequisito = estadoRequisitoCompuerta(req, doc);

    if (estadoBloqueante) {
      if (requisitoAplicaACompuerta(req, 'acceso')) {
        accesoBloqueado = true;
        motivosAcceso.push(`Requisito de empresa "${req.nombre}" ${estadoBloqueante}`);
      }
      if (requisitoAplicaACompuerta(req, 'pago')) {
        pagoBloqueado = true;
        motivosPago.push(`Requisito de empresa "${req.nombre}" ${estadoBloqueante}`);
      }
    } else if (estadoRequisito === 'pendiente') {
      const subMotivo = !doc ? 'no cargado' : doc.estado === 'revision' ? 'en revisión' : 'pendiente de aprobación';
      if (requisitoAplicaACompuerta(req, 'acceso')) {
        accesoPendiente = true;
        motivosAcceso.push(`Requisito de empresa "${req.nombre}" ${subMotivo}`);
      }
      if (requisitoAplicaACompuerta(req, 'pago')) {
        pagoPendiente = true;
        motivosPago.push(`Requisito de empresa "${req.nombre}" ${subMotivo}`);
      }
    }
  });

  // 2. Evaluar requisitos de trabajadores (solo para reporte de motivos del acceso, sin bloquear a la empresa)
  const projectWorkers = trabajadores.filter(w => 
    esTrabajadorAsignado(w, proyectoId, proyectos)
  );

  projectWorkers.forEach(w => {
    const wState = calcularEstadoTrabajador(w, proyectoId);
    if (wState === 'rechazado') {
      const wkReqs = reqs.filter(r => r.destino === 'trabajador' && requisitoAplicaATrabajador(r, w, proyectoId));
      wkReqs.forEach(req => {
        const doc = (w.documentos || []).find(d => 
          d.proyectoId === proyectoId &&
          nombresDocumentoCoinciden(d.nombre, req.nombre)
        );
        const estadoBloqueante = estadoBloqueanteRequisito(req, doc);
        if (estadoBloqueante) {
          motivosAcceso.push(`Trabajador "${w.nombre}" inhabilitado: Requisito "${req.nombre}" ${estadoBloqueante}`);
        }
      });
    }
  });

  return {
    accesoEstado: accessOverride ? 'habilitado' : accesoBloqueado ? 'bloqueado' : accesoPendiente ? 'pendiente' : 'habilitado',
    accesoBloqueado: accessOverride ? false : accesoBloqueado,
    accesoPendiente: accessOverride ? false : accesoPendiente,
    motivoAcceso: accessOverride
      ? `Excepción humana vigente hasta ${new Date(accessOverride.overrideUntil).toLocaleString('es-CL')}: ${accessOverride.overrideReason}`
      : motivosAcceso.length > 0 ? motivosAcceso.join('; ') : undefined,
    pagoEstado: paymentOverride ? 'habilitado' : pagoBloqueado ? 'bloqueado' : pagoPendiente ? 'pendiente' : 'habilitado',
    pagoBloqueado: paymentOverride ? false : pagoBloqueado,
    pagoPendiente: paymentOverride ? false : pagoPendiente,
    motivoPago: paymentOverride
      ? `Excepción humana vigente hasta ${new Date(paymentOverride.overrideUntil).toLocaleString('es-CL')}: ${paymentOverride.overrideReason}`
      : motivosPago.length > 0 ? motivosPago.join('; ') : undefined
  };
}

export interface HabilitacionResultado {
  estado: EstadoCompuerta;
  motivo?: string;
  responsable?: 'interno' | 'contratista';
  proximoVencimiento?: {
    documentoNombre: string;
    diasRestantes: number;
    fechaVencimiento: string;
  };
}

export function evaluarHabilitacionCompuerta(
  c: Contratista,
  proyectoId: string,
  compuerta: 'acceso' | 'pago'
): HabilitacionResultado {
  const override = getActiveProjectDecisionOverride(c.id, proyectoId, compuerta === 'acceso' ? 'access' : 'payment');
  if (override) {
    return {
      estado: 'habilitado',
      motivo: `Excepción humana vigente hasta ${new Date(override.overrideUntil).toLocaleString('es-CL')}: ${override.overrideReason}`,
      responsable: 'interno',
    };
  }
  const reqs = getRequisitos().filter(
    r => r.proyectoId === proyectoId && r.activo !== false
  );
  const documentos = c.documentos || [];
  const trabajadores = c.trabajadores || [];
  const proyectos = getProyectos();

  let estado: EstadoCompuerta = 'habilitado';
  const motivos: string[] = [];
  let responsable: 'interno' | 'contratista' | undefined = undefined;

  // Filter requirements matching the gate
  const gateReqs = reqs.filter(r => requisitoAplicaACompuerta(r, compuerta));

  // Evaluate company requirements
  gateReqs.filter(r => r.destino === 'empresa').forEach(req => {
    const doc = buscarDocumentoRequisito(documentos, req, proyectoId);
    const estadoBloqueante = estadoBloqueanteRequisito(req, doc);
    const estadoRequisito = estadoRequisitoCompuerta(req, doc);

    if (estadoBloqueante) {
      estado = 'bloqueado';
      motivos.push(`Requisito de empresa "${req.nombre}" ${estadoBloqueante.toLowerCase()}`);
      responsable = 'contratista';
    } else if (estadoRequisito === 'pendiente' && estado !== 'bloqueado') {
      estado = 'pendiente';
      const subMotivo = !doc ? 'no cargado' : doc.estado === 'revision' ? 'en revisión' : 'pendiente de aprobación';
      motivos.push(`Requisito de empresa "${req.nombre}" ${subMotivo}`);
      responsable = doc?.estado === 'revision' ? 'interno' : 'contratista';
    }
  });

  // For access, if there are workers, evaluate them for the motivo/responsibility, but DO NOT block the company!
  if (compuerta === 'acceso') {
    const projectWorkers = trabajadores.filter(w => 
      esTrabajadorAsignado(w, proyectoId, proyectos)
    );

    projectWorkers.forEach(w => {
      const wState = calcularEstadoTrabajador(w, proyectoId);
      if (wState === 'rechazado') {
        const wkReqs = reqs.filter(r => r.destino === 'trabajador' && requisitoAplicaATrabajador(r, w, proyectoId));
        wkReqs.forEach(req => {
          const doc = buscarDocumentoRequisito(w.documentos || [], req, proyectoId);
          const estadoBloqueante = estadoBloqueanteRequisito(req, doc);
          if (estadoBloqueante) {
            motivos.push(`Trabajador "${w.nombre}" inhabilitado: "${req.nombre}" ${estadoBloqueante.toLowerCase()}`);
            responsable = 'contratista';
          }
        });
      }
    });
  }

  // Find next expiration among APPROVED documents matching the gate's requirements
  let proximoVencimiento: HabilitacionResultado['proximoVencimiento'] = undefined;
  let minDias = Infinity;

  // Company docs
  documentos
    .filter(d => d.proyectoId === proyectoId && d.estado === 'aprobado')
    .forEach(d => {
      const req = gateReqs.find(r => 
        r.destino === 'empresa' &&
        nombresDocumentoCoinciden(d.nombre, r.nombre)
      );
      if (req) {
        const dias = obtenerDiasRestantes(d.vencimiento);
        if (dias < minDias) {
          minDias = dias;
          proximoVencimiento = {
            documentoNombre: d.nombre,
            diasRestantes: dias,
            fechaVencimiento: d.vencimiento
          };
        }
      }
    });

  // Workers docs (only for access gate)
  if (compuerta === 'acceso') {
    const projectWorkers = trabajadores.filter(w => 
      esTrabajadorAsignado(w, proyectoId, proyectos)
    );
    projectWorkers.forEach(w => {
      (w.documentos || [])
        .filter(d => d.proyectoId === proyectoId && d.estado === 'aprobado')
        .forEach(d => {
          const req = gateReqs.find(r => 
            r.destino === 'trabajador' &&
            nombresDocumentoCoinciden(d.nombre, r.nombre)
          );
          if (req) {
            const dias = obtenerDiasRestantes(d.vencimiento);
            if (dias < minDias) {
              minDias = dias;
              proximoVencimiento = {
                documentoNombre: `${w.nombre}: ${d.nombre}`,
                diasRestantes: dias,
                fechaVencimiento: d.vencimiento
              };
            }
          }
        });
    });
  }

  return {
    estado,
    motivo: motivos.length > 0 ? motivos.join('; ') : undefined,
    responsable,
    proximoVencimiento
  };
}

export interface AlertaVigencia {
  id: string;
  documentoId: string;
  documentoNombre: string;
  empresaId: string;
  empresaNombre: string;
  trabajadorRut?: string;
  trabajadorNombre?: string;
  proyectoId: string;
  proyectoNombre: string;
  vencimiento: string;
  diasRestantes: number;
  criticidad: 'Crítica' | 'Atención' | 'Informativa';
  bloquea: boolean;
}

export function getAlertasVigencia(proyectoId?: string): AlertaVigencia[] {
  const contratistas = getContratistas();
  const proyectos = getProyectos();
  const requisitos = getRequisitos().filter(r => r.activo !== false);
  const alertas: AlertaVigencia[] = [];

  contratistas.forEach(c => {
    const cProjs = c.proyectos || [];
    cProjs.forEach(pId => {
      if (proyectoId && pId !== proyectoId) return;
      const proj = proyectos.find(p => p.id === pId);
      const projNombre = proj ? proj.nombre : pId;

      const companyDocs = c.documentos || [];
      const companyReqs = requisitos.filter(r => r.proyectoId === pId && r.destino === 'empresa');

      companyReqs.forEach(req => {
        const doc = buscarDocumentoRequisito(companyDocs, req, pId);
        if (!doc) return;

        const isVencido = esVencidoPorFecha(doc.vencimiento);
        const diasRestantes = obtenerDiasRestantes(doc.vencimiento);
        const isPorVencer = esPorVencerPorFecha(doc.vencimiento, req.alertaDias);

        if (isVencido || isPorVencer) {
          let criticidad: 'Crítica' | 'Atención' | 'Informativa' = 'Informativa';
          let bloquea = false;

          if (isVencido) {
            if (req.obligatorio) {
              criticidad = 'Crítica';
              bloquea = true;
            } else {
              criticidad = 'Informativa';
              bloquea = false;
            }
          } else if (isPorVencer) {
            if (req.obligatorio) {
              criticidad = 'Atención';
              bloquea = false;
            } else {
              criticidad = 'Informativa';
              bloquea = false;
            }
          }

          alertas.push({
            id: `alert_e_${c.id}_${doc.id}`,
            documentoId: doc.id,
            documentoNombre: doc.nombre,
            empresaId: c.id,
            empresaNombre: c.nombre,
            proyectoId: pId,
            proyectoNombre: projNombre,
            vencimiento: doc.vencimiento,
            diasRestantes,
            criticidad,
            bloquea
          });
        }
      });

      const workers = c.trabajadores || [];
      const workerReqs = requisitos.filter(r => r.proyectoId === pId && r.destino === 'trabajador');

      workers.forEach(w => {
        const hasProjDocs = w.documentos?.some(d => d.proyectoId === pId);
        if (!hasProjDocs) return;

        workerReqs.forEach(req => {
          const doc = buscarDocumentoRequisito(w.documentos || [], req, pId);
          if (!doc) return;

          const isVencido = esVencidoPorFecha(doc.vencimiento);
          const diasRestantes = obtenerDiasRestantes(doc.vencimiento);
          const isPorVencer = esPorVencerPorFecha(doc.vencimiento, req.alertaDias);

          if (isVencido || isPorVencer) {
            let criticidad: 'Crítica' | 'Atención' | 'Informativa' = 'Informativa';
            let bloquea = false;

            if (isVencido) {
              if (req.obligatorio) {
                criticidad = 'Crítica';
                bloquea = true;
              } else {
                criticidad = 'Informativa';
                bloquea = false;
              }
            } else if (isPorVencer) {
              if (req.obligatorio) {
                criticidad = 'Atención';
                bloquea = false;
              } else {
                criticidad = 'Informativa';
                bloquea = false;
              }
            }

            alertas.push({
              id: `alert_w_${c.id}_${w.rut.replace(/[^a-zA-Z0-9]/g, '')}_${doc.id}`,
              documentoId: doc.id,
              documentoNombre: doc.nombre,
              empresaId: c.id,
              empresaNombre: c.nombre,
              trabajadorRut: w.rut,
              trabajadorNombre: w.nombre,
              proyectoId: pId,
              proyectoNombre: projNombre,
              vencimiento: doc.vencimiento,
              diasRestantes,
              criticidad,
              bloquea
            });
          }
        });
      });
    });
  });

  return alertas;
}

export function getMotivoBloqueoTrabajador(w: Trabajador, proyectoId: string): string {
  if (contratoTrabajadorVencido(w)) return `Contrato laboral vencido el ${w.fechaTerminoContrato}`;

  const reqs = getRequisitos().filter(r => r.proyectoId === proyectoId && r.destino === 'trabajador' && r.activo !== false && requisitoAplicaATrabajador(r, w, proyectoId));
  const docs = w.documentos || [];
  let bloqueo = '';
  let pendiente = '';

  reqs.forEach(req => {
    const doc = buscarDocumentoRequisito(docs, req, proyectoId);
    if (!req.obligatorio) return;
    if (!doc) {
      pendiente ||= `${req.nombre} pendiente`;
      return;
    }
    const isVencido = esVencidoPorFecha(doc.vencimiento);
    if (doc.estado === 'rechazado') bloqueo ||= `${req.nombre} rechazado`;
    else if (isVencido) bloqueo ||= `${req.nombre} vencido`;
    else if (doc.estado === 'pendiente' || doc.estado === 'revision') pendiente ||= `${req.nombre} pendiente`;
  });

  if (bloqueo) return bloqueo;
  const problemasFicha = getProblemasFichaTrabajador(w, proyectoId);
  if (problemasFicha.length > 0) return `Ficha laboral incompleta: ${problemasFicha.join(', ')}`;
  return pendiente || 'Requisitos en proceso';
}

export type UserSession = SupabaseUserSession;

export function getCurrentSession(): UserSession | null {
  return getStoredSupabaseSession();
}

export function logoutUser(): void {
  clearDerivedStateCache();
  clearSupabaseSession();
}

export function vigenciaRequeridaLabel(nombreDoc: string, requisitoFrecuencia?: string): string {
  const reglas = getReglas();
  const regla = reglas.find(r =>
    nombreDoc.toLowerCase().includes(String(r.documento).toLowerCase()) ||
    String(r.documento).toLowerCase().includes(nombreDoc.toLowerCase())
  );
  if (regla) {
    const dias = regla.diasVigencia;
    if (dias === 30) return '30 días';
    if (dias === 180) return '6 meses';
    if (dias === 365) return '1 año';
    return `${dias} días`;
  }
  if (requisitoFrecuencia === 'Mensual') return 'Mensual';
  if (requisitoFrecuencia === 'Indefinido') return 'Sin vencimiento';
  if (requisitoFrecuencia === 'Por Proyecto') return 'Durante todo el proyecto';
  return 'Sin vencimiento';
}

/** Estado visual simple de un vencimiento, para el badge de la Cola de revisión. */
export function estadoVencimiento(vencimiento: string | undefined): 'vigente' | 'proximo' | 'vencido' | 'sin_vencimiento' {
  if (!vencimiento || vencimiento === '—') return 'sin_vencimiento';
  const dias = obtenerDiasRestantes(vencimiento);
  if (dias === 99999) return 'sin_vencimiento';
  if (dias < 0) return 'vencido';
  if (dias <= 30) return 'proximo';
  return 'vigente';
}

/**
 * Pushes a handful of existing (already-approved) documents back into
 * "revision" so the reviewer has real, varied examples to look at in Cola de
 * revisión — one of each document family (liquidación, certificado,
 * tributario, contrato) — after they've cleared the queue. No new mock
 * companies or documents are invented; this only flips the estado on real
 * records that are already part of the seeded data.
 */
