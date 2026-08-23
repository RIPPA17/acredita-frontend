import { useMemo, useState } from 'react';
import { Search, UserPlus, Eye } from 'lucide-react';
import { Contratista, Proyecto, Mandante } from '../../types';
import { parseVencimientoDate } from '../../data/localStorageDb';
import { buildAcreditacionRows, AcredRow, estadoUILabel, badgeClass } from './acreditacionUtils';

type Filtro = 'todos' | 'bloqueados' | 'proceso' | 'acreditados';

const CHIPS: Array<{ filtro: Filtro; label: string; punto: string }> = [
  { filtro: 'bloqueados', label: 'Con bloqueos', punto: 'bg-[#a32d2d]' },
  { filtro: 'proceso', label: 'En proceso', punto: 'bg-[#b58600]' },
  { filtro: 'acreditados', label: 'Acreditados', punto: 'bg-[#1e7a3c]' },
];

const BADGE_CLASS: Record<string, string> = {
  green: 'b-green bg-green-100 text-green-800',
  amber: 'bg-yellow-100 text-yellow-800',
  red: 'b-red bg-red-100 text-red-800',
  gray: 'b-gray bg-gray-100 text-gray-500',
};

function getAvatarBgColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const colors = [
    'bg-indigo-600',
    'bg-cyan-700',
    'bg-teal-700',
    'bg-blue-600',
    'bg-violet-700',
    'bg-pink-700',
    'bg-orange-700',
    'bg-emerald-700',
  ];
  const idx = Math.abs(hash) % colors.length;
  return colors[idx];
}

const iniciales = (nombre: string) =>
  nombre.split(' ').filter(Boolean).map(n => n[0]).join('').substring(0, 2).toUpperCase();

// Última actividad de la empresa: el documento propio (no de trabajadores)
// con la fecha de carga más reciente, reutilizando el mismo parser de
// fechas que el resto del frontend en vez de uno propio. Sin fecha real
// no se inventa una — se muestra "—".
function ultimaActividad(contratista: Contratista): string {
  const fechas = (contratista.documentos || [])
    .map(d => ({ raw: d.subido, parsed: d.subido ? parseVencimientoDate(d.subido) : null }))
    .filter((x): x is { raw: string; parsed: Date } => x.parsed !== null);
  if (fechas.length === 0) return '—';
  fechas.sort((a, b) => b.parsed.getTime() - a.parsed.getTime());
  return fechas[0].raw || '—';
}

interface ContratistaView {
  contratista: Contratista;
  rows: AcredRow[];
  acreditadas: number;
  enProceso: number;
  bloqueadas: number;
  rank: number;
}

export default function ContratistasTab({
  GLOBAL_CONTRATISTAS,
  GLOBAL_PROYECTOS,
  GLOBAL_MANDANTES,
  onVerContratista,
  setShowInvitarContratistaModal,
}: {
  GLOBAL_CONTRATISTAS: Contratista[];
  GLOBAL_PROYECTOS: Proyecto[];
  GLOBAL_MANDANTES: Mandante[];
  onVerContratista: (contratista: Contratista) => void;
  setShowInvitarContratistaModal: (v: boolean) => void;
}) {
  const [busqueda, setBusqueda] = useState('');
  const [proyectoFiltro, setProyectoFiltro] = useState('');
  const [filtro, setFiltro] = useState<Filtro>('todos');

  // Misma fuente de verdad que Acreditaciones y Mandantes: una fila por
  // (contratista, proyecto asignado), con su estado real de acreditación.
  const acreditacionRows = useMemo(
    () => buildAcreditacionRows(GLOBAL_CONTRATISTAS, GLOBAL_PROYECTOS, GLOBAL_MANDANTES),
    [GLOBAL_CONTRATISTAS, GLOBAL_PROYECTOS, GLOBAL_MANDANTES]
  );

  const contratistas: ContratistaView[] = useMemo(() => {
    return GLOBAL_CONTRATISTAS.map(c => {
      const rows = acreditacionRows.filter(r => r.contratista.id === c.id);
      const bloqueadas = rows.filter(r => r.estado === 'Vencido/Bloqueado').length;
      const enProceso = rows.filter(r => r.estado === 'En proceso').length;
      const acreditadas = rows.filter(r => r.estado === 'Aprobado').length;
      const rank = bloqueadas > 0 ? 0 : enProceso > 0 ? 1 : acreditadas > 0 ? 2 : 3;
      return { contratista: c, rows, acreditadas, enProceso, bloqueadas, rank };
    });
  }, [GLOBAL_CONTRATISTAS, acreditacionRows]);

  const conteo: Record<Filtro, number> = {
    todos: contratistas.length,
    bloqueados: contratistas.filter(c => c.bloqueadas > 0).length,
    proceso: contratistas.filter(c => c.bloqueadas === 0 && c.enProceso > 0).length,
    acreditados: contratistas.filter(c => c.rows.length > 0 && c.bloqueadas === 0 && c.enProceso === 0).length,
  };

  const termino = busqueda.trim().toLowerCase();

  const visibles = contratistas
    .filter(c => {
      const coincideBusqueda =
        !termino ||
        c.contratista.nombre.toLowerCase().includes(termino) ||
        c.contratista.rut.toLowerCase().includes(termino);
      const coincideProyecto = !proyectoFiltro || c.contratista.proyectos.includes(proyectoFiltro);
      const coincideFiltro =
        filtro === 'todos' ? true
          : filtro === 'bloqueados' ? c.bloqueadas > 0
            : filtro === 'proceso' ? (c.bloqueadas === 0 && c.enProceso > 0)
              : (c.rows.length > 0 && c.bloqueadas === 0 && c.enProceso === 0);
      return coincideBusqueda && coincideProyecto && coincideFiltro;
    })
    .sort((a, b) => a.rank - b.rank || a.contratista.nombre.localeCompare(b.contratista.nombre));

  const hayFiltros = termino !== '' || proyectoFiltro !== '' || filtro !== 'todos';

  const limpiarFiltros = () => {
    setBusqueda('');
    setProyectoFiltro('');
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
            <h2 className="text-2xl font-semibold text-white mt-1">Contratistas</h2>
            <p className="text-[13.5px] text-gray-300 mt-1.5 max-w-[550px]">
              Empresas contratistas asignadas a proyectos, con el estado de sus acreditaciones.
            </p>
          </div>

          <div className="flex gap-2.5 shrink-0">
            <button
              onClick={() => setShowInvitarContratistaModal(true)}
              className="px-4.5 py-2.5 rounded-xl bg-gradient-to-r from-gold-hover to-gold text-white hover:brightness-105 text-[13.5px] font-semibold flex items-center gap-2 cursor-pointer transition-all shadow-[0_6px_16px_rgba(179,137,63,0.35)] border-none"
            >
              <UserPlus size={15} />
              Invitar contratista
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

            {/* Search & Project Filter */}
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
                  placeholder="Buscar por empresa o RUT..."
                  className="form-input w-full pl-9 py-2 text-[13px] bg-[#f1efe6] border-cream3 focus:bg-white transition-all rounded-xl"
                />
              </div>

              <select
                value={proyectoFiltro}
                onChange={e => setProyectoFiltro(e.target.value)}
                className="form-input py-2 text-[13px] min-w-[180px] bg-[#f1efe6] border-cream3 rounded-xl cursor-pointer"
              >
                <option value="">Todos los proyectos</option>
                {GLOBAL_PROYECTOS.map(p => (
                  <option key={p.id} value={p.id}>{p.nombre}</option>
                ))}
              </select>
            </div>

          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-cream3">
                  <th className="px-4 py-3.5 text-[10.5px] uppercase font-bold tracking-wider text-gray-500 bg-cream2">Empresa</th>
                  {proyectoFiltro ? (
                    <>
                      <th className="px-4 py-3.5 text-[10.5px] uppercase font-bold tracking-wider text-gray-500 bg-cream2">Requisitos empresa</th>
                      <th className="px-4 py-3.5 text-[10.5px] uppercase font-bold tracking-wider text-gray-500 bg-cream2">Trabajadores</th>
                      <th className="px-4 py-3.5 text-[10.5px] uppercase font-bold tracking-wider text-gray-500 bg-cream2">Estado</th>
                    </>
                  ) : (
                    <>
                      <th className="px-4 py-3.5 text-[10.5px] uppercase font-bold tracking-wider text-gray-500 bg-cream2">Proyectos</th>
                      <th className="px-4 py-3.5 text-[10.5px] uppercase font-bold tracking-wider text-gray-500 bg-cream2">Trabajadores</th>
                      <th className="px-4 py-3.5 text-[10.5px] uppercase font-bold tracking-wider text-gray-500 bg-cream2">Acreditaciones</th>
                    </>
                  )}
                  <th className="px-4 py-3.5 text-[10.5px] uppercase font-bold tracking-wider text-gray-500 bg-cream2">Última actividad</th>
                  <th className="px-4 py-3.5 text-[10.5px] uppercase font-bold tracking-wider text-gray-500 bg-cream2 text-right"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {visibles.map(cv => {
                  const c = cv.contratista;
                  const avatarBg = getAvatarBgColor(c.nombre);
                  const trabajadoresCount = (c.trabajadores || []).length;
                  const rowFiltrada = proyectoFiltro ? cv.rows.find(r => r.proyectoId === proyectoFiltro) : undefined;

                  return (
                    <tr
                      key={c.id}
                      onClick={() => onVerContratista(c)}
                      className="hover:bg-[#fbfaf6] cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-xl ${avatarBg} text-white flex items-center justify-center font-bold text-[13px] tracking-wide shrink-0 shadow-sm`}>
                            {iniciales(c.nombre)}
                          </div>
                          <div>
                            <div className="text-[14px] font-semibold text-navy tracking-tight">{c.nombre}</div>
                            <div className="text-[11.5px] text-gray-400 font-medium mt-0.5">{c.rut}</div>
                          </div>
                        </div>
                      </td>

                      {proyectoFiltro ? (
                        rowFiltrada ? (
                          <>
                            <td className="px-4 py-3">
                              <div className="text-[13px] font-bold text-navy">{rowFiltrada.company.ok}/{rowFiltrada.company.total}</div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="text-[13px] font-bold text-navy">{rowFiltrada.workers.ok}/{rowFiltrada.workers.total}</div>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`badge text-[11px] ${BADGE_CLASS[badgeClass(rowFiltrada.estado)]}`}>
                                {estadoUILabel(rowFiltrada.estado)}
                              </span>
                            </td>
                          </>
                        ) : (
                          <td className="px-4 py-3 text-[12px] text-gray-400" colSpan={3}>No asignado a este proyecto</td>
                        )
                      ) : (
                        <>
                          <td className="px-4 py-3">
                            <span className="text-[13px] font-semibold text-navy">{c.proyectos.length}</span>
                            <span className="text-[11.5px] text-gray-400"> proyecto{c.proyectos.length === 1 ? '' : 's'}</span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-[13px] font-semibold text-navy">{trabajadoresCount}</span>
                            <span className="text-[11.5px] text-gray-400"> trabajador{trabajadoresCount === 1 ? '' : 'es'}</span>
                          </td>
                          <td className="px-4 py-3">
                            {cv.rows.length === 0 ? (
                              <span className="text-[12px] text-gray-400">Sin proyectos</span>
                            ) : (
                              <div className="flex flex-wrap gap-x-2.5 gap-y-0.5 text-[11.5px] font-medium">
                                {cv.acreditadas > 0 && <span className="text-emerald-700">{cv.acreditadas} acreditada{cv.acreditadas === 1 ? '' : 's'}</span>}
                                {cv.enProceso > 0 && <span className="text-amber-700">{cv.enProceso} en proceso</span>}
                                {cv.bloqueadas > 0 && <span className="text-red-700">{cv.bloqueadas} bloqueada{cv.bloqueadas === 1 ? '' : 's'}</span>}
                              </div>
                            )}
                          </td>
                        </>
                      )}

                      <td className="px-4 py-3">
                        <span className="text-[12px] text-gray-500 font-medium">{ultimaActividad(c)}</span>
                      </td>

                      <td className="px-4 py-3 text-right" onClick={e => e.stopPropagation()}>
                        <button
                          title="Ver ficha"
                          onClick={() => onVerContratista(c)}
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
                No hay contratistas que coincidan con la búsqueda o los filtros.
              </p>
              {hayFiltros && (
                <button onClick={limpiarFiltros} className="text-brown text-[12.5px] mt-2 hover:underline cursor-pointer font-semibold border-none bg-transparent">
                  Limpiar filtros
                </button>
              )}
            </div>
          )}

          <div className="text-[12px] text-gray-400 px-4 py-3.5 border-t border-cream2 font-medium">
            Mostrando {visibles.length} de {contratistas.length} contratistas
          </div>

        </div>

      </div>
    </div>
  );
}
