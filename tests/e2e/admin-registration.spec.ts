import { expect, test } from '@playwright/test';

test('registro público Acredita queda bloqueado incluso por URL directa', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto('/registro?rol=admin');

  await expect(page.getByRole('heading', { name: 'Acceso equipo Acredita' })).toBeVisible();
  await expect(page.getByText('Este perfil no admite solicitudes públicas de registro.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Enviar solicitud' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Iniciar sesión' })).toHaveAttribute('href', '/login?rol=admin');

  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }));
  expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport + 1);
});
