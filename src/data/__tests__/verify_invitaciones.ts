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
  crearInvitacion,
  aceptarInvitacion,
  getInvitaciones,
  saveInvitaciones,
  getProyectos,
  getContratistas
} from '../localStorageDb';
import { Invitacion } from '../../types';

console.log('=== INICIANDO VALIDACIÓN DE INVITACIONES Y FLUJO DE RELACIÓN ===\n');

// CASO 1: Mandante A invita a Contratista B al Proyecto A -> invitación válida
console.log('--- Caso 1: Mandante A invita a Contratista B al Proyecto A ---');
{
  mockLocalStorage.clear();
  initDb();
  saveInvitaciones([]);

  const res = crearInvitacion('andina', 'costanera', 'tecnicosur', 'tecnico@tecnicosur.cl', 'Hola TécnicoSur');
  console.log(`Invitación creada: ${res.success} (Esperado: true)`);
  if (!res.success || !res.invitacion) {
    console.error('❌ Falló Caso 1');
    process.exit(1);
  }
  const inv = res.invitacion;
  console.log(`ID: ${inv.id}, MandanteId: ${inv.mandanteId}, ProyectoId: ${inv.proyectoId}, ContratistaId: ${inv.contratistaId}, Email: ${inv.email}`);
  if (inv.mandanteId !== 'andina' || inv.proyectoId !== 'costanera' || inv.contratistaId !== 'tecnicosur') {
    console.error('❌ Falló Caso 1: IDs de invitación incorrectos');
    process.exit(1);
  }
}

// CASO 2: Mandante A intenta invitar a Contratista B al Proyecto de Mandante B -> rechazado
console.log('--- Caso 2: Mandante A intenta invitar a Contratista B al Proyecto de Mandante B ---');
{
  mockLocalStorage.clear();
  initDb();
  const res = crearInvitacion('andina', 'bodega', 'servicios-norte', 'norte@serviciosnorte.cl', 'Hola');
  console.log(`¿Se permitió crear invitación?: ${res.success} (Esperado: false)`);
  console.log(`Error: ${res.error}`);
  if (res.success) {
    console.error('❌ Falló Caso 2');
    process.exit(1);
  }
}

// CASO 3: Contratista B acepta invitación válida -> queda asociado al proyecto
console.log('--- Caso 3: Contratista B acepta invitación válida ---');
{
  mockLocalStorage.clear();
  initDb();
  saveInvitaciones([]);
  const createRes = crearInvitacion('andina', 'costanera', 'tecnicosur', 'tecnico@tecnicosur.cl', 'Hola');
  const invId = createRes.invitacion!.id;

  const res = aceptarInvitacion(invId, 'tecnicosur');
  console.log(`Aceptación exitosa: ${res.success} (Esperado: true)`);
  
  // Verificar que el contratista se asocie al proyecto
  const proyectos = getProyectos();
  const proyecto = proyectos.find(p => p.id === 'costanera');
  const estaAsociado = proyecto?.contratistas.includes('tecnicosur');
  console.log(`¿Contratista asociado al proyecto?: ${estaAsociado} (Esperado: true)`);
  
  if (!res.success || !estaAsociado) {
    console.error('❌ Falló Caso 3');
    process.exit(1);
  }
}

// CASO 4: Contratista B intenta aceptar invitación dirigida a Contratista C -> rechazado
console.log('--- Caso 4: Contratista B intenta aceptar invitación dirigida a Contratista C ---');
{
  mockLocalStorage.clear();
  initDb();
  saveInvitaciones([]);
  const createRes = crearInvitacion('andina', 'hospital', 'tecnicosur', 'tecnico@tecnicosur.cl', 'Hola');
  const invId = createRes.invitacion!.id;

  // Intenta aceptar Contratista B ('servicios-norte')
  const res = aceptarInvitacion(invId, 'servicios-norte');
  console.log(`¿Aceptación permitida?: ${res.success} (Esperado: false)`);
  console.log(`Error: ${res.error}`);
  if (res.success) {
    console.error('❌ Falló Caso 4');
    process.exit(1);
  }
}

// CASO 5: Intento de crear la misma invitación dos veces -> no debe crear duplicados
console.log('--- Caso 5: Intento de crear la misma invitación dos veces ---');
{
  mockLocalStorage.clear();
  initDb();
  saveInvitaciones([]);
  const res1 = crearInvitacion('andina', 'costanera', 'tecnicosur', 'tecnico@tecnicosur.cl', 'Hola');
  const res2 = crearInvitacion('andina', 'costanera', 'tecnicosur', 'tecnico@tecnicosur.cl', 'Hola de nuevo');
  console.log(`Primer intento exitoso: ${res1.success} (Esperado: true)`);
  console.log(`Segundo intento exitoso: ${res2.success} (Esperado: false)`);
  if (!res1.success || res2.success) {
    console.error('❌ Falló Caso 5');
    process.exit(1);
  }
}

// CASO 6: Contratista ya asociado al proyecto -> no debe generar una nueva invitación o asociación
console.log('--- Caso 6: Contratista ya asociado al proyecto ---');
{
  mockLocalStorage.clear();
  initDb();
  // 'servicios-norte' ya está asociado a 'costanera' en la DB por defecto
  const res = crearInvitacion('andina', 'costanera', 'servicios-norte', 'norte@serviciosnorte.cl', 'Hola');
  console.log(`¿Invitación creada si ya está asociado?: ${res.success} (Esperado: false)`);
  console.log(`Error: ${res.error}`);
  if (res.success) {
    console.error('❌ Falló Caso 6');
    process.exit(1);
  }
}

// CASO 7: Mandante consulta sus invitaciones -> solo ve sus propias invitaciones
console.log('--- Caso 7: Mandante consulta sus invitaciones ---');
{
  mockLocalStorage.clear();
  initDb();
  saveInvitaciones([]);
  crearInvitacion('andina', 'hospital', 'tecnicosur', 'tecnico@tecnicosur.cl', 'Hola');
  
  // Agregar una invitación mock de otro mandante
  const allInvs = getInvitaciones();
  const otherInv: Invitacion = {
    id: 'inv_other',
    contratistaId: 'servicios-norte',
    contratistaNombre: 'Servicios Norte Ltda.',
    contratistaRut: '77.111.222-3',
    proyectoId: 'solar',
    proyectoNombre: 'Ampliación Planta Solar',
    mandanteId: 'inmobiliaria-sur',
    mandanteNombre: 'Inmobiliaria del Sur Ltda.',
    estado: 'pendiente',
    mensaje: 'Mensaje de otro',
    fecha: '15/08/2026'
  };
  allInvs.push(otherInv);
  saveInvitaciones(allInvs);

  // Mandante A ('andina') consulta
  const misInvs = getInvitaciones().filter(i => i.mandanteId === 'andina');
  console.log(`Invitaciones de Mandante A: ${misInvs.length} (Esperado: 1)`);
  const hasOther = misInvs.some(i => i.mandanteId !== 'andina');
  console.log(`¿Contiene invitaciones de otros mandantes?: ${hasOther} (Esperado: false)`);
  if (misInvs.length !== 1 || hasOther) {
    console.error('❌ Falló Caso 7');
    process.exit(1);
  }
}

// CASO 8: Contratista consulta sus invitaciones -> solo ve las dirigidas a su empresa/email
console.log('--- Caso 8: Contratista consulta sus invitaciones ---');
{
  mockLocalStorage.clear();
  initDb();
  saveInvitaciones([]);
  crearInvitacion('andina', 'hospital', 'tecnicosur', 'tecnico@tecnicosur.cl', 'Hola');
  
  // Agregar una de otro contratista
  const allInvs = getInvitaciones();
  const otherInv: Invitacion = {
    id: 'inv_other',
    contratistaId: 'servicios-norte',
    contratistaNombre: 'Servicios Norte Ltda.',
    contratistaRut: '77.111.222-3',
    proyectoId: 'solar',
    proyectoNombre: 'Ampliación Planta Solar',
    mandanteId: 'inmobiliaria-sur',
    mandanteNombre: 'Inmobiliaria del Sur Ltda.',
    estado: 'pendiente',
    mensaje: 'Mensaje de otro',
    fecha: '15/08/2026'
  };
  allInvs.push(otherInv);
  saveInvitaciones(allInvs);

  // Consultando 'tecnicosur'
  const misInvs = getInvitaciones().filter(i => i.contratistaId === 'tecnicosur');
  console.log(`Invitaciones de tecnicosur: ${misInvs.length} (Esperado: 1)`);
  const hasOther = misInvs.some(i => i.contratistaId !== 'tecnicosur');
  console.log(`¿Contiene invitaciones ajenas?: ${hasOther} (Esperado: false)`);
  if (misInvs.length !== 1 || hasOther) {
    console.error('❌ Falló Caso 8');
    process.exit(1);
  }
}

// CASO 9: Los IDs reales de mandante, proyecto y contratista se conservan correctamente
console.log('--- Caso 9: Conservación de IDs reales ---');
{
  mockLocalStorage.clear();
  initDb();
  saveInvitaciones([]);
  const res = crearInvitacion('andina', 'hospital', 'tecnicosur', 'tecnico@tecnicosur.cl', 'Mensaje');
  const inv = res.invitacion!;
  console.log(`ID Mandante: ${inv.mandanteId} (Esperado: 'andina')`);
  console.log(`ID Proyecto: ${inv.proyectoId} (Esperado: 'hospital')`);
  console.log(`ID Contratista: ${inv.contratistaId} (Esperado: 'tecnicosur')`);
  if (inv.mandanteId !== 'andina' || inv.proyectoId !== 'hospital' || inv.contratistaId !== 'tecnicosur') {
    console.error('❌ Falló Caso 9');
    process.exit(1);
  }
}

// CASO 10: No queda ningún nombre/RUT/email hardcodeado en el flujo de creación de invitaciones
console.log('--- Caso 10: Sin datos hardcodeados ---');
{
  mockLocalStorage.clear();
  initDb();
  saveInvitaciones([]);
  const res = crearInvitacion('andina', 'hospital', 'tecnicosur', 'tecnico@tecnicosur.cl', 'Mensaje');
  const inv = res.invitacion!;
  console.log(`Nombre Mandante resuelto: '${inv.mandanteNombre}' (Esperado: 'Constructora Andina SA')`);
  console.log(`Nombre Contratista resuelto: '${inv.contratistaNombre}' (Esperado: 'TécnicoSur SpA')`);
  console.log(`Rut Contratista resuelto: '${inv.contratistaRut}' (Esperado: '77.321.654-1')`);
  console.log(`Nombre Proyecto resuelto: '${inv.proyectoNombre}' (Esperado: 'Hospital Regional Centro')`);
  
  if (
    inv.mandanteNombre !== 'Constructora Andina SA' || 
    inv.contratistaNombre !== 'TécnicoSur SpA' || 
    inv.contratistaRut !== '77.321.654-1' || 
    inv.proyectoNombre !== 'Hospital Regional Centro'
  ) {
    console.error('❌ Falló Caso 10');
    process.exit(1);
  }
}

console.log('\n✅ TODAS LAS PRUEBAS DE INVITACIONES Y RELACIONES PASARON CORRECTAMENTE!');
process.exit(0);
