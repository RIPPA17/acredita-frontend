# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: verify_real_e2e.spec.ts >> Acredita E2E Portal Verification >> CASO E2E: Seguridad y Protección de Rutas
- Location: e2e\verify_real_e2e.spec.ts:15:3

# Error details

```
Error: expect(received).not.toContain(expected) // indexOf

Expected substring: not "/admin"
Received string:        "http://localhost:3000/admin"
```

# Page snapshot

```yaml
- generic [ref=f4e2]:
  - generic [ref=f4e3]:
    - generic [ref=f4e4]: Vistas del Sistema
    - link "1. Landing Page" [ref=f4e5] [cursor=pointer]:
      - /url: /
    - link "2. Panel Admin" [ref=f4e6] [cursor=pointer]:
      - /url: /admin
    - link "3. Portal Mandante" [ref=f4e7] [cursor=pointer]:
      - /url: /mandante
    - link "4. Portal Contratista" [ref=f4e8] [cursor=pointer]:
      - /url: /contratista
  - generic [ref=f4e10]:
    - generic [ref=f4e11]:
      - generic [ref=f4e12]:
        - generic [ref=f4e13]: Acredita
        - heading "Simplifica tu cumplimiento laboral" [level=1] [ref=f4e14]: Simplifica tucumplimiento laboral
        - paragraph [ref=f4e15]: La plataforma más rápida y segura para la gestión de documentos entre mandantes y contratistas en Chile.
        - generic [ref=f4e16]:
          - generic [ref=f4e22]:
            - generic [ref=f4e23]: Cero multas
            - generic [ref=f4e24]: Mitiga la responsabilidad solidaria con control automático.
          - generic [ref=f4e30]:
            - generic [ref=f4e31]: Alertas automáticas
            - generic [ref=f4e32]: Avisos preventivos antes de que venza cualquier documento.
          - generic [ref=f4e38]:
            - generic [ref=f4e39]: Ahorro de tiempo
            - generic [ref=f4e40]: Elimina las planillas Excel y horas persiguiendo papeles.
      - generic [ref=f4e41]: © 2026 Acredita SpA
    - generic [ref=f4e43]:
      - generic [ref=f4e44]:
        - heading "Iniciar sesión" [level=2] [ref=f4e45]
        - paragraph [ref=f4e46]: Selecciona tu perfil de acceso para continuar
      - generic [ref=f4e47]:
        - button "Mandante" [ref=f4e48]
        - button "Contratista" [ref=f4e49]
        - button "Auditor Acredita" [ref=f4e50]
      - generic [ref=f4e51]:
        - generic [ref=f4e52]:
          - generic [ref=f4e53]: Email
          - textbox "tu@empresa.cl" [ref=f4e54]
        - generic [ref=f4e55]:
          - generic [ref=f4e56]: Contraseña
          - textbox "••••••••" [ref=f4e57]
        - link "¿Olvidaste tu contraseña?" [ref=f4e59] [cursor=pointer]:
          - /url: "#"
        - button "Ingresar" [ref=f4e60] [cursor=pointer]
      - generic [ref=f4e61]:
        - generic [ref=f4e62]:
          - generic [ref=f4e63]: Demo Credenciales (Mandante)
          - button "Autocompletar" [ref=f4e64]
        - generic [ref=f4e65]: "Email: andina@andina.clClave: andina123"
      - generic [ref=f4e66]:
        - text: ¿No tienes una cuenta?
        - link "Regístrate gratis" [ref=f4e67] [cursor=pointer]:
          - /url: /registro?rol=mandante
```

# Test source

```ts
  1   | import { test, expect } from '@playwright/test';
  2   | 
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
> 37  |     expect(page.url()).not.toContain('/admin');
      |                            ^ Error: expect(received).not.toContain(expected) // indexOf
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
  103 |     await page.locator('button:has-text("Invitar Contratista")').first().click();
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
```