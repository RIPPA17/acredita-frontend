import type { PreferenciasNotificacionesContratista } from '../types';
import {
  getSupabaseSessionForRequest,
  SUPABASE_PUBLISHABLE_KEY,
  SUPABASE_URL,
  type SupabaseUserSession,
} from './supabaseAuth';

export const DEFAULT_NOTIFICATION_PREFERENCES: PreferenciasNotificacionesContratista = {
  documentoRechazado: true,
  documentoPorVencer: true,
  documentoActualizado: true,
  acreditacionAprobada: true,
  cambioEstadoTrabajador: false,
  estadoPago: true,
  soporteActualizado: true,
  correoHabilitado: false,
  correoSoloCriticas: true,
};

export type StoredNotificationStatus = 'active' | 'resolved';
export type StoredNotificationCategory = 'accion' | 'preventiva' | 'revision' | 'positiva' | 'informativa';
export type StoredNotificationSeverity = 'critical' | 'action' | 'preventive' | 'info';

export interface StoredNotification {
  key: string;
  eventType: string;
  category: StoredNotificationCategory;
  severity: StoredNotificationSeverity;
  status: StoredNotificationStatus;
  title: string;
  body: string;
  actionLabel: string;
  actionKind: 'documentos' | 'trabajador' | 'acreditacion' | 'operacion' | 'soporte' | 'proyecto';
  projectKey?: string;
  workerRut?: string;
  requirementKey?: string;
  paymentCaseId?: string;
  occurredAt: string;
  resolvedAt?: string;
  occurrenceCount: number;
}

type PreferenceRow = {
  document_rejected: boolean;
  document_expiring: boolean;
  document_updates: boolean;
  accreditation_approved: boolean;
  worker_status: boolean;
  payment_status: boolean;
  support_updates: boolean;
  email_enabled: boolean;
  email_critical_only: boolean;
};

type NotificationRow = {
  notification_key: string;
  event_type: string;
  category: StoredNotificationCategory;
  severity: StoredNotificationSeverity;
  status: StoredNotificationStatus;
  title: string;
  body: string;
  action_label: string;
  action_kind: StoredNotification['actionKind'];
  project_key: string | null;
  worker_rut: string | null;
  requirement_key: string | null;
  payment_case_id: string | null;
  occurred_at: string;
  resolved_at: string | null;
  occurrence_count: number;
};

type ReadRow = { notification_key: string };

async function requireSession(sessionHint?: SupabaseUserSession | null): Promise<SupabaseUserSession> {
  const session = await getSupabaseSessionForRequest(sessionHint);
  if (!session) throw new Error('Sesión expirada. Inicia sesión nuevamente.');
  return session;
}

async function parseResponse<T>(response: Response): Promise<T> {
  if (response.status === 204) return undefined as T;
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload?.message || payload?.details || payload?.hint || payload?.error || 'Error al guardar notificaciones';
    throw new Error(message);
  }
  return payload as T;
}

function headers(accessToken: string, prefer?: string): HeadersInit {
  return {
    apikey: SUPABASE_PUBLISHABLE_KEY,
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...(prefer ? { Prefer: prefer } : {}),
  };
}

function assertOwnProfile(session: SupabaseUserSession, profileId: string) {
  if (session.profileId !== profileId) throw new Error('No puedes modificar notificaciones de otra cuenta.');
}

export async function loadNotificationPreferences(
  profileId: string,
  sessionHint?: SupabaseUserSession | null,
): Promise<PreferenciasNotificacionesContratista> {
  const session = await requireSession(sessionHint);
  assertOwnProfile(session, profileId);
  const url = new URL(`${SUPABASE_URL}/rest/v1/notification_preferences`);
  url.searchParams.set('select', 'document_rejected,document_expiring,document_updates,accreditation_approved,worker_status,payment_status,support_updates,email_enabled,email_critical_only');
  url.searchParams.set('profile_id', `eq.${profileId}`);
  url.searchParams.set('limit', '1');
  const rows = await parseResponse<PreferenceRow[]>(await fetch(url.toString(), {
    headers: headers(session._supabase.accessToken),
  }));
  const row = rows[0];
  if (!row) return { ...DEFAULT_NOTIFICATION_PREFERENCES };
  return {
    documentoRechazado: row.document_rejected,
    documentoPorVencer: row.document_expiring,
    documentoActualizado: row.document_updates,
    acreditacionAprobada: row.accreditation_approved,
    cambioEstadoTrabajador: row.worker_status,
    estadoPago: row.payment_status,
    soporteActualizado: row.support_updates,
    correoHabilitado: row.email_enabled,
    correoSoloCriticas: row.email_critical_only,
  };
}

export async function saveNotificationPreferences(
  profileId: string,
  preferencias: PreferenciasNotificacionesContratista,
  sessionHint?: SupabaseUserSession | null,
): Promise<void> {
  const session = await requireSession(sessionHint);
  assertOwnProfile(session, profileId);
  const url = new URL(`${SUPABASE_URL}/rest/v1/notification_preferences`);
  url.searchParams.set('on_conflict', 'profile_id');
  await parseResponse(await fetch(url.toString(), {
    method: 'POST',
    headers: headers(session._supabase.accessToken, 'resolution=merge-duplicates,return=minimal'),
    body: JSON.stringify({
      profile_id: profileId,
      document_rejected: preferencias.documentoRechazado,
      document_expiring: preferencias.documentoPorVencer,
      document_updates: preferencias.documentoActualizado,
      accreditation_approved: preferencias.acreditacionAprobada,
      worker_status: preferencias.cambioEstadoTrabajador,
      payment_status: preferencias.estadoPago,
      support_updates: preferencias.soporteActualizado,
      email_enabled: preferencias.correoHabilitado,
      email_critical_only: preferencias.correoSoloCriticas,
    }),
  }));
}

export async function loadStoredNotifications(
  profileId: string,
  sessionHint?: SupabaseUserSession | null,
): Promise<StoredNotification[]> {
  const session = await requireSession(sessionHint);
  assertOwnProfile(session, profileId);
  const url = new URL(`${SUPABASE_URL}/rest/v1/notifications`);
  url.searchParams.set('select', 'notification_key,event_type,category,severity,status,title,body,action_label,action_kind,project_key,worker_rut,requirement_key,payment_case_id,occurred_at,resolved_at,occurrence_count');
  url.searchParams.set('recipient_profile_id', `eq.${profileId}`);
  url.searchParams.set('order', 'occurred_at.desc');
  url.searchParams.set('limit', '150');
  const rows = await parseResponse<NotificationRow[]>(await fetch(url.toString(), {
    headers: headers(session._supabase.accessToken),
  }));
  return rows.map(row => ({
    key: row.notification_key,
    eventType: row.event_type,
    category: row.category,
    severity: row.severity,
    status: row.status,
    title: row.title,
    body: row.body,
    actionLabel: row.action_label,
    actionKind: row.action_kind,
    projectKey: row.project_key || undefined,
    workerRut: row.worker_rut || undefined,
    requirementKey: row.requirement_key || undefined,
    paymentCaseId: row.payment_case_id || undefined,
    occurredAt: row.occurred_at,
    resolvedAt: row.resolved_at || undefined,
    occurrenceCount: row.occurrence_count,
  }));
}

export async function loadReadNotificationKeys(
  profileId: string,
  sessionHint?: SupabaseUserSession | null,
): Promise<Set<string>> {
  const session = await requireSession(sessionHint);
  assertOwnProfile(session, profileId);
  const url = new URL(`${SUPABASE_URL}/rest/v1/notification_reads`);
  url.searchParams.set('select', 'notification_key');
  url.searchParams.set('profile_id', `eq.${profileId}`);
  const rows = await parseResponse<ReadRow[]>(await fetch(url.toString(), {
    headers: headers(session._supabase.accessToken),
  }));
  return new Set(rows.map(row => row.notification_key));
}

export async function markNotificationKeysRead(
  profileId: string,
  keys: string[],
  sessionHint?: SupabaseUserSession | null,
): Promise<void> {
  const uniqueKeys = [...new Set(keys.filter(Boolean))];
  if (!uniqueKeys.length) return;
  const session = await requireSession(sessionHint);
  assertOwnProfile(session, profileId);
  const url = new URL(`${SUPABASE_URL}/rest/v1/notification_reads`);
  url.searchParams.set('on_conflict', 'profile_id,notification_key');
  await parseResponse(await fetch(url.toString(), {
    method: 'POST',
    headers: headers(session._supabase.accessToken, 'resolution=merge-duplicates,return=minimal'),
    body: JSON.stringify(uniqueKeys.map(notification_key => ({
      profile_id: profileId,
      notification_key,
      read_at: new Date().toISOString(),
    }))),
  }));
}
