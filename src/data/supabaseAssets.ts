import { getSupabaseSessionForRequest, SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from './supabaseAuth';

export type AssetType = 'vehiculo' | 'maquinaria' | 'equipo';
export type AssetStatus = 'pendiente' | 'en_revision' | 'habilitado' | 'bloqueado' | 'inactivo';
export type AssetDocumentStatus = 'pendiente' | 'en_revision' | 'aprobado' | 'rechazado' | 'vencido';

export interface OperationalAsset {
  id: string;
  integrationKey?: string;
  projectKey: string;
  contractorKey: string;
  serviceKey?: string;
  accreditationId: string;
  serviceId?: string;
  type: AssetType;
  identifier: string;
  name: string;
  brand?: string;
  model?: string;
  year?: number;
  ownerName?: string;
  operatorName?: string;
  status: AssetStatus;
  accessAllowed: boolean;
  notes?: string;
  active: boolean;
  retiredAt?: string;
  retirementReason?: string;
  totalDocuments: number;
  approvedDocuments: number;
  blockingDocuments: number;
  nextExpiry?: string;
}

export interface AssetDocument {
  id: string;
  assetId: string;
  type: string;
  name?: string;
  storageBucket?: string;
  storagePath?: string;
  status: AssetDocumentStatus;
  issuedAt?: string;
  expiresAt?: string;
  rejectionReason?: string;
}

export interface AssetRequirementTemplate {
  id: string;
  type: AssetType;
  documentType: string;
  validityDays?: number;
  blocksAccess: boolean;
  required: boolean;
  checklist: string[];
  active: boolean;
  retiredAt?: string;
  retirementReason?: string;
}

export interface AssetRequirementStatus extends Omit<AssetRequirementTemplate, 'active' | 'retiredAt' | 'retirementReason'> {
  assetId: string;
  documentId?: string;
  documentName?: string;
  issuedAt?: string;
  expiresAt?: string;
  rejectionReason?: string;
  status: AssetDocumentStatus;
  satisfied: boolean;
}

export interface AssetInspection {
  id: string;
  assetId: string;
  inspectionDate: string;
  result: 'aprobado' | 'observado' | 'rechazado';
  checklist: unknown[];
  observations?: string;
  nextInspectionDate?: string;
}

export interface AssetMaintenanceRecord {
  id: string;
  assetId: string;
  type: string;
  performedAt: string;
  nextDueAt?: string;
  provider?: string;
  notes?: string;
}

export interface AssetOperatorCandidate {
  workerAssignmentId: string;
  contractorKey: string;
  workerId: string;
  fullName: string;
  rut: string;
  jobTitle?: string;
  accessStatus: string;
}

export interface AssetOperatorAssignment {
  id: string;
  workerAssignmentId: string;
  fullName: string;
  rut: string;
  jobTitle?: string;
  validFrom: string;
  validUntil?: string;
  status: 'activo' | 'suspendido' | 'finalizado';
}

export interface LibraryDocument {
  id: string;
  contractorId: string;
  type: string;
  name: string;
  issuedAt?: string;
  expiresAt?: string;
  status: 'vigente' | 'vencido' | 'revocado';
  storageBucket: string;
  storagePath: string;
  mimeType: string;
  fileSize: number;
}

export interface LinkableObligation {
  id: string;
  requirementId: string;
  requirementName: string;
  target: 'empresa' | 'trabajador';
  periodStart: string;
  periodEnd: string;
  status: string;
  workerAssignmentId?: string;
}

type RegistryRow = {
  id: string;
  integration_key: string | null;
  project_key: string;
  contractor_key: string;
  service_key: string | null;
  accreditation_id: string;
  service_id: string | null;
  asset_type: AssetType;
  identifier: string;
  name: string;
  brand: string | null;
  model: string | null;
  year: number | null;
  owner_name: string | null;
  operator_name: string | null;
  status: AssetStatus;
  access_allowed: boolean;
  notes: string | null;
  is_active: boolean;
  retired_at: string | null;
  retirement_reason: string | null;
  total_documents: number;
  approved_documents: number;
  blocking_documents: number;
  next_expiry: string | null;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const session = await getSupabaseSessionForRequest();
  if (!session) throw new Error('Tu sesión expiró. Inicia sesión nuevamente.');
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${session._supabase.accessToken}`,
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload?.message || payload?.hint || payload?.error_description || 'No fue posible completar la operación.');
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

async function resolveProjectId(projectKey: string): Promise<string> {
  const rows = await request<Array<{ id: string }>>(`projects?select=id&integration_key=eq.${encodeURIComponent(projectKey)}&limit=1`);
  if (!rows[0]) throw new Error('Proyecto no encontrado.');
  return rows[0].id;
}

async function resolveContractorId(contractorKey: string): Promise<string> {
  const rows = await request<Array<{ id: string }>>(`contratistas?select=id&integration_key=eq.${encodeURIComponent(contractorKey)}&limit=1`);
  if (!rows[0]) throw new Error('Contratista no encontrado.');
  return rows[0].id;
}

const mapRow = (row: RegistryRow): OperationalAsset => ({
  id: row.id,
  integrationKey: row.integration_key || undefined,
  projectKey: row.project_key,
  contractorKey: row.contractor_key,
  serviceKey: row.service_key || undefined,
  accreditationId: row.accreditation_id,
  serviceId: row.service_id || undefined,
  type: row.asset_type,
  identifier: row.identifier,
  name: row.name,
  brand: row.brand || undefined,
  model: row.model || undefined,
  year: row.year || undefined,
  ownerName: row.owner_name || undefined,
  operatorName: row.operator_name || undefined,
  status: row.status,
  accessAllowed: row.access_allowed,
  notes: row.notes || undefined,
  active: row.is_active,
  retiredAt: row.retired_at || undefined,
  retirementReason: row.retirement_reason || undefined,
  totalDocuments: row.total_documents || 0,
  approvedDocuments: row.approved_documents || 0,
  blockingDocuments: row.blocking_documents || 0,
  nextExpiry: row.next_expiry || undefined,
});

export async function listAssets(
  projectKey: string,
  contractorKey?: string,
  includeHistorical = false,
): Promise<OperationalAsset[]> {
  const filters = [`project_key=eq.${encodeURIComponent(projectKey)}`];
  if (!includeHistorical) filters.push('is_active=eq.true');
  if (contractorKey) filters.push(`contractor_key=eq.${encodeURIComponent(contractorKey)}`);
  const rows = await request<RegistryRow[]>(`asset_registry?select=*&${filters.join('&')}&order=is_active.desc,name.asc`);
  return rows.map(mapRow);
}

export async function resolveAccreditation(projectKey: string, contractorKey: string): Promise<string> {
  const projects = await request<Array<{ id: string }>>(`projects?select=id&integration_key=eq.${encodeURIComponent(projectKey)}&limit=1`);
  const contractors = await request<Array<{ id: string }>>(`contratistas?select=id&integration_key=eq.${encodeURIComponent(contractorKey)}&limit=1`);
  if (!projects[0] || !contractors[0]) throw new Error('No se encontró el proyecto o contratista.');
  const rows = await request<Array<{ id: string }>>(`accreditations?select=id&project_id=eq.${projects[0].id}&contratista_id=eq.${contractors[0].id}&is_active=eq.true&limit=1`);
  if (!rows[0]) throw new Error('El contratista no tiene acreditación activa en este proyecto.');
  return rows[0].id;
}

export interface SaveAssetInput {
  id?: string;
  projectKey: string;
  contractorKey: string;
  serviceKey?: string;
  type: AssetType;
  identifier: string;
  name: string;
  brand?: string;
  model?: string;
  year?: number;
  ownerName?: string;
  operatorName?: string;
  notes?: string;
}

export async function saveAsset(input: SaveAssetInput): Promise<void> {
  const accreditationId = await resolveAccreditation(input.projectKey, input.contractorKey);
  let serviceId: string | null = null;
  if (input.serviceKey) {
    const services = await request<Array<{ id: string }>>(`services?select=id&integration_key=eq.${encodeURIComponent(input.serviceKey)}&limit=1`);
    serviceId = services[0]?.id || null;
  }
  const editable = {
    accreditation_id: accreditationId,
    service_id: serviceId,
    asset_type: input.type,
    identifier: input.identifier.trim().toUpperCase(),
    name: input.name.trim(),
    brand: input.brand || null,
    model: input.model || null,
    year: input.year || null,
    owner_name: input.ownerName || null,
    operator_name: input.operatorName || null,
    notes: input.notes || null,
    is_active: true,
  };
  if (input.id) {
    await request<void>(`assets?id=eq.${input.id}`, {
      method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(editable),
    });
  } else {
    await request<void>('assets', {
      method: 'POST', headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ ...editable, integration_key: `asset_${crypto.randomUUID()}`, status: 'pendiente', access_allowed: false }),
    });
  }
}

export async function retireAsset(id: string, reason: string): Promise<void> {
  const cleanReason = reason.trim();
  if (cleanReason.length < 3) throw new Error('Indica un motivo de retiro válido.');
  await request<void>(`assets?id=eq.${id}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ is_active: false, retirement_reason: cleanReason }),
  });
}


export async function listAssetRequirementTemplates(projectKey: string): Promise<AssetRequirementTemplate[]> {
  const projectId = await resolveProjectId(projectKey);
  const rows = await request<Array<{
    id: string; asset_type: AssetType; document_type: string; validity_days: number | null;
    blocks_access: boolean; is_required: boolean; review_checklist: unknown;
    is_active: boolean; retired_at: string | null; retirement_reason: string | null;
  }>>(`asset_requirement_templates?select=*&project_id=eq.${projectId}&order=is_active.desc,asset_type.asc,document_type.asc`);
  return rows.map(row => ({
    id: row.id,
    type: row.asset_type,
    documentType: row.document_type,
    validityDays: row.validity_days || undefined,
    blocksAccess: row.blocks_access,
    required: row.is_required,
    checklist: Array.isArray(row.review_checklist) ? row.review_checklist.map(String) : [],
    active: row.is_active,
    retiredAt: row.retired_at || undefined,
    retirementReason: row.retirement_reason || undefined,
  }));
}

export async function saveAssetRequirementTemplate(
  projectKey: string,
  input: Omit<AssetRequirementTemplate, 'id' | 'active' | 'retiredAt' | 'retirementReason'> & { id?: string },
): Promise<void> {
  const projectId = await resolveProjectId(projectKey);
  const body = {
    project_id: projectId,
    asset_type: input.type,
    document_type: input.documentType.trim(),
    validity_days: input.validityDays || null,
    blocks_access: input.blocksAccess,
    is_required: input.required,
    review_checklist: input.checklist.filter(Boolean),
  };
  if (input.id) {
    await request<void>(`asset_requirement_templates?id=eq.${input.id}`, {
      method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(body),
    });
  } else {
    await request<void>('asset_requirement_templates', {
      method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(body),
    });
  }
}

export async function retireAssetRequirementTemplate(id: string, reason: string): Promise<void> {
  const cleanReason = reason.trim();
  if (cleanReason.length < 3) throw new Error('Indica un motivo de retiro válido.');
  await request<void>(`asset_requirement_templates?id=eq.${id}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ is_active: false, retirement_reason: cleanReason }),
  });
}

export async function listAssetRequirementStatuses(assetId: string): Promise<AssetRequirementStatus[]> {
  const rows = await request<Array<{
    asset_id: string; asset_type: AssetType; template_id: string; document_type: string; validity_days: number | null;
    blocks_access: boolean; is_required: boolean; review_checklist: unknown; document_id: string | null;
    document_name: string | null; issued_at: string | null; expires_at: string | null; rejection_reason: string | null;
    effective_status: AssetDocumentStatus; satisfied: boolean;
  }>>(`asset_requirement_statuses?select=*&asset_id=eq.${assetId}&order=document_type.asc`);
  return rows.map(row => ({
    assetId: row.asset_id,
    id: row.template_id,
    type: row.asset_type,
    documentType: row.document_type,
    validityDays: row.validity_days || undefined,
    blocksAccess: row.blocks_access,
    required: row.is_required,
    checklist: Array.isArray(row.review_checklist) ? row.review_checklist.map(String) : [],
    documentId: row.document_id || undefined,
    documentName: row.document_name || undefined,
    issuedAt: row.issued_at || undefined,
    expiresAt: row.expires_at || undefined,
    rejectionReason: row.rejection_reason || undefined,
    status: row.effective_status,
    satisfied: row.satisfied,
  }));
}

export async function listAssetDocuments(assetId: string): Promise<AssetDocument[]> {
  const rows = await request<Array<{
    id: string; asset_id: string; document_type: string; document_name: string | null;
    storage_bucket: string | null; storage_path: string | null; status: AssetDocumentStatus;
    issued_at: string | null; expires_at: string | null; rejection_reason: string | null;
  }>>(`asset_documents?select=*&asset_id=eq.${assetId}&order=document_type.asc`);
  return rows.map(row => ({
    id: row.id,
    assetId: row.asset_id,
    type: row.document_type,
    name: row.document_name || undefined,
    storageBucket: row.storage_bucket || undefined,
    storagePath: row.storage_path || undefined,
    status: row.status,
    issuedAt: row.issued_at || undefined,
    expiresAt: row.expires_at || undefined,
    rejectionReason: row.rejection_reason || undefined,
  }));
}

async function openStorageObject(bucket: string, path: string): Promise<void> {
  const session = await getSupabaseSessionForRequest();
  if (!session) throw new Error('Tu sesión expiró.');
  const encodedPath = path.split('/').map(encodeURIComponent).join('/');
  const response = await fetch(`${SUPABASE_URL}/storage/v1/object/authenticated/${encodeURIComponent(bucket)}/${encodedPath}`, {
    headers: { apikey: SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${session._supabase.accessToken}` },
  });
  if (!response.ok) throw new Error('No fue posible abrir el archivo.');
  const url = URL.createObjectURL(await response.blob());
  window.open(url, '_blank', 'noopener,noreferrer');
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export async function openAssetDocument(document: AssetDocument): Promise<void> {
  if (!document.storageBucket || !document.storagePath) throw new Error('El documento no tiene un archivo disponible.');
  return openStorageObject(document.storageBucket, document.storagePath);
}

export async function uploadAssetDocument(
  assetId: string,
  documentType: string,
  file: File,
  issuedAt?: string,
  expiresAt?: string,
): Promise<void> {
  if (!['application/pdf', 'image/jpeg', 'image/png'].includes(file.type) || file.size > 20 * 1024 * 1024) {
    throw new Error('Usa PDF, JPG o PNG de hasta 20 MB.');
  }
  const session = await getSupabaseSessionForRequest();
  if (!session) throw new Error('Tu sesión expiró.');
  const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `${assetId}/${crypto.randomUUID()}-${safe}`;
  const uploaded = await fetch(`${SUPABASE_URL}/storage/v1/object/asset-documents/${path}`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${session._supabase.accessToken}`,
      'Content-Type': file.type,
    },
    body: file,
  });
  if (!uploaded.ok) throw new Error((await uploaded.json().catch(() => ({})))?.message || 'No fue posible subir el archivo.');

  const existing = await request<Array<{ id: string }>>(`asset_documents?select=id&asset_id=eq.${assetId}&document_type=eq.${encodeURIComponent(documentType)}&limit=1`);
  let documentId = existing[0]?.id;
  const docBody = {
    asset_id: assetId,
    document_type: documentType,
    document_name: file.name,
    status: 'en_revision',
    issued_at: issuedAt || null,
    expires_at: expiresAt || null,
    storage_bucket: 'asset-documents',
    storage_path: path,
    rejection_reason: null,
    reviewed_by: null,
    reviewed_at: null,
  };
  if (documentId) {
    await request<void>(`asset_documents?id=eq.${documentId}`, {
      method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(docBody),
    });
  } else {
    const created = await request<Array<{ id: string }>>('asset_documents', {
      method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify(docBody),
    });
    documentId = created[0]?.id;
  }
  if (!documentId) throw new Error('No fue posible crear el registro documental.');
  const versions = await request<Array<{ version_number: number }>>(`asset_document_versions?select=version_number&asset_document_id=eq.${documentId}&order=version_number.desc&limit=1`);
  await request<void>('asset_document_versions', {
    method: 'POST', headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({
      asset_document_id: documentId,
      version_number: (versions[0]?.version_number || 0) + 1,
      file_name: file.name,
      mime_type: file.type,
      file_size: file.size,
      storage_bucket: 'asset-documents',
      storage_path: path,
      uploaded_by: session.profileId,
    }),
  });
}

export async function reviewAssetDocument(documentId: string, status: 'aprobado' | 'rechazado', reason?: string): Promise<void> {
  const session = await getSupabaseSessionForRequest();
  if (!session) throw new Error('Tu sesión expiró.');
  await request<void>(`asset_documents?id=eq.${documentId}`, {
    method: 'PATCH', headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({
      status,
      rejection_reason: status === 'rechazado' ? reason || 'Documento rechazado' : null,
      reviewed_by: session.profileId,
      reviewed_at: new Date().toISOString(),
    }),
  });
}

export async function listAssetInspections(assetId: string): Promise<AssetInspection[]> {
  const rows = await request<Array<{
    id: string; asset_id: string; inspection_date: string; result: AssetInspection['result'];
    checklist: unknown; observations: string | null; next_inspection_date: string | null;
  }>>(`asset_inspections?select=*&asset_id=eq.${assetId}&order=inspection_date.desc`);
  return rows.map(row => ({
    id: row.id,
    assetId: row.asset_id,
    inspectionDate: row.inspection_date,
    result: row.result,
    checklist: Array.isArray(row.checklist) ? row.checklist : [],
    observations: row.observations || undefined,
    nextInspectionDate: row.next_inspection_date || undefined,
  }));
}

export async function createAssetInspection(
  assetId: string,
  input: { result: AssetInspection['result']; observations?: string; nextInspectionDate?: string; checklist?: unknown[] },
): Promise<void> {
  const session = await getSupabaseSessionForRequest();
  if (!session) throw new Error('Tu sesión expiró.');
  await request<void>('asset_inspections', {
    method: 'POST', headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({
      asset_id: assetId,
      result: input.result,
      observations: input.observations || null,
      next_inspection_date: input.nextInspectionDate || null,
      checklist: input.checklist || [],
      inspected_by: session.profileId,
    }),
  });
}

export async function listAssetMaintenance(assetId: string): Promise<AssetMaintenanceRecord[]> {
  const rows = await request<Array<{
    id: string; asset_id: string; maintenance_type: string; performed_at: string;
    next_due_at: string | null; provider: string | null; notes: string | null;
  }>>(`asset_maintenance?select=*&asset_id=eq.${assetId}&order=performed_at.desc`);
  return rows.map(row => ({
    id: row.id,
    assetId: row.asset_id,
    type: row.maintenance_type,
    performedAt: row.performed_at,
    nextDueAt: row.next_due_at || undefined,
    provider: row.provider || undefined,
    notes: row.notes || undefined,
  }));
}

export async function createAssetMaintenance(
  assetId: string,
  input: { type: string; performedAt: string; nextDueAt?: string; provider?: string; notes?: string },
): Promise<void> {
  const session = await getSupabaseSessionForRequest();
  if (!session) throw new Error('Tu sesión expiró.');
  await request<void>('asset_maintenance', {
    method: 'POST', headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({
      asset_id: assetId,
      maintenance_type: input.type.trim(),
      performed_at: input.performedAt,
      next_due_at: input.nextDueAt || null,
      provider: input.provider || null,
      notes: input.notes || null,
      created_by: session.profileId,
    }),
  });
}

export async function listOperatorCandidates(projectKey: string, contractorKey: string): Promise<AssetOperatorCandidate[]> {
  const rows = await request<Array<{
    worker_assignment_id: string; contractor_key: string; worker_id: string;
    full_name: string; rut: string; job_title: string | null; access_status: string;
  }>>(`asset_operator_candidates?select=*&project_key=eq.${encodeURIComponent(projectKey)}&contractor_key=eq.${encodeURIComponent(contractorKey)}&order=full_name.asc`);
  return rows.map(row => ({
    workerAssignmentId: row.worker_assignment_id,
    contractorKey: row.contractor_key,
    workerId: row.worker_id,
    fullName: row.full_name,
    rut: row.rut,
    jobTitle: row.job_title || undefined,
    accessStatus: row.access_status,
  }));
}

export async function listAssetOperators(assetId: string): Promise<AssetOperatorAssignment[]> {
  const [rows, candidates] = await Promise.all([
    request<Array<{
      id: string; worker_assignment_id: string; valid_from: string; valid_until: string | null;
      status: AssetOperatorAssignment['status'];
    }>>(`asset_operator_assignments?select=id,worker_assignment_id,valid_from,valid_until,status&asset_id=eq.${assetId}&order=created_at.desc`),
    request<Array<{ worker_assignment_id: string; full_name: string; rut: string; job_title: string | null }>>('asset_operator_candidates?select=worker_assignment_id,full_name,rut,job_title'),
  ]);
  const byAssignment = new Map(candidates.map(item => [item.worker_assignment_id, item]));
  return rows.map(row => {
    const person = byAssignment.get(row.worker_assignment_id);
    return {
      id: row.id,
      workerAssignmentId: row.worker_assignment_id,
      fullName: person?.full_name || 'Trabajador no disponible',
      rut: person?.rut || '—',
      jobTitle: person?.job_title || undefined,
      validFrom: row.valid_from,
      validUntil: row.valid_until || undefined,
      status: row.status,
    };
  });
}

export async function assignAssetOperator(
  assetId: string,
  workerAssignmentId: string,
  validFrom: string,
  validUntil?: string,
): Promise<void> {
  const session = await getSupabaseSessionForRequest();
  if (!session) throw new Error('Tu sesión expiró.');
  await request<void>('asset_operator_assignments', {
    method: 'POST', headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({
      asset_id: assetId,
      worker_assignment_id: workerAssignmentId,
      valid_from: validFrom,
      valid_until: validUntil || null,
      status: 'activo',
      created_by: session.profileId,
    }),
  });
}

export async function updateAssetOperatorStatus(id: string, status: AssetOperatorAssignment['status']): Promise<void> {
  await request<void>(`asset_operator_assignments?id=eq.${id}`, {
    method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ status }),
  });
}

export async function listLibraryDocuments(contractorKey: string): Promise<LibraryDocument[]> {
  const contractorId = await resolveContractorId(contractorKey);
  const rows = await request<Array<{
    id: string; contratista_id: string; document_type: string; document_name: string;
    issued_at: string | null; expires_at: string | null; status: LibraryDocument['status'];
    storage_bucket: string; storage_path: string; mime_type: string; file_size: number;
  }>>(`document_library?select=*&contratista_id=eq.${contractorId}&order=created_at.desc`);
  return rows.map(row => ({
    id: row.id,
    contractorId: row.contratista_id,
    type: row.document_type,
    name: row.document_name,
    issuedAt: row.issued_at || undefined,
    expiresAt: row.expires_at || undefined,
    status: row.status,
    storageBucket: row.storage_bucket,
    storagePath: row.storage_path,
    mimeType: row.mime_type,
    fileSize: row.file_size,
  }));
}

export async function uploadLibraryDocument(
  contractorKey: string,
  documentType: string,
  file: File,
  issuedAt?: string,
  expiresAt?: string,
): Promise<void> {
  if (!['application/pdf', 'image/jpeg', 'image/png'].includes(file.type) || file.size > 20 * 1024 * 1024) {
    throw new Error('Usa PDF, JPG o PNG de hasta 20 MB.');
  }
  const session = await getSupabaseSessionForRequest();
  if (!session) throw new Error('Tu sesión expiró.');
  const contractorId = await resolveContractorId(contractorKey);
  const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `${session.profileId}/${crypto.randomUUID()}-${safe}`;
  const uploaded = await fetch(`${SUPABASE_URL}/storage/v1/object/document-library/${path}`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${session._supabase.accessToken}`,
      'Content-Type': file.type,
    },
    body: file,
  });
  if (!uploaded.ok) throw new Error((await uploaded.json().catch(() => ({})))?.message || 'No fue posible subir el archivo a la biblioteca.');
  await request<void>('document_library', {
    method: 'POST', headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({
      contratista_id: contractorId,
      document_type: documentType.trim(),
      document_name: file.name,
      issued_at: issuedAt || null,
      expires_at: expiresAt || null,
      status: 'vigente',
      storage_bucket: 'document-library',
      storage_path: path,
      mime_type: file.type,
      file_size: file.size,
      uploaded_by: session.profileId,
    }),
  });
}

export async function openLibraryDocument(document: LibraryDocument): Promise<void> {
  return openStorageObject(document.storageBucket, document.storagePath);
}

export async function listLinkableObligations(projectKey: string, contractorKey: string): Promise<LinkableObligation[]> {
  const [projectId, accreditationId] = await Promise.all([
    resolveProjectId(projectKey),
    resolveAccreditation(projectKey, contractorKey),
  ]);
  const [rows, requirements] = await Promise.all([
    request<Array<{
      obligation_id: string; requirement_id: string; period_start: string; period_end: string;
      effective_status: string; worker_assignment_id: string | null;
    }>>(`obligation_statuses?select=obligation_id,requirement_id,period_start,period_end,effective_status,worker_assignment_id&accreditation_id=eq.${accreditationId}&is_active=eq.true&order=due_date.asc`),
    request<Array<{ id: string; name: string; target: 'empresa' | 'trabajador' }>>(`requirements?select=id,name,target&project_id=eq.${projectId}`),
  ]);
  const names = new Map(requirements.map(item => [item.id, item]));
  return rows.map(row => ({
    id: row.obligation_id,
    requirementId: row.requirement_id,
    requirementName: names.get(row.requirement_id)?.name || 'Requisito',
    target: names.get(row.requirement_id)?.target || 'empresa',
    periodStart: row.period_start,
    periodEnd: row.period_end,
    status: row.effective_status,
    workerAssignmentId: row.worker_assignment_id || undefined,
  }));
}

export async function applyLibraryDocument(libraryDocumentId: string, obligationId: string): Promise<void> {
  await request<string>('rpc/apply_library_document', {
    method: 'POST',
    body: JSON.stringify({ p_library_document_id: libraryDocumentId, p_obligation_id: obligationId }),
  });
}
