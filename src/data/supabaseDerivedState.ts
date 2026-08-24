import type { SupabaseUserSession } from './supabaseAuth';

const SUPABASE_URL = ((import.meta as any).env?.VITE_SUPABASE_URL as string | undefined)
  || 'https://jwlscxbmttpicwljozwf.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = ((import.meta as any).env?.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined)
  || 'sb_publishable_27fQcRn8vsWGpzjjE-XIAQ_0Du8m0UP';
const CACHE_KEY = 'acredita_backend_derived_state_v1';

type BackendAccreditationStatus = {
  accreditation_id: string;
  project_id: string;
  contratista_id: string;
  status: 'no_acreditado' | 'en_proceso' | 'aprobado' | 'vencido_bloqueado';
  compliance_percent: number | string;
  access_allowed: boolean;
  payment_allowed: boolean;
  near_expiry_count: number;
};

type BackendWorkerStatus = {
  accreditation_id: string;
  project_id: string;
  contratista_id: string;
  worker_id: string;
  worker_rut: string;
  status: 'no_acreditado' | 'en_proceso' | 'aprobado' | 'vencido_bloqueado';
  required_count: number;
  submitted_count: number;
  satisfied_count: number;
  pending_count: number;
  blocked_count: number;
  near_expiry_count: number;
  compliance_percent: number | string;
};

type BackendProject = { id: string; integration_key: string | null };
type BackendContractor = { id: string; integration_key: string | null };

export type DerivedAccreditationState = {
  status: BackendAccreditationStatus['status'];
  compliancePercent: number;
  accessAllowed: boolean;
  paymentAllowed: boolean;
  nearExpiryCount: number;
};

export type DerivedWorkerState = {
  status: BackendWorkerStatus['status'];
  requiredCount: number;
  submittedCount: number;
  satisfiedCount: number;
  pendingCount: number;
  blockedCount: number;
  nearExpiryCount: number;
  compliancePercent: number;
};

type DerivedStateCache = {
  profileId: string;
  updatedAt: string;
  accreditations: Record<string, DerivedAccreditationState>;
  workers: Record<string, DerivedWorkerState>;
};

function normalizeRut(value: string): string {
  return (value || '').replace(/[^0-9kK]/g, '').toUpperCase();
}

function headers(token: string): HeadersInit {
  return {
    apikey: SUPABASE_PUBLISHABLE_KEY,
    Authorization: `Bearer ${token}`,
    Accept: 'application/json',
  };
}

async function selectRows<T>(table: string, token: string, select: string): Promise<T[]> {
  const url = new URL(`${SUPABASE_URL}/rest/v1/${table}`);
  url.searchParams.set('select', select);
  const response = await fetch(url.toString(), { headers: headers(token) });
  const payload = await response.json().catch(() => ([]));
  if (!response.ok) {
    const message = payload?.message || payload?.hint || `No fue posible leer ${table}`;
    throw new Error(message);
  }
  return payload as T[];
}

function readCache(): DerivedStateCache | null {
  if (typeof window === 'undefined') return null;
  try {
    const parsed = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
    return parsed && typeof parsed === 'object' ? parsed as DerivedStateCache : null;
  } catch {
    return null;
  }
}

export function clearDerivedStateCache(): void {
  if (typeof window !== 'undefined') localStorage.removeItem(CACHE_KEY);
}

export function getBackendAccreditationState(
  contratistaId: string,
  proyectoId: string,
): DerivedAccreditationState | null {
  const cache = readCache();
  return cache?.accreditations?.[`${contratistaId}:${proyectoId}`] || null;
}

export function getBackendWorkerState(
  contratistaId: string,
  proyectoId: string,
  trabajadorRut: string,
): DerivedWorkerState | null {
  const cache = readCache();
  return cache?.workers?.[`${contratistaId}:${proyectoId}:${normalizeRut(trabajadorRut)}`] || null;
}

export function getBackendWorkerStateForProject(
  proyectoId: string,
  trabajadorRut: string,
): DerivedWorkerState | null {
  const cache = readCache();
  if (!cache) return null;
  const suffix = `:${proyectoId}:${normalizeRut(trabajadorRut)}`;
  const matches = Object.entries(cache.workers || {}).filter(([key]) => key.endsWith(suffix));
  return matches.length === 1 ? matches[0][1] : null;
}

export async function refreshDerivedStateCache(session: SupabaseUserSession): Promise<void> {
  if (typeof window === 'undefined') return;
  const token = session._supabase.accessToken;
  const [projects, contractors, accreditationRows, workerRows] = await Promise.all([
    selectRows<BackendProject>('projects', token, 'id,integration_key'),
    selectRows<BackendContractor>('contratistas', token, 'id,integration_key'),
    selectRows<BackendAccreditationStatus>(
      'accreditation_statuses',
      token,
      'accreditation_id,project_id,contratista_id,status,compliance_percent,access_allowed,payment_allowed,near_expiry_count',
    ),
    selectRows<BackendWorkerStatus>(
      'worker_accreditation_statuses',
      token,
      'accreditation_id,project_id,contratista_id,worker_id,worker_rut,status,required_count,submitted_count,satisfied_count,pending_count,blocked_count,near_expiry_count,compliance_percent',
    ),
  ]);

  const projectKey = new Map(projects.filter(p => p.integration_key).map(p => [p.id, p.integration_key as string]));
  const contractorKey = new Map(contractors.filter(c => c.integration_key).map(c => [c.id, c.integration_key as string]));
  const accreditations: DerivedStateCache['accreditations'] = {};
  const workers: DerivedStateCache['workers'] = {};

  for (const row of accreditationRows) {
    const pKey = projectKey.get(row.project_id);
    const cKey = contractorKey.get(row.contratista_id);
    if (!pKey || !cKey) continue;
    accreditations[`${cKey}:${pKey}`] = {
      status: row.status,
      compliancePercent: Number(row.compliance_percent || 0),
      accessAllowed: Boolean(row.access_allowed),
      paymentAllowed: Boolean(row.payment_allowed),
      nearExpiryCount: Number(row.near_expiry_count || 0),
    };
  }

  for (const row of workerRows) {
    const pKey = projectKey.get(row.project_id);
    const cKey = contractorKey.get(row.contratista_id);
    if (!pKey || !cKey) continue;
    workers[`${cKey}:${pKey}:${normalizeRut(row.worker_rut)}`] = {
      status: row.status,
      requiredCount: Number(row.required_count || 0),
      submittedCount: Number(row.submitted_count || 0),
      satisfiedCount: Number(row.satisfied_count || 0),
      pendingCount: Number(row.pending_count || 0),
      blockedCount: Number(row.blocked_count || 0),
      nearExpiryCount: Number(row.near_expiry_count || 0),
      compliancePercent: Number(row.compliance_percent || 0),
    };
  }

  const cache: DerivedStateCache = {
    profileId: session.profileId,
    updatedAt: new Date().toISOString(),
    accreditations,
    workers,
  };
  localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
}

export function backendAccreditationLabel(state: DerivedAccreditationState): 'No acreditado' | 'En proceso' | 'Aprobado' | 'Vencido/Bloqueado' {
  if (state.status === 'aprobado') return 'Aprobado';
  if (state.status === 'vencido_bloqueado') return 'Vencido/Bloqueado';
  if (state.status === 'en_proceso') return 'En proceso';
  return 'No acreditado';
}
