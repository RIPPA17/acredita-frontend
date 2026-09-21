import { expect, test, type Page } from '@playwright/test';

const SUPABASE = 'https://jwlscxbmttpicwljozwf.supabase.co';
const PROFILE_ADMIN = '16000000-0000-4000-8000-000000000001';
const PROFILE_MANDANTE = '16000000-0000-4000-8000-000000000002';
const MANDANTE = '26000000-0000-4000-8000-000000000001';
const PROJECT = '36000000-0000-4000-8000-000000000001';
const CONTRACTOR = '46000000-0000-4000-8000-000000000001';
const ACCREDITATION = '56000000-0000-4000-8000-000000000001';

type Role = 'admin' | 'mandante';

function appSession(role: Role) {
  return {
    email: role === 'admin' ? 'admin-golive@e2e.invalid' : 'mandante-golive@e2e.invalid',
    role,
    nombre: role === 'admin' ? 'Acredita Go Live QA' : 'Mandante Go Live QA',
    profileId: role === 'admin' ? PROFILE_ADMIN : PROFILE_MANDANTE,
    ...(role === 'mandante' ? { mandanteId: 'mandante_golive_qa', mandanteBackendId: MANDANTE } : {}),
    _supabase: {
      accessToken: `e2e-golive-${role}`,
      refreshToken: `e2e-golive-refresh-${role}`,
      expiresAt: Date.now() + 3_600_000,
    },
  };
}

async function mockRole(page: Page, role: Role) {
  const profile = role === 'admin' ? PROFILE_ADMIN : PROFILE_MANDANTE;
  const fixtures: Record<string, unknown[]> = {
    profiles: [
      { id: PROFILE_ADMIN, full_name: 'Acredita Go Live QA', phone: '+56 9 1111 1111', is_active: true },
      { id: PROFILE_MANDANTE, full_name: 'Representante Mandante QA', phone: '+56 9 2222 2222', is_active: true },
    ],
    acredita_memberships: role === 'admin' ? [{ profile_id: PROFILE_ADMIN, role: 'admin_acredita', is_active: true }] : [],
    mandante_memberships: role === 'mandante' ? [{ profile_id: PROFILE_MANDANTE, mandante_id: MANDANTE, role: 'mandante_admin', is_active: true }] : [],
    contratista_memberships: [],
    mandantes: [{ id: MANDANTE, name: 'Mandante Go Live QA', rut: '76.900.000-0', legal_name: 'Mandante Go Live QA SpA', integration_key: 'mandante_golive_qa', is_active: true }],
    projects: [{ id: PROJECT, mandante_id: MANDANTE, name: 'Proyecto Go Live QA', code: 'GO-QA', description: 'Piloto final', status: 'active', integration_key: 'proyecto_golive_qa', location: 'Santiago', starts_at: '2026-09-01', ends_at: null }],
    contratistas: [{ id: CONTRACTOR, name: 'Contratista Go Live QA', rut: '77.900.000-1', legal_name: 'Contratista Go Live QA SpA', integration_key: 'contratista_golive_qa', is_active: true, parent_contratista_id: null }],
    accreditations: [{ id: ACCREDITATION, project_id: PROJECT, contratista_id: CONTRACTOR, is_active: true }],
    requirements: [],
    workers: [],
    worker_assignments: [],
    documents: [],
    document_versions: [],
    obligation_statuses: [],
    compliance_periods: [],
    accreditation_statuses: [{ accreditation_id: ACCREDITATION, status: 'en_proceso', total_required: 0, approved_required: 0, pending_required: 0, rejected_required: 0, expired_required: 0, near_expiry_required: 0, access_allowed: false, payment_allowed: false }],
    worker_accreditation_statuses: [],
    services: [],
    assets: [],
    asset_requirements: [],
    asset_documents: [],
    asset_document_versions: [],
    asset_inspections: [],
    asset_maintenance: [],
    asset_operator_assignments: [],
    contractor_evaluations: [],
    contractor_evaluation_events: [],
    evaluation_action_plans: [],
    evaluation_action_plan_events: [],
    payment_cases: [],
    payment_approvals: [],
    payment_case_events: [],
    support_tickets: [],
    support_ticket_messages: [],
    operation_attachments: [],
    integration_configs: [],
    integration_sync_runs: [],
    notification_preferences: [],
    notification_reads: [],
    notifications: [],
    review_claims: [],
    review_activity: [],
    document_templates: [],
    access_requests: [],
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
    privacy_decision_reviews: [],
    business_sync_control: [{ revision: 90 }],
  };

  await page.addInitScript(value => {
    window.localStorage.setItem('acredita_session', JSON.stringify(value));
  }, appSession(role));

  await page.route(`${SUPABASE}/**`, async route => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    if (path === '/auth/v1/user') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: profile, email: appSession(role).email }) });
    }
    if (path.startsWith('/auth/v1/token')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ access_token: `e2e-golive-${role}`, refresh_token: `e2e-golive-refresh-${role}`, expires_in: 3600, user: { id: profile, email: appSession(role).email } }) });
    }
    if (path.startsWith('/rest/v1/rpc/')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(true) });
    }
    if (path.startsWith('/rest/v1/')) {
      if (!['GET', 'HEAD'].includes(request.method())) return route.fulfill({ status: 204, body: '' });
      const table = decodeURIComponent(path.slice('/rest/v1/'.length));
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(fixtures[table] || []) });
    }
    if (path.startsWith('/storage/v1/')) return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    return route.fulfill({ status: 404, body: '{}' });
  });
}

test('go-live Mandante: navegación completa y cuenta recuperable', async ({ page }) => {
  await mockRole(page, 'mandante');
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto('/mandante');

  for (const label of ['Inicio', 'Proyectos', 'Contratistas', 'Configuración']) {
    await page.getByText(label, { exact: true }).first().click();
    await expect(page.locator('.sb-item.active').filter({ hasText: label })).toBeVisible();
  }

  await expect(page.getByText('Mi organización', { exact: true })).toBeVisible();
  await expect(page.getByText('mandante-golive@e2e.invalid')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Cambiar contraseña' })).toHaveAttribute('href', '/recuperar?email=mandante-golive%40e2e.invalid');

  await page.getByText('Proyectos', { exact: true }).first().click();
  await page.getByText('Proyecto Go Live QA', { exact: true }).first().click();
  for (const tab of ['Resumen', 'Contratistas', 'Servicios', 'Activos', 'Requisitos', 'Periodos', 'Operacion', 'Acreditaciones']) {
    await page.getByRole('button', { name: tab, exact: true }).click();
    await expect(page.getByRole('button', { name: tab, exact: true })).toHaveClass(/active/);
  }
});

test('go-live Acredita: módulos administrativos y cuenta segura visibles', async ({ page }) => {
  await mockRole(page, 'admin');
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto('/admin');

  for (const label of ['Inicio', 'Cola de revisión', 'Acreditaciones', 'Mandantes', 'Contratistas', 'Proyectos', 'Verificadores', 'Auditoría', 'Configuración']) {
    const item = page.locator('.sb-item').filter({ hasText: label }).first();
    await item.click();
    await expect(item).toHaveClass(/active/);
  }

  await expect(page.getByText('Cuenta administrativa', { exact: true })).toBeVisible();
  await expect(page.getByText('admin-golive@e2e.invalid')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Cambiar contraseña' })).toHaveAttribute('href', '/recuperar?email=admin-golive%40e2e.invalid');

  await page.getByRole('button', { name: 'Privacidad', exact: true }).click();
  await expect(page.getByRole('button', { name: /Revisión humana/ })).toBeVisible();
});
