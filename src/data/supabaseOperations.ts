import { getSupabaseSessionForRequest, SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from './supabaseAuth';
import { resolveAccreditation } from './supabaseAssets';

export interface EvaluationRecord {
  id: string; accreditation_id: string; period_start: string; period_end: string; status: string;
  safety_score: number; quality_score: number; labor_score: number; compliance_score: number;
  total_score: number; risk_level: string; observations?: string;
}
export interface ActionPlanRecord {
  id: string; evaluation_id: string; title: string; description: string; owner_name?: string;
  due_date?: string; status: 'pendiente' | 'en_progreso' | 'completado' | 'cancelado'; evidence?: string; completed_at?: string;
}
export interface PaymentRecord {
  id: string; accreditation_id: string; period_start: string; period_end: string; amount?: number; currency: string;
  status: string; block_reason?: string; invoice_number?: string; submitted_at?: string; paid_at?: string;
}
export interface PaymentApprovalRecord {
  id: string; payment_case_id: string; decision: 'aprobado' | 'observado' | 'rechazado'; comment?: string; created_at: string;
}
export interface TicketRecord {
  id: string; accreditation_id?: string; category: string; priority: string; status: string;
  subject: string; description: string; resolution?: string; created_at: string; due_at?: string; resolved_at?: string;
}
export interface TicketMessageRecord {
  id: string; ticket_id: string; author_id: string; body: string; is_internal: boolean; created_at: string;
}
export type IntegrationType = 'control_acceso' | 'erp' | 'previred' | 'webhook';
export interface IntegrationRecord {
  id: string; project_id: string; integration_type: IntegrationType; provider: string; enabled: boolean;
  endpoint_url?: string; settings: Record<string, unknown>; last_sync_at?: string; last_sync_status?: string;
}
export interface SyncRunRecord {
  id: string; integration_config_id: string; direction: 'entrada' | 'salida' | 'bidireccional';
  status: 'pendiente' | 'ejecutando' | 'exitoso' | 'fallido'; records_processed: number;
  error_message?: string; started_at: string; finished_at?: string;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const session = await getSupabaseSessionForRequest();
  if (!session) throw new Error('Tu sesión expiró.');
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${session._supabase.accessToken}`,
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body?.message || body?.hint || body?.error_description || 'No fue posible completar la operación.');
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export async function resolveProjectId(projectKey: string): Promise<string> {
  const rows = await request<Array<{ id: string }>>(`projects?select=id&integration_key=eq.${encodeURIComponent(projectKey)}&limit=1`);
  if (!rows[0]) throw new Error('Proyecto no encontrado.');
  return rows[0].id;
}

export async function loadOperations(projectKey: string) {
  const projectId = await resolveProjectId(projectKey);
  const accreditations = await request<Array<{ id: string }>>(`accreditations?select=id&project_id=eq.${projectId}`);
  const ids = new Set(accreditations.map(item => item.id));
  const [allEvaluations, allPayments, tickets] = await Promise.all([
    request<EvaluationRecord[]>('contractor_evaluations?select=*&order=period_end.desc'),
    request<PaymentRecord[]>('payment_cases?select=*&order=period_end.desc'),
    request<TicketRecord[]>(`support_tickets?select=*&project_id=eq.${projectId}&order=created_at.desc`),
  ]);
  return {
    evaluations: allEvaluations.filter(item => ids.has(item.accreditation_id)),
    payments: allPayments.filter(item => ids.has(item.accreditation_id)),
    tickets,
  };
}

export async function createEvaluation(projectKey: string, contractorKey: string, input: {
  start: string; end: string; safety: number; quality: number; labor: number; compliance: number; observations?: string;
}) {
  const accreditation_id = await resolveAccreditation(projectKey, contractorKey);
  await request<void>('contractor_evaluations', {
    method: 'POST', headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({
      accreditation_id, period_start: input.start, period_end: input.end, status: 'publicada',
      safety_score: input.safety, quality_score: input.quality, labor_score: input.labor,
      compliance_score: input.compliance, observations: input.observations || null,
    }),
  });
}

export async function listActionPlans(evaluationId: string): Promise<ActionPlanRecord[]> {
  return request<ActionPlanRecord[]>(`evaluation_action_plans?select=*&evaluation_id=eq.${evaluationId}&order=due_date.asc.nullslast,created_at.asc`);
}

export async function createActionPlan(evaluationId: string, input: { title: string; description: string; ownerName?: string; dueDate?: string }) {
  const session = await getSupabaseSessionForRequest();
  if (!session) throw new Error('Tu sesión expiró.');
  await request<void>('evaluation_action_plans', {
    method: 'POST', headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({
      evaluation_id: evaluationId,
      title: input.title.trim(),
      description: input.description.trim(),
      owner_name: input.ownerName || null,
      due_date: input.dueDate || null,
      status: 'pendiente',
      created_by: session.profileId,
    }),
  });
}

export async function updateActionPlan(id: string, status: ActionPlanRecord['status'], evidence?: string) {
  await request<void>(`evaluation_action_plans?id=eq.${id}`, {
    method: 'PATCH', headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ status, evidence: evidence || null, completed_at: status === 'completado' ? new Date().toISOString() : null }),
  });
}

export async function createPayment(projectKey: string, contractorKey: string, input: {
  start: string; end: string; amount?: number; status: string; reason?: string; invoiceNumber?: string;
}) {
  const session = await getSupabaseSessionForRequest();
  if (!session) throw new Error('Tu sesión expiró.');
  const accreditation_id = await resolveAccreditation(projectKey, contractorKey);
  await request<void>('payment_cases', {
    method: 'POST', headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({
      accreditation_id, period_start: input.start, period_end: input.end,
      amount: input.amount || null, status: input.status, block_reason: input.reason || null,
      invoice_number: input.invoiceNumber || null, submitted_by: session.profileId, submitted_at: new Date().toISOString(),
    }),
  });
}

export async function listPaymentApprovals(paymentCaseId: string): Promise<PaymentApprovalRecord[]> {
  return request<PaymentApprovalRecord[]>(`payment_approvals?select=*&payment_case_id=eq.${paymentCaseId}&order=created_at.desc`);
}

export async function createPaymentApproval(paymentCaseId: string, decision: PaymentApprovalRecord['decision'], comment?: string) {
  const session = await getSupabaseSessionForRequest();
  if (!session) throw new Error('Tu sesión expiró.');
  await request<void>('payment_approvals', {
    method: 'POST', headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ payment_case_id: paymentCaseId, decision, comment: comment || null, decided_by: session.profileId }),
  });
}

export async function createTicket(projectKey: string, contractorKey: string | undefined, input: { subject: string; description: string; priority: string; category: string }) {
  const session = await getSupabaseSessionForRequest();
  if (!session) throw new Error('Tu sesión expiró.');
  const project_id = await resolveProjectId(projectKey);
  const accreditation_id = contractorKey ? await resolveAccreditation(projectKey, contractorKey) : null;
  await request<void>('support_tickets', {
    method: 'POST', headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ project_id, accreditation_id, created_by: session.profileId, subject: input.subject, description: input.description, priority: input.priority, category: input.category }),
  });
}

export async function updateTicketStatus(id: string, status: 'abierto' | 'en_progreso' | 'resuelto' | 'cerrado', resolution?: string) {
  const session = await getSupabaseSessionForRequest();
  if (!session) throw new Error('Tu sesión expiró.');
  const resolved = status === 'resuelto' || status === 'cerrado';
  await request<void>(`support_tickets?id=eq.${id}`, {
    method: 'PATCH', headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({
      status, resolution: resolution || null,
      assigned_to: status === 'en_progreso' ? session.profileId : undefined,
      resolved_at: resolved ? new Date().toISOString() : null,
      closed_at: status === 'cerrado' ? new Date().toISOString() : null,
    }),
  });
}

export async function listTicketMessages(ticketId: string): Promise<TicketMessageRecord[]> {
  return request<TicketMessageRecord[]>(`support_ticket_messages?select=*&ticket_id=eq.${ticketId}&order=created_at.asc`);
}

export async function sendTicketMessage(ticketId: string, body: string, internal = false) {
  const session = await getSupabaseSessionForRequest();
  if (!session) throw new Error('Tu sesión expiró.');
  await request<void>('support_ticket_messages', {
    method: 'POST', headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ ticket_id: ticketId, author_id: session.profileId, body: body.trim(), is_internal: internal }),
  });
}

export async function listIntegrations(projectKey: string): Promise<IntegrationRecord[]> {
  const projectId = await resolveProjectId(projectKey);
  return request<IntegrationRecord[]>(`integration_configs?select=*&project_id=eq.${projectId}&order=integration_type.asc,provider.asc`);
}

export async function saveIntegration(projectKey: string, input: {
  id?: string; type: IntegrationType; provider: string; enabled: boolean; endpointUrl?: string; settings?: Record<string, unknown>;
}) {
  const projectId = await resolveProjectId(projectKey);
  const body = {
    project_id: projectId,
    integration_type: input.type,
    provider: input.provider.trim(),
    enabled: input.enabled,
    endpoint_url: input.endpointUrl || null,
    settings: input.settings || {},
  };
  if (input.id) {
    await request<void>(`integration_configs?id=eq.${input.id}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(body) });
  } else {
    await request<void>('integration_configs', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(body) });
  }
}

export async function listSyncRuns(integrationConfigId: string): Promise<SyncRunRecord[]> {
  return request<SyncRunRecord[]>(`integration_sync_runs?select=*&integration_config_id=eq.${integrationConfigId}&order=started_at.desc&limit=20`);
}

export async function createSyncRun(integrationConfigId: string, direction: SyncRunRecord['direction']) {
  await request<void>('integration_sync_runs', {
    method: 'POST', headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ integration_config_id: integrationConfigId, direction, status: 'pendiente', records_processed: 0 }),
  });
}

export async function finishSyncRun(runId: string, integrationId: string, status: 'exitoso' | 'fallido', recordsProcessed: number, errorMessage?: string) {
  const finishedAt = new Date().toISOString();
  await request<void>(`integration_sync_runs?id=eq.${runId}`, {
    method: 'PATCH', headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ status, records_processed: Math.max(0, recordsProcessed), error_message: errorMessage || null, finished_at: finishedAt }),
  });
  await request<void>(`integration_configs?id=eq.${integrationId}`, {
    method: 'PATCH', headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ last_sync_at: finishedAt, last_sync_status: status }),
  });
}
