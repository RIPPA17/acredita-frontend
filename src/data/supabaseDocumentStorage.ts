import type { Requisito } from '../types';
import { restoreSupabaseSession } from './supabaseAuth';
import { hydrateOperationalDataFromSupabase, pushOperationalDataToSupabase } from './supabaseOperationalData';

const SUPABASE_URL = ((import.meta as any).env?.VITE_SUPABASE_URL as string | undefined)
  || 'https://jwlscxbmttpicwljozwf.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = ((import.meta as any).env?.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined)
  || 'sb_publishable_27fQcRn8vsWGpzjjE-XIAQ_0Du8m0UP';
const DOCUMENT_BUCKET = 'acredita-documents';
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set(['application/pdf', 'image/jpeg', 'image/png']);

type BackendProject = { id: string; integration_key: string | null };
type BackendContractor = { id: string; integration_key: string | null };
type BackendAccreditation = { id: string; project_id: string; contratista_id: string; is_active: boolean };
type BackendRequirement = {
  id: string;
  project_id: string;
  integration_key: string | null;
  name: string;
  target: 'empresa' | 'trabajador';
  is_active: boolean;
};
type BackendWorker = { id: string; contratista_id: string; rut: string; is_active: boolean };
type BackendDocument = { id: string; accreditation_id: string; requirement_id: string; worker_id: string | null };
type BackendVersion = {
  id: string;
  document_id: string;
  version_number: number;
  workflow_status: 'pendiente' | 'revision' | 'aprobado' | 'rechazado' | 'reemplazado';
  storage_bucket: string | null;
  storage_path: string | null;
  original_filename: string | null;
  mime_type: string | null;
  size_bytes: number | null;
};

export interface DocumentStorageContext {
  contratistaId: string;
  proyectoId: string;
  requisito: Pick<Requisito, 'id' | 'nombre' | 'destino'>;
  trabajadorRut?: string;
}

function authHeaders(accessToken: string, json = true): HeadersInit {
  return {
    apikey: SUPABASE_PUBLISHABLE_KEY,
    Authorization: `Bearer ${accessToken}`,
    ...(json ? { 'Content-Type': 'application/json' } : {}),
  };
}

async function responsePayload(response: Response): Promise<any> {
  const text = await response.text();
  if (!text) return {};
  try { return JSON.parse(text); } catch { return { message: text }; }
}

async function assertResponse(response: Response, fallback: string): Promise<any> {
  const payload = await responsePayload(response);
  if (!response.ok) {
    throw new Error(payload?.message || payload?.error || payload?.error_description || fallback);
  }
  return payload;
}

async function selectRows<T>(table: string, token: string, params: Record<string, string>): Promise<T[]> {
  const url = new URL(`${SUPABASE_URL}/rest/v1/${table}`);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  const response = await fetch(url.toString(), {
    headers: { ...authHeaders(token, false), Accept: 'application/json' },
  });
  return assertResponse(response, `No fue posible consultar ${table}`) as Promise<T[]>;
}

async function insertReturning<T>(table: string, token: string, row: Record<string, unknown>): Promise<T> {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: { ...authHeaders(token), Prefer: 'return=representation' },
    body: JSON.stringify(row),
  });
  const rows = await assertResponse(response, `No fue posible crear ${table}`) as T[];
  if (!rows[0]) throw new Error(`Supabase no devolvió la fila creada en ${table}`);
  return rows[0];
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

function safeFilename(value: string): string {
  const cleaned = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9._-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
  return cleaned || 'documento';
}

function encodeStoragePath(path: string): string {
  return path.split('/').map(segment => encodeURIComponent(segment)).join('/');
}

async function resolveDocumentContext(
  token: string,
  context: DocumentStorageContext,
  ensureDocument: boolean,
): Promise<{ document: BackendDocument; versions: BackendVersion[] }> {
  const [projects, contractors] = await Promise.all([
    selectRows<BackendProject>('projects', token, {
      select: 'id,integration_key',
      integration_key: `eq.${context.proyectoId}`,
      limit: '1',
    }),
    selectRows<BackendContractor>('contratistas', token, {
      select: 'id,integration_key',
      integration_key: `eq.${context.contratistaId}`,
      limit: '1',
    }),
  ]);

  const project = projects[0];
  const contractor = contractors[0];
  if (!project || !contractor) throw new Error('No fue posible resolver el proyecto o contratista en Supabase.');

  const accreditations = await selectRows<BackendAccreditation>('accreditations', token, {
    select: 'id,project_id,contratista_id,is_active',
    project_id: `eq.${project.id}`,
    contratista_id: `eq.${contractor.id}`,
    is_active: 'eq.true',
    limit: '1',
  });
  const accreditation = accreditations[0];
  if (!accreditation) throw new Error('El contratista no tiene una acreditación activa en este proyecto.');

  const requirements = await selectRows<BackendRequirement>('requirements', token, {
    select: 'id,project_id,integration_key,name,target,is_active',
    project_id: `eq.${project.id}`,
    target: `eq.${context.requisito.destino}`,
    is_active: 'eq.true',
  });
  const requirement = requirements.find(item => item.integration_key === context.requisito.id)
    || requirements.find(item => normalize(item.name) === normalize(context.requisito.nombre));
  if (!requirement) throw new Error('No fue posible encontrar el requisito correspondiente en Supabase.');

  let workerId: string | null = null;
  if (context.requisito.destino === 'trabajador') {
    if (!context.trabajadorRut) throw new Error('Falta identificar al trabajador del documento.');
    const workers = await selectRows<BackendWorker>('workers', token, {
      select: 'id,contratista_id,rut,is_active',
      contratista_id: `eq.${contractor.id}`,
      is_active: 'eq.true',
    });
    const worker = workers.find(item => normalizeRut(item.rut) === normalizeRut(context.trabajadorRut || ''));
    if (!worker) throw new Error('El trabajador todavía no está sincronizado con Supabase.');
    workerId = worker.id;
  }

  const documents = await selectRows<BackendDocument>('documents', token, {
    select: 'id,accreditation_id,requirement_id,worker_id',
    accreditation_id: `eq.${accreditation.id}`,
    requirement_id: `eq.${requirement.id}`,
  });
  let document = documents.find(item => item.worker_id === workerId);

  if (!document && ensureDocument) {
    document = await insertReturning<BackendDocument>('documents', token, {
      accreditation_id: accreditation.id,
      requirement_id: requirement.id,
      worker_id: workerId,
    });
  }
  if (!document) throw new Error('Este requisito todavía no tiene un documento asociado.');

  const versions = await selectRows<BackendVersion>('document_versions', token, {
    select: 'id,document_id,version_number,workflow_status,storage_bucket,storage_path,original_filename,mime_type,size_bytes',
    document_id: `eq.${document.id}`,
  });

  return { document, versions };
}

export async function uploadDocumentFile(
  context: DocumentStorageContext,
  file: File,
): Promise<{ version: number; filename: string }> {
  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    throw new Error('Formato no permitido. Usa PDF, JPG o PNG.');
  }
  if (file.size <= 0) throw new Error('El archivo está vacío.');
  if (file.size > MAX_FILE_SIZE) throw new Error('El archivo supera el máximo de 10 MB.');

  const session = await restoreSupabaseSession();
  if (!session) throw new Error('Tu sesión expiró. Vuelve a iniciar sesión.');
  if (session.role === 'mandante') throw new Error('El Mandante no puede cargar documentos.');

  // Asegura primero que trabajadores/asignaciones locales recientes ya
  // existan en Supabase. Los documentos pendientes no crean versiones aquí.
  await pushOperationalDataToSupabase(session);

  const { document, versions } = await resolveDocumentContext(
    session._supabase.accessToken,
    context,
    true,
  );

  const latest = [...versions].sort((a, b) => b.version_number - a.version_number)[0];
  if (latest?.workflow_status === 'revision') {
    throw new Error('Este documento ya tiene una versión en revisión.');
  }

  const versionNumber = Math.max(0, ...versions.map(item => item.version_number)) + 1;
  const uniqueId = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const path = `${document.id}/v${versionNumber}/${uniqueId}-${safeFilename(file.name)}`;
  const storageUrl = `${SUPABASE_URL}/storage/v1/object/${DOCUMENT_BUCKET}/${encodeStoragePath(path)}`;

  const uploadResponse = await fetch(storageUrl, {
    method: 'POST',
    headers: {
      ...authHeaders(session._supabase.accessToken, false),
      'Content-Type': file.type,
      'cache-control': '3600',
    },
    body: file,
  });
  await assertResponse(uploadResponse, 'No fue posible subir el archivo a Supabase Storage.');

  await insertReturning<BackendVersion>('document_versions', session._supabase.accessToken, {
    document_id: document.id,
    version_number: versionNumber,
    workflow_status: 'revision',
    uploaded_by: session.profileId,
    uploaded_at: new Date().toISOString(),
    storage_bucket: DOCUMENT_BUCKET,
    storage_path: path,
    original_filename: file.name,
    mime_type: file.type,
    size_bytes: file.size,
    metadata: {
      frontend_document_id: `${context.proyectoId}:${context.requisito.id}:${context.trabajadorRut || 'empresa'}`,
      real_storage_upload: true,
    },
  });

  await hydrateOperationalDataFromSupabase(session);
  return { version: versionNumber, filename: file.name };
}

async function fetchLatestStoredFile(context: DocumentStorageContext): Promise<{
  blob: Blob;
  filename: string;
  mimeType: string;
}> {
  const session = await restoreSupabaseSession();
  if (!session) throw new Error('Tu sesión expiró. Vuelve a iniciar sesión.');

  const { versions } = await resolveDocumentContext(session._supabase.accessToken, context, false);
  const latest = [...versions]
    .filter(item => item.storage_path && item.storage_bucket)
    .sort((a, b) => b.version_number - a.version_number)[0];
  if (!latest?.storage_path || !latest.storage_bucket) {
    throw new Error('Esta versión no tiene un archivo real almacenado.');
  }

  const url = `${SUPABASE_URL}/storage/v1/object/authenticated/${encodeURIComponent(latest.storage_bucket)}/${encodeStoragePath(latest.storage_path)}`;
  const response = await fetch(url, {
    headers: authHeaders(session._supabase.accessToken, false),
  });
  if (!response.ok) {
    const payload = await responsePayload(response);
    throw new Error(payload?.message || 'No fue posible abrir el archivo.');
  }

  return {
    blob: await response.blob(),
    filename: latest.original_filename || `documento-v${latest.version_number}`,
    mimeType: latest.mime_type || response.headers.get('content-type') || 'application/octet-stream',
  };
}

export async function openDocumentFile(context: DocumentStorageContext): Promise<void> {
  const popup = typeof window !== 'undefined' ? window.open('', '_blank') : null;
  try {
    const file = await fetchLatestStoredFile(context);
    const objectUrl = URL.createObjectURL(file.blob);
    if (popup) {
      popup.document.title = file.filename;
      popup.location.href = objectUrl;
    } else if (typeof document !== 'undefined') {
      const link = document.createElement('a');
      link.href = objectUrl;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.click();
    }
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
  } catch (error) {
    popup?.close();
    throw error;
  }
}

export async function loadDocumentFileObjectUrl(context: DocumentStorageContext): Promise<{
  url: string;
  filename: string;
  mimeType: string;
}> {
  const file = await fetchLatestStoredFile(context);
  return {
    url: URL.createObjectURL(file.blob),
    filename: file.filename,
    mimeType: file.mimeType,
  };
}


export interface DocumentReviewDecision {
  action: 'approve' | 'reject';
  reviewerName?: string;
  reason?: string;
  explanation?: string;
  solution?: string;
}

export async function reviewLatestDocumentVersion(
  context: DocumentStorageContext,
  decision: DocumentReviewDecision,
): Promise<{ version: number; status: 'aprobado' | 'rechazado' }> {
  const session = await restoreSupabaseSession();
  if (!session) throw new Error('Tu sesión expiró. Vuelve a iniciar sesión.');
  if (session.role !== 'admin') throw new Error('Solo Acredita puede aprobar o rechazar documentos.');

  const token = session._supabase.accessToken;
  const { document } = await resolveDocumentContext(token, context, false);
  type ReviewableVersion = {
    id: string;
    version_number: number;
    workflow_status: 'pendiente' | 'revision' | 'aprobado' | 'rechazado' | 'reemplazado';
    metadata: Record<string, unknown> | null;
  };

  const versions = await selectRows<ReviewableVersion>('document_versions', token, {
    select: 'id,version_number,workflow_status,metadata',
    document_id: `eq.${document.id}`,
    order: 'version_number.desc',
    limit: '1',
  });
  const latest = versions[0];
  if (!latest) throw new Error('Este documento no tiene una versión para revisar.');
  if (latest.workflow_status !== 'revision') throw new Error('La versión más reciente ya no está en revisión.');
  if (decision.action === 'reject' && !decision.reason?.trim()) {
    throw new Error('Debes indicar un motivo de rechazo.');
  }

  const nextStatus = decision.action === 'approve' ? 'aprobado' : 'rechazado';
  const reviewedAt = new Date().toISOString();
  const patch = {
    workflow_status: nextStatus,
    reviewed_by: session.profileId,
    reviewed_at: reviewedAt,
    rejection_reason: decision.action === 'reject' ? decision.reason?.trim() : null,
    rejection_explanation: decision.action === 'reject'
      ? (decision.explanation?.trim() || decision.reason?.trim())
      : null,
    rejection_solution: decision.action === 'reject'
      ? (decision.solution?.trim() || decision.explanation?.trim() || null)
      : null,
    metadata: {
      ...(latest.metadata || {}),
      reviewer_name: decision.reviewerName || session.nombre || session.email,
      frontend_reviewed_text: reviewedAt,
      backend_review_decision: true,
    },
  };

  const url = new URL(`${SUPABASE_URL}/rest/v1/document_versions`);
  url.searchParams.set('id', `eq.${latest.id}`);
  const response = await fetch(url.toString(), {
    method: 'PATCH',
    headers: { ...authHeaders(token), Prefer: 'return=representation' },
    body: JSON.stringify(patch),
  });
  const updated = await assertResponse(response, 'No fue posible guardar la revisión en Supabase.') as unknown[];
  if (!Array.isArray(updated) || updated.length !== 1) {
    throw new Error('La versión cambió mientras la revisabas. Recarga la cola.');
  }

  await hydrateOperationalDataFromSupabase(session);
  return { version: latest.version_number, status: nextStatus };
}
