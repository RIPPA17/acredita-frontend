import { useState } from 'react';
import {
  calcularEstadoTrabajador,
  DEMO_TODAY,
  esPorVencerPorFecha,
  esTrabajadorAsignado,
  esVencidoPorFecha,
  getContratistas,
  getRequisitos,
  obtenerDiasRestantes,
  saveContratistas,
} from '../../data/localStorageDb';
import { Contratista, Documento, Mandante, Proyecto, Requisito, Trabajador } from '../../types';
import { DocEstado } from '../admin/acreditacionUtils';
import {
  buildRequisitosEmpresa,
  buildRequisitosTrabajador,
  impactoLabel,
  matchDocumentoRequisito,
  normalizarNombreDocumento,
  RequisitoConDoc,
} from './inicio/inicioUtils';

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

function estadoEfectivo(doc: Documento | undefined, requisito: Requisito): DocEstado {
  if (!doc || doc.estado === 'pendiente') return 'Pendiente';
  if (doc.estado === 'rechazado') return 'Rechazado';
  if (doc.estado === 'revision') return 'En revisión';
  if (doc.estado === 'por_vencer') return 'Por vencer';
  if (esVencidoPorFecha(doc.vencimiento)) return 'Vencido';
  if (esPorVencerPorFecha(doc.vencimiento, requisito.alertaDias)) return 'Por vencer';
  return 'Aprobado';
}

function fechaCargaDemo(): string {
  return new Intl.DateTimeFormat('es-CL', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(DEMO_TODAY);
}

function idDocumento(item: Row, contratistaId: string, proyectoId: string): string {
  const owner = item.worker?.rut || 'empresa';
  return `doc_${contratistaId}_${proyectoId}_${item.requisito.id}_${owner}`
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '_');
}

function archivoDocumento(item: Row, version: number): string {
  const nombre = normalizarNombreDocumento(item.requisito.nombre).replace(/\s+/g, '-');
  return `${nombre}-v${version}.pdf`;
}

function accionDoc(item: Row): { label: string; cls: string } {
  if (!item.doc) return { label: 'Subir', cls: 'doc-btn-primary' };
  if (item.estado === 'Rechazado' || item.estado === 'Vencido') return { label: 'Corregir', cls: 'doc-btn-danger' };
  if (item.estado === 'Por vencer') return { label: 'Renovar', cls: 'doc-btn-warning' };
  return { label: 'Ver', cls: 'doc-btn-ghost' };
}

// Texto de estado (info-box superior): genérico por estado, igual criterio
// que usa el resto del portal para no pedir "corregir" cuando en realidad
// el documento está en revisión o simplemente no se ha subido todavía.
function stateCopy(item: RequisitoConDoc): string {
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
  const [scope, setScope] = useState<Scope>('todos');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('todos');
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const proyectoActual = misProyectos.find(p => p.id === selectedProyectoId) || misProyectos[0];
  const requisitosAll = getRequisitos();

  const trabajadoresAsignados = proyectoActual
    ? (contratistaLogueado.trabajadores || []).filter(w => esTrabajadorAsignado(w, proyectoActual.id, misProyectos))
    : [];

  const allItems: Row[] = proyectoActual
    ? [
        ...buildRequisitosEmpresa(contratistaLogueado, proyectoActual.id, requisitosAll).map(item => ({
          ...item,
          estado: estadoEfectivo(item.doc, item.requisito),
          key: item.requisito.id,
          scope: 'empresa' as const,
          ownerNombre: contratistaLogueado.nombre,
        })),
        ...trabajadoresAsignados.flatMap(w =>
          buildRequisitosTrabajador(w, proyectoActual.id, requisitosAll).map(item => ({
            ...item,
            estado: estadoEfectivo(item.doc, item.requisito),
            key: `${item.requisito.id}::${w.rut}`,
            scope: 'trabajadores' as const,
            ownerNombre: w.nombre,
          }))
        ),
      ]
    : [];

  const accion = allItems.filter(i => i.requisito.obligatorio && ['Pendiente', 'Rechazado', 'Vencido'].includes(i.estado)).length;
  const revision = allItems.filter(i => i.estado === 'En revisión').length;
  const porVencer = allItems.filter(i => i.estado === 'Por vencer').length;
  const aprobados = allItems.filter(i => i.estado === 'Aprobado').length;

  const q = normalizarNombreDocumento(search);
  const filtrados = allItems
    .filter(i => {
      const scopeOk = scope === 'todos' || i.scope === scope;
      let statusOk = true;
      if (statusFilter === 'accion') statusOk = i.requisito.obligatorio && ['Pendiente', 'Rechazado', 'Vencido'].includes(i.estado);
      else if (statusFilter === 'revision') statusOk = i.estado === 'En revisión';
      else if (statusFilter === 'por_vencer') statusOk = i.estado === 'Por vencer';
      else if (statusFilter === 'aprobado') statusOk = i.estado === 'Aprobado';
      const qOk = !q || [i.requisito.nombre, i.ownerNombre, i.requisito.categoria]
        .some(value => normalizarNombreDocumento(value).includes(q));
      return scopeOk && statusOk && qOk;
    })
    .sort((a, b) => {
      const p = DOC_PRIORITY[a.estado] - DOC_PRIORITY[b.estado];
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

  const cambiarProyecto = (id: string) => {
    setSelectedProyectoId(id);
    setSelectedKey(null);
  };

  const subirDocumento = (item: Row) => {
    if (!['Pendiente', 'Rechazado', 'Vencido', 'Por vencer'].includes(item.estado)) return;

    const contratistas = getContratistas();
    const contratistaIndex = contratistas.findIndex(c => c.id === contratistaLogueado.id);
    if (contratistaIndex === -1) {
      showToast('No fue posible encontrar al contratista.', 'error');
      return;
    }

    const contratista = contratistas[contratistaIndex];
    let documentos: Documento[];
    let trabajador: Trabajador | undefined;

    if (item.scope === 'trabajadores') {
      trabajador = contratista.trabajadores?.find(w => w.rut === item.worker?.rut);
      if (!trabajador) {
        showToast('No fue posible encontrar al trabajador del requisito.', 'error');
        return;
      }
      trabajador.documentos ||= [];
      documentos = trabajador.documentos;
    } else {
      documentos = contratista.documentos;
    }

    let documento = matchDocumentoRequisito(documentos, selectedProyectoId, item.requisito.nombre);
    const fecha = fechaCargaDemo();

    if (!documento) {
      documento = {
        id: idDocumento(item, contratista.id, selectedProyectoId),
        nombre: item.requisito.nombre,
        categoria: item.requisito.categoria,
        estado: 'revision',
        vencimiento: '—',
        proyectoId: selectedProyectoId,
        subido: fecha,
        version: 1,
        archivoReferencia: archivoDocumento(item, 1),
        historial: [],
      };
      documentos.push(documento);
    } else {
      const versionAnterior = documento.version || 1;
      const tieneVersionAnterior = Boolean(documento.archivoReferencia || documento.subido || documento.estado !== 'pendiente');
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
      documento.archivoReferencia = archivoDocumento(item, documento.version || 1);
      documento.motivoRechazo = undefined;
      documento.explicacionRechazo = undefined;
      documento.solucionRechazo = undefined;
      documento.motivo = undefined;
      documento.observacion = undefined;
      documento.revisor = undefined;
      documento.fechaRevisado = undefined;
    }

    if (trabajador) trabajador.estado = calcularEstadoTrabajador(trabajador, selectedProyectoId);
    saveContratistas(contratistas);
    onDataChanged();
    showToast('Documento enviado a revisión por Acredita.', 'success');
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
        <div className="doc-summary">
          <div className="doc-metric action">
            <div className="doc-metric-label">Requieren acción</div>
            <div className="doc-metric-value">{accion}</div>
            <div className="doc-metric-foot">Obligatorios pendientes, rechazados o vencidos</div>
          </div>
          <div className="doc-metric review">
            <div className="doc-metric-label">En revisión</div>
            <div className="doc-metric-value">{revision}</div>
            <div className="doc-metric-foot">Esperando validación de Acredita</div>
          </div>
          <div className="doc-metric expiry">
            <div className="doc-metric-label">Por vencer</div>
            <div className="doc-metric-value">{porVencer}</div>
            <div className="doc-metric-foot">Todavía vigentes; conviene renovar</div>
          </div>
          <div className="doc-metric ok">
            <div className="doc-metric-label">Aprobados</div>
            <div className="doc-metric-value">{aprobados}</div>
            <div className="doc-metric-foot">Vigentes y sin acción inmediata</div>
          </div>
        </div>

        <div className="doc-notice">
          <div className="doc-notice-icon">!</div>
          <div><b>Cómo funciona:</b> cada carga parte desde un requisito exacto. Así el archivo queda asociado al proyecto, empresa o trabajador correcto y no se transforma en un documento "suelto".</div>
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
                    const { label, cls } = accionDoc(item);
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
                          </div>
                        </div>
                        <div className="doc-owner">
                          {item.scope === 'empresa' ? 'Empresa' : item.ownerNombre}
                          <small>{item.requisito.categoria}</small>
                        </div>
                        <div>
                          <span className={`doc-badge ${DOC_BADGE_CLASS[item.estado]}`}><span className="doc-dot" />{item.estado}</span>
                          <div className="doc-date">{item.doc?.vencimiento && item.doc.vencimiento !== '-' ? item.doc.vencimiento : '—'}</div>
                        </div>
                        <button
                          className={`doc-btn ${cls}`}
                          onClick={e => {
                            e.stopPropagation();
                            setSelectedKey(item.key);
                            if (label !== 'Ver') subirDocumento(item);
                          }}
                        >
                          {label}
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
              const { label, cls } = accionDoc(selected);
              const historial = selected.doc?.historial || [];
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
                    </div>

                    <div className={`doc-info-box ${stateBoxClass(selected.estado)}`}>
                      <strong>{selected.estado}</strong>
                      <p>{stateCopy(selected)}</p>
                    </div>

                    {selected.estado === 'Rechazado' && (selected.doc?.motivoRechazo || selected.doc?.motivo || selected.doc?.observacion) && (
                      <div className="doc-info-box red">
                        <strong>Motivo</strong>
                        <p>{selected.doc.motivoRechazo || selected.doc.motivo || selected.doc.observacion}</p>
                      </div>
                    )}

                    {guidanceText(selected) && (
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
                    </div>

                    {selected.doc ? (
                      <div className="doc-upload-box">
                        <strong>{selected.doc.archivoReferencia || 'Documento cargado'}</strong>
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
                            <span className={`doc-badge ${h.estado === 'aprobado' ? 'doc-badge-green' : h.estado === 'rechazado' ? 'doc-badge-red' : h.estado === 'por_vencer' ? 'doc-badge-yellow' : 'doc-badge-blue'}`}>
                              {h.estado === 'aprobado' ? 'Aprobado' : h.estado === 'rechazado' ? 'Rechazado' : h.estado === 'por_vencer' ? 'Por vencer' : h.estado === 'revision' ? 'En revisión' : 'Pendiente'}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="doc-detail-actions">
                      <button className="doc-btn doc-btn-ghost" onClick={() => setSelectedKey(null)}>Cerrar</button>
                      <button
                        className={`doc-btn ${cls}`}
                        onClick={() => {
                          if (label !== 'Ver') subirDocumento(selected);
                          else if (selected.doc?.archivoReferencia) showToast(`Archivo actual: ${selected.doc.archivoReferencia}`, 'success');
                        }}
                      >
                        {selected.estado === 'En revisión' || selected.estado === 'Aprobado' ? 'Ver documento' : label}
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
