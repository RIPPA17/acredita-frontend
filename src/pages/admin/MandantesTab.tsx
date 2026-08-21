import { useMemo, useState } from 'react';
import { Plus, ChevronRight, Search } from 'lucide-react';
import SeverityBadge, {
  Severidad,
  SEVERIDAD_LABEL,
  SEVERIDAD_ORDEN,
  severidadDeCumplimiento,
} from '../../components/SeverityBadge';

const CHIPS: Array<{ sev: Severidad; label: string; punto: string }> = [
  { sev: 'critico', label: 'Críticos', punto: 'bg-[#a32d2d]' },
  { sev: 'atencion', label: 'En atención', punto: 'bg-[#b58600]' },
  { sev: 'normal', label: 'Al día', punto: 'bg-[#1e7a3c]' },
];

const COLOR_SEV: Record<Severidad, string> = {
  critico: '#a32d2d',
  atencion: '#b58600',
  normal: '#1e7a3c',
};

/** A project inherits the worst severity of its companies; a mandante, that of its projects. */
const peorSeveridad = (sevs: Severidad[]): Severidad =>
  sevs.includes('critico') ? 'critico' : sevs.includes('atencion') ? 'atencion' : 'normal';

const incluye = (valor: unknown, termino: string) =>
  String(valor ?? '').toLowerCase().includes(termino);

const plural = (n: number, singular: string, prefijo = '') =>
  `${n} ${prefijo}${singular}${n === 1 ? '' : 's'}`;

export default function MandantesTab({
  setShowInvitarModal,
  ARBOL_MANDANTES,
  setClienteSeleccionado,
}: {
  setShowInvitarModal: (v: boolean) => void;
  ARBOL_MANDANTES: any[];
  setClienteSeleccionado: (v: any) => void;
}) {
  const [busqueda, setBusqueda] = useState('');
  const [sevFiltro, setSevFiltro] = useState<Severidad | null>(null);
  const [abiertos, setAbiertos] = useState<Set<string>>(new Set());

  const termino = busqueda.trim().toLowerCase();

  const mandantes = useMemo(
    () =>
      ARBOL_MANDANTES.map((m, i) => {
        const proyectos = (m.proyectos || []).map((p: any, j: number) => {
          const empresas = (p.empresas || [])
            .map((e: any) => ({ ...e, sev: severidadDeCumplimiento(e.cumplimiento) }))
            .sort(
              (a: any, b: any) =>
                SEVERIDAD_ORDEN[a.sev as Severidad] - SEVERIDAD_ORDEN[b.sev as Severidad] ||
                String(a.empresa).localeCompare(String(b.empresa))
            );
          return {
            ...p,
            key: String(p.id ?? `${i}-${j}`),
            empresas,
            sev: peorSeveridad(empresas.map((e: any) => e.sev)),
          };
        });

        // The same contractor can be assigned to several projects of one
        // mandante, so count each company (and its documents) only once.
        const unicas = new Map<string, any>();
        proyectos.forEach((p: any) =>
          p.empresas.forEach((e: any) => {
            if (!unicas.has(e.rut)) unicas.set(e.rut, e);
          })
        );
        const empresas = Array.from(unicas.values());

        return {
          ...m,
          key: String(m.id ?? m.rut ?? i),
          proyectos,
          nEmpresas: empresas.length,
          docsTotal: empresas.reduce((n, e) => n + (e.docsTotal ?? 0), 0),
          docsAprobados: empresas.reduce((n, e) => n + (e.docsAprobados ?? 0), 0),
          sev: peorSeveridad(proyectos.map((p: any) => p.sev)),
        };
      }),
    [ARBOL_MANDANTES]
  );

  const conteo: Record<Severidad, number> = {
    critico: mandantes.filter(m => m.sev === 'critico').length,
    atencion: mandantes.filter(m => m.sev === 'atencion').length,
    normal: mandantes.filter(m => m.sev === 'normal').length,
  };

  /** True when the search term matches a project or company inside the mandante. */
  const coincideInterno = (m: any) =>
    termino !== '' &&
    m.proyectos.some(
      (p: any) =>
        incluye(p.nombre, termino) ||
        p.empresas.some((e: any) => incluye(e.empresa, termino) || incluye(e.rut, termino))
    );

  const coincideBusqueda = (m: any) =>
    termino === '' || incluye(m.empresa, termino) || incluye(m.rut, termino) || coincideInterno(m);

  const visibles = mandantes
    .filter(m => (!sevFiltro || m.sev === sevFiltro) && coincideBusqueda(m))
    .sort(
      (a, b) =>
        SEVERIDAD_ORDEN[a.sev as Severidad] - SEVERIDAD_ORDEN[b.sev as Severidad] ||
        String(a.empresa).localeCompare(String(b.empresa))
    );

  // A mandante opens on click, and also on its own when the search matched
  // something inside it — otherwise the result would stay hidden.
  const estaAbierto = (m: any) => abiertos.has(m.key) || coincideInterno(m);

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

  const hayFiltros = termino !== '' || sevFiltro !== null;

  const limpiarFiltros = () => {
    setBusqueda('');
    setSevFiltro(null);
  };

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <h2 className="page-title">Mandantes</h2>
          <p className="page-sub">
            Mandantes, proyectos y empresas contratistas en una sola vista
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowInvitarModal(true)}>
          <Plus size={16} /> Invitar Mandante
        </button>
      </div>

      {/* Severity summary — each chip toggles its own filter */}
      <div className="flex flex-col sm:flex-row gap-2.5 mb-4">
        {CHIPS.map(({ sev, label, punto }) => (
          <button
            key={sev}
            onClick={() => setSevFiltro(sevFiltro === sev ? null : sev)}
            aria-pressed={sevFiltro === sev}
            className={`schip ${sevFiltro === sev ? 'active' : ''}`}
          >
            <span>
              <span className="schip-l block">{label}</span>
              <span className="schip-n block" style={{ color: COLOR_SEV[sev] }}>
                {conteo[sev]}
              </span>
            </span>
            <span className={`schip-dot ${punto}`} />
          </button>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-2.5 mb-4">
        <div className="relative flex-1 min-w-[220px]">
          <Search
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
          />
          <input
            type="text"
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar mandante, proyecto o empresa..."
            className="form-input w-full pl-9 py-2 text-[13.5px]"
          />
        </div>
        <button onClick={alternarTodos} className="btn btn-ghost whitespace-nowrap">
          {todosAbiertos ? 'Contraer todo' : 'Expandir todo'}
        </button>
      </div>

      <div className="flex flex-col gap-2.5">
        {visibles.map(m => {
          const abierto = estaAbierto(m);
          const pct = m.docsTotal > 0 ? Math.round((m.docsAprobados / m.docsTotal) * 100) : 0;

          return (
            <div key={m.key} className="acc-card">
              <button
                onClick={() => alternar(m.key)}
                aria-expanded={abierto}
                className="acc-head"
              >
                <ChevronRight size={16} className={`acc-chev ${abierto ? 'open' : ''}`} />
                <span className="acc-avatar">{m.iniciales || m.empresa?.substring(0, 2)}</span>

                <span className="flex-1 min-w-0">
                  <span className="acc-name block truncate">{m.empresa}</span>
                  <span className="acc-rut block">{m.rut}</span>
                </span>

                <span className="hidden sm:flex items-center gap-4 shrink-0">
                  <span className="acc-meta text-right">
                    {plural(m.proyectos.length, 'proyecto')} · {plural(m.nEmpresas, 'empresa')}
                    <br />
                    <b>
                      {m.docsAprobados}/{m.docsTotal} documentos aprobados
                    </b>
                  </span>
                  <span className="prog-wrap w-[70px]" title={`${pct}% de documentos aprobados`}>
                    <span
                      className="prog-fill block"
                      style={{ width: `${pct}%`, backgroundColor: COLOR_SEV[m.sev as Severidad] }}
                    />
                  </span>
                </span>

                <SeverityBadge severidad={m.sev as Severidad} formato="corto" />
              </button>

              {abierto && (
                <div className="acc-body">
                  {m.proyectos.length === 0 && (
                    <p className="text-[13px] text-gray-400 pt-3">
                      Este mandante todavía no tiene proyectos.
                    </p>
                  )}

                  {m.proyectos.map((p: any) => (
                    <div key={p.key} className="mt-3.5">
                      <div className="flex items-center gap-2 mb-1.5 px-0.5">
                        <span className="acc-pname">{p.nombre}</span>
                        <span className="acc-pcount">
                          · {plural(p.empresas.length, 'empresa')}
                        </span>
                        <SeverityBadge severidad={p.sev as Severidad} formato="corto" />
                      </div>

                      {p.empresas.length === 0 && (
                        <p className="text-[12.5px] text-gray-400 px-0.5">
                          Sin empresas asignadas.
                        </p>
                      )}

                      <div className="flex flex-col gap-1.5">
                        {p.empresas.map((e: any) => {
                          const total = e.docsTotal ?? 0;
                          const aprobados = e.docsAprobados ?? 0;
                          const epct = total > 0 ? Math.round((aprobados / total) * 100) : 0;

                          return (
                            <div
                              key={`${p.key}-${e.rut}`}
                              onClick={() => setClienteSeleccionado(e)}
                              className="acc-erow"
                            >
                              <div className="acc-eavatar">{e.iniciales}</div>
                              <div className="flex-1 min-w-0">
                                <div className="text-[13px] font-semibold text-navy truncate">
                                  {e.empresa}
                                </div>
                                <div className="text-[11px] text-gray-400">{e.rut}</div>
                              </div>

                              <div className="hidden sm:flex items-center gap-2 shrink-0">
                                <span className="text-[12px] text-gray-500 font-medium whitespace-nowrap">
                                  {aprobados}/{total}
                                </span>
                                <div
                                  className="prog-wrap w-[60px]"
                                  title={`${epct}% de documentos aprobados`}
                                >
                                  <div
                                    className="prog-fill"
                                    style={{
                                      width: `${epct}%`,
                                      backgroundColor: COLOR_SEV[e.sev as Severidad],
                                    }}
                                  />
                                </div>
                              </div>

                              <SeverityBadge severidad={e.sev as Severidad} formato="corto" />

                              <button
                                onClick={ev => {
                                  ev.stopPropagation();
                                  setClienteSeleccionado(e);
                                }}
                                className="btn btn-ghost btn-sm bg-white whitespace-nowrap"
                              >
                                Ver ficha
                              </button>
                            </div>
                          );
                        })}
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
        {sevFiltro && ` · filtrando por ${SEVERIDAD_LABEL[sevFiltro]}`}
      </p>
    </div>
  );
}
