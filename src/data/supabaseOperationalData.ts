import type {
  Contratista,
  Documento,
  Proyecto,
  Requisito,
  AsignacionTrabajador,
  CierreDocumental,
  ObligacionDocumental,
  ServicioContrato,
  Trabajador,
} from '../types';
import type { SupabaseUserSession } from './supabaseAuth';
import { refreshDerivedStateCache } from './supabaseDerivedState';
import { getRuntimeArray, setRuntimeArray } from './businessRuntimeCache';
import { formatPeriodo, setCierresDocumentales, setObligacionesDocumentales } from './operationalCore';
import {
  fetchOperationalRows,
  insertReturning,
  insertRows,
  patchRows,
  selectRows,
  type BackendDocument,
  type BackendObligation,
  type BackendRequirement,
  type BackendRows,
  type BackendVersion,
} from './supabaseOperationalApi';
import {
  backendOperationalDocumentToFrontend,
  hasUploadedOperationalVersion,
  normalizeOperationalRut,
  normalizeOperationalValue,
  operationalDateToTimestamp,
  operationalSlug,
  parseOperationalFrontendDate,
  toBackendWorkflowStatus,
} from './supabaseOperationalMapping';

const CONTRACTORS_KEY = 'acredita_contratistas';

function readContractors(): Contratista[] {
  return getRuntimeArray<Contratista>(CONTRACTORS_KEY, []);
}

function writeContractors(contractors: Contratista[]): void {
  setRuntimeArray(CONTRACTORS_KEY, contractors);
}

function readProjects(): Proyecto[] {
  return getRuntimeArray<Proyecto>('acredita_proyectos', []);
}

function readRequirements(): Requisito[] {
  return getRuntimeArray<Requisito>('acredita_requisitos', []);
}

function projectMatchesFaena(worker: Trabajador, project: Proyecto): boolean {
  const faena = normalizeOperationalValue(worker.faena || '');
  if (!faena) return false;
  return faena === normalizeOperationalValue(project.id)
    || faena === normalizeOperationalValue(project.nombre)
    || faena === normalizeOperationalValue(project.nombre.replace('Proyecto ', '').trim());
}

function workerAssignedToProject(worker: Trabajador, project: Proyecto): boolean {
  if (worker.asignaciones !== undefined) {
    return worker.asignaciones.some(item => item.proyectoId === project.id && item.estado === 'activa');
  }
  return (worker.documentos || []).some(doc => doc.proyectoId === project.id) || projectMatchesFaena(worker, project);
}

function localScope(session: SupabaseUserSession, contractors: Contratista[]): Contratista[] {
  if (session.role === 'admin') return contractors;
  if (session.role === 'contratista') return contractors.filter(item => item.id === session.contratistaId);
  return [];
}

async function syncWorkersAndAssignments(session: SupabaseUserSession, rows: BackendRows): Promise<BackendRows> {
  if (session.role === 'mandante') return rows;
  const token = session._supabase.accessToken;
  const contractors = readContractors();
  const projects = readProjects();
  const scoped = localScope(session, contractors);
  const contractorUuidByKey = new Map(rows.contractors.filter(c => c.integration_key).map(c => [c.integration_key as string, c.id]));

  const workerPayload: Record<string, unknown>[] = [];
  for (const contractor of scoped) {
    const contractorUuid = contractorUuidByKey.get(contractor.id);
    if (!contractorUuid) continue;
    for (const worker of contractor.trabajadores || []) {
      workerPayload.push({
        contratista_id: contractorUuid,
        rut: worker.rut,
        full_name: worker.nombre,
        job_title: worker.cargo || null,
        contract_type: worker.tipoContrato || null,
        contract_start_date: worker.fechaInicioContrato || null,
        contract_end_date: worker.fechaTerminoContrato || null,
        contract_work_or_task: worker.obraFaenaContrato || null,
        special_labor_regime: worker.regimenEspecial || null,
        special_labor_regime_detail: worker.detalleRegimenEspecial || null,
        is_active: true,
        updated_at: new Date().toISOString(),
      });
    }
  }
  if (workerPayload.length) await insertRows('workers', token, workerPayload, 'contratista_id,rut');

  let refreshed = await fetchOperationalRows(token);
  const projectUuidByKey = new Map(refreshed.projects.filter(p => p.integration_key).map(p => [p.integration_key as string, p.id]));
  const workerByContractorRut = new Map(refreshed.workers.map(w => [`${w.contratista_id}:${normalizeOperationalRut(w.rut)}`, w]));
  const accreditationByContext = new Map(refreshed.accreditations.filter(a => a.is_active).map(a => [`${a.project_id}:${a.contratista_id}`, a]));
  const serviceUuidByKey = new Map(refreshed.services.filter(item => item.integration_key).map(item => [item.integration_key as string, item.id]));
  const activeBackendAssignmentByKey = new Map(
    refreshed.assignments
      .filter(item => item.is_active && item.assignment_status === 'activa')
      .map(item => [`${item.accreditation_id}:${item.worker_id}`, item]),
  );
  const desiredAssignments = new Set<string>();

  for (const contractor of scoped) {
    const contractorUuid = contractorUuidByKey.get(contractor.id);
    if (!contractorUuid) continue;
    const contractorProjects = projects.filter(project => contractor.proyectos.includes(project.id));
    for (const worker of contractor.trabajadores || []) {
      const backendWorker = workerByContractorRut.get(`${contractorUuid}:${normalizeOperationalRut(worker.rut)}`);
      if (!backendWorker) continue;
      for (const project of contractorProjects) {
        if (!workerAssignedToProject(worker, project)) continue;
        const projectUuid = projectUuidByKey.get(project.id);
        if (!projectUuid) continue;
        const accreditation = accreditationByContext.get(`${projectUuid}:${contractorUuid}`);
        if (!accreditation) continue;
        const key = `${accreditation.id}:${backendWorker.id}`;
        desiredAssignments.add(key);
        const localAssignment = worker.asignaciones?.find(item => item.proyectoId === project.id && item.estado === 'activa');
        const backendAssignment = activeBackendAssignmentByKey.get(key);
        const assignmentPayload = {
          accreditation_id: accreditation.id,
          worker_id: backendWorker.id,
          service_id: localAssignment?.servicioId ? serviceUuidByKey.get(localAssignment.servicioId) || null : null,
          job_title: localAssignment?.cargo || worker.cargo || null,
          categories: localAssignment?.categorias || [],
          assignment_status: localAssignment?.estado || 'activa',
          access_status: localAssignment?.estadoAcceso || 'pendiente',
          assigned_at: localAssignment?.fechaIngreso || backendAssignment?.assigned_at || new Date().toISOString().slice(0, 10),
          is_active: true,
          unassigned_at: null,
          // Mientras el período está activo, el snapshot sigue la relación laboral
          // vigente del trabajador. Al dar de baja la asignación deja de sincronizarse
          // y queda congelado como evidencia histórica de ese período.
          contract_type_snapshot: worker.tipoContrato || null,
          contract_start_date_snapshot: worker.fechaInicioContrato || null,
          contract_end_date_snapshot: worker.fechaTerminoContrato || null,
          contract_work_or_task_snapshot: worker.obraFaenaContrato || null,
          special_labor_regime_snapshot: worker.regimenEspecial || null,
          special_labor_regime_detail_snapshot: worker.detalleRegimenEspecial || null,
        };
        if (backendAssignment) {
          await patchRows('worker_assignments', token, { id: `eq.${backendAssignment.id}` }, assignmentPayload);
        } else {
          await insertRows('worker_assignments', token, assignmentPayload);
        }
      }
    }
  }

  refreshed = await fetchOperationalRows(token);
  const scopedContractorUuids = new Set(scoped.map(c => contractorUuidByKey.get(c.id)).filter(Boolean) as string[]);
  const scopedWorkerIds = new Set(refreshed.workers.filter(w => scopedContractorUuids.has(w.contratista_id)).map(w => w.id));
  const activeAccreditations = refreshed.accreditations.filter(a => a.is_active && scopedContractorUuids.has(a.contratista_id));
  const activeAccreditationIds = new Set(activeAccreditations.map(a => a.id));
  const accreditationById = new Map(activeAccreditations.map(a => [a.id, a]));
  const projectKeyByUuidAfterRefresh = new Map(refreshed.projects.filter(p => p.integration_key).map(p => [p.id, p.integration_key as string]));

  for (const assignment of refreshed.assignments) {
    if (!assignment.is_active || !scopedWorkerIds.has(assignment.worker_id) || !activeAccreditationIds.has(assignment.accreditation_id)) continue;
    if (!desiredAssignments.has(`${assignment.accreditation_id}:${assignment.worker_id}`)) {
      const backendWorker = refreshed.workers.find(item => item.id === assignment.worker_id);
      const accreditation = accreditationById.get(assignment.accreditation_id);
      const contractorKey = backendWorker
        ? refreshed.contractors.find(item => item.id === backendWorker.contratista_id)?.integration_key
        : undefined;
      const projectKey = accreditation ? projectKeyByUuidAfterRefresh.get(accreditation.project_id) : undefined;
      const localWorker = contractorKey && backendWorker
        ? scoped.find(item => item.id === contractorKey)?.trabajadores?.find(item => normalizeOperationalRut(item.rut) === normalizeOperationalRut(backendWorker.rut))
        : undefined;
      const localInactiveAssignment = projectKey
        ? localWorker?.asignaciones?.find(item => item.proyectoId === projectKey && item.estado !== 'activa')
        : undefined;
      await patchRows('worker_assignments', token, { id: `eq.${assignment.id}` }, {
        is_active: false,
        assignment_status: localInactiveAssignment?.estado || 'inactiva',
        access_status: localInactiveAssignment?.estadoAcceso || 'bloqueado',
        unassigned_at: localInactiveAssignment?.fechaSalida
          ? operationalDateToTimestamp(localInactiveAssignment.fechaSalida)
          : new Date().toISOString(),
      });
    }
  }

  for (const contractor of scoped) {
    const contractorUuid = contractorUuidByKey.get(contractor.id);
    if (!contractorUuid) continue;
    const desiredRuts = new Set((contractor.trabajadores || []).map(w => normalizeOperationalRut(w.rut)));
    for (const backendWorker of refreshed.workers.filter(w => w.contratista_id === contractorUuid && w.is_active)) {
      if (!desiredRuts.has(normalizeOperationalRut(backendWorker.rut))) {
        await patchRows('workers', token, { id: `eq.${backendWorker.id}` }, { is_active: false, updated_at: new Date().toISOString() });
      }
    }
  }

  return fetchOperationalRows(token);
}

function buildHistoryPayload(doc: Documento, documentId: string): Array<Record<string, unknown>> {
  const byVersion = new Map<number, Record<string, unknown>>();
  for (const history of doc.historial || []) {
    const status = toBackendWorkflowStatus(history.estado);
    byVersion.set(history.version, {
      document_id: documentId,
      version_number: history.version,
      workflow_status: status,
      issued_at: history.emitido || null,
      expires_at: history.vencimientoIso || null,
      uploaded_at: operationalDateToTimestamp(history.fecha) || new Date().toISOString(),
      reviewed_at: status === 'aprobado' || status === 'rechazado' ? operationalDateToTimestamp(history.fecha) : null,
      rejection_reason: status === 'rechazado' ? (history.motivoRechazo || 'Rechazado durante migración') : null,
      rejection_explanation: status === 'rechazado' ? (history.explicacionRechazo || history.motivoRechazo || 'Sin detalle adicional') : null,
      rejection_solution: history.solucionRechazo || null,
      storage_bucket: null,
      storage_path: null,
      original_filename: history.archivoReferencia || null,
      metadata: {
        frontend_document_id: doc.id,
        reviewer_name: history.verificador || null,
        frontend_reviewed_text: history.fecha,
        legacy_import: true,
      },
    });
  }
  return [...byVersion.values()];
}

function currentVersionPayload(doc: Documento, documentId: string, session: SupabaseUserSession): Record<string, unknown> | null {
  if (!hasUploadedOperationalVersion(doc)) return null;
  const status = toBackendWorkflowStatus(doc.estado);
  return {
    document_id: documentId,
    version_number: Math.max(1, doc.version || 1),
    workflow_status: status,
    issued_at: doc.emitido || null,
    expires_at: doc.vencimientoIso || parseOperationalFrontendDate(doc.vencimiento),
    uploaded_by: session.role === 'contratista' && (status === 'revision' || status === 'pendiente') ? session.profileId : null,
    uploaded_at: operationalDateToTimestamp(doc.subido) || new Date().toISOString(),
    reviewed_by: null,
    reviewed_at: status === 'aprobado' || status === 'rechazado' ? operationalDateToTimestamp(doc.fechaRevisado) : null,
    rejection_reason: status === 'rechazado' ? (doc.motivoRechazo || doc.motivo || 'Rechazado durante migración') : null,
    rejection_explanation: status === 'rechazado' ? (doc.explicacionRechazo || doc.observacion || doc.motivo || 'Sin detalle adicional') : null,
    rejection_solution: status === 'rechazado' ? (doc.solucionRechazo || null) : null,
    storage_bucket: null,
    storage_path: null,
    original_filename: doc.archivoReferencia || null,
    metadata: {
      frontend_document_id: doc.id,
      reviewer_name: doc.revisor || null,
      frontend_uploaded_text: doc.subido || null,
      frontend_reviewed_text: doc.fechaRevisado || null,
      legacy_import: true,
    },
  };
}

async function syncVersions(
  session: SupabaseUserSession,
  doc: Documento,
  backendDocument: BackendDocument,
  versions: BackendVersion[],
): Promise<void> {
  const token = session._supabase.accessToken;
  const desired = [...buildHistoryPayload(doc, backendDocument.id)];
  const current = currentVersionPayload(doc, backendDocument.id, session);
  if (current) desired.push(current);

  for (const payload of desired) {
    const versionNumber = Number(payload.version_number);
    const status = payload.workflow_status as BackendVersion['workflow_status'];
    const existing = versions.find(v => v.document_id === backendDocument.id && v.version_number === versionNumber);
    if (existing) {
      // Una decisión tomada directamente en Supabase es autoridad definitiva.
      // La capa legacy puede hidratarla, pero nunca volver a sobrescribirla.
      if (session.role === 'admin' && existing.metadata?.backend_review_decision !== true) {
        const { document_id: _documentId, version_number: _version, ...patch } = payload;
        await patchRows('document_versions', token, { id: `eq.${existing.id}` }, patch);
      }
      continue;
    }
    if (session.role === 'contratista' && !['pendiente', 'revision'].includes(status)) continue;
    await insertRows('document_versions', token, payload);
  }
}

async function ensureDocument(
  token: string,
  existing: BackendDocument[],
  accreditationId: string,
  requirementId: string,
  workerId: string | null,
  obligationId?: string,
): Promise<BackendDocument> {
  const found = existing.find(d =>
    d.accreditation_id === accreditationId
    && d.requirement_id === requirementId
    && d.worker_id === workerId
    && d.obligation_id === (obligationId || null)
  );
  if (found) return found;
  const created = await insertReturning<BackendDocument>('documents', token, {
    accreditation_id: accreditationId,
    requirement_id: requirementId,
    worker_id: workerId,
    obligation_id: obligationId || null,
  });
  existing.push(created);
  return created;
}

async function syncDocuments(session: SupabaseUserSession, rows: BackendRows): Promise<void> {
  if (session.role === 'mandante') return;
  const token = session._supabase.accessToken;
  const contractors = localScope(session, readContractors());
  const projectUuidByKey = new Map(rows.projects.filter(p => p.integration_key).map(p => [p.integration_key as string, p.id]));
  const contractorUuidByKey = new Map(rows.contractors.filter(c => c.integration_key).map(c => [c.integration_key as string, c.id]));
  const accreditationByContext = new Map(rows.accreditations.filter(a => a.is_active).map(a => [`${a.project_id}:${a.contratista_id}`, a]));
  const requirementByProjectNameTarget = new Map(rows.requirements.filter(r => r.is_active).map(r => [`${r.project_id}:${r.target}:${normalizeOperationalValue(r.name)}`, r]));
  const workerByContractorRut = new Map(rows.workers.map(w => [`${w.contratista_id}:${normalizeOperationalRut(w.rut)}`, w]));
  const backendDocuments = [...rows.documents];
  let versions = [...rows.versions];
  const today = new Date().toISOString().slice(0, 10);

  const resolveCurrentObligationId = (
    accreditationId: string,
    requirementId: string,
    workerId: string | null,
    explicit?: string,
  ): string | undefined => {
    if (explicit) return explicit;
    if (workerId) {
      const assignment = rows.assignments
        .filter(item =>
          item.accreditation_id === accreditationId
          && item.worker_id === workerId
          && item.is_active
          && item.assignment_status === 'activa'
        )
        .sort((a, b) => (b.assigned_at || '').localeCompare(a.assigned_at || ''))[0];
      if (!assignment) return undefined;
      return rows.obligations
        .filter(item =>
          item.accreditation_id === accreditationId
          && item.requirement_id === requirementId
          && item.worker_assignment_id === assignment.id
          && item.is_active
          && item.period_start <= today
        )
        .sort((a, b) => b.period_start.localeCompare(a.period_start))[0]?.obligation_id;
    }
    return rows.obligations
      .filter(item =>
        item.accreditation_id === accreditationId
        && item.requirement_id === requirementId
        && !item.worker_assignment_id
        && item.is_active
        && item.period_start <= today
      )
      .sort((a, b) => b.period_start.localeCompare(a.period_start))[0]?.obligation_id;
  };

  const syncOne = async (contractor: Contratista, doc: Documento, worker?: Trabajador) => {
    if (!doc.proyectoId || !hasUploadedOperationalVersion(doc)) return;
    const projectUuid = projectUuidByKey.get(doc.proyectoId);
    const contractorUuid = contractorUuidByKey.get(contractor.id);
    if (!projectUuid || !contractorUuid) return;
    const accreditation = accreditationByContext.get(`${projectUuid}:${contractorUuid}`);
    if (!accreditation) return;
    const target = worker ? 'trabajador' : 'empresa';
    const requirement = requirementByProjectNameTarget.get(`${projectUuid}:${target}:${normalizeOperationalValue(doc.nombre)}`);
    if (!requirement) return;
    const backendWorker = worker ? workerByContractorRut.get(`${contractorUuid}:${normalizeOperationalRut(worker.rut)}`) : undefined;
    if (worker && !backendWorker) return;
    const obligationId = resolveCurrentObligationId(
      accreditation.id,
      requirement.id,
      backendWorker?.id || null,
      doc.obligacionId,
    );
    // Un documento de trabajador sin obligación no participa en el estado
    // derivado y puede contaminar un reingreso. No creamos contenedores huérfanos.
    if (worker && !obligationId) return;
    const backendDocument = await ensureDocument(
      token,
      backendDocuments,
      accreditation.id,
      requirement.id,
      backendWorker?.id || null,
      obligationId,
    );
    await syncVersions(session, doc, backendDocument, versions);
    versions = await selectRows<BackendVersion>('document_versions', token, 'id,document_id,version_number,workflow_status,expires_at,uploaded_at,reviewed_at,rejection_reason,rejection_explanation,rejection_solution,storage_bucket,storage_path,original_filename,metadata');
  };

  for (const contractor of contractors) {
    for (const doc of contractor.documentos || []) await syncOne(contractor, doc);
    for (const worker of contractor.trabajadores || []) {
      for (const doc of worker.documentos || []) await syncOne(contractor, doc, worker);
    }
  }
}

export async function pushOperationalDataToSupabase(session: SupabaseUserSession): Promise<void> {
  if (session.role === 'mandante' || typeof window === 'undefined') return;
  let rows = await fetchOperationalRows(session._supabase.accessToken);
  rows = await syncWorkersAndAssignments(session, rows);
  await syncDocuments(session, rows);
}

export async function hydrateOperationalDataFromSupabase(session: SupabaseUserSession): Promise<void> {
  if (typeof window === 'undefined') return;
  const rows = await fetchOperationalRows(session._supabase.accessToken);
  const contractors = readContractors();
  const projects = readProjects();
  const requirements = readRequirements();
  const contractorKeyByUuid = new Map(rows.contractors.filter(c => c.integration_key).map(c => [c.id, c.integration_key as string]));
  const projectKeyByUuid = new Map(rows.projects.filter(p => p.integration_key).map(p => [p.id, p.integration_key as string]));
  const projectByKey = new Map(projects.map(p => [p.id, p]));
  const accreditationById = new Map(rows.accreditations.map(a => [a.id, a]));
  const requirementById = new Map(rows.requirements.map(r => [r.id, r]));
  const workerById = new Map(rows.workers.map(w => [w.id, w]));
  const assignmentById = new Map(rows.assignments.map(item => [item.id, item]));
  const serviceKeyByUuid = new Map(rows.services.map(item => [item.id, item.integration_key || item.id]));
  const obligationById = new Map(rows.obligations.map(item => [item.obligation_id, item]));

  const frontendObligations: ObligacionDocumental[] = rows.obligations.map(item => {
    const accreditation = accreditationById.get(item.accreditation_id);
    const assignment = item.worker_assignment_id ? assignmentById.get(item.worker_assignment_id) : undefined;
    const worker = assignment ? workerById.get(assignment.worker_id) : undefined;
    return {
      id: item.obligation_id,
      proyectoId: accreditation ? (projectKeyByUuid.get(accreditation.project_id) || accreditation.project_id) : '',
      contratistaId: accreditation ? (contractorKeyByUuid.get(accreditation.contratista_id) || accreditation.contratista_id) : '',
      requisitoId: requirementById.get(item.requirement_id)?.integration_key || item.requirement_id,
      servicioId: item.service_id ? serviceKeyByUuid.get(item.service_id) : undefined,
      asignacionId: item.worker_assignment_id || undefined,
      trabajadorRut: worker?.rut,
      periodoInicio: item.period_start,
      periodoFin: item.period_end,
      fechaLimite: item.due_date,
      periodoEtiqueta: formatPeriodo(item.period_start, item.period_end),
      estado: item.effective_status,
      versionActual: item.version_number || undefined,
      activo: item.is_active,
    };
  }).filter(item => item.proyectoId && item.contratistaId);
  const today = new Date().toISOString().slice(0, 10);
  const latestDueObligation = (items: ObligacionDocumental[]) => items
    .filter(item => item.activo !== false && item.periodoInicio <= today)
    .sort((a, b) => b.periodoInicio.localeCompare(a.periodoInicio))[0];
  setObligacionesDocumentales(frontendObligations);
  setCierresDocumentales(rows.closures.map(item => ({
    id: item.id,
    proyectoId: projectKeyByUuid.get(item.project_id) || item.project_id,
    periodoInicio: item.period_start,
    periodoFin: item.period_end,
    estado: item.status,
    fechaCargaHasta: item.upload_deadline || undefined,
    fechaCierre: item.closed_at || undefined,
    snapshot: item.snapshot || undefined,
  })));

  const backendCompanyDocs = new Map<string, Documento[]>();
  const backendWorkerDocs = new Map<string, Documento[]>();
  const orderedDocuments = [...rows.documents].sort((a, b) => {
    const aPeriod = a.obligation_id ? obligationById.get(a.obligation_id)?.period_start || '' : '';
    const bPeriod = b.obligation_id ? obligationById.get(b.obligation_id)?.period_start || '' : '';
    return aPeriod.localeCompare(bPeriod);
  });
  for (const document of orderedDocuments) {
    const accreditation = accreditationById.get(document.accreditation_id);
    const requirement = requirementById.get(document.requirement_id);
    if (!accreditation || !requirement) continue;
    const contractorKey = contractorKeyByUuid.get(accreditation.contratista_id);
    const projectKey = projectKeyByUuid.get(accreditation.project_id);
    if (!contractorKey || !projectKey) continue;
    const frontend = backendOperationalDocumentToFrontend(document, requirement, projectKey, rows.versions, document.obligation_id ? obligationById.get(document.obligation_id) : undefined);
    if (document.worker_id) {
      const worker = workerById.get(document.worker_id);
      if (!worker) continue;
      const key = `${contractorKey}:${normalizeOperationalRut(worker.rut)}`;
      const list = backendWorkerDocs.get(key) || [];
      list.push(frontend);
      backendWorkerDocs.set(key, list);
    } else {
      const list = backendCompanyDocs.get(contractorKey) || [];
      list.push(frontend);
      backendCompanyDocs.set(contractorKey, list);
    }
  }

  const assignmentsByWorker = new Map<string, AsignacionTrabajador[]>();
  // Conservamos también las asignaciones inactivas/baja para mantener el historial local.
  for (const assignment of rows.assignments) {
    const accreditation = accreditationById.get(assignment.accreditation_id);
    if (!accreditation) continue;
    const projectKey = projectKeyByUuid.get(accreditation.project_id);
    if (!projectKey) continue;
    const current = assignmentsByWorker.get(assignment.worker_id) || [];
    current.push({
      id: assignment.id,
      proyectoId: projectKey,
      servicioId: assignment.service_id ? serviceKeyByUuid.get(assignment.service_id) : undefined,
      cargo: assignment.job_title || undefined,
      categorias: assignment.categories || [],
      fechaIngreso: assignment.assigned_at || undefined,
      fechaSalida: assignment.unassigned_at || undefined,
      estado: assignment.assignment_status || 'activa',
      estadoAcceso: assignment.access_status || 'pendiente',
      tipoContrato: assignment.contract_type_snapshot || undefined,
      fechaInicioContrato: assignment.contract_start_date_snapshot || undefined,
      fechaTerminoContrato: assignment.contract_end_date_snapshot || undefined,
      obraFaenaContrato: assignment.contract_work_or_task_snapshot || undefined,
      regimenEspecial: assignment.special_labor_regime_snapshot || undefined,
      detalleRegimenEspecial: assignment.special_labor_regime_detail_snapshot || undefined,
    });
    assignmentsByWorker.set(assignment.worker_id, current);
  }

  const workersByContractor = new Map<string, Trabajador[]>();
  for (const backendWorker of rows.workers.filter(w => w.is_active)) {
    const contractorKey = contractorKeyByUuid.get(backendWorker.contratista_id);
    if (!contractorKey) continue;
    const localContractor = contractors.find(c => c.id === contractorKey);
    const localWorker = localContractor?.trabajadores?.find(w => normalizeOperationalRut(w.rut) === normalizeOperationalRut(backendWorker.rut));
    let docs = [...(backendWorkerDocs.get(`${contractorKey}:${normalizeOperationalRut(backendWorker.rut)}`) || [])];
    const assignments = assignmentsByWorker.get(backendWorker.id) || [];
    const assignedProjectKeys = assignments.filter(item => item.estado === 'activa').map(item => item.proyectoId);

    // Los placeholders pendientes mantienen visible una asignación incluso si
    // todavía no existe una versión subida en documents/document_versions.
    for (const projectKey of assignedProjectKeys) {
      const workerReqs = requirements.filter(r => r.proyectoId === projectKey && r.destino === 'trabajador' && r.activo !== false);
      const workerAssignment = assignments.find(item => item.proyectoId === projectKey && item.estado === 'activa');
      for (const req of workerReqs) {
        const categories = (workerAssignment?.categorias || []).map(item => normalizeOperationalValue(item));
        const appliesByCategory = !req.categoriasAplicables?.length
          || req.categoriasAplicables.some(item => normalizeOperationalValue(item) === 'general' || categories.includes(normalizeOperationalValue(item)));
        const appliesByService = !req.servicioId || req.servicioId === workerAssignment?.servicioId;
        if (!appliesByCategory || !appliesByService) continue;
        const obligationCandidates = frontendObligations.filter(item => item.asignacionId === workerAssignment?.id && item.requisitoId === req.id);
        const obligation = latestDueObligation(obligationCandidates);
        const matchingDocument = obligation
? docs.find(item => item.obligacionId === obligation.id)
: docs.find(item =>
    item.proyectoId === projectKey
    && normalizeOperationalValue(item.nombre) === normalizeOperationalValue(req.nombre)
    && !item.obligacionId
  );
        docs = docs.filter(item => item.proyectoId !== projectKey || normalizeOperationalValue(item.nombre) !== normalizeOperationalValue(req.nombre));
        if (matchingDocument) {
          docs.push(matchingDocument);
          continue;
        }
        if (!obligation && frontendObligations.some(item => item.asignacionId === workerAssignment?.id)) continue;
        docs.push({
          id: `doc_${operationalSlug(contractorKey)}_${operationalSlug(projectKey)}_${operationalSlug(req.id)}_${operationalSlug(backendWorker.rut)}`,
          nombre: req.nombre,
          categoria: req.categoria,
          estado: 'pendiente',
          vencimiento: '—',
          proyectoId: projectKey,
          version: 1,
          historial: [],
          obligacionId: obligation?.id,
          periodoEtiqueta: obligation?.periodoEtiqueta,
          periodoInicio: obligation?.periodoInicio,
          periodoFin: obligation?.periodoFin,
          fechaLimite: obligation?.fechaLimite,
        });
      }
    }

    const firstProject = assignedProjectKeys.map(key => projectByKey.get(key)).find(Boolean);
    const worker: Trabajador = {
      estado: 'pendiente' as const,
      nombre: backendWorker.full_name,
      rut: backendWorker.rut,
      cargo: backendWorker.job_title || undefined,
      faena: firstProject?.nombre,
      tipoContrato: backendWorker.contract_type || undefined,
      fechaInicioContrato: backendWorker.contract_start_date || undefined,
      fechaTerminoContrato: backendWorker.contract_end_date || undefined,
      obraFaenaContrato: backendWorker.contract_work_or_task || undefined,
      regimenEspecial: backendWorker.special_labor_regime || undefined,
      detalleRegimenEspecial: backendWorker.special_labor_regime_detail || undefined,
      documentos: docs,
      asignaciones: assignments,
    };
    const list = workersByContractor.get(contractorKey) || [];
    list.push(worker);
    workersByContractor.set(contractorKey, list);
  }

  const next = contractors.map(contractor => {
    const companyDocs = [...(backendCompanyDocs.get(contractor.id) || [])];
    for (const projectKey of contractor.proyectos || []) {
      const companyReqs = requirements.filter(r => r.proyectoId === projectKey && r.destino === 'empresa' && r.activo !== false);
      for (const req of companyReqs) {
        const obligationCandidates = frontendObligations.filter(item => item.contratistaId === contractor.id && item.proyectoId === projectKey && !item.asignacionId && item.requisitoId === req.id);
        const obligation = latestDueObligation(obligationCandidates);
        const matchingDocument = obligation
? companyDocs.find(item => item.obligacionId === obligation.id)
: companyDocs.find(item =>
    item.proyectoId === projectKey
    && normalizeOperationalValue(item.nombre) === normalizeOperationalValue(req.nombre)
    && !item.obligacionId
  );
        companyDocs.splice(0, companyDocs.length, ...companyDocs.filter(item => item.proyectoId !== projectKey || normalizeOperationalValue(item.nombre) !== normalizeOperationalValue(req.nombre)));
        if (matchingDocument) {
          companyDocs.push(matchingDocument);
          continue;
        }
        if (!obligation && frontendObligations.some(item => item.contratistaId === contractor.id && item.proyectoId === projectKey && !item.asignacionId)) continue;
        companyDocs.push({
id: `doc_${operationalSlug(contractor.id)}_${operationalSlug(projectKey)}_${operationalSlug(req.id)}_empresa`,
nombre: req.nombre,
categoria: req.categoria,
estado: 'pendiente',
vencimiento: '—',
proyectoId: projectKey,
version: 1,
historial: [],
obligacionId: obligation?.id,
periodoEtiqueta: obligation?.periodoEtiqueta,
periodoInicio: obligation?.periodoInicio,
periodoFin: obligation?.periodoFin,
fechaLimite: obligation?.fechaLimite,
        });
      }
    }
    return {
      ...contractor,
      documentos: companyDocs,
      trabajadores: workersByContractor.get(contractor.id) || [],
    };
  });
  writeContractors(next);
  await refreshDerivedStateCache(session);
}

export async function prepareOperationalDataForSession(session: SupabaseUserSession): Promise<void> {
  if (typeof window === 'undefined') return;
  await hydrateOperationalDataFromSupabase(session);
}
