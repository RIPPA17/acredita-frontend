import React, { useMemo, useState } from 'react';
import { Search, UserPlus, Eye, X } from 'lucide-react';
import { Contratista, Proyecto, Verificador, ClaimRevision } from '../../types';
import { saveVerificadores, getVerificadores, getActividadHoyPorVerificador } from '../../data/localStorageDb';
import { resolveCargaPorVerificador } from './verificadorUtils';

type Filtro = 'todos' | 'online' | 'offline' | 'supervisores';

const BADGE_CLASS: Record<string, string> = {
  green: 'b-green bg-green-100 text-green-800',
  amber: 'bg-yellow-100 text-yellow-800',
  gray: 'b-gray bg-gray-100 text-gray-500',
  blue: 'bg-blue-100 text-blue-800',
};

const ROL_LABEL: Record<Verificador['rol'], string> = {
  verificador: 'Verificador',
  supervisor: 'Supervisor',
};

const iniciales = (nombre: string) =>
  nombre.split(' ').filter(Boolean).map(n => n[0]).join('').substring(0, 2).toUpperCase();

interface VerificadorView {
  verificador: Verificador;
  enRevision: number;
  aprobados: number;
  rechazados: number;
  revisadosHoy: number;
  rank: number;
}

export default function VerificadoresTab({
  verificadores,
  setVerificadores,
  claimsRevision,
  GLOBAL_CONTRATISTAS,
  GLOBAL_PROYECTOS,
  onVerVerificador,
}: {
  verificadores: Verificador[];
  setVerificadores: (v: Verificador[]) => void;
  claimsRevision: ClaimRevision[];
  GLOBAL_CONTRATISTAS: Contratista[];
  GLOBAL_PROYECTOS: Proyecto[];
  onVerVerificador: (verificador: Verificador) => void;
}) {
  const [busqueda, setBusqueda] = useState('');
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [showNuevoModal, setShowNuevoModal] = useState(false);
  const [form, setForm] = useState({ nombre: '', email: '', rol: 'verificador' as Verificador['rol'], estado: 'offline' as Verificador['estado'] });
  const [errorEmail, setErrorEmail] = useState('');

  const cargaPorVerificador = useMemo(
    () => resolveCargaPorVerificador(claimsRevision, GLOBAL_CONTRATISTAS, GLOBAL_PROYECTOS),
    [claimsRevision, GLOBAL_CONTRATISTAS, GLOBAL_PROYECTOS]
  );

  const vistas: VerificadorView[] = useMemo(() => {
    return verificadores.map(v => {
      const enRevision = (cargaPorVerificador.get(v.id) || []).length;
      const { aprobados, rechazados } = getActividadHoyPorVerificador(v.id);
      const rank = (v.estado === 'online' ? 0 : 10) + (v.rol === 'supervisor' ? 0 : 1);
      return { verificador: v, enRevision, aprobados, rechazados, revisadosHoy: aprobados + rechazados, rank };
    });
  }, [verificadores, cargaPorVerificador]);

  const conteo: Record<Filtro, number> = {
    todos: vistas.length,
    online: vistas.filter(v => v.verificador.estado === 'online').length,
    offline: vistas.filter(v => v.verificador.estado === 'offline').length,
    supervisores: vistas.filter(v => v.verificador.rol === 'supervisor').length,
  };

  const termino = busqueda.trim().toLowerCase();

  const visibles = vistas
    .filter(v => {
      const coincideBusqueda =
        !termino ||
        v.verificador.nombre.toLowerCase().includes(termino) ||
        v.verificador.email.toLowerCase().includes(termino);
      const coincideFiltro =
        filtro === 'todos' ? true
          : filtro === 'online' ? v.verificador.estado === 'online'
            : filtro === 'offline' ? v.verificador.estado === 'offline'
              : v.verificador.rol === 'supervisor';
      return coincideBusqueda && coincideFiltro;
    })
    .sort((a, b) => a.rank - b.rank || a.verificador.nombre.localeCompare(b.verificador.nombre));

  const hayFiltros = termino !== '' || filtro !== 'todos';

  const limpiarFiltros = () => {
    setBusqueda('');
    setFiltro('todos');
  };

  const resetForm = () => {
    setShowNuevoModal(false);
    setForm({ nombre: '', email: '', rol: 'verificador', estado: 'offline' });
    setErrorEmail('');
  };

  const crearVerificador = (e: React.FormEvent) => {
    e.preventDefault();
    const email = form.email.trim().toLowerCase();
    if (!form.nombre.trim() || !email) return;

    const lista = getVerificadores();
    if (lista.some(v => v.email.toLowerCase() === email)) {
      setErrorEmail('Ya existe un verificador con este correo.');
      return;
    }

    const nuevo: Verificador = {
      id: `ver_${Date.now()}`,
      nombre: form.nombre.trim(),
      email,
      rol: form.rol,
      estado: form.estado,
      activo: true,
    };
    const nuevaLista = [...lista, nuevo];
    saveVerificadores(nuevaLista);
    setVerificadores(nuevaLista);
    resetForm();
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
            <h2 className="text-2xl font-semibold text-white mt-1">Verificadores</h2>
            <p className="text-[13.5px] text-gray-300 mt-1.5 max-w-[550px]">
              Gestiona el equipo que revisa documentos y supervisa la operación diaria.
            </p>
          </div>

          <div className="flex gap-2.5 shrink-0">
            <button
              onClick={() => setShowNuevoModal(true)}
              className="px-4.5 py-2.5 rounded-xl bg-gradient-to-r from-gold-hover to-gold text-white hover:brightness-105 text-[13.5px] font-semibold flex items-center gap-2 cursor-pointer transition-all shadow-[0_6px_16px_rgba(179,137,63,0.35)] border-none"
            >
              <UserPlus size={15} />
              Nuevo verificador
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
              {([
                ['todos', 'Todos', ''],
                ['online', 'Online', 'bg-[#1e7a3c]'],
                ['offline', 'Offline', 'bg-gray-400'],
                ['supervisores', 'Supervisores', ''],
              ] as Array<[Filtro, string, string]>).map(([f, label, punto]) => (
                <button
                  key={f}
                  onClick={() => setFiltro(filtro === f && f !== 'todos' ? 'todos' : f)}
                  aria-pressed={filtro === f}
                  className={`px-3.5 py-1.5 rounded-lg text-[12.5px] font-semibold transition-all cursor-pointer border-none flex items-center gap-1.5 ${
                    filtro === f
                      ? 'bg-white text-navy shadow-sm'
                      : 'text-gray-500 hover:text-navy hover:bg-white/40'
                  }`}
                >
                  {punto && <span className={`w-1.5 h-1.5 rounded-full ${punto}`} />}
                  {label} <span className="opacity-60 text-xs">{conteo[f]}</span>
                </button>
              ))}
            </div>

            {/* Search */}
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
                  placeholder="Buscar verificador..."
                  className="form-input w-full pl-9 py-2 text-[13px] bg-[#f1efe6] border-cream3 focus:bg-white transition-all rounded-xl"
                />
              </div>
            </div>

          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-cream3">
                  <th className="px-4 py-3.5 text-[10.5px] uppercase font-bold tracking-wider text-gray-500 bg-cream2">Verificador</th>
                  <th className="px-4 py-3.5 text-[10.5px] uppercase font-bold tracking-wider text-gray-500 bg-cream2">Rol</th>
                  <th className="px-4 py-3.5 text-[10.5px] uppercase font-bold tracking-wider text-gray-500 bg-cream2">Estado</th>
                  <th className="px-4 py-3.5 text-[10.5px] uppercase font-bold tracking-wider text-gray-500 bg-cream2">En revisión</th>
                  <th className="px-4 py-3.5 text-[10.5px] uppercase font-bold tracking-wider text-gray-500 bg-cream2">Revisados hoy</th>
                  <th className="px-4 py-3.5 text-[10.5px] uppercase font-bold tracking-wider text-gray-500 bg-cream2">Resultado</th>
                  <th className="px-4 py-3.5 text-[10.5px] uppercase font-bold tracking-wider text-gray-500 bg-cream2 text-right"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {visibles.map(vv => {
                  const v = vv.verificador;
                  return (
                    <tr
                      key={v.id}
                      onClick={() => onVerVerificador(v)}
                      className="hover:bg-[#fbfaf6] cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-navy text-white flex items-center justify-center font-bold text-[12px] tracking-wide shrink-0 shadow-sm">
                            {iniciales(v.nombre)}
                          </div>
                          <div>
                            <div className="text-[14px] font-semibold text-navy tracking-tight">{v.nombre}</div>
                            <div className="text-[11.5px] text-gray-400 font-medium mt-0.5">{v.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`badge text-[11px] ${BADGE_CLASS[v.rol === 'supervisor' ? 'amber' : 'blue']}`}>
                          {ROL_LABEL[v.rol]}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`badge text-[11px] ${BADGE_CLASS[v.estado === 'online' ? 'green' : 'gray']}`}>
                          {v.estado === 'online' ? 'Online' : 'Offline'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-[13px] font-bold text-navy">{vv.enRevision}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-[13px] font-bold text-navy">{vv.revisadosHoy}</span>
                      </td>
                      <td className="px-4 py-3">
                        {vv.revisadosHoy === 0 ? (
                          <span className="text-[12px] text-gray-400">Sin actividad hoy</span>
                        ) : (
                          <span className="text-[12px] text-gray-600 font-medium">
                            {vv.aprobados} aprobado{vv.aprobados === 1 ? '' : 's'} · {vv.rechazados} rechazado{vv.rechazados === 1 ? '' : 's'}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right" onClick={e => e.stopPropagation()}>
                        <button
                          title="Ver verificador"
                          onClick={() => onVerVerificador(v)}
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

          {vistas.length === 0 && (
            <div className="text-center py-12 px-4">
              <p className="text-[13.5px] text-gray-400 font-medium mb-3">
                Todavía no hay verificadores registrados.
              </p>
              <button
                onClick={() => setShowNuevoModal(true)}
                className="btn btn-primary"
              >
                + Nuevo verificador
              </button>
            </div>
          )}

          {vistas.length > 0 && visibles.length === 0 && (
            <div className="text-center py-12 px-4">
              <p className="text-[13.5px] text-gray-400 font-medium">
                No hay verificadores que coincidan con la búsqueda o los filtros.
              </p>
              {hayFiltros && (
                <button onClick={limpiarFiltros} className="text-brown text-[12.5px] mt-2 hover:underline cursor-pointer font-semibold border-none bg-transparent">
                  Limpiar filtros
                </button>
              )}
            </div>
          )}

          {vistas.length > 0 && (
            <div className="text-[12px] text-gray-400 px-4 py-3.5 border-t border-cream2 font-medium">
              Mostrando {visibles.length} de {vistas.length} verificadores
            </div>
          )}

        </div>

      </div>

      {/* Modal Nuevo Verificador */}
      {showNuevoModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-[440px] max-h-[calc(100vh-24px)] overflow-y-auto">
            <div className="flex justify-between items-center p-4 border-b border-cream">
              <h3 className="font-medium text-navy text-[17.6px]">Nuevo verificador</h3>
              <button onClick={resetForm} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            <div className="p-6">
              <form onSubmit={crearVerificador} className="flex flex-col gap-4">
                <div>
                  <label className="block text-[13.2px] font-medium text-gray-700 mb-1.5">Nombre</label>
                  <input
                    type="text"
                    value={form.nombre}
                    onChange={e => setForm({ ...form, nombre: e.target.value })}
                    className="form-input w-full p-2.5 border border-cream3 rounded-lg focus:border-brown focus:ring-1 focus:ring-brown outline-none transition-all"
                    placeholder="Nombre completo"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[13.2px] font-medium text-gray-700 mb-1.5">Correo</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={e => { setForm({ ...form, email: e.target.value }); setErrorEmail(''); }}
                    className="form-input w-full p-2.5 border border-cream3 rounded-lg focus:border-brown focus:ring-1 focus:ring-brown outline-none transition-all"
                    placeholder="nombre@acredita.cl"
                    required
                  />
                  {errorEmail && <p className="text-[12px] text-red-600 mt-1.5">{errorEmail}</p>}
                </div>
                <div>
                  <label className="block text-[13.2px] font-medium text-gray-700 mb-1.5">Rol</label>
                  <select
                    value={form.rol}
                    onChange={e => setForm({ ...form, rol: e.target.value as Verificador['rol'] })}
                    className="form-input w-full p-2.5 border border-cream3 rounded-lg focus:border-brown focus:ring-1 focus:ring-brown outline-none transition-all"
                  >
                    <option value="verificador">Verificador</option>
                    <option value="supervisor">Supervisor</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[13.2px] font-medium text-gray-700 mb-1.5">Estado inicial</label>
                  <select
                    value={form.estado}
                    onChange={e => setForm({ ...form, estado: e.target.value as Verificador['estado'] })}
                    className="form-input w-full p-2.5 border border-cream3 rounded-lg focus:border-brown focus:ring-1 focus:ring-brown outline-none transition-all"
                  >
                    <option value="offline">Offline</option>
                    <option value="online">Online</option>
                  </select>
                </div>

                <div className="bg-gold-soft/40 border border-[#ecdcc4] rounded-lg px-3 py-2.5 text-[12px] text-[#7b5b32]">
                  MVP: crea solo el registro local del equipo; no una cuenta real de autenticación. La cuenta de acceso real se configurará posteriormente.
                </div>

                <div className="flex justify-end gap-3 mt-2 pt-4 border-t border-cream">
                  <button type="button" onClick={resetForm} className="btn btn-ghost font-medium">
                    Cancelar
                  </button>
                  <button type="submit" className="btn btn-primary">
                    Crear verificador
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
