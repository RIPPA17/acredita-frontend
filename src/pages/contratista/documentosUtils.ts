import {
  esPorVencerPorFecha,
  esVencidoPorFecha,
} from '../../data/localStorageDb';
import { Documento, Requisito } from '../../types';
import { DocEstado } from '../admin/acreditacionUtils';

export function normalizarNombreDocumento(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

export function matchDocumentoRequisito(
  docs: Documento[] | undefined,
  proyectoId: string,
  requisitoNombre: string,
): Documento | undefined {
  return (docs || []).find(doc =>
    doc.proyectoId === proyectoId &&
    normalizarNombreDocumento(doc.nombre) === normalizarNombreDocumento(requisitoNombre)
  );
}

export function getEstadoDocumentoEfectivo(
  doc: Documento | undefined,
  requisito: Requisito,
): DocEstado {
  if (!doc || doc.estado === 'pendiente') return 'Pendiente';
  if (doc.estado === 'rechazado') return 'Rechazado';
  if (esVencidoPorFecha(doc.vencimiento)) return 'Vencido';
  if (doc.estado === 'revision') return 'En revisión';
  if (doc.estado === 'por_vencer') return 'Por vencer';
  if (esPorVencerPorFecha(doc.vencimiento, requisito.alertaDias)) return 'Por vencer';
  return 'Aprobado';
}

export function documentoVigente(doc: Documento | undefined, requisito: Requisito): boolean {
  const estado = getEstadoDocumentoEfectivo(doc, requisito);
  return estado === 'Aprobado' || estado === 'Por vencer';
}

function slug(value: string): string {
  return normalizarNombreDocumento(value).replace(/[^a-z0-9_-]+/g, '_');
}


function idDocumento(
  contratistaId: string,
  proyectoId: string,
  requisitoId: string,
  trabajadorRut?: string,
): string {
  return `doc_${slug(contratistaId)}_${slug(proyectoId)}_${slug(requisitoId)}_${slug(trabajadorRut || 'empresa')}`;
}

export function crearDocumentosPendientesProyecto(
  requisitos: Requisito[],
  contratistaId: string,
  proyectoId: string,
  trabajadorRut: string,
): Documento[] {
  return requisitos.map(requisito => ({
    id: idDocumento(contratistaId, proyectoId, requisito.id, trabajadorRut),
    nombre: requisito.nombre,
    categoria: requisito.categoria,
    estado: 'pendiente',
    vencimiento: '—',
    proyectoId,
    version: 1,
    historial: [],
  }));
}
