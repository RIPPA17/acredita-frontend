import {
  calcularEstadoTrabajador,
  DEMO_TODAY,
  esPorVencerPorFecha,
  esVencidoPorFecha,
  getContratistas,
  saveContratistas,
} from '../../data/localStorageDb';
import { Documento, Requisito, Trabajador } from '../../types';
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
  if (doc.estado === 'revision') return 'En revisión';
  if (doc.estado === 'por_vencer') return 'Por vencer';
  if (esVencidoPorFecha(doc.vencimiento)) return 'Vencido';
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

function fechaCargaDemo(): string {
  return new Intl.DateTimeFormat('es-CL', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(DEMO_TODAY);
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

export interface SubirDocumentoRequisitoParams {
  contratistaId: string;
  proyectoId: string;
  requisito: Requisito;
  trabajadorRut?: string;
}

export function subirDocumentoRequisito({
  contratistaId,
  proyectoId,
  requisito,
  trabajadorRut,
}: SubirDocumentoRequisitoParams): { success: boolean; documento?: Documento; error?: string } {
  const contratistas = getContratistas();
  const contratista = contratistas.find(item => item.id === contratistaId);
  if (!contratista) return { success: false, error: 'No fue posible encontrar al contratista.' };

  let documentos: Documento[];
  let trabajador: Trabajador | undefined;
  if (trabajadorRut) {
    trabajador = contratista.trabajadores?.find(item => item.rut === trabajadorRut);
    if (!trabajador) return { success: false, error: 'No fue posible encontrar al trabajador.' };
    trabajador.documentos ||= [];
    documentos = trabajador.documentos;
  } else {
    documentos = contratista.documentos;
  }

  let documento = matchDocumentoRequisito(documentos, proyectoId, requisito.nombre);
  const fecha = fechaCargaDemo();

  if (!documento) {
    documento = {
      id: idDocumento(contratistaId, proyectoId, requisito.id, trabajadorRut),
      nombre: requisito.nombre,
      categoria: requisito.categoria,
      estado: 'revision',
      vencimiento: '—',
      proyectoId,
      subido: fecha,
      version: 1,
      archivoReferencia: `${slug(requisito.nombre)}-v1.pdf`,
      historial: [],
    };
    documentos.push(documento);
  } else {
    const versionAnterior = documento.version || 1;
    const tieneVersionAnterior = Boolean(
      documento.archivoReferencia || documento.subido || documento.estado !== 'pendiente'
    );
    if (tieneVersionAnterior) {
      documento.historial = [
        ...(documento.historial || []),
        {
          version: versionAnterior,
          estado: documento.estado,
          fecha: documento.fechaRevisado || documento.subido || '—',
          motivoRechazo: documento.motivoRechazo || documento.motivo,
          explicacionRechazo: documento.explicacionRechazo || documento.observacion,
          verificador: documento.revisor,
        },
      ];
      documento.version = versionAnterior + 1;
    } else {
      documento.version = versionAnterior;
    }
    documento.estado = 'revision';
    documento.subido = fecha;
    documento.archivoReferencia = `${slug(requisito.nombre)}-v${documento.version || 1}.pdf`;
    documento.motivoRechazo = undefined;
    documento.explicacionRechazo = undefined;
    documento.solucionRechazo = undefined;
    documento.motivo = undefined;
    documento.observacion = undefined;
    documento.revisor = undefined;
    documento.fechaRevisado = undefined;
  }

  if (trabajador) trabajador.estado = calcularEstadoTrabajador(trabajador, proyectoId);
  saveContratistas(contratistas);
  return { success: true, documento };
}
