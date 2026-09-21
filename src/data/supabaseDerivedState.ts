import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL, type SupabaseUserSession } from './supabaseAuth';

type BackendAccreditationStatus = {
  accreditation_id: string;
  project_id?: string;
  contratista_id?: string;
  status: 'no_acreditado' | 'en_proceso' | 'aprobado' | 'vencido_bloqueado';
  compliance_percent: number | string;
  access_allowed: boolean;
  payment_allowed: boolean;
  near_expiry_count?: number;
  access_blocked_count?: number;
  access_pending_count?: number;
  payment_blocked_count?: number;
  payment_pending_count?: number;
  pending_required?: number;
  rejected_required?: number;
  expired_required?: number;
  near_expiry_required?: number;
};

type BackendWorkerStatus = {
  accreditation_id: string;
  project_id?: string;
  contratista_id?: string;
  worker_id: string;
  worker_rut?: string;
  status: 'no_acreditado' | 'en_proceso' | 'aprobado' | 'vencido_bloqueado';
  required_count?: number;
  submitted_count?: number;
  satisfied_count?: number;
  pending_count?: number;
  blocked_count?: number;
  near_expiry_count?: number;
  compliance_percent?: number | string;
  total_required?: number;
  approved_required?: number;
  pending_required?: number;
  rejected_required?: number;
  expired_required?: number;
  near_expiry_required?: number;
};

type BackendProject = { id: string; integration_key: string | null };
type BackendContractor = { id: string; integration_key: string | null };
type BackendAccreditationContext = { id: string; project_id: string; contratista_id: string };
type BackendWorkerIdentity = { id: string; contratista_id: string; rut: string };

export type DerivedAccreditationState = {
  status: BackendAccreditationStatus['status'];
  compliancePercent: number;
  accessAllowed: boolean;
  paymentAllowed: boolean;
  nearExpiryCount: number;
  accessBlockedCount: number;
  accessPendingCount: number;
  paymentBlockedCount: number;
  paymentPendingCount: number;
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

let runtimeCache: DerivedStateCache | null = null;

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
  return runtimeCache;
}

export function clearDerivedStateCache(): void {
  runtimeCache = null;
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
  const [projects, contractors, accreditationContexts, workerIdentities, accreditationRows, workerRows] = await Promise.all([
    selectRows<BackendProject>('projects', token, 'id,integration_key'),
    selectRows<BackendContractor>('contratistas', token, 'id,integration_key'),
    selectRows<BackendAccreditationContext>('accreditations', token, 'id,project_id,contratista_id'),
    selectRows<BackendWorkerIdentity>('workers', token, 'id,contratista_id,rut'),
    selectRows<BackendAccreditationStatus>(
      'accreditation_statuses',
      token,
      'accreditation_id,project_id,contratista_id,status,compliance_percent,access_allowed,payment_allowed,near_expiry_count,access_blocked_count,access_pending_count,payment_blocked_count,payment_pending_count',
    ),
    selectRows<BackendWorkerStatus>(
      'worker_accreditation_statuses',
      token,
      'accreditation_id,project_id,contratista_id,worker_id,worker_rut,status,required_count,submitted_count,satisfied_count,pending_count,blocked_count,near_expiry_count,compliance_percent',
    ),
  ]);

  const projectKey = new Map(projects.filter(p => p.integration_key).map(p => [p.id, p.integration_key as string]));
  const contractorKey = new Map(contractors.filter(c => c.integration_key).map(c => [c.id, c.integration_key as string]));
  const accreditationContextById = new Map(accreditationContexts.map(row => [row.id, row]));
  const workerIdentityById = new Map(workerIdentities.map(row => [row.id, row]));
  const accreditations: DerivedStateCache['accreditations'] = {};
  const workers: DerivedStateCache['workers'] = {};

  for (const row of accreditationRows) {
    const context = accreditationContextById.get(row.accreditation_id);
    const projectId = row.project_id || context?.project_id;
    const contractorId = row.contratista_id || context?.contratista_id;
    const pKey = projectId ? projectKey.get(projectId) : undefined;
    const cKey = contractorId ? contractorKey.get(contractorId) : undefined;
    if (!pKey || !cKey) continue;

    const genericBlocked = Number(row.rejected_required || 0) + Number(row.expired_required || 0);
    const accessBlockedCount = row.access_blocked_count ?? (!row.access_allowed && row.status === 'vencido_bloqueado' ? genericBlocked : 0);
    const paymentBlockedCount = row.payment_blocked_count ?? (!row.payment_allowed && row.status === 'vencido_bloqueado' ? genericBlocked : 0);
    const genericPending = Number(row.pending_required || 0);

    accreditations[`${cKey}:${pKey}`] = {
      status: row.status,
      compliancePercent: Number(row.compliance_percent || 0),
      accessAllowed: Boolean(row.access_allowed),
      paymentAllowed: Boolean(row.payment_allowed),
      nearExpiryCount: Number(row.near_expiry_count ?? row.near_expiry_required ?? 0),
      accessBlockedCount: Number(accessBlockedCount || 0),
      accessPendingCount: Number(row.access_pending_count ?? (!row.access_allowed && !accessBlockedCount ? genericPending || 1 : 0)),
      paymentBlockedCount: Number(paymentBlockedCount || 0),
      paymentPendingCount: Number(row.payment_pending_count ?? (!row.payment_allowed && !paymentBlockedCount ? genericPending || 1 : 0)),
    };
  }

  for (const row of workerRows) {
    const context = accreditationContextById.get(row.accreditation_id);
    const identity = workerIdentityById.get(row.worker_id);
    const projectId = row.project_id || context?.project_id;
    const contractorId = row.contratista_id || context?.contratista_id || identity?.contratista_id;
    const workerRut = row.worker_rut || identity?.rut || '';
    const pKey = projectId ? projectKey.get(projectId) : undefined;
    const cKey = contractorId ? contractorKey.get(contractorId) : undefined;
    if (!pKey || !cKey || !workerRut) continue;

    const requiredCount = Number(row.required_count ?? row.total_required ?? 0);
    const satisfiedCount = Number(row.satisfied_count ?? row.approved_required ?? 0);
    const blockedCount = Number(
      row.blocked_count
      ?? (Number(row.rejected_required || 0) + Number(row.expired_required || 0))
    );
    const compliancePercent = row.compliance_percent != null
      ? Number(row.compliance_percent)
      : requiredCount > 0
        ? Math.round((satisfiedCount * 1000) / requiredCount) / 10
        : 0;

    workers[`${cKey}:${pKey}:${normalizeRut(workerRut)}`] = {
      status: row.status,
      requiredCount,
      submittedCount: Number(row.submitted_count ?? 0),
      satisfiedCount,
      pendingCount: Number(row.pending_count ?? row.pending_required ?? 0),
      blockedCount,
      nearExpiryCount: Number(row.near_expiry_count ?? row.near_expiry_required ?? 0),
      compliancePercent,
    };
  }

  const cache: DerivedStateCache = {
    profileId: session.profileId,
    updatedAt: new Date().toISOString(),
    accreditations,
    workers,
  };
  runtimeCache = cache;
}

export function backendAccreditationLabel(state: DerivedAccreditationState): 'No acreditado' | 'En proceso' | 'Aprobado' | 'Vencido/Bloqueado' {
  if (state.status === 'aprobado') return 'Aprobado';
  if (state.status === 'vencido_bloqueado') return 'Vencido/Bloqueado';
  if (state.status === 'en_proceso') return 'En proceso';
  return 'No acreditado';
}
