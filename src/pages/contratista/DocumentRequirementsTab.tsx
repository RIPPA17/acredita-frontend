import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { useLocation } from 'react-router-dom';
import {
  esTrabajadorAsignado,
  getRequisitos,
  obtenerDiasRestantes,
} from '../../data/localStorageDb';
import { openDocumentFile, uploadDocumentFile } from '../../data/supabaseDocumentStorage';
import { Contratista, Mandante, Proyecto } from '../../types';
import { DocEstado } from '../admin/acreditacionUtils';
import {
  buildRequisitosEmpresa,
  buildRequisitosTrabajador,
  impactoLabel,
  normalizarNombreDocumento,
  RequisitoConDoc,
} from './inicio/inicioUtils';
import { getEstadoDocumentoEfectivo } from './documentosUtils';
import { getObligacionesDocumentales, proyectoOperativoParaContratista } from '../../data/operationalCore';

// Misma maqueta del prototipo HTML aprobado (doc-*), con los colores
// reales de Acredita (ver .doc-page en index.css). Solo la CLAVE (qué
// estado tiene cada requisito/documento) sale de la lógica central; el
// color/label/copy de ayuda es presentación.
const DOC_BADGE_CLASS: Record<DocEstado, string> = {
  Aprobado: 'doc-badge-green',
  Rechazado: 'doc-badge-red',
  Vencido: 'doc-badge-red',
  'En revisión': 'doc-badge-blue',
  'Por vencer': 'doc-badge-yellow',
  Pendiente: 'doc-badge-gray',
};
const DOC_PRIORITY: Record<DocEstado, number> = {
  Rechazado: 0,
  Vencido: 0,
  Pendiente: 1,
  'Por vencer': 2,
  'En revisión': 3,
  Aprobado: 4,
};

type Scope = 'todos' | 'empresa' | 'trabajadores';
type StatusFilter = 'todos' | 'accion' | 'revision' | 'por_vencer' | 'aprobado';

interface Row extends RequisitoConDoc {
  key: string;
  scope: 'empresa' | 'trabajadores';
  ownerNombre: string;
}

function accionDoc(item: Row, readOnly = false): { label: string; cls: string; disabled?: boolean } {
  if (readOnly) {
    const tieneArchivoHistorico = Boolean(
      item.doc
      && (
        item.estado !== 'Pendiente'
        || item.doc.archivoReferencia
        || (item.doc.subido && item.doc.subido !== '—')
      )
    );
    return tieneArchivoHistorico
      ? { label: 'Ver', cls: 'doc-btn-ghost' }
      : { label: 'Sin archivo', cls: 'doc-btn-ghost', disabled: true };
  }
  if (item.doc?.versionEnTramite?.estado === 'revision') return { label: 'Ver renovación', cls: 'doc-btn-ghost' };
  if (item.doc?.versionEnTramite?.estado === 'rechazado') return { label: 'Corregir renovación', cls: 'doc-btn-danger' };
  if (!item.doc || item.estado === 'Pendiente') return { label: 'Subir', cls: 'doc-btn-primary' };
  if (item.estado === 'Rechazado' || item.estado === 'Vencido') return { label: 'Corregir', cls: 'doc-btn-danger' };
  if (item.estado === 'Por vencer') return { label: 'Renovar', cls: 'doc-btn-warning' };
  return { label: 'Ver', cls: 'doc-btn-ghost' };
}

function stateCopy(item: RequisitoConDoc, readOnly = false): string {
  if (readOnly) {
    switch (item.estado) {
      case 'Pendiente': return 'Este requisito quedó sin documento cargado al cierre del proyecto.';
      case 'Rechazado': return 'Esta versión quedó registrada como rechazada durante la vigencia del proyecto.';
      case 'Vencido': return 'El documento quedó vencido en el historial del proyecto.';
      case 'En revisión': return 'Esta versión quedó registrada en revisión dentro del historial disponible.';
      case 'Por vencer': return 'El documento figuraba vigente y próximo a vencer en el último estado registrado.';
      default: return 'El documento quedó aprobado y vigente en el último estado registrado.';
    }
  }
  switch (item.estado) {
    case 'Pendiente':
      return item.requisito.obligatorio
        ? 'Este requisito obligatorio todavía no tiene un documento cargado. Mientras siga pendiente puede impedir completar la acreditación.'
        : 'Este requisito es opcional. Puedes subirlo, pero su ausencia no bloquea la acreditación.';
    case 'Rechazado':
      return 'Acredita rechazó esta versión. Debes corregir exactamente la observación indicada y reemplazar el documento.';
    case 'Vencido':
      return 'El documento dejó de estar vigente. Mientras siga vencido, aplica el bloqueo definido por este requisito.';
    case 'En revisión':
      return 'El documento ya fue enviado y está esperando revisión. No necesitas volver a subirlo mientras siga en este estado.';
    case 'Por vencer':
      return 'El documento todavía es válido, pero está próximo a vencer. Puedes renovarlo anticipadamente para evitar un bloqueo.';
    default:
      return 'El documento está vigente y aprobado. No requiere acción en este momento.';
  }
}

function guidanceText(item: RequisitoConDoc): string {
  switch (item.estado) {
    case 'Rechazado':
      return item.doc?.solucionRechazo || '';
    case 'Vencido':
      return item.doc?.solucionRechazo || 'Solicita una versión vigente y reemplaza este documento cuanto antes.';
    case 'Por vencer':
      return 'Puedes renovarlo anticipadamente para evitar que el requisito quede bloqueado cuando venza.';
    case 'Pendiente':
      return item.requisito.obligatorio
        ? 'Sube este documento para que Acredita pueda revisarlo.'
        : 'Puedes subirlo si el mandante lo solicita; no es obligatorio.';
    default:
      return '';
  }
}

function stateBoxClass(estado: DocEstado): string {
  if (estado === 'Rechazado' || estado === 'Vencido') return 'red';
  if (estado === 'Por vencer') return 'yellow';
  if (estado === 'En revisión') return 'blue';
  if (estado === 'Aprobado') return 'green';
  return '';
}

export default function SubirTab({
  contratistaLogueado,
  misProyectos,
  allMandantes,
  selectedProyectoId,
  setSelectedProyectoId,
  onDataChanged,
  showToast,
}: {
  contratistaLogueado: Contratista;
  misProyectos: Proyecto[];
  allMandantes: Mandante[];
  selectedProyectoId: string;
  setSelectedProyectoId: (id: string) => void;
  onDataChanged: () => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'warning') => void;
}) {
  const location = useLocation();
  const initialParams = new URLSearchParams(location.search);
  const requestedStatus = initialParams.get('estado');
  const requestedRequirement = initialParams.get('requisito');
  const requestedWorker = initialParams.get('trabajador');
  const [scope, setScope] = useState<Scope>('todos');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(
    requestedStatus && ['accion', 'revision', 'por_vencer', 'aprobado'].includes(requestedStatus)
      ? requestedStatus as StatusFilter
      : 'todos',
  );
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [uploadTarget, setUploadTarget] = useState<Row | null>(null);
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const proyectoActual = misProyectos.find(p => p.id === selectedProyectoId) || misProyectos[0];
  const modoConsulta = !proyectoOperativoParaContratista(proyectoActual, contratistaLogueado.id);
  const requisitosAll = getRequisitos();

  const trabajadoresAsignados = proyectoActual
    ? (contratistaLogueado.trabajadores || []).filter(w => esTrabajadorAsignado(w, proyectoActual.id, misProyectos))
    : [];

  const allItems: Row[] = proyectoActual
    ? [
        ...buildRequisitosEmpresa(contratistaLogueado, proyectoActual.id, requisitosAll).map(item => ({
          ...item,
          estado: getEstadoDocumentoEfectivo(item.doc, item.requisito),
          key: item.requisito.id,
          scope: 'empresa' as const,
          ownerNombre: contratistaLogueado.nombre,
        })),
        ...trabajadoresAsignados.flatMap(w =>
          buildRequisitosTrabajador(w, proyectoActual.id, requisitosAll).map(item => ({
            ...item,
            estado: getEstadoDocumentoEfectivo(item.doc, item.requisito),
            key: `${item.requisito.id}::${w.rut}`,
            scope: 'trabajadores' as const,
            ownerNombre: w.nombre,
          }))
        ),
      ]
    : [];

  const allItemsKey = allItems.map(item => item.key).join('|');

  useEffect(() => {
    if (!requestedRequirement) return;
    const target = allItems.find(item =>
      item.requisito.id === requestedRequirement
      && (!requestedWorker || item.worker?.rut === requestedWorker)
    );
    if (!target) return;
    setSelectedKey(target.key);
    setScope(target.scope);
    setSearch('');
    setStatusFilter('todos');
  }, [requestedRequirement, requestedWorker, selectedProyectoId, allItemsKey]);

  const tieneRenovacionRevision = (item: Row) => item.doc?.versionEnTramite?.estado === 'revision';
  const tieneRenovacionRechazada = (item: Row) => item.doc?.versionEnTramite?.estado === 'rechazado';
  const requiereAccion = (item: Row) => item.requisito.obligatorio
    && (tieneRenovacionRechazada(item) || ['Pendiente', 'Rechazado', 'Vencido'].includes(item.estado));
  const estaEnRevision = (item: Row) => tieneRenovacionRevision(item) || item.estado === 'En revisión';
  const estaPorVencer = (item: Row) => !item.doc?.versionEnTramite && item.estado === 'Por vencer';
  const estaAprobado = (item: Row) => !item.doc?.versionEnTramite && item.estado === 'Aprobado';

  const accion = modoConsulta ? 0 : allItems.filter(requiereAccion).length;
  const revision = modoConsulta ? 0 : allItems.filter(estaEnRevision).length;
  const porVencer = modoConsulta ? 0 : allItems.filter(estaPorVencer).length;
  const aprobados = allItems.filter(estaAprobado).length;

  const q = normalizarNombreDocumento(search);
  const filtrados = allItems
    .filter(i => {
      const scopeOk = scope === 'todos' || i.scope === scope;
      let statusOk = true;
      if (statusFilter === 'accion') statusOk = requiereAccion(i);
      else if (statusFilter === 'revision') statusOk = estaEnRevision(i);
      else if (statusFilter === 'por_vencer') statusOk = estaPorVencer(i);
      else if (statusFilter === 'aprobado') statusOk = estaAprobado(i);
      const qOk = !q || [i.requisito.nombre, i.ownerNombre, i.requisito.categoria]
        .some(value => normalizarNombreDocumento(value).includes(q));
      return scopeOk && statusOk && qOk;
    })
    .sort((a, b) => {
      const priorityFor = (item: Row) => tieneRenovacionRechazada(item) ? 0 : tieneRenovacionRevision(item) ? 3 : DOC_PRIORITY[item.estado];
      const p = priorityFor(a) - priorityFor(b);
      if (p !== 0) return p;
      if (a.requisito.obligatorio !== b.requisito.obligatorio) return a.requisito.obligatorio ? -1 : 1;
      const ownerOrder = a.ownerNombre.localeCompare(b.ownerNombre, 'es');
      return ownerOrder || a.requisito.nombre.localeCompare(b.requisito.nombre, 'es');
    });

  const grupos: Array<['Empresa' | 'Trabajadores', Row[]]> = [];
  if (scope === 'todos' || scope === 'empresa') grupos.push(['Empresa', filtrados.filter(i => i.scope === 'empresa')]);
  if (scope === 'todos' || scope === 'trabajadores') grupos.push(['Trabajadores', filtrados.filter(i => i.scope === 'trabajadores')]);
  const totalMostrado = grupos.reduce((acc, [, rows]) => acc + rows.length, 0);

  const selected = allItems.find(i => i.key === selectedKey);
  const itemKeys = allItems.map(item => item.key).join('|');

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const nextStatus = params.get('estado');
    if (nextStatus && ['accion', 'revision', 'por_vencer', 'aprobado'].includes(nextStatus)) {
      setStatusFilter(nextStatus as StatusFilter);
    }

    const requisitoId = params.get('requisito');
    const trabajadorRut = params.get('trabajador');
    if (!requisitoId) return;
    const deepLinkKey = trabajadorRut ? `${requisitoId}::${trabajadorRut}` : requisitoId;
    if (allItems.some(item => item.key === deepLinkKey)) setSelectedKey(deepLinkKey);
  }, [location.search, itemKeys]);

  const cambiarProyecto = (id: string) => {
    setSelectedProyectoId(id);
    setSelectedKey(null);
  };

  const contextoDocumento = (item: Row) => ({
    contratistaId: contratistaLogueado.id,
    proyectoId: selectedProyectoId,
    requisito: {
      id: item.requisito.id,
      nombre: item.requisito.nombre,
      destino: item.requisito.destino,
    },
    trabajadorRut: item.worker?.rut,
    obligacionId: item.doc?.obligacionId,
  });

  const seleccionarArchivo = (item: Row) => {
    if (modoConsulta) {
      showToast('Este proyecto está en modo histórico y solo permite consultar su historial.', 'warning');
      return;
    }
    const correctingRenewal = item.doc?.versionEnTramite?.estado === 'rechazado';
    if ((!correctingRenewal && !['Pendiente', 'Rechazado', 'Vencido', 'Por vencer'].includes(item.estado)) || uploadingKey) return;
    setUploadTarget(item);
    setSelectedKey(item.key);
    fileInputRef.current?.click();
  };

  const procesarArchivo = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    const target = uploadTarget;
    setUploadTarget(null);
    if (!file || !target) return;

    setUploadingKey(target.key);
    try {
      const result = await uploadDocumentFile(contextoDocumento(target), file);
      onDataChanged();
      showToast(`${result.filename} enviado a revisión (versión ${result.version}).`, 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'No fue posible subir el archivo.', 'error');
    } finally {
      setUploadingKey(null);
    }
  };

  const verDocumento = async (item: Row, versionNumber?: number) => {
    try {
      const requestedVersion = versionNumber
        ?? (item.doc?.versionEnTramite?.estado === 'revision' ? item.doc.versionEnTramite.version : item.doc?.version);
      await openDocumentFile(contextoDocumento(item), requestedVersion);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'No fue posible abrir el documento.', 'error');
    }
  };

  if (!proyectoActual) {
    return (
      <div className="doc-page">
        <div className="doc-empty">Todavía no tienes proyectos asociados.</div>
      </div>
    );
  }

  return (
    <div className="doc-page">
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf,image/jpeg,image/png,.pdf,.jpg,.jpeg,.png"
        style={{ display: 'none' }}
        onChange={procesarArchivo}
      />

      <section className="doc-hero">
        <div className="doc-hero-grid">
          <div>
            <div className="doc-eyebrow">Portal contratista</div>
            <h1 className="doc-h1">Documentos</h1>
            <p className="doc-hero-sub">Gestiona todos los requisitos documentales del proyecto. Lo urgente aparece primero: qué falta, qué fue rechazado, qué está próximo a vencer y qué ya se encuentra validado.</p>
          </div>
          <div className="doc-picker">
            <label htmlFor="doc-project-select">Proyecto activo</label>
            <select id="doc-project-select" value={selectedProyectoId} onChange={e => cambiarProyecto(e.target.value)}>
              {misProyectos.map(p => {
                const mandante = allMandantes.find(m => m.id === p.mandanteId);
                return <option key={p.id} value={p.id}>{p.nombre} · {mandante?.nombre || 'Mandante no disponible'}</option>;
              })}
            </select>
          </div>
        </div>
      </section>

      <section className="doc-floating">
        {modoConsulta && <div className="doc-historical-notice"><strong>Proyecto histórico · modo consulta</strong><span>Puedes revisar requisitos, archivos y versiones históricas, pero no subir, corregir ni renovar documentos.</span></div>}
        <div className="doc-summary">
          <div className="doc-metric action">
            <div className="doc-metric-label">Requieren acción</div>
            <div className="doc-metric-value">{accion}</div>
            <div className="doc-metric-foot">{modoConsulta ? 'Sin acciones operativas en proyectos históricos' : 'Obligatorios pendientes, rechazados o vencidos'}</div>
          </div>
          <div className="doc-metric review">
            <div className="doc-metric-label">En revisión</div>
            <div className="doc-metric-value">{revision}</div>
            <div className="doc-metric-foot">{modoConsulta ? 'Consulta del último estado registrado' : 'Esperando validación de Acredita'}</div>
          </div>
          <div className="doc-metric expiry">
            <div className="doc-metric-label">Por vencer</div>
            <div className="doc-metric-value">{porVencer}</div>
            <div className="doc-metric-foot">{modoConsulta ? 'No se generan renovaciones' : 'Todavía vigentes; conviene renovar'}</div>
          </div>
          <div className="doc-metric ok">
            <div className="doc-metric-label">Aprobados</div>
            <div className="doc-metric-value">{aprobados}</div>
            <div className="doc-metric-foot">Vigentes y sin acción inmediata</div>
          </div>
        </div>

        <div className="doc-notice">
          <div className="doc-notice-icon">!</div>
          <div><b>{modoConsulta ? 'Modo consulta:' : 'Cómo funciona:'}</b> {modoConsulta ? 'este proyecto o la participación del contratista ya no está operativa. Los estados se conservan como historial y las acciones de carga están deshabilitadas.' : 'cada carga parte desde un requisito exacto. Así el archivo queda asociado al proyecto, empresa o trabajador correcto y no se transforma en un documento "suelto".'}</div>
        </div>

        <div className="doc-workspace">
          <section className="doc-shell doc-list-card">
            <div className="doc-toolbar">
              <div className="doc-scope-tabs">
                {([['todos', 'Todos'], ['empresa', 'Empresa'], ['trabajadores', 'Trabajadores']] as Array<[Scope, string]>).map(([value, label]) => (
                  <button key={value} className={`doc-scope-btn ${scope === value ? 'active' : ''}`} onClick={() => setScope(value)}>{label}</button>
                ))}
              </div>
              <div className="doc-tools">
                <input
                  className="doc-search"
                  placeholder="Buscar requisito o trabajador..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  aria-label="Buscar requisito o trabajador"
                />
                <select className="doc-status-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value as StatusFilter)} aria-label="Filtrar por estado">
                  <option value="todos">Todos los estados</option>
                  <option value="accion">Requieren acción</option>
                  <option value="revision">En revisión</option>
                  <option value="por_vencer">Por vencer</option>
                  <option value="aprobado">Aprobados</option>
                </select>
              </div>
            </div>

            <div className="doc-priority-strip">
              <strong>Orden automático:</strong>
              <span className="doc-priority-chip">Rechazado / Vencido</span>
              <span>→</span>
              <span className="doc-priority-chip">Pendiente</span>
              <span>→</span>
              <span className="doc-priority-chip">Por vencer</span>
              <span>→</span>
              <span className="doc-priority-chip">En revisión</span>
              <span>→</span>
              <span className="doc-priority-chip">Aprobado</span>
            </div>

            {totalMostrado === 0 ? (
              <div className="doc-empty">No hay requisitos que coincidan con los filtros actuales.</div>
            ) : (
              grupos.map(([titulo, rows]) => rows.length > 0 && (
                <div key={titulo}>
                  <div className="doc-section-head">
                    <strong>{titulo}</strong>
                    <span>{rows.length} requisito{rows.length === 1 ? '' : 's'}</span>
                  </div>
                  {rows.map(item => {
                    const { label, cls, disabled } = accionDoc(item, modoConsulta);
                    const isUploading = uploadingKey === item.key;
                    return (
                      <div
                        key={item.key}
                        className={`doc-row ${selectedKey === item.key ? 'selected' : ''}`}
                        onClick={() => setSelectedKey(item.key)}
                        onKeyDown={event => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            setSelectedKey(item.key);
                          }
                        }}
                        role="button"
                        tabIndex={0}
                        aria-pressed={selectedKey === item.key}
                      >
                        <div className="doc-main">
                          <div className="doc-title-line">
                            <div className="doc-title">{item.requisito.nombre}</div>
                            <span className={`doc-req-chip ${item.requisito.obligatorio ? 'required' : 'optional'}`}>{item.requisito.obligatorio ? 'Obligatorio' : 'Opcional'}</span>
                          </div>
                          <div className="doc-sub">
                            <span>{impactoLabel(item.requisito)}</span>
                            <span>·</span>
                            <span>{item.requisito.frecuencia}</span>
                            {item.doc?.periodoEtiqueta && <><span>·</span><span>{item.doc.periodoEtiqueta}</span></>}
                          </div>
                        </div>
                        <div className="doc-owner">
                          {item.scope === 'empresa' ? 'Empresa' : item.ownerNombre}
                          <small>{item.requisito.categoria}</small>
                        </div>
                        <div>
                          <span className={`doc-badge ${DOC_BADGE_CLASS[item.estado]}`}><span className="doc-dot" />{item.estado}</span>
                          {item.doc?.versionEnTramite && <div className="doc-date"><b>v{item.doc.versionEnTramite.version}</b> {item.doc.versionEnTramite.estado === 'revision' ? 'en revisión' : 'rechazada'}</div>}
                          <div className="doc-date">{item.doc?.vencimiento && item.doc.vencimiento !== '-' ? item.doc.vencimiento : '—'}</div>
                        </div>
                        <button
                          className={`doc-btn ${cls}`}
                          disabled={isUploading || disabled}
                          onClick={e => {
                            e.stopPropagation();
                            setSelectedKey(item.key);
                            if (label.startsWith('Ver')) void verDocumento(item);
                            else seleccionarArchivo(item);
                          }}
                        >
                          {isUploading ? 'Subiendo…' : label}
                        </button>
                      </div>
                    );
                  })}
                </div>
              ))
            )}
          </section>

          <aside className="doc-shell doc-detail-card">
            {!selected ? (
              <div className="doc-detail-empty">
                <div className="doc-detail-big">D</div>
                <strong>Selecciona un requisito</strong>
                <div style={{ marginTop: 6, fontSize: 11.5 }}>Aquí verás su estado, impacto, vigencia, corrección y versiones anteriores.</div>
              </div>
            ) : (() => {
              const { label, cls, disabled } = accionDoc(selected, modoConsulta);
              const historial = selected.doc?.historial || [];
              const today = new Date().toISOString().slice(0, 10);
              const periodos = getObligacionesDocumentales().filter(item =>
                item.activo
                && item.periodoInicio <= today
                && item.proyectoId === selectedProyectoId
                && item.contratistaId === contratistaLogueado.id
                && item.requisitoId === selected.requisito.id
                && (selected.worker?.rut ? item.trabajadorRut === selected.worker.rut : !item.trabajadorRut)
              ).sort((a, b) => b.periodoInicio.localeCompare(a.periodoInicio)).slice(0, 12);
              const isUploading = uploadingKey === selected.key;
              return (
                <>
                  <div className="doc-detail-head">
                    <div className="doc-detail-kicker">Detalle del requisito</div>
                    <div className="doc-detail-title">{selected.requisito.nombre}</div>
                    <div className="doc-detail-meta">{selected.scope === 'empresa' ? `Empresa · ${contratistaLogueado.nombre}` : `Trabajador · ${selected.ownerNombre}`}</div>
                  </div>
                  <div className="doc-detail-body">
                    <div className="doc-detail-state">
                      <span className={`doc-badge ${DOC_BADGE_CLASS[selected.estado]}`}><span className="doc-dot" />{selected.estado}</span>
                      <span className="doc-impact">{impactoLabel(selected.requisito)}</span>
                    </div>

                    {selected.estado === 'Por vencer' && selected.doc && (
                      <div className="doc-date">
                        Vence en {obtenerDiasRestantes(selected.doc.vencimiento)} día{obtenerDiasRestantes(selected.doc.vencimiento) === 1 ? '' : 's'}.
                      </div>
                    )}

                    <div className="doc-tags">
                      <span className={`doc-req-chip ${selected.requisito.obligatorio ? 'required' : 'optional'}`}>{selected.requisito.obligatorio ? 'Obligatorio' : 'Opcional'}</span>
                      <span className="doc-req-chip">{selected.requisito.frecuencia}</span>
                      {selected.doc?.periodoEtiqueta && <span className="doc-req-chip">Período: {selected.doc.periodoEtiqueta}</span>}
                    </div>

                    {selected.requisito.descripcion && <div className="doc-info-box"><strong>Qué debes presentar</strong><p>{selected.requisito.descripcion}</p></div>}

                    {Boolean(selected.requisito.checklistRevision?.length) && <div className="doc-info-box"><strong>Qué revisará Acredita</strong><ul style={{ margin: '8px 0 0', paddingLeft: 18 }}>{selected.requisito.checklistRevision!.map(criterion => <li key={criterion} style={{ marginBottom: 4 }}>{criterion}</li>)}</ul></div>}

                    <div className={`doc-info-box ${stateBoxClass(selected.estado)}`}>
                      <strong>{selected.estado}</strong>
                      <p>{stateCopy(selected, modoConsulta)}</p>
                    </div>

                    {selected.doc?.versionEnTramite?.estado === 'revision' && (
                      <div className="doc-info-box blue">
                        <strong>Renovación v{selected.doc.versionEnTramite.version} en revisión</strong>
                        <p>La versión v{selected.doc.version} continúa vigente{selected.doc.vencimiento && selected.doc.vencimiento !== '—' ? ` hasta ${selected.doc.vencimiento}` : ''}. La renovación no suspende acceso ni pago mientras la versión anterior siga válida.</p>
                      </div>
                    )}
                    {selected.doc?.versionEnTramite?.estado === 'rechazado' && (
                      <div className="doc-info-box red">
                        <strong>Renovación v{selected.doc.versionEnTramite.version} rechazada</strong>
                        <p>{selected.doc.versionEnTramite.explicacionRechazo || selected.doc.versionEnTramite.motivoRechazo || 'Debes corregir la renovación.'} La versión v{selected.doc.version} sigue vigente{selected.doc.vencimiento && selected.doc.vencimiento !== '—' ? ` hasta ${selected.doc.vencimiento}` : ''}.</p>
                      </div>
                    )}

                    {selected.estado === 'Rechazado' && (selected.doc?.motivoRechazo || selected.doc?.motivo || selected.doc?.observacion) && (
                      <div className="doc-info-box red">
                        <strong>Motivo</strong>
                        <p>{selected.doc.motivoRechazo || selected.doc.motivo || selected.doc.observacion}</p>
                      </div>
                    )}

                    {!modoConsulta && guidanceText(selected) && (
                      <div className={`doc-info-box ${selected.estado === 'Rechazado' || selected.estado === 'Vencido' ? 'red' : selected.estado === 'Por vencer' ? 'yellow' : ''}`}>
                        <strong>{selected.estado === 'Pendiente' ? 'Qué debes hacer' : selected.estado === 'Por vencer' ? 'Renovación anticipada' : 'Cómo corregirlo'}</strong>
                        <p>{guidanceText(selected)}</p>
                      </div>
                    )}

                    <div className="doc-mini-list">
                      <div className="doc-mini"><span>Categoría</span><b>{selected.requisito.categoria}</b></div>
                      <div className="doc-mini"><span>Vigencia actual</span><b>{selected.doc?.vencimiento && selected.doc.vencimiento !== '-' ? selected.doc.vencimiento : '—'}</b></div>
                      <div className="doc-mini"><span>Frecuencia</span><b>{selected.requisito.frecuencia}</b></div>
                      <div className="doc-mini"><span>Consecuencia</span><b>{impactoLabel(selected.requisito)}</b></div>
                      {selected.doc?.fechaLimite && <div className="doc-mini"><span>Fecha límite</span><b>{selected.doc.fechaLimite}</b></div>}
                    </div>

                    {periodos.length > 0 && <div className="doc-history"><div className="doc-history-head">Cumplimiento por período</div>{periodos.map(periodo => <div key={periodo.id} className="doc-history-row"><div className="doc-history-date">{periodo.periodoEtiqueta}</div><div><div className="doc-history-name">Vence {periodo.fechaLimite}</div><div className="doc-history-note">{periodo.trabajadorRut || 'Empresa'}</div></div><span className={`doc-badge ${periodo.estado === 'aprobado' ? 'doc-badge-green' : ['rechazado', 'vencido'].includes(periodo.estado) ? 'doc-badge-red' : periodo.estado === 'por_vencer' ? 'doc-badge-yellow' : periodo.estado === 'revision' ? 'doc-badge-blue' : 'doc-badge-gray'}`}>{periodo.estado.replace('_', ' ')}</span></div>)}</div>}

                    {selected.doc?.archivoReferencia ? (
                      <div className="doc-upload-box">
                        <strong>{selected.doc.archivoReferencia}</strong>
                        {selected.doc.subido ? `Última carga: ${selected.doc.subido}` : 'Archivo asociado actualmente'}
                      </div>
                    ) : (
                      <div className="doc-upload-box">
                        <strong>Sin archivo cargado</strong>
                        PDF, JPG o PNG · máximo 10 MB
                      </div>
                    )}

                    {historial.length === 0 ? (
                      <div className="doc-history">
                        <div className="doc-history-head">Historial de versiones</div>
                        <div style={{ padding: '12px 10px', fontSize: 11, color: '#7a7a6a' }}>Todavía no existen versiones anteriores.</div>
                      </div>
                    ) : (
                      <div className="doc-history">
                        <div className="doc-history-head">Historial de versiones</div>
                        {historial.map((h, idx) => (
                          <div key={idx} className="doc-history-row">
                            <div className="doc-history-date">{h.fecha}</div>
                            <div>
                              <div className="doc-history-name">Versión {h.version}</div>
                              {(h.explicacionRechazo || h.motivoRechazo || h.verificador) && (
                                <div className="doc-history-note">
                                  {h.explicacionRechazo || h.motivoRechazo}
                                  {h.verificador ? `${h.explicacionRechazo || h.motivoRechazo ? ' · ' : ''}Verificado por ${h.verificador}` : ''}
                                </div>
                              )}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span className={`doc-badge ${h.estado === 'aprobado' ? 'doc-badge-green' : h.estado === 'rechazado' ? 'doc-badge-red' : h.estado === 'por_vencer' ? 'doc-badge-yellow' : 'doc-badge-blue'}`}>
                                {h.estado === 'aprobado' ? 'Aprobado' : h.estado === 'rechazado' ? 'Rechazado' : h.estado === 'por_vencer' ? 'Por vencer' : h.estado === 'revision' ? 'En revisión' : 'Pendiente'}
                              </span>
                              {h.archivoReferencia && <button type="button" className="doc-btn doc-btn-ghost" onClick={() => void verDocumento(selected, h.version)}>Ver versión</button>}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="doc-detail-actions">
                      <button className="doc-btn doc-btn-ghost" onClick={() => setSelectedKey(null)}>Cerrar</button>
                      <button
                        className={`doc-btn ${cls}`}
                        disabled={isUploading || disabled}
                        onClick={() => {
                          if (label.startsWith('Ver')) void verDocumento(selected);
                          else seleccionarArchivo(selected);
                        }}
                      >
                        {isUploading
                          ? 'Subiendo…'
                          : modoConsulta
                            ? label
                            : label}
                      </button>
                    </div>
                  </div>
                </>
              );
            })()}
          </aside>
        </div>
      </section>
    </div>
  );
}
