import { useMemo, useState, type FormEvent } from 'react';
import { BriefcaseBusiness, CalendarDays, Plus, X } from 'lucide-react';
import type { Contratista, Proyecto, ServicioContrato } from '../types';
import { getServicios, saveServicios } from '../data/operationalCore';
import { confirmBusinessPersistence } from '../data/supabasePersistence';

type FormState = {
  contratistaId: string;
  codigo: string;
  nombre: string;
  categoria: string;
  responsableContratista: string;
  responsableMandante: string;
  fechaInicio: string;
  fechaTermino: string;
  estado: ServicioContrato['estado'];
};

const emptyForm: FormState = {
  contratistaId: '', codigo: '', nombre: '', categoria: '', responsableContratista: '',
  responsableMandante: '', fechaInicio: '', fechaTermino: '', estado: 'activo',
};

export default function ServicesPanel({
  project,
  contractors,
  services,
  onChanged,
  showToast,
}: {
  project: Proyecto;
  contractors: Contratista[];
  services: ServicioContrato[];
  onChanged: () => void;
  showToast: (message: string, type?: 'success' | 'error' | 'warning') => void;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const contractorById = useMemo(() => new Map(contractors.map(item => [item.id, item])), [contractors]);

  const openForm = () => {
    setEditingId(null);
    setForm({ ...emptyForm, contratistaId: contractors[0]?.id || '' });
    setOpen(true);
  };

  const openEdit = (service: ServicioContrato) => {
    setEditingId(service.id);
    setForm({
      contratistaId: service.contratistaId,
      codigo: service.codigo,
      nombre: service.nombre,
      categoria: service.categoria || '',
      responsableContratista: service.responsableContratista || '',
      responsableMandante: service.responsableMandante || '',
      fechaInicio: service.fechaInicio || '',
      fechaTermino: service.fechaTermino || '',
      estado: service.estado,
    });
    setOpen(true);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (saving || !form.contratistaId || !form.codigo.trim() || !form.nombre.trim()) return;
    if (form.fechaInicio && form.fechaTermino && form.fechaTermino < form.fechaInicio) {
      showToast('La fecha de término no puede ser anterior al inicio.', 'error');
      return;
    }
    const id = editingId || `servicio_${crypto.randomUUID()}`;
    const service: ServicioContrato = {
      id,
      proyectoId: project.id,
      contratistaId: form.contratistaId,
      codigo: form.codigo.trim(),
      nombre: form.nombre.trim(),
      categoria: form.categoria.trim() || undefined,
      responsableContratista: form.responsableContratista.trim() || undefined,
      responsableMandante: form.responsableMandante.trim() || undefined,
      fechaInicio: form.fechaInicio || undefined,
      fechaTermino: form.fechaTermino || undefined,
      estado: form.estado,
      activo: form.estado !== 'finalizado',
    };
    setSaving(true);
    const current = getServicios();
    saveServicios(editingId ? current.map(item => item.id === editingId ? service : item) : [...current, service]);
    try {
      await confirmBusinessPersistence('core');
      setOpen(false);
      onChanged();
      showToast(editingId ? 'Servicio o contrato actualizado.' : 'Servicio o contrato creado correctamente.');
    } catch (error) {
      console.error('No fue posible crear el servicio.', error);
      onChanged();
      showToast('No fue posible guardar el servicio. Intenta nuevamente.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return <article className="mandante-proyectos-section-card mandante-proyectos-panel">
    <div className="mandante-proyectos-section-head">
      <div><h2>Servicios y contratos</h2><p>Separa responsables, vigencias y trabajadores dentro de una misma faena.</p></div>
      <button type="button" onClick={openForm} disabled={contractors.length === 0}><Plus /> Nuevo servicio</button>
    </div>
    <div className="mandante-proyectos-table-wrap">
      <table>
        <thead><tr><th>Código</th><th>Servicio</th><th>Contratista</th><th>Responsables</th><th>Vigencia</th><th>Estado</th><th>Acción</th></tr></thead>
        <tbody>{services.map(service => <tr key={service.id}>
          <td><strong>{service.codigo}</strong></td>
          <td><strong>{service.nombre}</strong><small>{service.categoria || 'Sin categoría'}</small></td>
          <td>{contractorById.get(service.contratistaId)?.nombre || 'Contratista no disponible'}</td>
          <td>{service.responsableContratista || 'Sin responsable'}<small>Mandante: {service.responsableMandante || 'Sin responsable'}</small></td>
          <td>{service.fechaInicio || 'Sin inicio'}<small>{service.fechaTermino ? `Hasta ${service.fechaTermino}` : 'Sin término definido'}</small></td>
          <td><b className={`mandante-proyectos-badge ${service.estado === 'activo' ? 'green' : service.estado === 'suspendido' ? 'red' : 'gray'}`}>{service.estado}</b></td>
          <td><button type="button" onClick={() => openEdit(service)}>Editar</button></td>
        </tr>)}</tbody>
      </table>
    </div>
    {services.length === 0 && <div className="mandante-proyectos-empty"><BriefcaseBusiness /> Todavía no hay servicios o contratos configurados para este proyecto.</div>}

    {open && <div className="fixed inset-0 bg-black/50 z-[600] flex items-center justify-center p-4" onClick={() => !saving && setOpen(false)}>
      <form onSubmit={submit} className="bg-white rounded-xl shadow-xl w-full max-w-[620px] max-h-[calc(100vh-24px)] overflow-y-auto" onClick={event => event.stopPropagation()}>
        <header className="flex justify-between items-start p-5 border-b border-cream">
          <div><h3 className="font-semibold text-navy text-lg">{editingId ? 'Editar servicio o contrato' : 'Nuevo servicio o contrato'}</h3><p className="text-xs text-gray-500 mt-1">{project.nombre}</p></div>
          <button type="button" onClick={() => setOpen(false)} className="text-gray-400" aria-label="Cerrar"><X size={20} /></button>
        </header>
        <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="sm:col-span-2 text-sm text-gray-700">Contratista<select required value={form.contratistaId} onChange={event => setForm({ ...form, contratistaId: event.target.value })} className="form-input w-full mt-1 p-2.5 border border-cream3 rounded-lg"><option value="">Seleccionar contratista</option>{contractors.map(item => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select></label>
          <label className="text-sm text-gray-700">Código de contrato<input required value={form.codigo} onChange={event => setForm({ ...form, codigo: event.target.value })} className="form-input w-full mt-1 p-2.5 border border-cream3 rounded-lg" placeholder="Ej. OC-2026-014" /></label>
          <label className="text-sm text-gray-700">Categoría<input value={form.categoria} onChange={event => setForm({ ...form, categoria: event.target.value })} className="form-input w-full mt-1 p-2.5 border border-cream3 rounded-lg" placeholder="Ej. Montaje eléctrico" /></label>
          <label className="sm:col-span-2 text-sm text-gray-700">Nombre del servicio<input required value={form.nombre} onChange={event => setForm({ ...form, nombre: event.target.value })} className="form-input w-full mt-1 p-2.5 border border-cream3 rounded-lg" placeholder="Ej. Mantención eléctrica planta norte" /></label>
          <label className="text-sm text-gray-700">Responsable contratista<input value={form.responsableContratista} onChange={event => setForm({ ...form, responsableContratista: event.target.value })} className="form-input w-full mt-1 p-2.5 border border-cream3 rounded-lg" /></label>
          <label className="text-sm text-gray-700">Responsable mandante<input value={form.responsableMandante} onChange={event => setForm({ ...form, responsableMandante: event.target.value })} className="form-input w-full mt-1 p-2.5 border border-cream3 rounded-lg" /></label>
          <label className="text-sm text-gray-700">Inicio<input type="date" value={form.fechaInicio} onChange={event => setForm({ ...form, fechaInicio: event.target.value })} className="form-input w-full mt-1 p-2.5 border border-cream3 rounded-lg" /></label>
          <label className="text-sm text-gray-700">Término<input type="date" value={form.fechaTermino} onChange={event => setForm({ ...form, fechaTermino: event.target.value })} className="form-input w-full mt-1 p-2.5 border border-cream3 rounded-lg" /></label>
          <label className="sm:col-span-2 text-sm text-gray-700">Estado<select value={form.estado} onChange={event => setForm({ ...form, estado: event.target.value as ServicioContrato['estado'] })} className="form-input w-full mt-1 p-2.5 border border-cream3 rounded-lg"><option value="borrador">Borrador</option><option value="activo">Activo</option><option value="suspendido">Suspendido</option><option value="finalizado">Finalizado</option></select></label>
        </div>
        <footer className="flex justify-between items-center gap-3 p-5 border-t border-cream"><span className="text-xs text-gray-500 flex items-center gap-2"><CalendarDays size={15} />Las obligaciones respetarán esta vigencia.</span><div className="flex gap-2"><button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>Cancelar</button><button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Guardando…' : editingId ? 'Guardar cambios' : 'Crear servicio'}</button></div></footer>
      </form>
    </div>}
  </article>;
}
