import { getSupabaseSessionForRequest, SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from './supabaseAuth';

export type AdminContractorInput = {
  name: string;
  rut: string;
  legalName?: string;
  address?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
};

export type CreatedContractor = {
  contractor_id: string;
  contractor_key: string;
  contractor_name: string;
  contractor_rut: string;
};

export type AvailableContractor = {
  contractor_key: string;
  contractor_name: string;
  contractor_rut: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
};

function headers(accessToken: string): HeadersInit {
  return {
    apikey: SUPABASE_PUBLISHABLE_KEY,
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
}

async function parseResponse<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = (payload as any)?.message || (payload as any)?.hint || (payload as any)?.error_description || (payload as any)?.error || 'No fue posible completar la operación.';
    throw new Error(message);
  }
  return payload as T;
}

async function rpc<T>(name: string, body: Record<string, unknown>, accessToken: string): Promise<T> {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: headers(accessToken),
    body: JSON.stringify(body),
  });
  return parseResponse<T>(response);
}

export async function createAdminContractor(input: AdminContractorInput): Promise<CreatedContractor> {
  const session = await getSupabaseSessionForRequest();
  if (!session || session.role !== 'admin') throw new Error('Solo Administración Acredita puede crear contratistas.');

  const rows = await rpc<CreatedContractor[]>('admin_create_contractor', {
    p_name: input.name.trim(),
    p_rut: input.rut.trim(),
    p_legal_name: input.legalName?.trim() || null,
    p_address: input.address?.trim() || null,
    p_contact_name: input.contactName?.trim() || null,
    p_contact_email: input.contactEmail?.trim().toLowerCase() || null,
    p_contact_phone: input.contactPhone?.trim() || null,
  }, session._supabase.accessToken);

  if (!rows[0]) throw new Error('Supabase no devolvió el contratista creado.');
  return rows[0];
}

export async function listAvailableContractorsForProject(projectKey: string): Promise<AvailableContractor[]> {
  const session = await getSupabaseSessionForRequest();
  if (!session || !['mandante', 'admin'].includes(session.role)) {
    throw new Error('Tu sesión no permite incorporar contratistas.');
  }
  return rpc<AvailableContractor[]>('list_available_contractors_for_project', {
    p_project_key: projectKey,
  }, session._supabase.accessToken);
}

export async function createRegisteredContractorInvitation(
  projectKey: string,
  contractorKey: string,
  message?: string,
): Promise<{ invitation_id: string; token: string; expires_at: string }> {
  const session = await getSupabaseSessionForRequest();
  if (!session || !['mandante', 'admin'].includes(session.role)) {
    throw new Error('Tu sesión no permite incorporar contratistas.');
  }
  const rows = await rpc<Array<{ invitation_id: string; token: string; expires_at: string }>>(
    'create_registered_contractor_invitation',
    {
      p_project_key: projectKey,
      p_contractor_key: contractorKey,
      p_message: message?.trim() || null,
    },
    session._supabase.accessToken,
  );
  if (!rows[0]) throw new Error('Supabase no devolvió la invitación creada.');
  return rows[0];
}
