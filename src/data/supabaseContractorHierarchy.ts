import { restoreSupabaseSession } from './supabaseAuth';
import { hydrateCoreDataFromSupabase } from './supabaseCoreData';

const SUPABASE_URL = ((import.meta as any).env?.VITE_SUPABASE_URL as string | undefined)
  || 'https://jwlscxbmttpicwljozwf.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = ((import.meta as any).env?.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined)
  || 'sb_publishable_27fQcRn8vsWGpzjjE-XIAQ_0Du8m0UP';

export async function setContractorParent(projectId: string, contractorId: string, parentContractorId?: string): Promise<void> {
  const session = await restoreSupabaseSession();
  if (!session || !['admin', 'mandante'].includes(session.role)) {
    throw new Error('Tu sesión no permite administrar relaciones de subcontratación.');
  }
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/set_contractor_parent`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${session._supabase.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      p_project_key: projectId,
      p_contractor_key: contractorId,
      p_parent_contractor_key: parentContractorId || null,
    }),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload?.message || payload?.hint || 'No fue posible actualizar la relación de subcontratación.');
  }
  await hydrateCoreDataFromSupabase(session);
}


export async function setContractorProjectActive(projectId: string, contractorId: string, active: boolean): Promise<void> {
  const session = await restoreSupabaseSession();
  if (!session || !['admin', 'mandante'].includes(session.role)) {
    throw new Error('Tu sesión no permite administrar la participación del contratista.');
  }
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/set_contractor_project_active`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${session._supabase.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      p_project_key: projectId,
      p_contractor_key: contractorId,
      p_active: active,
    }),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload?.message || payload?.hint || 'No fue posible actualizar la participación del contratista.');
  }
  await hydrateCoreDataFromSupabase(session);
}
