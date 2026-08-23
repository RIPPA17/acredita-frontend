import React, { useState } from 'react';
import { Plus, Search, X } from 'lucide-react';
import { savePlantillas } from '../../../data/localStorageDb';
import { PlantillaBase } from '../../../types';

type Filtro = 'todas' | 'activas' | 'inactivas';

const DESTINO_LABEL: Record<PlantillaBase['destino'], string> = {
  empresa: 'Empresa',
  trabajador: 'Trabajador',
};

const CATEGORIA_COLOR: Record<string, string> = {
  Laboral: 'border-blue-200 bg-blue-50 text-blue-700',
  Tributario: 'border-purple-200 bg-purple-50 text-purple-700',
  Prevención: 'border-emerald-200 bg-emerald-50 text-emerald-700',
};

// Las plantillas persistidas pueden venir de antes de esta pantalla (sin
// `activo`/con `destino` en otro formato) — se normalizan solo para mostrar,
// sin reescribir el registro hasta que el usuario lo edite explícitamente.
function normaliza(raw: any): PlantillaBase {
  return {
    id: raw.id,
    nombre: raw.nombre,
    categoria: raw.categoria,
    destino: raw.destino === 'trabajador' ? 'trabajador' : 'empresa',
    activo: raw.activo ?? true,
  };
}

const FORM_VACIO = { nombre: '', categoria: 'Laboral' as PlantillaBase['categoria'], destino: 'empresa' as PlantillaBase['destino'], activo: true };

export default function PlantillasConfig({
  plantillas,
  setPlantillas,
  showToast,
}: {
  plantillas: any[];
  setPlantillas: (list: any[]) => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'warning') => void;
}) {
  const [busqueda, setBusqueda] = useState('');
  const [filtro, setFiltro] = useState<Filtro>('todas');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<PlantillaBase | null>(null);
  const [form, setForm] = useState(FORM_VACIO);
  const [errorNombre, setErrorNombre] = useState('');

  const vistas = plantillas.map(normaliza);

  const activas = vistas.filter(p => p.activo).length;
  const destinoEmpresa = vistas.filter(p => p.destino === 'empresa').length;
  const destinoTrabajador = vistas.filter(p => p.destino === 'trabajador').length;

  const conteo: Record<Filtro, number> = {
    todas: vistas.length,
    activas: vistas.filter(p => p.activo).length,
    inactivas: vistas.filter(p => !p.activo).length,
  };

  const termino = busqueda.trim().toLowerCase();
  const visibles = vistas.filter(p => {
    const coincideFiltro = filtro === 'todas' ? true : filtro === 'activas' ? p.activo : !p.activo;
    const coincideBusqueda = !termino ||
      p.nombre.toLowerCase().includes(termino) ||
      p.categoria.toLowerCase().includes(termino) ||
      DESTINO_LABEL[p.destino].toLowerCase().includes(termino);
    return coincideFiltro && coincideBusqueda;
  });

  const hayFiltros = termino !== '' || filtro !== 'todas';
  const limpiarFiltros = () => { setBusqueda(''); setFiltro('todas'); };

  const abrirNueva = () => {
    setEditing(null);
    setForm(FORM_VACIO);
    setErrorNombre('');
    setShowModal(true);
  };

  const abrirEditar = (p: PlantillaBase) => {
    setEditing(p);
    setForm({ nombre: p.nombre, categoria: p.categoria, destino: p.destino, activo: p.activo });
    setErrorNombre('');
    setShowModal(true);
  };

  const cerrarModal = () => {
    setShowModal(false);
    setEditing(null);
    setForm(FORM_VACIO);
    setErrorNombre('');
  };

  const guardar = (e: React.FormEvent) => {
    e.preventDefault();
    const nombreNormalizado = form.nombre.trim().toLowerCase();
    if (!nombreNormalizado) return;

    const duplicada = plantillas.some(p =>
      p.nombre.trim().toLowerCase() === nombreNormalizado && p.id !== editing?.id
    );
    if (duplicada) {
      setErrorNombre('Ya existe una plantilla con este nombre.');
      return;
    }

    if (editing) {
      const nuevaLista = plantillas.map(p =>
        p.id === editing.id ? { ...p, nombre: form.nombre.trim(), categoria: form.categoria, destino: form.destino } : p
      );
      savePlantillas(nuevaLista);
      setPlantillas(nuevaLista);
      showToast('Plantilla actualizada');
    } else {
      const nueva: PlantillaBase = {
        id: `tpl_${Date.now()}`,
        nombre: form.nombre.trim(),
        categoria: form.categoria,
        destino: form.destino,
        activo: form.activo,
      };
      const nuevaLista = [...plantillas, nueva];
      savePlantillas(nuevaLista);
      setPlantillas(nuevaLista);
      showToast('Plantilla creada');
    }
    cerrarModal();
  };

  const toggleActivo = (p: PlantillaBase) => {
    const nuevaLista = plantillas.map(raw =>
      raw.id === p.id ? { ...raw, activo: !p.activo } : raw
    );
    savePlantillas(nuevaLista);
    setPlantillas(nuevaLista);
    showToast(p.activo ? 'Plantilla desactivada' : 'Plantilla activada');
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-between items-start gap-3 flex-wrap">
        <div>
          <div className="text-[15px] font-bold text-navy">Plantillas base</div>
          <div className="text-[11.5px] text-gray-400 mt-0.5 max-w-[560px] leading-relaxed">
            Catálogo reutilizable para crear requisitos en proyectos sin repetir nombres y categorías manualmente.
          </div>
        </div>
        <button
          onClick={abrirNueva}
          className="px-3.5 py-2 rounded-lg bg-brown text-white text-[12.5px] font-semibold flex items-center gap-1.5 cursor-pointer hover:brightness-105 transition-all border-none whitespace-nowrap"
        >
          <Plus size={14} />
          Nueva plantilla
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="border border-cream3 rounded-xl p-3.5 bg-white">
          <div className="text-[20px] font-bold text-navy">{activas}</div>
          <div className="text-[11px] text-gray-400 mt-0.5">Plantillas activas</div>
        </div>
        <div className="border border-cream3 rounded-xl p-3.5 bg-white">
          <div className="text-[20px] font-bold text-navy">{destinoEmpresa}</div>
          <div className="text-[11px] text-gray-400 mt-0.5">Destino Empresa</div>
        </div>
        <div className="border border-cream3 rounded-xl p-3.5 bg-white">
          <div className="text-[20px] font-bold text-navy">{destinoTrabajador}</div>
          <div className="text-[11px] text-gray-400 mt-0.5">Destino Trabajador</div>
        </div>
      </div>

      <div className="bg-gold-soft/40 border border-[#ecdcc4] rounded-lg px-3 py-2.5 text-[12px] text-[#7b5b32] leading-relaxed">
        Una plantilla define solamente <b>nombre, categoría y destino sugerido</b>. La vigencia, obligatoriedad, días de alerta y criticidad se definen al convertirla en requisito dentro de un proyecto.
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex bg-[#f1efe6] border border-cream3 rounded-xl p-1 gap-1">
          {([['todas', 'Todas'], ['activas', 'Activas'], ['inactivas', 'Inactivas']] as Array<[Filtro, string]>).map(([f, label]) => (
            <button
              key={f}
              onClick={() => setFiltro(f)}
              aria-pressed={filtro === f}
              className={`px-3.5 py-1.5 rounded-lg text-[12.5px] font-semibold transition-all cursor-pointer border-none ${
                filtro === f ? 'bg-white text-navy shadow-sm' : 'text-gray-500 hover:text-navy hover:bg-white/40'
              }`}
            >
              {label} <span className="opacity-60 text-xs">{conteo[f]}</span>
            </button>
          ))}
        </div>
        <div className="relative min-w-[200px] flex-1 max-w-[320px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            type="text"
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar plantilla..."
            className="form-input w-full pl-9 py-2 text-[13px] bg-[#f1efe6] border-cream3 focus:bg-white transition-all rounded-xl"
          />
        </div>
      </div>

      <div className="border border-cream3 rounded-xl bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-cream3">
                <th className="px-4 py-3 text-[10.5px] uppercase font-bold tracking-wider text-gray-500 bg-cream2">Plantilla</th>
                <th className="px-4 py-3 text-[10.5px] uppercase font-bold tracking-wider text-gray-500 bg-cream2">Categoría</th>
                <th className="px-4 py-3 text-[10.5px] uppercase font-bold tracking-wider text-gray-500 bg-cream2">Destino sugerido</th>
                <th className="px-4 py-3 text-[10.5px] uppercase font-bold tracking-wider text-gray-500 bg-cream2">Estado</th>
                <th className="px-4 py-3 text-[10.5px] uppercase font-bold tracking-wider text-gray-500 bg-cream2 text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {visibles.map(p => (
                <tr key={p.id} className="hover:bg-[#fbfaf6] transition-colors">
                  <td className="px-4 py-3">
                    <div className="text-[13px] font-semibold text-navy">{p.nombre}</div>
                    <div className="text-[11px] text-gray-400 mt-0.5">Plantilla base</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`badge border text-[11px] ${CATEGORIA_COLOR[p.categoria] || 'border-cream3 bg-cream2 text-gray-600'}`}>{p.categoria}</span>
                  </td>
                  <td className="px-4 py-3 text-[13px] text-navy">{DESTINO_LABEL[p.destino]}</td>
                  <td className="px-4 py-3">
                    <span className={`badge text-[11px] ${p.activo ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'}`}>
                      {p.activo ? 'Activa' : 'Inactiva'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2.5">
                      <button
                        onClick={() => abrirEditar(p)}
                        className="text-[12px] font-semibold text-brown hover:underline cursor-pointer border-none bg-transparent whitespace-nowrap"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => toggleActivo(p)}
                        title={p.activo ? 'Desactivar plantilla' : 'Activar plantilla'}
                        aria-label={p.activo ? `Desactivar ${p.nombre}` : `Activar ${p.nombre}`}
                        className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer border-none shrink-0 ${p.activo ? 'bg-emerald-600' : 'bg-gray-300'}`}
                      >
                        <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${p.activo ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {visibles.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-[13px] text-gray-400">
                    No hay plantillas que coincidan con la búsqueda o filtro.
                    {hayFiltros && (
                      <>
                        {' '}
                        <button onClick={limpiarFiltros} className="text-brown hover:underline cursor-pointer font-semibold border-none bg-transparent">
                          Limpiar filtros
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="text-[12px] text-gray-400 px-4 py-3 border-t border-cream2 font-medium">
          Mostrando {visibles.length} de {vistas.length} plantillas
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-[440px] max-h-[calc(100vh-24px)] overflow-y-auto">
            <div className="flex justify-between items-center p-4 border-b border-cream">
              <h3 className="font-medium text-navy text-[17.6px]">{editing ? 'Editar plantilla base' : 'Nueva plantilla base'}</h3>
              <button onClick={cerrarModal} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={guardar} className="p-6 flex flex-col gap-4">
              <div>
                <label className="block text-[13.2px] font-medium text-gray-700 mb-1.5">Nombre</label>
                <input
                  type="text"
                  value={form.nombre}
                  onChange={e => { setForm({ ...form, nombre: e.target.value }); setErrorNombre(''); }}
                  className="form-input w-full p-2.5 border border-cream3 rounded-lg focus:border-brown focus:ring-1 focus:ring-brown outline-none transition-all"
                  placeholder="Ej. Certificado de afiliación"
                  required
                />
                {errorNombre && <p className="text-[12px] text-red-600 mt-1.5">{errorNombre}</p>}
              </div>
              <div>
                <label className="block text-[13.2px] font-medium text-gray-700 mb-1.5">Categoría</label>
                <select
                  value={form.categoria}
                  onChange={e => setForm({ ...form, categoria: e.target.value as PlantillaBase['categoria'] })}
                  className="form-input w-full p-2.5 border border-cream3 rounded-lg focus:border-brown focus:ring-1 focus:ring-brown outline-none transition-all"
                >
                  <option value="Laboral">Laboral</option>
                  <option value="Tributario">Tributario</option>
                  <option value="Prevención">Prevención</option>
                </select>
              </div>
              <div>
                <label className="block text-[13.2px] font-medium text-gray-700 mb-1.5">Destino sugerido</label>
                <select
                  value={form.destino}
                  onChange={e => setForm({ ...form, destino: e.target.value as PlantillaBase['destino'] })}
                  className="form-input w-full p-2.5 border border-cream3 rounded-lg focus:border-brown focus:ring-1 focus:ring-brown outline-none transition-all"
                >
                  <option value="empresa">Empresa</option>
                  <option value="trabajador">Trabajador</option>
                </select>
              </div>
              {!editing && (
                <div>
                  <label className="block text-[13.2px] font-medium text-gray-700 mb-1.5">Estado inicial</label>
                  <select
                    value={form.activo ? 'true' : 'false'}
                    onChange={e => setForm({ ...form, activo: e.target.value === 'true' })}
                    className="form-input w-full p-2.5 border border-cream3 rounded-lg focus:border-brown focus:ring-1 focus:ring-brown outline-none transition-all"
                  >
                    <option value="true">Activa</option>
                    <option value="false">Inactiva</option>
                  </select>
                </div>
              )}

              <div className="bg-gold-soft/40 border border-[#ecdcc4] rounded-lg px-3 py-2.5 text-[12px] text-[#7b5b32]">
                No agregues vigencia, obligatoriedad ni criticidad aquí. Eso pertenece al requisito del proyecto.
              </div>

              <div className="flex justify-end gap-3 mt-2 pt-4 border-t border-cream">
                <button type="button" onClick={cerrarModal} className="btn btn-ghost font-medium">Cancelar</button>
                <button type="submit" className="btn btn-primary">{editing ? 'Guardar cambios' : 'Crear plantilla'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
