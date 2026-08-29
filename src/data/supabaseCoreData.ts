import type { Contratista, Mandante, Proyecto, Requisito } from '../types';
import type { SupabaseUserSession } from './supabaseAuth';
import { getRuntimeArray, purgeLegacyBusinessStorage, setRuntimeArray } from './runtimeDataStore';

const SUPABASE_URL = ((import.meta as any).env?.VITE_SUPABASE_URL as string | undefined)
  || 'https://jwlscxbmttpicwljozwf.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = ((import.meta as any).env?.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined)
  || 'sb_publishable_27fQcRn8vsWGpzjjE-XIAQ_0Du8m0UP';


type BackendMandante = {
  id: string;
  name: string;
  rut: string | null;
  integration_key: string | null;
  is_active: boolean;
};

type BackendProject = {
  id: string;
  mandante_id: string;
  name: string;
  status: 'draft' | 'active' | 'archived';
  integration_key: string | null;
};

type BackendContratista = {
  id: string;
  name: string;
  rut: string | null;
  integration_key: string | null;
  is_active: boolean;
};

type BackendAccreditation = {
  id: string;
  project_id: string;
  contratista_id: string;
  is_active: boolean;
};

type BackendRequirement = {
  id: string;
  project_id: string;
  integration_key: string | null;
  name: string;
  category: string | null;
  target: 'empresa' | 'trabajador';
  is_required: boolean;
  frequency: string;
  validity_days: number | null;
  alert_days: number;
  criticality: Requisito['criticidad'];
  is_active: boolean;
  sort_order: number;
};

type CoreRows = {
  mandantes: BackendMandante[];
  projects: BackendProject[];
  contratistas: BackendContratista[];
  accreditations: BackendAccreditation[];
  requirements: BackendRequirement[];
};

function apiHeaders(accessToken: string, extra: HeadersInit = {}): HeadersInit {
  return {
    apikey: SUPABASE_PUBLISHABLE_KEY,
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
    ...extra,
  };
}

async function parseResponse<T>(response: Response): Promise<T> {
  if (response.status === 204) return undefined as T;
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload?.message || payload?.hint || payload?.error_description || payload?.error || 'Error al sincronizar con Supabase';
    throw new Error(message);
  }
  return payload as T;
}

async function selectRows<T>(table: string, accessToken: string, select: string): Promise<T[]> {
  const url = new URL(`${SUPABASE_URL}/rest/v1/${table}`);
  url.searchParams.set('select', select);
  const response = await fetch(url.toString(), {
    headers: apiHeaders(accessToken, { Accept: 'application/json' }),
  });
  return parseResponse<T[]>(response);
}

async function patchRows(table: string, accessToken: string, filters: Record<string, string>, body: Record<string, unknown>): Promise<void> {
  const url = new URL(`${SUPABASE_URL}/rest/v1/${table}`);
  Object.entries(filters).forEach(([key, value]) => url.searchParams.set(key, value));
  const response = await fetch(url.toString(), {
    method: 'PATCH',
    headers: apiHeaders(accessToken, { Prefer: 'return=minimal' }),
    body: JSON.stringify(body),
  });
  await parseResponse<void>(response);
}

async function insertRows<T extends Record<string, unknown>>(
  table: string,
  accessToken: string,
  rows: T | T[],
  onConflict?: string,
): Promise<void> {
  const url = new URL(`${SUPABASE_URL}/rest/v1/${table}`);
  if (onConflict) url.searchParams.set('on_conflict', onConflict);
  const response = await fetch(url.toString(), {
    method: 'POST',
    headers: apiHeaders(accessToken, {
      Prefer: onConflict ? 'resolution=merge-duplicates,return=minimal' : 'return=minimal',
    }),
    body: JSON.stringify(rows),
  });
  await parseResponse<void>(response);
}

function readArray<T>(key: string, fallback: T[] = []): T[] {
  return getRuntimeArray<T>(key, fallback);
}

function writeArray(key: string, data: unknown[]): void {
  setRuntimeArray(key, data);
}

function frontendStatus(status: BackendProject['status']): string {
  if (status === 'archived') return 'Archivado';
  if (status === 'draft') return 'Borrador';
  return 'Activo';
}

function backendStatus(status: string): BackendProject['status'] {
  const normalized = (status || '').trim().toLowerCase();
  if (normalized.includes('archiv')) return 'archived';
  if (normalized.includes('borr') || normalized.includes('draft')) return 'draft';
  return 'active';
}

function frontendFrequency(frequency: string): string {
  switch (frequency) {
    case 'mensual': return 'Mensual';
    case 'seis_meses': return '6 meses';
    case 'un_ano': return '1 año';
    case 'sin_vencimiento': return 'Indefinido';
    case 'personalizada': return 'Personalizada';
    default: return 'Por Proyecto';
  }
}

function backendFrequency(frequency: string): { frequency: string; validityDays: number | null } {
  const normalized = (frequency || '').trim().toLowerCase();
  if (normalized.includes('mens')) return { frequency: 'mensual', validityDays: 30 };
  if (normalized.includes('6') || normalized.includes('seis')) return { frequency: 'seis_meses', validityDays: 180 };
  if (normalized.includes('1 año') || normalized.includes('un año') || normalized.includes('anual')) return { frequency: 'un_ano', validityDays: 365 };
  if (normalized.includes('indef') || normalized.includes('sin venc')) return { frequency: 'sin_vencimiento', validityDays: null };
  if (normalized.includes('personal')) return { frequency: 'personalizada', validityDays: null };
  return { frequency: 'por_obra', validityDays: null };
}

function fallbackMandante(id: string): Mandante | undefined {
  return readArray<Mandante>('acredita_mandantes').find(item => item.id === id);
}

function fallbackProject(id: string): Proyecto | undefined {
  return readArray<Proyecto>('acredita_proyectos').find(item => item.id === id);
}

function fallbackContractor(id: string): Contratista | undefined {
  return readArray<Contratista>('acredita_contratistas').find(item => item.id === id);
}

async function fetchCoreRows(accessToken: string): Promise<CoreRows> {
  const [mandantes, projects, contratistas, accreditations, requirements] = await Promise.all([
    selectRows<BackendMandante>('mandantes', accessToken, 'id,name,rut,integration_key,is_active'),
    selectRows<BackendProject>('projects', accessToken, 'id,mandante_id,name,status,integration_key'),
    selectRows<BackendContratista>('contratistas', accessToken, 'id,name,rut,integration_key,is_active'),
    selectRows<BackendAccreditation>('accreditations', accessToken, 'id,project_id,contratista_id,is_active'),
    selectRows<BackendRequirement>('requirements', accessToken, 'id,project_id,integration_key,name,category,target,is_required,frequency,validity_days,alert_days,criticality,is_active,sort_order'),
  ]);
  return { mandantes, projects, contratistas, accreditations, requirements };
}

function scopeLocalProjects(session: SupabaseUserSession, projects: Proyecto[]): Proyecto[] {
  if (session.role === 'admin') return projects;
  if (session.role === 'mandante') return projects.filter(project => project.mandanteId === session.mandanteId);
  return projects.filter(project => project.contratistas.includes(session.contratistaId || ''));
}

function scopeLocalContractors(session: SupabaseUserSession, contractors: Contratista[], projects: Proyecto[]): Contratista[] {
  if (session.role === 'admin') return contractors;
  if (session.role === 'contratista') return contractors.filter(contractor => contractor.id === session.contratistaId);
  const allowed = new Set(scopeLocalProjects(session, projects).flatMap(project => project.contratistas));
  return contractors.filter(contractor => allowed.has(contractor.id));
}

function scopeLocalRequirements(session: SupabaseUserSession, requirements: Requisito[], projects: Proyecto[]): Requisito[] {
  if (session.role === 'contratista') return [];
  const allowedProjects = new Set(scopeLocalProjects(session, projects).map(project => project.id));
  return requirements.filter(requirement => allowedProjects.has(requirement.proyectoId));
}

export async function hydrateCoreDataFromSupabase(session: SupabaseUserSession): Promise<void> {
  if (typeof window === 'undefined') return;
  const rows = await fetchCoreRows(session._supabase.accessToken);

  const mandanteKeyByUuid = new Map(rows.mandantes.map(row => [row.id, row.integration_key || row.id]));
  const projectKeyByUuid = new Map(rows.projects.map(row => [row.id, row.integration_key || row.id]));
  const contractorKeyByUuid = new Map(rows.contratistas.map(row => [row.id, row.integration_key || row.id]));

  const activeContractorsByProject = new Map<string, string[]>();
  rows.accreditations.filter(row => row.is_active).forEach(row => {
    const projectKey = projectKeyByUuid.get(row.project_id);
    const contractorKey = contractorKeyByUuid.get(row.contratista_id);
    if (!projectKey || !contractorKey) return;
    const current = activeContractorsByProject.get(projectKey) || [];
    current.push(contractorKey);
    activeContractorsByProject.set(projectKey, current);
  });

  const frontendMandantes: Mandante[] = rows.mandantes
    .filter(row => row.integration_key)
    .map(row => {
      const id = row.integration_key as string;
      const fallback = fallbackMandante(id);
      const proyectos = rows.projects
        .filter(project => project.mandante_id === row.id && project.integration_key)
        .map(project => project.integration_key as string);
      return {
        ...(fallback || { id, nombre: row.name, rut: row.rut || '', proyectos: [] }),
        id,
        nombre: row.name,
        rut: row.rut || fallback?.rut || '',
        proyectos,
      };
    });

  const frontendProjects: Proyecto[] = rows.projects
    .filter(row => row.integration_key && mandanteKeyByUuid.has(row.mandante_id))
    .map(row => {
      const id = row.integration_key as string;
      const fallback = fallbackProject(id);
      return {
        ...(fallback || { id, nombre: row.name, mandanteId: mandanteKeyByUuid.get(row.mandante_id)!, estado: 'Activo', contratistas: [] }),
        id,
        nombre: row.name,
        mandanteId: mandanteKeyByUuid.get(row.mandante_id)!,
        estado: frontendStatus(row.status),
        contratistas: activeContractorsByProject.get(id) || [],
      };
    });

  const projectIdsByContractor = new Map<string, string[]>();
  frontendProjects.forEach(project => {
    project.contratistas.forEach(contractorId => {
      const current = projectIdsByContractor.get(contractorId) || [];
      current.push(project.id);
      projectIdsByContractor.set(contractorId, current);
    });
  });

  const frontendContractors: Contratista[] = rows.contratistas
    .filter(row => row.integration_key)
    .map(row => {
      const id = row.integration_key as string;
      const fallback = fallbackContractor(id);
      return {
        ...(fallback || { id, nombre: row.name, rut: row.rut || '', proyectos: [], documentos: [] }),
        id,
        nombre: row.name,
        rut: row.rut || fallback?.rut || '',
        proyectos: projectIdsByContractor.get(id) || [],
      };
    });

  const frontendRequirements: Requisito[] = rows.requirements
    .filter(row => projectKeyByUuid.has(row.project_id))
    .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))
    .map(row => ({
      id: row.integration_key || row.id,
      nombre: row.name,
      categoria: (row.category || 'Laboral') as Requisito['categoria'],
      destino: row.target,
      obligatorio: row.is_required,
      frecuencia: frontendFrequency(row.frequency),
      alertaDias: row.alert_days,
      criticidad: row.criticality,
      proyectoId: projectKeyByUuid.get(row.project_id)!,
      activo: row.is_active,
    }));

  writeArray('acredita_mandantes', frontendMandantes);
  writeArray('acredita_proyectos', frontendProjects);
  writeArray('acredita_contratistas', frontendContractors);
  writeArray('acredita_requisitos', frontendRequirements);
}

async function syncMandantes(
  session: SupabaseUserSession,
  rows: CoreRows,
  mandantes: Mandante[],
): Promise<void> {
  if (session.role !== 'admin') return;
  const token = session._supabase.accessToken;
  const backendByKey = new Map(rows.mandantes.filter(row => row.integration_key).map(row => [row.integration_key as string, row]));

  for (const mandante of mandantes) {
    const existing = backendByKey.get(mandante.id);
    if (existing) {
      await patchRows('mandantes', token, { integration_key: `eq.${mandante.id}` }, {
        name: mandante.nombre,
        rut: mandante.rut || null,
        legal_name: mandante.nombre,
        is_active: true,
        updated_at: new Date().toISOString(),
      });
    } else {
      await insertRows('mandantes', token, {
        integration_key: mandante.id,
        name: mandante.nombre,
        rut: mandante.rut || null,
        legal_name: mandante.nombre,
        is_active: true,
      }, 'integration_key');
    }
  }
}

async function syncContractors(
  session: SupabaseUserSession,
  rows: CoreRows,
  projects: Proyecto[],
  contractors: Contratista[],
): Promise<Map<string, string>> {
  const token = session._supabase.accessToken;
  const scoped = scopeLocalContractors(session, contractors, projects);
  const backendByKey = new Map(rows.contratistas.filter(row => row.integration_key).map(row => [row.integration_key as string, row]));

  for (const contractor of scoped) {
    const existing = backendByKey.get(contractor.id);
    if (existing) {
      const canUpdate = session.role === 'admin' || (session.role === 'contratista' && contractor.id === session.contratistaId);
      if (canUpdate) {
        await patchRows('contratistas', token, { integration_key: `eq.${contractor.id}` }, {
          name: contractor.nombre,
          rut: contractor.rut || null,
          legal_name: contractor.nombre,
          is_active: true,
          updated_at: new Date().toISOString(),
        });
      }
      continue;
    }

    if (session.role === 'admin' || session.role === 'mandante') {
      await insertRows('contratistas', token, {
        integration_key: contractor.id,
        name: contractor.nombre,
        rut: contractor.rut || null,
        legal_name: contractor.nombre,
        is_active: true,
      }, 'integration_key');
    }
  }

  const refreshed = await selectRows<BackendContratista>('contratistas', token, 'id,name,rut,integration_key,is_active');
  return new Map(refreshed.filter(row => row.integration_key).map(row => [row.integration_key as string, row.id]));
}

async function syncProjects(
  session: SupabaseUserSession,
  rows: CoreRows,
  localProjects: Proyecto[],
): Promise<Map<string, string>> {
  const token = session._supabase.accessToken;
  if (session.role === 'contratista') {
    return new Map(rows.projects.filter(row => row.integration_key).map(row => [row.integration_key as string, row.id]));
  }

  const mandanteUuidByKey = new Map(rows.mandantes.filter(row => row.integration_key).map(row => [row.integration_key as string, row.id]));
  const backendByKey = new Map(rows.projects.filter(row => row.integration_key).map(row => [row.integration_key as string, row]));
  const scoped = scopeLocalProjects(session, localProjects);

  for (const project of scoped) {
    const mandanteUuid = mandanteUuidByKey.get(project.mandanteId);
    if (!mandanteUuid) continue;
    const existing = backendByKey.get(project.id);
    if (existing) {
      await patchRows('projects', token, { integration_key: `eq.${project.id}` }, {
        name: project.nombre,
        status: backendStatus(project.estado),
        mandante_id: mandanteUuid,
        updated_at: new Date().toISOString(),
      });
    } else {
      await insertRows('projects', token, {
        integration_key: project.id,
        mandante_id: mandanteUuid,
        name: project.nombre,
        code: project.id.toUpperCase().slice(0, 64),
        status: backendStatus(project.estado),
      }, 'integration_key');
    }
  }

  const refreshed = await selectRows<BackendProject>('projects', token, 'id,mandante_id,name,status,integration_key');
  return new Map(refreshed.filter(row => row.integration_key).map(row => [row.integration_key as string, row.id]));
}

async function syncAccreditations(
  session: SupabaseUserSession,
  projectUuidByKey: Map<string, string>,
  contractorUuidByKey: Map<string, string>,
  localProjects: Proyecto[],
): Promise<void> {
  if (session.role === 'contratista') return;
  const token = session._supabase.accessToken;
  const backendAccreditations = await selectRows<BackendAccreditation>('accreditations', token, 'id,project_id,contratista_id,is_active');
  const scopedProjects = scopeLocalProjects(session, localProjects);
  const scopedProjectUuids = new Set(scopedProjects.map(project => projectUuidByKey.get(project.id)).filter(Boolean) as string[]);
  const desired = new Set<string>();

  for (const project of scopedProjects) {
    const projectUuid = projectUuidByKey.get(project.id);
    if (!projectUuid) continue;
    for (const contractorKey of project.contratistas) {
      const contractorUuid = contractorUuidByKey.get(contractorKey);
      if (!contractorUuid) continue;
      const key = `${projectUuid}:${contractorUuid}`;
      desired.add(key);
      const existing = backendAccreditations.find(row => row.project_id === projectUuid && row.contratista_id === contractorUuid);
      if (existing) {
        if (!existing.is_active) {
          await patchRows('accreditations', token, { id: `eq.${existing.id}` }, { is_active: true, updated_at: new Date().toISOString() });
        }
      } else {
        await insertRows('accreditations', token, { project_id: projectUuid, contratista_id: contractorUuid, is_active: true });
      }
    }
  }

  for (const accreditation of backendAccreditations) {
    if (!scopedProjectUuids.has(accreditation.project_id) || !accreditation.is_active) continue;
    if (!desired.has(`${accreditation.project_id}:${accreditation.contratista_id}`)) {
      await patchRows('accreditations', token, { id: `eq.${accreditation.id}` }, { is_active: false, updated_at: new Date().toISOString() });
    }
  }
}

async function syncRequirements(
  session: SupabaseUserSession,
  projectUuidByKey: Map<string, string>,
  localProjects: Proyecto[],
  localRequirements: Requisito[],
): Promise<void> {
  if (session.role === 'contratista') return;
  const token = session._supabase.accessToken;
  const scoped = scopeLocalRequirements(session, localRequirements, localProjects);
  const payload = scoped.map((requirement, index) => {
    const frequency = backendFrequency(requirement.frecuencia);
    return {
      project_id: projectUuidByKey.get(requirement.proyectoId),
      integration_key: requirement.id,
      name: requirement.nombre,
      category: requirement.categoria,
      target: requirement.destino,
      is_required: requirement.obligatorio,
      frequency: frequency.frequency,
      validity_days: frequency.validityDays,
      alert_days: Math.max(0, requirement.alertaDias || 0),
      criticality: requirement.criticidad,
      is_active: requirement.activo !== false,
      sort_order: index + 1,
    };
  }).filter(row => Boolean(row.project_id));

  if (payload.length > 0) await insertRows('requirements', token, payload, 'integration_key');

  const backend = await selectRows<BackendRequirement>('requirements', token, 'id,project_id,integration_key,name,category,target,is_required,frequency,validity_days,alert_days,criticality,is_active,sort_order');
  const scopedProjectUuids = new Set(scopeLocalProjects(session, localProjects).map(project => projectUuidByKey.get(project.id)).filter(Boolean) as string[]);
  const desiredKeys = new Set(payload.map(row => row.integration_key));

  for (const requirement of backend) {
    if (!scopedProjectUuids.has(requirement.project_id) || !requirement.integration_key || desiredKeys.has(requirement.integration_key) || !requirement.is_active) continue;
    await patchRows('requirements', token, { id: `eq.${requirement.id}` }, { is_active: false, updated_at: new Date().toISOString() });
  }
}

export async function pushCoreDataToSupabase(session: SupabaseUserSession): Promise<void> {
  if (typeof window === 'undefined') return;
  const mandantes = readArray<Mandante>('acredita_mandantes', MANDANTES);
  const projects = readArray<Proyecto>('acredita_proyectos', PROYECTOS);
  const contractors = readArray<Contratista>('acredita_contratistas', CONTRATISTAS);
  const requirements = readArray<Requisito>('acredita_requisitos', []);
  const rows = await fetchCoreRows(session._supabase.accessToken);

  await syncMandantes(session, rows, mandantes);
  const rowsAfterMandantes = await fetchCoreRows(session._supabase.accessToken);
  const contractorUuidByKey = await syncContractors(session, rowsAfterMandantes, projects, contractors);
  const refreshedRows = await fetchCoreRows(session._supabase.accessToken);
  const projectUuidByKey = await syncProjects(session, refreshedRows, projects);
  await syncAccreditations(session, projectUuidByKey, contractorUuidByKey, projects);
  await syncRequirements(session, projectUuidByKey, projects, requirements);
}


export async function prepareCoreDataForSession(session: SupabaseUserSession): Promise<void> {
  if (typeof window === 'undefined') return;
  purgeLegacyBusinessStorage();
  await hydrateCoreDataFromSupabase(session);
}

