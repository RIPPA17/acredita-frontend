import { useRef, useState, type ChangeEvent } from 'react';
import { ArrowLeft, Pencil, Search, UserMinus, UserPlus } from 'lucide-react';
import {
  calcularEstadoTrabajador,
  contratoTrabajadorVencido,
  esTrabajadorAsignado,
  getMotivoBloqueoTrabajador,
  getProblemasFichaTrabajador,
  getRequisitos,
  obtenerDiasRestantes,
  requisitoAplicaATrabajador,
} from '../../data/localStorageDb';
import { AsignacionTrabajador, Contratista, Documento, Mandante, Proyecto, Requisito, Trabajador } from '../../types';
import { openDocumentFile, uploadDocumentFile } from '../../data/supabaseDocumentStorage';
import { DocEstado } from '../admin/acreditacionUtils';
import { impactoLabel } from './inicio/inicioUtils';
import { getServiciosProyecto, proyectoOperativoParaContratista } from '../../data/operationalCore';
import {
  documentoVigente,
  getEstadoDocumentoEfectivo,
  matchDocumentoRequisito,
  normalizarNombreDocumento,
} from './documentosUtils';

type EstadoTrabajador = ReturnType<typeof calcularEstadoTrabajador>;
type FiltroEstado = 'todos' | 'aprobado' | 'pendiente' | 'por_vencer' | 'rechazado';

interface ChecklistItem {
  requisito: Requisito;
  documento?: Documento;
  estado: DocEstado;
}

interface ResumenTrabajador {
  trabajador: Trabajador;
  estado: EstadoTrabajador;
  checklist: ChecklistItem[];
  vigentes: number;
  totalObligatorios: number;
  porcentaje: number;
}

const ESTADO_UI: Record<EstadoTrabajador, { label: string; badge: string }> = {
  aprobado: { label: 'Habilitado', badge: 'tw-badge-green' },
  por_vencer: { label: 'Por vencer', badge: 'tw-badge-yellow' },
  pendiente: { label: 'En proceso', badge: 'tw-badge-blue' },
  rechazado: { label: 'Bloqueado', badge: 'tw-badge-red' },
};

const DOC_UI: Record<DocEstado, { label: string; badge: string }> = {
  Aprobado: { label: 'Aprobado', badge: 'tw-badge-green' },
  'Por vencer': { label: 'Por vencer', badge: 'tw-badge-yellow' },
  'En revisión': { label: 'En revisión', badge: 'tw-badge-blue' },
  Pendiente: { label: 'Pendiente', badge: 'tw-badge-gray' },
  Rechazado: { label: 'Rechazado', badge: 'tw-badge-red' },
  Vencido: { label: 'Vencido', badge: 'tw-badge-red' },
};


function getAsignacionContextual(trabajador: Trabajador, proyectoId: string, modoConsulta: boolean): AsignacionTrabajador | undefined {
  const delProyecto = (trabajador.asignaciones || [])
    .filter(item => item.proyectoId === proyectoId)
    .sort((a, b) => (b.fechaIngreso || '').localeCompare(a.fechaIngreso || ''));
  if (modoConsulta) return delProyecto[0];
  return delProyecto.find(item => item.estado === 'activa');
}

function tipoContratoAsignacionLabel(asignacion?: AsignacionTrabajador): string {
  if (!asignacion?.tipoContrato) return 'No registrado para este período';
  if (asignacion.tipoContrato === 'plazo_fijo') {
    return asignacion.fechaTerminoContrato ? `Plazo fijo · hasta ${asignacion.fechaTerminoContrato}` : 'Plazo fijo';
  }
  if (asignacion.tipoContrato === 'obra_faena') return 'Obra o faena determinada';
  return 'Indefinido';
}

function regimenAsignacionLabel(asignacion?: AsignacionTrabajador): string | undefined {
  if (!asignacion?.regimenEspecial) return undefined;
  const labels: Record<string, string> = {
    servicios_transitorios: 'Servicios transitorios',
    aprendizaje: 'Aprendizaje',
    agricola_temporada: 'Agrícola de temporada',
    casa_particular: 'Casa particular',
    gente_mar_portuario_buceo: 'Gente de mar / portuario / buceo',
    artes_espectaculos: 'Artes y espectáculos',
    deportista_profesional: 'Deportista profesional',
    tripulacion_aerea: 'Tripulación aérea',
    plataforma_digital_dependiente: 'Plataforma digital dependiente',
    otro: asignacion.detalleRegimenEspecial || 'Otro régimen especial',
  };
  return labels[asignacion.regimenEspecial];
}

function tipoContratoLabel(trabajador: Trabajador): string {
  if (trabajador.tipoContrato === 'plazo_fijo') {
    return trabajador.fechaTerminoContrato
      ? `Plazo fijo · hasta ${trabajador.fechaTerminoContrato}`
      : 'Plazo fijo';
  }
  if (trabajador.tipoContrato === 'obra_faena') return 'Obra o faena determinada';
  if (trabajador.tipoContrato === 'indefinido') return 'Indefinido';
  return 'No informado';
}

function regimenEspecialLabel(trabajador: Trabajador): string | undefined {
  const labels: Record<string, string> = {
    servicios_transitorios: 'Servicios transitorios',
    aprendizaje: 'Aprendizaje',
    agricola_temporada: 'Agrícola de temporada',
    casa_particular: 'Casa particular',
    gente_mar_portuario_buceo: 'Gente de mar / portuario / buceo',
    artes_espectaculos: 'Artes y espectáculos',
    deportista_profesional: 'Deportista profesional',
    tripulacion_aerea: 'Tripulación aérea',
    plataforma_digital_dependiente: 'Plataforma digital dependiente',
    otro: trabajador.detalleRegimenEspecial || 'Otro régimen especial',
  };
  return trabajador.regimenEspecial ? labels[trabajador.regimenEspecial] : undefined;
}

function iniciales(nombre: string): string {
  return nombre.split(/\s+/).filter(Boolean).map(part => part[0]).join('').slice(0, 2).toUpperCase();
}

function historialAsignacionesCount(trabajadores: Trabajador[], proyectoId: string, estado: AsignacionTrabajador['estado']): number {
  return trabajadores.flatMap(item => item.asignaciones || []).filter(item => item.proyectoId === proyectoId && item.estado === estado).length;
}

function buildResumen(trabajador: Trabajador, proyectoId: string, requisitos: Requisito[]): ResumenTrabajador {
  const checklist = requisitos.filter(requisito => requisitoAplicaATrabajador(requisito, trabajador, proyectoId)).map(requisito => {
    const documento = matchDocumentoRequisito(trabajador.documentos, proyectoId, requisito.nombre);
    return { requisito, documento, estado: getEstadoDocumentoEfectivo(documento, requisito) };
  });
  const obligatorios = checklist.filter(item => item.requisito.obligatorio);
  const vigentes = obligatorios.filter(item => documentoVigente(item.documento, item.requisito)).length;
  const totalObligatorios = obligatorios.length;
  return {
    trabajador,
    estado: calcularEstadoTrabajador(trabajador, proyectoId),
    checklist,
    vigentes,
    totalObligatorios,
    porcentaje: checklist.length === 0 ? 0 : totalObligatorios === 0 ? 100 : Math.round((vigentes / totalObligatorios) * 100),
  };
}

function accionDocumento(item: ChecklistItem): { label: string; className: string; actionable: boolean } {
  const renewal = item.documento?.versionEnTramite;
  if (renewal?.estado === 'revision') return { label: 'En revisión', className: '', actionable: false };
  if (renewal?.estado === 'rechazado') return { label: 'Corregir renovación', className: 'tw-action-danger', actionable: true };
  if (item.estado === 'Pendiente') return { label: 'Subir', className: 'tw-action-primary', actionable: true };
  if (item.estado === 'Rechazado' || item.estado === 'Vencido') return { label: 'Corregir', className: 'tw-action-danger', actionable: true };
  if (item.estado === 'Por vencer') return { label: 'Renovar', className: 'tw-action-warning', actionable: true };
  return { label: 'Ver', className: '', actionable: false };
}

function motivoDocumento(documento?: Documento): string | undefined {
  return documento?.motivoRechazo || documento?.motivo || documento?.observacion || documento?.explicacionRechazo;
}

function motivoRenovacion(documento?: Documento): string | undefined {
  const renewal = documento?.versionEnTramite;
  return renewal?.motivoRechazo || renewal?.explicacionRechazo;
}

function solucionRenovacion(documento?: Documento): string | undefined {
  return documento?.versionEnTramite?.solucionRechazo;
}

export default function TrabajadoresTab({
  selectedWorkerForDocs,
  setSelectedWorkerForDocs,
  contratistaLogueado,
  selectedProyectoId,
  setSelectedProyectoId,
  misProyectos,
  allMandantes,
  setShowAddWorkerModal,
  onEditWorker,
  onRetireWorker,
  onDataChanged,
  showToast,
}: {
  selectedWorkerForDocs: Trabajador | null;
  setSelectedWorkerForDocs: (value: Trabajador | null) => void;
  contratistaLogueado: Contratista;
  selectedProyectoId: string;
  setSelectedProyectoId: (id: string) => void;
  misProyectos: Proyecto[];
  allMandantes: Mandante[];
  setShowAddWorkerModal: (value: boolean) => void;
  onEditWorker: (worker: Trabajador) => void;
  onRetireWorker: (worker: Trabajador) => Promise<void>;
  onDataChanged: () => void;
  showToast: (message: string, type?: 'success' | 'error' | 'warning') => void;
}) {
  const [search, setSearch] = useState('');
  const [filtro, setFiltro] = useState<FiltroEstado>('todos');
  const [uploadTarget, setUploadTarget] = useState<{ item: ChecklistItem; trabajador: Trabajador } | null>(null);
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const proyecto = misProyectos.find(item => item.id === selectedProyectoId) || misProyectos[0];
  const modoConsulta = !proyectoOperativoParaContratista(proyecto, contratistaLogueado.id);
  const requisitos = getRequisitos().filter(item =>
    item.proyectoId === selectedProyectoId && item.destino === 'trabajador' && item.activo !== false
  );
  const trabajadores = proyecto
    ? (contratistaLogueado.trabajadores || []).filter(item =>
        modoConsulta
          ? Boolean(item.asignaciones?.some(asignacion => asignacion.proyectoId === proyecto.id))
          : esTrabajadorAsignado(item, proyecto.id, misProyectos)
      )
    : [];
  const resumenes = trabajadores.map(item => buildResumen(item, selectedProyectoId, requisitos));
  const selectedWorker = selectedWorkerForDocs
    ? trabajadores.find(item => item.rut === selectedWorkerForDocs.rut)
    : undefined;
  const selected = selectedWorker ? buildResumen(selectedWorker, selectedProyectoId, requisitos) : undefined;
  const servicios = getServiciosProyecto(selectedProyectoId, contratistaLogueado.id);
  const servicioPorId = new Map(servicios.map(item => [item.id, item]));

  const cambiarProyecto = (id: string) => {
    setSelectedProyectoId(id);
    setSelectedWorkerForDocs(null);
  };

  const contextoDocumento = (item: ChecklistItem, trabajador: Trabajador) => ({
    contratistaId: contratistaLogueado.id,
    proyectoId: proyecto?.id || selectedProyectoId,
    requisito: {
      id: item.requisito.id,
      nombre: item.requisito.nombre,
      destino: item.requisito.destino,
    },
    trabajadorRut: trabajador.rut,
    obligacionId: item.documento?.obligacionId,
  });

  const ejecutarAccion = async (item: ChecklistItem, trabajador: Trabajador) => {
    const action = accionDocumento(item);
    if (modoConsulta && action.actionable) {
      showToast('Este proyecto está en modo histórico y solo permite consultar documentos existentes.', 'warning');
      return;
    }
    if (!action.actionable) {
      try {
        await openDocumentFile(contextoDocumento(item, trabajador));
      } catch (error) {
        showToast(error instanceof Error ? error.message : 'No fue posible abrir el documento.', 'error');
      }
      return;
    }
    setUploadTarget({ item, trabajador });
    fileInputRef.current?.click();
  };

  const procesarArchivo = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    const target = uploadTarget;
    setUploadTarget(null);
    if (!file || !target) return;
    const key = `${target.trabajador.rut}:${target.item.requisito.id}`;
    setUploadingKey(key);
    try {
      const result = await uploadDocumentFile(contextoDocumento(target.item, target.trabajador), file);
      onDataChanged();
      showToast(`${result.filename} enviado a revisión (versión ${result.version}).`, 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'No fue posible subir el archivo.', 'error');
    } finally {
      setUploadingKey(null);
    }
  };

  const fileInput = <input
    ref={fileInputRef}
    type="file"
    accept="application/pdf,image/jpeg,image/png,.pdf,.jpg,.jpeg,.png"
    style={{ display: 'none' }}
    onChange={procesarArchivo}
  />;

  if (!proyecto) return <div className="tw-empty">Todavía no tienes proyectos asociados.</div>;

  if (selected) {
    const asignacion = getAsignacionContextual(selected.trabajador, selectedProyectoId, modoConsulta);
    const servicio = asignacion?.servicioId ? servicioPorId.get(asignacion.servicioId) : undefined;
    const problemasFicha = modoConsulta ? [] : getProblemasFichaTrabajador(selected.trabajador, selectedProyectoId, contratistaLogueado.id);
    const contratoVencido = modoConsulta ? false : contratoTrabajadorVencido(selected.trabajador);
    const historialAsignaciones = [...(selected.trabajador.asignaciones || [])]
      .filter(item => item.proyectoId === selectedProyectoId)
      .sort((a, b) => (b.fechaIngreso || '').localeCompare(a.fechaIngreso || ''));
    const acreditacionHabilita = !modoConsulta && (selected.estado === 'aprobado' || selected.estado === 'por_vencer');
    const accesoHabilitado = acreditacionHabilita && asignacion?.estadoAcceso !== 'bloqueado';
    const candidatosVencimiento = selected.checklist
      .filter(item => item.documento && documentoVigente(item.documento, item.requisito))
      .map(item => ({ item, dias: obtenerDiasRestantes(item.documento!.vencimiento) }))
      .filter(value => value.dias >= 0 && value.dias < 99999)
      .sort((a, b) => a.dias - b.dias);
    const proximo = candidatosVencimiento[0];
    const bloqueos = selected.checklist.filter(item =>
      item.requisito.obligatorio && (item.estado === 'Rechazado' || item.estado === 'Vencido')
    );
    const pendientesObligatorios = selected.checklist.filter(item =>
      item.requisito.obligatorio && item.estado === 'Pendiente'
    );
    const revisionesObligatorias = selected.checklist.filter(item =>
      item.requisito.obligatorio && item.estado === 'En revisión'
    );
    const renovacionesEnRevision = selected.checklist.filter(item =>
      item.documento?.versionEnTramite?.estado === 'revision'
    );
    const renovacionesRechazadas = selected.checklist.filter(item =>
      item.documento?.versionEnTramite?.estado === 'rechazado'
    );
    const motivoReal = bloqueos.length > 0
      ? bloqueos.map(item => `${item.requisito.nombre}: ${motivoDocumento(item.documento) || item.estado.toLowerCase()}`).join(' · ')
      : (selected.estado === 'rechazado' ? getMotivoBloqueoTrabajador(selected.trabajador, selectedProyectoId) : undefined);

    return (
      <>
      {fileInput}
      <section className="tw-detail tw-card">
        <header className="tw-detail-head">
          <div className="tw-worker-identity">
            <button className="tw-back" onClick={() => setSelectedWorkerForDocs(null)} aria-label="Volver al directorio"><ArrowLeft size={17} /></button>
            <div className="tw-avatar">{iniciales(selected.trabajador.nombre)}</div>
            <div className="tw-min-0">
              <h2>{selected.trabajador.nombre}</h2>
              <p>{selected.trabajador.rut} · {asignacion?.cargo || selected.trabajador.cargo || 'Sin cargo'} · {servicio?.nombre || proyecto.nombre}</p>
            </div>
          </div>
          <div className="tw-detail-actions">
            {!modoConsulta && <button type="button" className="btn btn-secondary" onClick={() => onEditWorker(selected.trabajador)}><Pencil size={14} /> Editar</button>}
            {!modoConsulta && <button
              type="button"
              className="btn btn-ghost border border-red-200 text-red-700"
              onClick={() => {
                if (window.confirm(`¿Retirar a ${selected.trabajador.nombre} de este proyecto? Se conservarán su ficha, documentos e historial.`)) {
                  void onRetireWorker(selected.trabajador);
                }
              }}
            ><UserMinus size={14} /> Retirar</button>}
            <span className={`tw-badge ${modoConsulta ? 'tw-badge-gray' : ESTADO_UI[selected.estado].badge}`}>{modoConsulta ? 'Histórico' : problemasFicha.length > 0 && selected.estado === 'pendiente' ? 'Ficha incompleta' : ESTADO_UI[selected.estado].label}</span>
          </div>
        </header>

        <div className="tw-folder-summary">
          <div className="tw-folder-kpi"><span>Asignación</span><b>{asignacion?.estado === 'activa' ? 'Activa' : asignacion?.estado || 'Activa'}</b></div>
          <div className="tw-folder-kpi"><span>Contrato</span><b>{asignacion?.tipoContrato ? tipoContratoAsignacionLabel(asignacion) : modoConsulta ? 'No registrado para este período' : tipoContratoLabel(selected.trabajador)}</b></div>
          <div className="tw-folder-kpi"><span>Acceso a faena</span><b className={accesoHabilitado ? 'tw-text-green' : 'tw-text-red'}>{modoConsulta ? 'No operativo' : accesoHabilitado ? 'Habilitado' : 'No habilitado'}</b></div>
          <div className="tw-folder-kpi"><span>Documentos vigentes</span><b>{selected.vigentes}/{selected.totalObligatorios} · {selected.porcentaje}%</b></div>
          <div className="tw-folder-kpi"><span>Próximo vencimiento</span><b>{proximo?.item.documento?.vencimiento || 'Sin alertas'}</b></div>
        </div>

        <div className="tw-folder-body">
          <div className="tw-min-0">
            <h3 className="tw-section-title">Checklist de requisitos</h3>
            <div className="tw-checklist">
              {selected.checklist.length === 0 && (
                <div className={`tw-info ${modoConsulta ? '' : 'tw-info-yellow'}`}>
                  <strong>{modoConsulta ? 'Historial documental' : 'Configuración documental incompleta'}</strong>
                  <p>{modoConsulta ? 'Este período está cerrado. Revisa el historial de asignación y los documentos conservados del trabajador.' : 'No existen requisitos aplicables para la combinación actual de servicio y categoría del trabajador. Permanece en proceso hasta corregir la ficha o la matriz documental.'}</p>
                </div>
              )}
              {selected.checklist.map(item => {
                const action = accionDocumento(item);
                const estado = DOC_UI[item.estado];
                return (
                  <div className="tw-check-row" key={item.requisito.id}>
                    <div className="tw-min-0">
                      <div className="tw-check-title">{item.requisito.nombre}</div>
                      <div className="tw-check-meta">{item.requisito.obligatorio ? 'Obligatorio' : 'Opcional'} · {impactoLabel(item.requisito)}</div>
                      {item.estado === 'Rechazado' && motivoDocumento(item.documento) && (
                        <div className="mt-1 text-[10.5px] text-red-700">Motivo: {motivoDocumento(item.documento)}</div>
                      )}
                      {item.documento?.versionEnTramite?.estado === 'revision' && (
                        <div className="mt-1 text-[10.5px] text-blue-700">Renovación v{item.documento.versionEnTramite.version} en revisión. La versión vigente se conserva mientras corresponda.</div>
                      )}
                      {item.documento?.versionEnTramite?.estado === 'rechazado' && (
                        <div className="mt-1 text-[10.5px] text-red-700">Renovación rechazada: {motivoRenovacion(item.documento) || 'requiere corrección'}{solucionRenovacion(item.documento) ? ` · ${solucionRenovacion(item.documento)}` : ''}</div>
                      )}
                    </div>
                    <span className={`tw-badge ${estado.badge}`}>{estado.label}</span>
                    <div className="tw-validity">{item.documento?.vencimiento && item.documento.vencimiento !== '—' ? item.documento.vencimiento : '—'}</div>
                    <button
                      className={`tw-doc-action ${action.className}`}
                      disabled={uploadingKey === `${selected.trabajador.rut}:${item.requisito.id}` || (modoConsulta && action.actionable)}
                      onClick={() => void ejecutarAccion(item, selected.trabajador)}
                    >{uploadingKey === `${selected.trabajador.rut}:${item.requisito.id}` ? 'Subiendo…' : modoConsulta && action.actionable ? 'Sin acción' : action.label}</button>
                  </div>
                );
              })}
            </div>
          </div>

          <aside className="tw-side">
            <div className="tw-info"><strong>Relación laboral del período</strong><p>{asignacion?.tipoContrato ? tipoContratoAsignacionLabel(asignacion) : modoConsulta ? 'No registrada para este período histórico' : tipoContratoLabel(selected.trabajador)}{(asignacion?.fechaInicioContrato || (!modoConsulta && selected.trabajador.fechaInicioContrato)) ? ` · inicio ${asignacion?.fechaInicioContrato || selected.trabajador.fechaInicioContrato}` : ''}{(asignacion?.obraFaenaContrato || (!modoConsulta && selected.trabajador.obraFaenaContrato)) ? ` · ${asignacion?.obraFaenaContrato || selected.trabajador.obraFaenaContrato}` : ''}</p>{(regimenAsignacionLabel(asignacion) || (!modoConsulta && regimenEspecialLabel(selected.trabajador))) && <p>Régimen especial: {regimenAsignacionLabel(asignacion) || regimenEspecialLabel(selected.trabajador)}</p>}</div>
            {contratoVencido && <div className="tw-info tw-info-red"><strong>Contrato vencido</strong><p>El contrato terminó el {selected.trabajador.fechaTerminoContrato}. El acceso queda bloqueado hasta registrar una renovación o un nuevo vínculo laboral.</p></div>}
            {!contratoVencido && problemasFicha.length > 0 && <div className="tw-info tw-info-yellow"><strong>Ficha incompleta</strong><p>Completa: {problemasFicha.join(', ')}. El trabajador no puede quedar habilitado mientras falten estos datos.</p></div>}
            <div className="tw-info"><strong>Historial de asignaciones</strong>{historialAsignaciones.length === 0 ? <p>Sin períodos registrados.</p> : <div className="mt-2 space-y-2">{historialAsignaciones.map(item => <div key={item.id}><p>{item.fechaIngreso || 'Sin fecha'} → {item.fechaSalida || 'Actual'} · {item.estado === 'activa' ? 'Activa' : item.estado === 'baja' ? 'Baja' : 'Inactiva'}{item.cargo ? ` · ${item.cargo}` : ''}</p><p className="text-gray-400">{item.tipoContrato ? `${tipoContratoAsignacionLabel(item)}${item.fechaInicioContrato ? ` · contrato desde ${item.fechaInicioContrato}` : ''}${item.obraFaenaContrato ? ` · ${item.obraFaenaContrato}` : ''}` : 'Contrato del período no registrado (dato legado)'}</p></div>)}</div>}</div>
            {!modoConsulta && selected.estado === 'rechazado' && (
              <>
                <div className="tw-info tw-info-red"><strong>Qué bloquea el ingreso</strong><p>{motivoReal || 'Uno o más requisitos obligatorios requieren corrección.'}</p></div>
                <div className="tw-info"><strong>Qué debes hacer</strong><p>Corrige {bloqueos.length === 1 ? 'el requisito indicado' : `los ${bloqueos.length} requisitos bloqueantes`}. Cuando Acredita apruebe las nuevas versiones, el trabajador recuperará la habilitación para este proyecto.</p></div>
              </>
            )}
            {!modoConsulta && revisionesObligatorias.length > 0 && selected.estado === 'pendiente' && (
              <div className="tw-info"><strong>Esperando a Acredita</strong><p>{revisionesObligatorias.length === 1 ? 'Hay 1 documento obligatorio en revisión.' : `Hay ${revisionesObligatorias.length} documentos obligatorios en revisión.`} No necesitas volver a cargarlo mientras siga en este estado.</p></div>
            )}
            {!modoConsulta && pendientesObligatorios.length > 0 && selected.estado === 'pendiente' && problemasFicha.length === 0 && (
              <div className="tw-info tw-info-yellow"><strong>Acción requerida</strong><p>Falta cargar: {pendientesObligatorios.map(item => item.requisito.nombre).join(', ')}.</p></div>
            )}
            {!modoConsulta && renovacionesEnRevision.length > 0 && (
              <div className="tw-info"><strong>Renovaciones en revisión</strong><p>{renovacionesEnRevision.map(item => item.requisito.nombre).join(', ')}. La versión aprobada anterior sigue siendo la referencia vigente hasta su vencimiento.</p></div>
            )}
            {!modoConsulta && renovacionesRechazadas.length > 0 && (
              <div className="tw-info tw-info-yellow"><strong>Renovaciones que debes corregir</strong><p>{renovacionesRechazadas.map(item => item.requisito.nombre).join(', ')}. Puedes corregirlas sin perder la vigencia de una versión anterior que todavía esté aprobada.</p></div>
            )}
            {!modoConsulta && selected.estado === 'por_vencer' && <div className="tw-info tw-info-yellow"><strong>Acceso aún habilitado</strong><p>Puede seguir ingresando mientras el documento esté vigente. Renueva antes de su vencimiento.</p></div>}
            {!modoConsulta && selected.estado === 'pendiente' && <div className="tw-info"><strong>Estado en proceso</strong><p>{problemasFicha.length > 0 ? `La ficha laboral está incompleta: ${problemasFicha.join(', ')}.` : selected.checklist.length === 0 ? 'No hay requisitos aplicables para la configuración actual; revisa servicio, categoría o matriz documental.' : revisionesObligatorias.length > 0 && pendientesObligatorios.length === 0 ? 'La documentación obligatoria ya fue cargada y está esperando revisión de Acredita.' : 'Falta completar o aprobar documentación obligatoria. Aún no puede ingresar al proyecto.'}</p></div>}
            {!modoConsulta && selected.estado === 'aprobado' && <div className="tw-info"><strong>Trabajador habilitado</strong><p>Todos los requisitos obligatorios están vigentes para este proyecto.</p></div>}
            {modoConsulta && <div className="tw-info"><strong>Proyecto histórico · modo consulta</strong><p>Este trabajador y sus períodos se conservan como historial. No se pueden editar, retirar ni cargar nuevos antecedentes desde este proyecto.</p></div>}
          </aside>
        </div>
      </section>
      </>
    );
  }

  const habilitados = resumenes.filter(item => item.estado === 'aprobado' || item.estado === 'por_vencer').length;
  const porVencer = resumenes.filter(item => item.estado === 'por_vencer').length;
  const enProceso = resumenes.filter(item => item.estado === 'pendiente').length;
  const bloqueados = resumenes.filter(item => item.estado === 'rechazado').length;
  const query = normalizarNombreDocumento(search);
  const filtrados = resumenes.filter(item => {
    const matchesSearch = !query || [item.trabajador.nombre, item.trabajador.rut, item.trabajador.cargo || '']
      .some(value => normalizarNombreDocumento(value).includes(query));
    return matchesSearch && (modoConsulta || filtro === 'todos' || item.estado === filtro);
  });

  return (
    <>
    {fileInput}
    <div className="tw-page">
      <section className="tw-hero">
        <div className="tw-hero-row">
          <div>
            <div className="tw-eyebrow">Portal contratista</div>
            <h1>Trabajadores</h1>
            <p>Gestiona el personal asignado al proyecto, su estado de acreditación y los documentos que habilitan su ingreso a faena.</p>
          </div>
          <div className="tw-hero-actions">
            <div className="tw-picker">
              <label htmlFor="tw-project">Proyecto activo</label>
              <select id="tw-project" value={selectedProyectoId} onChange={event => cambiarProyecto(event.target.value)}>
                {misProyectos.map(item => {
                  const mandante = allMandantes.find(value => value.id === item.mandanteId);
                  return <option key={item.id} value={item.id}>{item.nombre} · {mandante?.nombre || 'Mandante'}</option>;
                })}
              </select>
            </div>
            {!modoConsulta && <button className="tw-add" onClick={() => setShowAddWorkerModal(true)}><UserPlus size={14} /> Agregar trabajador</button>}
          </div>
        </div>
      </section>

      <section className="tw-floating">
        {modoConsulta && <div className="tw-info mb-3"><strong>Proyecto histórico · modo consulta</strong><p>Puedes revisar trabajadores y períodos históricos, pero no agregar, editar, retirar ni cargar nuevos documentos.</p></div>}
        <div className="tw-kpis">
          <div className="tw-kpi"><span>Total trabajadores</span><b>{resumenes.length}</b><small>Asignados al proyecto</small></div>
          <div className="tw-kpi tw-kpi-green"><span>{modoConsulta ? 'Períodos activos al cierre' : 'Habilitados'}</span><b>{modoConsulta ? historialAsignacionesCount(trabajadores, selectedProyectoId, 'activa') : habilitados}</b><small>{modoConsulta ? 'Referencia histórica' : porVencer ? `${porVencer} con vencimiento próximo` : 'Sin alertas próximas'}</small></div>
          <div className="tw-kpi tw-kpi-blue"><span>{modoConsulta ? 'Períodos finalizados' : 'En proceso'}</span><b>{modoConsulta ? historialAsignacionesCount(trabajadores, selectedProyectoId, 'baja') : enProceso}</b><small>{modoConsulta ? 'Bajas conservadas' : 'Documentación pendiente o en revisión'}</small></div>
          <div className="tw-kpi tw-kpi-red"><span>{modoConsulta ? 'Acceso actual' : 'Bloqueados'}</span><b>{modoConsulta ? '—' : bloqueados}</b><small>{modoConsulta ? 'No aplica en modo histórico' : 'No pueden ingresar a faena'}</small></div>
        </div>

        <div className="tw-card tw-directory">
          <div className="tw-toolbar">
            <div className="tw-search-wrap"><Search size={15} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar por nombre, RUT o cargo..." /></div>
            {!modoConsulta && <select value={filtro} onChange={event => setFiltro(event.target.value as FiltroEstado)} aria-label="Filtrar trabajadores por estado">
              <option value="todos">Todos los estados</option>
              <option value="aprobado">Habilitados</option>
              <option value="pendiente">En proceso</option>
              <option value="por_vencer">Por vencer</option>
              <option value="rechazado">Bloqueados</option>
            </select>}
          </div>
          <div className="tw-table-head"><span>Trabajador</span><span>Cargo</span><span>Estado</span><span>Documentos</span><span>Acceso</span><span /></div>
          {filtrados.length === 0 ? <div className="tw-empty">No hay trabajadores que coincidan con los filtros.</div> : filtrados.map(item => {
            const acceso = !modoConsulta && (item.estado === 'aprobado' || item.estado === 'por_vencer');
            const problemasFicha = modoConsulta ? [] : getProblemasFichaTrabajador(item.trabajador, selectedProyectoId, contratistaLogueado.id);
            const motivo = !modoConsulta && item.estado === 'rechazado' ? getMotivoBloqueoTrabajador(item.trabajador, selectedProyectoId) : undefined;
            const estadoVisible = modoConsulta ? 'Histórico' : problemasFicha.length > 0 && item.estado === 'pendiente' ? 'Ficha incompleta' : ESTADO_UI[item.estado].label;
            return (
              <div className="tw-table-row" key={item.trabajador.rut}>
                <div className="tw-person"><div className="tw-avatar">{iniciales(item.trabajador.nombre)}</div><div className="tw-min-0"><strong>{item.trabajador.nombre}</strong><small>{item.trabajador.rut}</small></div></div>
                <div className="tw-cargo">{(() => {
                  const assignment = getAsignacionContextual(item.trabajador, selectedProyectoId, modoConsulta);
                  const service = assignment?.servicioId ? servicioPorId.get(assignment.servicioId) : undefined;
                  return <>{assignment?.cargo || item.trabajador.cargo || 'Sin cargo'}{service && <small>{service.nombre}</small>}</>;
                })()}</div>
                <div><span className={`tw-badge ${modoConsulta ? 'tw-badge-gray' : ESTADO_UI[item.estado].badge}`}>{estadoVisible}</span></div>
                <div className="tw-progress-cell"><div><span>{item.vigentes}/{item.totalObligatorios} vigentes</span><b>{item.porcentaje}%</b></div><div className="tw-progress"><i style={{ width: `${item.porcentaje}%` }} /></div></div>
                <div><strong className={acceso ? 'tw-access-ok' : 'tw-access-no'}>{modoConsulta ? 'No operativo' : acceso ? 'Habilitado' : 'No habilitado'}</strong><small>{modoConsulta ? 'Consulta de período histórico.' : item.estado === 'por_vencer' ? 'Válido hasta su vencimiento.' : item.estado === 'pendiente' ? problemasFicha.length > 0 ? `Ficha incompleta: ${problemasFicha.join(', ')}.` : item.checklist.length === 0 ? 'Revisar servicio, categoría o matriz documental.' : 'Faltan requisitos obligatorios.' : motivo || 'Sin bloqueos.'}</small></div>
                <button className={`tw-row-action ${!modoConsulta && item.estado === 'rechazado' ? 'tw-row-danger' : ''}`} onClick={() => setSelectedWorkerForDocs(item.trabajador)}>{modoConsulta ? 'Ver historial' : item.estado === 'rechazado' ? 'Resolver' : 'Ver carpeta'}</button>
              </div>
            );
          })}
        </div>
      </section>
    </div>
</>
  );
}
