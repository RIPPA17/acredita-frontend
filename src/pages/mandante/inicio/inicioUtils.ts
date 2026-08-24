import {
  calcularAccesoPago,
  calcularEstadoAcreditacion,
  calcularEstadoTrabajador,
  esPorVencerPorFecha,
  esTrabajadorAsignado,
  esVencidoPorFecha,
  getRequisitos,
  obtenerDiasRestantes,
} from '../../../data/localStorageDb';
import { Contratista, Documento, Proyecto, Requisito, Trabajador } from '../../../types';

export type ProjectExecutiveState = 'Acreditado' | 'En proceso' | 'Bloqueado';
export type PriorityKind = 'empresa' | 'trabajador' | 'por_vencer';

export interface MandantePriority {
  key: string;
  kind: PriorityKind;
  score: number;
  projectId: string;
  projectName: string;
  contractorId: string;
  workerRut?: string;
  title: string;
  detail: string;
}

export interface MandanteProjectSummary {
  project: Proyecto;
  state: ProjectExecutiveState;
  contractors: Contratista[];
  workersEnabled: number;
  workersTotal: number;
  access: 'Habilitado' | 'Con bloqueos';
  payment: 'Habilitado' | 'Con retenciones';
  attentionCount: number;
  priorities: MandantePriority[];
  blockedAccreditations: number;
  retainedPayments: number;
}

const normalizeDocumentName = (value: string) => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .trim()
  .toLowerCase()
  .replace(/\s+/g, ' ');

export const matchDocumentoRequisito = (
  documents: Documento[] | undefined,
  projectId: string,
  requirementName: string,
) => (documents || []).find(document =>
  document.proyectoId === projectId &&
  normalizeDocumentName(document.nombre) === normalizeDocumentName(requirementName)
);

const documentProblem = (document: Documento | undefined, requirement: Requisito) => {
  if (!document) return 'faltante';
  if (document.estado === 'rechazado') return 'rechazado';
  if (esVencidoPorFecha(document.vencimiento)) return 'vencido';
  if (document.estado === 'pendiente') return 'faltante';
  if (document.estado === 'revision') return null;
  if (esPorVencerPorFecha(document.vencimiento, requirement.alertaDias)) return 'por_vencer';
  return null;
};

const projectState = (contractors: Contratista[], projectId: string): ProjectExecutiveState => {
  if (contractors.length === 0) return 'En proceso';
  const states = contractors.map(contractor => calcularEstadoAcreditacion(contractor, projectId));
  if (states.includes('Vencido/Bloqueado')) return 'Bloqueado';
  if (states.some(state => state !== 'Aprobado')) return 'En proceso';
  return 'Acreditado';
};

const priorityScore = (accessBlocked: boolean, paymentBlocked: boolean, problem: string) => {
  if (accessBlocked) return 1;
  if (paymentBlocked) return 2;
  if (problem === 'rechazado' || problem === 'vencido') return 3;
  if (problem === 'trabajador') return 4;
  if (problem === 'faltante') return 5;
  return 6;
};

const buildCompanyPriorities = (
  project: Proyecto,
  contractor: Contratista,
  requirements: Requisito[],
): MandantePriority[] => {
  const accessPayment = calcularAccesoPago(contractor, project.id);
  return requirements
    .filter(requirement => requirement.destino === 'empresa' && requirement.obligatorio)
    .flatMap(requirement => {
      const document = matchDocumentoRequisito(contractor.documentos, project.id, requirement.nombre);
      const problem = documentProblem(document, requirement);
      if (!problem) return [];
      const days = document ? obtenerDiasRestantes(document.vencimiento) : null;
      const detail = problem === 'por_vencer'
        ? `${requirement.nombre} vence en ${days} día${days === 1 ? '' : 's'} · operación todavía habilitada`
        : `${requirement.nombre} ${problem}${accessPayment.pagoBloqueado ? ' · pago retenido' : accessPayment.accesoBloqueado ? ' · acceso bloqueado' : ''}`;
      return [{
        key: `${project.id}:${contractor.id}:empresa:${requirement.id}`,
        kind: problem === 'por_vencer' ? 'por_vencer' as const : 'empresa' as const,
        score: priorityScore(accessPayment.accesoBloqueado, accessPayment.pagoBloqueado, problem),
        projectId: project.id,
        projectName: project.nombre,
        contractorId: contractor.id,
        title: `${contractor.nombre} · ${project.nombre}`,
        detail,
      }];
    });
};

const buildWorkerPriority = (
  project: Proyecto,
  contractor: Contratista,
  worker: Trabajador,
  requirements: Requisito[],
): MandantePriority | null => {
  const workerState = calcularEstadoTrabajador(worker, project.id);
  const candidates = requirements
    .filter(requirement => requirement.destino === 'trabajador' && requirement.obligatorio)
    .map(requirement => {
      const document = matchDocumentoRequisito(worker.documentos, project.id, requirement.nombre);
      return { requirement, document, problem: documentProblem(document, requirement) };
    })
    .filter(candidate => candidate.problem && candidate.problem !== 'revision');
  const candidate = candidates.find(item => item.problem === 'rechazado' || item.problem === 'vencido')
    || candidates.find(item => item.problem === 'faltante')
    || candidates.find(item => item.problem === 'por_vencer');
  if (!candidate) return null;
  const { requirement, document, problem } = candidate;
  const days = document ? obtenerDiasRestantes(document.vencimiento) : null;
  const isExpiring = problem === 'por_vencer' || workerState === 'por_vencer';
  return {
    key: `${project.id}:${contractor.id}:worker:${worker.rut}`,
    kind: isExpiring ? 'por_vencer' : 'trabajador',
    score: isExpiring ? 6 : workerState === 'rechazado' ? 4 : 5,
    projectId: project.id,
    projectName: project.nombre,
    contractorId: contractor.id,
    workerRut: worker.rut,
    title: `${worker.nombre} · ${project.nombre}`,
    detail: isExpiring
      ? `${requirement.nombre} vence en ${days} día${days === 1 ? '' : 's'} · acceso todavía habilitado`
      : `${requirement.nombre} ${problem} · ${workerState === 'rechazado' ? 'acceso bloqueado' : 'acceso pendiente'}`,
  };
};

export function buildMandanteProjectSummaries(
  projects: Proyecto[],
  allContractors: Contratista[],
): MandanteProjectSummary[] {
  return projects.map(project => {
    const contractors = allContractors.filter(contractor => project.contratistas.includes(contractor.id));
    const requirements = getRequisitos().filter(requirement => requirement.proyectoId === project.id && requirement.activo !== false);
    const accessPayments = contractors.map(contractor => calcularAccesoPago(contractor, project.id));
    const assignedWorkers = contractors.flatMap(contractor => (contractor.trabajadores || [])
      .filter(worker => esTrabajadorAsignado(worker, project.id, projects))
      .map(worker => ({ contractor, worker })));
    const workerPriorities = assignedWorkers
      .map(({ contractor, worker }) => buildWorkerPriority(project, contractor, worker, requirements))
      .filter((priority): priority is MandantePriority => priority !== null);
    const priorities = [
      ...contractors.flatMap(contractor => buildCompanyPriorities(project, contractor, requirements)),
      ...workerPriorities,
    ];
    return {
      project,
      state: projectState(contractors, project.id),
      contractors,
      workersEnabled: assignedWorkers.filter(({ worker }) => {
        const state = calcularEstadoTrabajador(worker, project.id);
        return state === 'aprobado' || state === 'por_vencer';
      }).length,
      workersTotal: assignedWorkers.length,
      access: accessPayments.some(result => result.accesoBloqueado) ? 'Con bloqueos' : 'Habilitado',
      payment: accessPayments.some(result => result.pagoBloqueado) ? 'Con retenciones' : 'Habilitado',
      attentionCount: priorities.length,
      priorities,
      blockedAccreditations: accessPayments.filter(result => result.accesoBloqueado).length,
      retainedPayments: accessPayments.filter(result => result.pagoBloqueado).length,
    };
  });
}

export const sortProjectSummaries = (summaries: MandanteProjectSummary[]) => {
  const rank: Record<ProjectExecutiveState, number> = { Bloqueado: 0, 'En proceso': 1, Acreditado: 2 };
  return summaries.map((summary, index) => ({ summary, index }))
    .sort((a, b) => rank[a.summary.state] - rank[b.summary.state] || b.summary.attentionCount - a.summary.attentionCount || a.index - b.index)
    .map(item => item.summary);
};
