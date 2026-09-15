import {
  getSupabaseSessionForRequest,
  SUPABASE_PUBLISHABLE_KEY,
  SUPABASE_URL,
  type SupabaseUserSession,
} from './supabaseAuth';

export type AccessRequestStatus = 'pending' | 'contacted' | 'approved' | 'rejected';
export type AccessRequestRole = 'mandante' | 'contratista';

export interface AccessRequestRecord {
  id: string;
  requested_role: AccessRequestRole;
  full_name: string;
  company_name: string;
  rut: string | null;
  industry: string | null;
  email: string;
  phone: string | null;
  status: AccessRequestStatus;
  request_type: 'access' | 'demo';
  company_size: string | null;
  message: string | null;
  created_at: string;
  updated_at: string;
}

async function authHeaders(sessionHint?: SupabaseUserSession | null): Promise<HeadersInit> {
  const session = await getSupabaseSessionForRequest(sessionHint);
  if (!session) throw new Error('Tu sesión expiró. Vuelve a iniciar sesión.');
  return {
    apikey: SUPABASE_PUBLISHABLE_KEY,
    Authorization: `Bearer ${session._supabase.accessToken}`,
    'Content-Type': 'application/json',
  };
}

async function parseError(response: Response): Promise<never> {
  const payload = await response.json().catch(() => ({}));
  throw new Error(payload?.message || payload?.hint || payload?.error_description || 'No fue posible completar la solicitud.');
}

export async function listAccessRequests(sessionHint?: SupabaseUserSession | null): Promise<AccessRequestRecord[]> {
  const params = new URLSearchParams({
    select: 'id,requested_role,full_name,company_name,rut,industry,email,phone,status,request_type,company_size,message,created_at,updated_at',
    order: 'created_at.desc',
  });
  const response = await fetch(`${SUPABASE_URL}/rest/v1/access_requests?${params.toString()}`, {
    headers: await authHeaders(sessionHint),
  });
  if (!response.ok) return parseError(response);
  return response.json() as Promise<AccessRequestRecord[]>;
}

export async function updateAccessRequestStatus(
  id: string,
  status: AccessRequestStatus,
  sessionHint?: SupabaseUserSession | null,
): Promise<void> {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/access_requests?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: {
      ...(await authHeaders(sessionHint)),
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({ status }),
  });
  if (!response.ok) await parseError(response);
}
