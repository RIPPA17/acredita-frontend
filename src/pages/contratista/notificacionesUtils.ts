import { calcularEstadoTrabajador, contratoTrabajadorVencido, esTrabajadorAsignado, getProblemasFichaTrabajador, obtenerDiasRestantes } from '../../data/localStorageDb';
import { Contratista, PreferenciasNotificacionesContratista, Proyecto, Requisito, Trabajador } from '../../types';
import { buildAcreditacionRows, estadoUILabel } from '../admin/acreditacionUtils';
import { proyectoOperativoParaContratista } from '../../data/operationalCore';
import { buildRequisitosEmpresa, buildRequisitosTrabajador, motivoRechazo, RequisitoConDoc } from './inicio/inicioUtils';

export type TipoNotificacionContratista = 'accion' | 'preventiva' | 'revision' | 'positiva' | 'informativa';
export type NivelNotificacionContratista = 'critical' | 'action' | 'preventive' | 'info';
export type SituacionNotificacionContratista = 'activa' | 'resuelta';
export type DestinoNotificacion = { tipo: 'documentos' | 'trabajador' | 'acreditacion' | 'operacion' | 'proyecto'; trabajador?: Trabajador };

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
  eventType?: string;
  nivel?: NivelNotificacionContratista;
  situacion?: SituacionNotificacionContratista;
  persistida?: boolean;
  requisitoId?: string;
  trabajadorRut?: string;
}

interface Params {
  contratista: Contratista;
  proyectos: Proyecto[];
  requisitos: Requisito[];
  preferencias: PreferenciasNotificacionesContratista;
}

const versionId = (item: RequisitoConDoc) => `v${item.doc?.versionEnTramite?.version || item.doc?.version || 1}`;
const fechaItem = (item: RequisitoConDoc) => item.doc?.fechaRevisado || item.doc?.subido;
export function buildNotificacionesContratista({ contratista, proyectos, requisitos, preferencias }: Params): NotificacionContratista[] {
  const result: NotificacionContratista[] = [];
  const proyectosOperativos = proyectos.filter(proyecto => proyectoOperativoParaContratista(proyecto, contratista.id));
  const rows = buildAcreditacionRows([contratista], proyectosOperativos, []);

  proyectosOperativos.forEach(proyecto => {
    const empresa = buildRequisitosEmpresa(contratista, proyecto.id, requisitos);
    const trabajadores = (contratista.trabajadores || []).filter(worker => esTrabajadorAsignado(worker, proyecto.id, proyectos));
    const itemsTrabajadores = trabajadores.flatMap(worker => buildRequisitosTrabajador(worker, proyecto.id, requisitos));

    if (preferencias.documentoRechazado) {
      empresa.filter(item => item.requisito.obligatorio && (['Rechazado', 'Vencido'].includes(item.estado) || item.doc?.versionEnTramite?.estado === 'rechazado')).forEach(item => {
        const renewalRejected = item.doc?.versionEnTramite?.estado === 'rechazado';
        result.push({
          id: `${renewalRejected ? 'renovacion-rechazada' : item.estado.toLowerCase()}:empresa:${proyecto.id}:${item.requisito.id}:${versionId(item)}`,
          tipo: 'accion', proyectoId: proyecto.id, proyectoNombre: proyecto.nombre,
          titulo: renewalRejected ? `Renovación de ${item.requisito.nombre} rechazada` : `${item.requisito.nombre} ${item.estado === 'Vencido' ? 'está vencido' : 'fue rechazado'}`,
          descripcion: renewalRejected
            ? `${item.doc?.versionEnTramite?.explicacionRechazo || item.doc?.versionEnTramite?.motivoRechazo || 'Debes corregir la renovación.'} La versión ${item.doc?.version || 1} continúa vigente${item.doc?.vencimiento && item.doc.vencimiento !== '—' ? ` hasta ${item.doc.vencimiento}` : ''}.`
            : item.estado === 'Rechazado' ? motivoRechazo(item.doc) : 'Debes renovar el documento obligatorio para recuperar sus habilitaciones.',
          fecha: renewalRejected ? item.doc?.versionEnTramite?.fecha : fechaItem(item),
          cta: renewalRejected ? 'Corregir renovación' : item.estado === 'Vencido' ? 'Renovar' : 'Corregir',
          destino: { tipo: 'documentos' },
          requisitoId: item.requisito.id,
          prioridad: renewalRejected ? 2 : 0,
        });
      });
      itemsTrabajadores.filter(item => item.requisito.obligatorio && item.worker && (['Rechazado', 'Vencido'].includes(item.estado) || item.doc?.versionEnTramite?.estado === 'rechazado')).forEach(item => {
        const renewalRejected = item.doc?.versionEnTramite?.estado === 'rechazado';
        result.push({
          id: `${renewalRejected ? 'renovacion-rechazada' : item.estado.toLowerCase()}:trabajador:${proyecto.id}:${item.worker!.rut}:${item.requisito.id}:${versionId(item)}`,
          tipo: 'accion', proyectoId: proyecto.id, proyectoNombre: proyecto.nombre,
          titulo: renewalRejected ? `Renovación de ${item.requisito.nombre} de ${item.worker!.nombre} rechazada` : `${item.worker!.nombre} quedó bloqueado`,
          descripcion: renewalRejected
            ? `${item.doc?.versionEnTramite?.explicacionRechazo || item.doc?.versionEnTramite?.motivoRechazo || 'Debes corregir la renovación.'} La versión vigente anterior mantiene la habilitación hasta su vencimiento.`
            : `${item.requisito.nombre} ${item.estado === 'Vencido' ? 'está vencido' : 'fue rechazado'}. El trabajador no puede ingresar a faena hasta corregir el requisito.`,
          fecha: renewalRejected ? item.doc?.versionEnTramite?.fecha : fechaItem(item),
          cta: 'Ver trabajador', destino: { tipo: 'trabajador', trabajador: item.worker }, requisitoId: item.requisito.id, trabajadorRut: item.worker.rut, prioridad: renewalRejected ? 2 : 1,
        });
      });
    }

    if (preferencias.documentoPorVencer) {
      [...empresa, ...itemsTrabajadores].filter(item => item.requisito.obligatorio && item.estado === 'Por vencer' && item.doc && !item.doc.versionEnTramite).forEach(item => {
        const dias = obtenerDiasRestantes(item.doc!.vencimiento);
        result.push({
          id: `por-vencer:${item.worker ? 'trabajador' : 'empresa'}:${proyecto.id}:${item.worker?.rut || contratista.id}:${item.requisito.id}:${versionId(item)}`,
          tipo: 'preventiva', proyectoId: proyecto.id, proyectoNombre: proyecto.nombre,
          titulo: item.worker ? `${item.requisito.nombre} de ${item.worker.nombre} vence en ${dias} días` : `${item.requisito.nombre} vence en ${dias} días`,
          descripcion: item.worker ? `El documento sigue vigente y ${item.worker.nombre} mantiene acceso habilitado hasta su vencimiento.` : 'El documento de empresa sigue vigente hasta su vencimiento.',
          fecha: item.doc!.vencimiento, cta: 'Renovar', destino: item.worker ? { tipo: 'trabajador', trabajador: item.worker } : { tipo: 'documentos' }, requisitoId: item.requisito.id, trabajadorRut: item.worker?.rut, prioridad: 2,
        });
      });
    }

    [...empresa, ...itemsTrabajadores].filter(item => item.requisito.obligatorio && (item.estado === 'En revisión' || item.doc?.versionEnTramite?.estado === 'revision')).forEach(item => {
      const renewal = item.doc?.versionEnTramite?.estado === 'revision' ? item.doc.versionEnTramite : undefined;
      result.push({
        id: `revision:${item.worker ? 'trabajador' : 'empresa'}:${proyecto.id}:${item.worker?.rut || contratista.id}:${item.requisito.id}:${versionId(item)}`,
        tipo: 'revision', proyectoId: proyecto.id, proyectoNombre: proyecto.nombre,
        titulo: `${renewal ? 'Renovación de ' : ''}${item.requisito.nombre}${item.worker ? ` de ${item.worker.nombre}` : ''} está en revisión`,
        descripcion: renewal
          ? `La versión ${renewal.version} está siendo revisada. La versión ${item.doc?.version || 1} sigue vigente${item.doc?.vencimiento && item.doc.vencimiento !== '—' ? ` hasta ${item.doc.vencimiento}` : ''}; no necesitas volver a subirla.`
          : `La versión ${item.doc?.version || 1} fue enviada correctamente. No necesitas hacer nada mientras Acredita la revisa.`,
        fecha: renewal?.fecha || fechaItem(item), cta: 'Ver', destino: item.worker ? { tipo: 'trabajador', trabajador: item.worker } : { tipo: 'documentos' }, requisitoId: item.requisito.id, trabajadorRut: item.worker?.rut, prioridad: 3,
      });
    });

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
          cta: 'Completar ficha', destino: { tipo: 'trabajador', trabajador: worker }, trabajadorRut: worker.rut, prioridad: 1,
        });
      } else if (!contratoTrabajadorVencido(worker) && problemasFicha.length === 0 && requisitosAplicables.length === 0) {
        result.push({
          id: `matriz-pendiente:${proyecto.id}:${worker.rut}`,
          tipo: 'revision', proyectoId: proyecto.id, proyectoNombre: proyecto.nombre,
          titulo: `${worker.nombre} no tiene una matriz documental aplicable`,
          descripcion: 'La ficha laboral está completa, pero la combinación de servicio/categoría no tiene requisitos aplicables. Acredita o el Mandante debe revisar la configuración.',
          cta: 'Ver trabajador', destino: { tipo: 'trabajador', trabajador: worker }, trabajadorRut: worker.rut, prioridad: 3,
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
            fecha: worker.fechaTerminoContrato, cta: 'Ver trabajador', destino: { tipo: 'trabajador', trabajador: worker }, trabajadorRut: worker.rut, prioridad: 0,
          });
        } else if (diasContrato <= 30) {
          result.push({
            id: `contrato-por-vencer:${proyecto.id}:${worker.rut}:${worker.fechaTerminoContrato}`,
            tipo: 'preventiva', proyectoId: proyecto.id, proyectoNombre: proyecto.nombre,
            titulo: diasContrato === 0 ? `El contrato de ${worker.nombre} vence hoy` : `El contrato de ${worker.nombre} vence en ${diasContrato} días`,
            descripcion: 'Actualiza o renueva la relación laboral antes del vencimiento para evitar que el trabajador pierda su habilitación.',
            fecha: worker.fechaTerminoContrato, cta: 'Ver trabajador', destino: { tipo: 'trabajador', trabajador: worker }, trabajadorRut: worker.rut, prioridad: 2,
          });
        }
      }
      const evidencia = buildRequisitosTrabajador(worker, proyecto.id, requisitos).find(item => item.doc?.historial?.some(version => version.estado === 'rechazado'));
      if ((estado === 'aprobado' || estado === 'por_vencer') && evidencia) result.push({
        id: `trabajador-habilitado:${proyecto.id}:${worker.rut}:${evidencia.requisito.id}:${versionId(evidencia)}`,
        tipo: 'positiva', proyectoId: proyecto.id, proyectoNombre: proyecto.nombre, titulo: `${worker.nombre} volvió a quedar habilitado`,
        descripcion: `${evidencia.requisito.nombre} fue corregido y el estado actual permite su acceso a faena.`, fecha: fechaItem(evidencia), cta: 'Ver trabajador', destino: { tipo: 'trabajador', trabajador: worker }, trabajadorRut: worker.rut, prioridad: 4,
      });
    });
  });

  return result
    .map(item => {
      const prefix = item.id.split(':')[0];
      const eventType = prefix === 'rechazado' || prefix === 'renovacion-rechazada'
        ? 'document_rejected'
        : prefix === 'vencido'
          ? 'document_expired'
          : prefix === 'por-vencer'
            ? 'document_expiring'
            : prefix === 'revision'
              ? 'document_in_review'
              : prefix === 'acreditacion-aprobada'
                ? 'accreditation_approved'
                : prefix === 'trabajador-habilitado'
                  ? 'worker_enabled'
                  : prefix === 'contrato-vencido'
                    ? 'worker_contract_expired'
                    : prefix === 'contrato-por-vencer'
                      ? 'worker_contract_expiring'
                      : prefix === 'ficha-incompleta'
                        ? 'worker_blocked'
                        : prefix;
      const nivel: NivelNotificacionContratista = item.tipo === 'accion'
        ? 'action'
        : item.tipo === 'preventiva'
          ? 'preventive'
          : 'info';
      return { ...item, eventType, nivel, situacion: 'activa' as const };
    })
    .sort((a, b) => a.prioridad - b.prioridad || a.proyectoNombre.localeCompare(b.proyectoNombre) || a.id.localeCompare(b.id));
}
