// Capa de datos propia del Inicio del portal Contratista. No recalcula
// acreditación: solo re-empareja Documento <-> Requisito (mismo criterio que
// acreditacionUtils.ts, que no exporta su helper interno) para exponer los
// campos reales (vencimiento, motivo de rechazo, id) que la UI necesita para
// navegar al documento/trabajador exacto y mostrar el motivo real.
import { Contratista, Trabajador, Requisito, Documento } from '../../../types';
import { esDocumentoCumplido, esVencidoPorFecha, esPorVencerPorFecha, obtenerDiasRestantes } from '../../../data/localStorageDb';
import { docEstadoLabel, DocEstado } from '../../admin/acreditacionUtils';

export function matchDocumentoRequisito(
  docs: Documento[] | undefined,
  proyectoId: string,
  reqNombre: string
): Documento | undefined {
  return (docs || []).find(
    d =>
      d.proyectoId === proyectoId &&
      (d.nombre.toLowerCase().includes(reqNombre.toLowerCase()) ||
        reqNombre.toLowerCase().includes(d.nombre.toLowerCase()))
  );
}

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
      return { requisito, doc, estado: docEstadoLabel(doc), cumplido: esDocumentoCumplido(doc, requisito) };
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
      return { requisito, doc, estado: docEstadoLabel(doc), cumplido: esDocumentoCumplido(doc, requisito), worker };
    });
}

export function impactoLabel(requisito: Requisito): string {
  if (!requisito.obligatorio) return 'Opcional';
  switch (requisito.criticidad) {
    case 'bloquea_ambas':
      return 'Bloquea acceso y pago';
    case 'bloquea_pago':
      return 'Bloquea pago';
    case 'bloquea_acceso':
      return 'Bloquea acceso';
    default:
      return 'Advertencia';
  }
}

export function motivoRechazo(doc: Documento | undefined): string {
  if (!doc) return 'Documento rechazado.';
  return doc.explicacionRechazo || doc.motivoRechazo || doc.motivo || doc.observacion || 'Documento rechazado.';
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
