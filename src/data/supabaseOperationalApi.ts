import type {
  AsignacionTrabajador,
  CierreDocumental,
  ObligacionDocumental,
  Trabajador,
} from '../types';

const SUPABASE_URL = ((import.meta as any).env?.VITE_SUPABASE_URL as string | undefined)
  || 'https://jwlscxbmttpicwljozwf.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = ((import.meta as any).env?.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined)
  || 'sb_publishable_27fQcRn8vsWGpzjjE-XIAQ_0Du8m0UP';

export type BackendProject = { id: string; name: string; integration_key: string | null };
export type BackendContractor = { id: string; integration_key: string | null };
export type BackendAccreditation = { id: string; project_id: string; contratista_id: string; is_active: boolean };
export type BackendRequirement = {
  id: string;
  project_id: string;
  integration_key: string | null;
  name: string;
  category: string | null;
  target: 'empresa' | 'trabajador';
  alert_days: number;
  is_active: boolean;
};
export type BackendWorker = {
  id: string;
  contratista_id: string;
  rut: string;
  full_name: string;
  job_title: string | null;
  contract_type: Trabajador['tipoContrato'] | null;
  contract_start_date: string | null;
  contract_end_date: string | null;
  contract_work_or_task: string | null;
  special_labor_regime: Trabajador['regimenEspecial'] | null;
  special_labor_regime_detail: string | null;
  is_active: boolean;
};
export type BackendAssignment = {
  id: string;
  accreditation_id: string;
  worker_id: string;
  is_active: boolean;
  service_id: string | null;
  job_title: string | null;
  categories: string[] | null;
  assignment_status: AsignacionTrabajador['estado'];
  access_status: AsignacionTrabajador['estadoAcceso'];
  assigned_at: string | null;
  unassigned_at: string | null;
  contract_type_snapshot: Trabajador['tipoContrato'] | null;
  contract_start_date_snapshot: string | null;
  contract_end_date_snapshot: string | null;
  contract_work_or_task_snapshot: string | null;
  special_labor_regime_snapshot: Trabajador['regimenEspecial'] | null;
  special_labor_regime_detail_snapshot: string | null;
};
export type BackendDocument = {
  id: string;
  accreditation_id: string;
  requirement_id: string;
  worker_id: string | null;
  obligation_id: string | null;
};
export type BackendService = {
  id: string;
  accreditation_id: string;
  integration_key: string | null;
};
export type BackendObligation = {
  obligation_id: string;
  accreditation_id: string;
  service_id: string | null;
  worker_assignment_id: string | null;
  requirement_id: string;
  period_start: string;
  period_end: string;
  due_date: string;
  is_active: boolean;
  effective_status: ObligacionDocumental['estado'];
  version_number: number | null;
};
export type BackendClosure = {
  id: string;
  project_id: string;
  period_start: string;
  period_end: string;
  upload_deadline: string | null;
  status: CierreDocumental['estado'];
  closed_at: string | null;
  snapshot: Record<string, unknown> | null;
};
export type BackendVersion = {
  id: string;
  document_id: string;
  version_number: number;
  workflow_status: 'pendiente' | 'revision' | 'aprobado' | 'rechazado' | 'reemplazado';
  issued_at: string | null;
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

export type BackendRows = {
  projects: BackendProject[];
  contractors: BackendContractor[];
  accreditations: BackendAccreditation[];
  requirements: BackendRequirement[];
  workers: BackendWorker[];
  assignments: BackendAssignment[];
  documents: BackendDocument[];
  versions: BackendVersion[];
  services: BackendService[];
  obligations: BackendObligation[];
  closures: BackendClosure[];
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

export async function selectRows<T>(table: string, token: string, select: string): Promise<T[]> {
  const url = new URL(`${SUPABASE_URL}/rest/v1/${table}`);
  url.searchParams.set('select', select);
  const response = await fetch(url.toString(), { headers: headers(token, { Accept: 'application/json' }) });
  return parseResponse<T[]>(response);
}

export async function insertRows(
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

export async function insertReturning<T>(table: string, token: string, row: Record<string, unknown>): Promise<T> {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: headers(token, { Prefer: 'return=representation' }),
    body: JSON.stringify(row),
  });
  const rows = await parseResponse<T[]>(response);
  if (!rows[0]) throw new Error(`Supabase no devolvió la fila creada en ${table}`);
  return rows[0];
}

export async function patchRows(table: string, token: string, filters: Record<string, string>, body: Record<string, unknown>): Promise<void> {
  const url = new URL(`${SUPABASE_URL}/rest/v1/${table}`);
  Object.entries(filters).forEach(([key, value]) => url.searchParams.set(key, value));
  const response = await fetch(url.toString(), {
    method: 'PATCH',
    headers: headers(token, { Prefer: 'return=minimal' }),
    body: JSON.stringify(body),
  });
  await parseResponse<void>(response);
}

export async function fetchOperationalRows(token: string): Promise<BackendRows> {
  const [projects, contractors, accreditations, requirements, workers, assignments, documents, versions, services, obligations, closures] = await Promise.all([
    selectRows<BackendProject>('projects', token, 'id,name,integration_key'),
    selectRows<BackendContractor>('contratistas', token, 'id,integration_key'),
    selectRows<BackendAccreditation>('accreditations', token, 'id,project_id,contratista_id,is_active'),
    selectRows<BackendRequirement>('requirements', token, 'id,project_id,integration_key,name,category,target,alert_days,is_active'),
    selectRows<BackendWorker>('workers', token, 'id,contratista_id,rut,full_name,job_title,contract_type,contract_start_date,contract_end_date,contract_work_or_task,special_labor_regime,special_labor_regime_detail,is_active'),
    selectRows<BackendAssignment>('worker_assignments', token, 'id,accreditation_id,worker_id,is_active,service_id,job_title,categories,assignment_status,access_status,assigned_at,unassigned_at,contract_type_snapshot,contract_start_date_snapshot,contract_end_date_snapshot,contract_work_or_task_snapshot,special_labor_regime_snapshot,special_labor_regime_detail_snapshot'),
    selectRows<BackendDocument>('documents', token, 'id,accreditation_id,requirement_id,worker_id,obligation_id'),
    selectRows<BackendVersion>('document_versions', token, 'id,document_id,version_number,workflow_status,issued_at,expires_at,uploaded_at,reviewed_at,rejection_reason,rejection_explanation,rejection_solution,storage_bucket,storage_path,original_filename,metadata'),
    selectRows<BackendService>('services', token, 'id,accreditation_id,integration_key'),
    selectRows<BackendObligation>('obligation_statuses', token, 'obligation_id,accreditation_id,service_id,worker_assignment_id,requirement_id,period_start,period_end,due_date,is_active,effective_status,version_number'),
    selectRows<BackendClosure>('compliance_periods', token, 'id,project_id,period_start,period_end,upload_deadline,status,closed_at,snapshot'),
  ]);
  return { projects, contractors, accreditations, requirements, workers, assignments, documents, versions, services, obligations, closures };
}
