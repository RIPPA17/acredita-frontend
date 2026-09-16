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

function fixtures() {
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
    compliance_periods: [],
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
      status: 'pendiente',
      evidence: null,
      completed_at: null,
    }],
    payment_cases: [{
      id: PAYMENT,
      accreditation_id: ACCREDITATION,
      period_start: '2026-08-01',
      period_end: '2026-08-31',
      amount: 3500000,
      currency: 'CLP',
      status: 'observado',
      block_reason: 'Falta cierre de observación.',
      invoice_number: 'F-OPS-01',
      submitted_at: '2026-09-10T12:00:00Z',
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

async function mockContractor(page: Page) {
  const data = fixtures();
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

test('Contratista consulta evaluación y actualiza solo avance/evidencia', async ({ page }) => {
  const calls = await mockContractor(page);
  await openOperations(page);

  await expect(page.getByText('Evaluación 2026-08-01 — 2026-08-31')).toBeVisible();
  await expect(page.getByText('Riesgo medio')).toBeVisible();
  await page.getByRole('button', { name: 'Planes de acción' }).click();
  await expect(page.getByText('Cerrar hallazgo de seguridad')).toBeVisible();

  const evidence = page.getByPlaceholder('Describe la acción realizada, adjunta una referencia o deja el comentario de cierre…');
  await evidence.fill('Se instaló barrera y se adjunta respaldo fotográfico.');
  await page.getByRole('button', { name: 'Guardar evidencia' }).click();

  await expect.poll(() => calls.some(call => call.method === 'POST' && call.path === '/rest/v1/rpc/update_contractor_action_plan' && (call.body || '').includes('en_progreso'))).toBeTruthy();
  await expect(page.getByRole('button', { name: 'Aprobaciones' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Aprobar' })).toHaveCount(0);
});

test('Contratista ve estado de pago y conversa con soporte sin controles administrativos', async ({ page }) => {
  const calls = await mockContractor(page);
  await openOperations(page);

  await page.getByRole('button', { name: /Estados de pago/ }).click();
  await expect(page.getByText('F-OPS-01')).toBeVisible();
  await expect(page.getByText('Falta cierre de observación.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Marcar pagado' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Liberar' })).toHaveCount(0);

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
});
