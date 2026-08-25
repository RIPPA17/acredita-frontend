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
  acreditacionAprobada: true,
  cambioEstadoTrabajador: false,
};

type PreferenceRow = {
  document_rejected: boolean;
  document_expiring: boolean;
  accreditation_approved: boolean;
  worker_status: boolean;
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
  url.searchParams.set('select', 'document_rejected,document_expiring,accreditation_approved,worker_status');
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
    acreditacionAprobada: row.accreditation_approved,
    cambioEstadoTrabajador: row.worker_status,
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
      accreditation_approved: preferencias.acreditacionAprobada,
      worker_status: preferencias.cambioEstadoTrabajador,
    }),
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
