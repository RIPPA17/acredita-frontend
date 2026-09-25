import { getSupabaseSessionForRequest, SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from './supabaseAuth';

export type AdminContractorInput = {
  name: string;
  legalName: string;
  rut: string;
  companyType: string;
  businessActivity: string;
  siiActivityCode?: string;
  companyEmail: string;
  companyPhone: string;
  website?: string;
  country: string;
  region: string;
  commune: string;
  address: string;
  legalRepresentativeName: string;
  legalRepresentativeRut: string;
  legalRepresentativeEmail: string;
  legalRepresentativePhone: string;
  adminFullName: string;
  adminRut: string;
  adminEmail: string;
  adminPhone: string;
  occupationalInsurer: string;
  compensationFund?: string;
  employeeCount?: number | null;
};

export type CreatedContractor = {
  ok: boolean;
  contractor: {
    id: string;
    name: string;
    rut: string | null;
    integration_key: string;
  };
  administrator: {
    full_name: string;
    rut: string;
    email: string;
    phone: string;
  };
  legal_representative: {
    full_name: string;
    rut: string;
    email: string;
    phone: string;
  };
  invited: boolean;
  invitation_pending: boolean;
  invitation_error?: string | null;
  administrator_linked: boolean;
  existing_user: boolean;
  existing_contractor: boolean;
  master_data_version: number;
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

  const response = await fetch(`${SUPABASE_URL}/functions/v1/create-contractor`, {
    method: 'POST',
    headers: headers(session._supabase.accessToken),
    body: JSON.stringify({
      company_name: input.name.trim(),
      legal_name: input.legalName.trim(),
      rut: input.rut.trim(),
      company_type: input.companyType,
      business_activity: input.businessActivity.trim(),
      sii_activity_code: input.siiActivityCode?.trim() || null,
      company_email: input.companyEmail.trim().toLowerCase(),
      company_phone: input.companyPhone.trim(),
      website: input.website?.trim() || null,
      country: input.country.trim(),
      region: input.region.trim(),
      commune: input.commune.trim(),
      address: input.address.trim(),
      legal_representative_name: input.legalRepresentativeName.trim(),
      legal_representative_rut: input.legalRepresentativeRut.trim(),
      legal_representative_email: input.legalRepresentativeEmail.trim().toLowerCase(),
      legal_representative_phone: input.legalRepresentativePhone.trim(),
      admin_full_name: input.adminFullName.trim(),
      admin_rut: input.adminRut.trim(),
      admin_email: input.adminEmail.trim().toLowerCase(),
      admin_phone: input.adminPhone.trim(),
      occupational_insurer: input.occupationalInsurer,
      compensation_fund: input.compensationFund?.trim() || null,
      employee_count: input.employeeCount ?? null,
    }),
  });

  return parseResponse<CreatedContractor>(response);
}

export async function resendContractorAccessInvitation(contractorId: string): Promise<{ ok: boolean; invited: boolean; linked: boolean }> {
  const session = await getSupabaseSessionForRequest();
  if (!session || session.role !== 'admin') throw new Error('Solo Administración Acredita puede reenviar accesos de contratistas.');

  const response = await fetch(`${SUPABASE_URL}/functions/v1/resend-contractor-access-invitation`, {
    method: 'POST',
    headers: headers(session._supabase.accessToken),
    body: JSON.stringify({ contractor_id: contractorId }),
  });

  return parseResponse<{ ok: boolean; invited: boolean; linked: boolean }>(response);
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
