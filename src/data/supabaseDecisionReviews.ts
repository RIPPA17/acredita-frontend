import { restoreSupabaseSession, SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from './supabaseAuth';
import { getRuntimeArray } from './businessRuntimeCache';

export type DecisionReviewType = 'accreditation' | 'access' | 'payment' | 'work' | 'assignment';
export type DecisionReviewStatus = 'requested' | 'in_review' | 'upheld' | 'overridden' | 'closed';

export interface RuntimeDecisionOverride {
  accreditationId: string;
  contractorKey: string;
  projectKey: string;
  workerRut?: string;
  decisionType: DecisionReviewType;
  overrideValue: string;
  overrideReason: string;
  overrideUntil: string;
  reviewedAt?: string | null;
}

export function getActiveProjectDecisionOverride(
  contractorKey: string,
  projectKey: string,
  decisionType: DecisionReviewType,
): RuntimeDecisionOverride | undefined {
  const now = Date.now();
  return getRuntimeArray<RuntimeDecisionOverride>('acredita_decision_overrides', []).find(item =>
    item.contractorKey === contractorKey
    && item.projectKey === projectKey
    && item.decisionType === decisionType
    && !item.workerRut
    && new Date(item.overrideUntil).getTime() > now
  );
}

export interface DecisionReviewRow {
  id: string;
  accreditation_id: string;
  worker_id: string | null;
  decision_type: DecisionReviewType;
  automated_state_snapshot: string;
  explanation_snapshot: Record<string, unknown>;
  request_reason: string;
  requester_viewpoint: string | null;
  status: DecisionReviewStatus;
  override_value: string | null;
  override_reason: string | null;
  override_until: string | null;
  requested_by: string;
  reviewed_by: string | null;
  requested_at: string;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

function headers(token: string, prefer?: string): HeadersInit {
  return {
    apikey: SUPABASE_PUBLISHABLE_KEY,
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...(prefer ? { Prefer: prefer } : {}),
  };
}

async function payload<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = body?.message || body?.hint || body?.error_description || body?.error || 'No fue posible registrar la revisión humana.';
    throw new Error(message);
  }
  return body as T;
}

async function select<T>(table: string, token: string, params: Record<string, string>): Promise<T[]> {
  const url = new URL(`${SUPABASE_URL}/rest/v1/${table}`);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  const response = await fetch(url.toString(), { headers: headers(token) });
  return payload<T[]>(response);
}

async function resolveContractorAccreditation(projectKey: string) {
  const session = await restoreSupabaseSession();
  if (!session) throw new Error('La sesión expiró. Vuelve a iniciar sesión.');
  if (session.role !== 'contratista' || !session.contratistaBackendId) {
    throw new Error('Esta solicitud debe iniciarse desde una cuenta contratista.');
  }

  const projects = await select<{ id: string }>('projects', session._supabase.accessToken, {
    select: 'id',
    integration_key: `eq.${projectKey}`,
    limit: '1',
  });
  const project = projects[0];
  if (!project) throw new Error('No encontramos el proyecto en Supabase.');

  const accreditations = await select<{ id: string }>('accreditations', session._supabase.accessToken, {
    select: 'id',
    project_id: `eq.${project.id}`,
    contratista_id: `eq.${session.contratistaBackendId}`,
    is_active: 'eq.true',
    limit: '1',
  });
  const accreditation = accreditations[0];
  if (!accreditation) throw new Error('No encontramos una acreditación activa para este proyecto.');

  return { session, accreditationId: accreditation.id };
}

export async function requestProjectDecisionReview(input: {
  projectKey: string;
  decisionType: 'access' | 'payment' | 'accreditation';
  automatedState: string;
  requestReason: string;
  viewpoint?: string;
  explanation?: Record<string, unknown>;
}): Promise<{ row: DecisionReviewRow; alreadyOpen: boolean }> {
  const reason = input.requestReason.trim();
  if (reason.length < 8) throw new Error('Explica brevemente por qué solicitas la revisión.');
  const { session, accreditationId } = await resolveContractorAccreditation(input.projectKey);
  const token = session._supabase.accessToken;

  const open = await select<DecisionReviewRow>('privacy_decision_reviews', token, {
    select: '*',
    accreditation_id: `eq.${accreditationId}`,
    decision_type: `eq.${input.decisionType}`,
    worker_id: 'is.null',
    status: 'in.(requested,in_review)',
    order: 'requested_at.desc',
    limit: '1',
  });
  if (open[0]) return { row: open[0], alreadyOpen: true };

  const response = await fetch(`${SUPABASE_URL}/rest/v1/privacy_decision_reviews`, {
    method: 'POST',
    headers: headers(token, 'return=representation'),
    body: JSON.stringify({
      accreditation_id: accreditationId,
      worker_id: null,
      decision_type: input.decisionType,
      automated_state_snapshot: input.automatedState,
      explanation_snapshot: input.explanation || {},
      request_reason: reason,
      requester_viewpoint: input.viewpoint?.trim() || null,
      requested_by: session.profileId,
      status: 'requested',
    }),
  });
  const rows = await payload<DecisionReviewRow[]>(response);
  if (!rows[0]) throw new Error('La revisión se registró sin respuesta utilizable.');
  return { row: rows[0], alreadyOpen: false };
}
