import { expect, test, type Page } from '@playwright/test';

const SUPABASE = 'https://jwlscxbmttpicwljozwf.supabase.co';
const CONTRACTOR_PROFILE = '15000000-0000-4000-8000-000000000001';
const ADMIN_PROFILE = '15000000-0000-4000-8000-000000000002';
const MANDANTE = '25000000-0000-4000-8000-000000000001';
const PROJECT = '35000000-0000-4000-8000-000000000001';
const CONTRACTOR = '45000000-0000-4000-8000-000000000001';
const ACCREDITATION = '55000000-0000-4000-8000-000000000001';
const REQUIREMENT = '85000000-0000-4000-8000-000000000001';
const DOCUMENT = '95000000-0000-4000-8000-000000000001';
const VERSION = 'a5000000-0000-4000-8000-000000000001';
const REVIEW = 'b5000000-0000-4000-8000-000000000001';

function contractorSession() {
  return {
    email: 'contratista-review@e2e.invalid',
    role: 'contratista',
    nombre: 'Contratista Revisión QA',
    profileId: CONTRACTOR_PROFILE,
    contratistaId: 'contratista_review_qa',
    contratistaBackendId: CONTRACTOR,
    _supabase: {
      accessToken: 'e2e-contractor-review',
      refreshToken: 'e2e-refresh-contractor-review',
      expiresAt: Date.now() + 3_600_000,
    },
  };
}

function adminSession() {
  return {
    email: 'admin-review@e2e.invalid',
    role: 'admin',
    nombre: 'Admin Revisión QA',
    profileId: ADMIN_PROFILE,
    _supabase: {
      accessToken: 'e2e-admin-review',
      refreshToken: 'e2e-refresh-admin-review',
      expiresAt: Date.now() + 3_600_000,
    },
  };
}

async function installSharedBackend(page: Page) {
  const calls: Array<{ method: string; path: string; body: string | null }> = [];
  const data: Record<string, any[]> = {
    profiles: [
      { id: CONTRACTOR_PROFILE, full_name: 'Contratista Revisión QA', is_active: true },
      { id: ADMIN_PROFILE, full_name: 'Admin Revisión QA', is_active: true },
    ],
    acredita_memberships: [{ profile_id: ADMIN_PROFILE, role: 'admin_acredita', is_active: true }],
    mandante_memberships: [],
    contratista_memberships: [{ profile_id: CONTRACTOR_PROFILE, contratista_id: CONTRACTOR, role: 'contratista_admin', is_active: true }],
    mandantes: [{ id: MANDANTE, name: 'Mandante Revisión QA', rut: '76.500.000-0', legal_name: 'Mandante Revisión QA SpA', integration_key: 'mandante_review_qa', is_active: true }],
    projects: [{
      id: PROJECT,
      mandante_id: MANDANTE,
      name: 'Proyecto Revisión Humana QA',
      code: 'REV-QA',
      status: 'active',
      integration_key: 'proyecto_review_qa',
      location: 'Santiago',
      starts_at: '2026-09-01',
      ends_at: null,
      data_environment: 'demo',
    }],
    contratistas: [{ id: CONTRACTOR, name: 'Contratista Revisión QA', rut: '77.500.000-1', legal_name: 'Contratista Revisión QA SpA', integration_key: 'contratista_review_qa', is_active: true, parent_contratista_id: null }],
    accreditations: [{ id: ACCREDITATION, project_id: PROJECT, contratista_id: CONTRACTOR, is_active: true }],
    requirements: [{
      id: REQUIREMENT,
      project_id: PROJECT,
      integration_key: 'f30_1_review_qa',
      name: 'Certificado de Cumplimiento de Obligaciones Laborales y Previsionales (F30-1)',
      category: 'Laboral',
      target: 'empresa',
      is_required: true,
      frequency: 'mensual',
      validity_days: 30,
      alert_days: 7,
      criticality: 'bloquea_pago',
      is_active: true,
      sort_order: 1,
      description: 'Certificado de cumplimiento laboral y previsional.',
      review_checklist: [],
      applicability: { categories: [] },
      blocks_work: false,
      blocks_assignment: false,
      service_id: null,
      due_days: 5,
    }],
    workers: [],
    worker_assignments: [],
    documents: [{ id: DOCUMENT, accreditation_id: ACCREDITATION, requirement_id: REQUIREMENT, worker_id: null, obligation_id: null }],
    document_versions: [{
      id: VERSION,
      document_id: DOCUMENT,
      version_number: 1,
      workflow_status: 'rechazado',
      expires_at: null,
      uploaded_at: '2026-09-18T12:00:00Z',
      reviewed_at: '2026-09-18T13:00:00Z',
      rejection_reason: 'Documento ilegible',
      rejection_explanation: 'No se distingue el período certificado.',
      rejection_solution: 'Sube una copia legible.',
      storage_bucket: 'acredita-documents',
      storage_path: `${DOCUMENT}/v1/f30-1.pdf`,
      original_filename: 'F30-1_RECHAZADO.pdf',
      metadata: {},
    }],
    obligation_statuses: [],
    compliance_periods: [],
    services: [],
    accreditation_statuses: [{
      accreditation_id: ACCREDITATION,
      project_id: PROJECT,
      contratista_id: CONTRACTOR,
      status: 'vencido_bloqueado',
      compliance_percent: 0,
      total_required: 1,
      approved_required: 0,
      pending_required: 0,
      rejected_required: 1,
      expired_required: 0,
      near_expiry_required: 0,
      near_expiry_count: 0,
      access_allowed: true,
      payment_allowed: false,
      access_blocked_count: 0,
      access_pending_count: 0,
      payment_blocked_count: 1,
      payment_pending_count: 0,
    }],
    worker_accreditation_statuses: [],
    privacy_decision_reviews: [{
      id: REVIEW,
      accreditation_id: ACCREDITATION,
      worker_id: null,
      decision_type: 'payment',
      automated_state_snapshot: 'bloqueado',
      request_reason: 'La empresa aportó un antecedente adicional que requiere evaluación humana antes de mantener el bloqueo.',
      requester_viewpoint: 'Solicitamos revisar el período y la legibilidad del certificado antes de confirmar la retención.',
      explanation_snapshot: { project: 'Proyecto Revisión Humana QA', contractor: 'Contratista Revisión QA' },
      status: 'requested',
      override_value: null,
      override_reason: null,
      override_until: null,
      requested_by: CONTRACTOR_PROFILE,
      reviewed_by: null,
      requested_at: '2026-09-18T20:00:00Z',
      reviewed_at: null,
      created_at: '2026-09-18T20:00:00Z',
      updated_at: '2026-09-18T20:00:00Z',
    }],
    privacy_requests: [],
    security_incidents: [],
    retention_policies: [],
    legal_holds: [],
    privacy_processing_activities: [],
    privacy_impact_assessments: [],
    requirement_privacy_assessments: [],
    contractor_evaluations: [],
    evaluation_action_plans: [],
    payment_cases: [],
    support_tickets: [],
    support_ticket_messages: [],
    assets: [],
    asset_requirements: [],
    asset_documents: [],
    integration_configs: [],
    notification_preferences: [],
    notification_reads: [],
    review_claims: [],
    review_activity: [],
    document_templates: [],
    business_sync_control: [{ revision: 88 }],
  };

  await page.route(`${SUPABASE}/**`, async route => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    calls.push({ method: request.method(), path, body: request.postData() });
    const authorization = request.headers()['authorization'] || '';
    const isAdmin = authorization.includes('e2e-admin-review');
    const activeProfile = isAdmin ? ADMIN_PROFILE : CONTRACTOR_PROFILE;
    const activeEmail = isAdmin ? 'admin-review@e2e.invalid' : 'contratista-review@e2e.invalid';

    if (path === '/auth/v1/user') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: activeProfile, email: activeEmail }) });
    }
    if (path.startsWith('/auth/v1/token')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          access_token: isAdmin ? 'e2e-admin-review' : 'e2e-contractor-review',
          refresh_token: isAdmin ? 'e2e-refresh-admin-review' : 'e2e-refresh-contractor-review',
          expires_in: 3600,
          user: { id: activeProfile, email: activeEmail },
        }),
      });
    }
    if (path.startsWith('/rest/v1/rpc/')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(true) });
    }
    if (path.startsWith('/rest/v1/')) {
      const table = decodeURIComponent(path.slice('/rest/v1/'.length));

      if (table === 'privacy_decision_reviews' && request.method() === 'POST') {
        const input = JSON.parse(request.postData() || '{}');
        const row = {
          id: REVIEW,
          ...input,
          status: 'requested',
          override_value: null,
          override_reason: null,
          override_until: null,
          reviewed_by: null,
          requested_at: '2026-09-18T20:00:00Z',
          reviewed_at: null,
          created_at: '2026-09-18T20:00:00Z',
          updated_at: '2026-09-18T20:00:00Z',
        };
        data.privacy_decision_reviews = [row];
        return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify([row]) });
      }

      if (table === 'privacy_decision_reviews' && request.method() === 'PATCH') {
        const patch = JSON.parse(request.postData() || '{}');
        data.privacy_decision_reviews = data.privacy_decision_reviews.map(row =>
          row.id === REVIEW ? { ...row, ...patch, updated_at: '2026-09-18T20:05:00Z' } : row
        );
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(data.privacy_decision_reviews.filter(row => row.id === REVIEW)),
        });
      }

      if (!['GET', 'HEAD'].includes(request.method())) {
        return route.fulfill({ status: 204, body: '' });
      }

      let rows = [...(data[table] || [])];
      const limit = Number(url.searchParams.get('limit') || 0);
      if (limit > 0) rows = rows.slice(0, limit);
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(rows) });
    }
    if (path.startsWith('/storage/v1/')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    }
    return route.fulfill({ status: 404, body: '{}' });
  });

  return { calls, data };
}

async function setSession(page: Page, value: ReturnType<typeof contractorSession> | ReturnType<typeof adminSession>) {
  await page.evaluate(session => {
    window.localStorage.setItem('acredita_session', JSON.stringify(session));
  }, value);
}

test('revisión humana: solicitud → override temporal → documento sigue rechazado', async ({ page }) => {
  const { data } = await installSharedBackend(page);
  await page.addInitScript(value => {
    window.localStorage.setItem('acredita_session', JSON.stringify(value));
  }, contractorSession());

  await setSession(page, adminSession());
  await page.goto('/admin');
  await page.getByRole('button', { name: 'Configuración', exact: true }).first().click();
  await page.getByRole('button', { name: 'Privacidad', exact: true }).click();
  await page.getByRole('button', { name: /Revisión humana/ }).click();

  await expect(page.getByText('Estado automático:', { exact: false })).toBeVisible();
  await page.getByPlaceholder(/Fundamento de la revisión humana/).fill('Se revisó el antecedente adicional y se autoriza excepcionalmente el pago por 24 horas mientras se reemplaza el certificado.');
  await page.getByRole('button', { name: 'Autorizar excepción temporal', exact: true }).click();
  await expect(page.locator('body')).toContainText('Excepción humana registrada con vigencia temporal');

  const review = data.privacy_decision_reviews[0];
  expect(review.status).toBe('overridden');
  expect(review.override_value).toBe('habilitado');
  expect(review.override_reason).toContain('autoriza excepcionalmente');
  expect(review.reviewed_by).toBe(ADMIN_PROFILE);
  expect(review.override_until).toBeTruthy();

  await setSession(page, contractorSession());
  await page.goto('/contratista/documentos?proyecto=proyecto_review_qa');
  await expect(page.getByText('Certificado de Cumplimiento de Obligaciones Laborales y Previsionales (F30-1)').first()).toBeVisible();
  await expect(page.getByText('Rechazado', { exact: true }).first()).toBeVisible();
  expect(data.document_versions[0].workflow_status).toBe('rechazado');
  expect(data.document_versions[0].rejection_reason).toBe('Documento ilegible');
});
