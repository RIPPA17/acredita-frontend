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
  logoutUser,
  crearInvitacion,
  aceptarInvitacion,
  getAuditLogs,
  saveAuditLogs,
  registrarAuditoria,
  consultarAuditoria,
  getContratistas,
  actualizarEstadoDocumento
} from '../localStorageDb';
import { AuditLog } from '../localStorageDb';

console.log('=== INICIANDO VALIDACIÓN DE TRAZABILIDAD Y AUDITORÍA DE ACCIONES ===\n');

// CASO 1: Login exitoso genera auditoría
console.log('--- Caso 1: Login exitoso genera auditoría ---');
{
  mockLocalStorage.clear();
  initDb();
  saveAuditLogs([]);

  const logged = loginUser('andina@andina.cl', 'andina123', 'mandante');
  console.log(`Login exitoso: ${logged} (Esperado: true)`);
  
  const logs = getAuditLogs();
  console.log(`Logs registrados: ${logs.length} (Esperado: 1)`);
  const log = logs[0];
  console.log(`Acción: ${log?.accion} (Esperado: 'login_exitoso')`);
  console.log(`UsuarioId: ${log?.usuarioId} (Esperado: 'andina@andina.cl')`);
  console.log(`Rol: ${log?.rol} (Esperado: 'mandante')`);

  if (!logged || logs.length !== 1 || log?.accion !== 'login_exitoso' || log?.usuarioId !== 'andina@andina.cl' || log?.rol !== 'mandante') {
    console.error('❌ Falló Caso 1');
    process.exit(1);
  }
}

// CASO 2: Crear invitación genera auditoría con usuarioId, proyectoId, acción
console.log('--- Caso 2: Crear invitación genera auditoría ---');
{
  mockLocalStorage.clear();
  initDb();
  saveAuditLogs([]);

  const res = crearInvitacion('andina', 'costanera', 'tecnicosur', 'tecnico@tecnicosur.cl', 'Mensaje');
  console.log(`Invitación creada: ${res.success} (Esperado: true)`);
  
  const logs = getAuditLogs();
  console.log(`Logs registrados: ${logs.length} (Esperado: 1)`);
  const log = logs[0];
  console.log(`Acción: ${log?.accion} (Esperado: 'creacion_invitacion')`);
  console.log(`ProyectoId: ${log?.proyectoId} (Esperado: 'costanera')`);
  console.log(`ContratistaId: ${log?.contratistaId} (Esperado: 'tecnicosur')`);
  console.log(`UsuarioId: ${log?.usuarioId} (Esperado: 'andina')`);

  if (!res.success || logs.length !== 1 || log?.accion !== 'creacion_invitacion' || log?.proyectoId !== 'costanera' || log?.contratistaId !== 'tecnicosur' || log?.usuarioId !== 'andina') {
    console.error('❌ Falló Caso 2');
    process.exit(1);
  }
}

// CASO 3: Aceptar invitación genera auditoría
console.log('--- Caso 3: Aceptar invitación genera auditoría ---');
{
  mockLocalStorage.clear();
  initDb();
  saveAuditLogs([]);

  const createRes = crearInvitacion('andina', 'costanera', 'tecnicosur', 'tecnico@tecnicosur.cl', 'Mensaje');
  const invId = createRes.invitacion!.id;
  
  // Limpiar el log de la creación para aislar el test de aceptación
  saveAuditLogs([]);

  const acceptRes = aceptarInvitacion(invId, 'tecnicosur');
  console.log(`Aceptación exitosa: ${acceptRes.success} (Esperado: true)`);

  const logs = getAuditLogs();
  const log = logs.find(l => l.accion === 'aceptacion_invitacion');
  console.log(`Aceptación registrada: ${!!log} (Esperado: true)`);
  console.log(`Estado Anterior: ${log?.estadoAnterior} (Esperado: 'pendiente')`);
  console.log(`Estado Nuevo: ${log?.estadoNuevo} (Esperado: 'aceptada')`);

  if (!acceptRes.success || !log || log.estadoAnterior !== 'pendiente' || log.estadoNuevo !== 'aceptada') {
    console.error('❌ Falló Caso 3');
    process.exit(1);
  }
}

// CASO 4: Aprobar documento genera estadoAnterior y estadoNuevo correctos
console.log('--- Caso 4: Aprobar documento ---');
{
  mockLocalStorage.clear();
  initDb();
  saveAuditLogs([]);

  loginUser('admin@acredita.cl', 'admin123', 'admin');

  const contratistas = getContratistas();
  const c = contratistas.find(co => co.id === 'servicios-norte')!;
  const doc = c.documentos[0];
  const oldState = doc.estado;
  const docId = doc.id;

  const res = actualizarEstadoDocumento('servicios-norte', 'costanera', docId, 'approve');
  console.log(`Documento aprobado exitosamente: ${res.success} (Esperado: true)`);

  const logs = getAuditLogs().filter(l => l.accion === 'aprobacion_documento');
  console.log(`Logs registrados: ${logs.length} (Esperado: 1)`);
  const log = logs[0];
  console.log(`Acción: ${log?.accion} (Esperado: 'aprobacion_documento')`);
  console.log(`Estado Anterior: ${log?.estadoAnterior} (Esperado: '${oldState}')`);
  console.log(`Estado Nuevo: ${log?.estadoNuevo} (Esperado: 'aprobado')`);

  if (!res.success || logs.length !== 1 || log?.estadoAnterior !== oldState || log?.estadoNuevo !== 'aprobado') {
    console.error('❌ Falló Caso 4');
    process.exit(1);
  }
}

// CASO 5: Rechazar documento genera estadoAnterior y estadoNuevo correctos
console.log('--- Caso 5: Rechazar documento ---');
{
  mockLocalStorage.clear();
  initDb();
  saveAuditLogs([]);

  loginUser('admin@acredita.cl', 'admin123', 'admin');

  const contratistas = getContratistas();
  const c = contratistas.find(co => co.id === 'servicios-norte')!;
  const doc = c.documentos[0];
  const oldState = doc.estado;
  const docId = doc.id;

  const res = actualizarEstadoDocumento('servicios-norte', 'costanera', docId, 'reject', {
    motivoRechazo: 'No legible',
    explicacionRechazo: 'El documento no se lee bien',
    solucionRechazo: 'Subir escaneo de alta resolución'
  });
  console.log(`Documento rechazado exitosamente: ${res.success} (Esperado: true)`);

  const logs = getAuditLogs().filter(l => l.accion === 'rechazo_documento');
  console.log(`Logs registrados: ${logs.length} (Esperado: 1)`);
  const log = logs[0];
  console.log(`Acción: ${log?.accion} (Esperado: 'rechazo_documento')`);
  console.log(`Estado Anterior: ${log?.estadoAnterior} (Esperado: '${oldState}')`);
  console.log(`Estado Nuevo: ${log?.estadoNuevo} (Esperado: 'rechazado')`);

  if (!res.success || logs.length !== 1 || log?.estadoAnterior !== oldState || log?.estadoNuevo !== 'rechazado') {
    console.error('❌ Falló Caso 5');
    process.exit(1);
  }
}

// CASO 6: Una acción de un proyecto guarda correctamente proyectoId
console.log('--- Caso 6: Acción con proyectoId ---');
{
  mockLocalStorage.clear();
  initDb();
  saveAuditLogs([]);

  crearInvitacion('andina', 'costanera', 'tecnicosur', 'tecnico@tecnicosur.cl', 'Mensaje');
  const logs = getAuditLogs();
  const log = logs[0];
  console.log(`ProyectoId guardado: ${log?.proyectoId} (Esperado: 'costanera')`);
  if (log?.proyectoId !== 'costanera') {
    console.error('❌ Falló Caso 6');
    process.exit(1);
  }
}

// CASO 7: Mandante A no puede consultar auditoría de Mandante B
console.log('--- Caso 7: Mandante A no puede consultar auditoría de Mandante B ---');
{
  mockLocalStorage.clear();
  initDb();
  saveAuditLogs([]);

  // Acción de Mandante A ('andina' en 'costanera')
  registrarAuditoria({
    usuarioId: 'andina@andina.cl',
    rol: 'mandante',
    proyectoId: 'costanera',
    accion: 'creacion_invitacion',
    entidad: 'invitacion',
    entidadId: 'inv_1'
  });

  // Acción de Mandante B ('andes@andes.cl' en 'bodega' con 'minera-los-andes')
  registrarAuditoria({
    usuarioId: 'andes@andes.cl',
    rol: 'mandante',
    proyectoId: 'bodega',
    accion: 'creacion_invitacion',
    entidad: 'invitacion',
    entidadId: 'inv_2'
  });

  const sessionMandanteA = { email: 'andina@andina.cl', role: 'mandante', mandanteId: 'andina' };
  const visibleLogs = consultarAuditoria(sessionMandanteA);
  
  console.log(`Logs visibles para Mandante A: ${visibleLogs.length} (Esperado: 1)`);
  const containsOther = visibleLogs.some(l => l.proyectoId === 'bodega');
  console.log(`¿Contiene proyectos ajenos?: ${containsOther} (Esperado: false)`);
  
  if (visibleLogs.length !== 1 || containsOther) {
    console.error('❌ Falló Caso 7');
    process.exit(1);
  }
}

// CASO 8: Contratista A no puede consultar auditoría de Contratista B
console.log('--- Caso 8: Contratista A no puede consultar auditoría de Contratista B ---');
{
  mockLocalStorage.clear();
  initDb();
  saveAuditLogs([]);

  // Acción del Contratista A ('tecnicosur')
  registrarAuditoria({
    usuarioId: 'tecnico@tecnicosur.cl',
    rol: 'contratista',
    contratistaId: 'tecnicosur',
    accion: 'carga_documento',
    entidad: 'documento',
    entidadId: 'doc_1'
  });

  // Acción del Contratista B ('servicios-norte')
  registrarAuditoria({
    usuarioId: 'norte@serviciosnorte.cl',
    rol: 'contratista',
    contratistaId: 'servicios-norte',
    accion: 'carga_documento',
    entidad: 'documento',
    entidadId: 'doc_2'
  });

  const sessionContratistaA = { email: 'tecnico@tecnicosur.cl', role: 'contratista', contratistaId: 'tecnicosur' };
  const visibleLogs = consultarAuditoria(sessionContratistaA);

  console.log(`Logs visibles para Contratista A: ${visibleLogs.length} (Esperado: 1)`);
  const containsOther = visibleLogs.some(l => l.contratistaId === 'servicios-norte');
  console.log(`¿Contiene contratistas ajenos?: ${containsOther} (Esperado: false)`);

  if (visibleLogs.length !== 1 || containsOther) {
    console.error('❌ Falló Caso 8');
    process.exit(1);
  }
}

// CASO 9: Admin puede consultar toda la auditoría
console.log('--- Caso 9: Admin puede consultar toda la auditoría ---');
{
  mockLocalStorage.clear();
  initDb();
  saveAuditLogs([]);

  registrarAuditoria({ usuarioId: 'andina@andina.cl', rol: 'mandante', accion: 'test', entidad: 'e', entidadId: '1' });
  registrarAuditoria({ usuarioId: 'tecnico@tecnicosur.cl', rol: 'contratista', accion: 'test', entidad: 'e', entidadId: '2' });

  const sessionAdmin = { email: 'admin@acredita.cl', role: 'admin' };
  const visibleLogs = consultarAuditoria(sessionAdmin);
  
  console.log(`Logs visibles para Admin: ${visibleLogs.length} (Esperado: 2)`);
  if (visibleLogs.length !== 2) {
    console.error('❌ Falló Caso 9');
    process.exit(1);
  }
}

// CASO 10: Cerrar sesión genera auditoría antes de destruir la sesión
console.log('--- Caso 10: Cerrar sesión genera auditoría ---');
{
  mockLocalStorage.clear();
  initDb();
  saveAuditLogs([]);

  // Login de prueba
  loginUser('andina@andina.cl', 'andina123', 'mandante');
  saveAuditLogs([]); // Limpiamos el de login

  logoutUser();
  const logs = getAuditLogs();
  console.log(`Logs registrados: ${logs.length} (Esperado: 1)`);
  const log = logs[0];
  console.log(`Acción de logout: ${log?.accion} (Esperado: 'logout')`);
  console.log(`UsuarioId: ${log?.usuarioId} (Esperado: 'andina@andina.cl')`);

  if (logs.length !== 1 || log?.accion !== 'logout' || log?.usuarioId !== 'andina@andina.cl') {
    console.error('❌ Falló Caso 10');
    process.exit(1);
  }
}

// CASO 11: Los registros históricos permanecen intactos después de nuevos cambios
console.log('--- Caso 11: Registros históricos permanecen intactos ---');
{
  mockLocalStorage.clear();
  initDb();
  saveAuditLogs([]);

  registrarAuditoria({
    usuarioId: 'andina@andina.cl',
    rol: 'mandante',
    accion: 'creacion_invitacion',
    entidad: 'invitacion',
    entidadId: 'inv_old',
    detalle: 'Mensaje antiguo'
  });

  const logsBefore = getAuditLogs();
  console.log(`Historial antes: ${logsBefore[0].detalle}`);

  // Hacemos una nueva acción que muta otra cosa
  registrarAuditoria({
    usuarioId: 'admin@acredita.cl',
    rol: 'admin',
    accion: 'aprobacion_documento',
    entidad: 'documento',
    entidadId: 'doc_new',
    detalle: 'Mensaje nuevo'
  });

  const logsAfter = getAuditLogs();
  console.log(`Historial después - Primer Log: ${logsAfter[0].detalle} (Esperado: 'Mensaje antiguo')`);
  console.log(`Historial después - Segundo Log: ${logsAfter[1].detalle} (Esperado: 'Mensaje nuevo')`);

  if (logsAfter[0].detalle !== 'Mensaje antiguo' || logsAfter[1].detalle !== 'Mensaje nuevo') {
    console.error('❌ Falló Caso 11');
    process.exit(1);
  }
}

// CASO 12: No existen registros de auditoría con usuarioId o accion inválidos
console.log('--- Caso 12: No existen registros inválidos ---');
{
  const logs = getAuditLogs();
  const invalid = logs.some(l => !l.usuarioId || !l.accion);
  console.log(`¿Existen logs inválidos?: ${invalid} (Esperado: false)`);
  if (invalid) {
    console.error('❌ Falló Caso 12');
    process.exit(1);
  }
}

console.log('\n✅ TODAS LAS PRUEBAS DE TRAZABILIDAD Y AUDITORÍA PASARON CORRECTAMENTE!');
process.exit(0);
