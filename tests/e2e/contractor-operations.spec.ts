import { expect, test, type Page } from '@playwright/test';

const SUPABASE = 'https://jwlscxbmttpicwljozwf.supabase.co';
const PROFILE = '11000000-0000-4000-8000-000000000001';
const MANDANTE = '21000000-0000-4000-8000-000000000001';
const PROJECT = '31000000-0000-4000-8000-000000000001';
const CONTRACTOR = '41000000-0000-4000-8000-000000000001';
const ACCREDITATION = '51000000-0000-4000-8000-000000000001';
const EVALUATION = '61000000-0000-4000-8000-000000000001';
const PLAN = '71000000-0000-4000-8000-000000000001';
const PAYMENT = '81000000-0000-4000-8000-000000000001';
const COMPLIANCE_PERIOD = '82000000-0000-4000-8000-000000000001';
const TICKET = '91000000-0000-4000-8000-000000000001';

function session() {
  return {
    email: 'contratista-ops@e2e.invalid',
    role: 'contratista',
    nombre: 'Contratista Operaciones QA',
    profileId: PROFILE,
    contratistaId: 'contratista_ops_qa',
    contratistaBackendId: CONTRACTOR,
    _supabase: {
      accessToken: 'e2e-access',
      refreshToken: 'e2e-refresh',
      expiresAt: Date.now() + 3_600_000,
    },
  };
}

function fixtures(options: {
  planStatus?: 'pendiente' | 'en_progreso' | 'en_revision' | 'completado';
  reviewComment?: string;
  paymentEligible?: boolean;
} = {}) {
  return {
    profiles: [{ id: PROFILE, full_name: 'Contratista Operaciones QA' }],
    acredita_memberships: [],
    mandante_memberships: [],
    contratista_memberships: [{ profile_id: PROFILE, contratista_id: CONTRACTOR, role: 'contratista_admin', is_active: true }],
    mandantes: [{ id: MANDANTE, name: 'Mandante Operaciones QA', rut: '76.000.100-0', legal_name: 'Mandante Operaciones QA SpA', integration_key: 'mandante_ops_qa', is_active: true }],
    projects: [{ id: PROJECT, mandante_id: MANDANTE, name: 'Proyecto Operaciones QA', code: 'OPS-QA', status: 'active', integration_key: 'proyecto_ops_qa', location: 'Santiago', starts_at: '2026-09-01', ends_at: null }],
    contratistas: [{ id: CONTRACTOR, name: 'Contratista Operaciones QA', rut: '77.000.100-1', legal_name: 'Contratista Operaciones QA SpA', integration_key: 'contratista_ops_qa', is_active: true, parent_contratista_id: null }],
    accreditations: [{ id: ACCREDITATION, project_id: PROJECT, contratista_id: CONTRACTOR, is_active: true }],
    requirements: [],
    services: [],
    workers: [],
    worker_assignments: [],
    documents: [],
    document_versions: [],
    obligation_statuses: [],
    compliance_periods: [{
      id: COMPLIANCE_PERIOD,
      project_id: PROJECT,
      period_start: '2026-08-01',
      period_end: '2026-08-31',
      status: 'cerrado',
      snapshot: {
        generated_at: '2026-09-10T11:00:00Z',
        accreditations: [{
          accreditation_id: ACCREDITATION,
          status: options.paymentEligible ? 'aprobado' : 'en_proceso',
          compliance_percent: options.paymentEligible ? 100 : 75,
          payment_allowed: Boolean(options.paymentEligible),
          payment_blocked_count: options.paymentEligible ? 0 : 1,
          payment_pending_count: 0,
          active_worker_count: 1,
        }],
        obligations: [],
      },
      closed_at: '2026-09-10T11:00:00Z',
    }],
    accreditation_statuses: [{ accreditation_id: ACCREDITATION, status: 'en_proceso', total_required: 0, approved_required: 0, pending_required: 0, rejected_required: 0, expired_required: 0, near_expiry_required: 0, access_allowed: false, payment_allowed: false }],
    worker_accreditation_statuses: [],
    contractor_evaluations: [{
      id: EVALUATION,
      accreditation_id: ACCREDITATION,
      period_start: '2026-08-01',
      period_end: '2026-08-31',
      status: 'publicada',
      safety_score: 82,
      quality_score: 88,
      labor_score: 79,
      compliance_score: 84,
      total_score: 83.25,
      risk_level: 'medio',
      observations: 'Corregir hallazgo de seguridad antes del próximo período.',
    }],
    evaluation_action_plans: [{
      id: PLAN,
      evaluation_id: EVALUATION,
      title: 'Cerrar hallazgo de seguridad',
      description: 'Adjuntar evidencia de la medida correctiva.',
      owner_name: 'Jefe de terreno',
      due_date: '2026-09-30',
      status: options.planStatus || 'pendiente',
      evidence: options.planStatus === 'en_revision' || options.planStatus === 'completado' ? 'Evidencia enviada por contratista.' : null,
      review_comment: options.reviewComment || null,
      submitted_at: options.planStatus === 'en_revision' ? '2026-09-20T12:00:00Z' : null,
      reviewed_at: options.planStatus === 'completado' ? '2026-09-20T15:00:00Z' : null,
      completed_at: options.planStatus === 'completado' ? '2026-09-20T15:00:00Z' : null,
    }],
    evaluation_action_plan_events: [{
      id: '72000000-0000-4000-8000-000000000001',
      action_plan_id: PLAN,
      event_type: 'creado',
      from_status: null,
      to_status: 'pendiente',
      comment: null,
      evidence_snapshot: null,
      actor_profile_id: PROFILE,
      created_at: '2026-09-18T12:00:00Z',
    }],
    operation_attachments: [],
    contractor_evaluation_events: [{
      id: '62000000-0000-4000-8000-000000000001',
      evaluation_id: EVALUATION,
      event_type: 'publicada',
      from_status: 'borrador',
      to_status: 'publicada',
      reason: null,
      snapshot: {},
      actor_profile_id: PROFILE,
      created_at: '2026-09-18T11:00:00Z',
    }],
    payment_cases: [{
      id: PAYMENT,
      accreditation_id: ACCREDITATION,
      compliance_period_id: COMPLIANCE_PERIOD,
      period_start: '2026-08-01',
      period_end: '2026-08-31',
      amount: 3500000,
      currency: 'CLP',
      status: 'observado',
      block_reason: options.paymentEligible ? 'Pendiente de decisión final.' : 'Existe documentación que bloquea pago.',
      invoice_number: 'F-OPS-01',
      submitted_at: '2026-09-10T12:00:00Z',
      compliance_snapshot: {
        eligible: Boolean(options.paymentEligible),
        periodStatus: 'cerrado',
        source: 'closed_period_snapshot',
        compliancePercent: options.paymentEligible ? 100 : 75,
        paymentBlockedCount: options.paymentEligible ? 0 : 1,
        paymentPendingCount: 0,
        eligibleReason: options.paymentEligible ? null : 'Existen requisitos obligatorios rechazados o vencidos que bloquean pago.',
      },
      compliance_checked_at: '2026-09-10T12:00:00Z',
    }],
    payment_approvals: [{
      id: '83000000-0000-4000-8000-000000000001',
      payment_case_id: PAYMENT,
      decision: 'observado',
      comment: 'Revisar respaldo documental.',
      decided_by: PROFILE,
      created_at: '2026-09-10T12:05:00Z',
    }],
    payment_case_events: [{
      id: '84000000-0000-4000-8000-000000000001',
      payment_case_id: PAYMENT,
      event_type: 'creado',
      from_status: null,
      to_status: 'observado',
      reason: 'Caso creado para revisión.',
      compliance_snapshot: null,
      actor_profile_id: PROFILE,
      created_at: '2026-09-10T12:00:00Z',
    }],
    support_tickets: [{
      id: TICKET,
      accreditation_id: ACCREDITATION,
      project_id: PROJECT,
      category: 'operacion',
      priority: 'normal',
      status: 'abierto',
      subject: 'Consulta de acreditación',
      description: 'Necesitamos aclarar el criterio de revisión.',
      created_at: '2026-09-15T12:00:00Z',
    }],
    support_ticket_messages: [{ id: 'a1000000-0000-4000-8000-000000000001', ticket_id: TICKET, author_id: PROFILE, body: 'Mensaje inicial de soporte.', is_internal: false, created_at: '2026-09-15T12:05:00Z' }],
    assets: [],
    asset_requirements: [],
    asset_documents: [],
    integration_configs: [],
    business_sync_control: [{ revision: 25 }],
    notification_preferences: [],
    notification_reads: [],
  } as Record<string, unknown[]>;
}

async function mockContractor(page: Page, options: {
  planStatus?: 'pendiente' | 'en_progreso' | 'en_revision' | 'completado';
  reviewComment?: string;
  paymentEligible?: boolean;
} = {}) {
  const data = fixtures(options);
  const calls: Array<{ method: string; path: string; body?: string | null }> = [];

  await page.addInitScript(value => {
    window.localStorage.setItem('acredita_session', JSON.stringify(value));
  }, session());

  await page.route(`${SUPABASE}/**`, async route => {
    const request = route.request();
    const url = new URL(request.url());
    calls.push({ method: request.method(), path: url.pathname, body: request.postData() });

    if (url.pathname === '/auth/v1/user') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: PROFILE, email: 'contratista-ops@e2e.invalid' }) });
    }
    if (url.pathname.startsWith('/auth/v1/token')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ access_token: 'e2e-access', refresh_token: 'e2e-refresh', expires_in: 3600, user: { id: PROFILE, email: 'contratista-ops@e2e.invalid' } }) });
    }
    if (url.pathname === '/rest/v1/rpc/get_payment_case_compliance') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          eligible: Boolean(options.paymentEligible),
          periodStatus: 'cerrado',
          source: 'closed_period_snapshot',
          periodStart: '2026-08-01',
          periodEnd: '2026-08-31',
          generatedAt: '2026-09-10T11:00:00Z',
          accreditationStatus: options.paymentEligible ? 'aprobado' : 'en_proceso',
          compliancePercent: options.paymentEligible ? 100 : 75,
          paymentBlockedCount: options.paymentEligible ? 0 : 1,
          paymentPendingCount: 0,
          eligibleReason: options.paymentEligible ? null : 'Existen requisitos obligatorios rechazados o vencidos que bloquean pago.',
        }),
      });
    }
    if (url.pathname.startsWith('/rest/v1/rpc/')) {
      return route.fulfill({ status: 204, body: '' });
    }
    if (url.pathname.startsWith('/rest/v1/')) {
      const table = decodeURIComponent(url.pathname.slice('/rest/v1/'.length));
      if (request.method() !== 'GET' && request.method() !== 'HEAD') {
        return route.fulfill({ status: 204, body: '' });
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data[table] || []) });
    }
    if (url.pathname.startsWith('/storage/v1/')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    }
    return route.fulfill({ status: 404, body: '{}' });
  });

  return calls;
}

async function openOperations(page: Page) {
  await page.goto('/contratista');
  await expect(page.getByText('Contratista Operaciones QA').first()).toBeVisible();
  await page.getByText('Operación', { exact: true }).first().click();
  await expect(page.getByRole('heading', { name: 'Evaluaciones, pagos y soporte' })).toBeVisible();
}

test('Contratista inicia plan, adjunta evidencia y lo envía a revisión sin autoaprobarlo', async ({ page }) => {
  const calls = await mockContractor(page);
  await openOperations(page);

  await expect(page.getByText('Evaluación 2026-08-01 — 2026-08-31')).toBeVisible();
  await expect(page.getByText('Riesgo medio')).toBeVisible();
  await page.getByRole('button', { name: 'Planes de acción' }).click();
  await expect(page.getByText('Cerrar hallazgo de seguridad')).toBeVisible();

  await page.getByRole('button', { name: 'Iniciar' }).click();
  await expect.poll(() => calls.some(call =>
    call.method === 'POST'
    && call.path === '/rest/v1/rpc/update_contractor_action_plan'
    && (call.body || '').includes('en_progreso')
  )).toBeTruthy();

  const evidence = page.getByPlaceholder('Describe la acción realizada, cambios aplicados o referencia de la evidencia…');
  await evidence.fill('Se instaló barrera y se adjunta respaldo fotográfico.');

  const fileInput = page.locator('input[type="file"]').first();
  await fileInput.setInputFiles({
    name: 'evidencia.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.4 e2e'),
  });
  await expect.poll(() => calls.some(call =>
    call.method === 'POST' && call.path === '/rest/v1/operation_attachments'
  )).toBeTruthy();

  await page.getByRole('button', { name: 'Enviar a revisión' }).click();
  await expect.poll(() => calls.some(call =>
    call.method === 'POST'
    && call.path === '/rest/v1/rpc/update_contractor_action_plan'
    && (call.body || '').includes('en_revision')
  )).toBeTruthy();

  await expect(page.getByRole('button', { name: /Completar/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Aprobar cierre/ })).toHaveCount(0);
});

test('Contratista ve plan en revisión como solo espera de validación', async ({ page }) => {
  await mockContractor(page, { planStatus: 'en_revision' });
  await openOperations(page);
  await page.getByRole('button', { name: 'Planes de acción' }).click();

  await expect(page.getByText('Esperando validación.', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Enviar a revisión' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Iniciar' })).toHaveCount(0);
  await expect(page.getByText('Historial · 1', { exact: true })).toBeVisible();
});

test('Enlace profundo abre directamente el plan de acción indicado', async ({ page }) => {
  await mockContractor(page);
  await page.goto(`/contratista/operacion?proyecto=proyecto_ops_qa&plan=${PLAN}`);

  await expect(page.getByRole('heading', { name: 'Evaluaciones, pagos y soporte' })).toBeVisible();
  await expect(page.locator(`#action-plan-${PLAN}`)).toBeVisible();
  await expect(page.getByText('Cerrar hallazgo de seguridad')).toBeVisible();
});

test('Contratista ve fundamento, decisiones e historial del pago sin controles administrativos', async ({ page }) => {
  const calls = await mockContractor(page, { paymentEligible: false });
  await openOperations(page);

  await page.getByRole('button', { name: /Estados de pago/ }).click();
  await expect(page.getByText('F-OPS-01')).toBeVisible();
  await expect(page.getByText('Existe documentación que bloquea pago.')).toBeVisible();
  await page.getByRole('button', { name: 'Ver detalle' }).click();
  await expect(page.getByText('Cumplimiento no habilita pago')).toBeVisible();
  await expect(page.getByText(/Revisar respaldo documental/)).toBeVisible();
  await expect(page.getByText(/Caso creado para revisión/)).toBeVisible();
  await expect(page.getByRole('button', { name: /Aprobar y liberar/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Anular caso/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Cerrar período documental/ })).toHaveCount(0);

  await page.getByRole('button', { name: /Soporte/ }).click();
  await expect(page.getByText('Consulta de acreditación')).toBeVisible();
  await page.getByRole('button', { name: 'Conversación' }).click();
  await expect(page.getByText('Mensaje inicial de soporte.')).toBeVisible();

  await page.getByPlaceholder('Escribe una respuesta para Mandante/Acredita…').fill('Gracias. Adjuntaremos el antecedente solicitado.');
  await page.getByRole('button', { name: 'Enviar' }).click();
  await expect.poll(() => calls.some(call => call.method === 'POST' && call.path === '/rest/v1/support_ticket_messages')).toBeTruthy();

  await page.getByLabel('Asunto').fill('Nueva consulta operacional');
  await page.getByLabel('Descripción').fill('Necesitamos confirmar el plazo de revisión.');
  await page.getByRole('button', { name: 'Crear ticket' }).click();
  await expect.poll(() => calls.some(call => call.method === 'POST' && call.path === '/rest/v1/support_tickets')).toBeTruthy();
});test('Enlace profundo abre el pago exacto y su trazabilidad', async ({ page }) => {
  await mockContractor(page, { paymentEligible: true });
  await page.goto(`/contratista/operacion?proyecto=proyecto_ops_qa&pago=${PAYMENT}`);

  await expect(page.getByRole('heading', { name: 'Evaluaciones, pagos y soporte' })).toBeVisible();
  await expect(page.locator(`#payment-${PAYMENT}`)).toBeVisible();
  await expect(page.getByText('Cumplimiento habilita pago')).toBeVisible();
  await expect(page.getByText(/Revisar respaldo documental/)).toBeVisible();
});


