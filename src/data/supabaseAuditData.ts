import { restoreSupabaseSession } from './supabaseAuth';

const SUPABASE_URL = ((import.meta as any).env?.VITE_SUPABASE_URL as string | undefined)
  || 'https://jwlscxbmttpicwljozwf.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = ((import.meta as any).env?.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined)
  || 'sb_publishable_27fQcRn8vsWGpzjjE-XIAQ_0Du8m0UP';

type AuditRow = {
  id: number;
  actor_profile_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  project_id: string | null;
  accreditation_id: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
};
type ProfileRow = { id: string; full_name: string | null };
type ProjectRow = { id: string; name: string };
type AccreditationRow = { id: string; contratista_id: string };
type ContractorRow = { id: string; name: string };
type RequirementRow = { id: string; name: string };
type WorkerRow = { id: string; full_name: string };
type MembershipRow = { profile_id: string };

export interface SupabaseAuditEntry {
  id: string;
  accion: string;
  actor: string;
  rol: string;
  empresa: string;
  proyecto: string;
  detalle: string;
  fecha: string;
  resultado: string;
  estadoAnterior?: string;
  estadoNuevo?: string;
}

function headers(token: string): HeadersInit {
  return {
    apikey: SUPABASE_PUBLISHABLE_KEY,
    Authorization: `Bearer ${token}`,
    Accept: 'application/json',
  };
}

async function selectRows<T>(table: string, token: string, select: string): Promise<T[]> {
  const url = new URL(`${SUPABASE_URL}/rest/v1/${table}`);
  url.searchParams.set('select', select);
  if (table === 'audit_logs') {
    url.searchParams.set('order', 'created_at.desc');
    url.searchParams.set('limit', '500');
  }
  const response = await fetch(url.toString(), { headers: headers(token) });
  const payload = await response.json().catch(() => ([]));
  if (!response.ok) {
    const message = payload?.message || payload?.hint || `No fue posible leer ${table}`;
    throw new Error(message);
  }
  return payload as T[];
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function auditDetail(
  row: AuditRow,
  requirements: Map<string, string>,
  workers: Map<string, string>,
): string {
  const details = row.details || {};
  const requirementId = stringValue(details.requirement_id);
  const workerId = stringValue(details.worker_id);
  const requirement = requirementId ? requirements.get(requirementId) : undefined;
  const worker = workerId ? workers.get(workerId) : undefined;
  const rejection = stringValue(details.rejection_reason);

  if (row.action.startsWith('document_')) {
    const parts = [requirement || 'Documento'];
    if (worker) parts.push(`Trabajador: ${worker}`);
    if (rejection) parts.push(`Motivo: ${rejection}`);
    return parts.join(' · ');
  }
  if (row.action.startsWith('worker_')) return worker || 'Asignación de trabajador';
  if (row.action.startsWith('requirement_')) return stringValue(details.name) || requirement || 'Requisito';
  if (row.action.startsWith('accreditation_')) return 'Acreditación del contratista';
  return row.entity_type.replace(/_/g, ' ');
}

function auditResult(action: string): string {
  if (action === 'document_rejected' || action === 'accreditation_deactivated') return 'bloqueado';
  if (action === 'document_approved' || action === 'worker_assigned' || action === 'accreditation_activated') return 'exitoso';
  return 'informativo';
}

export async function loadSupabaseAuditLogs(): Promise<SupabaseAuditEntry[]> {
  const session = await restoreSupabaseSession();
  if (!session) return [];
  const token = session._supabase.accessToken;

  const [logs, profiles, projects, accreditations, contractors, requirements, workers, acreditaMemberships, contractorMemberships, mandanteMemberships] = await Promise.all([
    selectRows<AuditRow>('audit_logs', token, 'id,actor_profile_id,action,entity_type,entity_id,project_id,accreditation_id,details,created_at'),
    selectRows<ProfileRow>('profiles', token, 'id,full_name'),
    selectRows<ProjectRow>('projects', token, 'id,name'),
    selectRows<AccreditationRow>('accreditations', token, 'id,contratista_id'),
    selectRows<ContractorRow>('contratistas', token, 'id,name'),
    selectRows<RequirementRow>('requirements', token, 'id,name'),
    selectRows<WorkerRow>('workers', token, 'id,full_name'),
    selectRows<MembershipRow>('acredita_memberships', token, 'profile_id'),
    selectRows<MembershipRow>('contratista_memberships', token, 'profile_id'),
    selectRows<MembershipRow>('mandante_memberships', token, 'profile_id'),
  ]);

  const profileName = new Map(profiles.map(row => [row.id, row.full_name || 'Usuario']));
  const projectName = new Map(projects.map(row => [row.id, row.name]));
  const accreditationContractor = new Map(accreditations.map(row => [row.id, row.contratista_id]));
  const contractorName = new Map(contractors.map(row => [row.id, row.name]));
  const requirementName = new Map(requirements.map(row => [row.id, row.name]));
  const workerName = new Map(workers.map(row => [row.id, row.full_name]));
  const staffIds = new Set(acreditaMemberships.map(row => row.profile_id));
  const contractorIds = new Set(contractorMemberships.map(row => row.profile_id));
  const mandanteIds = new Set(mandanteMemberships.map(row => row.profile_id));

  return logs.map(row => {
    const actorId = row.actor_profile_id || '';
    const contractorId = row.accreditation_id ? accreditationContractor.get(row.accreditation_id) : undefined;
    const details = row.details || {};
    return {
      id: `AUD-${row.id}`,
      accion: row.action,
      actor: row.actor_profile_id ? (profileName.get(row.actor_profile_id) || 'Usuario') : 'Sistema',
      rol: staffIds.has(actorId) ? 'Revisor' : contractorIds.has(actorId) ? 'Contratista' : mandanteIds.has(actorId) ? 'Mandante' : 'Sistema Automático',
      empresa: contractorId ? (contractorName.get(contractorId) || 'N/A') : 'N/A',
      proyecto: row.project_id ? (projectName.get(row.project_id) || '') : '',
      detalle: auditDetail(row, requirementName, workerName),
      fecha: row.created_at,
      resultado: auditResult(row.action),
      estadoAnterior: stringValue(details.old_status),
      estadoNuevo: stringValue(details.new_status),
    };
  });
}
