import { useMemo, useState } from 'react';
import { Search, FolderPlus, Eye } from 'lucide-react';
import { Contratista, Proyecto, Mandante, Requisito } from '../../types';
import { buildAcreditacionRows, AcredRow, badgeClass, EstadoUI } from './acreditacionUtils';

type Filtro = 'todos' | 'bloqueados' | 'proceso' | 'acreditados';

const CHIPS: Array<{ filtro: Filtro; label: string; punto: string }> = [
  { filtro: 'bloqueados', label: 'Bloqueados', punto: 'bg-[#a32d2d]' },
  { filtro: 'proceso', label: 'En proceso', punto: 'bg-[#b58600]' },
  { filtro: 'acreditados', label: 'Acreditados', punto: 'bg-[#1e7a3c]' },
];

const BADGE_CLASS: Record<string, string> = {
  green: 'b-green bg-green-100 text-green-800',
  amber: 'bg-yellow-100 text-yellow-800',
  red: 'b-red bg-red-100 text-red-800',
  gray: 'b-gray bg-gray-100 text-gray-500',
};

// Estado operacional del proyecto (Acreditado/En proceso/Bloqueado/Sin
// contratistas), derivado exclusivamente de las filas reales de
// acreditación del proyecto — nunca de urgenciaBadge/urgenciaLabel.
type EstadoProyecto = EstadoUI | 'Sin contratistas';

const RANK_ESTADO_PROYECTO: Record<EstadoProyecto, number> = {
  Bloqueado: 0,
  'En proceso': 1,
  Acreditado: 2,
  'Sin contratistas': 3,
};

function estadoProyecto(rowsProyecto: AcredRow[]): EstadoProyecto {
  if (rowsProyecto.length === 0) return 'Sin contratistas';
  if (rowsProyecto.some(r => r.estado === 'Vencido/Bloqueado')) return 'Bloqueado';
  if (rowsProyecto.some(r => r.estado === 'En proceso')) return 'En proceso';
  return 'Acreditado';
}

interface ProyectoView {
  proyecto: Proyecto;
  mandante: Mandante | undefined;
  rows: AcredRow[];
  contratistasCount: number;
  trabajadoresCount: number;
  acreditadas: number;
  enProceso: number;
  bloqueadas: number;
  estado: EstadoProyecto;
  rank: number;
}

export default function ProyectosTab({
  GLOBAL_CONTRATISTAS,
  GLOBAL_PROYECTOS,
  GLOBAL_MANDANTES,
  requisitos,
  onVerProyecto,
  setShowNuevoProyectoModal,
  selectedProyectoId,
}: {
  GLOBAL_CONTRATISTAS: Contratista[];
  GLOBAL_PROYECTOS: Proyecto[];
  GLOBAL_MANDANTES: Mandante[];
  requisitos: Requisito[];
  onVerProyecto: (proyecto: Proyecto) => void;
  setShowNuevoProyectoModal: (v: boolean) => void;
  selectedProyectoId?: string | null;
}) {
  const [busqueda, setBusqueda] = useState('');
  const [mandanteFiltro, setMandanteFiltro] = useState('');
  const [filtro, setFiltro] = useState<Filtro>('todos');

  // Misma fuente de verdad que Acreditaciones, Mandantes y Contratistas: una
  // fila por (contratista, proyecto asignado), con su estado real.
  // `requisitos` se incluye en las deps porque buildAcreditacionRows() lee
  // los requisitos internamente vía getRequisitos() — sin esta dependencia,
  // activar/agregar/editar un requisito desde el drawer no refrescaría esta
  // lista hasta que cambiara algún otro estado.
  const acreditacionRows = useMemo(
    () => buildAcreditacionRows(GLOBAL_CONTRATISTAS, GLOBAL_PROYECTOS, GLOBAL_MANDANTES),
    [GLOBAL_CONTRATISTAS, GLOBAL_PROYECTOS, GLOBAL_MANDANTES, requisitos]
  );

  const proyectos: ProyectoView[] = useMemo(() => {
    return GLOBAL_PROYECTOS.map(p => {
      const rows = acreditacionRows.filter(r => r.proyectoId === p.id);
      const mandante = GLOBAL_MANDANTES.find(m => m.id === p.mandanteId);
      const contratistasCount = new Set(rows.map(r => r.contratista.id)).size;
      const trabajadoresCount = rows.reduce((acc, r) => acc + r.workers.total, 0);
      const bloqueadas = rows.filter(r => r.estado === 'Vencido/Bloqueado').length;
      const enProceso = rows.filter(r => r.estado === 'En proceso').length;
      const acreditadas = rows.filter(r => r.estado === 'Aprobado').length;
      const estado = estadoProyecto(rows);
      return {
        proyecto: p,
        mandante,
        rows,
        contratistasCount,
        trabajadoresCount,
        acreditadas,
        enProceso,
        bloqueadas,
        estado,
        rank: RANK_ESTADO_PROYECTO[estado],
      };
    });
  }, [GLOBAL_PROYECTOS, GLOBAL_MANDANTES, acreditacionRows]);

  const conteo: Record<Filtro, number> = {
    todos: proyectos.length,
    bloqueados: proyectos.filter(p => p.estado === 'Bloqueado').length,
    proceso: proyectos.filter(p => p.estado === 'En proceso').length,
    acreditados: proyectos.filter(p => p.estado === 'Acreditado').length,
  };

  const termino = busqueda.trim().toLowerCase();

  const visibles = proyectos
    .filter(p => {
      const coincideBusqueda =
        !termino ||
        p.proyecto.nombre.toLowerCase().includes(termino) ||
        (p.mandante?.nombre || '').toLowerCase().includes(termino) ||
        (p.mandante?.rut || '').toLowerCase().includes(termino);
      const coincideMandante = !mandanteFiltro || p.proyecto.mandanteId === mandanteFiltro;
      const coincideFiltro =
        filtro === 'todos' ? true
          : filtro === 'bloqueados' ? p.estado === 'Bloqueado'
            : filtro === 'proceso' ? p.estado === 'En proceso'
              : p.estado === 'Acreditado';
      return coincideBusqueda && coincideMandante && coincideFiltro;
    })
    .sort((a, b) => a.rank - b.rank || a.proyecto.nombre.localeCompare(b.proyecto.nombre));

  const hayFiltros = termino !== '' || mandanteFiltro !== '' || filtro !== 'todos';

  const limpiarFiltros = () => {
    setBusqueda('');
    setMandanteFiltro('');
    setFiltro('todos');
  };

  return (
    <div className="fade-in">
      {/* Premium Dark Brand Band Header */}
      <div className="relative overflow-hidden bg-gradient-to-br from-navy to-navy-2 px-8 py-4 pb-12 -mx-8 -mt-6">
        <div className="absolute top-[-30%] right-[-10%] w-[400px] h-[400px] rounded-full bg-[radial-gradient(circle,rgba(154,105,78,0.15),transparent_70%)] pointer-events-none" />

        <div className="max-w-[1200px] mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative z-10">
          <div>
            <span className="text-[11px] tracking-[2px] uppercase font-semibold text-gold-hover">
              Panel de administración
            </span>
            <h2 className="text-2xl font-semibold text-white mt-1">Proyectos</h2>
            <p className="text-[13.5px] text-gray-300 mt-1.5 max-w-[550px]">
              Gestiona contratistas, requisitos y acreditaciones dentro de cada proyecto.
            </p>
          </div>

          <div className="flex gap-2.5 shrink-0">
            <button
              onClick={() => setShowNuevoProyectoModal(true)}
              className="px-4.5 py-2.5 rounded-xl bg-gradient-to-r from-gold-hover to-gold text-white hover:brightness-105 text-[13.5px] font-semibold flex items-center gap-2 cursor-pointer transition-all shadow-[0_6px_16px_rgba(179,137,63,0.35)] border-none"
            >
              <FolderPlus size={15} />
              Nuevo proyecto
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area (floated up) */}
      <div className="relative z-20 -mt-8 max-w-[1200px] mx-auto px-1 flex flex-col gap-5">

        {/* Toolbar & Table Panel */}
        <div className="bg-white rounded-2xl border border-cream3 shadow-sm overflow-hidden flex flex-col">

          {/* Toolbar */}
          <div className="p-4 border-b border-cream3 flex flex-wrap items-center justify-between gap-3">

            {/* Segmented Control */}
            <div className="flex bg-[#f1efe6] border border-cream3 rounded-xl p-1 gap-1">
              <button
                onClick={() => setFiltro('todos')}
                className={`px-3.5 py-1.5 rounded-lg text-[12.5px] font-semibold transition-all cursor-pointer border-none flex items-center gap-1 ${
                  filtro === 'todos'
                    ? 'bg-white text-navy shadow-sm'
                    : 'text-gray-500 hover:text-navy hover:bg-white/40'
                }`}
              >
                Todos <span className="opacity-60 text-xs ml-0.5">{conteo.todos}</span>
              </button>
              {CHIPS.map(({ filtro: f, label, punto }) => (
                <button
                  key={f}
                  onClick={() => setFiltro(filtro === f ? 'todos' : f)}
                  aria-pressed={filtro === f}
                  className={`px-3.5 py-1.5 rounded-lg text-[12.5px] font-semibold transition-all cursor-pointer border-none flex items-center gap-1.5 ${
                    filtro === f
                      ? 'bg-white text-navy shadow-sm'
                      : 'text-gray-500 hover:text-navy hover:bg-white/40'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${punto}`} />
                  {label} <span className="opacity-60 text-xs">{conteo[f]}</span>
                </button>
              ))}
            </div>

            {/* Search & Mandante Filter */}
            <div className="flex items-center gap-2 flex-wrap flex-1 justify-end max-w-full">
              <div className="relative min-w-[200px] flex-1 max-w-[320px]">
                <Search
                  size={15}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                />
                <input
                  type="text"
                  value={busqueda}
                  onChange={e => setBusqueda(e.target.value)}
                  placeholder="Buscar proyecto o mandante..."
                  className="form-input w-full pl-9 py-2 text-[13px] bg-[#f1efe6] border-cream3 focus:bg-white transition-all rounded-xl"
                />
              </div>

              <select
                value={mandanteFiltro}
                onChange={e => setMandanteFiltro(e.target.value)}
                className="form-input py-2 text-[13px] min-w-[180px] bg-[#f1efe6] border-cream3 rounded-xl cursor-pointer"
              >
                <option value="">Todos los mandantes</option>
                {GLOBAL_MANDANTES.map(m => (
                  <option key={m.id} value={m.id}>{m.nombre}</option>
                ))}
              </select>
            </div>

          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-cream3">
                  <th className="px-4 py-3.5 text-[10.5px] uppercase font-bold tracking-wider text-gray-500 bg-cream2">Proyecto</th>
                  <th className="px-4 py-3.5 text-[10.5px] uppercase font-bold tracking-wider text-gray-500 bg-cream2">Mandante</th>
                  <th className="px-4 py-3.5 text-[10.5px] uppercase font-bold tracking-wider text-gray-500 bg-cream2">Contratistas</th>
                  <th className="px-4 py-3.5 text-[10.5px] uppercase font-bold tracking-wider text-gray-500 bg-cream2">Trabajadores</th>
                  <th className="px-4 py-3.5 text-[10.5px] uppercase font-bold tracking-wider text-gray-500 bg-cream2">Acreditaciones</th>
                  <th className="px-4 py-3.5 text-[10.5px] uppercase font-bold tracking-wider text-gray-500 bg-cream2">Estado</th>
                  <th className="px-4 py-3.5 text-[10.5px] uppercase font-bold tracking-wider text-gray-500 bg-cream2 text-right"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {visibles.map(pv => {
                  const p = pv.proyecto;
                  return (
                    <tr
                      key={p.id}
                      onClick={() => onVerProyecto(p)}
                      className={`hover:bg-[#fbfaf6] cursor-pointer transition-colors ${p.id === selectedProyectoId ? 'bg-[#fbfaf6]' : ''}`}
                    >
                      <td className="px-4 py-3">
                        <div className="text-[14px] font-semibold text-navy tracking-tight">{p.nombre}</div>
                        <div className="text-[11.5px] text-gray-400 font-medium mt-0.5">{p.estado ? `Proyecto ${p.estado.toLowerCase()}` : ''}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-[13px] text-navy">{pv.mandante ? pv.mandante.nombre : 'Mandante no disponible'}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-[13px] font-semibold text-navy">{pv.contratistasCount}</span>
                        <span className="text-[11.5px] text-gray-400"> empresa{pv.contratistasCount === 1 ? '' : 's'}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-[13px] font-semibold text-navy">{pv.trabajadoresCount}</span>
                        <span className="text-[11.5px] text-gray-400"> trabajador{pv.trabajadoresCount === 1 ? '' : 'es'}</span>
                      </td>
                      <td className="px-4 py-3">
                        {pv.rows.length === 0 ? (
                          <span className="text-[12px] text-gray-400">Sin contratistas</span>
                        ) : (
                          <div className="flex flex-wrap gap-x-2.5 gap-y-0.5 text-[11.5px] font-medium">
                            {pv.acreditadas > 0 && <span className="text-emerald-700">{pv.acreditadas} acreditada{pv.acreditadas === 1 ? '' : 's'}</span>}
                            {pv.enProceso > 0 && <span className="text-amber-700">{pv.enProceso} en proceso</span>}
                            {pv.bloqueadas > 0 && <span className="text-red-700">{pv.bloqueadas} bloqueada{pv.bloqueadas === 1 ? '' : 's'}</span>}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`badge text-[11px] ${BADGE_CLASS[pv.estado === 'Sin contratistas' ? 'gray' : badgeClass(pv.estado === 'Acreditado' ? 'Aprobado' : pv.estado === 'Bloqueado' ? 'Vencido/Bloqueado' : 'En proceso')]}`}>
                          {pv.estado === 'Sin contratistas' ? 'Sin contratistas' : pv.estado.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right" onClick={e => e.stopPropagation()}>
                        <button
                          title="Ver proyecto"
                          onClick={() => onVerProyecto(p)}
                          className="w-8 h-8 rounded-lg bg-gold-soft border border-gold-soft text-gold flex items-center justify-center cursor-pointer hover:bg-gold hover:text-white transition-all shrink-0 ml-auto"
                        >
                          <Eye size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {visibles.length === 0 && (
            <div className="text-center py-12 px-4">
              <p className="text-[13.5px] text-gray-400 font-medium">
                No hay proyectos que coincidan con la búsqueda o los filtros.
              </p>
              {hayFiltros && (
                <button onClick={limpiarFiltros} className="text-brown text-[12.5px] mt-2 hover:underline cursor-pointer font-semibold border-none bg-transparent">
                  Limpiar filtros
                </button>
              )}
            </div>
          )}

          <div className="text-[12px] text-gray-400 px-4 py-3.5 border-t border-cream2 font-medium">
            Mostrando {visibles.length} de {proyectos.length} proyectos
          </div>

        </div>

      </div>
    </div>
  );
}
