// Capa de datos propia del Inicio del portal Contratista. No recalcula
// acreditación: solo re-empareja Documento <-> Requisito (mismo criterio que
// acreditacionUtils.ts, que no exporta su helper interno) para exponer los
// campos reales (vencimiento, motivo de rechazo, id) que la UI necesita para
// navegar al documento/trabajador exacto y mostrar el motivo real.
import { Contratista, Trabajador, Requisito, Documento } from '../../../types';
import {
  esDocumentoCumplido,
  esVencidoPorFecha,
  esPorVencerPorFecha,
  obtenerDiasRestantes,
  calcularAccesoPago,
  calcularEstadoTrabajador,
} from '../../../data/localStorageDb';
import { docEstadoLabel, DocEstado } from '../../admin/acreditacionUtils';
import { matchDocumentoRequisito } from '../documentosUtils';

export { matchDocumentoRequisito, normalizarNombreDocumento } from '../documentosUtils';

export interface RequisitoConDoc {
  requisito: Requisito;
  doc?: Documento;
  estado: DocEstado;
  cumplido: boolean;
  worker?: Trabajador;
}

export function buildRequisitosEmpresa(
  contratista: Contratista,
  proyectoId: string,
  requisitos: Requisito[]
): RequisitoConDoc[] {
  return requisitos
    .filter(r => r.proyectoId === proyectoId && r.destino === 'empresa' && r.activo !== false)
    .map(requisito => {
      const doc = matchDocumentoRequisito(contratista.documentos, proyectoId, requisito.nombre);
      return { requisito, doc, estado: docEstadoLabel(doc, requisito), cumplido: esDocumentoCumplido(doc, requisito) };
    });
}

export function buildRequisitosTrabajador(
  worker: Trabajador,
  proyectoId: string,
  requisitos: Requisito[]
): RequisitoConDoc[] {
  return requisitos
    .filter(r => r.proyectoId === proyectoId && r.destino === 'trabajador' && r.activo !== false)
    .map(requisito => {
      const doc = matchDocumentoRequisito(worker.documentos, proyectoId, requisito.nombre);
      return { requisito, doc, estado: docEstadoLabel(doc, requisito), cumplido: esDocumentoCumplido(doc, requisito), worker };
    });
}

export function impactoLabel(requisito: Requisito): string {
  switch (requisito.criticidad) {
    case 'bloquea_ambas':
      return 'Bloquea acceso y pago';
    case 'bloquea_pago':
      return 'Bloquea pago';
    case 'bloquea_acceso':
      return 'Bloquea acceso';
    default:
      return 'Solo advertencia';
  }
}

export function motivoRechazo(doc: Documento | undefined): string {
  if (!doc) return 'Documento rechazado.';
  return doc.explicacionRechazo || doc.motivoRechazo || doc.motivo || doc.observacion || 'Documento rechazado.';
}

// Texto de motivo para un requisito de empresa, según su estado real. "En
// revisión" y "Pendiente" nunca deben leerse como si hubiera que corregir
// algo: el primero ya está en manos de Acredita, el segundo simplemente no
// se ha subido todavía.
export function motivoEmpresaItem(item: RequisitoConDoc): string {
  if (!item.doc) return 'Documento no cargado.';
  if (item.estado === 'Rechazado') return motivoRechazo(item.doc);
  if (item.estado === 'Vencido') return 'Documento vencido.';
  if (item.estado === 'Por vencer') {
    const dias = obtenerDiasRestantes(item.doc.vencimiento);
    return `Vence en ${dias} día${dias === 1 ? '' : 's'}.`;
  }
  if (item.estado === 'En revisión') return 'En revisión: esperando revisión de Acredita.';
  if (item.estado === 'Pendiente') return 'Documento pendiente de carga.';
  return 'Documento aprobado.';
}

// Responsabilidad de la acción sobre un requisito de empresa (regla UX):
// pendiente sin documento / rechazado / vencido → puede actuar el
// contratista; por vencer → acción preventiva; en revisión → ya hizo su
// parte, está esperando a Acredita; aprobado → sin acción.
export function accionEmpresaLabel(estado: DocEstado, tieneDoc: boolean): string {
  if (!tieneDoc) return 'Subir';
  if (estado === 'Rechazado' || estado === 'Vencido') return 'Corregir';
  return 'Ver documento';
}

// Rango de prioridad para ordenar bloqueos/pendientes: menor = más urgente.
// Sigue exactamente el orden pedido: 1) bloquea pago, 2) bloquea acceso,
// 3) vencido/rechazado obligatorio (solo advertencia), 4) por vencer,
// 5) pendiente/en revisión. Los opcionales y los ya aprobados no aparecen (99).
export function prioridadItem(item: RequisitoConDoc): number {
  const { requisito, estado } = item;
  if (!requisito.obligatorio) return 99;
  if (estado === 'Aprobado') return 99;

  const bloqueaPago = requisito.criticidad === 'bloquea_pago' || requisito.criticidad === 'bloquea_ambas';
  const bloqueaAcceso = requisito.criticidad === 'bloquea_acceso' || requisito.criticidad === 'bloquea_ambas';

  if (bloqueaPago) return 0;
  if (bloqueaAcceso) return 1;
  if (estado === 'Rechazado' || estado === 'Vencido') return 2;
  if (estado === 'Por vencer') return 3;
  return 4;
}

export interface ProximoVencimiento {
  dias: number;
  nombre: string;
  trabajadorNombre?: string;
  vencimiento: string;
}

// Busca, entre documentos de empresa y de trabajadores del proyecto actual,
// el que vence antes — usando la alertaDias propia de cada requisito, nunca
// una ventana fija.
export function encontrarProximoVencimiento(items: RequisitoConDoc[]): ProximoVencimiento | undefined {
  const candidatos = items
    .filter(i => i.doc && !esVencidoPorFecha(i.doc.vencimiento) && esPorVencerPorFecha(i.doc.vencimiento, i.requisito.alertaDias))
    .map(i => ({
      dias: obtenerDiasRestantes(i.doc!.vencimiento),
      nombre: i.requisito.nombre,
      trabajadorNombre: i.worker?.nombre,
      vencimiento: i.doc!.vencimiento,
    }))
    .sort((a, b) => a.dias - b.dias);
  return candidatos[0];
}

export interface EstadoAccesoProyecto {
  estado: 'habilitado' | 'parcial' | 'bloqueado';
  label: string;
  trabajadoresNoHabilitados: number;
  totalTrabajadores: number;
  detalle?: string;
}

// Compone (no recalcula) el estado visual de "Acceso a faena" para un
// proyecto, a partir de dos señales centrales ya existentes:
// calcularAccesoPago() para los requisitos de empresa, y
// calcularEstadoTrabajador() para cada trabajador asignado a ese proyecto.
// Un trabajador "pendiente" o "rechazado" NO está habilitado para ingresar;
// "aprobado" y "por_vencer" sí (por_vencer sigue vigente, es solo una
// advertencia). Se usa tanto en la card principal como en cada card de
// "Tus proyectos" para que ambas cuenten siempre la misma historia.
export function getEstadoAccesoProyecto(
  contratista: Contratista,
  proyectoId: string,
  trabajadoresProyecto: Trabajador[]
): EstadoAccesoProyecto {
  const accesoPago = calcularAccesoPago(contratista, proyectoId);

  const estadosTrabajadores = trabajadoresProyecto.map(w => ({
    trabajador: w,
    estado: calcularEstadoTrabajador(w, proyectoId),
  }));
  const noHabilitados = estadosTrabajadores.filter(x => x.estado === 'rechazado' || x.estado === 'pendiente');
  const totalTrabajadores = trabajadoresProyecto.length;
  const rechazados = noHabilitados.filter(x => x.estado === 'rechazado').length;
  const pendientes = noHabilitados.filter(x => x.estado === 'pendiente').length;

  let estado: 'habilitado' | 'parcial' | 'bloqueado';
  if (accesoPago.accesoBloqueado) {
    estado = 'bloqueado';
  } else if (totalTrabajadores > 0 && noHabilitados.length === totalTrabajadores) {
    estado = 'bloqueado';
  } else if (noHabilitados.length > 0) {
    estado = 'parcial';
  } else {
    estado = 'habilitado';
  }

  const label = estado === 'habilitado' ? 'Acceso habilitado' : estado === 'bloqueado' ? 'Acceso bloqueado' : 'Acceso parcialmente bloqueado';

  let detalle: string | undefined;
  if (noHabilitados.length > 0) {
    const partes: string[] = [];
    if (pendientes > 0) partes.push(`${pendientes} pendiente${pendientes === 1 ? '' : 's'}`);
    if (rechazados > 0) partes.push(`${rechazados} bloqueado${rechazados === 1 ? '' : 's'}`);
    detalle = `${noHabilitados.length} trabajador${noHabilitados.length === 1 ? '' : 'es'} no puede${noHabilitados.length === 1 ? '' : 'n'} ingresar: ${partes.join(' y ')}.`;
  }

  return { estado, label, trabajadoresNoHabilitados: noHabilitados.length, totalTrabajadores, detalle };
}
