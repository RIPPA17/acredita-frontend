import type { PlantillaBase } from '../types';
import {
  SUPABASE_PUBLISHABLE_KEY,
  SUPABASE_URL,
  getSupabaseSessionForRequest,
} from './supabaseAuth';

interface BackendTemplate {
  integration_key: string;
  name: string;
  category: PlantillaBase['categoria'];
  target: PlantillaBase['destino'];
  is_active: boolean;
}

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
    const message = payload?.message || payload?.hint || payload?.error_description || payload?.error || 'No fue posible guardar la plantilla.';
    throw new Error(message);
  }
  return payload as T;
}

async function requireAdminToken(): Promise<string> {
  const session = await getSupabaseSessionForRequest();
  if (!session) throw new Error('Tu sesión expiró. Vuelve a iniciar sesión.');
  if (session.role !== 'admin') throw new Error('Solo Acredita puede administrar plantillas base.');
  return session._supabase.accessToken;
}

function toFrontend(row: BackendTemplate): PlantillaBase {
  return {
    id: row.integration_key,
    nombre: row.name,
    categoria: row.category,
    destino: row.target,
    activo: row.is_active,
  };
}

export async function loadDocumentTemplates(): Promise<PlantillaBase[]> {
  const accessToken = await requireAdminToken();
  const url = new URL(`${SUPABASE_URL}/rest/v1/document_templates`);
  url.searchParams.set('select', 'integration_key,name,category,target,is_active');
  url.searchParams.set('order', 'name.asc');
  const response = await fetch(url.toString(), {
    headers: headers(accessToken, { Accept: 'application/json' }),
  });
  const rows = await parseResponse<BackendTemplate[]>(response);
  if (typeof window !== 'undefined') localStorage.removeItem('acredita_plantillas');
  return rows.map(toFrontend);
}

function newIntegrationKey(): string {
  const random = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID().replace(/-/g, '').slice(0, 12)
    : Math.random().toString(36).slice(2, 14);
  return `tpl_${Date.now()}_${random}`;
}

export async function createDocumentTemplate(
  input: Omit<PlantillaBase, 'id'>,
): Promise<PlantillaBase> {
  const accessToken = await requireAdminToken();
  const integrationKey = newIntegrationKey();
  const url = new URL(`${SUPABASE_URL}/rest/v1/document_templates`);
  url.searchParams.set('select', 'integration_key,name,category,target,is_active');
  const response = await fetch(url.toString(), {
    method: 'POST',
    headers: headers(accessToken, { Prefer: 'return=representation' }),
    body: JSON.stringify({
      integration_key: integrationKey,
      name: input.nombre.trim(),
      category: input.categoria,
      target: input.destino,
      is_active: input.activo,
    }),
  });
  const rows = await parseResponse<BackendTemplate[]>(response);
  const row = rows[0];
  if (!row) throw new Error('Supabase no devolvió la plantilla creada.');
  return toFrontend(row);
}

export async function updateDocumentTemplate(
  template: PlantillaBase,
): Promise<PlantillaBase> {
  const accessToken = await requireAdminToken();
  const url = new URL(`${SUPABASE_URL}/rest/v1/document_templates`);
  url.searchParams.set('integration_key', `eq.${template.id}`);
  url.searchParams.set('select', 'integration_key,name,category,target,is_active');
  const response = await fetch(url.toString(), {
    method: 'PATCH',
    headers: headers(accessToken, { Prefer: 'return=representation' }),
    body: JSON.stringify({
      name: template.nombre.trim(),
      category: template.categoria,
      target: template.destino,
      is_active: template.activo,
    }),
  });
  const rows = await parseResponse<BackendTemplate[]>(response);
  const row = rows[0];
  if (!row) throw new Error('La plantilla ya no existe o no pudo actualizarse.');
  return toFrontend(row);
}
