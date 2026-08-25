import type { ActividadVerificador, ClaimRevision, Verificador } from '../types';
import type { DocumentStorageContext } from './supabaseDocumentStorage';
import {
  SUPABASE_PUBLISHABLE_KEY,
  SUPABASE_URL,
  restoreSupabaseSession,
  type SupabaseUserSession,
} from './supabaseAuth';
import { hydrateOperationalDataFromSupabase } from './supabaseOperationalData';

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
};
type BackendMembership = { profile_id: string; role: string; is_active: boolean };
type BackendProfile = { id: string; full_name: string | null; is_active: boolean };
type BackendClaim = {
  document_key: string;
  document_version_id: string;
  claimed_by: string;
  claimed_at: string;
  expires_at: string;
};
type BackendActivity = {
  id: string;
  reviewer_id: string;
  document_key: string;
  action: 'aprobado' | 'rechazado';
  created_at: string;
};

type ClaimRpcResult = BackendClaim & { owned: boolean };
type ReviewRpcResult = {
  version_id: string;
  status: 'aprobado' | 'rechazado';
  reviewed_at: string;
  document_key: string;
};

export interface ReviewOperationsSnapshot {
  verificadores: Verificador[];
  claims: ClaimRevision[];
  actividad: ActividadVerificador[];
  currentReviewerId: string;
}

export interface ReviewDecisionInput {
  action: 'approve' | 'reject';
  reviewerName?: string;
  reason?: string;
  explanation?: string;
  solution?: string;
}

function authHeaders(accessToken: string, json = true): HeadersInit {
  return {
    apikey: SUPABASE_PUBLISHABLE_KEY,
    Authorization: `Bearer ${accessToken}`,
    ...(json ? { 'Content-Type': 'application/json' } : {}),
  };
}

async function parseResponse<T>(response: Response, fallback: string): Promise<T> {
  const text = await response.text();
  let payload: any = {};
  if (text) {
    try { payload = JSON.parse(text); } catch { payload = { message: text }; }
  }
  if (!response.ok) {
    throw new Error(payload?.message || payload?.error_description || payload?.error || fallback);
  }
  return payload as T;
}

async function selectRows<T>(table: string, token: string, params: Record<string, string>): Promise<T[]> {
  const url = new URL(`${SUPABASE_URL}/rest/v1/${table}`);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  const response = await fetch(url.toString(), {
    headers: { ...authHeaders(token, false), Accept: 'application/json' },
  });
  return parseResponse<T[]>(response, `No fue posible consultar ${table}`);
}

async function rpc<T>(name: string, token: string, body: Record<string, unknown>): Promise<T> {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(body),
  });
  return parseResponse<T>(response, `No fue posible ejecutar ${name}`);
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

async function requireAdminSession(sessionHint?: SupabaseUserSession | null): Promise<SupabaseUserSession> {
  const session = sessionHint || await restoreSupabaseSession();
  if (!session) throw new Error('Tu sesión expiró. Vuelve a iniciar sesión.');
  if (session.role !== 'admin') throw new Error('Solo Acredita puede operar la cola de revisión.');
  return session;
}

async function resolveLatestVersion(
  token: string,
  context: DocumentStorageContext,
): Promise<BackendVersion> {
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
    if (!worker) throw new Error('El trabajador no está disponible en Supabase.');
    workerId = worker.id;
  }

  const documents = await selectRows<BackendDocument>('documents', token, {
    select: 'id,accreditation_id,requirement_id,worker_id',
    accreditation_id: `eq.${accreditation.id}`,
    requirement_id: `eq.${requirement.id}`,
  });
  const document = documents.find(item => item.worker_id === workerId);
  if (!document) throw new Error('Este requisito todavía no tiene un documento asociado.');

  const versions = await selectRows<BackendVersion>('document_versions', token, {
    select: 'id,document_id,version_number,workflow_status',
    document_id: `eq.${document.id}`,
    order: 'version_number.desc',
    limit: '1',
  });
  const latest = versions[0];
  if (!latest) throw new Error('Este documento no tiene una versión disponible.');
  return latest;
}

function writeReviewCache(snapshot: ReviewOperationsSnapshot): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('acredita_verificadores', JSON.stringify(snapshot.verificadores));
  localStorage.setItem('acredita_verificador_actual', JSON.stringify(snapshot.currentReviewerId));
  localStorage.setItem('acredita_claims_revision', JSON.stringify(snapshot.claims));
  localStorage.setItem('acredita_actividad_verificadores', JSON.stringify(snapshot.actividad));
}

export async function refreshReviewOperationsCache(
  sessionHint?: SupabaseUserSession | null,
): Promise<ReviewOperationsSnapshot> {
  const session = await requireAdminSession(sessionHint);
  const token = session._supabase.accessToken;
  const nowIso = new Date().toISOString();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [memberships, profiles, claims, activity] = await Promise.all([
    selectRows<BackendMembership>('acredita_memberships', token, {
      select: 'profile_id,role,is_active',
      is_active: 'eq.true',
    }),
    selectRows<BackendProfile>('profiles', token, {
      select: 'id,full_name,is_active',
    }),
    selectRows<BackendClaim>('review_claims', token, {
      select: 'document_key,document_version_id,claimed_by,claimed_at,expires_at',
      expires_at: `gt.${nowIso}`,
      order: 'claimed_at.asc',
    }),
    selectRows<BackendActivity>('review_activity', token, {
      select: 'id,reviewer_id,document_key,action,created_at',
      created_at: `gte.${today.toISOString()}`,
      order: 'created_at.desc',
    }),
  ]);

  const profileById = new Map(profiles.map(profile => [profile.id, profile]));
  const verificadores: Verificador[] = memberships
    .map(membership => {
      const profile = profileById.get(membership.profile_id);
      if (!profile) return null;
      return {
        id: membership.profile_id,
        nombre: profile.full_name || (membership.profile_id === session.profileId ? session.nombre || 'Acredita' : 'Usuario Acredita'),
        email: membership.profile_id === session.profileId ? session.email : '',
        rol: membership.role === 'supervisor' ? 'supervisor' : 'verificador',
        estado: membership.is_active && profile.is_active ? 'online' : 'offline',
        activo: membership.is_active && profile.is_active,
      } satisfies Verificador;
    })
    .filter((item): item is Verificador => Boolean(item));

  const snapshot: ReviewOperationsSnapshot = {
    verificadores,
    currentReviewerId: session.profileId,
    claims: claims.map(claim => ({
      documentoKey: claim.document_key,
      verificadorId: claim.claimed_by,
      claimedAt: new Date(claim.claimed_at).getTime(),
    })),
    actividad: activity.map(item => ({
      id: item.id,
      verificadorId: item.reviewer_id,
      documentoKey: item.document_key,
      accion: item.action,
      fecha: item.created_at,
    })),
  };

  writeReviewCache(snapshot);
  return snapshot;
}

export async function prepareReviewOperationsForSession(session: SupabaseUserSession): Promise<void> {
  if (session.role !== 'admin') return;
  await refreshReviewOperationsCache(session);
}

export async function claimDocumentReview(
  context: DocumentStorageContext,
  documentKey: string,
): Promise<ClaimRevision> {
  const session = await requireAdminSession();
  const latest = await resolveLatestVersion(session._supabase.accessToken, context);
  if (latest.workflow_status !== 'revision') throw new Error('La versión ya no está disponible para revisión.');

  const result = await rpc<ClaimRpcResult>('claim_document_review', session._supabase.accessToken, {
    p_document_key: documentKey,
    p_document_version_id: latest.id,
  });

  await refreshReviewOperationsCache(session);
  if (!result.owned) throw new Error('Otro verificador tomó este documento antes que tú. La cola fue actualizada.');

  return {
    documentoKey: result.document_key,
    verificadorId: result.claimed_by,
    claimedAt: new Date(result.claimed_at).getTime(),
  };
}

export async function releaseDocumentReview(documentKey: string): Promise<void> {
  const session = await requireAdminSession();
  await rpc<boolean>('release_document_review', session._supabase.accessToken, {
    p_document_key: documentKey,
  });
  await refreshReviewOperationsCache(session);
}

export async function reviewDocument(
  context: DocumentStorageContext,
  decision: ReviewDecisionInput,
): Promise<{ status: 'aprobado' | 'rechazado'; reviewedAt: string }> {
  const session = await requireAdminSession();
  const latest = await resolveLatestVersion(session._supabase.accessToken, context);
  if (latest.workflow_status !== 'revision') throw new Error('La versión más reciente ya no está en revisión.');

  const result = await rpc<ReviewRpcResult>('review_document_version', session._supabase.accessToken, {
    p_document_version_id: latest.id,
    p_action: decision.action,
    p_reason: decision.reason?.trim() || null,
    p_explanation: decision.explanation?.trim() || null,
    p_solution: decision.solution?.trim() || null,
    p_reviewer_name: decision.reviewerName?.trim() || session.nombre || session.email,
  });

  await Promise.all([
    hydrateOperationalDataFromSupabase(session),
    refreshReviewOperationsCache(session),
  ]);

  return { status: result.status, reviewedAt: result.reviewed_at };
}
