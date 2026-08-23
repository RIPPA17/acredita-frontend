import { useState } from 'react';
import { Search } from 'lucide-react';
import { calcularAccesoPago, esTrabajadorAsignado, getRequisitos } from '../../data/localStorageDb';
import { Contratista, Proyecto, Mandante, Trabajador } from '../../types';
import { buildAcreditacionRows, estadoUILabel, EstadoUI } from '../admin/acreditacionUtils';
import {
  buildRequisitosEmpresa,
  buildRequisitosTrabajador,
  encontrarProximoVencimiento,
  getEstadoAccesoProyecto,
} from './inicio/inicioUtils';

// Clases y colores calcados del prototipo HTML aprobado (mp-*), no de los
// tokens de Acredita. Solo la CLAVE (qué estado corresponde a cada
// proyecto) sale de la lógica central; el color/label es presentación.
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
const BAR_COLOR_EMPRESA: Record<EstadoUI, string> = {
  Bloqueado: '#b22e2e',
  'En proceso': '#c4924c',
  Acreditado: '#1f7a43',
};
const BAR_COLOR_TRABAJADORES: Record<EstadoUI, string> = {
  Bloqueado: '#b22e2e',
  'En proceso': '#1f7a43',
  Acreditado: '#1f7a43',
};
const ACCESO_LABEL_CORTO: Record<'habilitado' | 'parcial' | 'bloqueado', string> = {
  habilitado: 'Habilitado',
  parcial: 'Parcial',
  bloqueado: 'Bloqueado',
};
const ACCESO_COLOR: Record<'habilitado' | 'parcial' | 'bloqueado', string> = {
  habilitado: '#1f7a43',
  parcial: '#a87400',
  bloqueado: '#b22e2e',
};

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

export default function MisProyectosTab({
  contratistaLogueado,
  misProyectos,
  allMandantes,
  setSelectedProyectoId,
  setActiveTab,
}: {
  contratistaLogueado: Contratista;
  misProyectos: Proyecto[];
  allMandantes: Mandante[];
  selectedProyectoId: string;
  setSelectedProyectoId: (id: string) => void;
  setActiveTab: (v: string) => void;
}) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'Todos' | EstadoUI>('Todos');

  if (misProyectos.length === 0) {
    return (
      <div className="mp-page">
        <Hero />
        <div className="mp-floating">
          <div className="mp-empty">
            <p style={{ fontWeight: 700, color: '#172033', marginBottom: 4 }}>Todavía no tienes proyectos asociados.</p>
            <p>Cuando un mandante te asigne o invite a una obra o faena, aparecerá aquí.</p>
          </div>
        </div>
      </div>
    );
  }

  // --- Única fuente de verdad de acreditación: la misma que usa Inicio ---
  const rows = buildAcreditacionRows([contratistaLogueado], misProyectos, allMandantes);
  const rowsByProyecto = new Map(rows.map(r => [r.proyectoId, r]));
  const requisitosAll = getRequisitos();

  // Orden natural: el mismo de misProyectos, sin reordenar por criticidad.
  const proyectosInfo = misProyectos.map(p => {
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

  const hayFiltrosActivos = search.trim() !== '' || filter !== 'Todos';
  const limpiarFiltros = () => { setSearch(''); setFilter('Todos'); };

  const irAInicio = (proyectoId: string) => { setSelectedProyectoId(proyectoId); setActiveTab('dashboard'); };
  const irADocumentos = (proyectoId: string) => { setSelectedProyectoId(proyectoId); setActiveTab('subir'); };

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
              <button className="mp-btn mp-btn-secondary" style={{ marginTop: 10 }} onClick={limpiarFiltros}>Limpiar filtros</button>
            )}
          </div>
        ) : (
          <div className="mp-grid mp-grid-3">
            {proyectosFiltrados.map(info => {
              const { proyecto: p, mandante, estadoUI, estadoAcceso, accesoPago, empresaOk, empresaTotal, trabajadoresOk, trabajadoresTotal, empresaPct, trabajadoresPct, proximoVenc, problemaPrincipal } = info;
              const pagoColor = accesoPago.pagoBloqueado ? '#b22e2e' : '#1f7a43';

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
                        <div className="mp-mini-value" style={{ color: pagoColor }}>{accesoPago.pagoBloqueado ? 'Retenido' : 'Habilitado'}</div>
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
                      onClick={() => irAInicio(p.id)}
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
      </section>
    </div>
  );
}
