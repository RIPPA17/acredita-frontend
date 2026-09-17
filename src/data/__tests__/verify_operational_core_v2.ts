import {
  calcularAccesoPago,
  calcularEstadoAcreditacion,
  calcularEstadoTrabajador,
  requisitoAplicaATrabajador,
  saveContratistas,
  saveProyectos,
  saveRequisitos,
} from '../localStorageDb';
import { buildComplianceCsv, formatPeriodo, getAsignacionProyecto } from '../operationalCore';
import type { Contratista, Documento, Proyecto, Requisito, Trabajador } from '../../types';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const project: Proyecto = {
  id: 'proyecto-v2',
  nombre: 'Proyecto Operacional',
  mandanteId: 'mandante-v2',
  estado: 'Activo',
  contratistas: ['contratista-v2'],
};
const assignment = {
  id: 'asignacion-v2',
  proyectoId: project.id,
  servicioId: 'servicio-v2',
  cargo: 'Operador de grúa',
  categorias: ['conductor', 'izaje'],
  fechaIngreso: '2026-09-01',
  estado: 'activa' as const,
  estadoAcceso: 'pendiente' as const,
};
const worker: Trabajador = {
  rut: '11.111.111-1',
  nombre: 'Trabajador Prueba',
  cargo: 'Operador',
  faena: 'una-faena-legacy-distinta',
  estado: 'pendiente',
  asignaciones: [assignment],
  documentos: [],
};
const accessRequirement: Requisito = {
  id: 'req-acceso',
  nombre: 'Examen de altura',
  categoria: 'Seguridad',
  destino: 'empresa',
  obligatorio: true,
  frecuencia: 'Anual',
  alertaDias: 30,
  criticidad: 'bloquea_acceso',
  proyectoId: project.id,
};
const paymentRequirement: Requisito = {
  ...accessRequirement,
  id: 'req-pago',
  nombre: 'F30 mensual',
  criticidad: 'bloquea_pago',
};
const driverRequirement: Requisito = {
  ...accessRequirement,
  id: 'req-conductor',
  nombre: 'Licencia de conducir',
  destino: 'trabajador',
  criticidad: 'bloquea_acceso',
  categoriasAplicables: ['conductor'],
};
const guardRequirement: Requisito = {
  ...driverRequirement,
  id: 'req-guardia',
  nombre: 'Curso OS10',
  categoriasAplicables: ['guardia'],
};
const document = (
  id: string,
  requirement: Requisito,
  estado: Documento['estado'],
  vencimiento = '2030-12-31',
): Documento => ({
  id,
  nombre: requirement.nombre,
  categoria: requirement.categoria,
  estado,
  vencimiento,
  proyectoId: project.id,
});
const contractor: Contratista = {
  id: 'contratista-v2',
  nombre: 'Contratista V2',
  rut: '76.000.000-0',
  proyectos: [project.id],
  documentos: [
    document('doc-acceso', accessRequirement, 'rechazado'),
    document('doc-pago', paymentRequirement, 'aprobado'),
  ],
  trabajadores: [worker],
};

saveProyectos([project]);
saveRequisitos([accessRequirement, paymentRequirement, driverRequirement, guardRequirement]);
saveContratistas([contractor]);

assert(getAsignacionProyecto(worker, project.id)?.servicioId === 'servicio-v2', 'La asignación explícita debe ser la fuente de verdad.');
assert(requisitoAplicaATrabajador(driverRequirement, worker, project.id), 'La licencia debe aplicar a la categoría conductor.');
assert(!requisitoAplicaATrabajador(guardRequirement, worker, project.id), 'OS10 no debe aplicar a un trabajador que no es guardia.');
assert(calcularEstadoTrabajador(worker, project.id) === 'pendiente', 'El requisito aplicable sin documento debe dejar al trabajador en proceso.');

const gates = calcularAccesoPago(contractor, project.id);
assert(gates.accesoEstado === 'bloqueado', 'Un rechazo de acceso debe bloquear acceso.');
assert(gates.pagoEstado === 'habilitado', 'Un rechazo solo de acceso no debe retener el pago.');

const approvedWorker: Trabajador = {
  ...worker,
  estado: 'aprobado',
  asignaciones: [{ ...assignment }],
  documentos: [document('doc-licencia', driverRequirement, 'aprobado')],
};
const approvedContractor: Contratista = {
  ...contractor,
  documentos: [
    document('doc-acceso-ok', accessRequirement, 'aprobado'),
    document('doc-pago-ok', paymentRequirement, 'aprobado'),
  ],
  trabajadores: [approvedWorker],
};
saveContratistas([approvedContractor]);
assert(calcularEstadoTrabajador(approvedWorker, project.id) === 'aprobado', 'Un trabajador con todos sus requisitos vigentes debe quedar aprobado.');
assert(calcularEstadoAcreditacion(approvedContractor, project.id) === 'Aprobado', 'La empresa solo debe acreditarse cuando empresa y 100% de trabajadores cumplen.');
const approvedGates = calcularAccesoPago(approvedContractor, project.id);
assert(approvedGates.accesoEstado === 'habilitado', 'Con documentos de acceso vigentes, el acceso debe quedar habilitado.');
assert(approvedGates.pagoEstado === 'habilitado', 'Con documentos de pago vigentes, el pago debe quedar habilitado.');

const secondWorkerPending: Trabajador = {
  ...worker,
  rut: '22.222.222-2',
  nombre: 'Segundo Trabajador Pendiente',
  asignaciones: [{ ...assignment, id: 'asignacion-v2-2' }],
  documentos: [],
};
const notFullyAccredited: Contratista = {
  ...approvedContractor,
  trabajadores: [approvedWorker, secondWorkerPending],
};
saveContratistas([notFullyAccredited]);
assert(calcularEstadoAcreditacion(notFullyAccredited, project.id) === 'En proceso', 'Un solo trabajador pendiente debe impedir acreditar a la empresa completa.');

const expiredPaymentContractor: Contratista = {
  ...approvedContractor,
  documentos: [
    document('doc-acceso-vigente', accessRequirement, 'aprobado'),
    document('doc-pago-vencido', paymentRequirement, 'aprobado', '2020-01-01'),
  ],
  trabajadores: [approvedWorker],
};
saveContratistas([expiredPaymentContractor]);
assert(calcularEstadoAcreditacion(expiredPaymentContractor, project.id) === 'Vencido/Bloqueado', 'Un documento obligatorio vencido debe bloquear la acreditación.');
const expiredPaymentGates = calcularAccesoPago(expiredPaymentContractor, project.id);
assert(expiredPaymentGates.pagoEstado === 'bloqueado', 'Un requisito bloquea_pago vencido debe bloquear el pago.');
assert(expiredPaymentGates.accesoEstado === 'habilitado', 'Un requisito solo de pago vencido no debe bloquear el acceso si lo demás está vigente.');

const workerWithExpiredAccess: Trabajador = {
  ...approvedWorker,
  documentos: [document('doc-licencia-vencida', driverRequirement, 'aprobado', '2020-01-01')],
};
const expiredWorkerContractor: Contratista = {
  ...approvedContractor,
  trabajadores: [workerWithExpiredAccess],
};
saveContratistas([expiredWorkerContractor]);
assert(calcularEstadoTrabajador(workerWithExpiredAccess, project.id) === 'rechazado', 'Un documento obligatorio de acceso vencido debe inhabilitar al trabajador.');
assert(calcularEstadoAcreditacion(expiredWorkerContractor, project.id) === 'Vencido/Bloqueado', 'Un trabajador con requisito obligatorio vencido debe bloquear la acreditación global.');

assert(formatPeriodo('2026-09-01', '2026-09-30') === 'Septiembre de 2026', 'El período mensual debe tener una etiqueta legible.');
const csv = buildComplianceCsv([
  {
    id: 'obl-v2', proyectoId: project.id, contratistaId: contractor.id, requisitoId: paymentRequirement.id,
    periodoInicio: '2026-09-01', periodoFin: '2026-09-30', periodoEtiqueta: 'Septiembre de 2026',
    fechaLimite: '2026-10-05', estado: 'pendiente', activo: true,
  },
], new Map([[paymentRequirement.id, paymentRequirement.nombre]]), new Map([[contractor.id, contractor.nombre]]));
assert(csv.includes('F30 mensual') && csv.includes('Septiembre de 2026'), 'La exportación debe identificar requisito y período.');

console.log('PASS operational core v2: asignaciones, 100% trabajadores, vencimientos, compuertas, períodos y exportación.');
