import { expect, test, type Page } from '@playwright/test';

const SUPABASE = 'https://jwlscxbmttpicwljozwf.supabase.co';
const PROFILE = '11000000-0000-4000-8000-000000000001';
const REQUEST = '12000000-0000-4000-8000-000000000001';

async function mockAdmin(page: Page) {
  const calls: string[] = [];
  await page.addInitScript(({ profile }) => {
    window.localStorage.setItem('acredita_session', JSON.stringify({
      email: 'admin@e2e.invalid',
      role: 'admin',
      nombre: 'Acredita QA',
      profileId: profile,
      _supabase: { accessToken: 'e2e-access', refreshToken: 'e2e-refresh', expiresAt: Date.now() + 3_600_000 },
    }));
  }, { profile: PROFILE });

  await page.route(`${SUPABASE}/**`, async route => {
    const request = route.request();
    const url = new URL(request.url());
    calls.push(`${request.method()} ${url.pathname}`);

    if (url.pathname === '/auth/v1/user') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: PROFILE, email: 'admin@e2e.invalid' }) });
    }
    if (url.pathname.startsWith('/auth/v1/token')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ access_token: 'e2e-access', refresh_token: 'e2e-refresh', expires_in: 3600 }) });
    }
    if (url.pathname === '/rest/v1/access_requests') {
      if (request.method() === 'PATCH') return route.fulfill({ status: 204, body: '' });
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{
        id: REQUEST,
        requested_role: 'mandante',
        full_name: 'Jefa Piloto',
        company_name: 'Mandante Solicitud QA',
        rut: '76.111.111-1',
        industry: 'Construcción',
        email: 'contacto@qa.invalid',
        phone: '+56911111111',
        status: 'pending',
        request_type: 'access',
        company_size: '51-200',
        message: 'Necesitamos acreditar contratistas.',
        created_at: '2026-09-15T12:00:00Z',
        updated_at: '2026-09-15T12:00:00Z',
      }]) });
    }
    if (url.pathname === '/rest/v1/acredita_memberships') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ profile_id: PROFILE, role: 'admin_acredita', is_active: true }]) });
    }
    if (url.pathname === '/rest/v1/profiles') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ id: PROFILE, full_name: 'Acredita QA' }]) });
    }
    if (url.pathname === '/rest/v1/business_sync_control') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ revision: 1 }]) });
    }
    if (url.pathname.startsWith('/rest/v1/rpc/')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(true) });
    }
    if (url.pathname.startsWith('/rest/v1/')) {
      if (!['GET', 'HEAD'].includes(request.method())) return route.fulfill({ status: 204, body: '' });
      return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    }
    if (url.pathname.startsWith('/storage/v1/')) return route.fulfill({ status: 200, body: '{}' });
    return route.fulfill({ status: 404, body: '{}' });
  });
  return { calls };
}

test('17 login permite iniciar recuperación de contraseña', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill('usuario@empresa.cl');
  await page.getByRole('link', { name: '¿Olvidaste tu contraseña?' }).click();
  await expect(page).toHaveURL(/\/recuperar\?email=usuario%40empresa\.cl/);
  await expect(page.getByRole('heading', { name: 'Recuperar acceso' })).toBeVisible();
});

test('18 recuperación solicita correo a Supabase sin revelar si la cuenta existe', async ({ page }) => {
  let called = false;
  await page.route(`${SUPABASE}/auth/v1/recover`, async route => {
    called = true;
    return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });
  await page.goto('/recuperar?email=usuario%40empresa.cl');
  await page.getByRole('button', { name: 'Enviar enlace de recuperación' }).click();
  await expect.poll(() => called).toBeTruthy();
  await expect(page.getByRole('heading', { name: 'Revisa tu correo' })).toBeVisible();
  await expect(page.locator('body')).toContainText('Si existe una cuenta asociada');
});

test('19 enlace recovery recibido en la raíz aterriza en el formulario y cambia contraseña', async ({ page }) => {
  let passwordUpdate = false;
  await page.route(`${SUPABASE}/auth/v1/user`, async route => {
    if (route.request().method() === 'PUT') passwordUpdate = true;
    return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });
  await page.goto('/#access_token=e2e-recovery&refresh_token=e2e-refresh&expires_in=3600&type=recovery');
  await expect(page).toHaveURL(/\/recuperar#/);
  await expect(page.getByRole('heading', { name: 'Crear nueva contraseña' })).toBeVisible();
  await page.getByLabel('Nueva contraseña').fill('NuevaClave2026!');
  await page.getByLabel('Repetir contraseña').fill('NuevaClave2026!');
  await page.getByRole('button', { name: 'Guardar nueva contraseña' }).click();
  await expect.poll(() => passwordUpdate).toBeTruthy();
  await expect(page.getByRole('heading', { name: 'Contraseña actualizada' })).toBeVisible();
});

test('20 Acredita puede ver y resolver solicitudes de acceso', async ({ page }) => {
  const { calls } = await mockAdmin(page);
  await page.goto('/admin');
  await expect(page.locator('body')).toContainText('Acredita');
  await page.getByText('Configuración', { exact: true }).first().click();
  await page.getByRole('button', { name: 'Solicitudes de acceso', exact: true }).click();
  await expect(page.getByText('Mandante Solicitud QA')).toBeVisible();
  await expect(page.getByText('Jefa Piloto')).toBeVisible();
  await page.getByRole('button', { name: 'Aprobar' }).click();
  await expect.poll(() => calls.some(call => call === 'PATCH /rest/v1/access_requests')).toBeTruthy();
  await expect(page.getByText('Aprobada').first()).toBeVisible();
});
