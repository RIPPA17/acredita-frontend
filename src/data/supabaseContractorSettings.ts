import {
  getSupabaseSessionForRequest,
  SUPABASE_PUBLISHABLE_KEY,
  SUPABASE_URL,
  type SupabaseUserSession,
} from './supabaseAuth';

export interface ContractorConfigurationSnapshot {
  company: {
    id: string;
    name: string;
    legalName?: string;
    rut?: string;
    isActive: boolean;
  };
  account: {
    fullName?: string;
    phone?: string;
    profileActive: boolean;
    membershipRole: string;
    membershipActive: boolean;
  };
}

async function requestRows<T>(
  table: string,
  accessToken: string,
  params: Record<string, string>,
): Promise<T[]> {
  const url = new URL(`${SUPABASE_URL}/rest/v1/${table}`);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  const response = await fetch(url.toString(), {
    headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  });
  const payload = await response.json().catch(() => ([]));
  if (!response.ok) {
    const message = payload?.message || payload?.details || payload?.hint || 'No fue posible cargar la configuración.';
    throw new Error(message);
  }
  return payload as T[];
}

export async function loadContractorConfiguration(
  sessionHint?: SupabaseUserSession | null,
): Promise<ContractorConfigurationSnapshot> {
  const session = await getSupabaseSessionForRequest(sessionHint);
  if (!session || session.role !== 'contratista') throw new Error('Sesión de contratista no disponible.');

  const memberships = await requestRows<{
    contratista_id: string;
    role: string;
    is_active: boolean;
  }>('contratista_memberships', session._supabase.accessToken, {
    select: 'contratista_id,role,is_active',
    profile_id: `eq.${session.profileId}`,
    limit: '1',
  });
  const membership = memberships[0];
  if (!membership) throw new Error('Tu cuenta no tiene una relación de contratista configurada.');

  const contractorId = session.contratistaBackendId || membership.contratista_id;
  const [companies, profiles] = await Promise.all([
    requestRows<{
      id: string;
      name: string;
      legal_name: string | null;
      rut: string | null;
      is_active: boolean;
    }>('contratistas', session._supabase.accessToken, {
      select: 'id,name,legal_name,rut,is_active',
      id: `eq.${contractorId}`,
      limit: '1',
    }),
    requestRows<{
      full_name: string | null;
      phone: string | null;
      is_active: boolean;
    }>('profiles', session._supabase.accessToken, {
      select: 'full_name,phone,is_active',
      id: `eq.${session.profileId}`,
      limit: '1',
    }),
  ]);

  const company = companies[0];
  const profile = profiles[0];
  if (!company) throw new Error('No fue posible encontrar los datos de tu empresa.');

  return {
    company: {
      id: company.id,
      name: company.name,
      legalName: company.legal_name || undefined,
      rut: company.rut || undefined,
      isActive: company.is_active,
    },
    account: {
      fullName: profile?.full_name || undefined,
      phone: profile?.phone || undefined,
      profileActive: profile?.is_active ?? true,
      membershipRole: membership.role,
      membershipActive: membership.is_active,
    },
  };
}

export function contractorMembershipLabel(role: string): string {
  if (role === 'contratista_admin') return 'Administrador de empresa';
  if (role === 'contratista_user') return 'Usuario de empresa';
  return role.replaceAll('_', ' ');
}
