import { getSupabaseSessionForRequest, SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from './supabaseAuth';
import { resolveAccreditation } from './supabaseAssets';

export type EvaluationStatus = 'borrador' | 'publicada' | 'cerrada';
export interface EvaluationRecord {
  id: string; accreditation_id: string; period_start: string; period_end: string; status: EvaluationStatus;
  safety_score: number; quality_score: number; labor_score: number; compliance_score: number;
  total_score: number; risk_level: string; observations?: string;
  evaluated_by?: string; published_at?: string; published_by?: string;
  closed_at?: string; closed_by?: string; reopened_at?: string; reopened_by?: string; reopen_reason?: string;
  created_at?: string; updated_at?: string;
  contratista_id?: string;
  accreditation_active?: boolean;
}
export type ActionPlanStatus = 'pendiente' | 'en_progreso' | 'en_revision' | 'completado' | 'cancelado';
export interface ActionPlanRecord {
  id: string; evaluation_id: string; title: string; description: string; owner_name?: string;
  due_date?: string; status: ActionPlanStatus; evidence?: string; completed_at?: string;
  submitted_at?: string; reviewed_at?: string; reviewed_by?: string; review_comment?: string;
  created_at?: string; updated_at?: string;
}
export interface EvaluationEventRecord {
  id: string; evaluation_id: string; event_type: 'creada' | 'actualizada' | 'publicada' | 'cerrada' | 'reabierta';
  from_status?: string; to_status?: string; reason?: string; snapshot: Record<string, unknown>;
  actor_profile_id?: string; created_at: string;
}
export interface ActionPlanEventRecord {
  id: string; action_plan_id: string;
  event_type: 'creado' | 'actualizado' | 'iniciado' | 'enviado_revision' | 'aprobado' | 'devuelto' | 'cancelado' | 'reabierto';
  from_status?: string; to_status?: string; comment?: string; evidence_snapshot?: string;
  actor_profile_id?: string; created_at: string;
}
export interface OperationAttachmentRecord {
  id: string; action_plan_id?: string; file_name: string; mime_type: string; file_size: number;
  storage_bucket: string; storage_path: string; uploaded_by: string; created_at: string;
}
export type PaymentStatus = 'observado' | 'retenido' | 'liberado' | 'pagado' | 'anulado';
export interface CompliancePeriodRecord {
  id: string; project_id: string; period_start: string; period_end: string;
  upload_deadline?: string; review_deadline?: string;
  status: 'abierto' | 'cerrado' | 'reabierto';
  closed_at?: string; reopened_at?: string; reopen_reason?: string;
}
export interface PaymentRecord {
  id: string; accreditation_id: string; compliance_period_id: string;
  period_start: string; period_end: string; amount?: number; currency: string;
  status: PaymentStatus; block_reason?: string; invoice_number?: string; submission_note?: string;
  submitted_at?: string; released_at?: string; paid_at?: string;
  payment_reference?: string; payment_note?: string; voided_at?: string; void_reason?: string;
  compliance_snapshot?: Record<string, unknown>; compliance_checked_at?: string;
  contratista_id?: string; accreditation_active?: boolean;
}
export interface PaymentApprovalRecord {
  id: string; payment_case_id: string; decision: 'aprobado' | 'observado' | 'rechazado'; comment?: string;
  decided_by?: string; created_at: string;
}
export interface PaymentCaseEventRecord {
  id: string; payment_case_id: string; event_type: string;
  from_status?: string; to_status?: string; reason?: string;
  compliance_snapshot?: Record<string, unknown>; actor_profile_id?: string; created_at: string;
}
export type TicketStatus = 'abierto' | 'en_progreso' | 'esperando_usuario' | 'resuelto' | 'cerrado';
export interface TicketRecord {
  id: string; accreditation_id?: string; category: string; priority: string; status: TicketStatus;
  subject: string; description: string; resolution?: string; created_at: string; updated_at?: string;
  assigned_to?: string; due_at?: string; resolved_at?: string; closed_at?: string;
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
  const accreditations = await request<Array<{ id: string; contratista_id: string; is_active: boolean }>>(`accreditations?select=id,contratista_id,is_active&project_id=eq.${projectId}`);
  const ids = accreditations.map(item => item.id);
  const accreditationMap = new Map(accreditations.map(item => [item.id, item]));
  const filter = ids.length ? `&accreditation_id=in.(${ids.join(',')})` : '';
  const [rawEvaluations, rawPayments, periods, tickets] = await Promise.all([
    ids.length ? request<EvaluationRecord[]>(`contractor_evaluations?select=*&order=period_end.desc${filter}`) : Promise.resolve([]),
    ids.length ? request<PaymentRecord[]>(`payment_cases?select=*&order=period_end.desc${filter}`) : Promise.resolve([]),
    request<CompliancePeriodRecord[]>(`compliance_periods?select=*&project_id=eq.${projectId}&order=period_start.desc`),
    request<TicketRecord[]>(`support_tickets?select=*&project_id=eq.${projectId}&order=created_at.desc`),
  ]);
  const evaluations = rawEvaluations.map(item => ({
    ...item,
    contratista_id: accreditationMap.get(item.accreditation_id)?.contratista_id,
    accreditation_active: accreditationMap.get(item.accreditation_id)?.is_active === true,
  }));
  const payments = rawPayments.map(item => ({
    ...item,
    contratista_id: accreditationMap.get(item.accreditation_id)?.contratista_id,
    accreditation_active: accreditationMap.get(item.accreditation_id)?.is_active === true,
  }));
  return { evaluations, payments, periods, tickets };
}

export type EvaluationInput = {
  start: string; end: string; safety: number; quality: number; labor: number; compliance: number; observations?: string;
};

export async function createEvaluation(projectKey: string, contractorKey: string, input: EvaluationInput): Promise<EvaluationRecord> {
  const session = await getSupabaseSessionForRequest();
  if (!session) throw new Error('Tu sesión expiró.');
  const accreditation_id = await resolveAccreditation(projectKey, contractorKey);
  const rows = await request<EvaluationRecord[]>('contractor_evaluations', {
    method: 'POST', headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      accreditation_id, period_start: input.start, period_end: input.end, status: 'borrador',
      safety_score: input.safety, quality_score: input.quality, labor_score: input.labor,
      compliance_score: input.compliance, observations: input.observations || null,
      evaluated_by: session.profileId,
    }),
  });
  if (!rows[0]) throw new Error('No fue posible crear la evaluación.');
  return rows[0];
}

export async function updateEvaluationDraft(id: string, input: EvaluationInput): Promise<void> {
  await request<void>(`contractor_evaluations?id=eq.${id}&status=eq.borrador`, {
    method: 'PATCH', headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({
      period_start: input.start, period_end: input.end,
      safety_score: input.safety, quality_score: input.quality,
      labor_score: input.labor, compliance_score: input.compliance,
      observations: input.observations || null,
    }),
  });
}

export async function setEvaluationStatus(id: string, status: Extract<EvaluationStatus, 'publicada' | 'cerrada'>, reason?: string): Promise<void> {
  await request<void>('rpc/set_contractor_evaluation_status', {
    method: 'POST',
    body: JSON.stringify({ p_evaluation_id: id, p_status: status, p_reason: reason?.trim() || null }),
  });
}

export async function listEvaluationEvents(evaluationId: string): Promise<EvaluationEventRecord[]> {
  return request<EvaluationEventRecord[]>(`contractor_evaluation_events?select=*&evaluation_id=eq.${evaluationId}&order=created_at.desc`);
}

export async function listActionPlans(evaluationId: string): Promise<ActionPlanRecord[]> {
  return request<ActionPlanRecord[]>(`evaluation_action_plans?select=*&evaluation_id=eq.${evaluationId}&order=due_date.asc.nullslast,created_at.asc`);
}

export async function createActionPlan(evaluationId: string, input: { title: string; description: string; ownerName: string; dueDate: string }) {
  const session = await getSupabaseSessionForRequest();
  if (!session) throw new Error('Tu sesión expiró.');
  await request<void>('evaluation_action_plans', {
    method: 'POST', headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({
      evaluation_id: evaluationId,
      title: input.title.trim(),
      description: input.description.trim(),
      owner_name: input.ownerName.trim(),
      due_date: input.dueDate,
      status: 'pendiente',
      created_by: session.profileId,
    }),
  });
}

export async function reviewActionPlan(id: string, decision: 'aprobar' | 'devolver' | 'cancelar' | 'reabrir', comment?: string): Promise<void> {
  await request<void>('rpc/review_evaluation_action_plan', {
    method: 'POST',
    body: JSON.stringify({ p_plan_id: id, p_decision: decision, p_comment: comment?.trim() || null }),
  });
}

export async function listActionPlanEvents(actionPlanId: string): Promise<ActionPlanEventRecord[]> {
  return request<ActionPlanEventRecord[]>(`evaluation_action_plan_events?select=*&action_plan_id=eq.${actionPlanId}&order=created_at.desc`);
}

export async function getActionPlanContext(actionPlanId: string): Promise<{ evaluationId: string } | undefined> {
  const rows = await request<Array<{ evaluation_id: string }>>(`evaluation_action_plans?select=evaluation_id&id=eq.${actionPlanId}&limit=1`);
  return rows[0] ? { evaluationId: rows[0].evaluation_id } : undefined;
}

export async function listActionPlanAttachments(actionPlanId: string): Promise<OperationAttachmentRecord[]> {
  return request<OperationAttachmentRecord[]>(`operation_attachments?select=*&action_plan_id=eq.${actionPlanId}&order=created_at.asc`);
}

export async function uploadActionPlanAttachment(actionPlanId: string, file: File): Promise<void> {
  const allowed = [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ];
  if (!allowed.includes(file.type) || file.size < 1 || file.size > 20 * 1024 * 1024) {
    throw new Error('Usa PDF, JPG, PNG o XLSX de hasta 20 MB.');
  }
  const session = await getSupabaseSessionForRequest();
  if (!session) throw new Error('Tu sesión expiró.');
  const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `${session.profileId}/action-plans/${actionPlanId}/${crypto.randomUUID()}-${safe}`;
  const encodedPath = path.split('/').map(encodeURIComponent).join('/');
  const uploaded = await fetch(`${SUPABASE_URL}/storage/v1/object/operation-files/${encodedPath}`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${session._supabase.accessToken}`,
      'Content-Type': file.type,
    },
    body: file,
  });
  if (!uploaded.ok) {
    const body = await uploaded.json().catch(() => ({}));
    throw new Error(body?.message || 'No fue posible subir la evidencia.');
  }
  await request<void>('operation_attachments', {
    method: 'POST', headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({
      action_plan_id: actionPlanId,
      file_name: file.name,
      mime_type: file.type,
      file_size: file.size,
      storage_bucket: 'operation-files',
      storage_path: path,
      uploaded_by: session.profileId,
    }),
  });
}

export async function openOperationAttachment(item: OperationAttachmentRecord): Promise<void> {
  const session = await getSupabaseSessionForRequest();
  if (!session) throw new Error('Tu sesión expiró.');
  const encodedPath = item.storage_path.split('/').map(encodeURIComponent).join('/');
  const response = await fetch(`${SUPABASE_URL}/storage/v1/object/authenticated/${encodeURIComponent(item.storage_bucket)}/${encodedPath}`, {
    headers: { apikey: SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${session._supabase.accessToken}` },
  });
  if (!response.ok) throw new Error('No fue posible abrir la evidencia.');
  const url = URL.createObjectURL(await response.blob());
  window.open(url, '_blank', 'noopener,noreferrer');
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export async function createPayment(projectKey: string, contractorKey: string, input: {
  period: CompliancePeriodRecord; amount: number; invoiceNumber?: string; note?: string;
}) {
  const session = await getSupabaseSessionForRequest();
  if (!session) throw new Error('Tu sesión expiró.');
  if (!Number.isFinite(input.amount) || input.amount <= 0) throw new Error('Ingresa un monto de pago mayor que cero.');
  const accreditation_id = await resolveAccreditation(projectKey, contractorKey);
  await request<void>('payment_cases', {
    method: 'POST', headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({
      accreditation_id,
      period_start: input.period.period_start,
      period_end: input.period.period_end,
      amount: input.amount,
      status: 'observado',
      submission_note: input.note?.trim() || null,
      invoice_number: input.invoiceNumber?.trim() || null,
      submitted_by: session.profileId,
      submitted_at: new Date().toISOString(),
    }),
  });
}

export async function updatePaymentDetails(paymentCaseId: string, input: { amount: number; invoiceNumber?: string; note?: string }) {
  if (!Number.isFinite(input.amount) || input.amount <= 0) throw new Error('Ingresa un monto de pago mayor que cero.');
  await request<void>(`payment_cases?id=eq.${paymentCaseId}`, {
    method: 'PATCH', headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({
      amount: input.amount,
      invoice_number: input.invoiceNumber?.trim() || null,
      submission_note: input.note?.trim() || null,
    }),
  });
}

export async function listPaymentCaseEvents(paymentCaseId: string): Promise<PaymentCaseEventRecord[]> {
  return request<PaymentCaseEventRecord[]>(`payment_case_events?select=*&payment_case_id=eq.${paymentCaseId}&order=created_at.desc`);
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

export async function updateTicketStatus(id: string, status: TicketStatus, resolution?: string) {
  const session = await getSupabaseSessionForRequest();
  if (!session) throw new Error('Tu sesión expiró.');
  const resolved = status === 'resuelto' || status === 'cerrado';
  const cleanResolution = resolution?.trim();
  if (resolved && !cleanResolution) throw new Error('Debes indicar la resolución aplicada.');

  await request<void>(`support_tickets?id=eq.${id}`, {
    method: 'PATCH', headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({
      status,
      resolution: resolved ? cleanResolution : null,
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
  const cleanBody = body.trim();
  if (!cleanBody) throw new Error('Escribe un mensaje antes de enviarlo.');
  if (cleanBody.length > 5000) throw new Error('El mensaje no puede superar los 5.000 caracteres.');
  await request<void>('support_ticket_messages', {
    method: 'POST', headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ ticket_id: ticketId, author_id: session.profileId, body: cleanBody, is_internal: internal }),
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
