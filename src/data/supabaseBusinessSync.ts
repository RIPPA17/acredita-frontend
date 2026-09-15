import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL, type SupabaseUserSession } from './supabaseAuth';

export class BusinessSyncConflictError extends Error {
  constructor(message = 'Los datos cambiaron en otra sesión. Acredita recargó la versión más reciente; vuelve a intentar tu cambio.') {
    super(message);
    this.name = 'BusinessSyncConflictError';
  }
}

let baselineRevision: number | null = null;
let baselineProfileId: string | null = null;

function headers(session: SupabaseUserSession): HeadersInit {
  return {
    apikey: SUPABASE_PUBLISHABLE_KEY,
    Authorization: `Bearer ${session._supabase.accessToken}`,
    'Content-Type': 'application/json',
  };
}

async function parse<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload?.message || payload?.hint || payload?.error_description || payload?.error || 'No fue posible coordinar la escritura en Supabase.';
    throw new Error(message);
  }
  return payload as T;
}

export function clearBusinessRevisionBaseline(): void {
  baselineRevision = null;
  baselineProfileId = null;
}

export async function captureBusinessRevision(session: SupabaseUserSession): Promise<number> {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/business_sync_control?select=revision&id=eq.1&limit=1`, {
    headers: headers(session),
  });
  const rows = await parse<Array<{ revision: number }>>(response);
  const revision = Number(rows[0]?.revision ?? 0);
  baselineRevision = revision;
  baselineProfileId = session.profileId;
  return revision;
}

export async function claimBusinessSync(session: SupabaseUserSession): Promise<void> {
  if (baselineProfileId !== session.profileId || baselineRevision === null) {
    await captureBusinessRevision(session);
  }
  const expected = baselineRevision ?? 0;
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/claim_business_sync`, {
    method: 'POST',
    headers: headers(session),
    body: JSON.stringify({ p_expected_revision: expected, p_seconds: 60 }),
  });
  const claimed = await parse<boolean>(response);
  if (!claimed) throw new BusinessSyncConflictError();
}

export async function releaseBusinessSync(session: SupabaseUserSession): Promise<void> {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/release_business_sync`, {
    method: 'POST',
    headers: headers(session),
    body: '{}',
  });
  await parse<unknown>(response);
}
