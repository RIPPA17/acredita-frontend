import { getSupabaseSessionForRequest, SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from './supabaseAuth';

export async function markPaymentPaid(paymentCaseId: string, reference: string, note?: string): Promise<void> {
  const session = await getSupabaseSessionForRequest();
  if (!session) throw new Error('Tu sesión expiró.');
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/mark_payment_paid`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${session._supabase.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ p_payment_case_id: paymentCaseId, p_reference: reference.trim(), p_note: note?.trim() || null }),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body?.message || body?.hint || body?.error_description || 'No fue posible marcar el pago como pagado.');
  }
}
