import { expect, test } from '@playwright/test';

const SUPABASE = 'https://jwlscxbmttpicwljozwf.supabase.co';

function inviteFragment() {
  return new URLSearchParams({
    access_token: 'test-invite-token',
    refresh_token: 'test-refresh-token',
    expires_in: '3600',
    type: 'invite',
  }).toString();
}

test('23 invitación permite crear la primera contraseña y activar el acceso', async ({ page }) => {
  let updated = false;
  await page.route(`${SUPABASE}/auth/v1/user`, async route => {
    if (route.request().method() === 'PUT') updated = true;
    return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });

  await page.goto(`/#${inviteFragment()}`);

  await expect(page).toHaveURL(/\/recuperar#/);
  await expect(page.getByRole('heading', { name: 'Crea tu contraseña' })).toBeVisible();
  await page.getByLabel('Nueva contraseña').fill('Acredita2026!Segura');
  await page.getByLabel('Repetir contraseña').fill('Acredita2026!Segura');
  await page.getByRole('button', { name: 'Activar acceso' }).click();
  await expect.poll(() => updated).toBeTruthy();
  await expect(page.getByRole('heading', { name: 'Acceso activado' })).toBeVisible();
});

test('24 invitación rechaza contraseña débil antes de actualizar Auth', async ({ page }) => {
  let updated = false;
  await page.route(`${SUPABASE}/auth/v1/user`, async route => {
    if (route.request().method() === 'PUT') updated = true;
    return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });

  await page.goto(`/#${inviteFragment()}`);
  await expect(page).toHaveURL(/\/recuperar#/);
  await page.getByLabel('Nueva contraseña').fill('abcdefgh1234');
  await page.getByLabel('Repetir contraseña').fill('abcdefgh1234');
  await page.getByRole('button', { name: 'Activar acceso' }).click();

  await expect(page.getByRole('alert')).toContainText('letra mayúscula');
  await expect.poll(() => updated).toBeFalsy();
});
