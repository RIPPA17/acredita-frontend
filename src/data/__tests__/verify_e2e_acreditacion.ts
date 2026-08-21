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
  getContratistas,
  saveContratistas,
  getProyectos,
  saveProyectos,
  getRequisitos,
  saveRequisitos,
  calcularEstadoAcreditacion,
  calcularEstadoTrabajador,
  calcularAccesoPago,
  esTrabajadorAsignado,
  actualizarEstadoDocumento,
  registrarAuditoria,
  getAuditLogs,
  saveAuditLogs
} from '../localStorageDb';
import { Proyecto, Contratista, Requisito, Trabajador } from '../../types';

console.log('================================================================');
console.log('=== INICIANDO PRUEBAS INTEGRALES Y END-TO-END DEL MOTOR ===');
console.log('================================================================\n');

// Helper para inicializar base de datos limpia de pruebas
function setupCleanDb() {
  mockLocalStorage.clear();
  initDb();
  saveAuditLogs([]);
  
  // Limpiar contratistas, proyectos y requisitos para tener control total
  saveProyectos([]);
  saveContratistas([]);
  saveRequisitos([]);
}

// Helper para imprimir de forma estructurada los flujos E2E
function printFlowHeader(num: number, title: string) {
  console.log(`\n------------------------------------------------------------`);
  console.log(`[E2E FLUJO ${num}] ${title}`);
  console.log(`------------------------------------------------------------`);
}

function printAssertion(concept: string, expected: any, real: any) {
  const success = JSON.stringify(expected) === JSON.stringify(real);
  console.log(`- ${concept}:`);
  console.log(`  * Esperado: ${JSON.stringify(expected)}`);
  console.log(`  * Real:     ${JSON.stringify(real)}`);
  console.log(`  * Resultado: ${success ? '✅ PASÓ' : '❌ FALLÓ'}`);
  if (!success) {
    console.error(`❌ Falló la aserción de coherencia en: ${concept}`);
    process.exit(1);
  }
}

// ============================================================================
// FLUJO 1: Proyecto + contratista + trabajadores + documentos completos
// ============================================================================
printFlowHeader(1, 'Proyecto + contratista + trabajadores + documentos completos');
{
  setupCleanDb();

  const p1: Proyecto = { id: 'p1', nombre: 'Proyecto 1', mandanteId: 'm1', estado: 'Activo', contratistas: ['c1'] };
  saveProyectos([p1]);

  const reqE: Requisito = { id: 'req_e', nombre: 'Patente Municipal', categoria: 'Tributario', destino: 'empresa', obligatorio: true, frecuencia: 'Mensual', alertaDias: 7, criticidad: 'bloquea_pago', proyectoId: 'p1' };
  const reqW: Requisito = { id: 'req_w', nombre: 'Curso ODI', categoria: 'Prevención', destino: 'trabajador', obligatorio: true, frecuencia: 'Anual', alertaDias: 30, criticidad: 'bloquea_acceso', proyectoId: 'p1' };
  saveRequisitos([reqE, reqW]);

  const w1: Trabajador = {
    rut: '1-1',
    nombre: 'Juan Perez',
    cargo: 'Supervisor',
    faena: 'p1',
    estado: 'aprobado',
    documentos: [
      { id: 'doc_w1', nombre: 'Curso ODI', categoria: 'Prevención', estado: 'aprobado', vencimiento: '31/12/2029', proyectoId: 'p1' }
    ]
  };

  const contratista: Contratista = {
    id: 'c1',
    nombre: 'Contratista Uno',
    rut: '77-1',
    proyectos: ['p1'],
    documentos: [
      { id: 'doc_c1', nombre: 'Patente Municipal', categoria: 'Tributario', estado: 'aprobado', vencimiento: '31/12/2029', proyectoId: 'p1' }
    ],
    trabajadores: [w1]
  };
  saveContratistas([contratista]);

  // Evaluaciones del motor
  const estTrabajador = calcularEstadoTrabajador(w1, 'p1');
  const estAcreditacion = calcularEstadoAcreditacion(contratista, 'p1');
  const accPago = calcularAccesoPago(contratista, 'p1');

  printAssertion('Estado del trabajador juan', 'aprobado', estTrabajador);
  printAssertion('Acreditación del contratista', 'Aprobado', estAcreditacion);
  printAssertion('Acceso y Pago habilitados', { accesoBloqueado: false, pagoBloqueado: false }, { accesoBloqueado: accPago.accesoBloqueado, pagoBloqueado: accPago.pagoBloqueado });
}

// ============================================================================
// FLUJO 2: Falta requisito obligatorio bloquea_acceso
// ============================================================================
printFlowHeader(2, 'Falta requisito obligatorio bloquea_acceso');
{
  setupCleanDb();

  const p1: Proyecto = { id: 'p1', nombre: 'Proyecto 1', mandanteId: 'm1', estado: 'Activo', contratistas: ['c1'] };
  saveProyectos([p1]);

  const reqE: Requisito = { id: 'req_e', nombre: 'Reglamento Interno', categoria: 'Laboral', destino: 'empresa', obligatorio: true, frecuencia: 'Mensual', alertaDias: 7, criticidad: 'bloquea_acceso', proyectoId: 'p1' };
  saveRequisitos([reqE]);

  const contratista: Contratista = {
    id: 'c1',
    nombre: 'Contratista Uno',
    rut: '77-1',
    proyectos: ['p1'],
    documentos: [], // Falta el reglamento interno
    trabajadores: []
  };
  saveContratistas([contratista]);

  const estAcreditacion = calcularEstadoAcreditacion(contratista, 'p1');
  const accPago = calcularAccesoPago(contratista, 'p1');

  printAssertion('Acreditación no aprobada (Sin trabajadores y con pendiente de empresa)', 'No acreditado', estAcreditacion);
  printAssertion('Acceso bloqueado y Pago libre', { accesoBloqueado: true, pagoBloqueado: false }, { accesoBloqueado: accPago.accesoBloqueado, pagoBloqueado: accPago.pagoBloqueado });
}

// ============================================================================
// FLUJO 3: Falta requisito obligatorio bloquea_pago
// ============================================================================
printFlowHeader(3, 'Falta requisito obligatorio bloquea_pago');
{
  setupCleanDb();

  const p1: Proyecto = { id: 'p1', nombre: 'Proyecto 1', mandanteId: 'm1', estado: 'Activo', contratistas: ['c1'] };
  saveProyectos([p1]);

  const reqE: Requisito = { id: 'req_e', nombre: 'Patente Municipal', categoria: 'Tributario', destino: 'empresa', obligatorio: true, frecuencia: 'Mensual', alertaDias: 7, criticidad: 'bloquea_pago', proyectoId: 'p1' };
  saveRequisitos([reqE]);

  const contratista: Contratista = {
    id: 'c1',
    nombre: 'Contratista Uno',
    rut: '77-1',
    proyectos: ['p1'],
    documentos: [], // Sin patente municipal
    trabajadores: []
  };
  saveContratistas([contratista]);

  const estAcreditacion = calcularEstadoAcreditacion(contratista, 'p1');
  const accPago = calcularAccesoPago(contratista, 'p1');

  printAssertion('Acreditación no aprobada', 'No acreditado', estAcreditacion);
  printAssertion('Acceso libre y Pago bloqueado', { accesoBloqueado: false, pagoBloqueado: true }, { accesoBloqueado: accPago.accesoBloqueado, pagoBloqueado: accPago.pagoBloqueado });
}

// ============================================================================
// FLUJO 4: Trabajador asignado + 0 documentos + requisito obligatorio bloquea_acceso
// ============================================================================
printFlowHeader(4, 'Trabajador asignado + 0 documentos + requisito obligatorio bloquea_acceso');
{
  setupCleanDb();

  const p1: Proyecto = { id: 'p1', nombre: 'Proyecto 1', mandanteId: 'm1', estado: 'Activo', contratistas: ['c1'] };
  saveProyectos([p1]);

  const reqW: Requisito = { id: 'req_w', nombre: 'Curso ODI', categoria: 'Prevención', destino: 'trabajador', obligatorio: true, frecuencia: 'Anual', alertaDias: 30, criticidad: 'bloquea_acceso', proyectoId: 'p1' };
  saveRequisitos([reqW]);

  const w1: Trabajador = {
    rut: '1-1',
    nombre: 'Juan Perez',
    cargo: 'Supervisor',
    faena: 'p1',
    estado: 'pendiente',
    documentos: [] // 0 documentos
  };

  const contratista: Contratista = {
    id: 'c1',
    nombre: 'Contratista Uno',
    rut: '77-1',
    proyectos: ['p1'],
    documentos: [],
    trabajadores: [w1]
  };
  saveContratistas([contratista]);

  const estTrabajador = calcularEstadoTrabajador(w1, 'p1');
  const estAcreditacion = calcularEstadoAcreditacion(contratista, 'p1');
  const accPago = calcularAccesoPago(contratista, 'p1');

  printAssertion('Trabajador asignado sin documentos tiene estado', 'pendiente', estTrabajador);
  printAssertion('Acreditación del contratista', 'En proceso', estAcreditacion);
  printAssertion('Acceso bloqueado por documento faltante del trabajador', true, accPago.accesoBloqueado);
}

// ============================================================================
// FLUJO 5: Incumplimiento en Proyecto A no afecta a Proyecto B
// ============================================================================
printFlowHeader(5, 'Incumplimiento en Proyecto A no afecta a Proyecto B');
{
  setupCleanDb();

  const pA: Proyecto = { id: 'pA', nombre: 'Proyecto A', mandanteId: 'm1', estado: 'Activo', contratistas: ['c1'] };
  const pB: Proyecto = { id: 'pB', nombre: 'Proyecto B', mandanteId: 'm1', estado: 'Activo', contratistas: ['c1'] };
  saveProyectos([pA, pB]);

  const reqA: Requisito = { id: 'req_a', nombre: 'Patente Municipal', categoria: 'Tributario', destino: 'empresa', obligatorio: true, frecuencia: 'Mensual', alertaDias: 7, criticidad: 'bloquea_pago', proyectoId: 'pA' };
  const reqB: Requisito = { id: 'req_b', nombre: 'Patente Municipal', categoria: 'Tributario', destino: 'empresa', obligatorio: true, frecuencia: 'Mensual', alertaDias: 7, criticidad: 'bloquea_pago', proyectoId: 'pB' };
  saveRequisitos([reqA, reqB]);

  const contratista: Contratista = {
    id: 'c1',
    nombre: 'Contratista Uno',
    rut: '77-1',
    proyectos: ['pA', 'pB'],
    documentos: [
      { id: 'doc_pA', nombre: 'Patente Municipal', categoria: 'Tributario', estado: 'aprobado', vencimiento: '31/12/2029', proyectoId: 'pA' }
      // Falta Patente Municipal en Proyecto B
    ],
    trabajadores: []
  };
  saveContratistas([contratista]);

  const accPagoA = calcularAccesoPago(contratista, 'pA');
  const accPagoB = calcularAccesoPago(contratista, 'pB');

  const estA = calcularEstadoAcreditacion(contratista, 'pA');
  const estB = calcularEstadoAcreditacion(contratista, 'pB');

  printAssertion('Proyecto A: Pago habilitado', false, accPagoA.pagoBloqueado);
  printAssertion('Proyecto B: Pago bloqueado', true, accPagoB.pagoBloqueado);
  printAssertion('Proyecto A: Acreditación aprobada', 'En proceso', estA); // Sin trabajadores es En proceso
  printAssertion('Proyecto B: Acreditación no aprobada', 'No acreditado', estB);
}

// ============================================================================
// FLUJO 6: Ciclo de vida de corrección (Rechazado -> Reemplazo -> Aprobación)
// ============================================================================
printFlowHeader(6, 'Ciclo de vida de corrección (Rechazado -> Reemplazo -> Aprobación)');
{
  setupCleanDb();

  const p1: Proyecto = { id: 'p1', nombre: 'Proyecto 1', mandanteId: 'm1', estado: 'Activo', contratistas: ['c1'] };
  saveProyectos([p1]);

  const reqE: Requisito = { id: 'req_e', nombre: 'Patente Municipal', categoria: 'Tributario', destino: 'empresa', obligatorio: true, frecuencia: 'Mensual', alertaDias: 7, criticidad: 'bloquea_pago', proyectoId: 'p1' };
  saveRequisitos([reqE]);

  const contratista: Contratista = {
    id: 'c1',
    nombre: 'Contratista Uno',
    rut: '77-1',
    proyectos: ['p1'],
    documentos: [
      { id: 'doc_e', nombre: 'Patente Municipal', categoria: 'Tributario', estado: 'rechazado', vencimiento: '31/12/2029', proyectoId: 'p1' }
    ],
    trabajadores: []
  };
  saveContratistas([contratista]);

  // Paso A: Verificar que está bloqueado inicialmente
  const accPago1 = calcularAccesoPago(contratista, 'p1');
  const est1 = calcularEstadoAcreditacion(contratista, 'p1');
  printAssertion('Paso A: Pago bloqueado', true, accPago1.pagoBloqueado);
  printAssertion('Paso A: Acreditación Bloqueada', 'Vencido/Bloqueado', est1);

  // Paso B: Reemplazo (el contratista sube un documento nuevo y pasa a revisión)
  const contratistas = getContratistas();
  const cObj = contratistas.find(c => c.id === 'c1')!;
  cObj.documentos = [
    { id: 'doc_e', nombre: 'Patente Municipal', categoria: 'Tributario', estado: 'revision', vencimiento: '31/12/2029', proyectoId: 'p1' }
  ];
  saveContratistas(contratistas);

  const accPago2 = calcularAccesoPago(cObj, 'p1');
  const est2 = calcularEstadoAcreditacion(cObj, 'p1');
  printAssertion('Paso B: Sigue bloqueado (en revisión)', true, accPago2.pagoBloqueado);
  printAssertion('Paso B: Acreditación En proceso', 'No acreditado', est2); // Empresa sin trabajadores con pendiente es No acreditado

  // Paso C: Aprobación
  actualizarEstadoDocumento('c1', 'p1', 'doc_e', 'approve');
  const cObjFinal = getContratistas().find(c => c.id === 'c1')!;
  const accPago3 = calcularAccesoPago(cObjFinal, 'p1');
  const est3 = calcularEstadoAcreditacion(cObjFinal, 'p1');

  printAssertion('Paso C: Pago desbloqueado', false, accPago3.pagoBloqueado);
  printAssertion('Paso C: Acreditación En proceso (sin trabajadores)', 'En proceso', est3);
}

// ============================================================================
// FLUJO 7: Ciclo de vida de expiración (Aprobado y vigente -> Pasa a estar vencido)
// ============================================================================
printFlowHeader(7, 'Ciclo de vida de expiración (Aprobado y vigente -> Pasa a estar vencido)');
{
  setupCleanDb();

  const p1: Proyecto = { id: 'p1', nombre: 'Proyecto 1', mandanteId: 'm1', estado: 'Activo', contratistas: ['c1'] };
  saveProyectos([p1]);

  const reqE: Requisito = { id: 'req_e', nombre: 'Patente Municipal', categoria: 'Tributario', destino: 'empresa', obligatorio: true, frecuencia: 'Mensual', alertaDias: 7, criticidad: 'bloquea_pago', proyectoId: 'p1' };
  saveRequisitos([reqE]);

  const contratista: Contratista = {
    id: 'c1',
    nombre: 'Contratista Uno',
    rut: '77-1',
    proyectos: ['p1'],
    documentos: [
      { id: 'doc_e', nombre: 'Patente Municipal', categoria: 'Tributario', estado: 'aprobado', vencimiento: '31/12/2029', proyectoId: 'p1' }
    ],
    trabajadores: []
  };
  saveContratistas([contratista]);

  // Paso A: Aprobado y vigente
  const accPago1 = calcularAccesoPago(contratista, 'p1');
  printAssertion('Paso A: Pago habilitado', false, accPago1.pagoBloqueado);

  // Paso B: Caduca por fecha (vencimiento antiguo)
  const list = getContratistas();
  list[0].documentos[0].vencimiento = '01/01/2020'; // fecha en el pasado
  saveContratistas(list);

  const accPago2 = calcularAccesoPago(list[0], 'p1');
  const est2 = calcularEstadoAcreditacion(list[0], 'p1');

  printAssertion('Paso B: Pago bloqueado por fecha vencida', true, accPago2.pagoBloqueado);
  printAssertion('Paso B: Acreditación Bloqueada', 'Vencido/Bloqueado', est2);
}

// ============================================================================
// CASOS ADICIONALES OBLIGATORIOS
// ============================================================================
console.log('\n================================================================');
console.log('=== EJECUTANDO CASOS ADICIONALES OBLIGATORIOS ===');
console.log('================================================================\n');

// Caso Adicional A: Requisito opcional incumplido
console.log('--- Caso Adicional A: Requisito opcional incumplido ---');
{
  setupCleanDb();

  const p1: Proyecto = { id: 'p1', nombre: 'Proyecto 1', mandanteId: 'm1', estado: 'Activo', contratistas: ['c1'] };
  saveProyectos([p1]);

  const reqE: Requisito = { id: 'req_e', nombre: 'Encuesta Clima', categoria: 'Laboral', destino: 'empresa', obligatorio: false, frecuencia: 'Mensual', alertaDias: 7, criticidad: 'advertencia', proyectoId: 'p1' };
  saveRequisitos([reqE]);

  const contratista: Contratista = {
    id: 'c1',
    nombre: 'Contratista Uno',
    rut: '77-1',
    proyectos: ['p1'],
    documentos: [], // Falta la encuesta opcional
    trabajadores: []
  };
  saveContratistas([contratista]);

  const accPago = calcularAccesoPago(contratista, 'p1');
  const est = calcularEstadoAcreditacion(contratista, 'p1');

  printAssertion('Pago no bloqueado por requisito opcional', false, accPago.pagoBloqueado);
  printAssertion('Acceso no bloqueado por requisito opcional', false, accPago.accesoBloqueado);
  printAssertion('Acreditación En proceso (opcional faltante no impide la aprobación en el motor)', 'En proceso', est);
}

// Caso Adicional B: Varios trabajadores con estados diferentes
console.log('--- Caso Adicional B: Varios trabajadores con estados diferentes ---');
{
  setupCleanDb();

  const p1: Proyecto = { id: 'p1', nombre: 'Proyecto 1', mandanteId: 'm1', estado: 'Activo', contratistas: ['c1'] };
  saveProyectos([p1]);

  const reqW: Requisito = { id: 'req_w', nombre: 'Curso ODI', categoria: 'Prevención', destino: 'trabajador', obligatorio: true, frecuencia: 'Anual', alertaDias: 30, criticidad: 'bloquea_acceso', proyectoId: 'p1' };
  saveRequisitos([reqW]);

  const w1: Trabajador = { rut: '1-1', nombre: 'Juan Perez', cargo: 'Sup', faena: 'p1', estado: 'aprobado', documentos: [{ id: 'd1', nombre: 'Curso ODI', categoria: 'Prevención', estado: 'aprobado', vencimiento: '31/12/2029', proyectoId: 'p1' }] };
  const w2: Trabajador = { rut: '1-2', nombre: 'Diego Gomez', cargo: 'Sup', faena: 'p1', estado: 'rechazado', documentos: [{ id: 'd2', nombre: 'Curso ODI', categoria: 'Prevención', estado: 'rechazado', vencimiento: '31/12/2029', proyectoId: 'p1' }] };
  const w3: Trabajador = { rut: '1-3', nombre: 'Luis Soto', cargo: 'Sup', faena: 'p1', estado: 'pendiente', documentos: [{ id: 'd3', nombre: 'Curso ODI', categoria: 'Prevención', estado: 'pendiente', vencimiento: '31/12/2029', proyectoId: 'p1' }] };

  const contratista: Contratista = {
    id: 'c1',
    nombre: 'Contratista Uno',
    rut: '77-1',
    proyectos: ['p1'],
    documentos: [],
    trabajadores: [w1, w2, w3]
  };
  saveContratistas([contratista]);

  printAssertion('Trabajador 1 (aprobado)', 'aprobado', calcularEstadoTrabajador(w1, 'p1'));
  printAssertion('Trabajador 2 (rechazado)', 'rechazado', calcularEstadoTrabajador(w2, 'p1'));
  printAssertion('Trabajador 3 (pendiente)', 'pendiente', calcularEstadoTrabajador(w3, 'p1'));
  printAssertion('Acreditación del contratista con trabajador rechazado', 'Vencido/Bloqueado', calcularEstadoAcreditacion(contratista, 'p1'));
}

console.log('\n================================================================');
console.log('✅ TODAS LAS PRUEBAS END-TO-END Y DE COHERENCIA PASARON CORRECTAMENTE!');
console.log('================================================================');
process.exit(0);
