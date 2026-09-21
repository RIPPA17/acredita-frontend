import { expect, test, type Page } from '@playwright/test';

const SUPABASE = 'https://jwlscxbmttpicwljozwf.supabase.co';
const PROFILE = '15000000-0000-4000-8000-000000000001';
const MANDANTE = '25000000-0000-4000-8000-000000000001';
const PROJECT = '35000000-0000-4000-8000-000000000001';
const CONTRACTOR = '45000000-0000-4000-8000-000000000001';
const ACCREDITATION = '55000000-0000-4000-8000-000000000001';

function session() {
  return {
    email: 'contratista-config@e2e.invalid',
    role: 'contratista',
    nombre: 'Contratista Config QA',
    profileId: PROFILE,
    contratistaId: 'contratista_config_qa',
    contratistaBackendId: CONTRACTOR,
    _supabase: {
      accessToken: 'e2e-config-access',
      refreshToken: 'e2e-config-refresh',
      expiresAt: Date.now() + 3_600_000,
    },
  };
}

async function mockContractorConfig(page: Page) {
  const calls: Array<{ method: string; path: string; body?: string | null }> = [];
  const fixtures: Record<string, unknown[]> = {
    profiles: [{ id: PROFILE, full_name: 'María Config QA', phone: '+56 9 5555 1111', is_active: true }],
    acredita_memberships: [],
    mandante_memberships: [],
    contratista_memberships: [{ profile_id: PROFILE, contratista_id: CONTRACTOR, role: 'contratista_admin', is_active: true }],
    mandantes: [{ id: MANDANTE, name: 'Mandante Config QA', rut: '76.555.555-5', legal_name: 'Mandante Config QA SpA', integration_key: 'mandante_config_qa', is_active: true }],
    projects: [{ id: PROJECT, mandante_id: MANDANTE, name: 'Proyecto Config QA', code: 'CFG-QA', status: 'active', integration_key: 'proyecto_config_qa', location: 'Santiago', starts_at: '2026-09-01', ends_at: null }],
    contratistas: [{ id: CONTRACTOR, name: 'Contratista Config QA', rut: '77.555.555-6', legal_name: 'Contratista Config QA SpA', integration_key: 'contratista_config_qa', is_active: true, parent_contratista_id: null }],
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
    contractor_evaluations: [],
    evaluation_action_plans: [],
    payment_cases: [],
    support_tickets: [],
    support_ticket_messages: [],
    assets: [],
    asset_requirements: [],
    asset_documents: [],
    integration_configs: [],
    review_claims: [],
    review_activity: [],
    notification_preferences: [{
      profile_id: PROFILE,
      document_rejected: true,
      document_expiring: true,
      document_updates: true,
      accreditation_approved: true,
      worker_status: false,
      payment_status: true,
      support_updates: true,
      email_enabled: false,
      email_critical_only: true,
    }],
    notification_reads: [],
    notifications: [],
    business_sync_control: [{ revision: 80 }],
  };

  await page.addInitScript(value => {
    window.localStorage.setItem('acredita_session', JSON.stringify(value));
  }, session());

  await page.route(`${SUPABASE}/**`, async route => {
    const request = route.request();
    const url = new URL(request.url());
    calls.push({ method: request.method(), path: url.pathname, body: request.postData() });

    if (url.pathname === '/auth/v1/user') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: PROFILE, email: session().email }) });
    }
    if (url.pathname.startsWith('/auth/v1/token')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ access_token: 'e2e-config-access', refresh_token: 'e2e-config-refresh', expires_in: 3600, user: { id: PROFILE, email: session().email } }) });
    }
    if (url.pathname.startsWith('/rest/v1/rpc/')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(true) });
    }
    if (url.pathname.startsWith('/rest/v1/')) {
      const table = decodeURIComponent(url.pathname.slice('/rest/v1/'.length));
      if (!['GET', 'HEAD'].includes(request.method())) {
        return route.fulfill({ status: 204, body: '' });
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(fixtures[table] || []) });
    }
    if (url.pathname.startsWith('/storage/v1/')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    }
    return route.fulfill({ status: 404, body: '{}' });
  });

  return calls;
}

test('Contratista consulta empresa y cuenta verificadas sin editar identidad estructural', async ({ page }) => {
  await mockContractorConfig(page);
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto('/contratista');

  await page.getByText('Configuración', { exact: true }).first().click();
  await expect(page.getByRole('heading', { name: 'Configuración' })).toBeVisible();
  await expect(page.locator('input[value="Contratista Config QA SpA"]')).toBeVisible();
  await expect(page.locator('input[value="77.555.555-6"]')).toBeVisible();
  await expect(page.locator('input[value="Contratista Config QA SpA"]')).toHaveAttribute('readonly', '');
  await expect(page.locator('input[value="77.555.555-6"]')).toHaveAttribute('readonly', '');
  const projectRow = page.locator('.cfg-project-row').filter({ hasText: 'Proyecto Config QA' });
  await expect(projectRow.getByText('Proyecto Config QA', { exact: true })).toBeVisible();
  await expect(projectRow.getByText('Mandante Config QA', { exact: true })).toBeVisible();
  await expect(page.locator('.cfg-account-strip .cfg-status')).toHaveText('Activa');

  await page.getByRole('button', { name: 'Cuenta', exact: true }).click();
  await expect(page.getByText('contratista-config@e2e.invalid')).toBeVisible();
  await expect(page.getByText('María Config QA')).toBeVisible();
  await expect(page.getByText('Administrador de empresa')).toBeVisible();
  await expect(page.getByText('+56 9 5555 1111')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Cambiar contraseña' })).toHaveAttribute('href', '/recuperar?email=contratista-config%40e2e.invalid');
  await expect(page.getByRole('button', { name: 'Cerrar sesión' }).last()).toBeVisible();
});

test('Preferencias de notificación se persisten desde Configuración', async ({ page }) => {
  const calls = await mockContractorConfig(page);
  await page.goto('/contratista');

  await page.getByText('Configuración', { exact: true }).first().click();
  await page.getByRole('button', { name: 'Notificaciones', exact: true }).click();

  const workerSwitch = page.getByRole('switch', { name: 'Cambios en trabajadores' });
  await expect(workerSwitch).toHaveAttribute('aria-checked', 'false');
  await workerSwitch.click();
  await page.getByRole('button', { name: 'Guardar preferencias' }).click();

  await expect.poll(() => calls.some(call =>
    call.method === 'POST'
    && call.path === '/rest/v1/notification_preferences'
    && (call.body || '').includes('"worker_status":true')
  )).toBeTruthy();
  await expect(page.getByText('Preferencias guardadas')).toBeVisible();
});

test('Configuración de contratista es accesible en móvil desde la cuenta', async ({ page }) => {
  await mockContractorConfig(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/contratista');

  await page.getByRole('button', { name: 'Abrir configuración de cuenta' }).click();
  await expect(page.getByRole('heading', { name: 'Configuración' })).toBeVisible();
  await expect(page.locator('input[value="Contratista Config QA SpA"]')).toBeVisible();

  const sizes = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }));
  expect(sizes.content).toBeLessThanOrEqual(sizes.viewport + 1);
});
