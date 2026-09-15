import {
  calcularAccesoPago,
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
const document = (id: string, requirement: Requisito, estado: Documento['estado']): Documento => ({
  id,
  nombre: requirement.nombre,
  categoria: requirement.categoria,
  estado,
  vencimiento: '2030-12-31',
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

assert(formatPeriodo('2026-09-01', '2026-09-30') === 'Septiembre de 2026', 'El período mensual debe tener una etiqueta legible.');
const csv = buildComplianceCsv([
  {
    id: 'obl-v2', proyectoId: project.id, contratistaId: contractor.id, requisitoId: paymentRequirement.id,
    periodoInicio: '2026-09-01', periodoFin: '2026-09-30', periodoEtiqueta: 'Septiembre de 2026',
    fechaLimite: '2026-10-05', estado: 'pendiente', activo: true,
  },
], new Map([[paymentRequirement.id, paymentRequirement.nombre]]), new Map([[contractor.id, contractor.nombre]]));
assert(csv.includes('F30 mensual') && csv.includes('Septiembre de 2026'), 'La exportación debe identificar requisito y período.');

console.log('PASS operational core v2: asignaciones, aplicabilidad, compuertas, períodos y exportación.');
