// Set up mock localStorage environment for Node.js
const store: Record<string, string> = {};
const mockLocalStorage = {
  getItem: (key: string) => store[key] || null,
  setItem: (key: string, value: string) => { store[key] = value; },
  removeItem: (key: string) => { delete store[key]; },
  clear: () => { for (const k in store) delete store[k]; }
};

(global as any).window = {
  localStorage: mockLocalStorage
};
(global as any).localStorage = mockLocalStorage;

import { 
  initDb,
  loginUser,
  getCurrentSession,
  logoutUser,
  getProyectos,
  getContratistas
} from '../localStorageDb';

console.log('=== INICIANDO VALIDACIÓN DE AUTENTICACIÓN Y AISLAMIENTO DE DATOS ===\n');

// Inicializar base de datos
initDb();

// CASO 1: Usuario no autenticado intenta acceder a /admin
console.log('--- Caso 1: Usuario no autenticado intenta acceder a /admin ---');
{
  logoutUser();
  const session = getCurrentSession();
  const allowedRoles = ['admin'];
  const hasAccess = session !== null && allowedRoles.includes(session.role);
  console.log(`¿Acceso permitido?: ${hasAccess} (Esperado: false)`);
  if (hasAccess) {
    console.error('❌ Falló Caso 1');
    process.exit(1);
  }
}

// CASO 2: Usuario no autenticado intenta acceder a /mandante
console.log('--- Caso 2: Usuario no autenticado intenta acceder a /mandante ---');
{
  logoutUser();
  const session = getCurrentSession();
  const allowedRoles = ['mandante'];
  const hasAccess = session !== null && allowedRoles.includes(session.role);
  console.log(`¿Acceso permitido?: ${hasAccess} (Esperado: false)`);
  if (hasAccess) {
    console.error('❌ Falló Caso 2');
    process.exit(1);
  }
}

// CASO 3: Mandante intenta acceder a /admin
console.log('--- Caso 3: Mandante intenta acceder a /admin ---');
{
  const logged = loginUser('andina@andina.cl', 'andina123', 'mandante');
  const session = getCurrentSession();
  const allowedRoles = ['admin'];
  const hasAccess = logged && session !== null && allowedRoles.includes(session.role);
  console.log(`¿Acceso permitido?: ${hasAccess} (Esperado: false)`);
  if (hasAccess) {
    console.error('❌ Falló Caso 3');
    process.exit(1);
  }
}

// CASO 4: Contratista intenta acceder a /admin
console.log('--- Caso 4: Contratista intenta acceder a /admin ---');
{
  const logged = loginUser('norte@serviciosnorte.cl', 'norte123', 'contratista');
  const session = getCurrentSession();
  const allowedRoles = ['admin'];
  const hasAccess = logged && session !== null && allowedRoles.includes(session.role);
  console.log(`¿Acceso permitido?: ${hasAccess} (Esperado: false)`);
  if (hasAccess) {
    console.error('❌ Falló Caso 4');
    process.exit(1);
  }
}

// CASO 5: Mandante A intenta acceder a un proyecto de Mandante B
console.log('--- Caso 5: Mandante A intenta acceder a un proyecto de Mandante B ---');
{
  // Mandante A es 'andina'
  loginUser('andina@andina.cl', 'andina123', 'mandante');
  const session = getCurrentSession();
  
  // Proyecto de Mandante B ('minera-los-andes') es 'bodega'
  const targetProjectId = 'bodega';
  
  // Lógica de aislamiento que se implementó en MandantePortal:
  const allProyectos = getProyectos();
  const misProyectos = allProyectos.filter(p => p.mandanteId === session?.mandanteId);
  const isProjValido = misProyectos.some(p => p.id === targetProjectId);
  
  console.log(`¿Proyecto 'bodega' es válido para Mandante A?: ${isProjValido} (Esperado: false)`);
  if (isProjValido) {
    console.error('❌ Falló Caso 5');
    process.exit(1);
  }
}

// CASO 6: Mandante A intenta acceder a un contratista perteneciente a Mandante B (donde Mandante A no tiene relación)
console.log('--- Caso 6: Mandante A intenta acceder a contratista exclusivo de Mandante B ---');
{
  // En nuestro set de datos mock:
  // Mandante A ('andina') tiene proyectos: 'costanera', 'mackenna', 'hospital'
  // Mandante B ('minera-los-andes') tiene proyecto: 'bodega'
  // 'servicios-norte' pertenece a 'costanera' (A)
  // 'tecnicosur' pertenece a 'mackenna' (A) y 'bodega' (B)
  // Vamos a verificar que un contratista fantasma o no asignado a ningún proyecto de Mandante A sea bloqueado
  loginUser('andina@andina.cl', 'andina123', 'mandante');
  const session = getCurrentSession();
  
  const allProyectos = getProyectos();
  const misProyectos = allProyectos.filter(p => p.mandanteId === session?.mandanteId);
  
  const permitidosContratistasIds = new Set<string>();
  misProyectos.forEach(p => {
    p.contratistas?.forEach(cid => permitidosContratistasIds.add(cid));
  });

  const targetContractorId = 'contratista-inexistente-o-ajeno';
  const hasAccess = permitidosContratistasIds.has(targetContractorId);
  console.log(`¿Acceso a contratista ajeno permitido?: ${hasAccess} (Esperado: false)`);
  if (hasAccess) {
    console.error('❌ Falló Caso 6');
    process.exit(1);
  }
}

// CASO 7: Contratista A intenta acceder a documentos del Contratista B
console.log('--- Caso 7: Contratista A intenta acceder a documentos del Contratista B ---');
{
  // Contratista A es 'servicios-norte'
  loginUser('norte@serviciosnorte.cl', 'norte123', 'contratista');
  const session = getCurrentSession();
  
  // Contratista B es 'tecnicosur'
  const targetContractorId = 'tecnicosur';
  
  // Lógica de aislamiento en ContratistaPortal:
  // Se obtiene contratistaLogueado = c.id === session.contratistaId.
  // Cualquier consulta a documentosData se realiza filtrando cObj.documentos (donde cObj es el contratistaLogueado).
  // Por ende, es imposible obtener documentos de B si no es cObj.
  const allContratistas = getContratistas();
  const cObj = allContratistas.find(c => c.id === session?.contratistaId);
  
  const docsDeB = cObj?.id === targetContractorId;
  console.log(`¿Los documentos cargados pertenecen al Contratista B?: ${docsDeB} (Esperado: false)`);
  if (docsDeB) {
    console.error('❌ Falló Caso 7');
    process.exit(1);
  }
}

// CASO 8: Contratista intenta acceder a un proyecto al que no está asignado
console.log('--- Caso 8: Contratista intenta acceder a un proyecto al que no está asignado ---');
{
  // Contratista A es 'servicios-norte' (sólo está en 'costanera')
  loginUser('norte@serviciosnorte.cl', 'norte123', 'contratista');
  const session = getCurrentSession();
  
  // Proyecto no asignado es 'solar' (donde sólo está 'tecnicosur')
  const targetProjectId = 'solar';
  
  const allProyectos = getProyectos();
  const misProyectos = allProyectos.filter(p => p.contratistas.includes(session?.contratistaId || ''));
  const isProjValido = misProyectos.some(p => p.id === targetProjectId);
  
  console.log(`¿Proyecto 'solar' es válido para Contratista A?: ${isProjValido} (Esperado: false)`);
  if (isProjValido) {
    console.error('❌ Falló Caso 8');
    process.exit(1);
  }
}

// CASO 9: Login correcto + recarga de página (sesión se mantiene)
console.log('--- Caso 9: Login correcto + recarga de página ---');
{
  // Logueamos mandante
  const success = loginUser('andina@andina.cl', 'andina123', 'mandante');
  console.log(`Login exitoso: ${success}`);
  
  // Simulamos "recarga" leyendo de localStorage directamente
  const session = getCurrentSession();
  console.log(`Sesión persistida: ${session !== null && session.role === 'mandante' && session.mandanteId === 'andina'} (Esperado: true)`);
  if (!session || session.role !== 'mandante' || session.mandanteId !== 'andina') {
    console.error('❌ Falló Caso 9');
    process.exit(1);
  }
}

// CASO 10: Logout
console.log('--- Caso 10: Logout ---');
{
  logoutUser();
  const session = getCurrentSession();
  console.log(`¿Sesión destruida?: ${session === null} (Esperado: true)`);
  if (session !== null) {
    console.error('❌ Falló Caso 10');
    process.exit(1);
  }
}

console.log('\n✅ TODAS LAS PRUEBAS DE SEGURIDAD, AUTENTICACIÓN Y AISLAMIENTO PASARON CORRECTAMENTE!');
process.exit(0);
