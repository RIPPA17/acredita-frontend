import {
  calcularAccesoPago,
  calcularEstadoAcreditacion,
  initDb,
  saveAuditLogs,
  saveContratistas,
  saveProyectos,
  saveRequisitos
} from '../localStorageDb';
import type { Contratista, Documento, Proyecto, Requisito, Trabajador } from '../../types';

const store: Record<string, string> = {};
const localStorageMock = {
  getItem: (key: string) => store[key] ?? null,
  setItem: (key: string, value: string) => { store[key] = value; },
  removeItem: (key: string) => { delete store[key]; },
  clear: () => { Object.keys(store).forEach(key => delete store[key]); }
};

Object.assign(globalThis, { window: { localStorage: localStorageMock }, localStorage: localStorageMock });

type Expected = {
  acreditacion: ReturnType<typeof calcularEstadoAcreditacion>;
  acceso: ReturnType<typeof calcularAccesoPago>['accesoEstado'];
  pago: ReturnType<typeof calcularAccesoPago>['pagoEstado'];
};

const project: Proyecto = { id: 'p1', nombre: 'Proyecto prueba', mandanteId: 'm1', estado: 'Activo', contratistas: ['c1'] };
const worker: Trabajador = { rut: '1-9', nombre: 'Trabajador aprobado', cargo: 'Operador', faena: 'p1', estado: 'aprobado', documentos: [] };

function verify(name: string, document: Documento | undefined, obligatorio: boolean, expected: Expected) {
  localStorageMock.clear();
  initDb();
  saveAuditLogs([]);
  saveProyectos([project]);
  const requirement: Requisito = {
    id: 'req1', nombre: 'Documento prueba', categoria: 'Laboral', destino: 'empresa',
    obligatorio, frecuencia: 'Anual', alertaDias: 30, criticidad: 'bloquea_ambas', proyectoId: project.id
  };
  saveRequisitos([requirement]);
  const contractor: Contratista = {
    id: 'c1', nombre: 'Contratista prueba', rut: '76.000.000-0', proyectos: [project.id],
    documentos: document ? [document] : [], trabajadores: [worker]
  };
  saveContratistas([contractor]);
  const gates = calcularAccesoPago(contractor, project.id);
  const actual: Expected = {
    acreditacion: calcularEstadoAcreditacion(contractor, project.id),
    acceso: gates.accesoEstado,
    pago: gates.pagoEstado
  };
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${name}: esperado ${JSON.stringify(expected)}, obtenido ${JSON.stringify(actual)}`);
  }
  console.log(`PASS ${name}: ${JSON.stringify(actual)}`);
}

const document = (estado: Documento['estado'], vencimiento = '31/12/2029'): Documento => ({
  id: `doc-${estado}`, nombre: 'Documento prueba', categoria: 'Laboral', estado, vencimiento, proyectoId: project.id
});

const pending: Expected = { acreditacion: 'En proceso', acceso: 'pendiente', pago: 'pendiente' };
const blocked: Expected = { acreditacion: 'Vencido/Bloqueado', acceso: 'bloqueado', pago: 'bloqueado' };
const enabled: Expected = { acreditacion: 'Aprobado', acceso: 'habilitado', pago: 'habilitado' };

verify('A revision', document('revision'), true, pending);
verify('B pendiente', document('pendiente'), true, pending);
verify('C faltante obligatorio', undefined, true, pending);
verify('D rechazado', document('rechazado'), true, blocked);
verify('E vencido', document('aprobado', '01/01/2020'), true, blocked);
verify('F por vencer vigente', document('por_vencer'), true, enabled);
verify('G opcional faltante', undefined, false, enabled);
