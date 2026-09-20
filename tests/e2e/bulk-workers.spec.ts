import { expect, test, type Page } from '@playwright/test';

const SUPABASE = 'https://jwlscxbmttpicwljozwf.supabase.co';
const PROFILE = '31000000-0000-4000-8000-000000000001';
const MANDANTE = '32000000-0000-4000-8000-000000000001';
const PROJECT = '33000000-0000-4000-8000-000000000001';
const CONTRACTOR = '34000000-0000-4000-8000-000000000001';
const ACCREDITATION = '35000000-0000-4000-8000-000000000001';
const REQUIREMENT = '36000000-0000-4000-8000-000000000001';

async function mockContractor(page: Page) {
  await page.addInitScript(({ profile, contractor }) => {
    window.localStorage.setItem('acredita_session', JSON.stringify({
      email: 'contratista@e2e.invalid', role: 'contratista', nombre: 'Contratista Carga QA',
      profileId: profile, contratistaId: 'contratista_carga', contratistaBackendId: contractor,
      _supabase: { accessToken: 'e2e-access', refreshToken: 'e2e-refresh', expiresAt: Date.now() + 3_600_000 },
    }));
  }, { profile: PROFILE, contractor: CONTRACTOR });

  await page.route(`${SUPABASE}/**`, async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname === '/auth/v1/user') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: PROFILE, email: 'contratista@e2e.invalid' }) });
    if (url.pathname === '/rest/v1/profiles') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ id: PROFILE, full_name: 'Contratista Carga QA' }]) });
    if (url.pathname === '/rest/v1/contratista_memberships') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ profile_id: PROFILE, contratista_id: CONTRACTOR, role: 'contratista_admin', is_active: true }]) });
    if (url.pathname === '/rest/v1/contratistas') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ id: CONTRACTOR, name: 'Contratista Carga QA', rut: '77.333.333-3', legal_name: 'Contratista Carga QA', integration_key: 'contratista_carga', is_active: true, parent_contratista_id: null }]) });
    if (url.pathname === '/rest/v1/mandantes') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ id: MANDANTE, name: 'Mandante Carga QA', rut: '76.333.333-3', integration_key: 'mandante_carga', is_active: true }]) });
    if (url.pathname === '/rest/v1/projects') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ id: PROJECT, mandante_id: MANDANTE, name: 'Proyecto Carga QA', code: 'CARGA-QA', status: 'active', integration_key: 'proyecto_carga', location: 'Santiago' }]) });
    if (url.pathname === '/rest/v1/accreditations') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ id: ACCREDITATION, project_id: PROJECT, contratista_id: CONTRACTOR, is_active: true }]) });
    if (url.pathname === '/rest/v1/requirements') return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([{
        id: REQUIREMENT,
        project_id: PROJECT,
        integration_key: 'req_odi_carga',
        name: 'Certificado ODI',
        category: 'Seguridad',
        target: 'trabajador',
        is_required: true,
        frequency: 'un_ano',
        validity_days: 365,
        alert_days: 30,
        criticality: 'bloquea_acceso',
        is_active: true,
        sort_order: 1,
        description: 'ODI vigente',
        review_checklist: ['Firma'],
        applicability: { categories: [] },
        blocks_work: true,
        blocks_assignment: true,
        service_id: null,
        due_days: 5,
      }]),
    });
    if (url.pathname === '/rest/v1/business_sync_control') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ revision: 3 }]) });
    if (url.pathname.startsWith('/rest/v1/rpc/')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(true) });
    if (url.pathname.startsWith('/rest/v1/')) {
      if (!['GET', 'HEAD'].includes(request.method())) return route.fulfill({ status: 204, body: '' });
      return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    }
    if (url.pathname.startsWith('/storage/v1/')) return route.fulfill({ status: 200, body: '{}' });
    return route.fulfill({ status: 404, body: '{}' });
  });
}

test('22 Contratista valida una carga CSV antes de importar trabajadores', async ({ page }) => {
  await mockContractor(page);
  await page.goto('/contratista');
  await page.getByText('Configuración', { exact: true }).first().click();
  await page.getByRole('button', { name: 'Carga masiva', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Carga masiva de trabajadores' })).toBeVisible();
  await page.locator('input[type=file][accept*=".csv"]').setInputFiles({
    name: 'trabajadores.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('Nombre;RUT;Cargo;Servicio;Categorias;FechaIngreso;TipoContrato;FechaInicioContrato;FechaTerminoContrato;ObraFaenaContrato;RegimenEspecial;DetalleRegimenEspecial\nJuan Pérez;12.345.678-5;Operador;;General;2026-09-15;indefinido;2026-09-01;;;;\n'),
  });
  await expect(page.getByText('trabajadores.csv')).toBeVisible();
  await expect(page.getByText('Juan Pérez')).toBeVisible();
  await expect(page.getByText('archivo validado')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Importar 1' })).toBeEnabled();
});
