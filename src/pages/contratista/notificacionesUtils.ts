import { calcularEstadoTrabajador, contratoTrabajadorVencido, esTrabajadorAsignado, getProblemasFichaTrabajador, obtenerDiasRestantes } from '../../data/localStorageDb';
import { Contratista, PreferenciasNotificacionesContratista, Proyecto, Requisito, Trabajador } from '../../types';
import { buildAcreditacionRows, estadoUILabel } from '../admin/acreditacionUtils';
import { buildRequisitosEmpresa, buildRequisitosTrabajador, motivoRechazo, RequisitoConDoc } from './inicio/inicioUtils';

export type TipoNotificacionContratista = 'accion' | 'preventiva' | 'revision' | 'positiva';
export type DestinoNotificacion = { tipo: 'documentos' | 'trabajador' | 'acreditacion'; trabajador?: Trabajador };

export interface NotificacionContratista {
  id: string;
  tipo: TipoNotificacionContratista;
  proyectoId: string;
  proyectoNombre: string;
  titulo: string;
  descripcion: string;
  fecha?: string;
  cta: string;
  destino: DestinoNotificacion;
  prioridad: number;
}

interface Params {
  contratista: Contratista;
  proyectos: Proyecto[];
  requisitos: Requisito[];
  preferencias: PreferenciasNotificacionesContratista;
}

const versionId = (item: RequisitoConDoc) => `v${item.doc?.version || 1}`;
const fechaItem = (item: RequisitoConDoc) => item.doc?.fechaRevisado || item.doc?.subido;
const proyectoOperativo = (proyecto: Proyecto): boolean =>
  ['activo', 'active'].includes(String(proyecto.estado || '').trim().toLocaleLowerCase('es'));

export function buildNotificacionesContratista({ contratista, proyectos, requisitos, preferencias }: Params): NotificacionContratista[] {
  const result: NotificacionContratista[] = [];
  const proyectosOperativos = proyectos.filter(proyectoOperativo);
  const rows = buildAcreditacionRows([contratista], proyectosOperativos, []);

  proyectosOperativos.forEach(proyecto => {
    const empresa = buildRequisitosEmpresa(contratista, proyecto.id, requisitos);
    const trabajadores = (contratista.trabajadores || []).filter(worker => esTrabajadorAsignado(worker, proyecto.id, proyectos));
    const itemsTrabajadores = trabajadores.flatMap(worker => buildRequisitosTrabajador(worker, proyecto.id, requisitos));

    if (preferencias.documentoRechazado) {
      empresa.filter(item => item.requisito.obligatorio && ['Rechazado', 'Vencido'].includes(item.estado)).forEach(item => result.push({
        id: `${item.estado.toLowerCase()}:empresa:${proyecto.id}:${item.requisito.id}:${versionId(item)}`,
        tipo: 'accion', proyectoId: proyecto.id, proyectoNombre: proyecto.nombre,
        titulo: `${item.requisito.nombre} ${item.estado === 'Vencido' ? 'está vencido' : 'fue rechazado'}`,
        descripcion: item.estado === 'Rechazado' ? motivoRechazo(item.doc) : 'Debes renovar el documento obligatorio para recuperar sus habilitaciones.',
        fecha: fechaItem(item), cta: item.estado === 'Vencido' ? 'Renovar' : 'Corregir', destino: { tipo: 'documentos' }, prioridad: 0,
      }));
      itemsTrabajadores.filter(item => item.requisito.obligatorio && ['Rechazado', 'Vencido'].includes(item.estado) && item.worker).forEach(item => result.push({
        id: `${item.estado.toLowerCase()}:trabajador:${proyecto.id}:${item.worker!.rut}:${item.requisito.id}:${versionId(item)}`,
        tipo: 'accion', proyectoId: proyecto.id, proyectoNombre: proyecto.nombre,
        titulo: `${item.worker!.nombre} quedó bloqueado`,
        descripcion: `${item.requisito.nombre} ${item.estado === 'Vencido' ? 'está vencido' : 'fue rechazado'}. El trabajador no puede ingresar a faena hasta corregir el requisito.`,
        fecha: fechaItem(item), cta: 'Ver trabajador', destino: { tipo: 'trabajador', trabajador: item.worker }, prioridad: 1,
      }));
    }

    if (preferencias.documentoPorVencer) {
      [...empresa, ...itemsTrabajadores].filter(item => item.requisito.obligatorio && item.estado === 'Por vencer' && item.doc).forEach(item => {
        const dias = obtenerDiasRestantes(item.doc!.vencimiento);
        result.push({
          id: `por-vencer:${item.worker ? 'trabajador' : 'empresa'}:${proyecto.id}:${item.worker?.rut || contratista.id}:${item.requisito.id}:${versionId(item)}`,
          tipo: 'preventiva', proyectoId: proyecto.id, proyectoNombre: proyecto.nombre,
          titulo: item.worker ? `${item.requisito.nombre} de ${item.worker.nombre} vence en ${dias} días` : `${item.requisito.nombre} vence en ${dias} días`,
          descripcion: item.worker ? `El documento sigue vigente y ${item.worker.nombre} mantiene acceso habilitado hasta su vencimiento.` : 'El documento de empresa sigue vigente hasta su vencimiento.',
          fecha: item.doc!.vencimiento, cta: 'Renovar', destino: item.worker ? { tipo: 'trabajador', trabajador: item.worker } : { tipo: 'documentos' }, prioridad: 2,
        });
      });
    }

    [...empresa, ...itemsTrabajadores].filter(item => item.requisito.obligatorio && item.estado === 'En revisión').forEach(item => result.push({
      id: `revision:${item.worker ? 'trabajador' : 'empresa'}:${proyecto.id}:${item.worker?.rut || contratista.id}:${item.requisito.id}:${versionId(item)}`,
      tipo: 'revision', proyectoId: proyecto.id, proyectoNombre: proyecto.nombre,
      titulo: `${item.requisito.nombre}${item.worker ? ` de ${item.worker.nombre}` : ''} está en revisión`,
      descripcion: `La versión ${item.doc?.version || 1} fue enviada correctamente. No necesitas hacer nada mientras Acredita la revisa.`,
      fecha: fechaItem(item), cta: 'Ver', destino: item.worker ? { tipo: 'trabajador', trabajador: item.worker } : { tipo: 'documentos' }, prioridad: 3,
    }));

    const row = rows.find(item => item.proyectoId === proyecto.id);
    if (preferencias.acreditacionAprobada && row && estadoUILabel(row.estado) === 'Acreditado') result.push({
      id: `acreditacion-aprobada:${proyecto.id}:${row.company.ok}-${row.workers.ok}`,
      tipo: 'positiva', proyectoId: proyecto.id, proyectoNombre: proyecto.nombre, titulo: 'Acreditación aprobada',
      descripcion: 'Empresa y trabajadores cumplen todos los requisitos obligatorios del proyecto.', cta: 'Ver proyecto', destino: { tipo: 'acreditacion' }, prioridad: 4,
    });

    if (preferencias.cambioEstadoTrabajador) trabajadores.forEach(worker => {
      const estado = calcularEstadoTrabajador(worker, proyecto.id);
      const problemasFicha = getProblemasFichaTrabajador(worker, proyecto.id, contratista.id);
      const requisitosAplicables = buildRequisitosTrabajador(worker, proyecto.id, requisitos);

      if (!contratoTrabajadorVencido(worker) && problemasFicha.length > 0) {
        result.push({
          id: `ficha-incompleta:${proyecto.id}:${worker.rut}:${problemasFicha.join('|')}`,
          tipo: 'accion', proyectoId: proyecto.id, proyectoNombre: proyecto.nombre,
          titulo: `${worker.nombre} tiene la ficha incompleta`,
          descripcion: `Falta completar: ${problemasFicha.join(', ')}. Mientras la ficha esté incompleta, el trabajador no puede quedar habilitado.`,
          cta: 'Completar ficha', destino: { tipo: 'trabajador', trabajador: worker }, prioridad: 1,
        });
      } else if (!contratoTrabajadorVencido(worker) && problemasFicha.length === 0 && requisitosAplicables.length === 0) {
        result.push({
          id: `matriz-pendiente:${proyecto.id}:${worker.rut}`,
          tipo: 'revision', proyectoId: proyecto.id, proyectoNombre: proyecto.nombre,
          titulo: `${worker.nombre} no tiene una matriz documental aplicable`,
          descripcion: 'La ficha laboral está completa, pero la combinación de servicio/categoría no tiene requisitos aplicables. Acredita o el Mandante debe revisar la configuración.',
          cta: 'Ver trabajador', destino: { tipo: 'trabajador', trabajador: worker }, prioridad: 3,
        });
      }
      if (worker.fechaTerminoContrato) {
        const diasContrato = obtenerDiasRestantes(worker.fechaTerminoContrato);
        if (diasContrato < 0) {
          result.push({
            id: `contrato-vencido:${proyecto.id}:${worker.rut}:${worker.fechaTerminoContrato}`,
            tipo: 'accion', proyectoId: proyecto.id, proyectoNombre: proyecto.nombre,
            titulo: `${worker.nombre} tiene el contrato vencido`,
            descripcion: `El vínculo laboral terminó el ${worker.fechaTerminoContrato}. El trabajador permanece sin acceso hasta registrar una renovación o un nuevo contrato.`,
            fecha: worker.fechaTerminoContrato, cta: 'Ver trabajador', destino: { tipo: 'trabajador', trabajador: worker }, prioridad: 0,
          });
        } else if (diasContrato <= 30) {
          result.push({
            id: `contrato-por-vencer:${proyecto.id}:${worker.rut}:${worker.fechaTerminoContrato}`,
            tipo: 'preventiva', proyectoId: proyecto.id, proyectoNombre: proyecto.nombre,
            titulo: diasContrato === 0 ? `El contrato de ${worker.nombre} vence hoy` : `El contrato de ${worker.nombre} vence en ${diasContrato} días`,
            descripcion: 'Actualiza o renueva la relación laboral antes del vencimiento para evitar que el trabajador pierda su habilitación.',
            fecha: worker.fechaTerminoContrato, cta: 'Ver trabajador', destino: { tipo: 'trabajador', trabajador: worker }, prioridad: 2,
          });
        }
      }
      const evidencia = buildRequisitosTrabajador(worker, proyecto.id, requisitos).find(item => item.doc?.historial?.some(version => version.estado === 'rechazado'));
      if ((estado === 'aprobado' || estado === 'por_vencer') && evidencia) result.push({
        id: `trabajador-habilitado:${proyecto.id}:${worker.rut}:${evidencia.requisito.id}:${versionId(evidencia)}`,
        tipo: 'positiva', proyectoId: proyecto.id, proyectoNombre: proyecto.nombre, titulo: `${worker.nombre} volvió a quedar habilitado`,
        descripcion: `${evidencia.requisito.nombre} fue corregido y el estado actual permite su acceso a faena.`, fecha: fechaItem(evidencia), cta: 'Ver trabajador', destino: { tipo: 'trabajador', trabajador: worker }, prioridad: 4,
      });
    });
  });

  return result.sort((a, b) => a.prioridad - b.prioridad || a.proyectoNombre.localeCompare(b.proyectoNombre) || a.id.localeCompare(b.id));
}
