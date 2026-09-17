import { restoreSupabaseSession, SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from './supabaseAuth';

export type PrivacyRequestStatus = 'received' | 'identity_verification' | 'in_review' | 'blocked' | 'resolved' | 'rejected' | 'withdrawn';
export type PrivacyIdentityStatus = 'pending' | 'verified' | 'rejected';
export type IncidentSeverity = 'S1' | 'S2' | 'S3' | 'S4';
export type IncidentStatus = 'detected' | 'investigating' | 'contained' | 'resolved' | 'closed';
export type RetentionAction = 'delete' | 'anonymize' | 'review_hold';
export type LegalReviewStatus = 'draft' | 'approved' | 'rejected';

export interface PrivacyRequestRow {
  id: string;
  request_type: 'access' | 'rectification' | 'deletion' | 'opposition' | 'portability' | 'blocking';
  requester_profile_id: string | null;
  requester_name: string;
  requester_email: string;
  contact_channel: string;
  scope: string;
  details: string | null;
  source: string;
  status: PrivacyRequestStatus;
  identity_status: PrivacyIdentityStatus;
  temporary_block_requested: boolean;
  temporary_block_status: 'not_requested' | 'pending' | 'accepted' | 'rejected' | 'released';
  assigned_to: string | null;
  acknowledged_at: string | null;
  received_at: string;
  due_at: string | null;
  response_sent_at: string | null;
  resolved_at: string | null;
  resolution_summary: string | null;
  denial_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface SecurityIncidentRow {
  id: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  title: string;
  detected_at: string;
  estimated_started_at: string | null;
  affected_systems: string[];
  data_categories: string[];
  affected_subjects_estimate: number | null;
  risk_assessment: string | null;
  notification_decision: string | null;
  agency_notified_at: string | null;
  subjects_notified_at: string | null;
  containment_summary: string | null;
  remediation_summary: string | null;
  owner_profile_id: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface RetentionPolicyRow {
  id: string;
  data_category: string;
  purpose: string;
  trigger_event: string;
  retention_days: number | null;
  final_action: RetentionAction;
  legal_basis_notes: string | null;
  legal_review_status: LegalReviewStatus;
  active: boolean;
  dry_run_required: boolean;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface LegalHoldRow {
  id: string;
  scope_type: 'profile' | 'worker' | 'project' | 'accreditation' | 'document' | 'document_version' | 'contractor' | 'other';
  scope_id: string;
  reason: string;
  active: boolean;
  released_at: string | null;
  created_by: string;
  released_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface PrivacyAdminSnapshot {
  requests: PrivacyRequestRow[];
  incidents: SecurityIncidentRow[];
  retentionPolicies: RetentionPolicyRow[];
  legalHolds: LegalHoldRow[];
}

function authHeaders(token: string, prefer?: string): HeadersInit {
  return {
    apikey: SUPABASE_PUBLISHABLE_KEY,
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...(prefer ? { Prefer: prefer } : {}),
  };
}

async function tokenAndProfile() {
  const session = await restoreSupabaseSession();
  if (!session) throw new Error('La sesión de Acredita expiró. Vuelve a iniciar sesión.');
  return { token: session._supabase.accessToken, profileId: session.profileId };
}

async function readRows<T>(table: string, token: string, order = 'created_at.desc'): Promise<T[]> {
  const url = new URL(`${SUPABASE_URL}/rest/v1/${table}`);
  url.searchParams.set('select', '*');
  url.searchParams.set('order', order);
  url.searchParams.set('limit', '500');
  const response = await fetch(url.toString(), { headers: authHeaders(token) });
  const payload = await response.json().catch(() => ([]));
  if (!response.ok) throw new Error(payload?.message || payload?.hint || `No fue posible leer ${table}.`);
  return payload as T[];
}

async function insertRow<T>(table: string, body: Record<string, unknown>): Promise<T> {
  const { token } = await tokenAndProfile();
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: authHeaders(token, 'return=representation'),
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ([]));
  if (!response.ok) throw new Error(payload?.message || payload?.hint || `No fue posible crear ${table}.`);
  return (payload as T[])[0];
}

async function patchRow<T>(table: string, id: string, body: Record<string, unknown>): Promise<T> {
  const { token } = await tokenAndProfile();
  const url = new URL(`${SUPABASE_URL}/rest/v1/${table}`);
  url.searchParams.set('id', `eq.${id}`);
  const response = await fetch(url.toString(), {
    method: 'PATCH',
    headers: authHeaders(token, 'return=representation'),
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ([]));
  if (!response.ok) throw new Error(payload?.message || payload?.hint || `No fue posible actualizar ${table}.`);
  return (payload as T[])[0];
}

export async function loadPrivacyAdminSnapshot(): Promise<PrivacyAdminSnapshot> {
  const { token } = await tokenAndProfile();
  const [requests, incidents, retentionPolicies, legalHolds] = await Promise.all([
    readRows<PrivacyRequestRow>('privacy_requests', token, 'received_at.desc'),
    readRows<SecurityIncidentRow>('security_incidents', token, 'detected_at.desc'),
    readRows<RetentionPolicyRow>('retention_policies', token, 'updated_at.desc'),
    readRows<LegalHoldRow>('legal_holds', token, 'created_at.desc'),
  ]);
  return { requests, incidents, retentionPolicies, legalHolds };
}

export function updatePrivacyRequest(id: string, patch: Partial<Pick<PrivacyRequestRow,
  'status' | 'identity_status' | 'temporary_block_status' | 'assigned_to' | 'acknowledged_at' | 'due_at' |
  'response_sent_at' | 'resolved_at' | 'resolution_summary' | 'denial_reason'
>>) {
  return patchRow<PrivacyRequestRow>('privacy_requests', id, patch as Record<string, unknown>);
}

export function createSecurityIncident(input: {
  severity: IncidentSeverity;
  title: string;
  affectedSystems?: string[];
  dataCategories?: string[];
  affectedSubjectsEstimate?: number | null;
}) {
  return insertRow<SecurityIncidentRow>('security_incidents', {
    severity: input.severity,
    title: input.title.trim(),
    affected_systems: input.affectedSystems || [],
    data_categories: input.dataCategories || [],
    affected_subjects_estimate: input.affectedSubjectsEstimate ?? null,
  });
}

export function updateSecurityIncident(id: string, patch: Partial<Pick<SecurityIncidentRow,
  'severity' | 'status' | 'title' | 'estimated_started_at' | 'affected_systems' | 'data_categories' |
  'affected_subjects_estimate' | 'risk_assessment' | 'notification_decision' | 'agency_notified_at' |
  'subjects_notified_at' | 'containment_summary' | 'remediation_summary' | 'owner_profile_id'
>>) {
  return patchRow<SecurityIncidentRow>('security_incidents', id, patch as Record<string, unknown>);
}

export function createRetentionPolicy(input: {
  dataCategory: string;
  purpose: string;
  triggerEvent: string;
  retentionDays: number | null;
  finalAction: RetentionAction;
  legalBasisNotes?: string;
}) {
  return insertRow<RetentionPolicyRow>('retention_policies', {
    data_category: input.dataCategory.trim(),
    purpose: input.purpose.trim(),
    trigger_event: input.triggerEvent.trim(),
    retention_days: input.retentionDays,
    final_action: input.finalAction,
    legal_basis_notes: input.legalBasisNotes?.trim() || null,
    legal_review_status: 'draft',
    active: false,
    dry_run_required: true,
  });
}

export function updateRetentionPolicy(id: string, patch: Partial<Pick<RetentionPolicyRow,
  'purpose' | 'trigger_event' | 'retention_days' | 'final_action' | 'legal_basis_notes' |
  'legal_review_status' | 'active' | 'dry_run_required' | 'version'
>>) {
  return patchRow<RetentionPolicyRow>('retention_policies', id, patch as Record<string, unknown>);
}

export function createLegalHold(input: { scopeType: LegalHoldRow['scope_type']; scopeId: string; reason: string }) {
  return insertRow<LegalHoldRow>('legal_holds', {
    scope_type: input.scopeType,
    scope_id: input.scopeId,
    reason: input.reason.trim(),
  });
}

export async function releaseLegalHold(id: string) {
  const { profileId } = await tokenAndProfile();
  return patchRow<LegalHoldRow>('legal_holds', id, {
    active: false,
    released_at: new Date().toISOString(),
    released_by: profileId,
  });
}

async function selectFiltered<T>(table: string, filters: Array<[string, string]>, select = '*'): Promise<T[]> {
  const { token } = await tokenAndProfile();
  const url = new URL(`${SUPABASE_URL}/rest/v1/${table}`);
  url.searchParams.set('select', select);
  filters.forEach(([key, value]) => url.searchParams.set(key, value));
  const response = await fetch(url.toString(), { headers: authHeaders(token) });
  const payload = await response.json().catch(() => ([]));
  if (!response.ok) throw new Error(payload?.message || payload?.hint || `No fue posible consultar ${table}.`);
  return payload as T[];
}

export async function buildWorkerPortabilityExport(identifier: string) {
  const query = identifier.trim();
  if (!query) throw new Error('Ingresa el UUID o RUT del trabajador.');
  const uuidLike = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(query);
  const workers = await selectFiltered<any>('workers', [[uuidLike ? 'id' : 'rut', `eq.${query}`]]);
  const worker = workers[0];
  if (!worker) throw new Error('No encontramos un trabajador con ese identificador.');

  const [assignments, documents] = await Promise.all([
    selectFiltered<any>('worker_assignments', [['worker_id', `eq.${worker.id}`]]),
    selectFiltered<any>('documents', [['worker_id', `eq.${worker.id}`]]),
  ]);
  const documentIds = documents.map((row: any) => row.id).filter(Boolean);
  let versions: any[] = [];
  if (documentIds.length > 0) {
    versions = await selectFiltered<any>('document_versions', [['document_id', `in.(${documentIds.join(',')})`]], 'id,document_id,version_number,workflow_status,issued_at,expires_at,uploaded_at,reviewed_at,rejection_reason,original_filename,mime_type,size_bytes,created_at');
  }

  return {
    export_format: 'Acredita privacy portability JSON v1',
    generated_at: new Date().toISOString(),
    subject: worker,
    worker_assignments: assignments,
    documents,
    document_versions: versions,
    notes: [
      'La exportación contiene datos estructurados y metadatos disponibles en Acredita.',
      'No incorpora los binarios de documentos almacenados en Storage.',
      'La entrega al titular requiere verificación previa de identidad y revisión humana.',
    ],
  };
}

export function downloadJsonFile(filename: string, value: unknown) {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
