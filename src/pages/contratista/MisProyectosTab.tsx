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
const STATE_BORDER: Record<EstadoUI, string> = {
  Acreditado: 'border-t-[#2a6a3a]',
  'En proceso': 'border-t-[#d4a000]',
  Bloqueado: 'border-t-[#c02020]',
};
const STATE_ALERT_CLASS: Record<EstadoUI, string> = {
  Acreditado: 'alert-success',
  'En proceso': 'alert-warn',
  Bloqueado: 'alert-danger',
};
const STATE_ICON: Record<EstadoUI, typeof CheckCircle> = {
  Acreditado: CheckCircle,
  'En proceso': AlertTriangle,
  Bloqueado: AlertCircle,
};
// Orden recomendado: lo que requiere atención primero.
const PRIORIDAD_ESTADO: Record<EstadoUI, number> = { Bloqueado: 0, 'En proceso': 1, Acreditado: 2 };

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
      <div className="fade-in flex flex-col gap-6">
        <div className="page-header">
          <div>
            <h2 className="page-title">Mis proyectos</h2>
            <p className="page-sub">Revisa tu acreditación, acceso, pago y trabajadores en cada obra o faena.</p>
          </div>
        </div>
        <div className="card py-14 flex flex-col items-center justify-center text-center">
          <FileText size={38} className="text-gray-300 mb-3" />
          <p className="font-semibold text-navy text-[15.4px]">Todavía no tienes proyectos asociados.</p>
          <p className="text-sm text-gray-500 mt-1 max-w-md">Cuando un mandante te asigne o invite a una obra o faena, aparecerá aquí.</p>
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
    <div className="fade-in flex flex-col gap-5">
      <div className="page-header">
        <div>
          <h2 className="page-title">Mis proyectos</h2>
          <p className="page-sub">Revisa tu acreditación, acceso, pago y trabajadores en cada obra o faena.</p>
          <p className="text-[12.5px] text-gray-500 mt-1">{contratistaLogueado.nombre} · RUT {contratistaLogueado.rut}</p>
        </div>
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="form-input pl-9 w-64"
            placeholder="Buscar proyecto o mandante..."
            aria-label="Buscar proyecto o mandante"
          />
        </div>
      </div>

      {/* KPIs: siempre 4 en una sola línea, sin envolver */}
      <div className="grid grid-cols-4 gap-[10px] mb-4">
        <div className="card p-4">
          <p className="text-[11px] text-gray-400 font-semibold uppercase tracking-wider mb-1">Proyectos activos</p>
          <p className="text-[22px] font-bold text-navy">{misProyectos.length}</p>
          <p className="text-[11.5px] text-gray-500 mt-0.5">Obras y faenas asignadas</p>
        </div>
        <div className="card p-4">
          <p className="text-[11px] text-gray-400 font-semibold uppercase tracking-wider mb-1">Acreditados</p>
          <p className="text-[22px] font-bold text-[#1a6030]">{totalAcreditados}</p>
          <p className="text-[11.5px] text-gray-500 mt-0.5">Sin acciones pendientes</p>
        </div>
        <div className="card p-4">
          <p className="text-[11px] text-gray-400 font-semibold uppercase tracking-wider mb-1">En proceso</p>
          <p className="text-[22px] font-bold text-[#a87400]">{totalEnProceso}</p>
          <p className="text-[11.5px] text-gray-500 mt-0.5">Requieren seguimiento</p>
        </div>
        <div className="card p-4">
          <p className="text-[11px] text-gray-400 font-semibold uppercase tracking-wider mb-1">Bloqueados</p>
          <p className="text-[22px] font-bold text-[#9a2020]">{totalBloqueados}</p>
          <p className="text-[11.5px] text-gray-500 mt-0.5">Requieren acción prioritaria</p>
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
            className={`chip ${filter === f ? 'active' : ''}`}
            onClick={() => setFilter(f)}
          >
            {f} <span className="chip-count">{count}</span>
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
            const accesoBadge = estadoAcceso.estado === 'habilitado' ? 'b-green' : estadoAcceso.estado === 'bloqueado' ? 'b-red' : 'b-yellow';
            const pagoBadge = accesoPago.pagoBloqueado ? 'b-red' : 'b-green';
            const esSeleccionado = p.id === selectedProyectoId;

            return (
              <div
                key={p.id}
                className={`card !p-0 overflow-hidden flex flex-col border-t-4 ${STATE_BORDER[estadoUI]} hover:shadow-md transition-shadow ${esSeleccionado ? 'ring-2 ring-brown' : ''}`}
              >
                <div className="p-4 border-b border-cream">
                  <div className="flex justify-between items-start gap-2 mb-1">
                    <div>
                      <div className="flex items-center gap-1.5 text-gray-500 text-[11px] font-bold uppercase tracking-wider">
                        <Building2 size={13} /> {mandante?.nombre || 'Mandante no disponible'}
                      </div>
                      <h3 className="text-[16.5px] font-bold text-navy mt-0.5">{p.nombre}</h3>
                    </div>
                    <span className={`badge ${badge} shrink-0`}>{estadoUI}</span>
                  </div>
                  {esSeleccionado && <p className="text-[10.5px] text-brown font-semibold mt-1">Proyecto seleccionado</p>}
                </div>

                <div className="p-4 flex-1 flex flex-col gap-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-cream2 border border-cream3 rounded-xl p-2.5 flex flex-col items-center text-center">
                      <Lock size={14} className="text-gray-400 mb-0.5" />
                      <span className="text-[9.5px] text-gray-400 font-semibold uppercase tracking-wider">Acceso</span>
                      <span className={`badge ${accesoBadge} text-[10px] mt-1`}>{estadoAcceso.label.replace('Acceso ', '')}</span>
                    </div>
                    <div className="bg-cream2 border border-cream3 rounded-xl p-2.5 flex flex-col items-center text-center">
                      <Wallet size={14} className="text-gray-400 mb-0.5" />
                      <span className="text-[9.5px] text-gray-400 font-semibold uppercase tracking-wider">Pago</span>
                      <span className={`badge ${pagoBadge} text-[10px] mt-1`}>{accesoPago.pagoBloqueado ? 'Retenido' : 'Habilitado'}</span>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-[12px] font-semibold text-navy mb-1">
                      <span>Empresa</span>
                      <span className="text-gray-500 font-medium">{empresaTotal > 0 ? `${empresaOk} / ${empresaTotal} obligatorios` : 'Sin requisitos obligatorios'}</span>
                    </div>
                    <div className="prog-wrap"><div className="prog-fill" style={{ width: `${empresaPct}%` }}></div></div>
                  </div>
                  <div>
                    <div className="flex justify-between text-[12px] font-semibold text-navy mb-1">
                      <span>Trabajadores</span>
                      <span className="text-gray-500 font-medium">{trabajadoresTotal > 0 ? `${trabajadoresOk} / ${trabajadoresTotal} acreditados` : 'Sin trabajadores agregados'}</span>
                    </div>
                    <div className="prog-wrap"><div className="prog-fill" style={{ width: `${trabajadoresPct}%`, backgroundColor: '#2a6a3a' }}></div></div>
                  </div>

                  <div className={`alert ${STATE_ALERT_CLASS[estadoUI]} !mb-0 text-[11.5px] items-start`}>
                    <StatusIcon size={15} className="shrink-0 mt-0.5" />
                    <span>{problemaPrincipal}</span>
                  </div>

                  <div className="text-[11.5px] text-gray-500">
                    {proximoVenc
                      ? <>Próximo vencimiento: <strong className="text-navy">{proximoVenc.nombre}{proximoVenc.trabajadorNombre ? ` · ${proximoVenc.trabajadorNombre}` : ''} · {proximoVenc.dias} día{proximoVenc.dias === 1 ? '' : 's'}</strong></>
                      : 'Sin vencimientos próximos'}
                  </div>
                </div>

                <div className="p-4 pt-0 mt-auto flex flex-col gap-2">
                  <button
                    className={`btn ${estadoUI === 'Bloqueado' ? 'btn-reject' : 'btn-primary'} btn-sm w-full`}
                    onClick={() => irAInicio(p.id)}
                  >
                    Ver proyecto
                  </button>
                  <div className="grid grid-cols-2 gap-2">
                    <button className="btn btn-secondary btn-sm" onClick={() => irADocumentos(p.id)}>Documentos</button>
                    <button className="btn btn-secondary btn-sm" onClick={() => irATrabajadores(p.id)}>Trabajadores</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
