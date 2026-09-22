import type { Documento, HistorialVersionDocumento } from '../types';
import { formatPeriodo } from './operationalCore';
import type {
  BackendDocument,
  BackendObligation,
  BackendRequirement,
  BackendVersion,
} from './supabaseOperationalApi';

export function normalizeOperationalValue(value: string): string {
  return (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

export function normalizeOperationalRut(value: string): string {
  return (value || '').replace(/[^0-9kK]/g, '').toUpperCase();
}

export function operationalSlug(value: string): string {
  return normalizeOperationalValue(value).replace(/[^a-z0-9_-]+/g, '_');
}

export function parseOperationalFrontendDate(value?: string): string | null {
  if (!value || value === '—' || normalizeOperationalValue(value).includes('indef')) return null;
  const direct = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00Z`) : null;
  if (direct && !Number.isNaN(direct.getTime())) return value;

  const parts = value.trim().split(/[\s\/-]+/);
  if (parts.length < 3) return null;
  const months: Record<string, number> = {
    ene: 1, feb: 2, mar: 3, abr: 4, may: 5, jun: 6,
    jul: 7, ago: 8, sep: 9, oct: 10, nov: 11, dic: 12,
  };
  let year: number;
  let month: number;
  let day: number;
  if (parts[0].length === 4) {
    year = Number(parts[0]); month = Number(parts[1]); day = Number(parts[2]);
  } else {
    day = Number(parts[0]);
    month = months[normalizeOperationalValue(parts[1]).slice(0, 3)] || Number(parts[1]);
    year = Number(parts[2]);
  }
  if (!year || !month || !day) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function operationalDateToTimestamp(value?: string): string | null {
  const date = parseOperationalFrontendDate(value);
  return date ? `${date}T12:00:00.000Z` : null;
}

function formatDate(value: string | null): string {
  if (!value) return '—';
  const date = new Date(value.length === 10 ? `${value}T12:00:00Z` : value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('es-CL', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' })
    .format(date)
    .replace(/\./g, '');
}

export function toBackendWorkflowStatus(status: Documento['estado']): BackendVersion['workflow_status'] {
  if (status === 'rechazado') return 'rechazado';
  if (status === 'revision') return 'revision';
  if (status === 'pendiente') return 'pendiente';
  return 'aprobado';
}

function frontendStatus(version: BackendVersion | undefined, alertDays: number): Documento['estado'] {
  if (!version) return 'pendiente';
  if (version.workflow_status === 'rechazado') return 'rechazado';
  if (version.workflow_status === 'revision') return 'revision';
  if (version.workflow_status === 'pendiente') return 'pendiente';
  if (version.workflow_status === 'reemplazado') return 'pendiente';
  if (version.expires_at) {
    const expiry = new Date(`${version.expires_at}T12:00:00Z`).getTime();
    const today = new Date();
    const start = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
    const remaining = Math.ceil((expiry - start) / 86400000);
    if (remaining >= 0 && remaining <= Math.max(0, alertDays)) return 'por_vencer';
  }
  return 'aprobado';
}

export function hasUploadedOperationalVersion(doc: Documento): boolean {
  return doc.estado !== 'pendiente'
    || Boolean(doc.archivoReferencia)
    || Boolean(doc.subido && doc.subido !== '—');
}

function versionToHistory(version: BackendVersion): HistorialVersionDocumento {
  const metadata = version.metadata || {};
  return {
    version: version.version_number,
    estado: frontendStatus(version, 0),
    fecha: String(metadata.frontend_reviewed_text || formatDate(version.reviewed_at || version.uploaded_at)),
    emitido: version.issued_at || undefined,
    vencimientoIso: version.expires_at || undefined,
    archivoReferencia: version.original_filename || version.storage_path || undefined,
    motivoRechazo: version.rejection_reason || undefined,
    explicacionRechazo: version.rejection_explanation || undefined,
    solucionRechazo: version.rejection_solution || undefined,
    verificador: typeof metadata.reviewer_name === 'string' ? metadata.reviewer_name : undefined,
  };
}

function versionAprobadaVigente(version: BackendVersion): boolean {
  if (version.workflow_status !== 'aprobado') return false;
  if (!version.expires_at) return true;
  const expiry = new Date(`${version.expires_at}T12:00:00Z`).getTime();
  const today = new Date();
  const start = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  return !Number.isNaN(expiry) && expiry >= start;
}

export function backendOperationalDocumentToFrontend(
  document: BackendDocument,
  requirement: BackendRequirement,
  projectKey: string,
  versions: BackendVersion[],
  obligation?: BackendObligation,
): Documento {
  const ordered = versions.filter(v => v.document_id === document.id).sort((a, b) => a.version_number - b.version_number);
  const latest = ordered[ordered.length - 1];
  const approvedStillValid = [...ordered].reverse().find(versionAprobadaVigente);
  const keepApprovedWhileRenewing = Boolean(
    latest
    && approvedStillValid
    && latest.version_number > approvedStillValid.version_number
    && ['revision', 'rechazado', 'pendiente', 'reemplazado'].includes(latest.workflow_status)
  );
  const effective = keepApprovedWhileRenewing ? approvedStillValid : latest;
  const metadata = effective?.metadata || latest?.metadata || {};
  const versionEnTramite = keepApprovedWhileRenewing && latest ? versionToHistory(latest) : undefined;
  const history = ordered
    .filter(version => version.version_number !== effective?.version_number && version.version_number !== versionEnTramite?.version)
    .map(versionToHistory);

  return {
    id: typeof metadata.frontend_document_id === 'string'
      ? metadata.frontend_document_id
      : `doc_${operationalSlug(projectKey)}_${operationalSlug(requirement.integration_key || requirement.id)}_${operationalSlug(document.worker_id || 'empresa')}`,
    nombre: requirement.name,
    categoria: (requirement.category || 'Laboral') as Documento['categoria'],
    estado: frontendStatus(effective, requirement.alert_days),
    vencimiento: effective?.expires_at ? formatDate(effective.expires_at) : '—',
    vencimientoIso: effective?.expires_at || undefined,
    emitido: effective?.issued_at || undefined,
    subido: effective ? String(metadata.frontend_uploaded_text || formatDate(effective.uploaded_at)) : undefined,
    motivo: effective?.rejection_reason || undefined,
    observacion: effective?.rejection_explanation || undefined,
    motivoRechazo: effective?.rejection_reason || undefined,
    explicacionRechazo: effective?.rejection_explanation || undefined,
    solucionRechazo: effective?.rejection_solution || undefined,
    proyectoId: projectKey,
    archivoReferencia: effective?.original_filename || effective?.storage_path || undefined,
    revisor: typeof metadata.reviewer_name === 'string' ? metadata.reviewer_name : undefined,
    fechaRevisado: effective?.reviewed_at ? String(metadata.frontend_reviewed_text || formatDate(effective.reviewed_at)) : undefined,
    version: effective?.version_number || latest?.version_number || 1,
    historial: history,
    versionEnTramite,
    obligacionId: obligation?.obligation_id,
    periodoEtiqueta: obligation ? formatPeriodo(obligation.period_start, obligation.period_end) : undefined,
    periodoInicio: obligation?.period_start,
    periodoFin: obligation?.period_end,
    fechaLimite: obligation?.due_date,
  };
}
