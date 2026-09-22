import { expect, test, type Page } from '@playwright/test';

const SUPABASE = 'https://jwlscxbmttpicwljozwf.supabase.co';
const ADMIN = '17000000-0000-4000-8000-000000000001';
const MANDANTE_PROFILE = '17000000-0000-4000-8000-000000000002';
const CONTRACTOR_PROFILE = '17000000-0000-4000-8000-000000000003';
const MANDANTE = '27000000-0000-4000-8000-000000000001';
const PROJECT = '37000000-0000-4000-8000-000000000001';
const CONTRACTOR = '47000000-0000-4000-8000-000000000001';
const ACCREDITATION = '57000000-0000-4000-8000-000000000001';
const REQUIREMENT = '87000000-0000-4000-8000-000000000001';
const DOCUMENT = '97000000-0000-4000-8000-000000000001';
const VERSION = 'a7000000-0000-4000-8000-000000000001';
const PAYMENT = 'b7000000-0000-4000-8000-000000000001';
const PERIOD = 'c7000000-0000-4000-8000-000000000001';
const TICKET = 'd7000000-0000-4000-8000-000000000001';

type Role = 'admin' | 'mandante' | 'contratista';

function session(role: Role) {
  const profileId = role === 'admin' ? ADMIN : role === 'mandante' ? MANDANTE_PROFILE : CONTRACTOR_PROFILE;
  return {
    email: `${role}-integrado@e2e.invalid`,
    role,
    nombre: role === 'admin' ? 'Acredita Integrado QA' : role === 'mandante' ? 'Mandante Integrado QA' : 'Contratista Integrado QA',
    profileId,
    ...(role === 'mandante' ? { mandanteId: 'mandante_integrado', mandanteBackendId: MANDANTE } : {}),
    ...(role === 'contratista' ? { contratistaId: 'contratista_integrado', contratistaBackendId: CONTRACTOR } : {}),
    _supabase: {
      accessToken: `e2e-integrado-${role}`,
      refreshToken: `e2e-refresh-integrado-${role}`,
      expiresAt: Date.now() + 3_600_000,
    },
  };
}

async function setRole(page: Page, role: Role) {
  await page.evaluate(value => localStorage.setItem('acredita_session', JSON.stringify(value)), session(role));
}

test('piloto compartido: aprobación Acredita → pago Mandante → soporte Contratista visible al Mandante', async ({ page }) => {
  const mutations: Array<{ path: string; method: string; body: any }> = [];
  const data: Record<string, any[]> = {
    profiles: [
      { id: ADMIN, full_name: 'Acredita Integrado QA', is_active: true },
      { id: MANDANTE_PROFILE, full_name: 'Representante Mandante Integrado', is_active: true },
      { id: CONTRACTOR_PROFILE, full_name: 'Representante Contratista Integrado', is_active: true },
    ],
    acredita_memberships: [{ profile_id: ADMIN, role: 'admin_acredita', is_active: true }],
    mandante_memberships: [{ profile_id: MANDANTE_PROFILE, mandante_id: MANDANTE, role: 'mandante_admin', is_active: true }],
    contratista_memberships: [{ profile_id: CONTRACTOR_PROFILE, contratista_id: CONTRACTOR, role: 'contratista_admin', is_active: true }],
    mandantes: [{ id: MANDANTE, name: 'Mandante Integrado QA', rut: '76.700.000-0', legal_name: 'Mandante Integrado QA SpA', integration_key: 'mandante_integrado', is_active: true }],
    projects: [{ id: PROJECT, mandante_id: MANDANTE, name: 'Proyecto Integrado QA', code: 'INT-QA', status: 'active', integration_key: 'proyecto_integrado', location: 'Santiago', starts_at: '2026-09-01', ends_at: null }],
    contratistas: [{ id: CONTRACTOR, name: 'Contratista Integrado QA', rut: '77.700.000-1', legal_name: 'Contratista Integrado QA SpA', integration_key: 'contratista_integrado', is_active: true, parent_contratista_id: null }],
    accreditations: [{ id: ACCREDITATION, project_id: PROJECT, contratista_id: CONTRACTOR, is_active: true }],
    requirements: [{
      id: REQUIREMENT, project_id: PROJECT, integration_key: 'f30_1_integrado',
      name: 'Certificado de Cumplimiento de Obligaciones Laborales y Previsionales (F30-1)',
      category: 'Laboral', target: 'empresa', is_required: true, frequency: 'mensual',
      validity_days: 30, alert_days: 7, criticality: 'bloquea_pago', is_active: true,
      sort_order: 1, description: 'Piloto integrado', review_checklist: [],
      applicability: { categories: [] }, blocks_work: false, blocks_assignment: false,
      service_id: null, due_days: 5,
    }],
    workers: [],
    worker_assignments: [],
    documents: [{ id: DOCUMENT, accreditation_id: ACCREDITATION, requirement_id: REQUIREMENT, worker_id: null, obligation_id: null }],
    document_versions: [{
      id: VERSION, document_id: DOCUMENT, version_number: 2, workflow_status: 'revision',
      issued_at: null, expires_at: null, uploaded_at: '2026-09-21T14:00:00Z', reviewed_at: null,
      rejection_reason: null, rejection_explanation: null, rejection_solution: null,
      storage_bucket: 'acredita-documents', storage_path: 'integrado/f30-1-v2.pdf',
      original_filename: 'F30-1_CORREGIDO.pdf', metadata: {},
    }],
    obligation_statuses: [],
    compliance_periods: [{
      id: PERIOD, project_id: PROJECT, period_start: '2026-08-01', period_end: '2026-08-31',
      upload_deadline: '2026-09-06', review_deadline: '2026-09-11', status: 'cerrado',
      closed_at: '2026-09-12T12:00:00Z', reopened_at: null, reopen_reason: null,
    }],
    services: [],
    accreditation_statuses: [{
      accreditation_id: ACCREDITATION, status: 'en_proceso', total_required: 1, approved_required: 0,
      pending_required: 1, rejected_required: 0, expired_required: 0, near_expiry_required: 0,
      access_allowed: true, payment_allowed: false,
    }],
    worker_accreditation_statuses: [],
    review_claims: [],
    review_activity: [],
    contractor_evaluations: [],
    contractor_evaluation_events: [],
    evaluation_action_plans: [],
    evaluation_action_plan_events: [],
    operation_attachments: [],
    payment_cases: [],
    payment_approvals: [],
    payment_case_events: [],
    support_tickets: [],
    support_ticket_messages: [],
    assets: [],
    asset_registry: [],
    asset_requirement_templates: [],
    asset_requirement_statuses: [],
    asset_documents: [],
    asset_inspections: [],
    asset_maintenance: [],
    asset_operator_candidates: [],
    asset_operator_assignments: [],
    integration_configs: [],
    integration_sync_runs: [],
    notification_preferences: [],
    notification_reads: [],
    notifications: [],
    privacy_decision_reviews: [],
    privacy_requests: [],
    privacy_request_events: [],
    security_incidents: [],
    privacy_incidents: [],
    retention_policies: [],
    privacy_retention_rules: [],
    legal_holds: [],
    privacy_processing_activities: [],
    privacy_impact_assessments: [],
    requirement_privacy_assessments: [],
    document_templates: [],
    access_requests: [],
    business_sync_control: [{ revision: 99 }],
  };

  await page.route(`${SUPABASE}/**`, async route => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const auth = request.headers()['authorization'] || '';
    const role: Role = auth.includes('integrado-admin') ? 'admin' : auth.includes('integrado-mandante') ? 'mandante' : 'contratista';
    const profile = role === 'admin' ? ADMIN : role === 'mandante' ? MANDANTE_PROFILE : CONTRACTOR_PROFILE;

    if (path === '/auth/v1/user') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: profile, email: session(role).email }) });
    }
    if (path.startsWith('/auth/v1/token')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        access_token: `e2e-integrado-${role}`, refresh_token: `e2e-refresh-integrado-${role}`,
        expires_in: 3600, user: { id: profile, email: session(role).email },
      }) });
    }

    if (path === '/rest/v1/rpc/claim_document_review') {
      const input = JSON.parse(request.postData() || '{}');
      const claim = {
        document_key: input.p_document_key,
        document_version_id: input.p_document_version_id,
        claimed_by: ADMIN,
        claimed_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 900_000).toISOString(),
        owned: true,
      };
      data.review_claims = [claim];
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(claim) });
    }
    if (path === '/rest/v1/rpc/review_document_version') {
      const input = JSON.parse(request.postData() || '{}');
      mutations.push({ path, method: request.method(), body: input });
      const version = data.document_versions[0];
      version.workflow_status = input.p_action === 'approve' ? 'aprobado' : 'rechazado';
      version.issued_at = input.p_issued_at || null;
      version.expires_at = input.p_expires_at || null;
      version.reviewed_at = new Date().toISOString();
      data.review_claims = [];
      if (input.p_action === 'approve') {
        data.accreditation_statuses[0] = {
          ...data.accreditation_statuses[0], status: 'aprobado', approved_required: 1,
          pending_required: 0, access_allowed: true, payment_allowed: true,
        };
        data.payment_cases = [{
          id: PAYMENT, accreditation_id: ACCREDITATION, compliance_period_id: PERIOD,
          period_start: '2026-08-01', period_end: '2026-08-31', amount: 1800000, currency: 'CLP',
          status: 'liberado', block_reason: null, invoice_number: 'F-INT-01',
          submission_note: 'Piloto integrado', submitted_at: '2026-09-20T12:00:00Z',
          released_at: new Date().toISOString(), paid_at: null, payment_reference: null, payment_note: null,
        }];
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        version_id: VERSION, status: version.workflow_status, reviewed_at: version.reviewed_at,
      }) });
    }
    if (path === '/rest/v1/rpc/get_payment_case_compliance') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        eligible: true, periodStatus: 'cerrado', compliancePercent: 100,
        paymentBlockedCount: 0, paymentPendingCount: 0, eligibleReason: null,
      }) });
    }
    if (path === '/rest/v1/rpc/mark_payment_paid') {
      const input = JSON.parse(request.postData() || '{}');
      mutations.push({ path, method: request.method(), body: input });
      const payment = data.payment_cases.find(row => row.id === PAYMENT);
      if (payment) {
        payment.status = 'pagado';
        payment.payment_reference = input.p_reference;
        payment.payment_note = input.p_note;
        payment.paid_at = new Date().toISOString();
      }
      return route.fulfill({ status: 204, body: '' });
    }
    if (path.startsWith('/rest/v1/rpc/')) {
      if (!['GET', 'HEAD'].includes(request.method())) {
        let body: any = null;
        try { body = request.postDataJSON(); } catch { body = request.postData(); }
        mutations.push({ path, method: request.method(), body });
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(true) });
    }

    if (path.startsWith('/rest/v1/')) {
      const table = decodeURIComponent(path.slice('/rest/v1/'.length));
      if (!['GET', 'HEAD'].includes(request.method())) {
        let body: any = null;
        try { body = request.postDataJSON(); } catch { body = request.postData(); }
        mutations.push({ path, method: request.method(), body });

        if (request.method() === 'POST' && table === 'support_tickets') {
          data.support_tickets.push({
            id: TICKET, ...body, status: 'abierto', resolution: null,
            created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
          });
        }
        return route.fulfill({ status: 204, body: '' });
      }

      let rows = [...(data[table] || [])];
      if (table === 'acredita_memberships' && role !== 'admin') rows = [];
      if (table === 'mandante_memberships' && role !== 'mandante') rows = [];
      if (table === 'contratista_memberships' && role !== 'contratista') rows = [];
      const limit = Number(url.searchParams.get('limit') || 0);
      if (limit) rows = rows.slice(0, limit);
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(rows) });
    }
    if (path.startsWith('/storage/v1/')) return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    return route.fulfill({ status: 404, body: '{}' });
  });

  // Acredita aprueba la versión corregida.
  await page.goto('/');
  await setRole(page, 'admin');
  await page.goto('/admin');
  await page.getByTitle('Cola de revisión').click();
  await expect(page.getByText('Certificado de Cumplimiento de Obligaciones Laborales y Previsionales (F30-1)').first()).toBeVisible();
  await page.getByRole('button', { name: 'Tomar revisión' }).click();
  await page.locator('label').filter({ hasText: 'Documento legible' }).locator('input[type="checkbox"]').check();
  await page.locator('label').filter({ hasText: 'Datos coinciden' }).locator('input[type="checkbox"]').check();
  await page.locator('label').filter({ hasText: 'Vigencia correcta' }).locator('input[type="checkbox"]').check();
  await page.getByLabel('Emisión').fill('2026-09-21');
  await page.getByRole('button', { name: 'Aprobar' }).click();
  await expect.poll(() => data.document_versions[0].workflow_status).toBe('aprobado');
  await expect.poll(() => data.payment_cases.length).toBe(1);

  // El Mandante ve el mismo pago liberado y lo registra como pagado.
  await setRole(page, 'mandante');
  await page.goto('/mandante');
  await page.locator('.sb-item:visible').filter({ hasText: 'Proyectos' }).first().click();
  await page.locator('.mandante-proyectos-card').filter({ hasText: 'Proyecto Integrado QA' }).click();
  await page.getByLabel('Secciones del proyecto').getByRole('button', { name: 'Operacion', exact: true }).click();
  await page.getByRole('button', { name: /Estados de pago/ }).click();
  await expect(page.getByText('F-INT-01')).toBeVisible();
  let dialogIndex = 0;
  page.on('dialog', async dialog => dialog.accept(dialogIndex++ === 0 ? 'TRX-INTEGRADO-001' : 'Pago piloto confirmado'));
  await page.getByRole('button', { name: 'Registrar pago' }).click();
  await expect.poll(() => data.payment_cases[0]?.status).toBe('pagado');
  await expect(data.payment_cases[0]?.payment_reference).toBe('TRX-INTEGRADO-001');

  // Contratista crea un ticket sobre el mismo proyecto.
  await setRole(page, 'contratista');
  await page.goto('/contratista');
  await page.locator('.sb-item:visible').filter({ hasText: 'Operación' }).first().click();
  await page.getByRole('button', { name: /Soporte/ }).click();
  await page.getByLabel('Asunto').fill('Consulta piloto integrado');
  await page.getByLabel('Descripción').fill('Confirmar que el pago y la acreditación quedaron trazados correctamente.');
  await page.getByRole('button', { name: 'Crear ticket' }).click();
  await expect.poll(() => data.support_tickets.length).toBe(1);

  // Mandante ve ese mismo ticket desde Operación.
  await setRole(page, 'mandante');
  await page.goto('/mandante');
  await page.locator('.sb-item:visible').filter({ hasText: 'Proyectos' }).first().click();
  await page.locator('.mandante-proyectos-card').filter({ hasText: 'Proyecto Integrado QA' }).click();
  await page.getByLabel('Secciones del proyecto').getByRole('button', { name: 'Operacion', exact: true }).click();
  await page.getByRole('button', { name: /Soporte/ }).click();
  await expect(page.getByText('Consulta piloto integrado')).toBeVisible();

  expect(mutations.some(item => item.path === '/rest/v1/rpc/review_document_version' && item.body?.p_action === 'approve')).toBeTruthy();
  expect(mutations.some(item => item.path === '/rest/v1/rpc/mark_payment_paid' && item.body?.p_reference === 'TRX-INTEGRADO-001')).toBeTruthy();
  expect(mutations.some(item => item.path === '/rest/v1/support_tickets' && item.method === 'POST')).toBeTruthy();
});
