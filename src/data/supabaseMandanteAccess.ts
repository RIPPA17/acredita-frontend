import {
  getSupabaseSessionForRequest,
  SUPABASE_PUBLISHABLE_KEY,
  SUPABASE_URL,
} from './supabaseAuth';

export interface MandanteAccessOption {
  id: string;
  name: string;
  rut: string | null;
  integration_key: string | null;
}

export interface InviteMandanteResult {
  ok: boolean;
  invited: boolean;
  existing_user: boolean;
  mandante: string;
  email: string;
}

async function authenticatedHeaders(): Promise<HeadersInit> {
  const session = await getSupabaseSessionForRequest();
  if (!session) throw new Error('Tu sesión expiró. Vuelve a iniciar sesión.');
  return {
    apikey: SUPABASE_PUBLISHABLE_KEY,
    Authorization: `Bearer ${session._supabase.accessToken}`,
    'Content-Type': 'application/json',
  };
}

async function parse<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body?.error || body?.message || body?.hint || 'No fue posible completar la operación.');
  }
  return body as T;
}

export async function listMandantesForAccess(): Promise<MandanteAccessOption[]> {
  const params = new URLSearchParams({
    select: 'id,name,rut,integration_key',
    is_active: 'eq.true',
    order: 'name.asc',
  });
  const response = await fetch(`${SUPABASE_URL}/rest/v1/mandantes?${params.toString()}`, {
    headers: await authenticatedHeaders(),
  });
  return parse<MandanteAccessOption[]>(response);
}

export async function inviteMandanteUser(input: {
  mandanteId: string;
  email: string;
  fullName: string;
}): Promise<InviteMandanteResult> {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/invite-mandante-user`, {
    method: 'POST',
    headers: await authenticatedHeaders(),
    body: JSON.stringify({
      mandante_id: input.mandanteId,
      email: input.email.trim().toLowerCase(),
      full_name: input.fullName.trim(),
    }),
  });
  return parse<InviteMandanteResult>(response);
}
