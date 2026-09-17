import { expect, test, type Page } from '@playwright/test';

const SUPABASE = 'https://jwlscxbmttpicwljozwf.supabase.co';
const MANDANTE = '22000000-0000-4000-8000-000000000001';
const PROJECT = '32000000-0000-4000-8000-000000000001';
const CONTRACTOR = '42000000-0000-4000-8000-000000000001';
const ACCREDITATION = '52000000-0000-4000-8000-000000000001';
const WORKER = '62000000-0000-4000-8000-000000000001';
const ASSIGNMENT = '72000000-0000-4000-8000-000000000001';
const REQ_COMPANY = '82000000-0000-4000-8000-000000000001';
const REQ_WORKER = '82000000-0000-4000-8000-000000000002';
const DOC = '92000000-0000-4000-8000-000000000001';
const V1 = 'a2000000-0000-4000-8000-000000000001';
const V2 = 'a2000000-0000-4000-8000-000000000002';
const PROFILE_MANDANTE = '12000000-0000-4000-8000-000000000001';
const PROFILE_CONTRACTOR = '12000000-0000-4000-8000-000000000002';
const PROFILE_ADMIN = '12000000-0000-4000-8000-000000000003';

type Role = 'mandante' | 'contratista' | 'admin';
type Stage = 'pending' | 'revision' | 'rejected' | 'corrected';
type Call = { method: string; path: string; body?: string | null };

const profileId = (role: Role) => role === 'mandante' ? PROFILE_MANDANTE : role === 'contratista' ? PROFILE_CONTRACTOR : PROFILE_ADMIN;

function session(role: Role) {
  return {
    email: role === 'mandante' ? 'mandante@acredita.cl' : role === 'contratista' ? 'contratista@acredita.cl' : 'admin@e2e.invalid',
    role,
    nombre: role === 'mandante' ? 'El Boliche SpA' : role === 'contratista' ? 'Terrible de Pollo SpA' : 'Acredita QA',
    profileId: profileId(role),
    ...(role === 'mandante' ? { mandanteId: 'el_boliche', mandanteBackendId: MANDANTE } : {}),
    ...(role === 'contratista' ? { contratistaId: 'terrible_de_pollo', contratistaBackendId: CONTRACTOR } : {}),
    _supabase: { accessToken: `e2e-${role}`, refreshToken: `e2e-refresh-${role}`, expiresAt: Date.now() + 3_600_000 },
  };
}

function dataFor(role: Role, stage: Stage) {
  const versions: any[] = stage === 'pending' ? [] : stage === 'revision' ? [{
    id: V1, document_id: DOC, version_number: 1, workflow_status: 'revision', expires_at: null,
    uploaded_at: '2026-09-16T12:00:00Z', reviewed_at: null, rejection_reason: null,
    rejection_explanation: null, rejection_solution: null, storage_bucket: 'acredita-documents',
    storage_path: `${DOC}/v1/f30.pdf`, original_filename: 'F30_Terrible_de_Pollo.pdf', metadata: {},
  }] : stage === 'rejected' ? [{
    id: V1, document_id: DOC, version_number: 1, workflow_status: 'rechazado', expires_at: null,
    uploaded_at: '2026-09-16T12:00:00Z', reviewed_at: '2026-09-16T13:00:00Z', rejection_reason: 'Documento ilegible',
    rejection_explanation: 'La segunda página no se puede leer.', rejection_solution: 'Vuelve a cargar una copia legible.',
    storage_bucket: 'acredita-documents', storage_path: `${DOC}/v1/f30.pdf`, original_filename: 'F30_Terrible_de_Pollo.pdf', metadata: {},
  }] : [{
    id: V1, document_id: DOC, version_number: 1, workflow_status: 'rechazado', expires_at: null,
    uploaded_at: '2026-09-16T12:00:00Z', reviewed_at: '2026-09-16T13:00:00Z', rejection_reason: 'Documento ilegible',
    rejection_explanation: 'La segunda página no se puede leer.', rejection_solution: 'Vuelve a cargar una copia legible.',
    storage_bucket: 'acredita-documents', storage_path: `${DOC}/v1/f30.pdf`, original_filename: 'F30_Terrible_de_Pollo.pdf', metadata: {},
  }, {
    id: V2, document_id: DOC, version_number: 2, workflow_status: 'revision', expires_at: null,
    uploaded_at: '2026-09-16T14:00:00Z', reviewed_at: null, rejection_reason: null,
    rejection_explanation: null, rejection_solution: null, storage_bucket: 'acredita-documents',
    storage_path: `${DOC}/v2/f30-corregido.pdf`, original_filename: 'F30_Terrible_de_Pollo_CORREGIDO.pdf', metadata: {},
  }];

  return {
    profiles: [
      { id: PROFILE_MANDANTE, full_name: 'Martina Salazar Fuentes', is_active: true },
      { id: PROFILE_CONTRACTOR, full_name: 'Álvaro Gutiérrez Silva', is_active: true },
      { id: PROFILE_ADMIN, full_name: 'Acredita QA', is_active: true },
    ],
    acredita_memberships: role === 'admin' ? [{ profile_id: PROFILE_ADMIN, role: 'admin_acredita', is_active: true }] : [],
    mandante_memberships: role === 'mandante' ? [{ profile_id: PROFILE_MANDANTE, mandante_id: MANDANTE, role: 'mandante_admin', is_active: true }] : [],
    contratista_memberships: role === 'contratista' ? [{ profile_id: PROFILE_CONTRACTOR, contratista_id: CONTRACTOR, role: 'contratista_admin', is_active: true }] : [],
    mandantes: [{ id: MANDANTE, name: 'El Boliche SpA', rut: '76.876.543-K', legal_name: 'El Boliche SpA', integration_key: 'el_boliche', is_active: true }],
    projects: [{ id: PROJECT, mandante_id: MANDANTE, name: 'Operación Gastronómica El Boliche 2026', code: 'BOLICHE-2026', status: 'active', integration_key: 'operacion_gastronomica_el_boliche_2026', location: 'Santiago', starts_at: '2026-09-01', ends_at: null }],
    contratistas: [{ id: CONTRACTOR, name: 'Terrible de Pollo SpA', rut: '77.123.456-9', legal_name: 'Terrible de Pollo SpA', integration_key: 'terrible_de_pollo', is_active: true, parent_contratista_id: null }],
    accreditations: [{ id: ACCREDITATION, project_id: PROJECT, contratista_id: CONTRACTOR, is_active: true }],
    requirements: [
      { id: REQ_COMPANY, project_id: PROJECT, integration_key: 'f30_sii_mes_vigente', name: 'F30 SII (mes vigente)', category: 'Tributario', target: 'empresa', is_required: true, frequency: 'mensual', validity_days: 30, alert_days: 7, criticality: 'bloquea_pago', is_active: true, sort_order: 1, description: 'Cumplimiento tributario mensual', review_checklist: [], applicability: { categories: [] }, blocks_work: false, blocks_assignment: false, service_id: null, due_days: 5 },
      { id: REQ_WORKER, project_id: PROJECT, integration_key: 'contrato_trabajo', name: 'Contrato de Trabajo', category: 'Laboral', target: 'trabajador', is_required: true, frequency: 'sin_vencimiento', validity_days: null, alert_days: 15, criticality: 'bloquea_acceso', is_active: true, sort_order: 2, description: 'Contrato vigente del trabajador', review_checklist: [], applicability: { categories: [] }, blocks_work: true, blocks_assignment: true, service_id: null, due_days: 5 },
    ],
    workers: [{ id: WORKER, contratista_id: CONTRACTOR, rut: '21.406.583-5', full_name: 'sofia', job_title: 'abogada', is_active: true }],
    worker_assignments: [{ id: ASSIGNMENT, accreditation_id: ACCREDITATION, worker_id: WORKER, is_active: true, service_id: null, job_title: 'abogada', categories: ['general'], assignment_status: 'activa', access_status: 'pendiente', assigned_at: '2026-09-16', unassigned_at: null }],
    documents: stage === 'pending' ? [] : [{ id: DOC, accreditation_id: ACCREDITATION, requirement_id: REQ_COMPANY, worker_id: null, obligation_id: null }],
    document_versions: versions,
    obligation_statuses: [],
    compliance_periods: [],
    services: [],
    accreditation_statuses: [{ accreditation_id: ACCREDITATION, status: 'en_proceso', total_required: 2, approved_required: 0, pending_required: 2, rejected_required: stage === 'rejected' ? 1 : 0, expired_required: 0, near_expiry_required: 0, access_allowed: false, payment_allowed: false }],
    worker_accreditation_statuses: [{ worker_assignment_id: ASSIGNMENT, worker_id: WORKER, accreditation_id: ACCREDITATION, status: 'en_proceso', total_required: 1, approved_required: 0, pending_required: 1, rejected_required: 0, expired_required: 0, near_expiry_required: 0, access_allowed: false }],
    review_claims: [] as any[],
    review_activity: [] as any[],
    contractor_evaluations: [], evaluation_action_plans: [], payment_cases: [], support_tickets: [], support_ticket_messages: [],
    assets: [], asset_requirements: [], asset_documents: [], integration_configs: [], notification_preferences: [], notification_reads: [],
    business_sync_control: [{ revision: 42 }],
  } as Record<string, any[]>;
}

async function mount(page: Page, role: Role, stage: Stage) {
  const data = dataFor(role, stage);
  const calls: Call[] = [];
  await page.addInitScript(value => localStorage.setItem('acredita_session', JSON.stringify(value)), session(role));

  await page.route(`${SUPABASE}/**`, async route => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    calls.push({ method: request.method(), path, body: request.postData() });

    if (path === '/auth/v1/user') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: profileId(role), email: session(role).email }) });
    if (path.startsWith('/auth/v1/token')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ access_token: `e2e-${role}`, refresh_token: `e2e-refresh-${role}`, expires_in: 3600, user: { id: profileId(role), email: session(role).email } }) });

    if (path === '/rest/v1/rpc/claim_document_review') {
      const body = JSON.parse(request.postData() || '{}');
      const claim = { document_key: body.p_document_key, document_version_id: body.p_document_version_id, claimed_by: PROFILE_ADMIN, claimed_at: new Date().toISOString(), expires_at: new Date(Date.now() + 900_000).toISOString(), owned: true };
      data.review_claims = [claim];
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(claim) });
    }
    if (path === '/rest/v1/rpc/review_document_version') {
      const body = JSON.parse(request.postData() || '{}');
      const latest = [...data.document_versions].sort((a, b) => b.version_number - a.version_number)[0];
      const status = body.p_action === 'approve' ? 'aprobado' : 'rechazado';
      if (latest) {
        latest.workflow_status = status;
        latest.reviewed_at = new Date().toISOString();
        if (status === 'rechazado') {
          latest.rejection_reason = body.p_reason;
          latest.rejection_explanation = body.p_explanation;
          latest.rejection_solution = body.p_solution;
        }
      }
      data.review_claims = [];
      data.review_activity.push({ id: crypto.randomUUID(), reviewer_id: PROFILE_ADMIN, document_key: 'f30', action: status === 'aprobado' ? 'aprobado' : 'rechazado', created_at: new Date().toISOString() });
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ version_id: latest?.id || V1, status, reviewed_at: new Date().toISOString(), document_key: 'f30' }) });
    }
    if (path.startsWith('/rest/v1/rpc/')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(true) });

    if (path.startsWith('/rest/v1/')) {
      const table = decodeURIComponent(path.slice('/rest/v1/'.length));
      if (request.method() === 'POST' && table === 'documents') {
        const input = JSON.parse(request.postData() || '{}');
        const row = { id: DOC, ...input };
        data.documents = [row];
        return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify([row]) });
      }
      if (request.method() === 'POST' && table === 'document_versions') {
        const input = JSON.parse(request.postData() || '{}');
        const row = { id: data.document_versions.length ? V2 : V1, ...input };
        data.document_versions.push(row);
        return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify([row]) });
      }
      if (!['GET', 'HEAD'].includes(request.method())) return route.fulfill({ status: 204, body: '' });
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data[table] || []) });
    }
    if (path.startsWith('/storage/v1/object/')) return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    return route.fulfill({ status: 404, body: '{}' });
  });

  return { calls, data };
}

async function openMandanteProject(page: Page) {
  await page.goto('/mandante');
  await expect(page.locator('body')).toContainText('El Boliche SpA');
  await page.getByText('Proyectos', { exact: true }).first().click();
  await page.getByText('Operación Gastronómica El Boliche 2026', { exact: true }).first().click();
  await expect(page.getByRole('heading', { name: 'Operación Gastronómica El Boliche 2026' })).toBeVisible();
}

async function openAdminQueue(page: Page) {
  await page.goto('/admin');
  const byTitle = page.getByTitle('Cola de revisión');
  if (await byTitle.count()) await byTitle.first().click();
  else await page.getByRole('button', { name: /Cola de revisión/ }).first().click();
  await expect(page.getByRole('heading', { name: 'Cola de revisión' })).toBeVisible();
  await expect(page.getByText('F30 SII (mes vigente)').first()).toBeVisible();
}

test('El Boliche puede definir requisitos del proyecto para Terrible de Pollo', async ({ page }) => {
  await mount(page, 'mandante', 'pending');
  await openMandanteProject(page);
  await page.getByRole('button', { name: 'Requisitos', exact: true }).click();
  await expect(page.getByText('F30 SII (mes vigente)')).toBeVisible();
  await expect(page.getByText('Contrato de Trabajo')).toBeVisible();
  await expect(page.getByRole('button', { name: /Agregar requisito/ })).toBeVisible();
});

test('Terrible de Pollo carga F30 desde el requisito exacto y queda en revisión', async ({ page }) => {
  const { calls } = await mount(page, 'contratista', 'pending');
  await page.goto('/contratista');
  await page.getByText('Documentos', { exact: true }).first().click();
  await expect(page.getByText('F30 SII (mes vigente)').first()).toBeVisible();

  const chooserPromise = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Subir', exact: true }).first().click();
  const chooser = await chooserPromise;
  await chooser.setFiles({ name: 'F30_Terrible_de_Pollo.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\n% E2E Acredita\n') });

  await expect(page.locator('body')).toContainText('F30_Terrible_de_Pollo.pdf enviado a revisión');
  await expect.poll(() => calls.some(call => call.method === 'POST' && call.path.includes('/storage/v1/object/acredita-documents/'))).toBeTruthy();
  await expect.poll(() => calls.some(call => call.method === 'POST' && call.path === '/rest/v1/document_versions')).toBeTruthy();
});

test('Acredita toma el F30 y lo rechaza indicando corrección', async ({ page }) => {
  const { calls } = await mount(page, 'admin', 'revision');
  await openAdminQueue(page);
  await page.getByRole('button', { name: 'Tomar revisión' }).click();
  await expect(page.getByText(/Tomada por Acredita QA/)).toBeVisible();

  await page.getByRole('combobox').last().selectOption({ label: 'Documento ilegible' });
  await page.getByPlaceholder('Qué debe corregir el contratista...').fill('La segunda página no se puede leer. Vuelve a cargar una copia legible.');
  await page.getByRole('button', { name: 'Rechazar' }).click();

  await expect.poll(() => calls.some(call => call.path === '/rest/v1/rpc/review_document_version' && (call.body || '').includes('reject') && (call.body || '').includes('Documento ilegible'))).toBeTruthy();
});

test('Terrible de Pollo ve el motivo de rechazo y la acción Corregir', async ({ page }) => {
  await mount(page, 'contratista', 'rejected');
  await page.goto('/contratista');
  await page.getByText('Documentos', { exact: true }).first().click();
  await expect(page.getByText('F30 SII (mes vigente)').first()).toBeVisible();
  await page.getByText('F30 SII (mes vigente)').first().click();
  await expect(page.getByText('Documento ilegible').first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Corregir', exact: true }).first()).toBeVisible();
});

test('Acredita aprueba la versión corregida después del chequeo mínimo', async ({ page }) => {
  const { calls } = await mount(page, 'admin', 'corrected');
  await openAdminQueue(page);
  await page.getByRole('button', { name: 'Tomar revisión' }).click();
  await expect(page.getByText(/Tomada por Acredita QA/)).toBeVisible();
  await page.locator('label').filter({ hasText: 'Documento legible' }).locator('input[type="checkbox"]').check();
  await page.locator('label').filter({ hasText: 'Datos coinciden' }).locator('input[type="checkbox"]').check();
  await page.locator('label').filter({ hasText: 'Vigencia correcta' }).locator('input[type="checkbox"]').check();
  await page.getByRole('button', { name: 'Aprobar' }).click();

  await expect.poll(() => calls.some(call => call.path === '/rest/v1/rpc/review_document_version' && (call.body || '').includes('approve'))).toBeTruthy();
});
