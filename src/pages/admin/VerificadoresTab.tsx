import { useMemo, useState } from 'react';
import { Eye, Search, ShieldCheck } from 'lucide-react';
import type { ClaimRevision, Contratista, Proyecto, Verificador } from '../../types';
import { getActividadHoyPorVerificador } from '../../data/localStorageDb';
import { resolveCargaPorVerificador } from './verificadorUtils';

type Filtro = 'todos' | 'activos' | 'supervisores';

const iniciales = (nombre: string) =>
  nombre.split(' ').filter(Boolean).map(item => item[0]).join('').slice(0, 2).toUpperCase();

export default function VerificadoresTab({
  verificadores,
  claimsRevision,
  GLOBAL_CONTRATISTAS,
  GLOBAL_PROYECTOS,
  onVerVerificador,
}: {
  verificadores: Verificador[];
  setVerificadores: (value: Verificador[]) => void;
  claimsRevision: ClaimRevision[];
  GLOBAL_CONTRATISTAS: Contratista[];
  GLOBAL_PROYECTOS: Proyecto[];
  onVerVerificador: (value: Verificador) => void;
}) {
  const [busqueda, setBusqueda] = useState('');
  const [filtro, setFiltro] = useState<Filtro>('todos');

  const carga = useMemo(
    () => resolveCargaPorVerificador(claimsRevision, GLOBAL_CONTRATISTAS, GLOBAL_PROYECTOS),
    [claimsRevision, GLOBAL_CONTRATISTAS, GLOBAL_PROYECTOS],
  );

  const rows = verificadores.map(verificador => {
    const actividad = getActividadHoyPorVerificador(verificador.id);
    return {
      verificador,
      enRevision: (carga.get(verificador.id) || []).length,
      aprobados: actividad.aprobados,
      rechazados: actividad.rechazados,
    };
  });

  const query = busqueda.trim().toLowerCase();
  const visibles = rows.filter(row => {
    const matchesQuery = !query || row.verificador.nombre.toLowerCase().includes(query) || row.verificador.email.toLowerCase().includes(query);
    const matchesFilter = filtro === 'todos'
      || (filtro === 'activos' && row.verificador.activo)
      || (filtro === 'supervisores' && row.verificador.rol === 'supervisor');
    return matchesQuery && matchesFilter;
  });

  return (
    <div className="fade-in">
      <div className="relative overflow-hidden bg-gradient-to-br from-navy to-navy-2 px-8 py-4 pb-12 -mx-8 -mt-6">
        <div className="max-w-[1200px] mx-auto flex justify-between items-center gap-4">
          <div>
            <span className="text-[11px] tracking-[2px] uppercase font-semibold text-gold-hover">Panel de administración</span>
            <h2 className="text-2xl font-semibold text-white mt-1">Verificadores</h2>
            <p className="text-[13.5px] text-gray-300 mt-1.5 max-w-[620px]">Equipo Acredita con acceso real. La carga y la actividad se comparten desde Supabase.</p>
          </div>
          <div className="hidden sm:flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[11px] text-white/80">
            <ShieldCheck size={15} /> Alta de cuentas administrada por Acredita
          </div>
        </div>
      </div>

      <div className="relative z-20 -mt-8 max-w-[1200px] mx-auto px-1">
        <div className="bg-white rounded-2xl border border-cream3 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-cream3 flex flex-wrap gap-3 items-center justify-between">
            <div className="flex bg-[#f1efe6] border border-cream3 rounded-xl p-1 gap-1">
              {([
                ['todos', 'Todos'],
                ['activos', 'Activos'],
                ['supervisores', 'Supervisores'],
              ] as Array<[Filtro, string]>).map(([value, label]) => (
                <button
                  type="button"
                  key={value}
                  onClick={() => setFiltro(value)}
                  className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold ${filtro === value ? 'bg-white text-navy shadow-sm' : 'text-gray-500'}`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="relative min-w-[220px] max-w-[320px] flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={busqueda} onChange={event => setBusqueda(event.target.value)} placeholder="Buscar persona..." className="form-input w-full pl-9 text-[12px]" />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-cream2 border-b border-cream3">
                  <th className="px-4 py-3 text-[10px] uppercase tracking-wide text-gray-500">Persona</th>
                  <th className="px-4 py-3 text-[10px] uppercase tracking-wide text-gray-500">Rol</th>
                  <th className="px-4 py-3 text-[10px] uppercase tracking-wide text-gray-500">Cuenta</th>
                  <th className="px-4 py-3 text-[10px] uppercase tracking-wide text-gray-500">En revisión</th>
                  <th className="px-4 py-3 text-[10px] uppercase tracking-wide text-gray-500">Revisados hoy</th>
                  <th className="px-4 py-3 text-right"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {visibles.map(row => {
                  const total = row.aprobados + row.rechazados;
                  return (
                    <tr key={row.verificador.id} className="hover:bg-[#fbfaf6]">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-navy text-white flex items-center justify-center text-[11px] font-bold">{iniciales(row.verificador.nombre)}</div>
                          <div>
                            <div className="text-[13.5px] font-semibold text-navy">{row.verificador.nombre}</div>
                            <div className="text-[11px] text-gray-400">{row.verificador.email || 'Cuenta interna Acredita'}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3"><span className="badge bg-blue-50 text-blue-700">{row.verificador.rol === 'supervisor' ? 'Supervisor' : 'Verificador'}</span></td>
                      <td className="px-4 py-3"><span className={`badge ${row.verificador.activo ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'}`}>{row.verificador.activo ? 'Activa' : 'Inactiva'}</span></td>
                      <td className="px-4 py-3 text-[13px] font-bold text-navy">{row.enRevision}</td>
                      <td className="px-4 py-3">
                        <div className="text-[13px] font-bold text-navy">{total}</div>
                        {total > 0 && <div className="text-[10.5px] text-gray-400">{row.aprobados} aprobados · {row.rechazados} rechazados</div>}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button type="button" onClick={() => onVerVerificador(row.verificador)} className="w-8 h-8 rounded-lg border border-cream3 bg-white text-brown inline-flex items-center justify-center hover:bg-cream2" title="Ver detalle"><Eye size={14} /></button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {visibles.length === 0 && <div className="p-10 text-center text-[13px] text-gray-400">No hay personas que coincidan con este filtro.</div>}
          <div className="px-4 py-3 border-t border-cream2 text-[11.5px] text-gray-400">Las cuentas se crean y asignan a roles Acredita desde el backend; esta pantalla ya no crea usuarios locales ficticios.</div>
        </div>
      </div>
    </div>
  );
}
