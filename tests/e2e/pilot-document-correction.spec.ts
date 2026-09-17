import { expect, test, type Page } from '@playwright/test';

const SUPABASE = 'https://jwlscxbmttpicwljozwf.supabase.co';
const PROFILE = '13000000-0000-4000-8000-000000000002';
const MANDANTE = '23000000-0000-4000-8000-000000000001';
const PROJECT = '33000000-0000-4000-8000-000000000001';
const CONTRACTOR = '43000000-0000-4000-8000-000000000001';
const ACCREDITATION = '53000000-0000-4000-8000-000000000001';
const REQUIREMENT = '83000000-0000-4000-8000-000000000001';
const DOCUMENT = '93000000-0000-4000-8000-000000000001';
const VERSION_1 = 'a3000000-0000-4000-8000-000000000001';
const VERSION_2 = 'a3000000-0000-4000-8000-000000000002';

async function mountRejectedDocument(page: Page) {
  const calls: Array<{ method: string; path: string; body: string | null }> = [];
  const data: Record<string, unknown[]> = {
    profiles: [{ id: PROFILE, full_name: 'Álvaro Gutiérrez Silva', is_active: true }],
    acredita_memberships: [],
    mandante_memberships: [],
    contratista_memberships: [{ profile_id: PROFILE, contratista_id: CONTRACTOR, role: 'contratista_admin', is_active: true }],
    mandantes: [{ id: MANDANTE, name: 'El Boliche SpA', rut: '76.876.543-K', legal_name: 'El Boliche SpA', integration_key: 'el_boliche', is_active: true }],
    projects: [{ id: PROJECT, mandante_id: MANDANTE, name: 'Operación Gastronómica El Boliche 2026', code: 'BOLICHE-2026', status: 'active', integration_key: 'operacion_gastronomica_el_boliche_2026', location: 'Santiago', starts_at: '2026-09-01', ends_at: null }],
    contratistas: [{ id: CONTRACTOR, name: 'Terrible de Pollo SpA', rut: '77.123.456-9', legal_name: 'Terrible de Pollo SpA', integration_key: 'terrible_de_pollo', is_active: true, parent_contratista_id: null }],
    accreditations: [{ id: ACCREDITATION, project_id: PROJECT, contratista_id: CONTRACTOR, is_active: true }],
    requirements: [{
      id: REQUIREMENT,
      project_id: PROJECT,
      integration_key: 'f30_sii_mes_vigente',
      name: 'F30 SII (mes vigente)',
      category: 'Tributario',
      target: 'empresa',
      is_required: true,
      frequency: 'mensual',
      validity_days: 30,
      alert_days: 7,
      criticality: 'bloquea_pago',
      is_active: true,
      sort_order: 1,
      description: 'Cumplimiento tributario mensual',
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
      id: VERSION_1,
      document_id: DOCUMENT,
      version_number: 1,
      workflow_status: 'rechazado',
      expires_at: null,
      uploaded_at: '2026-09-16T12:00:00Z',
      reviewed_at: '2026-09-16T13:00:00Z',
      rejection_reason: 'Documento ilegible',
      rejection_explanation: 'La segunda página no se puede leer.',
      rejection_solution: 'Vuelve a cargar una copia legible.',
      storage_bucket: 'acredita-documents',
      storage_path: `${DOCUMENT}/v1/f30.pdf`,
      original_filename: 'F30_Terrible_de_Pollo.pdf',
      metadata: {},
    }],
    obligation_statuses: [],
    compliance_periods: [],
    services: [],
    accreditation_statuses: [{ accreditation_id: ACCREDITATION, status: 'vencido_bloqueado', total_required: 1, approved_required: 0, pending_required: 0, rejected_required: 1, expired_required: 0, near_expiry_required: 0, access_allowed: true, payment_allowed: false }],
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
    notification_preferences: [],
    notification_reads: [],
    business_sync_control: [{ revision: 51 }],
  };

  await page.addInitScript(({ profile, contractor }) => {
    window.localStorage.setItem('acredita_session', JSON.stringify({
      email: 'contratista@acredita.cl',
      role: 'contratista',
      nombre: 'Terrible de Pollo SpA',
      profileId: profile,
      contratistaId: 'terrible_de_pollo',
      contratistaBackendId: contractor,
      _supabase: { accessToken: 'e2e-contractor', refreshToken: 'e2e-refresh-contractor', expiresAt: Date.now() + 3_600_000 },
    }));
  }, { profile: PROFILE, contractor: CONTRACTOR });

  await page.route(`${SUPABASE}/**`, async route => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    calls.push({ method: request.method(), path, body: request.postData() });

    if (path === '/auth/v1/user') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: PROFILE, email: 'contratista@acredita.cl' }) });
    }
    if (path.startsWith('/auth/v1/token')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ access_token: 'e2e-contractor', refresh_token: 'e2e-refresh-contractor', expires_in: 3600, user: { id: PROFILE, email: 'contratista@acredita.cl' } }) });
    }
    if (path.startsWith('/rest/v1/rpc/')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(true) });
    }
    if (path.startsWith('/rest/v1/')) {
      const table = decodeURIComponent(path.slice('/rest/v1/'.length));
      if (request.method() === 'POST' && table === 'document_versions') {
        const input = JSON.parse(request.postData() || '{}');
        const row = { id: VERSION_2, ...input, version_number: 2, workflow_status: 'revision' };
        data.document_versions = [...data.document_versions, row];
        return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify([row]) });
      }
      if (!['GET', 'HEAD'].includes(request.method())) {
        return route.fulfill({ status: 204, body: '' });
      }
      let rows = [...(data[table] || [])];
      if (table === 'document_versions' && url.searchParams.get('order') === 'version_number.desc') {
        rows = rows.sort((a: any, b: any) => Number(b.version_number || 0) - Number(a.version_number || 0));
      }
      const limit = Number(url.searchParams.get('limit') || 0);
      if (limit > 0) rows = rows.slice(0, limit);
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(rows) });
    }
    if (path.startsWith('/storage/v1/object/')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    }
    return route.fulfill({ status: 404, body: '{}' });
  });

  return { calls };
}

test('piloto: contratista corrige un F30 rechazado y genera la versión 2 en revisión', async ({ page }) => {
  const { calls } = await mountRejectedDocument(page);

  await page.goto('/contratista');
  await page.getByText('Documentos', { exact: true }).first().click();
  await expect(page.getByText('F30 SII (mes vigente)').first()).toBeVisible();
  await expect(page.getByText('Rechazado').first()).toBeVisible();

  const chooserPromise = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Corregir', exact: true }).first().click();
  const chooser = await chooserPromise;
  await chooser.setFiles({
    name: 'F30_Terrible_de_Pollo_CORREGIDO.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.4\n% Corrección E2E Acredita\n'),
  });

  await expect(page.locator('body')).toContainText('F30_Terrible_de_Pollo_CORREGIDO.pdf enviado a revisión (versión 2)');
  await expect.poll(() => calls.some(call => call.method === 'POST' && call.path.includes('/storage/v1/object/acredita-documents/'))).toBeTruthy();
  await expect.poll(() => calls.some(call => call.method === 'POST' && call.path === '/rest/v1/document_versions' && (call.body || '').includes('F30_Terrible_de_Pollo_CORREGIDO.pdf'))).toBeTruthy();
});
