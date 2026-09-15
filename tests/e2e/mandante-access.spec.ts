import { expect, test, type Page } from '@playwright/test';

const SUPABASE = 'https://jwlscxbmttpicwljozwf.supabase.co';
const PROFILE = '21000000-0000-4000-8000-000000000001';
const MANDANTE = '22000000-0000-4000-8000-000000000001';

async function mockAdmin(page: Page) {
  const calls: string[] = [];
  await page.addInitScript(({ profile }) => {
    window.localStorage.setItem('acredita_session', JSON.stringify({
      email: 'admin@e2e.invalid', role: 'admin', nombre: 'Acredita QA', profileId: profile,
      _supabase: { accessToken: 'e2e-access', refreshToken: 'e2e-refresh', expiresAt: Date.now() + 3_600_000 },
    }));
  }, { profile: PROFILE });

  await page.route(`${SUPABASE}/**`, async route => {
    const request = route.request();
    const url = new URL(request.url());
    calls.push(`${request.method()} ${url.pathname}`);
    if (url.pathname === '/auth/v1/user') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: PROFILE, email: 'admin@e2e.invalid' }) });
    if (url.pathname === '/rest/v1/acredita_memberships') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ profile_id: PROFILE, role: 'admin_acredita', is_active: true }]) });
    if (url.pathname === '/rest/v1/profiles') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ id: PROFILE, full_name: 'Acredita QA' }]) });
    if (url.pathname === '/rest/v1/mandantes') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ id: MANDANTE, name: 'Mandante Invitación QA', rut: '76.222.222-2', integration_key: 'mandante_invitacion', is_active: true }]) });
    if (url.pathname === '/rest/v1/business_sync_control') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ revision: 2 }]) });
    if (url.pathname === '/functions/v1/invite-mandante-user') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, invited: true, existing_user: false, mandante: 'Mandante Invitación QA', email: 'gerencia@qa.invalid' }) });
    if (url.pathname.startsWith('/rest/v1/rpc/')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(true) });
    if (url.pathname.startsWith('/rest/v1/')) {
      if (!['GET', 'HEAD'].includes(request.method())) return route.fulfill({ status: 204, body: '' });
      return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    }
    return route.fulfill({ status: 404, body: '{}' });
  });
  return calls;
}

test('21 Acredita puede invitar la cuenta administradora de un Mandante', async ({ page }) => {
  const calls = await mockAdmin(page);
  await page.goto('/admin');
  await page.getByTitle('Configuración').click();
  await page.getByRole('button', { name: 'Accesos Mandante', exact: true }).click();
  const organization = page.getByLabel('Organización');
  await expect(organization).toBeVisible();
  await organization.selectOption(MANDANTE);
  await expect(organization).toHaveValue(MANDANTE);
  await page.getByLabel('Nombre de la persona').fill('Gerencia Mandante');
  await page.getByLabel('Correo').fill('gerencia@qa.invalid');
  await page.getByRole('button', { name: 'Invitar y otorgar acceso' }).click();
  await expect.poll(() => calls.some(call => call === 'POST /functions/v1/invite-mandante-user')).toBeTruthy();
  await expect(page.locator('body')).toContainText('Invitación enviada a gerencia@qa.invalid');
});
