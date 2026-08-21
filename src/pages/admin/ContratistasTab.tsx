import { useState } from 'react';
import { Search } from 'lucide-react';
import { Proyecto } from '../../types';
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

export default function ContratistasTab({
  EMPRESAS_CONTRATISTAS,
  setClienteSeleccionado,
  GLOBAL_PROYECTOS = [],
}: {
  EMPRESAS_CONTRATISTAS: any[];
  setClienteSeleccionado: (v: any) => void;
  GLOBAL_PROYECTOS?: Proyecto[];
}) {
  const [busqueda, setBusqueda] = useState('');
  const [proyectoFiltro, setProyectoFiltro] = useState('todos');
  const [sevFiltro, setSevFiltro] = useState<Severidad | null>(null);

  const conSeveridad = EMPRESAS_CONTRATISTAS.map(c => ({
    ...c,
    sev: severidadDeCumplimiento(c.cumplimiento),
  }));

  const conteo: Record<Severidad, number> = {
    critico: conSeveridad.filter(c => c.sev === 'critico').length,
    atencion: conSeveridad.filter(c => c.sev === 'atencion').length,
    normal: conSeveridad.filter(c => c.sev === 'normal').length,
  };

  const termino = busqueda.trim().toLowerCase();
  const visibles = conSeveridad
    .filter(c => {
      const coincideBusqueda =
        !termino ||
        c.empresa?.toLowerCase().includes(termino) ||
        c.rut?.toLowerCase().includes(termino);
      const coincideProyecto =
        proyectoFiltro === 'todos' || (c.proyectos || []).includes(proyectoFiltro);
      const coincideSev = !sevFiltro || c.sev === sevFiltro;
      return coincideBusqueda && coincideProyecto && coincideSev;
    })
    .sort(
      (a, b) =>
        SEVERIDAD_ORDEN[a.sev as Severidad] - SEVERIDAD_ORDEN[b.sev as Severidad] ||
        String(a.empresa).localeCompare(String(b.empresa))
    );

  const hayFiltros = termino !== '' || proyectoFiltro !== 'todos' || sevFiltro !== null;

  const limpiarFiltros = () => {
    setBusqueda('');
    setProyectoFiltro('todos');
    setSevFiltro(null);
  };

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <h2 className="page-title">Contratistas</h2>
          <p className="page-sub">Empresas contratistas y subcontratistas asignadas a proyectos</p>
        </div>
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
              <span
                className="schip-n block"
                style={{
                  color:
                    sev === 'critico' ? '#a32d2d' : sev === 'atencion' ? '#b58600' : '#1e7a3c',
                }}
              >
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
            placeholder="Buscar por empresa o RUT..."
            className="form-input w-full pl-9 py-2 text-[13.5px]"
          />
        </div>
        <select
          value={proyectoFiltro}
          onChange={e => setProyectoFiltro(e.target.value)}
          className="form-input py-2 text-[13.5px] sm:min-w-[200px]"
        >
          <option value="todos">Todos los proyectos</option>
          {GLOBAL_PROYECTOS.map(p => (
            <option key={p.id} value={p.nombre}>{p.nombre}</option>
          ))}
        </select>
      </div>

      <div className="card max-w-full overflow-x-auto p-0">
        <table className="w-full text-left">
          <thead>
            <tr>
              <th className="px-4 py-3 border-b border-cream3 text-[11.5px] uppercase tracking-wide text-gray-500 bg-cream2 font-semibold">Empresa</th>
              <th className="px-4 py-3 border-b border-cream3 text-[11.5px] uppercase tracking-wide text-gray-500 bg-cream2 font-semibold">Rol</th>
              <th className="px-4 py-3 border-b border-cream3 text-[11.5px] uppercase tracking-wide text-gray-500 bg-cream2 font-semibold">Proyectos</th>
              <th className="px-4 py-3 border-b border-cream3 text-[11.5px] uppercase tracking-wide text-gray-500 bg-cream2 font-semibold">Documentación</th>
              <th className="px-4 py-3 border-b border-cream3 text-[11.5px] uppercase tracking-wide text-gray-500 bg-cream2 font-semibold">Estado</th>
              <th className="px-4 py-3 border-b border-cream3 bg-cream2" />
            </tr>
          </thead>
          <tbody>
            {visibles.map((c, i) => {
              const total = c.docsTotal ?? 0;
              const aprobados = c.docsAprobados ?? 0;
              const pct = total > 0 ? Math.round((aprobados / total) * 100) : 0;
              const sev = c.sev as Severidad;

              return (
                <tr
                  key={`${c.rut}-${i}`}
                  onClick={() => setClienteSeleccionado(c)}
                  className="hover:bg-gray-50 border-b border-cream cursor-pointer"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="avatar">{c.iniciales}</div>
                      <div>
                        <div className="text-[13.5px] font-semibold text-navy">{c.empresa}</div>
                        <div className="text-[11.5px] text-gray-400">{c.rut}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-[13.5px] text-gray-600">{c.rol}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1 max-w-[220px]">
                      {(c.proyectos || []).map((p: string, j: number) => (
                        <span
                          key={j}
                          className="text-[11px] bg-cream2 text-gray-600 border border-cream3 rounded-md px-2 py-0.5"
                        >
                          {p}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 min-w-[120px]">
                      <span className="text-[12px] text-gray-500 font-medium whitespace-nowrap">
                        {aprobados}/{total}
                      </span>
                      <div className="prog-wrap max-w-[70px]" title={`${pct}% de documentos aprobados`}>
                        <div
                          className="prog-fill"
                          style={{
                            width: `${pct}%`,
                            backgroundColor:
                              sev === 'critico' ? '#a32d2d' : sev === 'atencion' ? '#b58600' : '#1e7a3c',
                          }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <SeverityBadge severidad={sev} formato="corto" />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={e => { e.stopPropagation(); setClienteSeleccionado(c); }}
                      className="btn btn-ghost btn-sm whitespace-nowrap"
                    >
                      Ver ficha
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {visibles.length === 0 && (
          <div className="text-center py-10 px-4">
            <p className="text-[13.5px] text-gray-400">
              No hay contratistas que coincidan con la búsqueda o los filtros.
            </p>
            {hayFiltros && (
              <button onClick={limpiarFiltros} className="text-brown text-[12.5px] mt-2 hover:underline">
                Limpiar filtros
              </button>
            )}
          </div>
        )}
      </div>

      <p className="text-[12px] text-gray-400 mt-2.5">
        Mostrando {visibles.length} de {EMPRESAS_CONTRATISTAS.length} contratistas
        {sevFiltro && ` · filtrando por ${SEVERIDAD_LABEL[sevFiltro]}`}
      </p>
    </div>
  );
}
