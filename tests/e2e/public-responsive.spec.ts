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
    await expect(page.getByRole('link', { name: 'Privacidad' })).toBeVisible();
    await expect(page.getByText('Respuesta garantizada en')).toHaveCount(0);
    await expect(page.getByText('Gratis', { exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Iniciar sesión' }).click();
    await expect(page.getByRole('dialog', { name: '¿Cómo quieres ingresar?' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Cerrar selector de acceso' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expectNoHorizontalOverflow(page);
  });

  test('login es único y detecta el portal sin selector manual', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto('/login?rol=admin');

    await expect(page.getByRole('heading', { name: 'Iniciar sesión' })).toBeVisible();
    await expect(page.getByText('Acredita detectará automáticamente tu organización, perfil y permisos.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Mandante' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Contratista' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Acredita' })).toHaveCount(0);
    await expect(page.getByText('Las cuentas del equipo Acredita se habilitan internamente.')).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test('rutas públicas y privadas exponen metadatos de indexación correctos', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle('Acredita | Gestión de acreditación documental');
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'index,follow');

    await page.goto('/privacidad');
    await expect(page).toHaveTitle('Privacidad y derechos de datos | Acredita');
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'index,follow');

    await page.goto('/login');
    await expect(page).toHaveTitle('Iniciar sesión | Acredita');
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex,nofollow');

    await page.goto('/admin');
    await expect(page).toHaveTitle('Administración | Acredita');
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex,nofollow');
  });

  test('login mantiene solicitudes de acceso para Mandante y Contratista', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('link', { name: 'Soy Mandante' })).toHaveAttribute('href', '/registro?rol=mandante');
    await expect(page.getByRole('link', { name: 'Soy Contratista' })).toHaveAttribute('href', '/registro?rol=contratista');
  });

  test('registro y recuperación siguen utilizables en móvil', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });

    await page.goto('/registro?rol=mandante');
    await expect(page.getByRole('heading', { name: 'Solicitar acceso' })).toBeVisible();
    await expect(page.getByLabel('Empresa o razón social')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Centro de privacidad' })).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await page.goto('/recuperar');
    await expect(page.getByRole('heading', { name: 'Recuperar acceso' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Enviar enlace de recuperación' })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test('centro de privacidad es accesible y usable en móvil', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto('/privacidad');

    await expect(page.getByRole('heading', { name: 'Tus datos, tus derechos y un canal directo para ejercerlos.' })).toBeVisible();
    await expect(page.getByLabel('Nombre completo')).toBeVisible();
    await expect(page.getByLabel('Correo de contacto')).toBeVisible();
    await expect(page.getByLabel('Tipo de solicitud')).toBeVisible();
    await expect(page.getByLabel('¿Qué datos o tratamiento quieres identificar?')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Registrar solicitud' })).toBeVisible();
    await expect(page.getByText('dos días hábiles')).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });
});
