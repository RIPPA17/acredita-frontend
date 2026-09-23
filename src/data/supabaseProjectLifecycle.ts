import { getSupabaseSessionForRequest, SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from './supabaseAuth';
import { hydrateCoreDataFromSupabase } from './supabaseCoreData';
import { hydrateOperationalDataFromSupabase } from './supabaseOperationalData';

async function parseResponse(response: Response): Promise<unknown> {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = (payload as any)?.message || (payload as any)?.hint || (payload as any)?.error_description || (payload as any)?.error || 'No fue posible cerrar el proyecto.';
    throw new Error(message);
  }
  return payload;
}

export async function archiveMandanteProject(projectKey: string, reason: string): Promise<void> {
  const session = await getSupabaseSessionForRequest();
  if (!session || !['mandante', 'admin'].includes(session.role)) {
    throw new Error('Tu sesión no permite cerrar proyectos.');
  }
  const normalizedReason = reason.trim();
  if (normalizedReason.length < 3) {
    throw new Error('Indica un motivo de cierre de al menos 3 caracteres.');
  }

  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/archive_project`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${session._supabase.accessToken}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ p_project_key: projectKey, p_reason: normalizedReason }),
  });
  await parseResponse(response);

  // El cierre cambia varias capas a la vez (relaciones, trabajadores,
  // servicios, obligaciones y períodos). Rehidratar evita que una copia local
  // antigua intente reactivar algo que ya pasó a historial.
  await hydrateCoreDataFromSupabase(session);
  await hydrateOperationalDataFromSupabase(session);
}
