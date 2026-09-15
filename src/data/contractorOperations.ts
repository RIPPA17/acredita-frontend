import { getSupabaseSessionForRequest, SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from './supabaseAuth';
import type { ActionPlanRecord } from './supabaseOperations';

export async function updateContractorActionPlan(
  planId: string,
  status: Extract<ActionPlanRecord['status'], 'pendiente' | 'en_progreso' | 'completado'>,
  evidence?: string,
): Promise<void> {
  const session = await getSupabaseSessionForRequest();
  if (!session) throw new Error('Tu sesión expiró.');

  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/update_contractor_action_plan`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${session._supabase.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      p_plan_id: planId,
      p_status: status,
      p_evidence: evidence?.trim() || null,
    }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body?.message || body?.hint || 'No fue posible actualizar el plan de acción.');
  }
}
