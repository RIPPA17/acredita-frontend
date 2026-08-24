import {
  calcularAccesoPago,
  calcularEstadoAcreditacion,
  calcularEstadoTrabajador,
  esTrabajadorAsignado,
} from '../../../data/localStorageDb';
import { Contratista, Proyecto, Trabajador } from '../../../types';
import { buildMandanteProjectSummaries, MandantePriority } from '../inicio/inicioUtils';

export type MatrixState = 'Acreditado' | 'En proceso' | 'Bloqueado';

export interface ContractorProjectContext {
  project: Proyecto;
  state: MatrixState;
  workers: Trabajador[];
  workersEnabled: number;
  accessBlocked: boolean;
  paymentBlocked: boolean;
}

export interface ContractorMatrixRow {
  contractor: Contratista;
  contexts: ContractorProjectContext[];
  uniqueWorkers: number;
  priorities: MandantePriority[];
  accessImpacts: number;
  paymentImpacts: number;
  criticalImpacts: number;
  hasProblems: boolean;
  allGood: boolean;
}

export interface MatrixExecutiveSummary {
  contractorsTotal: number;
  contractorsAttention: number;
  projectsAttention: number;
  retainedPayments: number;
  workersWithoutAccess: number;
}

export const accreditationState = (
  value: ReturnType<typeof calcularEstadoAcreditacion>,
): MatrixState => value === 'Aprobado' ? 'Acreditado' : value === 'Vencido/Bloqueado' ? 'Bloqueado' : 'En proceso';

export function buildContractorMatrix(
  projects: Proyecto[],
  allContractors: Contratista[],
): ContractorMatrixRow[] {
  const contractorIds = new Set(projects.flatMap(project => project.contratistas));
  const priorities = buildMandanteProjectSummaries(projects, allContractors).flatMap(summary => summary.priorities);

  return allContractors.filter(contractor => contractorIds.has(contractor.id)).map(contractor => {
    const contexts = projects.filter(project => project.contratistas.includes(contractor.id)).map(project => {
      const workers = (contractor.trabajadores || []).filter(worker => esTrabajadorAsignado(worker, project.id, projects));
      const accessPayment = calcularAccesoPago(contractor, project.id);
      return {
        project,
        state: accreditationState(calcularEstadoAcreditacion(contractor, project.id)),
        workers,
        workersEnabled: workers.filter(worker => {
          const state = calcularEstadoTrabajador(worker, project.id);
          return state === 'aprobado' || state === 'por_vencer';
        }).length,
        accessBlocked: accessPayment.accesoBloqueado,
        paymentBlocked: accessPayment.pagoBloqueado,
      };
    });
    const uniqueWorkers = new Set(contexts.flatMap(context => context.workers.map(worker => worker.rut))).size;
    const contractorPriorities = priorities.filter(priority => priority.contractorId === contractor.id);
    const accessImpacts = contexts.filter(context => context.accessBlocked).length;
    const paymentImpacts = contexts.filter(context => context.paymentBlocked).length;
    const hasProblems = contexts.some(context => context.state === 'Bloqueado' || context.accessBlocked || context.paymentBlocked);
    const allGood = contexts.length > 0 && contexts.every(context => context.state === 'Acreditado' && !context.accessBlocked && !context.paymentBlocked);
    return {
      contractor,
      contexts,
      uniqueWorkers,
      priorities: contractorPriorities,
      accessImpacts,
      paymentImpacts,
      criticalImpacts: accessImpacts + paymentImpacts,
      hasProblems,
      allGood,
    };
  }).sort((a, b) => {
    const rank = (row: ContractorMatrixRow) => row.criticalImpacts > 0 ? 0 : row.priorities.length > 0 ? 1 : 2;
    return rank(a) - rank(b) || a.contractor.nombre.localeCompare(b.contractor.nombre, 'es');
  });
}

export function summarizeContractorMatrix(rows: ContractorMatrixRow[]): MatrixExecutiveSummary {
  const priorities = rows.flatMap(row => row.priorities);
  const workersWithoutAccess = new Set<string>();
  rows.forEach(row => row.contexts.forEach(context => context.workers.forEach(worker => {
    const state = calcularEstadoTrabajador(worker, context.project.id);
    if (state !== 'aprobado' && state !== 'por_vencer') {
      workersWithoutAccess.add(`${row.contractor.id}:${context.project.id}:${worker.rut}`);
    }
  })));
  return {
    contractorsTotal: rows.length,
    contractorsAttention: rows.filter(row => row.priorities.length > 0).length,
    projectsAttention: new Set(priorities.map(priority => priority.projectId)).size,
    retainedPayments: rows.reduce((sum, row) => sum + row.paymentImpacts, 0),
    workersWithoutAccess: workersWithoutAccess.size,
  };
}
