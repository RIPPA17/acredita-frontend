import { expect, test } from '@playwright/test';

const SUPABASE = 'https://jwlscxbmttpicwljozwf.supabase.co';

test('23 invitación permite crear la primera contraseña y activar el acceso', async ({ page }) => {
  let updated = false;
  await page.route(`${SUPABASE}/auth/v1/user`, async route => {
    if (route.request().method() === 'PUT') updated = true;
    return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });

  const fragment = new URLSearchParams({
    access_token: 'test-invite-token',
    refresh_token: 'test-refresh-token',
    expires_in: '3600',
    type: 'invite',
  }).toString();
  await page.goto(`/#${fragment}`);

  await expect(page).toHaveURL(/\/recuperar#/);
  await expect(page.getByRole('heading', { name: 'Crea tu contraseña' })).toBeVisible();
  await page.getByLabel('Nueva contraseña').fill('abcdefgh');
  await page.getByLabel('Repetir contraseña').fill('abcdefgh');
  await page.getByRole('button', { name: 'Activar acceso' }).click();
  await expect.poll(() => updated).toBeTruthy();
  await expect(page.getByRole('heading', { name: 'Acceso activado' })).toBeVisible();
});
