import { useState } from 'react';
import { ArrowLeft, Search, UserPlus } from 'lucide-react';
import {
  calcularEstadoTrabajador,
  esTrabajadorAsignado,
  getMotivoBloqueoTrabajador,
  getRequisitos,
  obtenerDiasRestantes,
} from '../../data/localStorageDb';
import { Contratista, Documento, Mandante, Proyecto, Requisito, Trabajador } from '../../types';
import { DocEstado } from '../admin/acreditacionUtils';
import { impactoLabel } from './inicio/inicioUtils';
import {
  documentoVigente,
  getEstadoDocumentoEfectivo,
  matchDocumentoRequisito,
  normalizarNombreDocumento,
  subirDocumentoRequisito,
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

function iniciales(nombre: string): string {
  return nombre.split(/\s+/).filter(Boolean).map(part => part[0]).join('').slice(0, 2).toUpperCase();
}

function buildResumen(trabajador: Trabajador, proyectoId: string, requisitos: Requisito[]): ResumenTrabajador {
  const checklist = requisitos.map(requisito => {
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
    porcentaje: totalObligatorios === 0 ? 100 : Math.round((vigentes / totalObligatorios) * 100),
  };
}

function accionDocumento(item: ChecklistItem): { label: string; className: string; actionable: boolean } {
  if (item.estado === 'Pendiente') return { label: 'Subir', className: 'tw-action-primary', actionable: true };
  if (item.estado === 'Rechazado' || item.estado === 'Vencido') return { label: 'Corregir', className: 'tw-action-danger', actionable: true };
  if (item.estado === 'Por vencer') return { label: 'Renovar', className: 'tw-action-warning', actionable: true };
  return { label: 'Ver', className: '', actionable: false };
}

function motivoDocumento(documento?: Documento): string | undefined {
  return documento?.motivoRechazo || documento?.motivo || documento?.observacion || documento?.explicacionRechazo;
}

export default function TrabajadoresTab({
  selectedWorkerForDocs,
  setSelectedWorkerForDocs,
  contratistaLogueado,
  selectedProyectoId,
  setSelectedProyectoId,
  setFichaTipo,
  setFichaTrabajador,
  setShowFichaAcreditacion,
  misProyectos,
  allMandantes,
  setShowAddWorkerModal,
  onDataChanged,
  showToast,
}: {
  selectedWorkerForDocs: Trabajador | null;
  setSelectedWorkerForDocs: (value: Trabajador | null) => void;
  contratistaLogueado: Contratista;
  selectedProyectoId: string;
  setSelectedProyectoId: (id: string) => void;
  setFichaTipo: (value: 'empresa' | 'trabajador') => void;
  setFichaTrabajador: (value: Trabajador) => void;
  setShowFichaAcreditacion: (value: boolean) => void;
  misProyectos: Proyecto[];
  allMandantes: Mandante[];
  setShowAddWorkerModal: (value: boolean) => void;
  onDataChanged: () => void;
  showToast: (message: string, type?: 'success' | 'error' | 'warning') => void;
}) {
  const [search, setSearch] = useState('');
  const [filtro, setFiltro] = useState<FiltroEstado>('todos');
  const proyecto = misProyectos.find(item => item.id === selectedProyectoId) || misProyectos[0];
  const requisitos = getRequisitos().filter(item =>
    item.proyectoId === selectedProyectoId && item.destino === 'trabajador' && item.activo !== false
  );
  const trabajadores = proyecto
    ? (contratistaLogueado.trabajadores || []).filter(item => esTrabajadorAsignado(item, proyecto.id, misProyectos))
    : [];
  const resumenes = trabajadores.map(item => buildResumen(item, selectedProyectoId, requisitos));
  const selectedWorker = selectedWorkerForDocs
    ? trabajadores.find(item => item.rut === selectedWorkerForDocs.rut)
    : undefined;
  const selected = selectedWorker ? buildResumen(selectedWorker, selectedProyectoId, requisitos) : undefined;

  const cambiarProyecto = (id: string) => {
    setSelectedProyectoId(id);
    setSelectedWorkerForDocs(null);
  };

  const ejecutarAccion = (item: ChecklistItem, trabajador: Trabajador) => {
    const action = accionDocumento(item);
    if (!action.actionable) {
      showToast(item.documento?.archivoReferencia ? `Archivo actual: ${item.documento.archivoReferencia}` : 'Documento sin archivo asociado.', 'success');
      return;
    }
    const result = subirDocumentoRequisito({
      contratistaId: contratistaLogueado.id,
      proyectoId: selectedProyectoId,
      requisito: item.requisito,
      trabajadorRut: trabajador.rut,
    });
    if (!result.success) {
      showToast(result.error || 'No fue posible actualizar el documento.', 'error');
      return;
    }
    onDataChanged();
    showToast('Documento enviado a revisión por Acredita.', 'success');
  };

  if (!proyecto) return <div className="tw-empty">Todavía no tienes proyectos asociados.</div>;

  if (selected) {
    const accesoHabilitado = selected.estado === 'aprobado' || selected.estado === 'por_vencer';
    const candidatosVencimiento = selected.checklist
      .filter(item => item.documento && documentoVigente(item.documento, item.requisito))
      .map(item => ({ item, dias: obtenerDiasRestantes(item.documento!.vencimiento) }))
      .filter(value => value.dias >= 0 && value.dias < 99999)
      .sort((a, b) => a.dias - b.dias);
    const proximo = candidatosVencimiento[0];
    const bloqueo = selected.checklist.find(item =>
      item.requisito.obligatorio && (item.estado === 'Rechazado' || item.estado === 'Vencido')
    );
    const motivoReal = motivoDocumento(bloqueo?.documento) ||
      (selected.estado === 'rechazado' ? getMotivoBloqueoTrabajador(selected.trabajador, selectedProyectoId) : undefined);

    return (
      <section className="tw-detail tw-card">
        <header className="tw-detail-head">
          <div className="tw-worker-identity">
            <button className="tw-back" onClick={() => setSelectedWorkerForDocs(null)} aria-label="Volver al directorio"><ArrowLeft size={17} /></button>
            <div className="tw-avatar">{iniciales(selected.trabajador.nombre)}</div>
            <div className="tw-min-0">
              <h2>{selected.trabajador.nombre}</h2>
              <p>{selected.trabajador.rut} · {selected.trabajador.cargo || 'Operario'} · {proyecto.nombre}</p>
            </div>
          </div>
          <div className="tw-detail-actions">
            <span className={`tw-badge ${ESTADO_UI[selected.estado].badge}`}>{ESTADO_UI[selected.estado].label}</span>
            <button className="tw-row-action" onClick={() => {
              setFichaTipo('trabajador');
              setFichaTrabajador(selected.trabajador);
              setShowFichaAcreditacion(true);
            }}>Ver ficha</button>
          </div>
        </header>

        <div className="tw-folder-summary">
          <div className="tw-folder-kpi"><span>Estado</span><b>{ESTADO_UI[selected.estado].label}</b></div>
          <div className="tw-folder-kpi"><span>Acceso a faena</span><b className={accesoHabilitado ? 'tw-text-green' : 'tw-text-red'}>{accesoHabilitado ? 'Habilitado' : 'No habilitado'}</b></div>
          <div className="tw-folder-kpi"><span>Documentos vigentes</span><b>{selected.vigentes}/{selected.totalObligatorios} · {selected.porcentaje}%</b></div>
          <div className="tw-folder-kpi"><span>Próximo vencimiento</span><b>{proximo?.item.documento?.vencimiento || 'Sin alertas'}</b></div>
        </div>

        <div className="tw-folder-body">
          <div className="tw-min-0">
            <h3 className="tw-section-title">Checklist de requisitos</h3>
            <div className="tw-checklist">
              {selected.checklist.map(item => {
                const action = accionDocumento(item);
                const estado = DOC_UI[item.estado];
                return (
                  <div className="tw-check-row" key={item.requisito.id}>
                    <div className="tw-min-0">
                      <div className="tw-check-title">{item.requisito.nombre}</div>
                      <div className="tw-check-meta">{item.requisito.obligatorio ? 'Obligatorio' : 'Opcional'} · {impactoLabel(item.requisito)}</div>
                    </div>
                    <span className={`tw-badge ${estado.badge}`}>{estado.label}</span>
                    <div className="tw-validity">{item.documento?.vencimiento && item.documento.vencimiento !== '—' ? item.documento.vencimiento : '—'}</div>
                    <button className={`tw-doc-action ${action.className}`} onClick={() => ejecutarAccion(item, selected.trabajador)}>{action.label}</button>
                  </div>
                );
              })}
            </div>
          </div>

          <aside className="tw-side">
            {selected.estado === 'rechazado' && (
              <>
                <div className="tw-info tw-info-red"><strong>Qué bloquea el ingreso</strong><p>{motivoReal || `${bloqueo?.requisito.nombre || 'Un requisito obligatorio'} requiere corrección.`}</p></div>
                <div className="tw-info"><strong>Qué debes hacer</strong><p>Corrige el requisito indicado. Cuando Acredita apruebe la nueva versión, el trabajador recuperará la habilitación para este proyecto.</p></div>
              </>
            )}
            {selected.estado === 'por_vencer' && <div className="tw-info tw-info-yellow"><strong>Acceso aún habilitado</strong><p>Puede seguir ingresando mientras el documento esté vigente. Renueva antes de su vencimiento.</p></div>}
            {selected.estado === 'pendiente' && <div className="tw-info"><strong>Estado en proceso</strong><p>Falta completar o aprobar documentación obligatoria. Aún no puede ingresar al proyecto.</p></div>}
            {selected.estado === 'aprobado' && <div className="tw-info"><strong>Trabajador habilitado</strong><p>Todos los requisitos obligatorios están vigentes para este proyecto.</p></div>}
          </aside>
        </div>
      </section>
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
    return matchesSearch && (filtro === 'todos' || item.estado === filtro);
  });

  return (
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
            <button className="tw-add" onClick={() => setShowAddWorkerModal(true)}><UserPlus size={14} /> Agregar trabajador</button>
          </div>
        </div>
      </section>

      <section className="tw-floating">
        <div className="tw-kpis">
          <div className="tw-kpi"><span>Total trabajadores</span><b>{resumenes.length}</b><small>Asignados al proyecto</small></div>
          <div className="tw-kpi tw-kpi-green"><span>Habilitados</span><b>{habilitados}</b><small>{porVencer ? `${porVencer} con vencimiento próximo` : 'Sin alertas próximas'}</small></div>
          <div className="tw-kpi tw-kpi-blue"><span>En proceso</span><b>{enProceso}</b><small>Documentación pendiente o en revisión</small></div>
          <div className="tw-kpi tw-kpi-red"><span>Bloqueados</span><b>{bloqueados}</b><small>No pueden ingresar a faena</small></div>
        </div>

        <div className="tw-card tw-directory">
          <div className="tw-toolbar">
            <div className="tw-search-wrap"><Search size={15} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar por nombre, RUT o cargo..." /></div>
            <select value={filtro} onChange={event => setFiltro(event.target.value as FiltroEstado)} aria-label="Filtrar trabajadores por estado">
              <option value="todos">Todos los estados</option>
              <option value="aprobado">Habilitados</option>
              <option value="pendiente">En proceso</option>
              <option value="por_vencer">Por vencer</option>
              <option value="rechazado">Bloqueados</option>
            </select>
          </div>
          <div className="tw-table-head"><span>Trabajador</span><span>Cargo</span><span>Estado</span><span>Documentos</span><span>Acceso</span><span /></div>
          {filtrados.length === 0 ? <div className="tw-empty">No hay trabajadores que coincidan con los filtros.</div> : filtrados.map(item => {
            const acceso = item.estado === 'aprobado' || item.estado === 'por_vencer';
            const motivo = item.estado === 'rechazado' ? getMotivoBloqueoTrabajador(item.trabajador, selectedProyectoId) : undefined;
            return (
              <div className="tw-table-row" key={item.trabajador.rut}>
                <div className="tw-person"><div className="tw-avatar">{iniciales(item.trabajador.nombre)}</div><div className="tw-min-0"><strong>{item.trabajador.nombre}</strong><small>{item.trabajador.rut}</small></div></div>
                <div className="tw-cargo">{item.trabajador.cargo || 'Operario'}</div>
                <div><span className={`tw-badge ${ESTADO_UI[item.estado].badge}`}>{ESTADO_UI[item.estado].label}</span></div>
                <div className="tw-progress-cell"><div><span>{item.vigentes}/{item.totalObligatorios} vigentes</span><b>{item.porcentaje}%</b></div><div className="tw-progress"><i style={{ width: `${item.porcentaje}%` }} /></div></div>
                <div><strong className={acceso ? 'tw-access-ok' : 'tw-access-no'}>{acceso ? 'Habilitado' : 'No habilitado'}</strong><small>{item.estado === 'por_vencer' ? 'Válido hasta su vencimiento.' : item.estado === 'pendiente' ? 'Faltan requisitos obligatorios.' : motivo || 'Sin bloqueos.'}</small></div>
                <button className={`tw-row-action ${item.estado === 'rechazado' ? 'tw-row-danger' : ''}`} onClick={() => setSelectedWorkerForDocs(item.trabajador)}>{item.estado === 'rechazado' ? 'Resolver' : 'Ver carpeta'}</button>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
