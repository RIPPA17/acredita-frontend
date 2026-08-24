import type {
  Contratista,
  Documento,
  HistorialVersionDocumento,
  Proyecto,
  Requisito,
  Trabajador,
} from '../types';
import type { SupabaseUserSession } from './supabaseAuth';

const SUPABASE_URL = ((import.meta as any).env?.VITE_SUPABASE_URL as string | undefined)
  || 'https://jwlscxbmttpicwljozwf.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = ((import.meta as any).env?.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined)
  || 'sb_publishable_27fQcRn8vsWGpzjjE-XIAQ_0Du8m0UP';

const MIGRATION_MARKER_PREFIX = 'acredita_operational_supabase_migrated_v1:';
const CONTRACTORS_KEY = 'acredita_contratistas';

type BackendProject = { id: string; name: string; integration_key: string | null };
type BackendContractor = { id: string; integration_key: string | null };
type BackendAccreditation = { id: string; project_id: string; contratista_id: string; is_active: boolean };
type BackendRequirement = {
  id: string;
  project_id: string;
  integration_key: string | null;
  name: string;
  category: string | null;
  target: 'empresa' | 'trabajador';
  alert_days: number;
  is_active: boolean;
};
type BackendWorker = {
  id: string;
  contratista_id: string;
  rut: string;
  full_name: string;
  job_title: string | null;
  is_active: boolean;
};
type BackendAssignment = {
  id: string;
  accreditation_id: string;
  worker_id: string;
  is_active: boolean;
};
type BackendDocument = {
  id: string;
  accreditation_id: string;
  requirement_id: string;
  worker_id: string | null;
};
type BackendVersion = {
  id: string;
  document_id: string;
  version_number: number;
  workflow_status: 'pendiente' | 'revision' | 'aprobado' | 'rechazado' | 'reemplazado';
  expires_at: string | null;
  uploaded_at: string;
  reviewed_at: string | null;
  rejection_reason: string | null;
  rejection_explanation: string | null;
  rejection_solution: string | null;
  storage_bucket: string | null;
  storage_path: string | null;
  original_filename: string | null;
  metadata: Record<string, unknown> | null;
};

type BackendRows = {
  projects: BackendProject[];
  contractors: BackendContractor[];
  accreditations: BackendAccreditation[];
  requirements: BackendRequirement[];
  workers: BackendWorker[];
  assignments: BackendAssignment[];
  documents: BackendDocument[];
  versions: BackendVersion[];
};

function headers(accessToken: string, extra: HeadersInit = {}): HeadersInit {
  return {
    apikey: SUPABASE_PUBLISHABLE_KEY,
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
    ...extra,
  };
}

async function parseResponse<T>(response: Response): Promise<T> {
  if (response.status === 204) return undefined as T;
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload?.message || payload?.hint || payload?.error_description || payload?.error || 'Error al sincronizar datos operacionales';
    throw new Error(message);
  }
  return payload as T;
}

async function selectRows<T>(table: string, token: string, select: string): Promise<T[]> {
  const url = new URL(`${SUPABASE_URL}/rest/v1/${table}`);
  url.searchParams.set('select', select);
  const response = await fetch(url.toString(), { headers: headers(token, { Accept: 'application/json' }) });
  return parseResponse<T[]>(response);
}

async function insertRows(
  table: string,
  token: string,
  rows: Record<string, unknown> | Record<string, unknown>[],
  onConflict?: string,
): Promise<void> {
  const url = new URL(`${SUPABASE_URL}/rest/v1/${table}`);
  if (onConflict) url.searchParams.set('on_conflict', onConflict);
  const response = await fetch(url.toString(), {
    method: 'POST',
    headers: headers(token, {
      Prefer: onConflict ? 'resolution=merge-duplicates,return=minimal' : 'return=minimal',
    }),
    body: JSON.stringify(rows),
  });
  await parseResponse<void>(response);
}

async function insertReturning<T>(table: string, token: string, row: Record<string, unknown>): Promise<T> {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: headers(token, { Prefer: 'return=representation' }),
    body: JSON.stringify(row),
  });
  const rows = await parseResponse<T[]>(response);
  if (!rows[0]) throw new Error(`Supabase no devolvió la fila creada en ${table}`);
  return rows[0];
}

async function patchRows(table: string, token: string, filters: Record<string, string>, body: Record<string, unknown>): Promise<void> {
  const url = new URL(`${SUPABASE_URL}/rest/v1/${table}`);
  Object.entries(filters).forEach(([key, value]) => url.searchParams.set(key, value));
  const response = await fetch(url.toString(), {
    method: 'PATCH',
    headers: headers(token, { Prefer: 'return=minimal' }),
    body: JSON.stringify(body),
  });
  await parseResponse<void>(response);
}

function readContractors(): Contratista[] {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(CONTRACTORS_KEY) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeContractors(contractors: Contratista[]): void {
  if (typeof window !== 'undefined') localStorage.setItem(CONTRACTORS_KEY, JSON.stringify(contractors));
}

function readProjects(): Proyecto[] {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(localStorage.getItem('acredita_proyectos') || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function readRequirements(): Requisito[] {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(localStorage.getItem('acredita_requisitos') || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function normalize(value: string): string {
  return (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function normalizeRut(value: string): string {
  return (value || '').replace(/[^0-9kK]/g, '').toUpperCase();
}

function slug(value: string): string {
  return normalize(value).replace(/[^a-z0-9_-]+/g, '_');
}

function projectMatchesFaena(worker: Trabajador, project: Proyecto): boolean {
  const faena = normalize(worker.faena || '');
  if (!faena) return false;
  return faena === normalize(project.id)
    || faena === normalize(project.nombre)
    || faena === normalize(project.nombre.replace('Proyecto ', '').trim());
}

function workerAssignedToProject(worker: Trabajador, project: Proyecto): boolean {
  return (worker.documentos || []).some(doc => doc.proyectoId === project.id) || projectMatchesFaena(worker, project);
}

function parseFrontendDate(value?: string): string | null {
  if (!value || value === '—' || normalize(value).includes('indef')) return null;
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
    month = months[normalize(parts[1]).slice(0, 3)] || Number(parts[1]);
    year = Number(parts[2]);
  }
  if (!year || !month || !day) return null;
  const d = new Date(Date.UTC(year, month - 1, day));
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) return null;
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function dateToTimestamp(value?: string): string | null {
  const date = parseFrontendDate(value);
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

function backendStatus(status: Documento['estado']): BackendVersion['workflow_status'] {
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

function hasUploadedVersion(doc: Documento): boolean {
  return doc.estado !== 'pendiente'
    || Boolean(doc.archivoReferencia)
    || Boolean(doc.subido && doc.subido !== '—');
}

async function fetchRows(token: string): Promise<BackendRows> {
  const [projects, contractors, accreditations, requirements, workers, assignments, documents, versions] = await Promise.all([
    selectRows<BackendProject>('projects', token, 'id,name,integration_key'),
    selectRows<BackendContractor>('contratistas', token, 'id,integration_key'),
    selectRows<BackendAccreditation>('accreditations', token, 'id,project_id,contratista_id,is_active'),
    selectRows<BackendRequirement>('requirements', token, 'id,project_id,integration_key,name,category,target,alert_days,is_active'),
    selectRows<BackendWorker>('workers', token, 'id,contratista_id,rut,full_name,job_title,is_active'),
    selectRows<BackendAssignment>('worker_assignments', token, 'id,accreditation_id,worker_id,is_active'),
    selectRows<BackendDocument>('documents', token, 'id,accreditation_id,requirement_id,worker_id'),
    selectRows<BackendVersion>('document_versions', token, 'id,document_id,version_number,workflow_status,expires_at,uploaded_at,reviewed_at,rejection_reason,rejection_explanation,rejection_solution,storage_bucket,storage_path,original_filename,metadata'),
  ]);
  return { projects, contractors, accreditations, requirements, workers, assignments, documents, versions };
}

function localScope(session: SupabaseUserSession, contractors: Contratista[]): Contratista[] {
  if (session.role === 'admin') return contractors;
  if (session.role === 'contratista') return contractors.filter(item => item.id === session.contratistaId);
  return [];
}

async function syncWorkersAndAssignments(session: SupabaseUserSession, rows: BackendRows): Promise<BackendRows> {
  if (session.role === 'mandante') return rows;
  const token = session._supabase.accessToken;
  const contractors = readContractors();
  const projects = readProjects();
  const scoped = localScope(session, contractors);
  const contractorUuidByKey = new Map(rows.contractors.filter(c => c.integration_key).map(c => [c.integration_key as string, c.id]));

  const workerPayload: Record<string, unknown>[] = [];
  for (const contractor of scoped) {
    const contractorUuid = contractorUuidByKey.get(contractor.id);
    if (!contractorUuid) continue;
    for (const worker of contractor.trabajadores || []) {
      workerPayload.push({
        contratista_id: contractorUuid,
        rut: worker.rut,
        full_name: worker.nombre,
        job_title: worker.cargo || null,
        is_active: true,
        updated_at: new Date().toISOString(),
      });
    }
  }
  if (workerPayload.length) await insertRows('workers', token, workerPayload, 'contratista_id,rut');

  let refreshed = await fetchRows(token);
  const projectUuidByKey = new Map(refreshed.projects.filter(p => p.integration_key).map(p => [p.integration_key as string, p.id]));
  const workerByContractorRut = new Map(refreshed.workers.map(w => [`${w.contratista_id}:${normalizeRut(w.rut)}`, w]));
  const accreditationByContext = new Map(refreshed.accreditations.filter(a => a.is_active).map(a => [`${a.project_id}:${a.contratista_id}`, a]));
  const desiredAssignments = new Set<string>();

  for (const contractor of scoped) {
    const contractorUuid = contractorUuidByKey.get(contractor.id);
    if (!contractorUuid) continue;
    const contractorProjects = projects.filter(project => contractor.proyectos.includes(project.id));
    for (const worker of contractor.trabajadores || []) {
      const backendWorker = workerByContractorRut.get(`${contractorUuid}:${normalizeRut(worker.rut)}`);
      if (!backendWorker) continue;
      for (const project of contractorProjects) {
        if (!workerAssignedToProject(worker, project)) continue;
        const projectUuid = projectUuidByKey.get(project.id);
        if (!projectUuid) continue;
        const accreditation = accreditationByContext.get(`${projectUuid}:${contractorUuid}`);
        if (!accreditation) continue;
        const key = `${accreditation.id}:${backendWorker.id}`;
        desiredAssignments.add(key);
        await insertRows('worker_assignments', token, {
          accreditation_id: accreditation.id,
          worker_id: backendWorker.id,
          is_active: true,
          unassigned_at: null,
        }, 'accreditation_id,worker_id');
      }
    }
  }

  refreshed = await fetchRows(token);
  const scopedContractorUuids = new Set(scoped.map(c => contractorUuidByKey.get(c.id)).filter(Boolean) as string[]);
  const scopedWorkerIds = new Set(refreshed.workers.filter(w => scopedContractorUuids.has(w.contratista_id)).map(w => w.id));
  const activeAccreditationIds = new Set(refreshed.accreditations.filter(a => a.is_active && scopedContractorUuids.has(a.contratista_id)).map(a => a.id));

  for (const assignment of refreshed.assignments) {
    if (!assignment.is_active || !scopedWorkerIds.has(assignment.worker_id) || !activeAccreditationIds.has(assignment.accreditation_id)) continue;
    if (!desiredAssignments.has(`${assignment.accreditation_id}:${assignment.worker_id}`)) {
      await patchRows('worker_assignments', token, { id: `eq.${assignment.id}` }, {
        is_active: false,
        unassigned_at: new Date().toISOString(),
      });
    }
  }

  for (const contractor of scoped) {
    const contractorUuid = contractorUuidByKey.get(contractor.id);
    if (!contractorUuid) continue;
    const desiredRuts = new Set((contractor.trabajadores || []).map(w => normalizeRut(w.rut)));
    for (const backendWorker of refreshed.workers.filter(w => w.contratista_id === contractorUuid && w.is_active)) {
      if (!desiredRuts.has(normalizeRut(backendWorker.rut))) {
        await patchRows('workers', token, { id: `eq.${backendWorker.id}` }, { is_active: false, updated_at: new Date().toISOString() });
      }
    }
  }

  return fetchRows(token);
}

function buildHistoryPayload(doc: Documento, documentId: string): Array<Record<string, unknown>> {
  const byVersion = new Map<number, Record<string, unknown>>();
  for (const history of doc.historial || []) {
    const status = backendStatus(history.estado);
    byVersion.set(history.version, {
      document_id: documentId,
      version_number: history.version,
      workflow_status: status,
      expires_at: null,
      uploaded_at: dateToTimestamp(history.fecha) || new Date().toISOString(),
      reviewed_at: status === 'aprobado' || status === 'rechazado' ? dateToTimestamp(history.fecha) : null,
      rejection_reason: status === 'rechazado' ? (history.motivoRechazo || 'Rechazado durante migración') : null,
      rejection_explanation: status === 'rechazado' ? (history.explicacionRechazo || history.motivoRechazo || 'Sin detalle adicional') : null,
      rejection_solution: null,
      storage_bucket: null,
      storage_path: null,
      original_filename: null,
      metadata: {
        frontend_document_id: doc.id,
        reviewer_name: history.verificador || null,
        frontend_reviewed_text: history.fecha,
        legacy_import: true,
      },
    });
  }
  return [...byVersion.values()];
}

function currentVersionPayload(doc: Documento, documentId: string, session: SupabaseUserSession): Record<string, unknown> | null {
  if (!hasUploadedVersion(doc)) return null;
  const status = backendStatus(doc.estado);
  return {
    document_id: documentId,
    version_number: Math.max(1, doc.version || 1),
    workflow_status: status,
    expires_at: parseFrontendDate(doc.vencimiento),
    uploaded_by: session.role === 'contratista' && (status === 'revision' || status === 'pendiente') ? session.profileId : null,
    uploaded_at: dateToTimestamp(doc.subido) || new Date().toISOString(),
    reviewed_by: null,
    reviewed_at: status === 'aprobado' || status === 'rechazado' ? dateToTimestamp(doc.fechaRevisado) : null,
    rejection_reason: status === 'rechazado' ? (doc.motivoRechazo || doc.motivo || 'Rechazado durante migración') : null,
    rejection_explanation: status === 'rechazado' ? (doc.explicacionRechazo || doc.observacion || doc.motivo || 'Sin detalle adicional') : null,
    rejection_solution: status === 'rechazado' ? (doc.solucionRechazo || null) : null,
    storage_bucket: null,
    storage_path: null,
    original_filename: doc.archivoReferencia || null,
    metadata: {
      frontend_document_id: doc.id,
      reviewer_name: doc.revisor || null,
      frontend_uploaded_text: doc.subido || null,
      frontend_reviewed_text: doc.fechaRevisado || null,
      legacy_import: true,
    },
  };
}

async function syncVersions(
  session: SupabaseUserSession,
  doc: Documento,
  backendDocument: BackendDocument,
  versions: BackendVersion[],
): Promise<void> {
  const token = session._supabase.accessToken;
  const desired = [...buildHistoryPayload(doc, backendDocument.id)];
  const current = currentVersionPayload(doc, backendDocument.id, session);
  if (current) desired.push(current);

  for (const payload of desired) {
    const versionNumber = Number(payload.version_number);
    const status = payload.workflow_status as BackendVersion['workflow_status'];
    const existing = versions.find(v => v.document_id === backendDocument.id && v.version_number === versionNumber);
    if (existing) {
      // Una decisión tomada directamente en Supabase es autoridad definitiva.
      // La capa legacy puede hidratarla, pero nunca volver a sobrescribirla.
      if (session.role === 'admin' && existing.metadata?.backend_review_decision !== true) {
        const { document_id: _documentId, version_number: _version, ...patch } = payload;
        await patchRows('document_versions', token, { id: `eq.${existing.id}` }, patch);
      }
      continue;
    }
    if (session.role === 'contratista' && !['pendiente', 'revision'].includes(status)) continue;
    await insertRows('document_versions', token, payload);
  }
}

async function ensureDocument(
  token: string,
  existing: BackendDocument[],
  accreditationId: string,
  requirementId: string,
  workerId: string | null,
): Promise<BackendDocument> {
  const found = existing.find(d =>
    d.accreditation_id === accreditationId
    && d.requirement_id === requirementId
    && d.worker_id === workerId
  );
  if (found) return found;
  const created = await insertReturning<BackendDocument>('documents', token, {
    accreditation_id: accreditationId,
    requirement_id: requirementId,
    worker_id: workerId,
  });
  existing.push(created);
  return created;
}

async function syncDocuments(session: SupabaseUserSession, rows: BackendRows): Promise<void> {
  if (session.role === 'mandante') return;
  const token = session._supabase.accessToken;
  const contractors = localScope(session, readContractors());
  const projectUuidByKey = new Map(rows.projects.filter(p => p.integration_key).map(p => [p.integration_key as string, p.id]));
  const contractorUuidByKey = new Map(rows.contractors.filter(c => c.integration_key).map(c => [c.integration_key as string, c.id]));
  const accreditationByContext = new Map(rows.accreditations.filter(a => a.is_active).map(a => [`${a.project_id}:${a.contratista_id}`, a]));
  const requirementByProjectNameTarget = new Map(rows.requirements.filter(r => r.is_active).map(r => [`${r.project_id}:${r.target}:${normalize(r.name)}`, r]));
  const workerByContractorRut = new Map(rows.workers.map(w => [`${w.contratista_id}:${normalizeRut(w.rut)}`, w]));
  const backendDocuments = [...rows.documents];
  let versions = [...rows.versions];

  const syncOne = async (contractor: Contratista, doc: Documento, worker?: Trabajador) => {
    if (!doc.proyectoId || !hasUploadedVersion(doc)) return;
    const projectUuid = projectUuidByKey.get(doc.proyectoId);
    const contractorUuid = contractorUuidByKey.get(contractor.id);
    if (!projectUuid || !contractorUuid) return;
    const accreditation = accreditationByContext.get(`${projectUuid}:${contractorUuid}`);
    if (!accreditation) return;
    const target = worker ? 'trabajador' : 'empresa';
    const requirement = requirementByProjectNameTarget.get(`${projectUuid}:${target}:${normalize(doc.nombre)}`);
    if (!requirement) return;
    const backendWorker = worker ? workerByContractorRut.get(`${contractorUuid}:${normalizeRut(worker.rut)}`) : undefined;
    if (worker && !backendWorker) return;
    const backendDocument = await ensureDocument(token, backendDocuments, accreditation.id, requirement.id, backendWorker?.id || null);
    await syncVersions(session, doc, backendDocument, versions);
    versions = await selectRows<BackendVersion>('document_versions', token, 'id,document_id,version_number,workflow_status,expires_at,uploaded_at,reviewed_at,rejection_reason,rejection_explanation,rejection_solution,storage_bucket,storage_path,original_filename,metadata');
  };

  for (const contractor of contractors) {
    for (const doc of contractor.documentos || []) await syncOne(contractor, doc);
    for (const worker of contractor.trabajadores || []) {
      for (const doc of worker.documentos || []) await syncOne(contractor, doc, worker);
    }
  }
}

export async function pushOperationalDataToSupabase(session: SupabaseUserSession): Promise<void> {
  if (session.role === 'mandante' || typeof window === 'undefined') return;
  let rows = await fetchRows(session._supabase.accessToken);
  rows = await syncWorkersAndAssignments(session, rows);
  await syncDocuments(session, rows);
}

function versionToHistory(version: BackendVersion): HistorialVersionDocumento {
  const metadata = version.metadata || {};
  return {
    version: version.version_number,
    estado: frontendStatus(version, 0),
    fecha: String(metadata.frontend_reviewed_text || formatDate(version.reviewed_at || version.uploaded_at)),
    motivoRechazo: version.rejection_reason || undefined,
    explicacionRechazo: version.rejection_explanation || undefined,
    verificador: typeof metadata.reviewer_name === 'string' ? metadata.reviewer_name : undefined,
  };
}

function backendDocumentToFrontend(
  document: BackendDocument,
  requirement: BackendRequirement,
  projectKey: string,
  versions: BackendVersion[],
): Documento {
  const ordered = versions.filter(v => v.document_id === document.id).sort((a, b) => a.version_number - b.version_number);
  const latest = ordered[ordered.length - 1];
  const metadata = latest?.metadata || {};
  return {
    id: typeof metadata.frontend_document_id === 'string'
      ? metadata.frontend_document_id
      : `doc_${slug(projectKey)}_${slug(requirement.integration_key || requirement.id)}_${slug(document.worker_id || 'empresa')}`,
    nombre: requirement.name,
    categoria: (requirement.category || 'Laboral') as Documento['categoria'],
    estado: frontendStatus(latest, requirement.alert_days),
    vencimiento: latest?.expires_at ? formatDate(latest.expires_at) : '—',
    subido: latest ? String(metadata.frontend_uploaded_text || formatDate(latest.uploaded_at)) : undefined,
    motivo: latest?.rejection_reason || undefined,
    observacion: latest?.rejection_explanation || undefined,
    motivoRechazo: latest?.rejection_reason || undefined,
    explicacionRechazo: latest?.rejection_explanation || undefined,
    solucionRechazo: latest?.rejection_solution || undefined,
    proyectoId: projectKey,
    archivoReferencia: latest?.original_filename || latest?.storage_path || undefined,
    revisor: typeof metadata.reviewer_name === 'string' ? metadata.reviewer_name : undefined,
    fechaRevisado: latest?.reviewed_at ? String(metadata.frontend_reviewed_text || formatDate(latest.reviewed_at)) : undefined,
    version: latest?.version_number || 1,
    historial: ordered.slice(0, -1).map(versionToHistory),
  };
}

function mergeDocs(localDocs: Documento[] = [], backendDocs: Documento[] = []): Documento[] {
  const result = [...localDocs];
  for (const backend of backendDocs) {
    const index = result.findIndex(local =>
      local.proyectoId === backend.proyectoId && normalize(local.nombre) === normalize(backend.nombre)
    );
    if (index >= 0) result[index] = backend;
    else result.push(backend);
  }
  return result;
}

export async function hydrateOperationalDataFromSupabase(session: SupabaseUserSession): Promise<void> {
  if (typeof window === 'undefined') return;
  const rows = await fetchRows(session._supabase.accessToken);
  const contractors = readContractors();
  const projects = readProjects();
  const requirements = readRequirements();
  const contractorKeyByUuid = new Map(rows.contractors.filter(c => c.integration_key).map(c => [c.id, c.integration_key as string]));
  const projectKeyByUuid = new Map(rows.projects.filter(p => p.integration_key).map(p => [p.id, p.integration_key as string]));
  const projectByKey = new Map(projects.map(p => [p.id, p]));
  const accreditationById = new Map(rows.accreditations.map(a => [a.id, a]));
  const requirementById = new Map(rows.requirements.map(r => [r.id, r]));
  const workerById = new Map(rows.workers.map(w => [w.id, w]));

  const backendCompanyDocs = new Map<string, Documento[]>();
  const backendWorkerDocs = new Map<string, Documento[]>();
  for (const document of rows.documents) {
    const accreditation = accreditationById.get(document.accreditation_id);
    const requirement = requirementById.get(document.requirement_id);
    if (!accreditation || !requirement) continue;
    const contractorKey = contractorKeyByUuid.get(accreditation.contratista_id);
    const projectKey = projectKeyByUuid.get(accreditation.project_id);
    if (!contractorKey || !projectKey) continue;
    const frontend = backendDocumentToFrontend(document, requirement, projectKey, rows.versions);
    if (document.worker_id) {
      const worker = workerById.get(document.worker_id);
      if (!worker) continue;
      const key = `${contractorKey}:${normalizeRut(worker.rut)}`;
      const list = backendWorkerDocs.get(key) || [];
      list.push(frontend);
      backendWorkerDocs.set(key, list);
    } else {
      const list = backendCompanyDocs.get(contractorKey) || [];
      list.push(frontend);
      backendCompanyDocs.set(contractorKey, list);
    }
  }

  const assignmentProjectsByWorker = new Map<string, string[]>();
  for (const assignment of rows.assignments.filter(a => a.is_active)) {
    const accreditation = accreditationById.get(assignment.accreditation_id);
    if (!accreditation) continue;
    const projectKey = projectKeyByUuid.get(accreditation.project_id);
    if (!projectKey) continue;
    const current = assignmentProjectsByWorker.get(assignment.worker_id) || [];
    current.push(projectKey);
    assignmentProjectsByWorker.set(assignment.worker_id, current);
  }

  const workersByContractor = new Map<string, Trabajador[]>();
  for (const backendWorker of rows.workers.filter(w => w.is_active)) {
    const contractorKey = contractorKeyByUuid.get(backendWorker.contratista_id);
    if (!contractorKey) continue;
    const localContractor = contractors.find(c => c.id === contractorKey);
    const localWorker = localContractor?.trabajadores?.find(w => normalizeRut(w.rut) === normalizeRut(backendWorker.rut));
    let docs = mergeDocs(localWorker?.documentos || [], backendWorkerDocs.get(`${contractorKey}:${normalizeRut(backendWorker.rut)}`) || []);
    const assignedProjectKeys = assignmentProjectsByWorker.get(backendWorker.id) || [];

    // Los placeholders pendientes mantienen visible una asignación incluso si
    // todavía no existe una versión subida en documents/document_versions.
    for (const projectKey of assignedProjectKeys) {
      const workerReqs = requirements.filter(r => r.proyectoId === projectKey && r.destino === 'trabajador' && r.activo !== false);
      for (const req of workerReqs) {
        if (docs.some(d => d.proyectoId === projectKey && normalize(d.nombre) === normalize(req.nombre))) continue;
        docs.push({
          id: `doc_${slug(contractorKey)}_${slug(projectKey)}_${slug(req.id)}_${slug(backendWorker.rut)}`,
          nombre: req.nombre,
          categoria: req.categoria,
          estado: 'pendiente',
          vencimiento: '—',
          proyectoId: projectKey,
          version: 1,
          historial: [],
        });
      }
    }

    const firstProject = assignedProjectKeys.map(key => projectByKey.get(key)).find(Boolean);
    const worker: Trabajador = {
      ...(localWorker || { estado: 'pendiente' as const }),
      nombre: backendWorker.full_name,
      rut: backendWorker.rut,
      cargo: backendWorker.job_title || localWorker?.cargo,
      faena: firstProject?.nombre || localWorker?.faena,
      documentos: docs,
    };
    const list = workersByContractor.get(contractorKey) || [];
    list.push(worker);
    workersByContractor.set(contractorKey, list);
  }

  const next = contractors.map(contractor => ({
    ...contractor,
    documentos: mergeDocs(contractor.documentos || [], backendCompanyDocs.get(contractor.id) || []),
    trabajadores: workersByContractor.has(contractor.id)
      ? workersByContractor.get(contractor.id)
      : contractor.trabajadores,
  }));
  writeContractors(next);
}

export async function prepareOperationalDataForSession(session: SupabaseUserSession): Promise<void> {
  if (typeof window === 'undefined') return;
  const marker = `${MIGRATION_MARKER_PREFIX}${session.profileId}`;
  if (localStorage.getItem(marker) !== 'true' && session.role !== 'mandante') {
    try {
      await pushOperationalDataToSupabase(session);
      localStorage.setItem(marker, 'true');
    } catch (error) {
      console.warn('No fue posible migrar completamente trabajadores/documentos legacy.', error);
    }
  }
  await hydrateOperationalDataFromSupabase(session);
}

function operationalFingerprint(): string {
  return typeof window === 'undefined' ? '' : localStorage.getItem(CONTRACTORS_KEY) || '';
}

export function startOperationalDataAutoSync(session: SupabaseUserSession): () => void {
  if (typeof window === 'undefined' || session.role === 'mandante') return () => {};
  let last = operationalFingerprint();
  let syncing = false;
  let disposed = false;
  const timer = window.setInterval(async () => {
    if (disposed || syncing) return;
    const next = operationalFingerprint();
    if (next === last) return;
    last = next;
    syncing = true;
    try {
      await pushOperationalDataToSupabase(session);
    } catch (error) {
      console.error('Error sincronizando Trabajadores/Documentos con Supabase.', error);
    } finally {
      syncing = false;
    }
  }, 900);

  return () => {
    disposed = true;
    window.clearInterval(timer);
  };
}
