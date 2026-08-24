export type AppRole = 'admin' | 'mandante' | 'contratista';

export interface SupabaseUserSession {
  email: string;
  role: AppRole;
  nombre?: string;
  profileId: string;
  mandanteId?: string;
  contratistaId?: string;
  mandanteBackendId?: string;
  contratistaBackendId?: string;
  _supabase: {
    accessToken: string;
    refreshToken: string;
    expiresAt: number;
  };
}

type TokenResponse = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  user?: { id: string; email?: string };
};

type AuthUser = { id: string; email?: string };

const SESSION_KEY = 'acredita_session';
const SUPABASE_URL = ((import.meta as any).env?.VITE_SUPABASE_URL as string | undefined)
  || 'https://jwlscxbmttpicwljozwf.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = ((import.meta as any).env?.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined)
  || 'sb_publishable_27fQcRn8vsWGpzjjE-XIAQ_0Du8m0UP';

function apiHeaders(accessToken?: string): HeadersInit {
  return {
    apikey: SUPABASE_PUBLISHABLE_KEY,
    'Content-Type': 'application/json',
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
  };
}

async function parseResponse<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload?.msg || payload?.message || payload?.error_description || payload?.error || 'Error de autenticación';
    throw new Error(message);
  }
  return payload as T;
}

async function passwordGrant(email: string, password: string): Promise<TokenResponse> {
  const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: apiHeaders(),
    body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
  });
  return parseResponse<TokenResponse>(response);
}

async function refreshGrant(refreshToken: string): Promise<TokenResponse> {
  const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
    method: 'POST',
    headers: apiHeaders(),
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  return parseResponse<TokenResponse>(response);
}

async function getAuthenticatedUser(accessToken: string): Promise<AuthUser> {
  const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: apiHeaders(accessToken),
  });
  return parseResponse<AuthUser>(response);
}

async function restRows<T>(table: string, accessToken: string, params: Record<string, string>): Promise<T[]> {
  const url = new URL(`${SUPABASE_URL}/rest/v1/${table}`);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  const response = await fetch(url.toString(), {
    headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  });
  return parseResponse<T[]>(response);
}

async function loadIdentity(accessToken: string, refreshToken: string, expiresAt: number): Promise<SupabaseUserSession> {
  const user = await getAuthenticatedUser(accessToken);

  const [profiles, acreditaMemberships, mandanteMemberships, contratistaMemberships] = await Promise.all([
    restRows<{ full_name: string | null }>('profiles', accessToken, {
      select: 'full_name', id: `eq.${user.id}`, limit: '1',
    }),
    restRows<{ role: string }>('acredita_memberships', accessToken, {
      select: 'role', profile_id: `eq.${user.id}`, is_active: 'eq.true', limit: '1',
    }),
    restRows<{ mandante_id: string; role: string }>('mandante_memberships', accessToken, {
      select: 'mandante_id,role', profile_id: `eq.${user.id}`, is_active: 'eq.true', limit: '1',
    }),
    restRows<{ contratista_id: string; role: string }>('contratista_memberships', accessToken, {
      select: 'contratista_id,role', profile_id: `eq.${user.id}`, is_active: 'eq.true', limit: '1',
    }),
  ]);

  const base = {
    email: user.email || '',
    profileId: user.id,
    nombre: profiles[0]?.full_name || user.email || 'Usuario Acredita',
    _supabase: { accessToken, refreshToken, expiresAt },
  };

  if (acreditaMemberships.length > 0) {
    return { ...base, role: 'admin' };
  }

  if (mandanteMemberships.length > 0) {
    const membership = mandanteMemberships[0];
    const mandantes = await restRows<{ id: string; name: string; integration_key: string | null }>('mandantes', accessToken, {
      select: 'id,name,integration_key', id: `eq.${membership.mandante_id}`, limit: '1',
    });
    const mandante = mandantes[0];
    if (!mandante?.integration_key) throw new Error('El mandante no tiene clave de integración configurada');
    return {
      ...base,
      role: 'mandante',
      nombre: mandante.name,
      mandanteId: mandante.integration_key,
      mandanteBackendId: mandante.id,
    };
  }

  if (contratistaMemberships.length > 0) {
    const membership = contratistaMemberships[0];
    const contratistas = await restRows<{ id: string; name: string; integration_key: string | null }>('contratistas', accessToken, {
      select: 'id,name,integration_key', id: `eq.${membership.contratista_id}`, limit: '1',
    });
    const contratista = contratistas[0];
    if (!contratista?.integration_key) throw new Error('El contratista no tiene clave de integración configurada');
    return {
      ...base,
      role: 'contratista',
      nombre: contratista.name,
      contratistaId: contratista.integration_key,
      contratistaBackendId: contratista.id,
    };
  }

  throw new Error('Tu cuenta no tiene un rol activo en Acredita');
}

function readStoredSession(): SupabaseUserSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw) as SupabaseUserSession;
    if (!session?._supabase?.accessToken || !session?._supabase?.refreshToken || !session?.profileId) return null;
    return session;
  } catch {
    return null;
  }
}

function persistSession(session: SupabaseUserSession): SupabaseUserSession {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return session;
}

export async function loginWithSupabase(email: string, password: string): Promise<SupabaseUserSession> {
  const tokens = await passwordGrant(email, password);
  const expiresAt = Date.now() + Math.max(60, tokens.expires_in || 3600) * 1000;
  const session = await loadIdentity(tokens.access_token, tokens.refresh_token, expiresAt);
  return persistSession(session);
}

export async function restoreSupabaseSession(): Promise<SupabaseUserSession | null> {
  const stored = readStoredSession();
  if (!stored) return null;

  try {
    let accessToken = stored._supabase.accessToken;
    let refreshToken = stored._supabase.refreshToken;
    let expiresAt = stored._supabase.expiresAt;

    if (expiresAt <= Date.now() + 60_000) {
      const refreshed = await refreshGrant(refreshToken);
      accessToken = refreshed.access_token;
      refreshToken = refreshed.refresh_token;
      expiresAt = Date.now() + Math.max(60, refreshed.expires_in || 3600) * 1000;
    }

    const session = await loadIdentity(accessToken, refreshToken, expiresAt);
    return persistSession(session);
  } catch {
    localStorage.removeItem(SESSION_KEY);
    return null;
  }
}

export function clearSupabaseSession(): void {
  if (typeof window !== 'undefined') localStorage.removeItem(SESSION_KEY);
}
