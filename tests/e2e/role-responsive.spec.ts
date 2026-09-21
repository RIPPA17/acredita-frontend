import { expect, test, type Page } from '@playwright/test';

const SUPABASE = 'https://jwlscxbmttpicwljozwf.supabase.co';
const PROFILE = '14000000-0000-4000-8000-000000000001';
const MANDANTE = '24000000-0000-4000-8000-000000000001';
const PROJECT = '34000000-0000-4000-8000-000000000001';
const CONTRACTOR = '44000000-0000-4000-8000-000000000001';
const ACCREDITATION = '54000000-0000-4000-8000-000000000001';

type Role = 'admin' | 'mandante' | 'contratista';

function session(role: Role) {
  return {
    email: `${role}@e2e.invalid`,
    role,
    nombre: role === 'admin' ? 'Acredita QA' : role === 'mandante' ? 'Mandante Piloto' : 'Contratista Piloto A',
    profileId: PROFILE,
    ...(role === 'mandante' ? { mandanteId: 'mandante_piloto', mandanteBackendId: MANDANTE } : {}),
    ...(role === 'contratista' ? { contratistaId: 'contratista_piloto_a', contratistaBackendId: CONTRACTOR } : {}),
    _supabase: { accessToken: `e2e-${role}`, refreshToken: `e2e-refresh-${role}`, expiresAt: Date.now() + 3_600_000 },
  };
}

async function mountRole(page: Page, role: Role) {
  const fixtures: Record<string, unknown[]> = {
    profiles: [{ id: PROFILE, full_name: session(role).nombre, is_active: true }],
    acredita_memberships: role === 'admin' ? [{ profile_id: PROFILE, role: 'admin_acredita', is_active: true }] : [],
    mandante_memberships: role === 'mandante' ? [{ profile_id: PROFILE, mandante_id: MANDANTE, role: 'mandante_admin', is_active: true }] : [],
    contratista_memberships: role === 'contratista' ? [{ profile_id: PROFILE, contratista_id: CONTRACTOR, role: 'contratista_admin', is_active: true }] : [],
    mandantes: [{ id: MANDANTE, name: 'Mandante Piloto', rut: '76.000.000-0', legal_name: 'Mandante Piloto SpA', integration_key: 'mandante_piloto', is_active: true }],
    projects: [{ id: PROJECT, mandante_id: MANDANTE, name: 'Proyecto Piloto QA', code: 'PILOTO-QA', status: 'active', integration_key: 'proyecto_piloto', location: 'Santiago', starts_at: '2026-09-01', ends_at: null }],
    contratistas: [{ id: CONTRACTOR, name: 'Contratista Piloto A', rut: '77.000.000-1', legal_name: 'Contratista Piloto A SpA', integration_key: 'contratista_piloto_a', is_active: true, parent_contratista_id: null }],
    accreditations: [{ id: ACCREDITATION, project_id: PROJECT, contratista_id: CONTRACTOR, is_active: true }],
    requirements: [], workers: [], worker_assignments: [], documents: [], document_versions: [], obligation_statuses: [], compliance_periods: [],
    services: [], assets: [], asset_requirements: [], asset_documents: [], contractor_evaluations: [], evaluation_action_plans: [], payment_cases: [],
    support_tickets: [], support_ticket_messages: [], integration_configs: [], notification_preferences: [], notification_reads: [], review_claims: [], review_activity: [],
    business_sync_control: [{ revision: 70 }],
  };

  await page.addInitScript(value => window.localStorage.setItem('acredita_session', JSON.stringify(value)), session(role));
  await page.route(`${SUPABASE}/**`, async route => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    if (path === '/auth/v1/user') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: PROFILE, email: `${role}@e2e.invalid` }) });
    }
    if (path.startsWith('/auth/v1/token')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ access_token: `e2e-${role}`, refresh_token: `e2e-refresh-${role}`, expires_in: 3600, user: { id: PROFILE, email: `${role}@e2e.invalid` } }) });
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

async function expectNoPageOverflow(page: Page) {
  const sizes = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, content: document.documentElement.scrollWidth }));
  expect(sizes.content, `ancho de contenido ${sizes.content}px supera viewport ${sizes.viewport}px`).toBeLessThanOrEqual(sizes.viewport + 1);
}

for (const role of ['admin', 'mandante', 'contratista'] as const) {
  const path = role === 'admin' ? '/admin' : role === 'mandante' ? '/mandante' : '/contratista';
  const expected = role === 'admin' ? 'Acredita' : role === 'mandante' ? 'Mandante Piloto' : 'Contratista Piloto A';

  test(`${role}: portal usable en escritorio`, async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await mountRole(page, role);
    await page.goto(path);
    await expect(page.locator('body')).toContainText(expected);
    await expectNoPageOverflow(page);
  });

  test(`${role}: portal usable en móvil`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await mountRole(page, role);
    await page.goto(path);
    await expect(page.locator('body')).toContainText(expected);
    await expectNoPageOverflow(page);
  });
}


test('Mandante recorre todos sus módulos principales', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await mountRole(page, 'mandante');
  await page.goto('/mandante');

  for (const [menu, expected] of [
    ['Inicio', 'Control ejecutivo'],
    ['Proyectos', 'Vista general de tus proyectos'],
    ['Contratistas', 'Compara rápidamente cómo se encuentra cada empresa'],
    ['Configuración', 'Mi organización'],
  ] as const) {
    await page.getByText(menu, { exact: true }).first().click();
    await expect(page.locator('body')).toContainText(expected);
    await expectNoPageOverflow(page);
  }
});

test('Acredita Admin recorre todos sus módulos principales', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await mountRole(page, 'admin');
  await page.goto('/admin');

  for (const [menu, expected] of [
    ['Inicio', 'Panel de control'],
    ['Cola de revisión', 'Cola de revisión'],
    ['Acreditaciones', 'Acreditaciones'],
    ['Mandantes', 'Mandantes'],
    ['Contratistas', 'Contratistas'],
    ['Proyectos', 'Proyectos'],
    ['Verificadores', 'Verificadores'],
    ['Auditoría', 'Auditoría'],
    ['Configuración', 'Configuración'],
  ] as const) {
    await page.getByText(menu, { exact: true }).first().click();
    await expect(page.locator('body')).toContainText(expected);
    await expectNoPageOverflow(page);
  }
});
