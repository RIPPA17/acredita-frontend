import { useMemo, useState } from 'react';
import { Plus, ChevronRight, Search } from 'lucide-react';
import { Contratista, Proyecto, Mandante } from '../../types';
import { buildAcreditacionRows, AcredRow, EstadoUI, estadoUILabel } from './acreditacionUtils';

// Mandantes habla el mismo idioma de estados que Acreditaciones e Inicio —
// sin una segunda taxonomía de severidad (Crítico/Atención/Al día).
type EstadoConNeutro = EstadoUI | 'Sin proyectos' | 'Sin contratistas';

const RANK: Record<EstadoConNeutro, number> = {
  Bloqueado: 0,
  'En proceso': 1,
  Acreditado: 2,
  'Sin contratistas': 3,
  'Sin proyectos': 3,
};

const CLASE_ESTADO: Record<EstadoConNeutro, string> = {
  Bloqueado: 'sev-critico',
  'En proceso': 'sev-atencion',
  Acreditado: 'sev-ok',
  'Sin contratistas': 'sev-normal',
  'Sin proyectos': 'sev-normal',
};

function EstadoBadge({ estado }: { estado: EstadoConNeutro }) {
  return (
    <span className={`sev ${CLASE_ESTADO[estado]} inline-flex items-center gap-1.5 shrink-0`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current shrink-0" />
      {estado}
    </span>
  );
}

const CHIPS: Array<{ estado: EstadoUI; label: string; punto: string }> = [
  { estado: 'Bloqueado', label: 'Bloqueados', punto: 'bg-[#a32d2d]' },
  { estado: 'En proceso', label: 'En proceso', punto: 'bg-[#b58600]' },
  { estado: 'Acreditado', label: 'Acreditados', punto: 'bg-[#1e7a3c]' },
];

const incluye = (valor: unknown, termino: string) => String(valor ?? '').toLowerCase().includes(termino);

const plural = (n: number, singular: string, prefijo = '') =>
  `${n} ${prefijo}${singular}${n === 1 ? '' : 's'}`;

const iniciales = (nombre: string) =>
  nombre.split(' ').filter(Boolean).map(n => n[0]).join('').substring(0, 2).toUpperCase();

interface ProyectoView {
  proyecto: Proyecto;
  key: string;
  acreditaciones: Array<AcredRow & { estadoUILabel: EstadoUI }>;
  acreditadas: number;
  enProceso: number;
  bloqueadas: number;
  estado: EstadoUI | 'Sin contratistas';
}

interface MandanteView {
  mandante: Mandante;
  key: string;
  proyectos: ProyectoView[];
  contratistasUnicos: number;
  acreditadas: number;
  enProceso: number;
  bloqueadas: number;
  estado: EstadoConNeutro;
}

export default function MandantesTab({
  setShowInvitarModal,
  GLOBAL_CONTRATISTAS,
  GLOBAL_PROYECTOS,
  GLOBAL_MANDANTES,
  onVerFicha,
}: {
  setShowInvitarModal: (v: boolean) => void;
  GLOBAL_CONTRATISTAS: Contratista[];
  GLOBAL_PROYECTOS: Proyecto[];
  GLOBAL_MANDANTES: Mandante[];
  onVerFicha: (contratista: Contratista, proyectoId: string) => void;
}) {
  const [busqueda, setBusqueda] = useState('');
  const [estadoFiltro, setEstadoFiltro] = useState<EstadoUI | null>(null);
  const [abiertos, setAbiertos] = useState<Set<string>>(new Set());

  const termino = busqueda.trim().toLowerCase();

  // Misma fuente de verdad que Acreditaciones e Inicio: una fila por
  // (contratista, proyecto asignado), con su estado real de acreditación.
  const rows = useMemo(
    () => buildAcreditacionRows(GLOBAL_CONTRATISTAS, GLOBAL_PROYECTOS, GLOBAL_MANDANTES),
    [GLOBAL_CONTRATISTAS, GLOBAL_PROYECTOS, GLOBAL_MANDANTES]
  );

  const mandantes: MandanteView[] = useMemo(() => {
    return GLOBAL_MANDANTES.map(m => {
      const proyectos: ProyectoView[] = GLOBAL_PROYECTOS
        .filter(p => p.mandanteId === m.id)
        .map(p => {
          const acreditaciones = rows
            .filter(r => r.proyectoId === p.id)
            .map(r => ({ ...r, estadoUILabel: estadoUILabel(r.estado) }))
            .sort((a, b) => RANK[a.estadoUILabel] - RANK[b.estadoUILabel] || a.entity.localeCompare(b.entity));

          const bloqueadas = acreditaciones.filter(a => a.estadoUILabel === 'Bloqueado').length;
          const enProceso = acreditaciones.filter(a => a.estadoUILabel === 'En proceso').length;
          const acreditadas = acreditaciones.filter(a => a.estadoUILabel === 'Acreditado').length;

          const estado: ProyectoView['estado'] =
            acreditaciones.length === 0 ? 'Sin contratistas'
              : bloqueadas > 0 ? 'Bloqueado'
                : enProceso > 0 ? 'En proceso'
                  : 'Acreditado';

          return { proyecto: p, key: p.id, acreditaciones, acreditadas, enProceso, bloqueadas, estado };
        })
        .sort((a, b) => RANK[a.estado] - RANK[b.estado] || a.proyecto.nombre.localeCompare(b.proyecto.nombre));

      // El mismo contratista puede tener acreditaciones en varios proyectos
      // de este mandante: se cuenta una sola vez como contratista, pero cada
      // acreditación (una por proyecto) sigue sumando por separado.
      const todas = proyectos.flatMap(p => p.acreditaciones);
      const bloqueadas = todas.filter(a => a.estadoUILabel === 'Bloqueado').length;
      const enProceso = todas.filter(a => a.estadoUILabel === 'En proceso').length;
      const acreditadas = todas.filter(a => a.estadoUILabel === 'Acreditado').length;
      const contratistasUnicos = new Set(todas.map(a => a.contratista.id)).size;

      // El mandante hereda "Sin proyectos" solo cuando de verdad no tiene
      // proyectos creados; si tiene proyectos pero ninguno tiene
      // contratistas asignados (0 acreditaciones), es un caso distinto:
      // "Sin contratistas". No confundir ambas ausencias.
      const estado: MandanteView['estado'] =
        proyectos.length === 0 ? 'Sin proyectos'
          : todas.length === 0 ? 'Sin contratistas'
            : bloqueadas > 0 ? 'Bloqueado'
              : enProceso > 0 ? 'En proceso'
                : 'Acreditado';

      return { mandante: m, key: m.id, proyectos, contratistasUnicos, acreditadas, enProceso, bloqueadas, estado };
    });
  }, [GLOBAL_MANDANTES, GLOBAL_PROYECTOS, rows]);

  const conteo: Record<EstadoUI, number> = {
    Bloqueado: mandantes.filter(m => m.estado === 'Bloqueado').length,
    'En proceso': mandantes.filter(m => m.estado === 'En proceso').length,
    Acreditado: mandantes.filter(m => m.estado === 'Acreditado').length,
  };

  /** True when the search term matches a project or company inside the mandante. */
  const coincideInterno = (m: MandanteView) =>
    termino !== '' &&
    m.proyectos.some(
      p =>
        incluye(p.proyecto.nombre, termino) ||
        p.acreditaciones.some(a => incluye(a.entity, termino) || incluye(a.rut, termino))
    );

  const coincideBusqueda = (m: MandanteView) =>
    termino === '' || incluye(m.mandante.nombre, termino) || incluye(m.mandante.rut, termino) || coincideInterno(m);

  const visibles = mandantes
    .filter(m => (!estadoFiltro || m.estado === estadoFiltro) && coincideBusqueda(m))
    .sort((a, b) => RANK[a.estado] - RANK[b.estado] || a.mandante.nombre.localeCompare(b.mandante.nombre));

  // A mandante opens on click, and also on its own when the search matched
  // something inside it — otherwise the result would stay hidden.
  const estaAbierto = (m: MandanteView) => abiertos.has(m.key) || coincideInterno(m);

  const todosAbiertos = visibles.length > 0 && visibles.every(m => abiertos.has(m.key));

  const alternar = (key: string) =>
    setAbiertos(prev => {
      const siguiente = new Set(prev);
      if (siguiente.has(key)) siguiente.delete(key);
      else siguiente.add(key);
      return siguiente;
    });

  const alternarTodos = () =>
    setAbiertos(todosAbiertos ? new Set() : new Set(visibles.map(m => m.key)));

  const hayFiltros = termino !== '' || estadoFiltro !== null;

  const limpiarFiltros = () => {
    setBusqueda('');
    setEstadoFiltro(null);
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
            <h2 className="text-2xl font-semibold text-white mt-1">Mandantes</h2>
            <p className="text-[13.5px] text-gray-300 mt-1.5 max-w-[550px]">
              Mandantes, proyectos y empresas contratistas asignadas, con su estado de acreditación en una sola vista.
            </p>
          </div>

          <div className="flex gap-2.5 shrink-0">
            <button
              onClick={() => setShowInvitarModal(true)}
              className="px-4.5 py-2.5 rounded-xl bg-gradient-to-r from-gold-hover to-gold text-white hover:brightness-105 text-[13.5px] font-semibold flex items-center gap-2 cursor-pointer transition-all shadow-[0_6px_16px_rgba(179,137,63,0.35)] border-none"
            >
              <Plus size={15} />
              Invitar mandante
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area (floated up) */}
      <div className="relative z-20 -mt-8 max-w-[1200px] mx-auto px-1 flex flex-col gap-5">

        {/* Toolbar Panel */}
        <div className="bg-white rounded-2xl border border-cream3 shadow-sm overflow-hidden">
          <div className="p-4 flex flex-wrap items-center justify-between gap-3">
            {/* Segmented Control */}
            <div className="flex bg-[#f1efe6] border border-cream3 rounded-xl p-1 gap-1">
              <button
                onClick={() => setEstadoFiltro(null)}
                className={`px-3.5 py-1.5 rounded-lg text-[12.5px] font-semibold transition-all cursor-pointer border-none flex items-center gap-1 ${
                  estadoFiltro === null
                    ? 'bg-white text-navy shadow-sm'
                    : 'text-gray-500 hover:text-navy hover:bg-white/40'
                }`}
              >
                Todos <span className="opacity-60 text-xs ml-0.5">{mandantes.length}</span>
              </button>
              {CHIPS.map(({ estado, label, punto }) => (
                <button
                  key={estado}
                  onClick={() => setEstadoFiltro(estadoFiltro === estado ? null : estado)}
                  aria-pressed={estadoFiltro === estado}
                  className={`px-3.5 py-1.5 rounded-lg text-[12.5px] font-semibold transition-all cursor-pointer border-none flex items-center gap-1.5 ${
                    estadoFiltro === estado
                      ? 'bg-white text-navy shadow-sm'
                      : 'text-gray-500 hover:text-navy hover:bg-white/40'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${punto}`} />
                  {label} <span className="opacity-60 text-xs">{conteo[estado]}</span>
                </button>
              ))}
            </div>

            {/* Search & Expand toggle */}
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
                  placeholder="Buscar mandante, proyecto o empresa..."
                  className="form-input w-full pl-9 py-2 text-[13px] bg-[#f1efe6] border-cream3 focus:bg-white transition-all rounded-xl"
                />
              </div>
              <button onClick={alternarTodos} className="btn btn-ghost whitespace-nowrap">
                {todosAbiertos ? 'Contraer todo' : 'Expandir todo'}
              </button>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2.5">
        {visibles.map(m => {
          const abierto = estaAbierto(m);

          return (
            <div key={m.key} className="acc-card">
              <button
                onClick={() => alternar(m.key)}
                aria-expanded={abierto}
                className="acc-head"
              >
                <ChevronRight size={16} className={`acc-chev ${abierto ? 'open' : ''}`} />
                <span className="acc-avatar">{iniciales(m.mandante.nombre)}</span>

                <span className="flex-1 min-w-0">
                  <span className="acc-name block truncate">{m.mandante.nombre}</span>
                  <span className="acc-rut block">{m.mandante.rut}</span>
                </span>

                <span className="hidden sm:flex items-center gap-4 shrink-0">
                  <span className="acc-meta text-right">
                    {plural(m.proyectos.length, 'proyecto')} · {plural(m.contratistasUnicos, 'contratista')}
                    <br />
                    <b>{plural(m.acreditadas, 'acreditado')} · {m.enProceso} en proceso · {plural(m.bloqueadas, 'bloqueado')}</b>
                  </span>
                </span>

                <EstadoBadge estado={m.estado} />
              </button>

              {abierto && (
                <div className="acc-body">
                  {m.proyectos.length === 0 && (
                    <p className="text-[13px] text-gray-400 pt-3">
                      Este mandante todavía no tiene proyectos.
                    </p>
                  )}

                  {m.proyectos.map(p => (
                    <div key={p.key} className="mt-3.5">
                      <div className="flex items-center gap-2 mb-1.5 px-0.5 flex-wrap">
                        <span className="acc-pname">{p.proyecto.nombre}</span>
                        <span className="acc-pcount">
                          · {plural(p.acreditaciones.length, 'contratista')}
                        </span>
                        {p.acreditaciones.length > 0 && (
                          <span className="acc-pcount">
                            · {plural(p.acreditadas, 'acreditado')} · {p.enProceso} en proceso · {plural(p.bloqueadas, 'bloqueado')}
                          </span>
                        )}
                        <EstadoBadge estado={p.estado} />
                      </div>

                      {p.acreditaciones.length === 0 && (
                        <p className="text-[12.5px] text-gray-400 px-0.5">
                          Sin empresas asignadas.
                        </p>
                      )}

                      <div className="flex flex-col gap-1.5">
                        {p.acreditaciones.map(a => (
                          <div
                            key={`${p.key}-${a.rut}`}
                            onClick={() => onVerFicha(a.contratista, p.proyecto.id)}
                            className="acc-erow"
                          >
                            <div className="acc-eavatar">{iniciales(a.entity)}</div>
                            <div className="flex-1 min-w-0">
                              <div className="text-[13px] font-semibold text-navy truncate">
                                {a.entity}
                              </div>
                              <div className="text-[11px] text-gray-400">{a.rut}</div>
                            </div>

                            <div className="hidden sm:flex items-center gap-3 shrink-0 text-[11.5px] text-gray-500 font-medium whitespace-nowrap">
                              <span>Empresa {a.company.ok}/{a.company.total}</span>
                              <span>Trabajadores {a.workers.ok}/{a.workers.total}</span>
                            </div>

                            <EstadoBadge estado={a.estadoUILabel} />

                            <button
                              onClick={ev => {
                                ev.stopPropagation();
                                onVerFicha(a.contratista, p.proyecto.id);
                              }}
                              className="btn btn-ghost btn-sm bg-white whitespace-nowrap"
                            >
                              Ver ficha
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {visibles.length === 0 && (
          <div className="card text-center py-10">
            <p className="text-[13.5px] text-gray-400">
              No hay mandantes que coincidan con la búsqueda o los filtros.
            </p>
            {hayFiltros && (
              <button
                onClick={limpiarFiltros}
                className="text-brown text-[12.5px] mt-2 hover:underline"
              >
                Limpiar filtros
              </button>
            )}
          </div>
        )}
      </div>

      <p className="text-[12px] text-gray-400 mt-2.5">
        Mostrando {visibles.length} de {mandantes.length} mandantes
        {estadoFiltro && ` · filtrando por ${estadoFiltro}`}
      </p>
      </div>
    </div>
  );
}
