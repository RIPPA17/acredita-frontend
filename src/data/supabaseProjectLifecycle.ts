import { getSupabaseSessionForRequest, SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from './supabaseAuth';
import { hydrateCoreDataFromSupabase } from './supabaseCoreData';
import { hydrateOperationalDataFromSupabase } from './supabaseOperationalData';
import { getRuntimeArray, setRuntimeArray } from './businessRuntimeCache';
import type { Proyecto } from '../types';

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
  const payload = await parseResponse(response) as any;
  const row = Array.isArray(payload) ? payload[0] : payload;
  const projects = getRuntimeArray<Proyecto>('acredita_proyectos', []);
  setRuntimeArray<Proyecto>('acredita_proyectos', projects.map(project => {
    if (project.id !== projectKey) return project;
    const historical = [...new Set([...(project.contratistas || []), ...(project.contratistasHistoricos || [])])];
    return {
      ...project,
      estado: 'Archivado',
      fechaTermino: row?.ends_at || project.fechaTermino,
      archivadoEn: row?.archived_at || new Date().toISOString(),
      archivadoPor: row?.archived_by || project.archivadoPor,
      motivoArchivo: row?.archive_reason || normalizedReason,
      contratistas: historical,
      contratistasActivos: [],
      contratistasHistoricos: historical,
    };
  }));

  // El cierre ya fue confirmado por la base. Intentamos refrescar todas las
  // capas para mostrar el snapshot definitivo, pero un fallo de refresco no
  // debe presentar el cierre exitoso como si hubiera fallado.
  try {
    await hydrateCoreDataFromSupabase(session);
    await hydrateOperationalDataFromSupabase(session);
  } catch (error) {
    console.warn('El proyecto se cerró correctamente, pero no fue posible refrescar toda la vista en este instante.', error);
  }
}
