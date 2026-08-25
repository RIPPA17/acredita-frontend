import { PLANTILLA_DOCUMENTOS } from './mockData';
import { Contratista, Proyecto, Mandante, Documento, Trabajador, Requisito, HistorialVersionDocumento, PreferenciasNotificacionesContratista } from '../types';
import { backendAccreditationLabel, clearDerivedStateCache, getBackendAccreditationState, getBackendWorkerStateForProject } from './supabaseDerivedState';
import { getRuntimeArray, setRuntimeArray } from './runtimeDataStore';
import { requestBusinessPersistence } from './supabasePersistence';
import { clearSupabaseSession, getStoredSupabaseSession, type SupabaseUserSession } from './supabaseAuth';

export const REGLAS_DEFAULT = [
  { id: 1, documento: "Liquidación de Sueldo", diasVigencia: 30, alertaDias: 5, criticidad: "bloquea_pago" },
  { id: 2, documento: "F30 / F31 SII", diasVigencia: 30, alertaDias: 7, criticidad: "bloquea_pago" },
  { id: 3, documento: "Certificado ODI", diasVigencia: 365, alertaDias: 30, criticidad: "bloquea_acceso" },
  { id: 4, documento: "Certificado Antecedentes", diasVigencia: 180, alertaDias: 15, criticidad: "advertencia" }
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
  return getRuntimeArray<any>('acredita_plantillas', PLANTILLA_DOCUMENTOS);
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

const DEFAULT_PREFERENCIAS_NOTIFICACIONES_CONTRATISTA: PreferenciasNotificacionesContratista = {
  documentoRechazado: true,
  documentoPorVencer: true,
  acreditacionAprobada: true,
  cambioEstadoTrabajador: false,
};

const PREFERENCIAS_CONTRATISTA_KEY = 'acredita_preferencias_notificaciones_contratista';

function safeParseStorageValue<T>(key: string, fallback: T, isValid: (value: unknown) => boolean): T {
  if (typeof window === 'undefined') return fallback;
  const raw = localStorage.getItem(key);
  if (raw === null) return fallback;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (isValid(parsed)) return parsed as T;
  } catch {
    // Se conserva el valor para permitir recuperación manual.
  }
  console.warn(`[Acredita] Se ignoró contenido inválido en localStorage: ${key}`);
  return fallback;
}

function safeParseStorageArray<T>(key: string, fallback: T[]): T[] {
  return safeParseStorageValue<T[]>(key, fallback, Array.isArray);
}

function safeParseStorageObject<T extends object>(key: string, fallback: T): T {
  return safeParseStorageValue<T>(key, fallback, value =>
    typeof value === 'object' && value !== null && !Array.isArray(value)
  );
}

export function getPreferenciasNotificacionesContratista(contratistaId: string): PreferenciasNotificacionesContratista {
  if (typeof window === 'undefined') return { ...DEFAULT_PREFERENCIAS_NOTIFICACIONES_CONTRATISTA };
  try {
    const todas = safeParseStorageObject<Record<string, Partial<PreferenciasNotificacionesContratista>>>(PREFERENCIAS_CONTRATISTA_KEY, {});
    return { ...DEFAULT_PREFERENCIAS_NOTIFICACIONES_CONTRATISTA, ...(todas[contratistaId] || {}) };
  } catch {
    return { ...DEFAULT_PREFERENCIAS_NOTIFICACIONES_CONTRATISTA };
  }
}

export function savePreferenciasNotificacionesContratista(
  contratistaId: string,
  preferencias: PreferenciasNotificacionesContratista,
): void {
  if (typeof window === 'undefined') return;
  let todas: Record<string, PreferenciasNotificacionesContratista> = {};
  try {
    todas = JSON.parse(localStorage.getItem(PREFERENCIAS_CONTRATISTA_KEY) || '{}');
  } catch {
    todas = {};
  }
  todas[contratistaId] = preferencias;
  localStorage.setItem(PREFERENCIAS_CONTRATISTA_KEY, JSON.stringify(todas));
}

export function getBusinessToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function createCalendarDate(year: number, month: number, day: number): Date | null {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
  const date = new Date(year, month, day);
  return date.getFullYear() === year && date.getMonth() === month && date.getDate() === day ? date : null;
}

export function parseVencimientoDate(vencimientoStr: string): Date | null {
  if (!vencimientoStr || vencimientoStr === '—') return null;
  if (vencimientoStr.includes('-')) {
    const parts = vencimientoStr.split('-');
    if (parts.length === 3) {
      // YYYY-MM-DD
      if (parts[0].length === 4) {
        const year = parseInt(parts[0]);
        const month = parseInt(parts[1]) - 1;
        const day = parseInt(parts[2]);
        return createCalendarDate(year, month, day);
      }
      // DD-MM-YYYY
      else {
        const day = parseInt(parts[0]);
        const month = parseInt(parts[1]) - 1;
        const year = parseInt(parts[2]);
        return createCalendarDate(year, month, day);
      }
    }
  }
  if (vencimientoStr.includes('/')) {
    const parts = vencimientoStr.split('/');
    if (parts.length === 3) {
      // YYYY/MM/DD
      if (parts[0].length === 4) {
        const year = parseInt(parts[0]);
        const month = parseInt(parts[1]) - 1;
        const day = parseInt(parts[2]);
        return createCalendarDate(year, month, day);
      }
      // DD/MM/YYYY
      else {
        const day = parseInt(parts[0]);
        const month = parseInt(parts[1]) - 1;
        const year = parseInt(parts[2]);
        return createCalendarDate(year, month, day);
      }
    }
  }
  const parts = vencimientoStr.trim().split(/\s+/);
  if (parts.length < 3) return null;
  const day = parseInt(parts[0]);
  const year = parseInt(parts[2]);
  const months: Record<string, number> = {
    'ene': 0, 'feb': 1, 'mar': 2, 'abr': 3, 'may': 4, 'jun': 5,
    'jul': 6, 'ago': 7, 'sep': 8, 'oct': 9, 'nov': 10, 'dic': 11
  };
  const monthStr = parts[1].substring(0, 3).toLowerCase();
  const month = months[monthStr];
  if (month === undefined) return null;
  return createCalendarDate(year, month, day);
}

export function esVencidoPorFecha(vencimientoStr: string): boolean {
  const vDate = parseVencimientoDate(vencimientoStr);
  if (!vDate) return false;
  return vDate < getBusinessToday();
}

export function obtenerDiasRestantes(vencimientoStr: string): number {
  const vDate = parseVencimientoDate(vencimientoStr);
  if (!vDate) return 99999;
  const diffTime = vDate.getTime() - getBusinessToday().getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}

export function esPorVencerPorFecha(vencimientoStr: string, alertaDias: number): boolean {
  const diasRestantes = obtenerDiasRestantes(vencimientoStr);
  return diasRestantes >= 0 && diasRestantes <= alertaDias;
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

export function nombresDocumentoCoinciden(a: string, b: string): boolean {
  const normalizar = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase().replace(/\s+/g, ' ');
  return normalizar(a) === normalizar(b);
}

export function esDocumentoCumplido(doc: Documento | undefined, req: Requisito): boolean {
  if (!doc) return false;
  
  if (!nombresDocumentoCoinciden(doc.nombre, req.nombre)) return false;
  
  if (doc.proyectoId !== req.proyectoId) return false;

  const isApproved = doc.estado === 'aprobado' || doc.estado === 'por_vencer';
  if (!isApproved) return false;

  const isVencido = esVencidoPorFecha(doc.vencimiento);
  if (isVencido) return false;

  return true;
}

export function calcularEstadoTrabajador(w: Trabajador, proyectoId: string): 'aprobado' | 'por_vencer' | 'rechazado' | 'pendiente' {
  const backendState = getBackendWorkerStateForProject(proyectoId, w.rut);
  if (backendState) {
    if (backendState.status === 'aprobado') return backendState.nearExpiryCount > 0 ? 'por_vencer' : 'aprobado';
    if (backendState.status === 'vencido_bloqueado') return 'rechazado';
    return 'pendiente';
  }
  const reqs = getRequisitos().filter(r => r.proyectoId === proyectoId && r.destino === 'trabajador' && r.activo !== false);
  const documentos = w.documentos || [];

  if (reqs.length === 0) return 'aprobado';

  let hasRechazado = false;
  let hasPendiente = false;
  let hasPorVencer = false;

  reqs.forEach(req => {
    const doc = documentos.find(d => 
      d.proyectoId === proyectoId &&
      nombresDocumentoCoinciden(d.nombre, req.nombre)
    );

    if (!doc) {
      if (req.obligatorio) {
        hasPendiente = true;
      }
      return;
    }

    const cumplido = esDocumentoCumplido(doc, req);
    if (!cumplido && req.obligatorio) {
      const isVencido = esVencidoPorFecha(doc.vencimiento);
      if (doc.estado === 'rechazado' || isVencido) {
        hasRechazado = true;
      } else {
        hasPendiente = true;
      }
    } else if (cumplido && req.obligatorio && (doc.estado === 'por_vencer' || esPorVencerPorFecha(doc.vencimiento, req.alertaDias))) {
      hasPorVencer = true;
    }
  });

  if (hasRechazado) return 'rechazado';
  if (hasPendiente) return 'pendiente';
  if (hasPorVencer) return 'por_vencer';
  return 'aprobado';
}

export function esTrabajadorAsignado(w: Trabajador, proyectoId: string, proyectos?: Proyecto[]): boolean {
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
  const reqs = getRequisitos().filter(r => r.proyectoId === proyectoId && r.destino === 'empresa' && r.activo !== false);
  const documentos = c.documentos || [];
  const trabajadores = c.trabajadores || [];
  const proyectos = getProyectos();

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

  const projectWorkers = trabajadores.filter(w => 
    esTrabajadorAsignado(w, proyectoId, proyectos)
  );

  // Prioridad 2: toda aprobación obligatoria faltante o pendiente está En proceso.
  if (projectWorkers.length === 0) {
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

  const tieneTrabajadorPendiente = projectWorkers.some(w => calcularEstadoTrabajador(w, proyectoId) === 'pendiente');

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
  const backendState = getBackendAccreditationState(c.id, proyectoId);
  if (backendState) {
    const bloqueado = backendState.status === 'vencido_bloqueado';
    const accesoPendiente = !backendState.accessAllowed && !bloqueado;
    const pagoPendiente = !backendState.paymentAllowed && !bloqueado;
    const motivo = bloqueado
      ? 'Acreditación vencida o bloqueada según el estado oficial de Supabase'
      : 'La acreditación todavía no está aprobada según el estado oficial de Supabase';
    return {
      accesoEstado: backendState.accessAllowed ? 'habilitado' : bloqueado ? 'bloqueado' : 'pendiente',
      accesoBloqueado: bloqueado,
      accesoPendiente,
      motivoAcceso: backendState.accessAllowed ? undefined : motivo,
      pagoEstado: backendState.paymentAllowed ? 'habilitado' : bloqueado ? 'bloqueado' : 'pendiente',
      pagoBloqueado: bloqueado,
      pagoPendiente,
      motivoPago: backendState.paymentAllowed ? undefined : motivo,
    };
  }
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
      const wkReqs = reqs.filter(r => r.destino === 'trabajador');
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
    accesoEstado: accesoBloqueado ? 'bloqueado' : accesoPendiente ? 'pendiente' : 'habilitado',
    accesoBloqueado,
    accesoPendiente,
    motivoAcceso: motivosAcceso.length > 0 ? motivosAcceso.join('; ') : undefined,
    pagoEstado: pagoBloqueado ? 'bloqueado' : pagoPendiente ? 'pendiente' : 'habilitado',
    pagoBloqueado,
    pagoPendiente,
    motivoPago: motivosPago.length > 0 ? motivosPago.join('; ') : undefined
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
        const wkReqs = reqs.filter(r => r.destino === 'trabajador');
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
  const reqs = getRequisitos().filter(r => r.proyectoId === proyectoId && r.destino === 'trabajador' && r.activo !== false);
  const docs = w.documentos || [];
  
  let result = '';
  reqs.forEach(req => {
    const doc = buscarDocumentoRequisito(docs, req, proyectoId);
    if (!doc) {
      if (req.obligatorio) {
        result = `${req.nombre} pendiente`;
      }
    } else {
      const isVencido = esVencidoPorFecha(doc.vencimiento);
      if (req.obligatorio) {
        if (doc.estado === 'rechazado') {
          result = `${req.nombre} rechazado`;
        } else if (isVencido) {
          result = `${req.nombre} vencido`;
        } else if (doc.estado === 'pendiente' || doc.estado === 'revision') {
          result = `${req.nombre} pendiente`;
        }
      }
    }
  });
  return result || 'Requisitos en proceso';
}

export type UserSession = SupabaseUserSession;

export function getCurrentSession(): UserSession | null {
  return getStoredSupabaseSession();
}

export function logoutUser(): void {
  clearDerivedStateCache();
  clearSupabaseSession();
}

export function actualizarEstadoDocumento(
  contratistaId: string,
  proyectoId: string | undefined,
  docId: string,
  action: 'approve' | 'reject',
  options?: {
    motivoRechazo?: string;
    explicacionRechazo?: string;
    solucionRechazo?: string;
    usuarioEmail?: string;
    usuarioRol?: string;
    verificador?: string;
  }
): { success: boolean; error?: string } {
  const list = getContratistas();
  const cObj = list.find(c => c.id === contratistaId);
  if (!cObj) {
    return { success: false, error: 'Contratista no encontrado' };
  }

  const actorEmail = options?.usuarioEmail || 'admin@acredita.cl';
  const actorRol = options?.usuarioRol || 'admin';
  const verificador = options?.verificador || 'Verificador Acredita';

  let found = false;

  // Search in company documents
  const compDoc = cObj.documentos?.find(d => d.id === docId);
  if (compDoc) {
    const prevEstado = compDoc.estado;
    if (action === 'approve') {
      compDoc.estado = 'aprobado';
      compDoc.revisor = verificador;
      compDoc.fechaRevisado = new Date().toLocaleDateString('es-CL');
      compDoc.motivo = undefined;
      compDoc.observacion = undefined;
      compDoc.motivoRechazo = undefined;
      compDoc.explicacionRechazo = undefined;
      compDoc.solucionRechazo = undefined;

      registrarAuditoria({
        usuarioId: actorEmail,
        rol: actorRol,
        contratistaId: cObj.id,
        proyectoId: proyectoId,
        accion: 'aprobacion_documento',
        entidad: 'documento_empresa',
        entidadId: docId,
        estadoAnterior: prevEstado,
        estadoNuevo: 'aprobado',
        detalle: `Aprobado documento ${compDoc.nombre} de la empresa ${cObj.nombre}`
      });
    } else {
      compDoc.estado = 'rechazado';
      compDoc.motivoRechazo = options?.motivoRechazo;
      compDoc.explicacionRechazo = options?.explicacionRechazo;
      compDoc.solucionRechazo = options?.solucionRechazo;
      compDoc.motivo = options?.explicacionRechazo || 'Rechazado por auditoría';
      compDoc.observacion = options?.explicacionRechazo || 'Rechazado por auditoría';
      compDoc.revisor = verificador;
      compDoc.fechaRevisado = new Date().toLocaleDateString('es-CL');

      registrarAuditoria({
        usuarioId: actorEmail,
        rol: actorRol,
        contratistaId: cObj.id,
        proyectoId: proyectoId,
        accion: 'rechazo_documento',
        entidad: 'documento_empresa',
        entidadId: docId,
        estadoAnterior: prevEstado,
        estadoNuevo: 'rechazado',
        detalle: `Rechazado documento ${compDoc.nombre} de la empresa ${cObj.nombre}: ${options?.motivoRechazo}`
      });
    }
    found = true;
  }

  // Search in worker documents
  if (!found && cObj.trabajadores) {
    for (const worker of cObj.trabajadores) {
      const workerDoc = worker.documentos?.find(d => d.id === docId);
      if (workerDoc) {
        const prevEstado = workerDoc.estado;
        if (action === 'approve') {
          workerDoc.estado = 'aprobado';
          workerDoc.revisor = verificador;
          workerDoc.fechaRevisado = new Date().toLocaleDateString('es-CL');
          workerDoc.motivo = undefined;
          workerDoc.observacion = undefined;
          workerDoc.motivoRechazo = undefined;
          workerDoc.explicacionRechazo = undefined;
          workerDoc.solucionRechazo = undefined;

          registrarAuditoria({
            usuarioId: actorEmail,
            rol: actorRol,
            contratistaId: cObj.id,
            proyectoId: proyectoId,
            accion: 'aprobacion_documento',
            entidad: 'documento_trabajador',
            entidadId: docId,
            estadoAnterior: prevEstado,
            estadoNuevo: 'aprobado',
            detalle: `Aprobado documento ${workerDoc.nombre} del trabajador ${worker.nombre}`
          });
        } else {
          workerDoc.estado = 'rechazado';
          workerDoc.motivoRechazo = options?.motivoRechazo;
          workerDoc.explicacionRechazo = options?.explicacionRechazo;
          workerDoc.solucionRechazo = options?.solucionRechazo;
          workerDoc.motivo = options?.explicacionRechazo || 'Rechazado por auditoría';
          workerDoc.observacion = options?.explicacionRechazo || 'Rechazado por auditoría';
          workerDoc.revisor = verificador;
          workerDoc.fechaRevisado = new Date().toLocaleDateString('es-CL');

          registrarAuditoria({
            usuarioId: actorEmail,
            rol: actorRol,
            contratistaId: cObj.id,
            proyectoId: proyectoId,
            accion: 'rechazo_documento',
            entidad: 'documento_trabajador',
            entidadId: docId,
            estadoAnterior: prevEstado,
            estadoNuevo: 'rechazado',
            detalle: `Rechazado documento ${workerDoc.nombre} del trabajador ${worker.nombre}: ${options?.motivoRechazo}`
          });
        }
        worker.estado = calcularEstadoTrabajador(worker, proyectoId);
        found = true;
        break;
      }
    }
  }

  if (!found) {
    return { success: false, error: 'Documento no encontrado' };
  }

  saveContratistas(list);
  return { success: true };
}

/**
 * Simula que el contratista cargó una nueva versión de un documento
 * previamente rechazado: archiva la versión rechazada en `historial`,
 * incrementa `version` y vuelve a dejar el documento en 'revision' para que
 * reingrese a "Por revisar". Solo aplica a documentos en estado 'rechazado'.
 */
export function simularNuevaVersion(
  contratistaId: string,
  docId: string
): { success: boolean; error?: string } {
  const list = getContratistas();
  const cObj = list.find(c => c.id === contratistaId);
  if (!cObj) {
    return { success: false, error: 'Contratista no encontrado' };
  }

  const aplicarNuevaVersion = (doc: Documento): boolean => {
    if (doc.estado !== 'rechazado') return false;
    const versionAnterior = doc.version || 1;
    const nuevoHistorial: HistorialVersionDocumento = {
      version: versionAnterior,
      estado: 'rechazado',
      fecha: doc.fechaRevisado || doc.subido || '—',
      motivoRechazo: doc.motivoRechazo || doc.motivo,
      explicacionRechazo: doc.explicacionRechazo || doc.observacion,
      verificador: doc.revisor,
    };
    doc.historial = [...(doc.historial || []), nuevoHistorial];
    doc.version = versionAnterior + 1;
    doc.estado = 'revision';
    doc.subido = new Date().toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' });
    doc.motivo = undefined;
    doc.observacion = undefined;
    doc.motivoRechazo = undefined;
    doc.explicacionRechazo = undefined;
    doc.solucionRechazo = undefined;
    doc.revisor = undefined;
    doc.fechaRevisado = undefined;
    return true;
  };

  let found = false;
  let docNombre = '';
  let entidadLabel = '';
  const compDoc = cObj.documentos?.find(d => d.id === docId);
  if (compDoc && aplicarNuevaVersion(compDoc)) {
    found = true;
    docNombre = compDoc.nombre;
    entidadLabel = `la empresa ${cObj.nombre}`;
  }

  if (!found) {
    for (const worker of cObj.trabajadores || []) {
      const workerDoc = worker.documentos?.find(d => d.id === docId);
      if (workerDoc && aplicarNuevaVersion(workerDoc)) {
        found = true;
        docNombre = workerDoc.nombre;
        entidadLabel = `el trabajador ${worker.nombre}`;
        worker.estado = calcularEstadoTrabajador(worker, workerDoc.proyectoId);
        break;
      }
    }
  }

  if (!found) {
    return { success: false, error: 'Documento no encontrado o no está rechazado' };
  }

  saveContratistas(list);
  registrarAuditoria({
    usuarioId: 'admin@acredita.cl',
    rol: 'admin',
    contratistaId: cObj.id,
    accion: 'nueva_version_documento',
    entidad: 'documento',
    entidadId: docId,
    estadoAnterior: 'rechazado',
    estadoNuevo: 'revision',
    detalle: `Nueva versión cargada para ${docNombre} de ${entidadLabel}`,
  });
  return { success: true };
}

/**
 * Etiqueta legible de la vigencia requerida para un documento: busca primero
 * en las reglas de vigencia (días concretos) y si no hay una regla asociada,
 * cae en la frecuencia del requisito ('Mensual', 'Indefinido', 'Por Proyecto').
 */
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
export function sembrarDocumentosEjemplo(): number {
  const list = getContratistas();
  const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  const hoy = new Date();
  const fechaHoy = `${String(hoy.getDate()).padStart(2, '0')} ${meses[hoy.getMonth()]} ${hoy.getFullYear()}`;

  const marcarRevision = (doc: Documento, motivo: string) => {
    doc.estado = 'revision';
    doc.subido = fechaHoy;
    doc.motivo = motivo;
    doc.observacion = motivo;
  };

  const yaSembrados = new Set<string>();
  let sembrados = 0;

  // 1. Preferred picks: one of each document family, by name, for a curated
  //    mix — works out of the box on a fresh/default dataset. Includes both
  //    company-level documents and worker-level ones, so the queue shows
  //    every DocumentPreview variant (liquidación, certificado, tributario,
  //    contrato) with both an "Empresa" and a "Trabajador" origen.
  const objetivos: Array<{ contratistaId: string; trabajadorNombre?: string; nombreDoc: string; motivo: string }> = [
    { contratistaId: 'tecnicosur', nombreDoc: 'Liquidación de sueldo (mes vigente)', motivo: 'Verificar descuentos legales y base imponible.' },
    { contratistaId: 'lagos-cia', nombreDoc: 'Registro Mutual ACHS', motivo: 'Confirmar vigencia de la póliza mutual.' },
    { contratistaId: 'electrica-sur', nombreDoc: 'F30 SII (mes vigente)', motivo: 'Validar el período tributario declarado.' },
    { contratistaId: 'constructora-velez', nombreDoc: 'Contrato de Trabajo', motivo: 'Revisar cláusulas de jornada y remuneración.' },
    { contratistaId: 'tecnicosur', trabajadorNombre: 'Juan Pérez González', nombreDoc: 'Certificado de Antecedentes', motivo: 'Confirmar vigencia del certificado del trabajador.' },
    { contratistaId: 'servicios-norte', trabajadorNombre: 'Jorge Morales', nombreDoc: 'Contrato de Trabajo', motivo: 'Revisar cláusulas de jornada y remuneración del trabajador.' },
  ];
  const metaSembrados = objetivos.length;
  objetivos.forEach(obj => {
    const cObj = list.find(c => c.id === obj.contratistaId);
    if (!cObj) return;
    if (obj.trabajadorNombre) {
      const w = cObj.trabajadores?.find(t => t.nombre === obj.trabajadorNombre);
      const doc = w?.documentos?.find(d => d.nombre === obj.nombreDoc && d.estado !== 'revision');
      if (!doc) return;
      marcarRevision(doc, obj.motivo);
      yaSembrados.add(`${cObj.id}_${w!.rut}_${doc.id}`);
    } else {
      const doc = cObj.documentos?.find(d => d.nombre === obj.nombreDoc && d.estado !== 'revision');
      if (!doc) return;
      marcarRevision(doc, obj.motivo);
      yaSembrados.add(`${cObj.id}_${doc.id}`);
    }
    sembrados++;
  });

  // 2. Fallback: after months of manual testing, a live session's data can
  //    drift far enough from the seed (documents renamed, contratistas
  //    edited/removed) that none of the named picks above still exist. Rather
  //    than silently seeding nothing, grab more documents from anywhere in
  //    the current dataset (company or worker level), still not already in
  //    revision, up to the same target count as the curated picks above.
  if (sembrados < metaSembrados) {
    outer: for (const c of list) {
      for (const doc of c.documentos || []) {
        if (sembrados >= metaSembrados) break outer;
        if (doc.estado === 'revision' || yaSembrados.has(`${c.id}_${doc.id}`)) continue;
        marcarRevision(doc, 'Revisar documento cargado por el contratista.');
        yaSembrados.add(`${c.id}_${doc.id}`);
        sembrados++;
      }
      for (const w of c.trabajadores || []) {
        for (const doc of w.documentos || []) {
          if (sembrados >= metaSembrados) break outer;
          if (doc.estado === 'revision' || yaSembrados.has(`${c.id}_${w.rut}_${doc.id}`)) continue;
          marcarRevision(doc, `Revisar documento cargado para el trabajador ${w.nombre}.`);
          yaSembrados.add(`${c.id}_${w.rut}_${doc.id}`);
          sembrados++;
        }
      }
    }
  }

  if (sembrados > 0) saveContratistas(list);
  return sembrados;
}

export interface AuditLog {
  id: string;
  fecha: string;
  usuarioId: string;
  rol: string;
  accion: string;
  entidad: string;
  entidadId: string;
  proyectoId?: string;
  contratistaId?: string;
  detalle?: string;
  estadoAnterior?: string;
  estadoNuevo?: string;
  // UI compatibility aliases
  actor?: string;
  empresa?: string;
  proyecto?: string;
  resultado?: string;
  ip?: string;
}

export function getAuditLogs(): AuditLog[] {
  return safeParseStorageArray<AuditLog>('acredita_audit_logs', []);
}

export function saveAuditLogs(list: AuditLog[]): void {
  localStorage.setItem('acredita_audit_logs', JSON.stringify(list));
}

export function registrarAuditoria(log: Omit<AuditLog, 'id' | 'fecha'>): void {
  const logs = getAuditLogs();
  
  let proyectoNombre = '';
  if (log.proyectoId) {
    const p = getProyectos().find(pr => pr.id === log.proyectoId);
    if (p) proyectoNombre = p.nombre;
  }

  let contratistaNombre = '';
  if (log.contratistaId) {
    const c = getContratistas().find(co => co.id === log.contratistaId);
    if (c) contratistaNombre = c.nombre;
  }

  const newLog: AuditLog = {
    ...log,
    id: 'log_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
    fecha: new Date().toISOString(),
    // Compatibility aliases
    actor: log.usuarioId,
    empresa: contratistaNombre || 'N/A',
    proyecto: proyectoNombre || '',
    resultado: log.estadoNuevo === 'aprobado' || log.accion === 'login_exitoso' || log.accion === 'aceptacion_invitacion' ? 'exitoso' : 'informativo'
  };

  logs.push(newLog);
  saveAuditLogs(logs);
}

export function consultarAuditoria(session: { email: string; role: string; mandanteId?: string; contratistaId?: string } | null): AuditLog[] {
  const allLogs = getAuditLogs();
  if (!session) return [];

  if (session.role === 'admin') {
    return allLogs;
  }

  if (session.role === 'mandante') {
    const proyectos = getProyectos();
    const misProyectosIds = proyectos.filter(p => p.mandanteId === session.mandanteId).map(p => p.id);
    const permitidosContratistasIds = new Set<string>();
    proyectos.filter(p => p.mandanteId === session.mandanteId).forEach(p => {
      p.contratistas?.forEach(cid => permitidosContratistasIds.add(cid));
    });

    return allLogs.filter(log => {
      if (log.usuarioId === session.email) return true;
      if (log.proyectoId && misProyectosIds.includes(log.proyectoId)) return true;
      if (log.contratistaId && permitidosContratistasIds.has(log.contratistaId)) return true;
      return false;
    });
  }

  if (session.role === 'contratista') {
    return allLogs.filter(log => {
      if (log.usuarioId === session.email) return true;
      if (log.contratistaId && log.contratistaId === session.contratistaId) return true;
      return false;
    });
  }

  return [];
}

