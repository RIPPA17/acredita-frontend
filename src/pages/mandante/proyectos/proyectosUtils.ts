import {
  calcularAccesoPago,
  calcularEstadoAcreditacion,
  calcularEstadoTrabajador,
  esTrabajadorAsignado,
  getRequisitos,
} from '../../../data/localStorageDb';
import { Contratista, Proyecto, Requisito, Trabajador } from '../../../types';
import {
  getEstadoDocumentoEfectivo,
  matchDocumentoRequisito,
} from '../../contratista/documentosUtils';
import { buildMandanteProjectSummaries, ProjectExecutiveState } from '../inicio/inicioUtils';

export type DocumentationState = 'Al día' | 'Con pendientes' | 'Con problemas' | 'Sin requisitos';

export interface ProjectObligations {
  total: number;
  upToDate: number;
  pending: number;
  critical: number;
  inReview: number;
  state: DocumentationState;
}

export interface ProjectPresentation {
  project: Proyecto;
  state: ProjectExecutiveState;
  contractors: Contratista[];
  workers: Array<{ contractor: Contratista; worker: Trabajador }>;
  workersEnabled: number;
  access: 'Habilitado' | 'Con bloqueos';
  payment: 'Habilitado' | 'Con retenciones';
  obligations: ProjectObligations;
  approvedAccreditations: number;
  blockedAccreditations: number;
  attentionCount: number;
  inReview: number;
}

const isCriticalRequirement = (requirement: Requisito) =>
  requirement.criticidad === 'bloquea_acceso' ||
  requirement.criticidad === 'bloquea_pago' ||
  requirement.criticidad === 'bloquea_ambas';

const obligationResult = (
  documents: Contratista['documentos'] | Trabajador['documentos'],
  projectId: string,
  requirement: Requisito,
) => {
  const document = matchDocumentoRequisito(documents, projectId, requirement.nombre);
  const state = getEstadoDocumentoEfectivo(document, requirement);
  return {
    upToDate: state === 'Aprobado' || state === 'Por vencer',
    critical: isCriticalRequirement(requirement) && (state === 'Rechazado' || state === 'Vencido'),
    inReview: state === 'En revisión',
  };
};

export function calculateProjectObligations(
  project: Proyecto,
  contractors: Contratista[],
  workers: Array<{ contractor: Contratista; worker: Trabajador }>,
  requirements: Requisito[],
): ProjectObligations {
  const mandatory = requirements.filter(requirement => requirement.obligatorio && requirement.activo !== false);
  const companyRequirements = mandatory.filter(requirement => requirement.destino === 'empresa');
  const workerRequirements = mandatory.filter(requirement => requirement.destino === 'trabajador');
  const results = [
    ...contractors.flatMap(contractor => companyRequirements.map(requirement =>
      obligationResult(contractor.documentos, project.id, requirement))),
    ...workers.flatMap(({ worker }) => workerRequirements.map(requirement =>
      obligationResult(worker.documentos, project.id, requirement))),
  ];
  const upToDate = results.filter(result => result.upToDate).length;
  const critical = results.filter(result => result.critical).length;
  const inReview = results.filter(result => result.inReview).length;
  const pending = results.length - upToDate;
  const state: DocumentationState = results.length === 0
    ? 'Sin requisitos'
    : pending === 0
      ? 'Al día'
      : critical > 0
        ? 'Con problemas'
        : 'Con pendientes';
  return { total: results.length, upToDate, pending, critical, inReview, state };
}

export function buildProjectPresentations(
  projects: Proyecto[],
  allContractors: Contratista[],
): ProjectPresentation[] {
  const executive = new Map(buildMandanteProjectSummaries(projects, allContractors)
    .map(summary => [summary.project.id, summary]));
  const requirements = getRequisitos();

  return projects.map(project => {
    const contractors = allContractors.filter(contractor => project.contratistas.includes(contractor.id));
    const workerMap = new Map<string, { contractor: Contratista; worker: Trabajador }>();
    contractors.forEach(contractor => (contractor.trabajadores || [])
      .filter(worker => esTrabajadorAsignado(worker, project.id, projects))
      .forEach(worker => workerMap.set(worker.rut, { contractor, worker })));
    const workers = [...workerMap.values()];
    const obligations = calculateProjectObligations(
      project,
      contractors,
      workers,
      requirements.filter(requirement => requirement.proyectoId === project.id),
    );
    const accreditationStates = contractors.map(contractor => calcularEstadoAcreditacion(contractor, project.id));
    const accessPayment = contractors.map(contractor => calcularAccesoPago(contractor, project.id));
    const executiveSummary = executive.get(project.id);

    return {
      project,
      state: executiveSummary?.state || 'En proceso',
      contractors,
      workers,
      workersEnabled: workers.filter(({ worker }) => {
        const state = calcularEstadoTrabajador(worker, project.id);
        return state === 'aprobado' || state === 'por_vencer';
      }).length,
      access: accessPayment.some(item => item.accesoBloqueado) ? 'Con bloqueos' : 'Habilitado',
      payment: accessPayment.some(item => item.pagoBloqueado) ? 'Con retenciones' : 'Habilitado',
      obligations,
      approvedAccreditations: accreditationStates.filter(state => state === 'Aprobado').length,
      blockedAccreditations: accreditationStates.filter(state => state === 'Vencido/Bloqueado').length,
      attentionCount: executiveSummary?.attentionCount || 0,
      inReview: obligations.inReview,
    };
  });
}

export function companyObligationSummary(
  contractor: Contratista,
  projectId: string,
  requirements: Requisito[],
) {
  const mandatory = requirements.filter(requirement =>
    requirement.destino === 'empresa' && requirement.obligatorio && requirement.activo !== false);
  const results = mandatory.map(requirement => obligationResult(contractor.documentos, projectId, requirement));
  const pending = results.filter(result => !result.upToDate).length;
  const critical = results.filter(result => result.critical).length;
  if (results.length === 0) return 'Sin requisitos';
  if (critical > 0) return `${critical} problema${critical === 1 ? '' : 's'}`;
  if (pending > 0) return `${pending} pendiente${pending === 1 ? '' : 's'}`;
  return 'Completo';
}

export const projectStateRank: Record<ProjectExecutiveState, number> = {
  Bloqueado: 0,
  'En proceso': 1,
  Acreditado: 2,
};
