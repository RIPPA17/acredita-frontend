# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: verify_real_e2e.spec.ts >> Acredita E2E Portal Verification >> CASO E2E: Flujo Completo Mandante -> Contratista -> Admin (Acreditación, Documentos, Auditoría)
- Location: e2e\verify_real_e2e.spec.ts:90:3

# Error details

```
TimeoutError: locator.click: Timeout 10000ms exceeded.
Call log:
  - waiting for locator('button:has-text("Invitar Contratista")').first()

```

# Page snapshot

```yaml
- generic [ref=f1e2]:
  - generic [ref=f1e3]:
    - generic [ref=f1e4]: Vistas del Sistema
    - link "1. Landing Page" [ref=f1e5] [cursor=pointer]:
      - /url: /
    - link "2. Panel Admin" [ref=f1e6] [cursor=pointer]:
      - /url: /admin
    - link "3. Portal Mandante" [ref=f1e7] [cursor=pointer]:
      - /url: /mandante
    - link "4. Portal Contratista" [ref=f1e8] [cursor=pointer]:
      - /url: /contratista
  - generic [ref=f1e10]:
    - generic [ref=f1e11]: Paso 1 de 3
    - generic [ref=f1e17]:
      - heading "Configura tu empresa" [level=2] [ref=f1e18]
      - generic [ref=f1e19]:
        - generic [ref=f1e20]:
          - generic [ref=f1e21]: RUT Empresa
          - textbox "76.123.456-7" [ref=f1e22]
        - generic [ref=f1e23]:
          - generic [ref=f1e24]: Nombre Empresa
          - textbox "Constructora Andina SA" [ref=f1e25]
      - button "Continuar →" [ref=f1e26] [cursor=pointer]
    - button "Saltar por ahora" [ref=f1e28]
```

# Test source

```ts
  3   | // Reset function to clear database and reload clean seed data
  4   | async function resetDatabase(page: any) {
  5   |   await page.goto('/login');
  6   |   await page.evaluate(() => {
  7   |     localStorage.clear();
  8   |   });
  9   |   await page.goto('/login');
  10  |   await page.waitForLoadState('networkidle');
  11  | }
  12  | 
  13  | test.describe('Acredita E2E Portal Verification', () => {
  14  | 
  15  |   test('CASO E2E: Seguridad y Protección de Rutas', async ({ page }) => {
  16  |     await resetDatabase(page);
  17  | 
  18  |     // 1. Sin sesión -> /admin redirige a login
  19  |     await page.goto('/admin');
  20  |     await page.waitForURL('**/login**');
  21  |     expect(page.url()).toContain('/login');
  22  | 
  23  |     // 2. Sin sesión -> /mandante redirige a login
  24  |     await page.goto('/mandante');
  25  |     await page.waitForURL('**/login**');
  26  |     expect(page.url()).toContain('/login');
  27  | 
  28  |     // 3. Login Mandante -> Acceso denegado a /admin
  29  |     await page.locator('button:has-text("Mandante")').click();
  30  |     await page.locator('input[type="email"]').fill('andina@andina.cl');
  31  |     await page.locator('input[type="password"]').fill('andina123');
  32  |     await page.locator('button[type="submit"]').click();
  33  |     await page.waitForURL('**/mandante');
  34  | 
  35  |     await page.goto('/admin');
  36  |     // Debería redirigir o bloquear acceso
  37  |     expect(page.url()).not.toContain('/admin');
  38  | 
  39  |     // Logout
  40  |     await page.locator('.sb-item:has-text("Cerrar sesión")').first().click();
  41  |     await page.waitForURL('**/login**');
  42  |   });
  43  | 
  44  |   test('CASO E2E: Persistencia de Sesión', async ({ page }) => {
  45  |     await resetDatabase(page);
  46  | 
  47  |     // Login mandante
  48  |     await page.locator('button:has-text("Mandante")').click();
  49  |     await page.locator('input[type="email"]').fill('andina@andina.cl');
  50  |     await page.locator('input[type="password"]').fill('andina123');
  51  |     await page.locator('button[type="submit"]').click();
  52  |     await page.waitForURL('**/mandante');
  53  | 
  54  |     // Recargar página -> la sesión permanece
  55  |     await page.reload();
  56  |     await page.waitForLoadState('networkidle');
  57  |     expect(page.url()).toContain('/mandante');
  58  | 
  59  |     // Logout
  60  |     await page.locator('.sb-item:has-text("Cerrar sesión")').first().click();
  61  |     await page.waitForURL('**/login**');
  62  | 
  63  |     // Recargar -> sigue redirigido
  64  |     await page.goto('/mandante');
  65  |     await page.waitForURL('**/login**');
  66  |     expect(page.url()).toContain('/login');
  67  |   });
  68  | 
  69  |   test('CASO E2E: Aislamiento Mandante y Contratista', async ({ page }) => {
  70  |     await resetDatabase(page);
  71  | 
  72  |     // Login mandante A (Andina)
  73  |     await page.locator('button:has-text("Mandante")').click();
  74  |     await page.locator('input[type="email"]').fill('andina@andina.cl');
  75  |     await page.locator('input[type="password"]').fill('andina123');
  76  |     await page.locator('button[type="submit"]').click();
  77  |     await page.waitForURL('**/mandante');
  78  | 
  79  |     // Intentar abrir proyecto de Andes (andes_solar) en la URL
  80  |     await page.goto('/mandante?proyecto=andes_solar');
  81  |     await page.waitForLoadState('networkidle');
  82  |     // No debe cargar datos de andes_solar
  83  |     const bodyText = await page.innerText('body');
  84  |     expect(bodyText).not.toContain('Parque Solar Andes');
  85  | 
  86  |     // Logout
  87  |     await page.locator('.sb-item:has-text("Cerrar sesión")').first().click();
  88  |   });
  89  | 
  90  |   test('CASO E2E: Flujo Completo Mandante -> Contratista -> Admin (Acreditación, Documentos, Auditoría)', async ({ page }) => {
  91  |     await resetDatabase(page);
  92  | 
  93  |     // ==========================================
  94  |     // 1. Mandante: Invitar contratista
  95  |     // ==========================================
  96  |     await page.locator('button:has-text("Mandante")').click();
  97  |     await page.locator('input[type="email"]').fill('andina@andina.cl');
  98  |     await page.locator('input[type="password"]').fill('andina123');
  99  |     await page.locator('button[type="submit"]').click();
  100 |     await page.waitForURL('**/mandante');
  101 | 
  102 |     // Hacer click en "Invitar Contratista"
> 103 |     await page.locator('button:has-text("Invitar Contratista")').first().click();
      |                                                                          ^ TimeoutError: locator.click: Timeout 10000ms exceeded.
  104 |     await page.waitForSelector('h3:has-text("Invitar Contratista")');
  105 | 
  106 |     // Rellenar formulario de invitación
  107 |     await page.locator('select').nth(1).selectOption('tecnicosur'); // Contratista TécnicoSur
  108 |     await page.locator('select').nth(2).selectOption('costanera'); // Proyecto Torre Costanera
  109 |     await page.locator('button:has-text("Enviar invitación")').click();
  110 | 
  111 |     // Confirmar toast o mensaje de éxito
  112 |     await page.waitForTimeout(500);
  113 | 
  114 |     // Logout
  115 |     await page.locator('.sb-item:has-text("Cerrar sesión")').first().click();
  116 |     await page.waitForURL('**/login**');
  117 | 
  118 |     // ==========================================
  119 |     // 2. Contratista: Aceptar invitación y subir documento
  120 |     // ==========================================
  121 |     await page.locator('button:has-text("Contratista")').click();
  122 |     await page.locator('input[type="email"]').fill('tecnico@tecnicosur.cl');
  123 |     await page.locator('input[type="password"]').fill('tecnico123');
  124 |     await page.locator('button[type="submit"]').click();
  125 | 
  126 |     // Ver invitación en la pantalla de bienvenida y hacer click en aceptar
  127 |     await page.waitForSelector('button:has-text("Aceptar y comenzar")');
  128 |     await page.locator('button:has-text("Aceptar y comenzar")').click();
  129 | 
  130 |     // Esperar a que la página se recargue y cargue el dashboard
  131 |     await page.waitForURL('**/contratista');
  132 |     
  133 |     // Ir a "Subir documentos"
  134 |     await page.locator('.sb-item:has-text("Subir documentos")').first().click();
  135 |     await page.waitForSelector('h2:has-text("Checklist de documentos")');
  136 | 
  137 |     // Click en la fila de Patente Municipal (que está pendiente)
  138 |     await page.locator('text=Patente Municipal').first().click();
  139 |     await page.waitForSelector('button:has-text("Subir documento")');
  140 |     
  141 |     // Subir documento
  142 |     await page.locator('button:has-text("Subir documento")').click();
  143 |     
  144 |     // Verificar que el estado del documento cambia visualmente a "En revisión" en el panel o lista
  145 |     await page.waitForSelector('span:has-text("En revisión")');
  146 | 
  147 |     // Logout
  148 |     await page.locator('.sb-item:has-text("Cerrar sesión")').first().click();
  149 |     await page.waitForURL('**/login**');
  150 | 
  151 |     // ==========================================
  152 |     // 3. Admin: Rechazar documento
  153 |     // ==========================================
  154 |     await page.locator('button:has-text("Auditor Acredita")').click();
  155 |     await page.locator('input[type="email"]').fill('admin@acredita.cl');
  156 |     await page.locator('input[type="password"]').fill('admin123');
  157 |     await page.locator('button[type="submit"]').click();
  158 |     await page.waitForURL('**/admin');
  159 | 
  160 |     // Buscar el documento subido "Patente Municipal" en la lista de revisión
  161 |     await page.locator('text=Patente Municipal').first().click();
  162 |     await page.waitForSelector('button:has-text("Rechazar")');
  163 | 
  164 |     // Click en Rechazar
  165 |     await page.locator('button:has-text("Rechazar")').click();
  166 | 
  167 |     // Completar el formulario de rechazo
  168 |     await page.locator('select').nth(2).selectOption('Documento ilegible');
  169 |     await page.locator('textarea').first().fill('La firma no es legible en la primera página.');
  170 |     await page.locator('textarea').nth(1).fill('Favor subir una versión escaneada en alta definición.');
  171 |     await page.locator('button:has-text("Confirmar Rechazo")').click();
  172 | 
  173 |     // El estado del documento ahora debe aparecer como rechazado
  174 |     await page.waitForSelector('span:has-text("Rechazado")');
  175 | 
  176 |     // ==========================================
  177 |     // 4. Admin: Verificar Auditoría e Historial
  178 |     // ==========================================
  179 |     await page.locator('.sb-item:has-text("Auditoría")').first().click();
  180 |     await page.waitForSelector('h2:has-text("Historial de Auditoría")');
  181 | 
  182 |     // El log debe contener las acciones de login, invitación, aceptación y rechazo
  183 |     const auditText = await page.innerText('body');
  184 |     expect(auditText).toContain('creacion_invitacion');
  185 |     expect(auditText).toContain('aceptar_invitacion');
  186 |     expect(auditText).toContain('rechazo_documento');
  187 | 
  188 |     // Logout
  189 |     await page.locator('.sb-item:has-text("Cerrar sesión")').first().click();
  190 |   });
  191 | });
  192 | 
```