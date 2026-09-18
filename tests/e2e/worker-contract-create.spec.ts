import { expect, test, type Page } from '@playwright/test';

const SUPABASE = 'https://jwlscxbmttpicwljozwf.supabase.co';
const PROFILE = '61000000-0000-4000-8000-000000000001';
const MANDANTE = '62000000-0000-4000-8000-000000000001';
const PROJECT = '63000000-0000-4000-8000-000000000001';
const CONTRACTOR = '64000000-0000-4000-8000-000000000001';
const ACCREDITATION = '65000000-0000-4000-8000-000000000001';

async function mockContractor(page: Page) {
  const calls: Array<{ method: string; path: string; body: string | null }> = [];

  await page.addInitScript(({ profile, contractor }) => {
    window.localStorage.setItem('acredita_session', JSON.stringify({
      email: 'contratista-contratos@e2e.invalid',
      role: 'contratista',
      nombre: 'Contratista Contratos QA',
      profileId: profile,
      contratistaId: 'contratista_contratos',
      contratistaBackendId: contractor,
      _supabase: {
        accessToken: 'e2e-worker-contracts',
        refreshToken: 'e2e-worker-contracts-refresh',
        expiresAt: Date.now() + 3_600_000,
      },
    }));
  }, { profile: PROFILE, contractor: CONTRACTOR });

  await page.route(`${SUPABASE}/**`, async route => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    calls.push({ method: request.method(), path, body: request.postData() });

    if (path === '/auth/v1/user') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: PROFILE, email: 'contratista-contratos@e2e.invalid' }) });
    }
    if (path.startsWith('/auth/v1/token')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          access_token: 'e2e-worker-contracts',
          refresh_token: 'e2e-worker-contracts-refresh',
          expires_in: 3600,
          user: { id: PROFILE, email: 'contratista-contratos@e2e.invalid' },
        }),
      });
    }
    if (path === '/rest/v1/profiles') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ id: PROFILE, full_name: 'Contratista Contratos QA', is_active: true }]) });
    }
    if (path === '/rest/v1/contratista_memberships') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ profile_id: PROFILE, contratista_id: CONTRACTOR, role: 'contratista_admin', is_active: true }]) });
    }
    if (path === '/rest/v1/contratistas') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ id: CONTRACTOR, name: 'Contratista Contratos QA', rut: '77.600.000-1', legal_name: 'Contratista Contratos QA SpA', integration_key: 'contratista_contratos', is_active: true, parent_contratista_id: null }]) });
    }
    if (path === '/rest/v1/mandantes') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ id: MANDANTE, name: 'Mandante Contratos QA', rut: '76.600.000-0', integration_key: 'mandante_contratos', is_active: true }]) });
    }
    if (path === '/rest/v1/projects') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ id: PROJECT, mandante_id: MANDANTE, name: 'Proyecto Contratos QA', code: 'CONTR-QA', status: 'active', integration_key: 'proyecto_contratos', location: 'Santiago', starts_at: '2026-09-01', ends_at: null }]) });
    }
    if (path === '/rest/v1/accreditations') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ id: ACCREDITATION, project_id: PROJECT, contratista_id: CONTRACTOR, is_active: true }]) });
    }
    if (path === '/rest/v1/business_sync_control') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ revision: 4 }]) });
    }
    if (path.startsWith('/rest/v1/rpc/')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(true) });
    }
    if (path.startsWith('/rest/v1/')) {
      if (!['GET', 'HEAD'].includes(request.method())) {
        return route.fulfill({ status: 204, body: '' });
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    }
    if (path.startsWith('/storage/v1/')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    }
    return route.fulfill({ status: 404, body: '{}' });
  });

  return calls;
}

test('alta de trabajador guarda contrato a plazo fijo y régimen especial', async ({ page }) => {
  const calls = await mockContractor(page);

  await page.goto('/contratista');
  await page.getByText('Trabajadores', { exact: true }).first().click();
  await page.getByRole('button', { name: /Agregar trabajador/ }).click();

  await page.getByPlaceholder('Ej. María González').fill('Juan Contrato QA');
  await page.getByPlaceholder('12.345.678-9').fill('12.345.678-5');
  await page.getByPlaceholder('Ej. Operador').fill('Operador');
  await page.getByLabel('Tipo de contrato').selectOption('plazo_fijo');
  await page.getByLabel('Fecha de inicio del contrato').fill('2026-09-01');
  await page.getByLabel('Fecha de término del contrato').fill('2027-03-31');
  await page.getByLabel('Régimen laboral especial').selectOption('servicios_transitorios');

  await page.getByRole('button', { name: 'Agregar trabajador', exact: true }).last().click();
  await expect(page.getByText('Trabajador agregado con éxito')).toBeVisible();

  await expect.poll(() => calls.some(call => {
    if (call.method !== 'POST' || call.path !== '/rest/v1/workers' || !call.body) return false;
    const parsed = JSON.parse(call.body);
    const rows = Array.isArray(parsed) ? parsed : [parsed];
    return rows.some(row =>
      row.rut === '12.345.678-5'
      && row.contract_type === 'plazo_fijo'
      && row.contract_start_date === '2026-09-01'
      && row.contract_end_date === '2027-03-31'
      && row.special_labor_regime === 'servicios_transitorios'
    );
  })).toBeTruthy();
});

test('alta por obra o faena exige y guarda la obra específica', async ({ page }) => {
  const calls = await mockContractor(page);

  await page.goto('/contratista');
  await page.getByText('Trabajadores', { exact: true }).first().click();
  await page.getByRole('button', { name: /Agregar trabajador/ }).click();

  await page.getByPlaceholder('Ej. María González').fill('María Faena QA');
  await page.getByPlaceholder('12.345.678-9').fill('21.406.583-5');
  await page.getByPlaceholder('Ej. Operador').fill('Montajista');
  await page.getByLabel('Tipo de contrato').selectOption('obra_faena');
  await page.getByLabel('Fecha de inicio del contrato').fill('2026-09-18');
  await expect(page.getByLabel('Obra o faena determinada')).toBeVisible();
  await page.getByLabel('Obra o faena determinada').fill('Montaje de estructura metálica sector norte');

  await page.getByRole('button', { name: 'Agregar trabajador', exact: true }).last().click();
  await expect(page.getByText('Trabajador agregado con éxito')).toBeVisible();

  await expect.poll(() => calls.some(call => {
    if (call.method !== 'POST' || call.path !== '/rest/v1/workers' || !call.body) return false;
    const parsed = JSON.parse(call.body);
    const rows = Array.isArray(parsed) ? parsed : [parsed];
    return rows.some(row =>
      row.rut === '21.406.583-5'
      && row.contract_type === 'obra_faena'
      && row.contract_work_or_task === 'Montaje de estructura metálica sector norte'
      && row.contract_end_date === null
    );
  })).toBeTruthy();
});
