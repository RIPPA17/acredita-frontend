import { getSupabaseSessionForRequest, SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from './supabaseAuth';

async function rpc<T = void>(name: string, body: Record<string, unknown>): Promise<T> {
  const session = await getSupabaseSessionForRequest();
  if (!session) throw new Error('Tu sesión expiró.');
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${session._supabase.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload?.message || payload?.hint || payload?.error_description || 'No fue posible completar la operación.');
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export async function markPaymentPaid(paymentCaseId: string, reference: string, note?: string): Promise<void> {
  const cleanReference = reference.trim();
  if (cleanReference.length < 3) throw new Error('Ingresa una referencia de pago válida.');
  await rpc('mark_payment_paid', {
    p_payment_case_id: paymentCaseId,
    p_reference: cleanReference,
    p_note: note?.trim() || null,
  });
}

export async function voidPaymentCase(paymentCaseId: string, reason: string): Promise<void> {
  const clean = reason.trim();
  if (clean.length < 3) throw new Error('Indica el motivo de anulación.');
  await rpc('void_payment_case', { p_payment_case_id: paymentCaseId, p_reason: clean });
}

export async function getPaymentCaseCompliance(paymentCaseId: string): Promise<Record<string, unknown>> {
  return rpc<Record<string, unknown>>('get_payment_case_compliance', { p_payment_case_id: paymentCaseId });
}

export async function closeCompliancePeriod(periodId: string): Promise<void> {
  await rpc('close_compliance_period', { p_period_id: periodId });
}

export async function reopenCompliancePeriod(periodId: string, reason: string): Promise<void> {
  const clean = reason.trim();
  if (clean.length < 3) throw new Error('Indica el motivo de reapertura.');
  await rpc('reopen_compliance_period', { p_period_id: periodId, p_reason: clean });
}
