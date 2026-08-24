import { useEffect, useRef, useState, RefObject } from 'react';
import { Search } from 'lucide-react';
import {
  calcularAccesoPago,
  calcularEstadoTrabajador,
  esTrabajadorAsignado,
  getMotivoBloqueoTrabajador,
  getRequisitos,
} from '../../data/localStorageDb';
import { Contratista, Proyecto, Mandante, Requisito, Trabajador } from '../../types';
import { buildAcreditacionRows, estadoUILabel, DocEstado, EstadoUI } from '../admin/acreditacionUtils';
import {
  accionEmpresaLabel,
  buildRequisitosEmpresa,
  buildRequisitosTrabajador,
  encontrarProximoVencimiento,
  getEstadoAccesoProyecto,
  impactoLabel,
} from './inicio/inicioUtils';

// Misma maqueta del prototipo HTML aprobado (mp-*), pero con los colores
// reales de Acredita (ver .mp-page en index.css). Solo la CLAVE (qué
// estado corresponde a cada proyecto/documento/trabajador) sale de la
// lógica central; el color/label es presentación.
const STATE_KEY: Record<EstadoUI, string> = {
  Bloqueado: 'bloqueado',
  'En proceso': 'proceso',
  Acreditado: 'acreditado',
};
const MP_BADGE_CLASS: Record<EstadoUI, string> = {
  Acreditado: 'mp-badge-green',
  'En proceso': 'mp-badge-yellow',
  Bloqueado: 'mp-badge-red',
};
const MP_ALERT_CLASS: Record<EstadoUI, string> = {
  Acreditado: 'mp-alert-green',
  'En proceso': 'mp-alert-yellow',
  Bloqueado: 'mp-alert-red',
};
const ALERT_PREFIX: Record<EstadoUI, string> = {
  Bloqueado: 'Bloqueos:',
  'En proceso': 'Prioridad:',
  Acreditado: 'Todo al día:',
};
// Acentos por estado (bordes/barras): mismos tonos que usa el borde
// superior de la card (state-acreditado/proceso/bloqueado en index.css).
const BAR_COLOR_EMPRESA: Record<EstadoUI, string> = {
  Bloqueado: '#c73b3b',
  'En proceso': 'var(--brown)',
  Acreditado: '#2a8040',
};
const BAR_COLOR_TRABAJADORES: Record<EstadoUI, string> = {
  Bloqueado: '#c73b3b',
  'En proceso': '#2a8040',
  Acreditado: '#2a8040',
};
const ACCESO_LABEL_CORTO: Record<'habilitado' | 'parcial' | 'pendiente' | 'bloqueado', string> = {
  habilitado: 'Habilitado',
  parcial: 'Parcial',
  pendiente: 'Pendiente',
  bloqueado: 'Bloqueado',
};
// Mismos tonos de texto que usan los badges (.mp-badge-green/yellow/red).
const ACCESO_COLOR: Record<'habilitado' | 'parcial' | 'pendiente' | 'bloqueado', string> = {
  habilitado: '#1a6030',
  parcial: '#7a5800',
  pendiente: '#7a5800',
  bloqueado: '#9a2020',
};
const DOC_ESTADO_BADGE: Record<DocEstado, string> = {
  Aprobado: 'mp-badge-green',
  Rechazado: 'mp-badge-red',
  Vencido: 'mp-badge-red',
  'En revisión': 'mp-badge-blue',
  'Por vencer': 'mp-badge-yellow',
  Pendiente: 'mp-badge-gray',
};
const TRABAJADOR_LABEL: Record<'aprobado' | 'por_vencer' | 'rechazado' | 'pendiente', string> = {
  aprobado: 'Acreditado',
  por_vencer: 'Por vencer',
  rechazado: 'Bloqueado',
  pendiente: 'Pendiente',
};
const TRABAJADOR_BADGE_CLASS: Record<'aprobado' | 'por_vencer' | 'rechazado' | 'pendiente', string> = {
  aprobado: 'mp-badge-green',
  por_vencer: 'mp-badge-yellow',
  rechazado: 'mp-badge-red',
  pendiente: 'mp-badge-gray',
};

interface ProyectoInfo {
  proyecto: Proyecto;
  mandante?: Mandante;
  estadoUI: EstadoUI;
  accesoPago: ReturnType<typeof calcularAccesoPago>;
  estadoAcceso: ReturnType<typeof getEstadoAccesoProyecto>;
  proximoVenc: ReturnType<typeof encontrarProximoVencimiento>;
  problemaPrincipal: string;
  empresaOk: number;
  empresaTotal: number;
  trabajadoresOk: number;
  trabajadoresTotal: number;
  empresaPct: number;
  trabajadoresPct: number;
}

function Hero() {
  return (
    <section className="mp-hero">
      <div className="mp-eyebrow">Portal contratista</div>
      <h1 className="mp-h1">Mis proyectos</h1>
      <div className="mp-subtitle">
        Revisa tu acreditación en cada obra o faena, el estado de acceso y pago, el avance de empresa y trabajadores y las acciones que requieren atención.
      </div>
    </section>
  );
}

function DetalleProyecto({
  info,
  contratistaLogueado,
  misProyectos,
  requisitosAll,
  detalleTab,
  setDetalleTab,
  onClose,
  onIrADocumentos,
  onIrATrabajadores,
  onVerFicha,
  detalleRef,
}: {
  info: ProyectoInfo;
  contratistaLogueado: Contratista;
  misProyectos: Proyecto[];
  requisitosAll: Requisito[];
  detalleTab: 'resumen' | 'empresa' | 'trabajadores';
  setDetalleTab: (t: 'resumen' | 'empresa' | 'trabajadores') => void;
  onClose: () => void;
  onIrADocumentos: (proyectoId: string) => void;
  onIrATrabajadores: (proyectoId: string, worker?: Trabajador) => void;
  onVerFicha?: (proyectoId: string) => void;
  detalleRef: RefObject<HTMLDivElement>;
}) {
  const { proyecto: p, mandante, estadoUI, accesoPago, estadoAcceso, proximoVenc, problemaPrincipal, empresaOk, empresaTotal, trabajadoresOk, trabajadoresTotal, empresaPct, trabajadoresPct } = info;

  const trabajadoresAsignados = (contratistaLogueado.trabajadores || []).filter(w =>
    esTrabajadorAsignado(w, p.id, misProyectos)
  );

  return (
    <div className="mp-detail" ref={detalleRef}>
      <div className="mp-detail-card">
        <div className="mp-detail-head">
          <div>
            <div className="mp-metric-title">Detalle del proyecto</div>
            <div className="mp-detail-title">{p.nombre}</div>
            <div className="mp-detail-sub">Mandante: {mandante?.nombre || 'Mandante no disponible'}</div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <span className={`mp-badge ${MP_BADGE_CLASS[estadoUI]}`}>
              <span className="mp-badge-dot" />
              {estadoUI}
            </span>
            <button className="mp-btn mp-btn-secondary mp-btn-inline" onClick={onClose}>Cerrar detalle</button>
          </div>
        </div>

        <div className="mp-detail-tabs">
          {(['resumen', 'empresa', 'trabajadores'] as const).map(t => (
            <button
              key={t}
              className={`mp-detail-tab ${detalleTab === t ? 'active' : ''}`}
              onClick={() => setDetalleTab(t)}
            >
              {t === 'resumen' ? 'Resumen' : t === 'empresa' ? 'Empresa' : 'Trabajadores'}
            </button>
          ))}
        </div>

        {detalleTab === 'resumen' && (
          <>
            <div className="mp-grid mp-grid-4" style={{ marginBottom: 14 }}>
              <div className="mp-mini">
                <div className="mp-mini-label">Acreditación</div>
                <div className="mp-mini-value">{estadoUI}</div>
              </div>
              <div className="mp-mini">
                <div className="mp-mini-label">Acceso</div>
                <div className="mp-mini-value" style={{ color: ACCESO_COLOR[estadoAcceso.estado] }}>{ACCESO_LABEL_CORTO[estadoAcceso.estado]}</div>
              </div>
              <div className="mp-mini">
                <div className="mp-mini-label">Pago</div>
                <div className="mp-mini-value" style={{ color: accesoPago.pagoEstado === 'bloqueado' ? '#9a2020' : accesoPago.pagoEstado === 'pendiente' ? '#7a5800' : '#1a6030' }}>{accesoPago.pagoEstado === 'bloqueado' ? 'Retenido' : accesoPago.pagoEstado === 'pendiente' ? 'Pendiente' : 'Habilitado'}</div>
              </div>
              <div className="mp-mini">
                <div className="mp-mini-label">Próximo vencimiento</div>
                <div className="mp-mini-value">{proximoVenc ? `${proximoVenc.dias} día${proximoVenc.dias === 1 ? '' : 's'}` : 'Sin alertas'}</div>
              </div>
            </div>

            <div className="mp-grid mp-grid-2">
              <div>
                <div className="mp-detail-section-title">Qué requiere atención</div>
                <div className={`mp-alert ${MP_ALERT_CLASS[estadoUI]}`} style={{ marginTop: 10 }}>{problemaPrincipal}</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
                  <button className="mp-btn mp-btn-primary mp-btn-inline" onClick={() => onIrADocumentos(p.id)}>Ir a documentos</button>
                  <button className="mp-btn mp-btn-secondary mp-btn-inline" onClick={() => onIrATrabajadores(p.id)}>Ver trabajadores</button>
                  {onVerFicha && (
                    <button className="mp-btn mp-btn-secondary mp-btn-inline" onClick={() => onVerFicha(p.id)}>Ver ficha de acreditación</button>
                  )}
                </div>
              </div>
              <div>
                <div className="mp-detail-section-title">Avance</div>
                <div style={{ marginTop: 10 }}>
                  <div className="mp-line-row"><strong>Empresa</strong><span>{empresaTotal > 0 ? `${empresaOk} / ${empresaTotal}` : 'Sin requisitos obligatorios'}</span></div>
                  <div className="mp-progress"><div className="mp-progress-fill" style={{ width: `${empresaPct}%`, background: BAR_COLOR_EMPRESA[estadoUI] }} /></div>
                </div>
                <div style={{ marginTop: 13 }}>
                  <div className="mp-line-row"><strong>Trabajadores</strong><span>{trabajadoresTotal > 0 ? `${trabajadoresOk} / ${trabajadoresTotal}` : 'Sin trabajadores agregados'}</span></div>
                  <div className="mp-progress"><div className="mp-progress-fill" style={{ width: `${trabajadoresPct}%`, background: BAR_COLOR_TRABAJADORES[estadoUI] }} /></div>
                </div>
              </div>
            </div>
          </>
        )}

        {detalleTab === 'empresa' && (() => {
          const empresaItems = buildRequisitosEmpresa(contratistaLogueado, p.id, requisitosAll);
          return (
            <div className="mp-detail-table-wrap" style={{ marginTop: 14 }}>
              {empresaItems.length === 0 ? (
                <p style={{ color: '#7a7a6a', fontSize: 12.5, textAlign: 'center', padding: 20 }}>Este proyecto no tiene requisitos de empresa configurados.</p>
              ) : (
                <table className="mp-detail-table">
                  <thead>
                    <tr><th>Requisito</th><th>Estado</th><th>Vencimiento</th><th>Acción</th></tr>
                  </thead>
                  <tbody>
                    {empresaItems.map(item => (
                      <tr key={item.requisito.id}>
                        <td>{item.requisito.nombre}{!item.requisito.obligatorio && <span style={{ color: '#7a7a6a' }}> (opcional)</span>}</td>
                        <td><span className={`mp-badge ${DOC_ESTADO_BADGE[item.estado]}`}>{item.estado}</span></td>
                        <td>{item.doc?.vencimiento && item.doc.vencimiento !== '-' ? item.doc.vencimiento : '—'}<div style={{ fontSize: 10.5, color: '#7a7a6a' }}>{impactoLabel(item.requisito)}</div></td>
                        <td>
                          <button className="mp-btn mp-btn-secondary mp-btn-inline" onClick={() => onIrADocumentos(p.id)}>
                            {accionEmpresaLabel(item.estado, !!item.doc)}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          );
        })()}

        {detalleTab === 'trabajadores' && (
          <div className="mp-detail-table-wrap" style={{ marginTop: 14 }}>
            {trabajadoresAsignados.length === 0 ? (
              <p style={{ color: '#7a7a6a', fontSize: 12.5, textAlign: 'center', padding: 20 }}>Este proyecto todavía no tiene trabajadores asignados.</p>
            ) : (
              <table className="mp-detail-table">
                <thead>
                  <tr><th>Trabajador</th><th>Estado</th><th>Documentos obligatorios</th><th>Acción</th></tr>
                </thead>
                <tbody>
                  {trabajadoresAsignados.map(w => {
                    const estado = calcularEstadoTrabajador(w, p.id);
                    const workerItems = buildRequisitosTrabajador(w, p.id, requisitosAll).filter(i => i.requisito.obligatorio);
                    const ok = workerItems.filter(i => i.cumplido).length;
                    return (
                      <tr key={w.rut}>
                        <td>{w.nombre}</td>
                        <td>
                          <span className={`mp-badge ${TRABAJADOR_BADGE_CLASS[estado]}`}>{TRABAJADOR_LABEL[estado]}</span>
                          {estado !== 'aprobado' && <div style={{ fontSize: 10.5, color: '#7a7a6a', marginTop: 3 }}>{getMotivoBloqueoTrabajador(w, p.id)}</div>}
                        </td>
                        <td>{ok} / {workerItems.length}</td>
                        <td>
                          <button className="mp-btn mp-btn-secondary mp-btn-inline" onClick={() => onIrATrabajadores(p.id, w)}>Ver trabajador</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function MisProyectosTab({
  contratistaLogueado,
  misProyectos,
  allMandantes,
  setSelectedProyectoId,
  setActiveTab,
  setSelectedWorkerForDocs,
  setShowFichaAcreditacion,
}: {
  contratistaLogueado: Contratista;
  misProyectos: Proyecto[];
  allMandantes: Mandante[];
  selectedProyectoId: string;
  setSelectedProyectoId: (id: string) => void;
  setActiveTab: (v: string) => void;
  setSelectedWorkerForDocs?: (v: Trabajador | null) => void;
  setShowFichaAcreditacion?: (v: boolean) => void;
}) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'Todos' | EstadoUI>('Todos');
  const [detalleProyectoId, setDetalleProyectoId] = useState<string | null>(null);
  const [detalleTab, setDetalleTab] = useState<'resumen' | 'empresa' | 'trabajadores'>('resumen');
  const detalleRef = useRef<HTMLDivElement>(null);

  // --- Única fuente de verdad de acreditación: la misma que usa Inicio ---
  const rows = buildAcreditacionRows([contratistaLogueado], misProyectos, allMandantes);
  const rowsByProyecto = new Map(rows.map(r => [r.proyectoId, r]));
  const requisitosAll = getRequisitos();

  // Orden natural: el mismo de misProyectos, sin reordenar por criticidad.
  const proyectosInfo: ProyectoInfo[] = misProyectos.map(p => {
    const row = rowsByProyecto.get(p.id);
    const mandante = allMandantes.find(m => m.id === p.mandanteId);
    const estadoUI: EstadoUI = row ? estadoUILabel(row.estado) : 'En proceso';

    const trabajadoresProyecto = (contratistaLogueado.trabajadores || []).filter(w =>
      esTrabajadorAsignado(w, p.id, misProyectos)
    );
    const accesoPago = calcularAccesoPago(contratistaLogueado, p.id);
    const estadoAcceso = getEstadoAccesoProyecto(contratistaLogueado, p.id, trabajadoresProyecto);

    // Próximo vencimiento: mismos helpers que Inicio, nunca una ventana fija propia.
    const empresaItems = buildRequisitosEmpresa(contratistaLogueado, p.id, requisitosAll);
    const workerItems = trabajadoresProyecto.flatMap((w: Trabajador) => buildRequisitosTrabajador(w, p.id, requisitosAll));
    const proximoVenc = encontrarProximoVencimiento([...empresaItems, ...workerItems]);

    // Problema principal: se arma solo con los blockers que ya calculó
    // buildAcreditacionRows (row.blockers) — ningún cálculo de acreditación
    // paralelo, solo se compone el texto.
    const companyBlockers = row?.blockers.filter(b => b.tipo === 'Empresa') ?? [];
    const workerBlockers = row?.blockers.filter(b => b.tipo === 'Trabajador') ?? [];
    const problemaParts: string[] = companyBlockers.map(b => `${b.nombre} ${b.estado.toLowerCase()}`);
    if (workerBlockers.length > 0) {
      problemaParts.push(`${workerBlockers.length} trabajador${workerBlockers.length === 1 ? '' : 'es'} requiere${workerBlockers.length === 1 ? '' : 'n'} atención`);
    }
    const problemaPrincipal = problemaParts.length > 0 ? problemaParts.join(' · ') : 'Sin acciones pendientes';

    const empresaOk = row?.company.ok ?? 0;
    const empresaTotal = row?.company.total ?? 0;
    const trabajadoresOk = row?.workers.ok ?? 0;
    const trabajadoresTotal = row?.workers.total ?? trabajadoresProyecto.length;
    const empresaPct = empresaTotal > 0 ? Math.round((empresaOk / empresaTotal) * 100) : 0;
    const trabajadoresPct = trabajadoresTotal > 0 ? Math.round((trabajadoresOk / trabajadoresTotal) * 100) : 0;

    return {
      proyecto: p,
      mandante,
      estadoUI,
      accesoPago,
      estadoAcceso,
      proximoVenc,
      problemaPrincipal,
      empresaOk,
      empresaTotal,
      trabajadoresOk,
      trabajadoresTotal,
      empresaPct,
      trabajadoresPct,
    };
  });

  const totalAcreditados = proyectosInfo.filter(i => i.estadoUI === 'Acreditado').length;
  const totalEnProceso = proyectosInfo.filter(i => i.estadoUI === 'En proceso').length;
  const totalBloqueados = proyectosInfo.filter(i => i.estadoUI === 'Bloqueado').length;

  // "Activos": solo cuenta lo que el modelo realmente marca como estado
  // 'Activo'. Sin fallback — si no hay ninguno, el KPI debe mostrar 0.
  const totalProyectosActivos = misProyectos.filter(p => String(p.estado).toLowerCase() === 'activo').length;

  const q = search.toLowerCase().trim();
  const proyectosFiltrados = proyectosInfo.filter(i => {
    const okFilter = filter === 'Todos' || i.estadoUI === filter;
    const okSearch = !q || i.proyecto.nombre.toLowerCase().includes(q) || (i.mandante?.nombre || '').toLowerCase().includes(q);
    return okFilter && okSearch;
  });

  // Si el proyecto detallado deja de estar entre los filtrados (cambió el
  // filtro o la búsqueda), cerrar el detalle en vez de dejarlo mostrando un
  // proyecto que ya no aparece en el grid.
  useEffect(() => {
    if (detalleProyectoId && !proyectosFiltrados.some(i => i.proyecto.id === detalleProyectoId)) {
      setDetalleProyectoId(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, filter]);

  const hayFiltrosActivos = search.trim() !== '' || filter !== 'Todos';
  const limpiarFiltros = () => { setSearch(''); setFilter('Todos'); };

  const abrirDetalleProyecto = (proyectoId: string) => {
    setSelectedProyectoId(proyectoId);
    if (detalleProyectoId !== proyectoId) setDetalleTab('resumen');
    setDetalleProyectoId(proyectoId);
    requestAnimationFrame(() => {
      detalleRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };
  const cerrarDetalle = () => setDetalleProyectoId(null);

  const irADocumentos = (proyectoId: string) => { setSelectedProyectoId(proyectoId); setActiveTab('subir'); };
  const irATrabajadores = (proyectoId: string, worker?: Trabajador) => {
    setSelectedProyectoId(proyectoId);
    setActiveTab('trabajadores');
    if (worker && setSelectedWorkerForDocs) setSelectedWorkerForDocs(worker);
  };
  const verFicha = setShowFichaAcreditacion
    ? (proyectoId: string) => {
        setSelectedProyectoId(proyectoId);
        setShowFichaAcreditacion(true);
      }
    : undefined;

  const detalleInfo = detalleProyectoId ? proyectosInfo.find(i => i.proyecto.id === detalleProyectoId) : undefined;

  if (misProyectos.length === 0) {
    return (
      <div className="mp-page">
        <Hero />
        <div className="mp-floating">
          <div className="mp-empty">
            <p style={{ fontWeight: 700, color: 'var(--navy)', marginBottom: 4 }}>Todavía no tienes proyectos asociados.</p>
            <p>Cuando un mandante te asigne o invite a una obra o faena, aparecerá aquí.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mp-page">
      <Hero />

      <section className="mp-floating">
        <div className="mp-toolbar">
          <div>
            <div className="mp-toolbar-name">{contratistaLogueado.nombre}</div>
            <div className="mp-toolbar-sub">RUT {contratistaLogueado.rut} · {totalProyectosActivos} proyecto{totalProyectosActivos === 1 ? '' : 's'} activo{totalProyectosActivos === 1 ? '' : 's'}</div>
          </div>
          <div className="mp-search-wrap">
            <Search size={14} className="mp-search-icon" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="mp-search"
              placeholder="Buscar proyecto o mandante..."
              aria-label="Buscar proyecto o mandante"
            />
          </div>
        </div>

        <div className="mp-grid mp-grid-4" style={{ marginBottom: 14 }}>
          <div className="mp-kpi">
            <div className="mp-metric-title">Proyectos activos</div>
            <div className="mp-metric-value">{totalProyectosActivos}</div>
            <div className="mp-metric-foot">Obras y faenas asignadas</div>
          </div>
          <div className="mp-kpi">
            <div className="mp-metric-title">Acreditados</div>
            <div className="mp-metric-value">{totalAcreditados}</div>
            <div className="mp-metric-foot">Sin acciones pendientes</div>
          </div>
          <div className="mp-kpi">
            <div className="mp-metric-title">En proceso</div>
            <div className="mp-metric-value">{totalEnProceso}</div>
            <div className="mp-metric-foot">Requiere seguimiento</div>
          </div>
          <div className="mp-kpi">
            <div className="mp-metric-title">Bloqueados</div>
            <div className="mp-metric-value">{totalBloqueados}</div>
            <div className="mp-metric-foot">Requiere acción prioritaria</div>
          </div>
        </div>

        <div className="mp-filters" role="group" aria-label="Filtrar proyectos por estado">
          {([
            ['Todos', 'Todos', misProyectos.length],
            ['Acreditado', 'Acreditados', totalAcreditados],
            ['En proceso', 'En proceso', totalEnProceso],
            ['Bloqueado', 'Bloqueados', totalBloqueados],
          ] as Array<[typeof filter, string, number]>).map(([value, label, count]) => (
            <button
              key={value}
              type="button"
              aria-pressed={filter === value}
              className={`mp-filter ${filter === value ? 'active' : ''}`}
              onClick={() => setFilter(value)}
            >
              {label} · {count}
            </button>
          ))}
        </div>

        {proyectosFiltrados.length === 0 ? (
          <div className="mp-empty">
            <p>No hay proyectos que coincidan con la búsqueda o filtro.</p>
            {hayFiltrosActivos && (
              <button className="mp-btn mp-btn-secondary mp-btn-inline" style={{ marginTop: 10 }} onClick={limpiarFiltros}>Limpiar filtros</button>
            )}
          </div>
        ) : (
          <div className="mp-grid mp-grid-3">
            {proyectosFiltrados.map(info => {
              const { proyecto: p, mandante, estadoUI, estadoAcceso, accesoPago, empresaOk, empresaTotal, trabajadoresOk, trabajadoresTotal, empresaPct, trabajadoresPct, proximoVenc, problemaPrincipal } = info;
              const pagoColor = accesoPago.pagoEstado === 'bloqueado' ? '#9a2020' : accesoPago.pagoEstado === 'pendiente' ? '#7a5800' : '#1a6030';

              return (
                <article key={p.id} className={`mp-project-card state-${STATE_KEY[estadoUI]}`}>
                  <div className="mp-project-head">
                    <div className="mp-status-row">
                      <div>
                        <div className="mp-project-title">{p.nombre}</div>
                        <div className="mp-project-sub">Mandante: {mandante?.nombre || 'Mandante no disponible'}</div>
                      </div>
                      <span className={`mp-badge ${MP_BADGE_CLASS[estadoUI]}`}>
                        <span className="mp-badge-dot" />
                        {estadoUI}
                      </span>
                    </div>
                  </div>

                  <div className="mp-project-body">
                    <div className="mp-split">
                      <div className="mp-mini">
                        <div className="mp-mini-label">Acceso</div>
                        <div className="mp-mini-value" style={{ color: ACCESO_COLOR[estadoAcceso.estado] }}>{ACCESO_LABEL_CORTO[estadoAcceso.estado]}</div>
                      </div>
                      <div className="mp-mini">
                        <div className="mp-mini-label">Pago</div>
                        <div className="mp-mini-value" style={{ color: pagoColor }}>{accesoPago.pagoEstado === 'bloqueado' ? 'Retenido' : accesoPago.pagoEstado === 'pendiente' ? 'Pendiente' : 'Habilitado'}</div>
                      </div>
                    </div>

                    <div>
                      <div className="mp-line-row"><strong>Empresa</strong><span>{empresaTotal > 0 ? `${empresaOk} / ${empresaTotal} obligatorios` : 'Sin requisitos obligatorios'}</span></div>
                      <div className="mp-progress"><div className="mp-progress-fill" style={{ width: `${empresaPct}%`, background: BAR_COLOR_EMPRESA[estadoUI] }} /></div>
                    </div>
                    <div>
                      <div className="mp-line-row"><strong>Trabajadores</strong><span>{trabajadoresTotal > 0 ? `${trabajadoresOk} / ${trabajadoresTotal} acreditados` : 'Sin trabajadores agregados'}</span></div>
                      <div className="mp-progress"><div className="mp-progress-fill" style={{ width: `${trabajadoresPct}%`, background: BAR_COLOR_TRABAJADORES[estadoUI] }} /></div>
                    </div>

                    <div className={`mp-alert ${MP_ALERT_CLASS[estadoUI]}`}>
                      <strong>{ALERT_PREFIX[estadoUI]}</strong> {problemaPrincipal}
                    </div>

                    <div className="mp-expiry">
                      {proximoVenc
                        ? <>Próximo vencimiento: <strong>{proximoVenc.nombre}{proximoVenc.trabajadorNombre ? ` · ${proximoVenc.trabajadorNombre}` : ''} · {proximoVenc.dias} día{proximoVenc.dias === 1 ? '' : 's'}</strong></>
                        : 'Sin vencimientos próximos'}
                    </div>
                  </div>

                  <div className="mp-project-foot">
                    <button
                      className={`mp-btn ${estadoUI === 'Bloqueado' ? 'mp-btn-danger' : 'mp-btn-primary'}`}
                      onClick={() => abrirDetalleProyecto(p.id)}
                    >
                      {estadoUI === 'Bloqueado' ? 'Resolver bloqueos' : 'Ver proyecto'}
                    </button>
                    <button className="mp-btn mp-btn-secondary" onClick={() => irADocumentos(p.id)}>Documentos</button>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {detalleInfo && (
          <DetalleProyecto
            info={detalleInfo}
            contratistaLogueado={contratistaLogueado}
            misProyectos={misProyectos}
            requisitosAll={requisitosAll}
            detalleTab={detalleTab}
            setDetalleTab={setDetalleTab}
            onClose={cerrarDetalle}
            onIrADocumentos={irADocumentos}
            onIrATrabajadores={irATrabajadores}
            onVerFicha={verFicha}
            detalleRef={detalleRef}
          />
        )}
      </section>
    </div>
  );
}
