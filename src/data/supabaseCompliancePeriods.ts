import { restoreSupabaseSession } from './supabaseAuth';
import { hydrateOperationalDataFromSupabase } from './supabaseOperationalData';

const SUPABASE_URL = ((import.meta as any).env?.VITE_SUPABASE_URL as string | undefined)
  || 'https://jwlscxbmttpicwljozwf.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = ((import.meta as any).env?.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined)
  || 'sb_publishable_27fQcRn8vsWGpzjjE-XIAQ_0Du8m0UP';

async function authorizedSession() {
  const session = await restoreSupabaseSession();
  if (!session || !['admin', 'mandante'].includes(session.role)) throw new Error('Tu sesión no permite administrar períodos.');
  return session;
}

async function ensureOk(response: Response): Promise<void> {
  if (response.ok) return;
  const payload = await response.json().catch(() => ({}));
  throw new Error(payload?.message || payload?.hint || 'No fue posible actualizar el período.');
}

export async function closeCompliancePeriod(periodId: string): Promise<void> {
  const session = await authorizedSession();
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/close_compliance_period`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${session._supabase.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ p_period_id: periodId }),
  });
  await ensureOk(response);
  await hydrateOperationalDataFromSupabase(session);
}

export async function updateCompliancePeriodStatus(periodId: string, status: 'en_revision' | 'reabierto'): Promise<void> {
  const session = await authorizedSession();
  const url = new URL(`${SUPABASE_URL}/rest/v1/compliance_periods`);
  url.searchParams.set('id', `eq.${periodId}`);
  const response = await fetch(url.toString(), {
    method: 'PATCH',
    headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${session._supabase.accessToken}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({
      status,
      closed_at: status === 'reabierto' ? null : undefined,
      closed_by: status === 'reabierto' ? null : undefined,
    }),
  });
  await ensureOk(response);
  await hydrateOperationalDataFromSupabase(session);
}
