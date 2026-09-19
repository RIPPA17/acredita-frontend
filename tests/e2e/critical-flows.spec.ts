import { expect, test, type Page } from '@playwright/test';

const SUPABASE = 'https://jwlscxbmttpicwljozwf.supabase.co';
const PROFILE = '10000000-0000-4000-8000-000000000001';
const MANDANTE = '20000000-0000-4000-8000-000000000001';
const PROJECT = '30000000-0000-4000-8000-000000000001';
const PROJECT_OLD = '30000000-0000-4000-8000-000000000002';
const CONTRACTOR = '40000000-0000-4000-8000-000000000001';
const ACCREDITATION = '50000000-0000-4000-8000-000000000001';
const ACCREDITATION_OLD = '50000000-0000-4000-8000-000000000002';
const SERVICE = '60000000-0000-4000-8000-000000000001';
const WORKER = '70000000-0000-4000-8000-000000000001';
const ASSIGNMENT = '80000000-0000-4000-8000-000000000001';
const REQ_COMPANY = '90000000-0000-4000-8000-000000000001';
const REQ_WORKER = '90000000-0000-4000-8000-000000000002';
const REQ_COMPANY_OLD = '90000000-0000-4000-8000-000000000003';
const PAYMENT = 'a0000000-0000-4000-8000-000000000001';

type Role = 'admin' | 'mandante' | 'contratista';
type MockOptions = { paymentStatus?: 'observado' | 'retenido' | 'liberado' | 'pagado'; emptyProject?: boolean; historicalProject?: boolean };

function appSession(role: Role) {
  return {
    email: `${role}@e2e.invalid`,
    role,
    nombre: role === 'mandante' ? 'Mandante Piloto' : role === 'contratista' ? 'Contratista Piloto A' : 'Acredita QA',
    profileId: PROFILE,
    ...(role === 'mandante' ? { mandanteId: 'mandante_piloto', mandanteBackendId: MANDANTE } : {}),
    ...(role === 'contratista' ? { contratistaId: 'contratista_piloto_a', contratistaBackendId: CONTRACTOR } : {}),
    _supabase: { accessToken: 'e2e-access', refreshToken: 'e2e-refresh', expiresAt: Date.now() + 3_600_000 },
  };
}

function fixtures(role: Role, options: MockOptions) {
  const paymentStatus = options.paymentStatus || 'observado';
  return {
    profiles: [{ id: PROFILE, full_name: appSession(role).nombre }],
    acredita_memberships: role === 'admin' ? [{ profile_id: PROFILE, role: 'admin_acredita', is_active: true }] : [],
    mandante_memberships: role === 'mandante' ? [{ profile_id: PROFILE, mandante_id: MANDANTE, role: 'mandante_admin', is_active: true }] : [],
    contratista_memberships: role === 'contratista' ? [{ profile_id: PROFILE, contratista_id: CONTRACTOR, role: 'contratista_admin', is_active: true }] : [],
    mandantes: [{ id: MANDANTE, name: 'Mandante Piloto', rut: '76.000.000-0', legal_name: 'Mandante Piloto SpA', integration_key: 'mandante_piloto', is_active: true }],
    projects: [
      { id: PROJECT, mandante_id: MANDANTE, name: 'Proyecto Piloto QA', code: 'PILOTO-QA', status: 'active', integration_key: 'proyecto_piloto', location: 'Santiago', starts_at: '2026-09-01', ends_at: null },
      ...(options.historicalProject ? [{ id: PROJECT_OLD, mandante_id: MANDANTE, name: 'Proyecto Histórico QA', code: 'HIST-QA', status: 'archived', integration_key: 'proyecto_historico', location: 'Santiago', starts_at: '2025-01-01', ends_at: '2025-12-31' }] : []),
    ],
    contratistas: [{ id: CONTRACTOR, name: 'Contratista Piloto A', rut: '77.000.000-1', legal_name: 'Contratista Piloto A SpA', integration_key: 'contratista_piloto_a', is_active: true, parent_contratista_id: null }],
    accreditations: [
      { id: ACCREDITATION, project_id: PROJECT, contratista_id: CONTRACTOR, is_active: true },
      ...(options.historicalProject ? [{ id: ACCREDITATION_OLD, project_id: PROJECT_OLD, contratista_id: CONTRACTOR, is_active: false }] : []),
    ],
    requirements: [
      { id: REQ_COMPANY, project_id: PROJECT, integration_key: 'req_f30', name: 'F30 / F31 SII', category: 'Laboral', target: 'empresa', is_required: true, frequency: 'mensual', validity_days: 30, alert_days: 7, criticality: 'bloquea_pago', is_active: true, sort_order: 1, description: 'Cumplimiento previsional', review_checklist: ['Vigencia'], applicability: { categories: [] }, blocks_work: false, blocks_assignment: false, service_id: null, due_days: 5 },
      { id: REQ_WORKER, project_id: PROJECT, integration_key: 'req_odi', name: 'Certificado ODI', category: 'Seguridad', target: 'trabajador', is_required: true, frequency: 'un_ano', validity_days: 365, alert_days: 30, criticality: 'bloquea_acceso', is_active: true, sort_order: 2, description: 'ODI vigente', review_checklist: ['Firma'], applicability: { categories: [] }, blocks_work: true, blocks_assignment: true, service_id: SERVICE, due_days: 5 },
      ...(options.historicalProject ? [{ id: REQ_COMPANY_OLD, project_id: PROJECT_OLD, integration_key: 'req_historico', name: 'Documento Histórico QA', category: 'Laboral', target: 'empresa', is_required: true, frequency: 'por_obra', validity_days: null, alert_days: 7, criticality: 'bloquea_pago', is_active: true, sort_order: 1, description: 'Requisito histórico', review_checklist: [], applicability: { categories: [] }, blocks_work: false, blocks_assignment: false, service_id: null, due_days: 5 }] : []),
    ],
    services: [{ id: SERVICE, accreditation_id: ACCREDITATION, integration_key: 'servicio_piloto', code: 'SRV-01', name: 'Servicio Piloto', category: 'Operación', contractor_contact: 'Jefe Contrato', mandante_contact: 'Administrador Contrato', starts_at: '2026-09-01', ends_at: null, status: 'activo', is_active: true }],
    workers: options.emptyProject ? [] : [{ id: WORKER, contratista_id: CONTRACTOR, rut: '18.123.456-7', full_name: 'Trabajador Piloto', job_title: 'Operador', is_active: true }],
    worker_assignments: options.emptyProject ? [] : [{ id: ASSIGNMENT, accreditation_id: ACCREDITATION, worker_id: WORKER, is_active: true, service_id: SERVICE, job_title: 'Operador', categories: ['general'], assignment_status: 'activa', access_status: 'pendiente', assigned_at: '2026-09-01', unassigned_at: null }],
    documents: [],
    document_versions: [],
    obligation_statuses: [],
    compliance_periods: [],
    accreditation_statuses: [
      { accreditation_id: ACCREDITATION, status: 'en_proceso', total_required: 2, approved_required: 0, pending_required: 2, rejected_required: 0, expired_required: 0, near_expiry_required: 0, access_allowed: false, payment_allowed: false },
      ...(options.historicalProject ? [{ accreditation_id: ACCREDITATION_OLD, status: 'aprobado', total_required: 0, approved_required: 0, pending_required: 0, rejected_required: 0, expired_required: 0, near_expiry_required: 0, access_allowed: false, payment_allowed: false }] : []),
    ],
    worker_accreditation_statuses: options.emptyProject ? [] : [{ worker_assignment_id: ASSIGNMENT, worker_id: WORKER, accreditation_id: ACCREDITATION, status: 'en_proceso', total_required: 1, approved_required: 0, pending_required: 1, rejected_required: 0, expired_required: 0, near_expiry_required: 0, access_allowed: false }],
    contractor_evaluations: [],
    payment_cases: [{ id: PAYMENT, accreditation_id: ACCREDITATION, period_start: '2026-09-01', period_end: '2026-09-30', amount: 2500000, currency: 'CLP', status: paymentStatus, block_reason: paymentStatus === 'observado' ? 'Pendiente de aprobación' : null, invoice_number: 'F-100', submitted_at: '2026-09-15T00:00:00Z', paid_at: paymentStatus === 'pagado' ? '2026-09-15T01:00:00Z' : null }],
    support_tickets: [],
    integration_configs: [],
    business_sync_control: [{ revision: 10 }],
    notification_preferences: [],
    notification_reads: [],
  } as Record<string, unknown[]>;
}

async function protectedPage(page: Page, role: Role, options: MockOptions = {}) {
  const data = fixtures(role, options);
  const calls: string[] = [];
  await page.addInitScript((session) => {
    window.localStorage.setItem('acredita_session', JSON.stringify(session));
  }, appSession(role));

  await page.route(`${SUPABASE}/**`, async route => {
    const request = route.request();
    const url = new URL(request.url());
    calls.push(`${request.method()} ${url.pathname}`);

    if (url.pathname === '/auth/v1/user') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: PROFILE, email: `${role}@e2e.invalid` }) });
    }
    if (url.pathname.startsWith('/auth/v1/token')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ access_token: 'e2e-access', refresh_token: 'e2e-refresh', expires_in: 3600, user: { id: PROFILE, email: `${role}@e2e.invalid` } }) });
    }
    if (url.pathname === '/rest/v1/rpc/mark_payment_paid') {
      return route.fulfill({ status: 204, body: '' });
    }
    if (url.pathname.startsWith('/rest/v1/rpc/')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(true) });
    }
    if (url.pathname.startsWith('/rest/v1/')) {
      const table = decodeURIComponent(url.pathname.slice('/rest/v1/'.length));
      if (request.method() !== 'GET' && request.method() !== 'HEAD') {
        return route.fulfill({ status: 204, body: '' });
      }
      const rows = data[table] || [];
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(rows) });
    }
    if (url.pathname.startsWith('/storage/v1/')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    }
    return route.fulfill({ status: 404, body: '{}' });
  });

  return { calls };
}

async function openMandanteProject(page: Page) {
  await page.goto('/mandante');
  await expect(page.getByText('Mandante Piloto').first()).toBeVisible();
  const projectNav = page.getByText('Proyectos', { exact: true }).first();
  if (await projectNav.isVisible()) await projectNav.click();
  await expect(page.getByText('Proyecto Piloto QA').first()).toBeVisible();
  await page.getByText('Proyecto Piloto QA').first().click();
  await expect(page.getByRole('heading', { name: 'Proyecto Piloto QA' })).toBeVisible();
}

test('01 landing pública responde y muestra Acredita', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('body')).toContainText('Acredita');
});

test('02 login único detecta el portal y mantiene solicitudes de acceso', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'Iniciar sesión' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Soy Mandante' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Soy Contratista' })).toBeVisible();
  await expect(page.getByText(/detectará automáticamente tu organización, perfil y permisos/i)).toBeVisible();
});

test('03 Mandante hidrata proyecto desde Supabase', async ({ page }) => {
  await protectedPage(page, 'mandante');
  await page.goto('/mandante');
  await expect(page.locator('body')).toContainText('Mandante Piloto');
  await expect(page.locator('body')).toContainText('Proyecto Piloto QA');
});

test('04 Mandante abre el detalle del proyecto', async ({ page }) => {
  await protectedPage(page, 'mandante');
  await openMandanteProject(page);
  await expect(page.getByText('Gestiona la acreditación completa del proyecto')).toBeVisible();
});

test('05 Mandante dispone de Servicios, Activos, Requisitos, Períodos y Operación', async ({ page }) => {
  await protectedPage(page, 'mandante');
  await openMandanteProject(page);
  for (const label of ['Servicios', 'Activos', 'Requisitos', 'Periodos', 'Operacion', 'Acreditaciones']) {
    await expect(page.getByRole('button', { name: label, exact: true })).toBeVisible();
  }
});

test('06 matriz de activos parte sin registros y no auto-habilita nada', async ({ page }) => {
  await protectedPage(page, 'mandante');
  await openMandanteProject(page);
  await page.getByRole('button', { name: 'Activos', exact: true }).click();
  await expect(page.getByText('Vehículos, maquinaria y equipos')).toBeVisible();
  await expect(page.getByText('No hay vehículos, maquinaria o equipos registrados.')).toBeVisible();
});

test('07 operación muestra estados de pago gobernados por aprobación', async ({ page }) => {
  await protectedPage(page, 'mandante', { paymentStatus: 'observado' });
  await openMandanteProject(page);
  await page.getByRole('button', { name: 'Operacion', exact: true }).click();
  await page.getByRole('button', { name: /Estados de pago/ }).click();
  await expect(page.getByText('Pendiente de aprobación')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Aprobaciones' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Marcar pagado' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Liberar' })).toHaveCount(0);
});

test('08 un pago liberado permite únicamente confirmar Pagado', async ({ page }) => {
  const { calls } = await protectedPage(page, 'mandante', { paymentStatus: 'liberado' });
  await openMandanteProject(page);
  await page.getByRole('button', { name: 'Operacion', exact: true }).click();
  await page.getByRole('button', { name: /Estados de pago/ }).click();
  await page.getByRole('button', { name: 'Marcar pagado' }).click();
  await expect.poll(() => calls.some(call => call.includes('/rest/v1/rpc/mark_payment_paid'))).toBeTruthy();
});

test('09 Contratista hidrata su empresa, mantiene proyecto activo visible y separa responsabilidades', async ({ page }) => {
  await protectedPage(page, 'contratista');
  await page.goto('/contratista');
  await expect(page.locator('body')).toContainText('Contratista Piloto A');
  await expect(page.locator('body')).toContainText('Proyecto Piloto QA');
  await expect(page.getByLabel('Proyecto activo global')).toHaveValue('proyecto_piloto');
  await expect(page.getByText('Requiere acción', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Acción preventiva', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Esperando a Acredita', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Sin acción requerida', { exact: true }).first()).toBeVisible();
});

test('09b Contratista nuevo recibe onboarding guiado de cinco pasos', async ({ page }) => {
  await protectedPage(page, 'contratista', { emptyProject: true });
  await page.goto('/contratista');
  await expect(page.getByText('Comienza la acreditación de Proyecto Piloto QA')).toBeVisible();
  for (const step of ['Revisar requisitos', 'Completar empresa', 'Cargar trabajadores', 'Completar trabajadores', 'Obtener acreditación']) {
    await expect(page.getByRole('button', { name: new RegExp(step) })).toBeVisible();
  }
});

test('09c Contratista conserva proyecto en URL, memoria y navegación del navegador', async ({ page }) => {
  await protectedPage(page, 'contratista', { historicalProject: true });
  await page.goto('/contratista');

  const selector = page.getByLabel('Proyecto activo global');
  await expect(selector).toHaveValue('proyecto_piloto');
  await expect(selector.locator('optgroup[label="Proyectos activos"] option')).toHaveText(['Proyecto Piloto QA']);
  await expect(selector.locator('optgroup[label="Históricos / finalizados"] option')).toHaveText(['Proyecto Histórico QA · Histórico']);

  await selector.selectOption('proyecto_historico');
  await expect(page).toHaveURL(/proyecto=proyecto_historico/);
  await expect(selector).toHaveValue('proyecto_historico');
  await expect.poll(() => page.evaluate(() => localStorage.getItem('acredita:last-project:10000000-0000-4000-8000-000000000001'))).toBe('proyecto_historico');

  await page.getByText('Documentos', { exact: true }).first().click();
  await expect(page).toHaveURL(/\/contratista\/documentos\?proyecto=proyecto_historico/);

  await page.goBack();
  await expect(page).toHaveURL(/\/contratista\?proyecto=proyecto_historico/);
  await expect(page.getByLabel('Proyecto activo global')).toHaveValue('proyecto_historico');

  await page.goto('/contratista');
  await expect(page).toHaveURL(/proyecto=proyecto_historico/);
  await expect(page.getByLabel('Proyecto activo global')).toHaveValue('proyecto_historico');
});

test('09d Contratista ve problemas no documentales y abre el pendiente documental exacto', async ({ page }) => {
  await protectedPage(page, 'contratista');
  await page.goto('/contratista');

  await expect(page.getByText(/Trabajador Piloto · Ficha laboral incompleta/).first()).toBeVisible();
  const priority = page.locator('.inicio2-priority').first();
  await expect(priority).toContainText('Prioridad 1 · Bloquea pago');
  await expect(priority).toContainText('F30 / F31 SII');
  await priority.getByRole('button', { name: 'Resolver' }).click();

  await expect(page).toHaveURL(/\/contratista\/documentos\?.*estado=accion.*requisito=req_f30/);
  await expect(page.getByLabel('Filtrar por estado')).toHaveValue('accion');
  await expect(page.locator('.doc-detail-title')).toHaveText('F30 / F31 SII');

  await page.goto('/contratista?proyecto=proyecto_piloto');
  const attentionCard = page.locator('.inicio2-card').filter({ hasText: 'Requiere atención' });
  await attentionCard.getByRole('button', { name: 'Ver todo' }).click();
  await expect(page).toHaveURL(/\/contratista\/documentos\?.*estado=accion/);
  await expect(page.getByLabel('Filtrar por estado')).toHaveValue('accion');
});

test('09e Proyecto histórico no genera acciones y Documentos queda en modo consulta', async ({ page }) => {
  await protectedPage(page, 'contratista', { historicalProject: true });
  await page.goto('/contratista?proyecto=proyecto_historico');

  await expect(page.getByText('Proyecto finalizado · modo consulta', { exact: true })).toBeVisible();
  const responsibilities = page.getByLabel('Responsabilidad de pendientes');
  await expect(responsibilities.locator('.mine b')).toHaveText('0');
  await expect(responsibilities.locator('.preventive b')).toHaveText('0');
  await expect(responsibilities.locator('.waiting b')).toHaveText('0');
  await expect(page.getByRole('button', { name: /Subir documento/ })).toHaveCount(0);

  await page.getByText('Documentos', { exact: true }).first().click();
  await expect(page.getByText('Proyecto finalizado · modo consulta', { exact: true })).toBeVisible();
  await expect(page.getByText('Documento Histórico QA', { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sin archivo' })).toBeDisabled();
});

test('10 Contratista puede abrir Proyectos', async ({ page }) => {
  await protectedPage(page, 'contratista');
  await page.goto('/contratista');
  await page.getByText('Proyectos', { exact: true }).first().click();
  await expect(page.locator('.mp-project-title').filter({ hasText: 'Proyecto Piloto QA' }).first()).toBeVisible();
});

test('11 Contratista ve requisitos documentales desde Supabase', async ({ page }) => {
  await protectedPage(page, 'contratista');
  await page.goto('/contratista');
  await page.getByText('Documentos', { exact: true }).first().click();
  await expect(page.locator('body')).toContainText('F30 / F31 SII');
});

test('12 Contratista ve trabajador asignado', async ({ page }) => {
  await protectedPage(page, 'contratista');
  await page.goto('/contratista');
  await page.getByText('Trabajadores', { exact: true }).first().click();
  await expect(page.getByText('Trabajador Piloto', { exact: true }).first()).toBeVisible();
});

test('13 Contratista puede abrir configuración y notificaciones sin perder sesión', async ({ page }) => {
  await protectedPage(page, 'contratista');
  await page.goto('/contratista');
  await page.getByText('Configuración', { exact: true }).first().click();
  await page.getByRole('button', { name: 'Notificaciones', exact: true }).click();
  await expect(page.locator('body')).toContainText('Documento rechazado');
});

test('14 rol Contratista no puede entrar al portal Mandante', async ({ page }) => {
  await protectedPage(page, 'contratista');
  await page.goto('/mandante');
  await expect(page).toHaveURL(/\/contratista/);
});

test('15 rol Mandante no puede entrar al portal Contratista', async ({ page }) => {
  await protectedPage(page, 'mandante');
  await page.goto('/contratista');
  await expect(page).toHaveURL(/\/mandante/);
});

test('16 rol Acredita no queda atrapado en portales de cliente', async ({ page }) => {
  await protectedPage(page, 'admin');
  await page.goto('/contratista');
  await expect(page).toHaveURL(/\/admin/);
});
