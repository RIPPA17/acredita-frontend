import { getSupabaseSessionForRequest, SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from './supabaseAuth';
import { hydrateCoreDataFromSupabase } from './supabaseCoreData';

export type CreateAdminContractorInput = {
  companyName: string;
  rut: string;
  fullName: string;
  email: string;
  phone?: string;
};

export type CreateAdminContractorResult = {
  ok: boolean;
  contractor: {
    id: string;
    integration_key: string;
    name: string;
    rut: string | null;
  };
  responsible: {
    full_name: string;
    email: string;
    phone: string | null;
  };
  invited: boolean;
  existing_user: boolean;
  existing_contractor?: boolean;
};

async function parseResponse<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = (payload as any)?.error || (payload as any)?.message || 'No fue posible crear el contratista.';
    throw new Error(message);
  }
  return payload as T;
}

export async function createAdminContractor(input: CreateAdminContractorInput): Promise<CreateAdminContractorResult> {
  const session = await getSupabaseSessionForRequest();
  if (!session || session.role !== 'admin') {
    throw new Error('Solo Administración de Acredita puede crear contratistas.');
  }

  const response = await fetch(`${SUPABASE_URL}/functions/v1/create-contractor`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${session._supabase.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      company_name: input.companyName.trim(),
      rut: input.rut.trim(),
      full_name: input.fullName.trim(),
      email: input.email.trim().toLowerCase(),
      phone: input.phone?.trim() || null,
    }),
  });

  const result = await parseResponse<CreateAdminContractorResult>(response);
  await hydrateCoreDataFromSupabase(session);
  return result;
}
