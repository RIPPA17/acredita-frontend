import { getSupabaseSessionForRequest, SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from './supabaseAuth';

export type AssetType = 'vehiculo' | 'maquinaria' | 'equipo';
export type AssetStatus = 'pendiente' | 'en_revision' | 'habilitado' | 'bloqueado' | 'inactivo';

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
  totalDocuments: number;
  approvedDocuments: number;
  blockingDocuments: number;
  nextExpiry?: string;
}

type RegistryRow = {
  id: string; integration_key: string | null; project_key: string; contractor_key: string;
  service_key: string | null; accreditation_id: string; service_id: string | null;
  asset_type: AssetType; identifier: string; name: string; brand: string | null; model: string | null;
  year: number | null; owner_name: string | null; operator_name: string | null; status: AssetStatus;
  access_allowed: boolean; notes: string | null; total_documents: number; approved_documents: number;
  blocking_documents: number; next_expiry: string | null;
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
    throw new Error(payload?.message || payload?.hint || 'No fue posible completar la operación.');
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

const mapRow = (row: RegistryRow): OperationalAsset => ({
  id: row.id, integrationKey: row.integration_key || undefined, projectKey: row.project_key,
  contractorKey: row.contractor_key, serviceKey: row.service_key || undefined,
  accreditationId: row.accreditation_id, serviceId: row.service_id || undefined,
  type: row.asset_type, identifier: row.identifier, name: row.name, brand: row.brand || undefined,
  model: row.model || undefined, year: row.year || undefined, ownerName: row.owner_name || undefined,
  operatorName: row.operator_name || undefined, status: row.status, accessAllowed: row.access_allowed,
  notes: row.notes || undefined, totalDocuments: row.total_documents || 0,
  approvedDocuments: row.approved_documents || 0, blockingDocuments: row.blocking_documents || 0,
  nextExpiry: row.next_expiry || undefined,
});

export async function listAssets(projectKey: string, contractorKey?: string): Promise<OperationalAsset[]> {
  const filters = [`project_key=eq.${encodeURIComponent(projectKey)}`, 'is_active=eq.true'];
  if (contractorKey) filters.push(`contractor_key=eq.${encodeURIComponent(contractorKey)}`);
  const rows = await request<RegistryRow[]>(`asset_registry?select=*&${filters.join('&')}&order=name.asc`);
  return rows.map(mapRow);
}

export async function resolveAccreditation(projectKey: string, contractorKey: string): Promise<string> {
  const registry = await request<Array<{ accreditation_id: string }>>(`asset_registry?select=accreditation_id&project_key=eq.${encodeURIComponent(projectKey)}&contractor_key=eq.${encodeURIComponent(contractorKey)}&limit=1`);
  if (registry[0]) return registry[0].accreditation_id;
  const projects = await request<Array<{ id: string }>>(`projects?select=id&integration_key=eq.${encodeURIComponent(projectKey)}&limit=1`);
  const contractors = await request<Array<{ id: string }>>(`contratistas?select=id&integration_key=eq.${encodeURIComponent(contractorKey)}&limit=1`);
  if (!projects[0] || !contractors[0]) throw new Error('No se encontró el proyecto o contratista.');
  const accreditations = await request<Array<{ id: string }>>(`accreditations?select=id&project_id=eq.${projects[0].id}&contratista_id=eq.${contractors[0].id}&is_active=eq.true&limit=1`);
  if (!accreditations[0]) throw new Error('El contratista no tiene acreditación activa en este proyecto.');
  return accreditations[0].id;
}

export async function saveAsset(input: Omit<OperationalAsset, 'id' | 'accreditationId' | 'totalDocuments' | 'approvedDocuments' | 'blockingDocuments'> & { id?: string }): Promise<void> {
  const accreditationId = await resolveAccreditation(input.projectKey, input.contractorKey);
  let serviceId: string | null = null;
  if (input.serviceKey) {
    const services = await request<Array<{ id: string }>>(`services?select=id&integration_key=eq.${encodeURIComponent(input.serviceKey)}&limit=1`);
    serviceId = services[0]?.id || null;
  }
  const body = {
    accreditation_id: accreditationId, service_id: serviceId, asset_type: input.type,
    identifier: input.identifier.trim().toUpperCase(), name: input.name.trim(), brand: input.brand || null,
    model: input.model || null, year: input.year || null, owner_name: input.ownerName || null,
    operator_name: input.operatorName || null, status: input.status,
    access_allowed: input.status === 'habilitado', notes: input.notes || null, is_active: input.status !== 'inactivo',
  };
  if (input.id) {
    await request<void>(`assets?id=eq.${input.id}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(body) });
  } else {
    await request<void>('assets', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ ...body, integration_key: `asset_${crypto.randomUUID()}` }) });
  }
}
