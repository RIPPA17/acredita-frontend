import { test, expect } from '@playwright/test';

// Reset function to clear database and reload clean seed data
async function resetDatabase(page: any) {
  await page.goto('/login');
  await page.evaluate(() => {
    localStorage.clear();
  });
  await page.goto('/login');
  await page.waitForLoadState('networkidle');
}

test.describe('Acredita E2E Portal Verification', () => {

  test('CASO E2E: Seguridad y Protección de Rutas', async ({ page }) => {
    await resetDatabase(page);

    // 1. Sin sesión -> /admin redirige a login
    await page.goto('/admin');
    await page.waitForURL('**/login**');
    expect(page.url()).toContain('/login');

    // 2. Sin sesión -> /mandante redirige a login
    await page.goto('/mandante');
    await page.waitForURL('**/login**');
    expect(page.url()).toContain('/login');

    // 3. Login Mandante -> Acceso denegado a /admin
    await page.locator('button:has-text("Mandante")').click();
    await page.locator('input[type="email"]').fill('andina@andina.cl');
    await page.locator('input[type="password"]').fill('andina123');
    await page.locator('button[type="submit"]').click();
    await page.waitForURL('**/mandante');

    await page.goto('/admin');
    await page.waitForURL('**/login**');
    expect(page.url()).toContain('/login');

    // Clear session to logout
    await page.evaluate(() => localStorage.clear());
    await page.goto('/login');
  });

  test('CASO E2E: Persistencia de Sesión', async ({ page }) => {
    await resetDatabase(page);

    // Login mandante
    await page.locator('button:has-text("Mandante")').click();
    await page.locator('input[type="email"]').fill('andina@andina.cl');
    await page.locator('input[type="password"]').fill('andina123');
    await page.locator('button[type="submit"]').click();
    await page.waitForURL('**/mandante');

    // Recargar página -> la sesión permanece
    await page.reload();
    await page.waitForLoadState('networkidle');
    expect(page.url()).toContain('/mandante');

    // Logout
    await page.locator('.sb-item:has-text("Cerrar sesión")').first().click();
    await page.waitForURL(url => url.pathname === '/' || url.pathname.includes('/login'));

    // Recargar -> sigue redirigido
    await page.goto('/mandante');
    await page.waitForURL(url => url.pathname.includes('/login'));
    expect(page.url()).toContain('/login');
  });

  test('CASO E2E: Aislamiento Mandante y Contratista', async ({ page }) => {
    await resetDatabase(page);

    // Login mandante A (Andina)
    await page.locator('button:has-text("Mandante")').click();
    await page.locator('input[type="email"]').fill('andina@andina.cl');
    await page.locator('input[type="password"]').fill('andina123');
    await page.locator('button[type="submit"]').click();
    await page.waitForURL('**/mandante');

    // Intentar abrir proyecto de Andes (andes_solar) en la URL
    await page.goto('/mandante?proyecto=andes_solar');
    await page.waitForLoadState('networkidle');
    // No debe cargar datos de andes_solar
    const bodyText = await page.innerText('body');
    expect(bodyText).not.toContain('Parque Solar Andes');

    // Logout
    await page.locator('.sb-item:has-text("Cerrar sesión")').first().click();
    await page.waitForURL(url => url.pathname === '/');
  });

  test('CASO E2E: Flujo Completo Mandante -> Contratista -> Admin (Acreditación, Documentos, Auditoría)', async ({ page }) => {
    await resetDatabase(page);

    // ==========================================
    // 1. Mandante: Invitar contratista
    // ==========================================
    await page.locator('button:has-text("Mandante")').click();
    await page.locator('input[type="email"]').fill('andina@andina.cl');
    await page.locator('input[type="password"]').fill('andina123');
    await page.locator('button[type="submit"]').click();
    await page.waitForURL('**/mandante');

    // Ir a la pestaña Proyectos
    await page.locator('.sb-item:has-text("Proyectos")').first().click();

    // Hacer click en "Invitar Contratista"
    await page.locator('button:has-text("Invitar Contratista")').first().click();
    await page.waitForSelector('h3:has-text("Invitar contratista")');

    // Rellenar formulario de invitación
    await page.locator('label:has-text("Contratista a invitar") + select').selectOption('tecnicosur');
    await page.locator('label:has-text("Proyecto al que se invita") + select').selectOption('costanera');
    await page.locator('button:has-text("Enviar invitación")').click();

    // Confirmar toast o mensaje de éxito
    await page.waitForTimeout(500);

    // Logout
    await page.locator('.sb-item:has-text("Cerrar sesión")').first().click();
    await page.waitForURL(url => url.pathname === '/');

    // ==========================================
    // 2. Contratista: Aceptar invitación y subir documento
    // ==========================================
    await page.goto('/login');
    await page.locator('button:has-text("Contratista")').click();
    await page.locator('input[type="email"]').fill('tecnico@tecnicosur.cl');
    await page.locator('input[type="password"]').fill('tecnico123');
    await page.locator('button[type="submit"]').click();

    // Ver invitación en la pantalla de bienvenida y hacer click en aceptar
    await page.waitForSelector('button:has-text("Aceptar y comenzar")');
    await page.locator('button:has-text("Aceptar y comenzar")').click();

    // Esperar a que expire el setTimeout de 1000ms y la página se recargue
    await page.waitForTimeout(1500);
    await page.waitForURL('**/contratista');
    
    // Ir a "Subir documentos"
    await page.locator('.sb-item:has-text("Subir documentos")').first().click();
    await page.waitForSelector('h2:has-text("Checklist de documentos")');

    // Click en la fila de F30 (que está pendiente)
    await page.locator('text=F30 >> visible=true').first().click();
    // Subir documento
    await page.locator('.inset-0 button:has-text("Subir documento")').first().click();
    
    // Verificar que el estado del documento cambia visualmente a "En revisión" en el panel o lista
    await page.waitForSelector('span:has-text("En revisión") >> visible=true');

    // Logout
    await page.locator('.sb-item:has-text("Cerrar sesión")').first().click();
    await page.waitForURL(url => url.pathname === '/');

    // ==========================================
    // 3. Admin: Rechazar documento
    // ==========================================
    await page.goto('/login');
    await page.locator('button:has-text("Auditor Acredita")').click();
    await page.locator('input[type="email"]').fill('admin@acredita.cl');
    await page.locator('input[type="password"]').fill('admin123');
    await page.locator('button[type="submit"]').click();
    await page.waitForURL('**/admin');

    // Ir a la pestaña "Cola de revisión"
    await page.locator('.sb-item:has-text("Cola de revisión")').first().click();

    // Buscar el documento subido "F30" en la lista de revisión
    await page.locator('text=F30 >> visible=true').first().click();

    // Click en Rechazar
    await page.locator('button:has-text("Rechazar") >> visible=true').first().click();

    // Completar el formulario de rechazo
    await page.locator('select:has-text("Seleccione el motivo de rechazo")').selectOption('Documento ilegible');
    await page.locator('textarea').first().fill('La firma no es legible en la primera página.');
    await page.locator('textarea').nth(1).fill('Favor subir una versión escaneada en alta definición.');
    await page.locator('button:has-text("Confirmar Rechazo")').click();

    // ==========================================
    // 4. Admin: Verificar Auditoría e Historial
    // ==========================================
    await page.locator('.sb-item:has-text("Auditoría")').first().click();
    await page.waitForSelector('h2:has-text("Auditoría")');

    // El log debe contener las acciones de login, invitación, aceptación y rechazo
    const auditText = await page.innerText('body');
    expect(auditText).toContain('creacion_invitacion');
    expect(auditText).toContain('aceptacion_invitacion');
    expect(auditText).toContain('rechazo_documento');

    // Logout
    await page.locator('.sb-item:has-text("Cerrar sesión")').first().click();
    await page.waitForURL(url => url.pathname === '/');
  });
});
