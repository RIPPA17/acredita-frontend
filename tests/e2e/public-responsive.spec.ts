import { expect, test, type Page } from '@playwright/test';

async function expectNoHorizontalOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }));
  expect(dimensions.content, `contenido ${dimensions.content}px > viewport ${dimensions.viewport}px`).toBeLessThanOrEqual(dimensions.viewport + 1);
}

test.describe('superficie pública de lanzamiento', () => {
  test('landing es usable a 360px sin desborde horizontal', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto('/');

    await expect(page.getByText('Acredita lo hace por ti.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Iniciar sesión' })).toBeVisible();
    await expect(page.locator('nav').getByRole('link', { name: 'Solicitar acceso' })).toBeHidden();
    await expectNoHorizontalOverflow(page);
  });

  test('landing conserva navegación de escritorio', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto('/');

    await expect(page.locator('nav').getByRole('link', { name: 'Cómo funciona' })).toBeVisible();
    await expect(page.locator('nav').getByRole('link', { name: 'Solicitar acceso' })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test('perfil Acredita no ofrece registro público', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto('/login?rol=admin');

    await expect(page.getByRole('heading', { name: 'Iniciar sesión' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Acredita' })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByText('El acceso del equipo Acredita se habilita internamente.')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Solicita acceso' })).toHaveCount(0);
    await expectNoHorizontalOverflow(page);
  });

  test('Mandante y Contratista mantienen su solicitud de acceso', async ({ page }) => {
    await page.goto('/login?rol=mandante');
    await expect(page.getByRole('link', { name: 'Solicita acceso' })).toHaveAttribute('href', '/registro?rol=mandante');

    await page.getByRole('button', { name: 'Contratista' }).click();
    await expect(page.getByRole('link', { name: 'Solicita acceso' })).toHaveAttribute('href', '/registro?rol=contratista');
  });

  test('registro y recuperación siguen utilizables en móvil', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });

    await page.goto('/registro?rol=mandante');
    await expect(page.getByRole('heading', { name: 'Solicitar acceso' })).toBeVisible();
    await expect(page.getByLabel('Empresa o razón social')).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await page.goto('/recuperar');
    await expect(page.getByRole('heading', { name: 'Recuperar acceso' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Enviar enlace de recuperación' })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });
});
