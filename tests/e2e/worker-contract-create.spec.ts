import { expect, test, type Page } from '@playwright/test';

const SUPABASE = 'https://jwlscxbmttpicwljozwf.supabase.co';
const PROFILE = '61000000-0000-4000-8000-000000000001';
const MANDANTE = '62000000-0000-4000-8000-000000000001';
const PROJECT = '63000000-0000-4000-8000-000000000001';
const CONTRACTOR = '64000000-0000-4000-8000-000000000001';
const ACCREDITATION = '65000000-0000-4000-8000-000000000001';

async function mockContractor(page: Page) {
  const calls: Array<{ method: string; path: string; body: string | null }> = [];
  const workers: Array<Record<string, any>> = [];
  const assignments: Array<Record<string, any>> = [];
  let workerSeq = 1;
  let assignmentSeq = 1;

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
    if (path === '/rest/v1/workers') {
      if (request.method() === 'GET') {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(workers) });
      }
      if (request.method() === 'POST') {
        const payload = JSON.parse(request.postData() || '[]');
        const rows = Array.isArray(payload) ? payload : [payload];
        for (const row of rows) {
          const existing = workers.find(item => item.contratista_id === row.contratista_id && item.rut === row.rut);
          if (existing) Object.assign(existing, row);
          else workers.push({
            id: `66000000-0000-4000-8000-${String(workerSeq++).padStart(12, '0')}`,
            ...row,
          });
        }
        return route.fulfill({ status: 204, body: '' });
      }
    }
    if (path === '/rest/v1/worker_assignments') {
      if (request.method() === 'GET') {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(assignments) });
      }
      if (request.method() === 'POST') {
        const payload = JSON.parse(request.postData() || '[]');
        const rows = Array.isArray(payload) ? payload : [payload];
        for (const row of rows) {
          assignments.push({
            id: `67000000-0000-4000-8000-${String(assignmentSeq++).padStart(12, '0')}`,
            ...row,
          });
        }
        return route.fulfill({ status: 204, body: '' });
      }
      if (request.method() === 'PATCH') {
        const idFilter = url.searchParams.get('id')?.replace(/^eq\./, '');
        const row = assignments.find(item => item.id === idFilter);
        if (row) Object.assign(row, JSON.parse(request.postData() || '{}'));
        return route.fulfill({ status: 204, body: '' });
      }
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


test('trabajador sin matriz documental queda en proceso y no habilitado', async ({ page }) => {
  await mockContractor(page);

  await page.goto('/contratista');
  await page.getByText('Trabajadores', { exact: true }).first().click();
  await page.getByRole('button', { name: /Agregar trabajador/ }).click();

  await page.getByPlaceholder('Ej. María González').fill('Pedro Sin Matriz QA');
  await page.getByPlaceholder('12.345.678-9').fill('18.390.436-1');
  await page.getByPlaceholder('Ej. Operador').fill('Operador');

  await page.getByRole('button', { name: 'Agregar trabajador', exact: true }).last().click();
  await expect(page.getByText('Trabajador agregado con éxito')).toBeVisible();

  await page.getByRole('button', { name: 'Ver carpeta' }).click();
  await expect(page.getByText('Configuración documental incompleta')).toBeVisible();
  await expect(page.getByText('No habilitado')).toBeVisible();
});

test('permite editar la asignación y retirar al trabajador conservando la baja', async ({ page }) => {
  const calls = await mockContractor(page);

  await page.goto('/contratista');
  await page.getByText('Trabajadores', { exact: true }).first().click();
  await page.getByRole('button', { name: /Agregar trabajador/ }).click();

  await page.getByPlaceholder('Ej. María González').fill('Ana Ciclo QA');
  await page.getByPlaceholder('12.345.678-9').fill('15.763.748-7');
  await page.getByPlaceholder('Ej. Operador').fill('Operadora');
  await page.getByRole('button', { name: 'Agregar trabajador', exact: true }).last().click();
  await expect(page.getByText('Trabajador agregado con éxito')).toBeVisible();

  await page.getByRole('button', { name: 'Ver carpeta' }).click();
  await page.getByRole('button', { name: 'Editar' }).click();
  await page.getByPlaceholder('Ej. Operador').fill('Supervisora');
  await page.getByRole('button', { name: 'Guardar cambios' }).click();
  await expect(page.getByText('Trabajador actualizado con éxito')).toBeVisible();

  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Retirar' }).click();
  await expect(page.getByText('Trabajador retirado del proyecto. Su historial fue conservado.')).toBeVisible();

  await expect.poll(() => calls.some(call => {
    if (call.method !== 'PATCH' || call.path !== '/rest/v1/worker_assignments' || !call.body) return false;
    const parsed = JSON.parse(call.body);
    return parsed.job_title === 'Supervisora';
  })).toBeTruthy();
});

test('reingreso al mismo proyecto crea un nuevo periodo y conserva la baja anterior', async ({ page }) => {
  const calls = await mockContractor(page);

  await page.goto('/contratista');
  await page.getByText('Trabajadores', { exact: true }).first().click();
  await page.getByRole('button', { name: /Agregar trabajador/ }).click();

  await page.getByPlaceholder('Ej. María González').fill('Luis Reingreso QA');
  await page.getByPlaceholder('12.345.678-9').fill('13.654.321-0');
  await page.getByPlaceholder('Ej. Operador').fill('Operador');
  await page.getByRole('button', { name: 'Agregar trabajador', exact: true }).last().click();
  await expect(page.getByText('Trabajador agregado con éxito')).toBeVisible();

  await page.getByRole('button', { name: 'Ver carpeta' }).click();
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Retirar' }).click();
  await expect(page.getByText('Trabajador retirado del proyecto. Su historial fue conservado.')).toBeVisible();

  await page.getByRole('button', { name: /Agregar trabajador/ }).click();
  await page.getByPlaceholder('Ej. María González').fill('Luis Reingreso QA');
  await page.getByPlaceholder('12.345.678-9').fill('13.654.321-0');
  await page.getByPlaceholder('Ej. Operador').fill('Operador senior');
  await page.getByRole('button', { name: 'Agregar trabajador', exact: true }).last().click();
  await expect(page.getByText('Trabajador agregado con éxito')).toBeVisible();

  await expect.poll(() => calls.filter(call => call.method === 'POST' && call.path === '/rest/v1/worker_assignments').length).toBeGreaterThanOrEqual(2);
  await expect.poll(() => calls.some(call => {
    if (call.method !== 'PATCH' || call.path !== '/rest/v1/worker_assignments' || !call.body) return false;
    const parsed = JSON.parse(call.body);
    return parsed.assignment_status === 'baja' && parsed.is_active === false;
  })).toBeTruthy();

  await page.getByRole('button', { name: 'Ver carpeta' }).click();
  await expect(page.getByText('Historial de asignaciones')).toBeVisible();
  await expect(page.getByText(/Baja/).first()).toBeVisible();
});
