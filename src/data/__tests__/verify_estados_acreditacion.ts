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
  saveAuditLogs
} from '../localStorageDb';
import { Proyecto, Contratista, Requisito, Trabajador } from '../../types';

console.log('================================================================');
console.log('=== VALIDACIÓN DE ESTADOS DE ACREDITACIÓN Y PRECEDENCIA ===');
console.log('================================================================\n');

function setupCleanDb() {
  mockLocalStorage.clear();
  initDb();
  saveAuditLogs([]);
  saveProyectos([]);
  saveContratistas([]);
  saveRequisitos([]);
}

function printAssertion(concept: string, expected: any, real: any) {
  const success = JSON.stringify(expected) === JSON.stringify(real);
  console.log(`- ${concept}:`);
  console.log(`  * Esperado: ${JSON.stringify(expected)}`);
  console.log(`  * Real:     ${JSON.stringify(real)}`);
  console.log(`  * Resultado: ${success ? '✅ PASÓ' : '❌ FALLÓ'}`);
  if (!success) {
    console.error(`❌ Falló la validación del estado en: ${concept}`);
    process.exit(1);
  }
}

// ----------------------------------------------------------------------------
// CASO 1: Todos los requisitos cumplidos -> Aprobado
// ----------------------------------------------------------------------------
console.log('\n--- CASO 1: Todos los requisitos cumplidos -> Aprobado ---');
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

  printAssertion('Acreditación del contratista', 'Aprobado', calcularEstadoAcreditacion(contratista, 'p1'));
}

// ----------------------------------------------------------------------------
// CASO 2: Requisito obligatorio pendiente/revisión
// ----------------------------------------------------------------------------
console.log('\n--- CASO 2: Requisito obligatorio pendiente/revisión ---');
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
      { id: 'doc_c1', nombre: 'Patente Municipal', categoria: 'Tributario', estado: 'revision', vencimiento: '31/12/2029', proyectoId: 'p1' }
    ],
    trabajadores: []
  };
  saveContratistas([contratista]);

  printAssertion('Acreditación del contratista sin trabajadores con empresa pendiente', 'No acreditado', calcularEstadoAcreditacion(contratista, 'p1'));
}

// ----------------------------------------------------------------------------
// CASO 3: Requisito obligatorio rechazado
// ----------------------------------------------------------------------------
console.log('\n--- CASO 3: Requisito obligatorio rechazado ---');
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
      { id: 'doc_c1', nombre: 'Patente Municipal', categoria: 'Tributario', estado: 'rechazado', vencimiento: '31/12/2029', proyectoId: 'p1' }
    ],
    trabajadores: []
  };
  saveContratistas([contratista]);

  printAssertion('Acreditación con documento rechazado', 'Vencido/Bloqueado', calcularEstadoAcreditacion(contratista, 'p1'));
}

// ----------------------------------------------------------------------------
// CASO 4: Requisito obligatorio vencido
// ----------------------------------------------------------------------------
console.log('\n--- CASO 4: Requisito obligatorio vencido ---');
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
      { id: 'doc_c1', nombre: 'Patente Municipal', categoria: 'Tributario', estado: 'aprobado', vencimiento: '01/01/2020', proyectoId: 'p1' } // fecha vencida
    ],
    trabajadores: []
  };
  saveContratistas([contratista]);

  printAssertion('Acreditación con documento vencido', 'Vencido/Bloqueado', calcularEstadoAcreditacion(contratista, 'p1'));
}

// ----------------------------------------------------------------------------
// CASO 5: Trabajador asignado sin documentos
// ----------------------------------------------------------------------------
console.log('\n--- CASO 5: Trabajador asignado sin documentos ---');
{
  setupCleanDb();

  const p1: Proyecto = { id: 'p1', nombre: 'Proyecto 1', mandanteId: 'm1', estado: 'Activo', contratistas: ['c1'] };
  saveProyectos([p1]);

  const reqE: Requisito = { id: 'req_e', nombre: 'Patente Municipal', categoria: 'Tributario', destino: 'empresa', obligatorio: true, frecuencia: 'Mensual', alertaDias: 7, criticidad: 'bloquea_pago', proyectoId: 'p1' };
  const reqW: Requisito = { id: 'req_w', nombre: 'Curso ODI', categoria: 'Prevención', destino: 'trabajador', obligatorio: true, frecuencia: 'Anual', alertaDias: 30, criticidad: 'bloquea_acceso', proyectoId: 'p1' };
  saveRequisitos([reqE, reqW]);

  const w1: Trabajador = { rut: '1-1', nombre: 'Juan Perez', cargo: 'Sup', faena: 'p1', estado: 'pendiente', documentos: [] };

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

  printAssertion('Estado del trabajador sin documentos', 'pendiente', calcularEstadoTrabajador(w1, 'p1'));
  printAssertion('Acreditación del contratista con trabajador sin documentos', 'En proceso', calcularEstadoAcreditacion(contratista, 'p1'));
}

// ----------------------------------------------------------------------------
// CASO 6: Trabajador no asignado con documentos incumplidos
// ----------------------------------------------------------------------------
console.log('\n--- CASO 6: Trabajador no asignado con documentos incumplidos ---');
{
  setupCleanDb();

  const p1: Proyecto = { id: 'p1', nombre: 'Proyecto 1', mandanteId: 'm1', estado: 'Activo', contratistas: ['c1'] };
  saveProyectos([p1]);

  const reqE: Requisito = { id: 'req_e', nombre: 'Patente Municipal', categoria: 'Tributario', destino: 'empresa', obligatorio: true, frecuencia: 'Mensual', alertaDias: 7, criticidad: 'bloquea_pago', proyectoId: 'p1' };
  const reqW: Requisito = { id: 'req_w', nombre: 'Curso ODI', categoria: 'Prevención', destino: 'trabajador', obligatorio: true, frecuencia: 'Anual', alertaDias: 30, criticidad: 'bloquea_acceso', proyectoId: 'p1' };
  saveRequisitos([reqE, reqW]);

  // Trabajador faena 'otra' no asignado
  const w1: Trabajador = {
    rut: '1-1',
    nombre: 'Juan Perez',
    cargo: 'Sup',
    faena: 'otra_obra',
    estado: 'pendiente',
    documentos: []
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

  printAssertion('Acreditación del contratista ignora trabajador no asignado', 'En proceso', calcularEstadoAcreditacion(contratista, 'p1')); // En proceso por falta de trabajadores asignados
}

// ----------------------------------------------------------------------------
// CASO 7: Requisito opcional incumplido
// ----------------------------------------------------------------------------
console.log('\n--- CASO 7: Requisito opcional incumplido ---');
{
  setupCleanDb();

  const p1: Proyecto = { id: 'p1', nombre: 'Proyecto 1', mandanteId: 'm1', estado: 'Activo', contratistas: ['c1'] };
  saveProyectos([p1]);

  const reqE: Requisito = { id: 'req_e', nombre: 'Patente Municipal', categoria: 'Tributario', destino: 'empresa', obligatorio: true, frecuencia: 'Mensual', alertaDias: 7, criticidad: 'bloquea_pago', proyectoId: 'p1' };
  const reqOpt: Requisito = { id: 'req_opt', nombre: 'Encuesta', categoria: 'Laboral', destino: 'empresa', obligatorio: false, frecuencia: 'Mensual', alertaDias: 7, criticidad: 'advertencia', proyectoId: 'p1' };
  saveRequisitos([reqE, reqOpt]);

  const w1: Trabajador = {
    rut: '1-1',
    nombre: 'Juan Perez',
    cargo: 'Sup',
    faena: 'p1',
    estado: 'aprobado',
    documentos: [] // sin requisitos obligatorios para trabajadores
  };

  const contratista: Contratista = {
    id: 'c1',
    nombre: 'Contratista Uno',
    rut: '77-1',
    proyectos: ['p1'],
    documentos: [
      { id: 'doc_c1', nombre: 'Patente Municipal', categoria: 'Tributario', estado: 'aprobado', vencimiento: '31/12/2029', proyectoId: 'p1' }
      // Encuesta opcional faltante
    ],
    trabajadores: [w1]
  };
  saveContratistas([contratista]);

  printAssertion('Acreditación del contratista aprobada con opcional faltante', 'Aprobado', calcularEstadoAcreditacion(contratista, 'p1'));
}

// ----------------------------------------------------------------------------
// CASO 8: Un requisito bloquea_acceso
// ----------------------------------------------------------------------------
console.log('\n--- CASO 8: Un requisito bloquea_acceso ---');
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
    documentos: [], // Falta Reglamento
    trabajadores: []
  };
  saveContratistas([contratista]);

  const accPago = calcularAccesoPago(contratista, 'p1');
  const est = calcularEstadoAcreditacion(contratista, 'p1');

  printAssertion('Estado Acreditación', 'No acreditado', est);
  printAssertion('Acceso bloqueado', true, accPago.accesoBloqueado);
  printAssertion('Pago no bloqueado', false, accPago.pagoBloqueado);
}

// ----------------------------------------------------------------------------
// CASO 9: Un requisito bloquea_pago
// ----------------------------------------------------------------------------
console.log('\n--- CASO 9: Un requisito bloquea_pago ---');
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
    documentos: [], // Falta Patente
    trabajadores: []
  };
  saveContratistas([contratista]);

  const accPago = calcularAccesoPago(contratista, 'p1');
  const est = calcularEstadoAcreditacion(contratista, 'p1');

  printAssertion('Estado Acreditación', 'No acreditado', est);
  printAssertion('Acceso no bloqueado', false, accPago.accesoBloqueado);
  printAssertion('Pago bloqueado', true, accPago.pagoBloqueado);
}

// ----------------------------------------------------------------------------
// CASO 10: Dos incumplimientos simultáneos con criticidades diferentes
// ----------------------------------------------------------------------------
console.log('\n--- CASO 10: Dos incumplimientos simultáneos con criticidades diferentes ---');
{
  setupCleanDb();

  const p1: Proyecto = { id: 'p1', nombre: 'Proyecto 1', mandanteId: 'm1', estado: 'Activo', contratistas: ['c1'] };
  saveProyectos([p1]);

  const reqE1: Requisito = { id: 'req_e1', nombre: 'Patente Municipal', categoria: 'Tributario', destino: 'empresa', obligatorio: true, frecuencia: 'Mensual', alertaDias: 7, criticidad: 'bloquea_pago', proyectoId: 'p1' };
  const reqE2: Requisito = { id: 'req_e2', nombre: 'Reglamento Interno', categoria: 'Laboral', destino: 'empresa', obligatorio: true, frecuencia: 'Mensual', alertaDias: 7, criticidad: 'bloquea_acceso', proyectoId: 'p1' };
  saveRequisitos([reqE1, reqE2]);

  const contratista: Contratista = {
    id: 'c1',
    nombre: 'Contratista Uno',
    rut: '77-1',
    proyectos: ['p1'],
    documentos: [], // faltan ambos
    trabajadores: []
  };
  saveContratistas([contratista]);

  const accPago = calcularAccesoPago(contratista, 'p1');
  const est = calcularEstadoAcreditacion(contratista, 'p1');

  printAssertion('Estado Acreditación', 'No acreditado', est);
  printAssertion('Acceso bloqueado', true, accPago.accesoBloqueado);
  printAssertion('Pago bloqueado', true, accPago.pagoBloqueado);
}

console.log('\n================================================================');
console.log('✅ TODAS LAS PRUEBAS DE ESTADOS Y PRECEDENCIA PASARON CORRECTAMENTE!');
console.log('================================================================');
process.exit(0);
