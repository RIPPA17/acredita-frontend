import React, { useMemo, useState } from 'react';
import { Plus, Search, X } from 'lucide-react';
import type { PlantillaBase } from '../../../types';
import { createDocumentTemplate, updateDocumentTemplate } from '../../../data/supabaseTemplates';

type Filtro = 'todas' | 'activas' | 'inactivas';

const DESTINO_LABEL: Record<PlantillaBase['destino'], string> = {
  empresa: 'Empresa',
  trabajador: 'Trabajador',
};

const CATEGORIA_COLOR: Record<PlantillaBase['categoria'], string> = {
  Laboral: 'border-blue-200 bg-blue-50 text-blue-700',
  Tributario: 'border-purple-200 bg-purple-50 text-purple-700',
  Prevención: 'border-emerald-200 bg-emerald-50 text-emerald-700',
};

const FORM_VACIO = {
  nombre: '',
  categoria: 'Laboral' as PlantillaBase['categoria'],
  destino: 'empresa' as PlantillaBase['destino'],
  activo: true,
};

export default function PlantillasSupabaseConfig({
  plantillas,
  setPlantillas,
  showToast,
}: {
  plantillas: PlantillaBase[];
  setPlantillas: React.Dispatch<React.SetStateAction<PlantillaBase[]>>;
  showToast: (msg: string, type?: 'success' | 'error' | 'warning') => void;
}) {
  const [busqueda, setBusqueda] = useState('');
  const [filtro, setFiltro] = useState<Filtro>('todas');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<PlantillaBase | null>(null);
  const [form, setForm] = useState(FORM_VACIO);
  const [errorNombre, setErrorNombre] = useState('');
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const visibles = useMemo(() => {
    const termino = busqueda.trim().toLocaleLowerCase('es');
    return plantillas.filter(p => {
      const coincideFiltro = filtro === 'todas' || (filtro === 'activas' ? p.activo : !p.activo);
      const texto = `${p.nombre} ${p.categoria} ${DESTINO_LABEL[p.destino]}`.toLocaleLowerCase('es');
      return coincideFiltro && (!termino || texto.includes(termino));
    });
  }, [plantillas, busqueda, filtro]);

  const activas = plantillas.filter(p => p.activo).length;
  const destinoEmpresa = plantillas.filter(p => p.destino === 'empresa').length;
  const destinoTrabajador = plantillas.filter(p => p.destino === 'trabajador').length;
  const conteo = {
    todas: plantillas.length,
    activas,
    inactivas: plantillas.length - activas,
  };

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
    if (saving) return;
    setShowModal(false);
    setEditing(null);
    setForm(FORM_VACIO);
    setErrorNombre('');
  };

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    const nombre = form.nombre.trim();
    if (!nombre) return;
    const duplicada = plantillas.some(p =>
      p.nombre.trim().toLocaleLowerCase('es') === nombre.toLocaleLowerCase('es') && p.id !== editing?.id
    );
    if (duplicada) {
      setErrorNombre('Ya existe una plantilla con este nombre.');
      return;
    }

    setSaving(true);
    try {
      if (editing) {
        const updated = await updateDocumentTemplate({
          ...editing,
          nombre,
          categoria: form.categoria,
          destino: form.destino,
        });
        setPlantillas(current => current.map(item => item.id === updated.id ? updated : item));
        showToast('Plantilla actualizada');
      } else {
        const created = await createDocumentTemplate({
          nombre,
          categoria: form.categoria,
          destino: form.destino,
          activo: form.activo,
        });
        setPlantillas(current => [...current, created].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')));
        showToast('Plantilla creada');
      }
      setShowModal(false);
      setEditing(null);
      setForm(FORM_VACIO);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No fue posible guardar la plantilla.';
      if (message.toLowerCase().includes('duplicate') || message.toLowerCase().includes('unique')) {
        setErrorNombre('Ya existe una plantilla con este nombre.');
      } else {
        showToast(message, 'error');
      }
    } finally {
      setSaving(false);
    }
  };

  const toggleActivo = async (p: PlantillaBase) => {
    setTogglingId(p.id);
    try {
      const updated = await updateDocumentTemplate({ ...p, activo: !p.activo });
      setPlantillas(current => current.map(item => item.id === updated.id ? updated : item));
      showToast(p.activo ? 'Plantilla desactivada' : 'Plantilla activada');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'No fue posible cambiar el estado.', 'error');
    } finally {
      setTogglingId(null);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-between items-start gap-3 flex-wrap">
        <div>
          <div className="text-[15px] font-bold text-navy">Plantillas base</div>
          <div className="text-[11.5px] text-gray-400 mt-0.5 max-w-[600px] leading-relaxed">
            Catálogo compartido en Supabase para reutilizar nombres, categorías y destinos al configurar requisitos.
          </div>
        </div>
        <button onClick={abrirNueva} className="px-3.5 py-2 rounded-lg bg-brown text-white text-[12.5px] font-semibold flex items-center gap-1.5 cursor-pointer hover:brightness-105 transition-all border-none whitespace-nowrap">
          <Plus size={14} /> Nueva plantilla
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Metric value={activas} label="Plantillas activas" />
        <Metric value={destinoEmpresa} label="Destino Empresa" />
        <Metric value={destinoTrabajador} label="Destino Trabajador" />
      </div>

      <div className="bg-gold-soft/40 border border-[#ecdcc4] rounded-lg px-3 py-2.5 text-[12px] text-[#7b5b32] leading-relaxed">
        Una plantilla define solamente <b>nombre, categoría y destino sugerido</b>. Vigencia, obligatoriedad, alertas y criticidad pertenecen al requisito del proyecto.
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex bg-[#f1efe6] border border-cream3 rounded-xl p-1 gap-1">
          {([['todas', 'Todas'], ['activas', 'Activas'], ['inactivas', 'Inactivas']] as Array<[Filtro, string]>).map(([id, label]) => (
            <button key={id} onClick={() => setFiltro(id)} aria-pressed={filtro === id} className={`px-3.5 py-1.5 rounded-lg text-[12.5px] font-semibold transition-all cursor-pointer border-none ${filtro === id ? 'bg-white text-navy shadow-sm' : 'text-gray-500 hover:text-navy hover:bg-white/40'}`}>
              {label} <span className="opacity-60 text-xs">{conteo[id]}</span>
            </button>
          ))}
        </div>
        <div className="relative min-w-[200px] flex-1 max-w-[320px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar plantilla..." className="form-input w-full pl-9 py-2 text-[13px] bg-[#f1efe6] border-cream3 focus:bg-white transition-all rounded-xl" />
        </div>
      </div>

      <div className="border border-cream3 rounded-xl bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead><tr className="border-b border-cream3">
              {['Plantilla', 'Categoría', 'Destino sugerido', 'Estado', 'Acción'].map((label, index) => (
                <th key={label} className={`px-4 py-3 text-[10.5px] uppercase font-bold tracking-wider text-gray-500 bg-cream2 ${index === 4 ? 'text-right' : ''}`}>{label}</th>
              ))}
            </tr></thead>
            <tbody className="divide-y divide-gray-100">
              {visibles.map(p => (
                <tr key={p.id} className="hover:bg-[#fbfaf6] transition-colors">
                  <td className="px-4 py-3"><div className="text-[13px] font-semibold text-navy">{p.nombre}</div><div className="text-[11px] text-gray-400 mt-0.5">Plantilla base compartida</div></td>
                  <td className="px-4 py-3"><span className={`badge border text-[11px] ${CATEGORIA_COLOR[p.categoria]}`}>{p.categoria}</span></td>
                  <td className="px-4 py-3 text-[13px] text-navy">{DESTINO_LABEL[p.destino]}</td>
                  <td className="px-4 py-3"><span className={`badge text-[11px] ${p.activo ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'}`}>{p.activo ? 'Activa' : 'Inactiva'}</span></td>
                  <td className="px-4 py-3 text-right"><div className="flex items-center justify-end gap-2.5">
                    <button onClick={() => abrirEditar(p)} className="text-[12px] font-semibold text-brown hover:underline cursor-pointer border-none bg-transparent">Editar</button>
                    <button onClick={() => void toggleActivo(p)} disabled={togglingId === p.id} aria-label={p.activo ? `Desactivar ${p.nombre}` : `Activar ${p.nombre}`} className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer border-none shrink-0 disabled:opacity-50 ${p.activo ? 'bg-emerald-600' : 'bg-gray-300'}`}>
                      <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${p.activo ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
                    </button>
                  </div></td>
                </tr>
              ))}
              {visibles.length === 0 && <tr><td colSpan={5} className="py-10 text-center text-[13px] text-gray-400">No hay plantillas que coincidan con la búsqueda o filtro.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="text-[12px] text-gray-400 px-4 py-3 border-t border-cream2 font-medium">Mostrando {visibles.length} de {plantillas.length} plantillas</div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={cerrarModal}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-[440px]" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center p-4 border-b border-cream">
              <h3 className="font-medium text-navy text-[17.6px]">{editing ? 'Editar plantilla base' : 'Nueva plantilla base'}</h3>
              <button onClick={cerrarModal} disabled={saving} aria-label="Cerrar" className="text-gray-400 hover:text-gray-600 disabled:opacity-50"><X size={20} /></button>
            </div>
            <form onSubmit={guardar} className="p-6 flex flex-col gap-4">
              <Field label="Nombre"><input value={form.nombre} onChange={e => { setForm({ ...form, nombre: e.target.value }); setErrorNombre(''); }} className="form-input w-full p-2.5 border border-cream3 rounded-lg" required />{errorNombre && <p className="text-[12px] text-red-600 mt-1.5">{errorNombre}</p>}</Field>
              <Field label="Categoría"><select value={form.categoria} onChange={e => setForm({ ...form, categoria: e.target.value as PlantillaBase['categoria'] })} className="form-input w-full p-2.5 border border-cream3 rounded-lg"><option>Laboral</option><option>Tributario</option><option>Prevención</option></select></Field>
              <Field label="Destino sugerido"><select value={form.destino} onChange={e => setForm({ ...form, destino: e.target.value as PlantillaBase['destino'] })} className="form-input w-full p-2.5 border border-cream3 rounded-lg"><option value="empresa">Empresa</option><option value="trabajador">Trabajador</option></select></Field>
              {!editing && <Field label="Estado inicial"><select value={form.activo ? 'true' : 'false'} onChange={e => setForm({ ...form, activo: e.target.value === 'true' })} className="form-input w-full p-2.5 border border-cream3 rounded-lg"><option value="true">Activa</option><option value="false">Inactiva</option></select></Field>}
              <div className="flex justify-end gap-3 mt-2 pt-4 border-t border-cream"><button type="button" onClick={cerrarModal} disabled={saving} className="btn btn-ghost font-medium">Cancelar</button><button type="submit" disabled={saving} className="btn btn-primary disabled:opacity-60">{saving ? 'Guardando…' : editing ? 'Guardar cambios' : 'Crear plantilla'}</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function Metric({ value, label }: { value: number; label: string }) {
  return <div className="border border-cream3 rounded-xl p-3.5 bg-white"><div className="text-[20px] font-bold text-navy">{value}</div><div className="text-[11px] text-gray-400 mt-0.5">{label}</div></div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="block text-[13.2px] font-medium text-gray-700 mb-1.5">{label}</label>{children}</div>;
}
