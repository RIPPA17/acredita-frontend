import { useState } from 'react';
import { Search, Building2, Lock, Wallet, AlertCircle, AlertTriangle, CheckCircle, FileText } from 'lucide-react';
import { calcularAccesoPago, esTrabajadorAsignado, getRequisitos } from '../../data/localStorageDb';
import { Contratista, Proyecto, Mandante, Trabajador } from '../../types';
import { buildAcreditacionRows, estadoUILabel, badgeClass as acredBadgeClass, EstadoUI } from '../admin/acreditacionUtils';
import {
  buildRequisitosEmpresa,
  buildRequisitosTrabajador,
  encontrarProximoVencimiento,
  getEstadoAccesoProyecto,
} from './inicio/inicioUtils';

// Mismo mapeo de colores centrales usado en el resto del portal Contratista.
const BADGE: Record<string, string> = { green: 'b-green', amber: 'b-yellow', red: 'b-red', gray: 'b-gray' };
// Sufijo de clase CSS (contractor-projects-*) por estado de acreditación.
const STATE_KEY: Record<EstadoUI, string> = {
  Bloqueado: 'bloqueado',
  'En proceso': 'proceso',
  Acreditado: 'acreditado',
};
const STATE_ICON: Record<EstadoUI, typeof CheckCircle> = {
  Acreditado: CheckCircle,
  'En proceso': AlertTriangle,
  Bloqueado: AlertCircle,
};
const ALERT_PREFIX: Record<EstadoUI, string> = {
  Bloqueado: 'Bloqueos:',
  'En proceso': 'Prioridad:',
  Acreditado: 'Todo al día:',
};
const ACCESO_LABEL_CORTO: Record<'habilitado' | 'parcial' | 'bloqueado', string> = {
  habilitado: 'Habilitado',
  parcial: 'Parcial',
  bloqueado: 'Bloqueado',
};
const ACCESO_TEXT_COLOR: Record<'habilitado' | 'parcial' | 'bloqueado', string> = {
  habilitado: 'text-[#1a6030]',
  parcial: 'text-[#a87400]',
  bloqueado: 'text-[#9a2020]',
};
// Orden recomendado: lo que requiere atención primero.
const PRIORIDAD_ESTADO: Record<EstadoUI, number> = { Bloqueado: 0, 'En proceso': 1, Acreditado: 2 };

function Hero() {
  return (
    <div className="contractor-projects-hero">
      <p className="contractor-projects-hero-eyebrow">Portal contratista</p>
      <h2 className="contractor-projects-hero-title">Mis proyectos</h2>
      <p className="contractor-projects-hero-sub">
        Revisa tu acreditación en cada obra o faena, el estado de acceso y pago, el avance de empresa y trabajadores y las acciones que requieren atención.
      </p>
    </div>
  );
}

export default function MisProyectosTab({
  contratistaLogueado,
  misProyectos,
  allMandantes,
  selectedProyectoId,
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
      <div className="fade-in flex flex-col">
        <Hero />
        <div className="contractor-projects-floating">
          <div className="card py-14 flex flex-col items-center justify-center text-center">
            <FileText size={38} className="text-gray-300 mb-3" />
            <p className="font-semibold text-navy text-[15.4px]">Todavía no tienes proyectos asociados.</p>
            <p className="text-sm text-gray-500 mt-1 max-w-md">Cuando un mandante te asigne o invite a una obra o faena, aparecerá aquí.</p>
          </div>
        </div>
      </div>
    );
  }

  // --- Única fuente de verdad de acreditación: la misma que usa Inicio ---
  const rows = buildAcreditacionRows([contratistaLogueado], misProyectos, allMandantes);
  const rowsByProyecto = new Map(rows.map(r => [r.proyectoId, r]));
  const requisitosAll = getRequisitos();

  const proyectosInfo = misProyectos.map(p => {
    const row = rowsByProyecto.get(p.id);
    const mandante = allMandantes.find(m => m.id === p.mandanteId);
    const estadoUI: EstadoUI = row ? estadoUILabel(row.estado) : 'En proceso';
    const badge = row ? BADGE[acredBadgeClass(row.estado)] : 'b-yellow';

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
      badge,
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

  // Orden: Bloqueado primero, luego En proceso, luego Acreditado; después por nombre.
  const proyectosOrdenados = [...proyectosInfo].sort((a, b) => {
    const diff = PRIORIDAD_ESTADO[a.estadoUI] - PRIORIDAD_ESTADO[b.estadoUI];
    return diff !== 0 ? diff : a.proyecto.nombre.localeCompare(b.proyecto.nombre);
  });

  const q = search.toLowerCase().trim();
  const proyectosFiltrados = proyectosOrdenados.filter(i => {
    const okFilter = filter === 'Todos' || i.estadoUI === filter;
    const okSearch = !q || i.proyecto.nombre.toLowerCase().includes(q) || (i.mandante?.nombre || '').toLowerCase().includes(q);
    return okFilter && okSearch;
  });

  const hayFiltrosActivos = search.trim() !== '' || filter !== 'Todos';
  const limpiarFiltros = () => { setSearch(''); setFilter('Todos'); };

  const irAInicio = (proyectoId: string) => { setSelectedProyectoId(proyectoId); setActiveTab('dashboard'); };
  const irADocumentos = (proyectoId: string) => { setSelectedProyectoId(proyectoId); setActiveTab('subir'); };
  const irATrabajadores = (proyectoId: string) => { setSelectedProyectoId(proyectoId); setActiveTab('trabajadores'); };

  return (
    <div className="fade-in flex flex-col">
      <Hero />

      <div className="contractor-projects-floating flex flex-col gap-5">
        {/* Identidad del contratista + buscador: superficie blanca propia
            para que el solape sobre el hero nunca deje texto oscuro sin
            soporte visual encima del fondo navy. */}
        <div className="contractor-projects-identity flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <p className="text-[20px] font-bold text-navy leading-tight">{contratistaLogueado.nombre}</p>
            <p className="text-[11.5px] text-gray-500 mt-0.5">RUT {contratistaLogueado.rut} · {totalProyectosActivos} proyecto{totalProyectosActivos === 1 ? '' : 's'} activo{totalProyectosActivos === 1 ? '' : 's'}</p>
          </div>
          <div className="relative w-full md:w-auto">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="form-input pl-9 w-full md:w-[280px]"
              placeholder="Buscar proyecto o mandante..."
              aria-label="Buscar proyecto o mandante"
            />
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="contractor-projects-kpi">
            <p className="contractor-projects-kpi-title">Proyectos activos</p>
            <p className="contractor-projects-kpi-value text-navy">{totalProyectosActivos}</p>
            <p className="contractor-projects-kpi-foot">Obras y faenas asignadas</p>
          </div>
          <div className="contractor-projects-kpi">
            <p className="contractor-projects-kpi-title">Acreditados</p>
            <p className="contractor-projects-kpi-value text-[#1a6030]">{totalAcreditados}</p>
            <p className="contractor-projects-kpi-foot">Sin acciones pendientes</p>
          </div>
          <div className="contractor-projects-kpi">
            <p className="contractor-projects-kpi-title">En proceso</p>
            <p className="contractor-projects-kpi-value text-[#a87400]">{totalEnProceso}</p>
            <p className="contractor-projects-kpi-foot">Requieren seguimiento</p>
          </div>
          <div className="contractor-projects-kpi">
            <p className="contractor-projects-kpi-title">Bloqueados</p>
            <p className="contractor-projects-kpi-value text-[#9a2020]">{totalBloqueados}</p>
            <p className="contractor-projects-kpi-foot">Requieren acción prioritaria</p>
          </div>
        </div>

        {/* Filtros */}
        <div className="flex gap-2 flex-wrap" role="group" aria-label="Filtrar proyectos por estado">
          {([
            ['Todos', misProyectos.length],
            ['Acreditado', totalAcreditados],
            ['En proceso', totalEnProceso],
            ['Bloqueado', totalBloqueados],
          ] as Array<[typeof filter, number]>).map(([f, count]) => (
            <button
              key={f}
              type="button"
              aria-pressed={filter === f}
              className={`contractor-projects-filter ${filter === f ? 'contractor-projects-filter-active' : ''}`}
              onClick={() => setFilter(f)}
            >
              {f} <span className="contractor-projects-filter-count">{count}</span>
            </button>
          ))}
        </div>

        {/* Grid de proyectos */}
        {proyectosFiltrados.length === 0 ? (
          <div className="card py-10 flex flex-col items-center justify-center text-center text-gray-500 gap-3">
            <Search size={28} className="text-gray-300" />
            <p>No encontramos proyectos con esos filtros.</p>
            {hayFiltrosActivos && (
              <button className="btn btn-secondary btn-sm" onClick={limpiarFiltros}>Limpiar filtros</button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {proyectosFiltrados.map(info => {
              const { proyecto: p, mandante, estadoUI, badge, estadoAcceso, accesoPago, empresaOk, empresaTotal, trabajadoresOk, trabajadoresTotal, empresaPct, trabajadoresPct, proximoVenc, problemaPrincipal } = info;
              const StatusIcon = STATE_ICON[estadoUI];
              const esSeleccionado = p.id === selectedProyectoId;

              return (
                <div
                  key={p.id}
                  className={`contractor-projects-card state-${STATE_KEY[estadoUI]} ${esSeleccionado ? 'selected' : ''}`}
                >
                  <div className="p-4 border-b border-cream">
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <div className="flex items-center gap-1.5 text-gray-500 text-[11px] font-bold uppercase tracking-wider">
                          <Building2 size={13} /> {mandante?.nombre || 'Mandante no disponible'}
                        </div>
                        <h3 className="text-[17.5px] font-bold text-navy mt-1">{p.nombre}</h3>
                      </div>
                      <span className={`badge contractor-projects-status-badge ${badge} shrink-0`}>{estadoUI}</span>
                    </div>
                    {esSeleccionado && <p className="text-[10.5px] text-brown font-semibold mt-1.5">Proyecto seleccionado</p>}
                  </div>

                  <div className="p-4 flex-1 flex flex-col gap-3">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="contractor-projects-mini">
                        <p className="contractor-projects-mini-label">Acceso</p>
                        <p className={`contractor-projects-mini-value ${ACCESO_TEXT_COLOR[estadoAcceso.estado]}`}>{ACCESO_LABEL_CORTO[estadoAcceso.estado]}</p>
                      </div>
                      <div className="contractor-projects-mini">
                        <p className="contractor-projects-mini-label">Pago</p>
                        <p className={`contractor-projects-mini-value ${accesoPago.pagoBloqueado ? 'text-[#9a2020]' : 'text-[#1a6030]'}`}>{accesoPago.pagoBloqueado ? 'Retenido' : 'Habilitado'}</p>
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-[12.5px] font-semibold text-navy mb-1.5">
                        <span>Empresa</span>
                        <span className="text-gray-500 font-medium">{empresaTotal > 0 ? `${empresaOk} / ${empresaTotal} obligatorios` : 'Sin requisitos obligatorios'}</span>
                      </div>
                      <div className="prog-wrap"><div className="prog-fill" style={{ width: `${empresaPct}%` }}></div></div>
                    </div>
                    <div>
                      <div className="flex justify-between text-[12.5px] font-semibold text-navy mb-1.5">
                        <span>Trabajadores</span>
                        <span className="text-gray-500 font-medium">{trabajadoresTotal > 0 ? `${trabajadoresOk} / ${trabajadoresTotal} acreditados` : 'Sin trabajadores agregados'}</span>
                      </div>
                      <div className="prog-wrap"><div className="prog-fill" style={{ width: `${trabajadoresPct}%`, backgroundColor: '#2a6a3a' }}></div></div>
                    </div>

                    <div className={`contractor-projects-alert state-${STATE_KEY[estadoUI]}`}>
                      <StatusIcon size={15} className="shrink-0 mt-0.5" />
                      <span><strong>{ALERT_PREFIX[estadoUI]}</strong> {problemaPrincipal}</span>
                    </div>

                    <p className="text-[11.5px] text-gray-500">
                      {proximoVenc
                        ? <>Próximo vencimiento: <strong className="text-navy font-semibold">{proximoVenc.nombre}{proximoVenc.trabajadorNombre ? ` · ${proximoVenc.trabajadorNombre}` : ''} · {proximoVenc.dias} día{proximoVenc.dias === 1 ? '' : 's'}</strong></>
                        : 'Sin vencimientos próximos'}
                    </p>
                  </div>

                  <div className="p-4 pt-3 mt-auto border-t border-cream flex flex-col gap-2">
                    <button className="contractor-projects-btn-primary" onClick={() => irAInicio(p.id)}>
                      Ver proyecto
                    </button>
                    <div className="grid grid-cols-2 gap-2">
                      <button className="btn contractor-projects-btn-ghost btn-sm" onClick={() => irADocumentos(p.id)}>Documentos</button>
                      <button className="btn contractor-projects-btn-ghost btn-sm" onClick={() => irATrabajadores(p.id)}>Trabajadores</button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
