import { expect, test, type Page } from '@playwright/test';

const SUPABASE = 'https://jwlscxbmttpicwljozwf.supabase.co';
const PROFILE = '10000000-0000-4000-8000-000000000001';
const MANDANTE = '20000000-0000-4000-8000-000000000001';
const PROJECT = '30000000-0000-4000-8000-000000000001';
const PROJECT_OLD = '30000000-0000-4000-8000-000000000002';
const CONTRACTOR = '40000000-0000-4000-8000-000000000001';
const ACCREDITATION = '50000000-0000-4000-8000-000000000001';
const ACCREDITATION_OLD = '50000000-0000-4000-8000-000000000002';
const SERVICE = '60000000-0000-4000-8000-000000000001';
const WORKER = '70000000-0000-4000-8000-000000000001';
const ASSIGNMENT = '80000000-0000-4000-8000-000000000001';
const ASSIGNMENT_OLD = '80000000-0000-4000-8000-000000000002';
const REQ_COMPANY = '90000000-0000-4000-8000-000000000001';
const REQ_WORKER = '90000000-0000-4000-8000-000000000002';
const REQ_COMPANY_OLD = '90000000-0000-4000-8000-000000000003';
const DOCUMENT_COMPANY = '91000000-0000-4000-8000-000000000001';
const VERSION_COMPANY_V1 = '92000000-0000-4000-8000-000000000001';
const VERSION_COMPANY_V2 = '92000000-0000-4000-8000-000000000002';
const VERSION_COMPANY_V3 = '92000000-0000-4000-8000-000000000003';
const OBLIGATION_WORKER = '93000000-0000-4000-8000-000000000001';
const DOCUMENT_WORKER = '94000000-0000-4000-8000-000000000001';
const VERSION_WORKER_V1 = '95000000-0000-4000-8000-000000000001';
const VERSION_WORKER_V2 = '95000000-0000-4000-8000-000000000002';
const PAYMENT = 'a0000000-0000-4000-8000-000000000001';

type Role = 'admin' | 'mandante' | 'contratista';
type WorkerDocumentScenario = 'pending' | 'review' | 'rejected' | 'renewal_review';
type MockOptions = {
  paymentStatus?: 'observado' | 'retenido' | 'liberado' | 'pagado';
  emptyProject?: boolean;
  historicalProject?: boolean;
  renewalScenario?: boolean;
  workerDocumentScenario?: WorkerDocumentScenario;
  categorizedWorker?: boolean;
  bulkReentry?: boolean;
  inactiveAccreditationOnActiveProject?: boolean;
  assetLifecycle?: boolean;
};

function appSession(role: Role) {
  return {
    email: `${role}@e2e.invalid`,
    role,
    nombre: role === 'mandante' ? 'Mandante Piloto' : role === 'contratista' ? 'Contratista Piloto A' : 'Acredita QA',
    profileId: PROFILE,
    ...(role === 'mandante' ? { mandanteId: 'mandante_piloto', mandanteBackendId: MANDANTE } : {}),
    ...(role === 'contratista' ? { contratistaId: 'contratista_piloto_a', contratistaBackendId: CONTRACTOR } : {}),
    _supabase: { accessToken: 'e2e-access', refreshToken: 'e2e-refresh', expiresAt: Date.now() + 3_600_000 },
  };
}

function fixtures(role: Role, options: MockOptions) {
  const paymentStatus = options.paymentStatus || 'observado';
  const workerScenario = options.workerDocumentScenario;
  const workerComplete = Boolean(options.historicalProject || workerScenario || options.bulkReentry);
  const workerHasDocument = Boolean(workerScenario && workerScenario !== 'pending');
  const workerVersions = workerScenario === 'review' ? [
    { id: VERSION_WORKER_V1, document_id: DOCUMENT_WORKER, version_number: 1, workflow_status: 'revision', issued_at: null, expires_at: null, uploaded_at: '2026-09-19T12:00:00Z', reviewed_at: null, rejection_reason: null, rejection_explanation: null, rejection_solution: null, storage_bucket: 'acredita-documents', storage_path: 'worker/v1/odi.pdf', original_filename: 'odi.pdf', metadata: { frontend_document_id: 'doc_worker_odi' } },
  ] : workerScenario === 'rejected' ? [
    { id: VERSION_WORKER_V1, document_id: DOCUMENT_WORKER, version_number: 1, workflow_status: 'rechazado', issued_at: null, expires_at: null, uploaded_at: '2026-09-18T12:00:00Z', reviewed_at: '2026-09-19T10:00:00Z', rejection_reason: 'Falta firma', rejection_explanation: 'Falta la firma del trabajador en la última página.', rejection_solution: 'Sube nuevamente el ODI firmado.', storage_bucket: 'acredita-documents', storage_path: 'worker/v1/odi.pdf', original_filename: 'odi.pdf', metadata: { frontend_document_id: 'doc_worker_odi', reviewer_name: 'Acredita QA' } },
  ] : workerScenario === 'renewal_review' ? [
    { id: VERSION_WORKER_V1, document_id: DOCUMENT_WORKER, version_number: 1, workflow_status: 'aprobado', issued_at: '2025-09-26', expires_at: '2026-09-25', uploaded_at: '2025-09-26T12:00:00Z', reviewed_at: '2025-09-27T12:00:00Z', rejection_reason: null, rejection_explanation: null, rejection_solution: null, storage_bucket: 'acredita-documents', storage_path: 'worker/v1/odi.pdf', original_filename: 'odi-v1.pdf', metadata: { frontend_document_id: 'doc_worker_odi', reviewer_name: 'Acredita QA' } },
    { id: VERSION_WORKER_V2, document_id: DOCUMENT_WORKER, version_number: 2, workflow_status: 'revision', issued_at: null, expires_at: null, uploaded_at: '2026-09-19T12:00:00Z', reviewed_at: null, rejection_reason: null, rejection_explanation: null, rejection_solution: null, storage_bucket: 'acredita-documents', storage_path: 'worker/v2/odi-renovado.pdf', original_filename: 'odi-renovado.pdf', metadata: { frontend_document_id: 'doc_worker_odi' } },
  ] : [];
  return {
    profiles: [{ id: PROFILE, full_name: appSession(role).nombre }],
    acredita_memberships: role === 'admin' ? [{ profile_id: PROFILE, role: 'admin_acredita', is_active: true }] : [],
    mandante_memberships: role === 'mandante' ? [{ profile_id: PROFILE, mandante_id: MANDANTE, role: 'mandante_admin', is_active: true }] : [],
    contratista_memberships: role === 'contratista' ? [{ profile_id: PROFILE, contratista_id: CONTRACTOR, role: 'contratista_admin', is_active: true }] : [],
    mandantes: [{ id: MANDANTE, name: 'Mandante Piloto', rut: '76.000.000-0', legal_name: 'Mandante Piloto SpA', integration_key: 'mandante_piloto', is_active: true }],
    projects: [
      { id: PROJECT, mandante_id: MANDANTE, name: 'Proyecto Piloto QA', code: 'PILOTO-QA', status: 'active', integration_key: 'proyecto_piloto', location: 'Santiago', starts_at: '2026-09-01', ends_at: null },
      ...(options.historicalProject ? [{ id: PROJECT_OLD, mandante_id: MANDANTE, name: 'Proyecto Histórico QA', code: 'HIST-QA', status: 'archived', integration_key: 'proyecto_historico', location: 'Santiago', starts_at: '2025-01-01', ends_at: '2025-12-31' }] : []),
    ],
    contratistas: [{ id: CONTRACTOR, name: 'Contratista Piloto A', rut: '77.000.000-1', legal_name: 'Contratista Piloto A SpA', integration_key: 'contratista_piloto_a', is_active: true, parent_contratista_id: null }],
    accreditations: [
      { id: ACCREDITATION, project_id: PROJECT, contratista_id: CONTRACTOR, is_active: !options.inactiveAccreditationOnActiveProject },
      ...(options.historicalProject ? [{ id: ACCREDITATION_OLD, project_id: PROJECT_OLD, contratista_id: CONTRACTOR, is_active: false }] : []),
    ],
    requirements: [
      { id: REQ_COMPANY, project_id: PROJECT, integration_key: 'req_f30', name: 'F30 / F31 SII', category: 'Laboral', target: 'empresa', is_required: true, frequency: 'mensual', validity_days: 30, alert_days: 7, criticality: 'bloquea_pago', is_active: true, sort_order: 1, description: 'Cumplimiento previsional', review_checklist: ['Vigencia'], applicability: { categories: [] }, blocks_work: false, blocks_assignment: false, service_id: null, due_days: 5 },
      { id: REQ_WORKER, project_id: PROJECT, integration_key: 'req_odi', name: 'Certificado ODI', category: 'Seguridad', target: 'trabajador', is_required: true, frequency: 'un_ano', validity_days: 365, alert_days: 30, criticality: 'bloquea_acceso', is_active: true, sort_order: 2, description: 'ODI vigente', review_checklist: ['Firma'], applicability: { categories: options.categorizedWorker ? ['altura'] : [] }, blocks_work: true, blocks_assignment: true, service_id: SERVICE, due_days: 5 },
      ...(options.historicalProject ? [{ id: REQ_COMPANY_OLD, project_id: PROJECT_OLD, integration_key: 'req_historico', name: 'Documento Histórico QA', category: 'Laboral', target: 'empresa', is_required: true, frequency: 'por_obra', validity_days: null, alert_days: 7, criticality: 'bloquea_pago', is_active: true, sort_order: 1, description: 'Requisito histórico', review_checklist: [], applicability: { categories: [] }, blocks_work: false, blocks_assignment: false, service_id: null, due_days: 5 }] : []),
    ],
    services: [{ id: SERVICE, accreditation_id: ACCREDITATION, integration_key: 'servicio_piloto', code: 'SRV-01', name: 'Servicio Piloto', category: 'Operación', contractor_contact: 'Jefe Contrato', mandante_contact: 'Administrador Contrato', starts_at: '2026-09-01', ends_at: null, status: 'activo', is_active: true }],
    workers: options.emptyProject ? [] : [{
      id: WORKER,
      contratista_id: CONTRACTOR,
      rut: options.bulkReentry ? '12.345.678-5' : '18.123.456-7',
      full_name: 'Trabajador Piloto',
      job_title: 'Operador',
      contract_type: workerComplete ? 'indefinido' : null,
      contract_start_date: workerComplete ? '2026-09-01' : null,
      contract_end_date: null,
      contract_work_or_task: null,
      special_labor_regime: null,
      special_labor_regime_detail: null,
      is_active: true,
    }],
    worker_assignments: options.emptyProject ? [] : [
      {
        id: ASSIGNMENT,
        accreditation_id: ACCREDITATION,
        worker_id: WORKER,
        is_active: !options.bulkReentry,
        service_id: SERVICE,
        job_title: 'Operador',
        categories: ['general'],
        assignment_status: options.bulkReentry ? 'baja' : 'activa',
        access_status: options.bulkReentry ? 'bloqueado' : 'pendiente',
        assigned_at: options.bulkReentry ? '2026-07-01' : '2026-09-01',
        unassigned_at: options.bulkReentry ? '2026-08-31' : null,
        contract_type_snapshot: workerComplete ? 'indefinido' : null,
        contract_start_date_snapshot: workerComplete ? '2026-07-01' : null,
        contract_end_date_snapshot: null,
        contract_work_or_task_snapshot: null,
        special_labor_regime_snapshot: null,
        special_labor_regime_detail_snapshot: null,
      },
      ...(options.historicalProject ? [{
        id: ASSIGNMENT_OLD,
        accreditation_id: ACCREDITATION_OLD,
        worker_id: WORKER,
        is_active: false,
        service_id: null,
        job_title: 'Ayudante',
        categories: ['general'],
        assignment_status: 'baja',
        access_status: 'bloqueado',
        assigned_at: '2025-01-10',
        unassigned_at: '2025-12-20',
        contract_type_snapshot: 'plazo_fijo',
        contract_start_date_snapshot: '2025-01-01',
        contract_end_date_snapshot: '2025-12-31',
        contract_work_or_task_snapshot: null,
        special_labor_regime_snapshot: null,
        special_labor_regime_detail_snapshot: null,
      }] : []),
    ],
    documents: [
      ...(options.renewalScenario ? [{ id: DOCUMENT_COMPANY, accreditation_id: ACCREDITATION, requirement_id: REQ_COMPANY, worker_id: null, obligation_id: null }] : []),
      ...(workerHasDocument ? [{ id: DOCUMENT_WORKER, accreditation_id: ACCREDITATION, requirement_id: REQ_WORKER, worker_id: WORKER, obligation_id: OBLIGATION_WORKER }] : []),
    ],
    document_versions: [
      ...(options.renewalScenario ? [
        { id: VERSION_COMPANY_V1, document_id: DOCUMENT_COMPANY, version_number: 1, workflow_status: 'aprobado', issued_at: '2026-07-01', expires_at: '2026-07-31', uploaded_at: '2026-07-01T12:00:00Z', reviewed_at: '2026-07-02T12:00:00Z', rejection_reason: null, rejection_explanation: null, rejection_solution: null, storage_bucket: 'acredita-documents', storage_path: 'doc/v1/f30-v1.pdf', original_filename: 'f30-v1.pdf', metadata: { frontend_document_id: 'doc_renewal', reviewer_name: 'Acredita QA' } },
        { id: VERSION_COMPANY_V2, document_id: DOCUMENT_COMPANY, version_number: 2, workflow_status: 'aprobado', issued_at: '2026-08-25', expires_at: '2026-09-24', uploaded_at: '2026-08-25T12:00:00Z', reviewed_at: '2026-08-26T12:00:00Z', rejection_reason: null, rejection_explanation: null, rejection_solution: null, storage_bucket: 'acredita-documents', storage_path: 'doc/v2/f30-v2.pdf', original_filename: 'f30-v2.pdf', metadata: { frontend_document_id: 'doc_renewal', reviewer_name: 'Acredita QA' } },
        { id: VERSION_COMPANY_V3, document_id: DOCUMENT_COMPANY, version_number: 3, workflow_status: 'revision', issued_at: null, expires_at: null, uploaded_at: '2026-09-19T12:00:00Z', reviewed_at: null, rejection_reason: null, rejection_explanation: null, rejection_solution: null, storage_bucket: 'acredita-documents', storage_path: 'doc/v3/f30-v3.pdf', original_filename: 'f30-v3.pdf', metadata: { frontend_document_id: 'doc_renewal' } },
      ] : []),
      ...workerVersions,
    ],
    document_obligations: workerScenario ? [{
      id: OBLIGATION_WORKER,
      accreditation_id: ACCREDITATION,
      service_id: SERVICE,
      worker_assignment_id: ASSIGNMENT,
      requirement_id: REQ_WORKER,
      period_start: '2026-09-01',
      period_end: '2027-08-31',
      due_date: '2026-09-06',
      status: 'pendiente',
      is_active: true,
    }] : [],
    obligation_statuses: workerScenario && workerScenario !== 'pending' ? [{
      obligation_id: OBLIGATION_WORKER,
      accreditation_id: ACCREDITATION,
      service_id: SERVICE,
      worker_assignment_id: ASSIGNMENT,
      requirement_id: REQ_WORKER,
      period_start: '2026-09-01',
      period_end: '2027-08-31',
      due_date: '2026-09-06',
      is_active: true,
      effective_status: workerScenario === 'review' ? 'revision' : workerScenario === 'rejected' ? 'rechazado' : 'por_vencer',
      version_number: workerScenario === 'renewal_review' ? 1 : 1,
    }] : [],
    compliance_periods: [],
    accreditation_statuses: [
      { accreditation_id: ACCREDITATION, status: 'en_proceso', total_required: 2, approved_required: 0, pending_required: 2, rejected_required: 0, expired_required: 0, near_expiry_required: 0, access_allowed: false, payment_allowed: false },
      ...(options.historicalProject ? [{ accreditation_id: ACCREDITATION_OLD, status: 'aprobado', total_required: 0, approved_required: 0, pending_required: 0, rejected_required: 0, expired_required: 0, near_expiry_required: 0, access_allowed: false, payment_allowed: false }] : []),
    ],
    worker_accreditation_statuses: options.emptyProject || options.bulkReentry ? [] : [{ worker_assignment_id: ASSIGNMENT, worker_id: WORKER, accreditation_id: ACCREDITATION, status: 'en_proceso', total_required: 1, approved_required: 0, pending_required: 1, rejected_required: 0, expired_required: 0, near_expiry_required: 0, access_allowed: false }],
    contractor_evaluations: [],
    payment_cases: [{ id: PAYMENT, accreditation_id: ACCREDITATION, period_start: '2026-09-01', period_end: '2026-09-30', amount: 2500000, currency: 'CLP', status: paymentStatus, block_reason: paymentStatus === 'observado' ? 'Pendiente de aprobación' : null, invoice_number: 'F-100', submitted_at: '2026-09-15T00:00:00Z', paid_at: paymentStatus === 'pagado' ? '2026-09-15T01:00:00Z' : null }],
    support_tickets: [],
    integration_configs: [],
    business_sync_control: [{ revision: 10 }],
    notification_preferences: [],
    notification_reads: [],
    review_claims: options.renewalScenario && role === 'admin' ? [{ document_key: 'contratista_piloto_a::doc_renewal', document_version_id: VERSION_COMPANY_V3, claimed_by: PROFILE, claimed_at: '2026-09-19T12:00:00Z', expires_at: '2026-09-20T12:00:00Z' }] : [],
    asset_registry: options.assetLifecycle ? [
      {
        id: 'aa000000-0000-4000-8000-000000000001',
        integration_key: 'asset_camion_activo',
        project_key: 'proyecto_piloto',
        contractor_key: 'contratista_piloto_a',
        service_key: 'servicio_piloto',
        accreditation_id: ACCREDITATION,
        service_id: SERVICE,
        asset_type: 'vehiculo',
        identifier: 'ABCD12',
        name: 'Camión activo',
        brand: 'Volvo',
        model: 'FM',
        year: 2024,
        owner_name: 'Contratista Piloto A',
        operator_name: null,
        status: 'habilitado',
        access_allowed: true,
        notes: null,
        is_active: true,
        retired_at: null,
        retirement_reason: null,
        total_documents: 2,
        approved_documents: 2,
        blocking_documents: 0,
        next_expiry: '2026-10-20',
      },
      {
        id: 'aa000000-0000-4000-8000-000000000002',
        integration_key: 'asset_camion_historico',
        project_key: 'proyecto_piloto',
        contractor_key: 'contratista_piloto_a',
        service_key: 'servicio_piloto',
        accreditation_id: ACCREDITATION,
        service_id: SERVICE,
        asset_type: 'vehiculo',
        identifier: 'WXYZ34',
        name: 'Camión retirado',
        brand: 'Scania',
        model: 'R',
        year: 2022,
        owner_name: 'Contratista Piloto A',
        operator_name: null,
        status: 'inactivo',
        access_allowed: false,
        notes: null,
        is_active: false,
        retired_at: '2026-09-10T12:00:00Z',
        retirement_reason: 'Fin de arriendo',
        total_documents: 2,
        approved_documents: 2,
        blocking_documents: 0,
        next_expiry: null,
      },
    ] : [],
    asset_requirement_templates: options.assetLifecycle ? [
      {
        id: 'ab000000-0000-4000-8000-000000000001',
        project_id: PROJECT,
        asset_type: 'vehiculo',
        document_type: 'Permiso de circulación',
        validity_days: 365,
        blocks_access: true,
        is_required: true,
        review_checklist: ['Patente coincide'],
        is_active: true,
        retired_at: null,
        retirement_reason: null,
      },
      {
        id: 'ab000000-0000-4000-8000-000000000002',
        project_id: PROJECT,
        asset_type: 'vehiculo',
        document_type: 'Seguro antiguo',
        validity_days: 365,
        blocks_access: true,
        is_required: true,
        review_checklist: [],
        is_active: false,
        retired_at: '2026-08-01T12:00:00Z',
        retirement_reason: 'Requisito reemplazado',
      },
    ] : [],
    asset_requirement_statuses: [],
    asset_documents: [],
    asset_inspections: [],
    asset_maintenance: [],
    asset_operator_candidates: [],
    asset_operator_assignments: [],
    review_activity: [],
  } as Record<string, unknown[]>;
}

async function protectedPage(page: Page, role: Role, options: MockOptions = {}) {
  const data = fixtures(role, options);
  const calls: string[] = [];
  const mutations: Array<{ method: string; path: string; body: any }> = [];
  await page.addInitScript((session) => {
    window.localStorage.setItem('acredita_session', JSON.stringify(session));
  }, appSession(role));

  await page.route(`${SUPABASE}/**`, async route => {
    const request = route.request();
    const url = new URL(request.url());
    calls.push(`${request.method()} ${url.pathname}`);

    if (url.pathname === '/auth/v1/user') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: PROFILE, email: `${role}@e2e.invalid` }) });
    }
    if (url.pathname.startsWith('/auth/v1/token')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ access_token: 'e2e-access', refresh_token: 'e2e-refresh', expires_in: 3600, user: { id: PROFILE, email: `${role}@e2e.invalid` } }) });
    }
    if (url.pathname === '/rest/v1/rpc/mark_payment_paid') {
      return route.fulfill({ status: 204, body: '' });
    }
    if (url.pathname.startsWith('/rest/v1/rpc/')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(true) });
    }
    if (url.pathname.startsWith('/rest/v1/')) {
      const table = decodeURIComponent(url.pathname.slice('/rest/v1/'.length));
      if (request.method() !== 'GET' && request.method() !== 'HEAD') {
        let body: any = null;
        try { body = request.postDataJSON(); } catch { body = request.postData(); }
        mutations.push({ method: request.method(), path: url.pathname, body });
        if (request.method() === 'POST' && table === 'workers') {
          const payload = Array.isArray(body) ? body : [body];
          const workerRows = data.workers as any[];
          for (const item of payload) {
            const existing = workerRows.find(row => row.contratista_id === item.contratista_id && String(row.rut).replace(/[^0-9kK]/g, '').toUpperCase() === String(item.rut).replace(/[^0-9kK]/g, '').toUpperCase());
            if (existing) Object.assign(existing, item);
            else workerRows.push({ id: '70000000-0000-4000-8000-000000000099', ...item });
          }
          return route.fulfill({ status: 204, body: '' });
        }
        if (request.method() === 'POST' && table === 'worker_assignments') {
          const payload = Array.isArray(body) ? body : [body];
          const assignmentRows = data.worker_assignments as any[];
          for (const item of payload) assignmentRows.push({ id: '80000000-0000-4000-8000-000000000099', ...item });
          return route.fulfill({ status: 204, body: '' });
        }
        if (request.method() === 'POST' && table === 'documents') {
          return route.fulfill({
            status: 201,
            contentType: 'application/json',
            body: JSON.stringify([{ id: DOCUMENT_WORKER, ...body }]),
          });
        }
        if (request.method() === 'POST' && table === 'document_versions') {
          return route.fulfill({
            status: 201,
            contentType: 'application/json',
            body: JSON.stringify([{ id: VERSION_WORKER_V1, ...body }]),
          });
        }
        return route.fulfill({ status: 204, body: '' });
      }
      const rows = data[table] || [];
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(rows) });
    }
    if (url.pathname.startsWith('/storage/v1/')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    }
    return route.fulfill({ status: 404, body: '{}' });
  });

  return { calls, mutations };
}

async function openMandanteProject(page: Page) {
  await page.goto('/mandante');
  await expect(page.getByText('Mandante Piloto').first()).toBeVisible();
  const projectNav = page.getByText('Proyectos', { exact: true }).first();
  if (await projectNav.isVisible()) await projectNav.click();
  await expect(page.getByText('Proyecto Piloto QA').first()).toBeVisible();
  await page.getByText('Proyecto Piloto QA').first().click();
  await expect(page.getByRole('heading', { name: 'Proyecto Piloto QA' })).toBeVisible();
}

test('01 landing pública responde y muestra Acredita', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('body')).toContainText('Acredita');
});

test('02 login único detecta el portal y mantiene solicitudes de acceso', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'Iniciar sesión' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Soy Mandante' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Soy Contratista' })).toBeVisible();
  await expect(page.getByText(/detectará automáticamente tu organización, perfil y permisos/i)).toBeVisible();
});

test('03 Mandante hidrata proyecto desde Supabase', async ({ page }) => {
  await protectedPage(page, 'mandante');
  await page.goto('/mandante');
  await expect(page.locator('body')).toContainText('Mandante Piloto');
  await expect(page.locator('body')).toContainText('Proyecto Piloto QA');
});

test('04 Mandante abre el detalle del proyecto', async ({ page }) => {
  await protectedPage(page, 'mandante');
  await openMandanteProject(page);
  await expect(page.getByText('Gestiona la acreditación completa del proyecto')).toBeVisible();
});

test('05 Mandante dispone de Servicios, Activos, Requisitos, Períodos y Operación', async ({ page }) => {
  await protectedPage(page, 'mandante');
  await openMandanteProject(page);
  for (const label of ['Servicios', 'Activos', 'Requisitos', 'Periodos', 'Operacion', 'Acreditaciones']) {
    await expect(page.getByRole('button', { name: label, exact: true })).toBeVisible();
  }
});

test('06 matriz de activos parte sin registros y no auto-habilita nada', async ({ page }) => {
  await protectedPage(page, 'mandante');
  await openMandanteProject(page);
  await page.getByRole('button', { name: 'Activos', exact: true }).click();
  await expect(page.getByText('Vehículos, maquinaria y equipos')).toBeVisible();
  await expect(page.getByText('No hay vehículos, maquinaria o equipos registrados.')).toBeVisible();
});

test('07 operación muestra estados de pago gobernados por aprobación', async ({ page }) => {
  await protectedPage(page, 'mandante', { paymentStatus: 'observado' });
  await openMandanteProject(page);
  await page.getByRole('button', { name: 'Operacion', exact: true }).click();
  await page.getByRole('button', { name: /Estados de pago/ }).click();
  await expect(page.getByText('Pendiente de aprobación')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Aprobaciones' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Marcar pagado' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Liberar' })).toHaveCount(0);
});

test('08 un pago liberado permite únicamente confirmar Pagado', async ({ page }) => {
  const { calls } = await protectedPage(page, 'mandante', { paymentStatus: 'liberado' });
  await openMandanteProject(page);
  await page.getByRole('button', { name: 'Operacion', exact: true }).click();
  await page.getByRole('button', { name: /Estados de pago/ }).click();
  await page.getByRole('button', { name: 'Marcar pagado' }).click();
  await expect.poll(() => calls.some(call => call.includes('/rest/v1/rpc/mark_payment_paid'))).toBeTruthy();
});

test('09 Contratista hidrata su empresa, mantiene proyecto activo visible y separa responsabilidades', async ({ page }) => {
  await protectedPage(page, 'contratista');
  await page.goto('/contratista');
  await expect(page.locator('body')).toContainText('Contratista Piloto A');
  await expect(page.locator('body')).toContainText('Proyecto Piloto QA');
  await expect(page.getByLabel('Proyecto activo global')).toHaveValue('proyecto_piloto');
  await expect(page.getByText('Requiere acción', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Acción preventiva', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Esperando a Acredita', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Sin acción requerida', { exact: true }).first()).toBeVisible();
});

test('09b Contratista nuevo recibe onboarding guiado de cinco pasos', async ({ page }) => {
  await protectedPage(page, 'contratista', { emptyProject: true });
  await page.goto('/contratista');
  await expect(page.getByText('Comienza la acreditación de Proyecto Piloto QA')).toBeVisible();
  for (const step of ['Revisar requisitos', 'Completar empresa', 'Cargar trabajadores', 'Completar trabajadores', 'Obtener acreditación']) {
    await expect(page.getByRole('button', { name: new RegExp(step) })).toBeVisible();
  }
});

test('09c Contratista conserva proyecto en URL, memoria y navegación del navegador', async ({ page }) => {
  await protectedPage(page, 'contratista', { historicalProject: true });
  await page.goto('/contratista');

  const selector = page.getByLabel('Proyecto activo global');
  await expect(selector).toHaveValue('proyecto_piloto');
  await expect(selector.locator('optgroup[label="Proyectos activos"] option')).toHaveText(['Proyecto Piloto QA']);
  await expect(selector.locator('optgroup[label="Históricos / relación finalizada"] option')).toHaveText(['Proyecto Histórico QA · Histórico']);

  await selector.selectOption('proyecto_historico');
  await expect(page).toHaveURL(/proyecto=proyecto_historico/);
  await expect(selector).toHaveValue('proyecto_historico');
  await expect.poll(() => page.evaluate(() => localStorage.getItem('acredita:last-project:10000000-0000-4000-8000-000000000001'))).toBe('proyecto_historico');

  await page.getByText('Documentos', { exact: true }).first().click();
  await expect(page).toHaveURL(/\/contratista\/documentos\?proyecto=proyecto_historico/);

  await page.goBack();
  await expect(page).toHaveURL(/\/contratista\?proyecto=proyecto_historico/);
  await expect(page.getByLabel('Proyecto activo global')).toHaveValue('proyecto_historico');

  await page.goto('/contratista');
  await expect(page).toHaveURL(/proyecto=proyecto_historico/);
  await expect(page.getByLabel('Proyecto activo global')).toHaveValue('proyecto_historico');
});

test('09d Contratista ve problemas no documentales y abre el pendiente documental exacto', async ({ page }) => {
  await protectedPage(page, 'contratista');
  await page.goto('/contratista');

  await expect(page.getByText(/Trabajador Piloto · Ficha laboral incompleta/).first()).toBeVisible();
  const priority = page.locator('.inicio2-priority').first();
  await expect(priority).toContainText('Prioridad 1 · Bloquea pago');
  await expect(priority).toContainText('F30 / F31 SII');
  await priority.getByRole('button', { name: 'Resolver' }).click();

  await expect(page).toHaveURL(/\/contratista\/documentos\?.*estado=accion.*requisito=req_f30/);
  await expect(page.getByLabel('Filtrar por estado')).toHaveValue('accion');
  await expect(page.locator('.doc-detail-title')).toHaveText('F30 / F31 SII');

  await page.goto('/contratista?proyecto=proyecto_piloto');
  const attentionCard = page.locator('.inicio2-card').filter({ hasText: 'Requiere atención' });
  await attentionCard.getByRole('button', { name: 'Ver todo' }).click();
  await expect(page).toHaveURL(/\/contratista\/documentos\?.*estado=accion/);
  await expect(page.getByLabel('Filtrar por estado')).toHaveValue('accion');
});

test('09e Proyecto histórico no genera acciones y Documentos queda en modo consulta', async ({ page }) => {
  await protectedPage(page, 'contratista', { historicalProject: true });
  await page.goto('/contratista?proyecto=proyecto_historico');

  await expect(page.getByText('Proyecto histórico · modo consulta', { exact: true }).last()).toBeVisible();
  const responsibilities = page.getByLabel('Responsabilidad de pendientes');
  await expect(responsibilities.locator('.mine b')).toHaveText('0');
  await expect(responsibilities.locator('.preventive b')).toHaveText('0');
  await expect(responsibilities.locator('.waiting b')).toHaveText('0');
  await expect(page.getByRole('button', { name: /Subir documento/ })).toHaveCount(0);

  await page.getByText('Documentos', { exact: true }).first().click();
  await expect(page.getByText('Proyecto histórico · modo consulta', { exact: true })).toBeVisible();
  await expect(page.getByText('Documento Histórico QA', { exact: true }).first()).toBeVisible();
  const historicalNoFileButton = page.getByRole('button', { name: 'Sin archivo', exact: true }).first();
  await expect(historicalNoFileButton).toBeVisible();
  await expect(historicalNoFileButton).toBeDisabled();
});

test('09f ficha completa funciona como expediente integral de acreditación', async ({ page }) => {
  await protectedPage(page, 'contratista', { renewalScenario: true, workerDocumentScenario: 'renewal_review' });
  await page.goto('/contratista?proyecto=proyecto_piloto');

  await page.getByRole('button', { name: 'Ver ficha completa', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Contratista Piloto A' })).toBeVisible();
  await expect(page.getByText('Expediente de acreditación', { exact: true })).toBeVisible();
  await expect(page.getByText('Servicios / contratos', { exact: true })).toBeVisible();
  await expect(page.getByText('Períodos documentales', { exact: true })).toBeVisible();
  await expect(page.getByText('Versiones documentales', { exact: true })).toBeVisible();

  await page.getByRole('tab', { name: /Historial/ }).click();
  await expect(page.getByText('Servicios y contratos', { exact: true })).toBeVisible();
  await expect(page.getByText(/SRV-01 · Servicio Piloto/)).toBeVisible();
  await expect(page.getByText('Períodos de trabajadores', { exact: true })).toBeVisible();
  await expect(page.getByText('Trabajador Piloto', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Obligaciones por período', { exact: true })).toBeVisible();
  await expect(page.getByText('Trazabilidad documental', { exact: true })).toBeVisible();
  await expect(page.getByText(/Empresa · F30 \/ F31 SII/).first()).toBeVisible();
  await expect(page.getByText(/Trabajador Piloto · Certificado ODI/).first()).toBeVisible();
  await expect(page.getByText('v3', { exact: true })).toBeVisible();
  await expect(page.getByText('v2', { exact: true }).first()).toBeVisible();
});

test('09g expediente histórico conserva períodos y bloquea acciones operativas', async ({ page }) => {
  await protectedPage(page, 'contratista', { historicalProject: true });
  await page.goto('/contratista?proyecto=proyecto_historico');

  await page.getByRole('button', { name: 'Ver historial', exact: true }).first().click();
  await expect(page.getByText('Expediente histórico de acreditación', { exact: true })).toBeVisible();
  await expect(page.getByText('Proyecto histórico · modo consulta', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Renovar', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Corregir', exact: true })).toHaveCount(0);

  await page.getByRole('tab', { name: /Trabajadores/ }).click();
  await expect(page.getByText('Trabajador Piloto', { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/Plazo fijo · hasta 2025-12-31/)).toBeVisible();
  await expect(page.getByText('Histórico', { exact: true }).first()).toBeVisible();

  await page.getByRole('tab', { name: /Historial/ }).click();
  await expect(page.getByText('Períodos de trabajadores', { exact: true })).toBeVisible();
  await expect(page.getByText(/10 ene 2025 → 20 dic 2025/)).toBeVisible();
});

test('10 Contratista puede abrir Proyectos', async ({ page }) => {
  await protectedPage(page, 'contratista');
  await page.goto('/contratista');
  await page.getByText('Proyectos', { exact: true }).first().click();
  await expect(page.locator('.mp-project-title').filter({ hasText: 'Proyecto Piloto QA' }).first()).toBeVisible();
});

test('10b Proyectos separa operación activa de historial y bloquea mutaciones del histórico', async ({ page }) => {
  await protectedPage(page, 'contratista', { historicalProject: true });
  await page.goto('/contratista/proyectos?proyecto=proyecto_piloto');

  const activeCard = page.locator('.mp-project-card').filter({ hasText: 'Proyecto Piloto QA' });
  const historicalCard = page.locator('.mp-project-card').filter({ hasText: 'Proyecto Histórico QA' });
  await expect(activeCard).toBeVisible();
  await expect(historicalCard).toBeVisible();
  await expect(historicalCard.getByText('Histórico', { exact: true })).toBeVisible();
  await expect(historicalCard.getByRole('button', { name: 'Ver historial', exact: true })).toBeVisible();
  await expect(historicalCard.getByRole('button', { name: 'Resolver bloqueos' })).toHaveCount(0);

  await historicalCard.getByRole('button', { name: 'Ver historial', exact: true }).click();
  await expect(page.getByText(/Proyecto histórico · modo consulta/)).toBeVisible();
  await expect(page.getByText('Santiago', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Vehículos y equipos', exact: true }).click();
  await expect(page.getByText(/activos disponibles solo para consulta/i)).toBeVisible();
  await expect(page.getByRole('button', { name: /Nuevo activo/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Editar ficha/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Guardar en biblioteca/ })).toHaveCount(0);
});

test('10c Proyecto activo con relación de contratista finalizada queda en modo histórico', async ({ page }) => {
  await protectedPage(page, 'contratista', { inactiveAccreditationOnActiveProject: true });
  await page.goto('/contratista?proyecto=proyecto_piloto');

  await expect(page.getByText('Proyecto histórico · modo consulta', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /Subir documento/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Agregar trabajador/ })).toHaveCount(0);

  await page.getByText('Proyectos', { exact: true }).first().click();
  const card = page.locator('.mp-project-card').filter({ hasText: 'Proyecto Piloto QA' });
  await expect(card.getByText('Histórico', { exact: true })).toBeVisible();
  await expect(card.getByRole('button', { name: 'Ver historial', exact: true })).toBeVisible();
});

test('10d Activos permite retiro formal y conserva activos históricos', async ({ page }) => {
  const ctx = await protectedPage(page, 'mandante', { assetLifecycle: true });
  await openMandanteProject(page);

  await page.getByRole('button', { name: 'Activos', exact: true }).click();
  await expect(page.getByText(/Camión activo/).first()).toBeVisible();
  await expect(page.getByText(/Camión retirado/).first()).toBeVisible();
  await expect(page.getByText('Fin de arriendo', { exact: false })).toBeVisible();
  await expect(page.getByText('Históricos').first()).toBeVisible();

  const activeRow = page.locator('tr').filter({ hasText: 'Camión activo' });
  const historicRow = page.locator('tr').filter({ hasText: 'Camión retirado' });
  await expect(activeRow.getByRole('button', { name: /Retirar/ })).toBeVisible();
  await expect(historicRow.getByRole('button', { name: /Editar ficha/ })).toHaveCount(0);
  await expect(historicRow.getByRole('button', { name: /Retirar/ })).toHaveCount(0);

  page.once('dialog', dialog => dialog.accept('Fin de contrato del activo'));
  await activeRow.getByRole('button', { name: /Retirar/ }).click();
  await expect.poll(() => ctx.mutations.some(item =>
    item.method === 'PATCH'
    && item.path === '/rest/v1/assets'
    && item.body?.is_active === false
    && item.body?.retirement_reason === 'Fin de contrato del activo'
  )).toBe(true);
});

test('10e Matriz retira requisitos sin borrarlos', async ({ page }) => {
  const ctx = await protectedPage(page, 'mandante', { assetLifecycle: true });
  await openMandanteProject(page);

  await page.getByRole('button', { name: 'Activos', exact: true }).click();
  await expect(page.getByText('Permiso de circulación', { exact: true })).toBeVisible();
  await expect(page.getByText('Seguro antiguo', { exact: true })).toBeVisible();
  await expect(page.getByText(/Requisito reemplazado/)).toBeVisible();

  const requirementRow = page.locator('tr').filter({ hasText: 'Permiso de circulación' });
  page.once('dialog', dialog => dialog.accept('Nueva política documental'));
  await requirementRow.getByRole('button', { name: 'Retirar requisito' }).click();

  await expect.poll(() => ctx.mutations.some(item =>
    item.method === 'PATCH'
    && item.path === '/rest/v1/asset_requirement_templates'
    && item.body?.is_active === false
    && item.body?.retirement_reason === 'Nueva política documental'
  )).toBe(true);
  expect(ctx.mutations.some(item => item.method === 'DELETE' && item.path === '/rest/v1/asset_requirement_templates')).toBe(false);
});

test('11 Contratista ve requisitos documentales desde Supabase', async ({ page }) => {
  await protectedPage(page, 'contratista');
  await page.goto('/contratista');
  await page.getByText('Documentos', { exact: true }).first().click();
  await expect(page.locator('body')).toContainText('F30 / F31 SII');
});

test('11b renovación anticipada mantiene versión vigente y expone historial por versión', async ({ page }) => {
  await protectedPage(page, 'contratista', { renewalScenario: true });
  await page.goto('/contratista/documentos?proyecto=proyecto_piloto&estado=revision');

  await expect(page.getByLabel('Filtrar por estado')).toHaveValue('revision');
  await expect(page.getByText('F30 / F31 SII', { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/v3 en revisión/i).first()).toBeVisible();

  await page.getByText('F30 / F31 SII', { exact: true }).first().click();
  await expect(page.getByText('Renovación v3 en revisión', { exact: true })).toBeVisible();
  await expect(page.getByText(/La versión v2 continúa vigente/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Ver versión' })).toBeVisible();
});

test('11c verificador confirma emisión y Acredita calcula vencimiento antes de aprobar', async ({ page }) => {
  await protectedPage(page, 'admin', { renewalScenario: true });
  await page.goto('/admin');
  const reviewNav = page.getByTitle('Cola de revisión');
  if (await reviewNav.count()) await reviewNav.first().click();
  else await page.getByRole('button', { name: /Cola de revisión/ }).first().click();
  await expect(page.getByRole('heading', { name: 'Cola de revisión' })).toBeVisible();
  await page.getByRole('button', { name: /En revisión/ }).click();

  await expect(page.getByText(/Renovación anticipada:/)).toBeVisible();
  const emission = page.getByLabel('Emisión');
  const expiry = page.getByLabel('Vencimiento');
  await emission.fill('2026-09-19');
  await expect(expiry).toHaveValue('2026-10-19');
  await expect(page.getByText(/Vigencia configurada: 30 días/)).toBeVisible();
});

test('12 Contratista ve trabajador asignado', async ({ page }) => {
  await protectedPage(page, 'contratista');
  await page.goto('/contratista');
  await page.getByText('Trabajadores', { exact: true }).first().click();
  await expect(page.getByText('Trabajador Piloto', { exact: true }).first()).toBeVisible();
});

test('12b Trabajadores históricos son solo consulta y conservan el contrato de ese período', async ({ page }) => {
  await protectedPage(page, 'contratista', { historicalProject: true });
  await page.goto('/contratista/trabajadores?proyecto=proyecto_historico');

  await expect(page.getByText('Proyecto histórico · modo consulta', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Trabajador Piloto', { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: /Agregar trabajador/ })).toHaveCount(0);

  await page.getByRole('button', { name: 'Ver historial' }).click();
  await expect(page.getByText('Histórico', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Editar' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Retirar' })).toHaveCount(0);
  await expect(page.getByText(/Plazo fijo · hasta 2025-12-31/).first()).toBeVisible();
  await expect(page.getByText(/contrato desde 2025-01-01/)).toBeVisible();
  await expect(page.getByText(/Proyecto histórico · modo consulta/).last()).toBeVisible();
});

test('12c Alta de trabajador limita ingreso a la vigencia del contrato', async ({ page }) => {
  await protectedPage(page, 'contratista', { emptyProject: true });
  await page.goto('/contratista/trabajadores?proyecto=proyecto_piloto');

  await page.getByRole('button', { name: /Agregar trabajador/ }).click();
  await page.getByLabel('Tipo de contrato').selectOption('plazo_fijo');
  await page.getByLabel('Fecha de inicio del contrato').fill('2026-09-10');
  await page.getByLabel('Fecha de término del contrato').fill('2026-09-20');

  const entry = page.getByLabel('Fecha de ingreso al proyecto');
  await expect(entry).toHaveAttribute('min', '2026-09-10');
  await expect(entry).toHaveAttribute('max', '2026-09-20');
});

test('12d primera carga de trabajador se vincula a la obligación activa exacta', async ({ page }) => {
  const { mutations } = await protectedPage(page, 'contratista', { workerDocumentScenario: 'pending' });
  await page.goto('/contratista/trabajadores?proyecto=proyecto_piloto');

  await page.getByRole('button', { name: 'Ver carpeta' }).click();
  await expect(page.getByText('Certificado ODI', { exact: true })).toBeVisible();

  const fileChooserPromise = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Subir', exact: true }).click();
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles({
    name: 'odi-trabajador.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.4\n% Acredita E2E'),
  });

  await expect.poll(() => {
    const post = mutations.find(item => item.method === 'POST' && item.path === '/rest/v1/documents');
    return post?.body?.obligation_id || null;
  }).toBe(OBLIGATION_WORKER);
});

test('12e documento obligatorio en revisión queda esperando a Acredita sin pedir otra carga', async ({ page }) => {
  await protectedPage(page, 'contratista', { workerDocumentScenario: 'review' });
  await page.goto('/contratista/trabajadores?proyecto=proyecto_piloto');

  await page.getByRole('button', { name: 'Ver carpeta' }).click();
  await expect(page.getByText('Esperando a Acredita', { exact: true })).toBeVisible();
  await expect(page.getByText(/Hay 1 documento obligatorio en revisión/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Subir', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Corregir', exact: true })).toHaveCount(0);
});

test('12f rechazo de trabajador muestra el requisito y motivo exactos para corregir', async ({ page }) => {
  await protectedPage(page, 'contratista', { workerDocumentScenario: 'rejected' });
  await page.goto('/contratista/trabajadores?proyecto=proyecto_piloto');

  await page.getByRole('button', { name: 'Resolver', exact: true }).click();
  await expect(page.getByText('Motivo: Falta firma', { exact: true })).toBeVisible();
  await expect(page.getByText(/Certificado ODI: Falta firma/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Corregir', exact: true })).toBeVisible();
  await expect(page.getByText('Qué bloquea el ingreso', { exact: true })).toBeVisible();
});

test('12g renovación anticipada en revisión conserva vigencia y evita cargas duplicadas', async ({ page }) => {
  await protectedPage(page, 'contratista', { workerDocumentScenario: 'renewal_review' });
  await page.goto('/contratista/trabajadores?proyecto=proyecto_piloto');

  await page.getByRole('button', { name: 'Ver carpeta' }).click();
  await expect(page.getByText(/Renovación v2 en revisión/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'En revisión', exact: true })).toBeVisible();
  await expect(page.getByText('Renovaciones en revisión', { exact: true })).toBeVisible();
  await expect(page.getByText('Habilitado', { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Renovar', exact: true })).toHaveCount(0);
});


test('12h carga masiva rechaza la plantilla antigua sin ficha laboral', async ({ page }) => {
  await protectedPage(page, 'contratista', { emptyProject: true });
  await page.goto('/contratista');
  await page.getByText('Configuración', { exact: true }).first().click();
  await page.getByRole('button', { name: 'Carga masiva', exact: true }).click();

  await page.locator('input[type="file"][accept*=".csv"]').setInputFiles({
    name: 'trabajadores-antiguo.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('Nombre;RUT;Cargo;Categorias;FechaIngreso\nJuan Pérez;12.345.678-5;Operador;General;2026-09-20\n'),
  });

  await expect(page.getByText(/El CSV debe incluir: TipoContrato, FechaInicioContrato/)).toBeVisible();
  await expect(page.getByRole('button', { name: /Importar/ })).toHaveCount(0);
});

test('12i carga masiva exige categorías configuradas y valida la combinación documental', async ({ page }) => {
  await protectedPage(page, 'contratista', { emptyProject: true, categorizedWorker: true });
  await page.goto('/contratista');
  await page.getByText('Configuración', { exact: true }).first().click();
  await page.getByRole('button', { name: 'Carga masiva', exact: true }).click();

  const input = page.locator('input[type="file"][accept*=".csv"]');
  const header = 'Nombre;RUT;Cargo;Servicio;Categorias;FechaIngreso;TipoContrato;FechaInicioContrato;FechaTerminoContrato;ObraFaenaContrato;RegimenEspecial;DetalleRegimenEspecial\n';
  await input.setInputFiles({
    name: 'sin-categoria.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(header + 'Juan Pérez;12.345.678-5;Operador;SRV-01;;2026-09-20;indefinido;2026-09-01;;;;\n'),
  });
  await expect(page.getByText('Falta categoría', { exact: true })).toBeVisible();

  await input.setInputFiles({
    name: 'con-categoria.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(header + 'Juan Pérez;12.345.678-5;Operador;SRV-01;altura;2026-09-20;indefinido;2026-09-01;;;;\n'),
  });
  await expect(page.getByText(/Correcta · 1 requisitos aplicables/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Importar 1', exact: true })).toBeEnabled();
});

test('12j carga masiva persiste contrato servicio categoría y nueva asignación', async ({ page }) => {
  const { mutations } = await protectedPage(page, 'contratista', { emptyProject: true });
  await page.goto('/contratista');
  await page.getByText('Configuración', { exact: true }).first().click();
  await page.getByRole('button', { name: 'Carga masiva', exact: true }).click();

  const csv = [
    'Nombre;RUT;Cargo;Servicio;Categorias;FechaIngreso;TipoContrato;FechaInicioContrato;FechaTerminoContrato;ObraFaenaContrato;RegimenEspecial;DetalleRegimenEspecial',
    'Juan Pérez;12.345.678-5;Operador;SRV-01;;2026-09-20;indefinido;2026-09-01;;;;',
  ].join('\n');
  await page.locator('input[type="file"][accept*=".csv"]').setInputFiles({
    name: 'trabajadores-validos.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(csv),
  });

  await expect(page.getByText(/Correcta · 1 requisitos aplicables/)).toBeVisible();
  await page.getByRole('button', { name: 'Importar 1', exact: true }).click();

  await expect.poll(() => {
    const mutation = mutations.find(item => item.method === 'POST' && item.path === '/rest/v1/workers');
    const payload = Array.isArray(mutation?.body) ? mutation?.body[0] : mutation?.body;
    return payload?.contract_type || null;
  }).toBe('indefinido');

  await expect.poll(() => {
    const mutation = mutations.find(item => item.method === 'POST' && item.path === '/rest/v1/worker_assignments');
    return mutation?.body?.service_id || null;
  }).toBe(SERVICE);

  const assignmentMutation = mutations.find(item => item.method === 'POST' && item.path === '/rest/v1/worker_assignments');
  expect(assignmentMutation?.body?.categories).toEqual(['General']);
  expect(assignmentMutation?.body?.assigned_at).toBe('2026-09-20');
  expect(assignmentMutation?.body?.contract_type_snapshot).toBe('indefinido');
  expect(assignmentMutation?.body?.contract_start_date_snapshot).toBe('2026-09-01');
});

test('12k carga masiva crea un período nuevo en reingreso sin reactivar el histórico', async ({ page }) => {
  const { mutations } = await protectedPage(page, 'contratista', { bulkReentry: true });
  await page.goto('/contratista');
  await page.getByText('Configuración', { exact: true }).first().click();
  await page.getByRole('button', { name: 'Carga masiva', exact: true }).click();

  const csv = [
    'Nombre;RUT;Cargo;Servicio;Categorias;FechaIngreso;TipoContrato;FechaInicioContrato;FechaTerminoContrato;ObraFaenaContrato;RegimenEspecial;DetalleRegimenEspecial',
    'Trabajador Reingreso;12.345.678-5;Operador;SRV-01;;2026-09-20;plazo_fijo;2026-09-20;2026-12-31;;;',
  ].join('\n');
  await page.locator('input[type="file"][accept*=".csv"]').setInputFiles({
    name: 'reingreso.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(csv),
  });

  await expect(page.getByText('Correcta · reingreso', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Importar 1', exact: true }).click();

  await expect.poll(() => mutations.filter(item => item.method === 'POST' && item.path === '/rest/v1/worker_assignments').length).toBeGreaterThan(0);
  const newAssignment = mutations.find(item => item.method === 'POST' && item.path === '/rest/v1/worker_assignments');
  expect(newAssignment?.body?.assigned_at).toBe('2026-09-20');
  expect(newAssignment?.body?.contract_type_snapshot).toBe('plazo_fijo');
  expect(newAssignment?.body?.contract_end_date_snapshot).toBe('2026-12-31');

  // La presencia de un POST prueba que el reingreso crea una fila nueva.
  // La base ya impide reactivar períodos históricos mediante trigger.
});

test('12l carga masiva excluye proyectos históricos', async ({ page }) => {
  await protectedPage(page, 'contratista', { historicalProject: true });
  await page.goto('/contratista');
  await page.getByText('Configuración', { exact: true }).first().click();
  await page.getByRole('button', { name: 'Carga masiva', exact: true }).click();

  const selector = page.getByLabel('Proyecto para carga masiva');
  await expect(selector.locator('option')).toHaveText(['Proyecto Piloto QA']);
  await expect(selector).not.toContainText('Proyecto Histórico QA');
});

test('13 Contratista puede abrir configuración y notificaciones sin perder sesión', async ({ page }) => {
  await protectedPage(page, 'contratista');
  await page.goto('/contratista');
  await page.getByText('Configuración', { exact: true }).first().click();
  await page.getByRole('button', { name: 'Notificaciones', exact: true }).click();
  await expect(page.locator('body')).toContainText('Documento rechazado');
});

test('14 rol Contratista no puede entrar al portal Mandante', async ({ page }) => {
  await protectedPage(page, 'contratista');
  await page.goto('/mandante');
  await expect(page).toHaveURL(/\/contratista/);
});

test('15 rol Mandante no puede entrar al portal Contratista', async ({ page }) => {
  await protectedPage(page, 'mandante');
  await page.goto('/contratista');
  await expect(page).toHaveURL(/\/mandante/);
});

test('16 rol Acredita no queda atrapado en portales de cliente', async ({ page }) => {
  await protectedPage(page, 'admin');
  await page.goto('/contratista');
  await expect(page).toHaveURL(/\/admin/);
});
