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
  const projectArchived = String(project.estado || '').trim().toLocaleLowerCase('es').includes('archiv');
  const activeServices = services.filter(item => item.activo && item.estado !== 'finalizado');
  const historicalServices = services.filter(item => !item.activo || item.estado === 'finalizado');

  const openForm = () => {
    if (projectArchived) {
      showToast('Un proyecto archivado se mantiene solo para consulta.', 'warning');
      return;
    }
    setEditingId(null);
    setForm({ ...emptyForm, contratistaId: contractors[0]?.id || '' });
    setOpen(true);
  };

  const openEdit = (service: ServicioContrato) => {
    if (projectArchived || !contractorById.has(service.contratistaId)) return;
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
    if (projectArchived) {
      showToast('Un proyecto archivado se mantiene solo para consulta.', 'warning');
      return;
    }
    if (form.fechaInicio && form.fechaTermino && form.fechaTermino < form.fechaInicio) {
      showToast('La fecha de término no puede ser anterior al inicio.', 'error');
      return;
    }
    if (project.fechaInicio && form.fechaInicio && form.fechaInicio < project.fechaInicio) {
      showToast('El servicio no puede comenzar antes que el proyecto.', 'error');
      return;
    }
    if (project.fechaTermino && form.fechaTermino && form.fechaTermino > project.fechaTermino) {
      showToast('El servicio no puede terminar después que el proyecto.', 'error');
      return;
    }
    const duplicateCode = getServicios().some(item =>
      item.id !== editingId
      && item.proyectoId === project.id
      && item.contratistaId === form.contratistaId
      && item.codigo.trim().toLocaleLowerCase('es') === form.codigo.trim().toLocaleLowerCase('es')
    );
    if (duplicateCode) {
      showToast('Ese contratista ya tiene un servicio o contrato con el mismo código en este proyecto.', 'warning');
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
      <button type="button" onClick={openForm} disabled={projectArchived || contractors.length === 0}><Plus /> {projectArchived ? 'Solo lectura' : 'Nuevo servicio'}</button>
    </div>
    <div className="mandante-proyectos-table-wrap">
      <table>
        <thead><tr><th>Código</th><th>Servicio</th><th>Contratista</th><th>Responsables</th><th>Vigencia</th><th>Estado</th><th>Acción</th></tr></thead>
        <tbody>{activeServices.map(service => <tr key={service.id}>
          <td><strong>{service.codigo}</strong></td>
          <td><strong>{service.nombre}</strong><small>{service.categoria || 'Sin categoría'}</small></td>
          <td>{contractorById.get(service.contratistaId)?.nombre || 'Contratista no disponible'}</td>
          <td>{service.responsableContratista || 'Sin responsable'}<small>Mandante: {service.responsableMandante || 'Sin responsable'}</small></td>
          <td>{service.fechaInicio || 'Sin inicio'}<small>{service.fechaTermino ? `Hasta ${service.fechaTermino}` : 'Sin término definido'}</small></td>
          <td><b className={`mandante-proyectos-badge ${service.estado === 'activo' ? 'green' : service.estado === 'suspendido' ? 'red' : 'gray'}`}>{service.estado}</b></td>
          <td><button type="button" disabled={projectArchived || !contractorById.has(service.contratistaId)} onClick={() => openEdit(service)}>Editar</button></td>
        </tr>)}</tbody>
      </table>
    </div>
    {activeServices.length === 0 && <div className="mandante-proyectos-empty"><BriefcaseBusiness /> No hay servicios o contratos activos para este proyecto.</div>}
    {historicalServices.length > 0 && <div className="mt-4 rounded-xl border border-cream3 bg-cream2/60 p-4">
      <div className="mb-3"><h3 className="text-[13px] font-semibold text-navy">Servicios y contratos finalizados</h3><p className="mt-1 text-[10.5px] text-gray-500">Se conservan para consulta y trazabilidad. Solo pueden reabrirse mientras el contratista siga activo en el proyecto.</p></div>
      <div className="mandante-proyectos-table-wrap"><table><thead><tr><th>Código</th><th>Servicio</th><th>Contratista</th><th>Vigencia</th><th>Estado</th><th>Acción</th></tr></thead><tbody>{historicalServices.map(service => <tr key={service.id}><td><strong>{service.codigo}</strong></td><td><strong>{service.nombre}</strong><small>{service.categoria || 'Sin categoría'}</small></td><td>{contractorById.get(service.contratistaId)?.nombre || 'Contratista histórico'}</td><td>{service.fechaInicio || 'Sin inicio'}<small>{service.fechaTermino ? `Hasta ${service.fechaTermino}` : 'Sin término definido'}</small></td><td><b className="mandante-proyectos-badge gray">Finalizado</b></td><td><button type="button" disabled={projectArchived || !contractorById.has(service.contratistaId)} onClick={() => openEdit(service)}>{contractorById.has(service.contratistaId) ? 'Revisar / reabrir' : 'Solo historial'}</button></td></tr>)}</tbody></table></div>
    </div>}

    {open && <div className="fixed inset-0 bg-black/50 z-[600] flex items-center justify-center p-4" onClick={() => !saving && setOpen(false)}>
      <form onSubmit={submit} className="bg-white rounded-xl shadow-xl w-full max-w-[620px] max-h-[calc(100vh-24px)] overflow-y-auto" onClick={event => event.stopPropagation()}>
        <header className="flex justify-between items-start p-5 border-b border-cream">
          <div><h3 className="font-semibold text-navy text-lg">{editingId ? 'Editar servicio o contrato' : 'Nuevo servicio o contrato'}</h3><p className="text-xs text-gray-500 mt-1">{project.nombre}</p></div>
          <button type="button" onClick={() => setOpen(false)} className="text-gray-400" aria-label="Cerrar"><X size={20} /></button>
        </header>
        <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="sm:col-span-2 text-sm text-gray-700">Contratista<select required disabled={Boolean(editingId)} value={form.contratistaId} onChange={event => setForm({ ...form, contratistaId: event.target.value })} className="form-input w-full mt-1 p-2.5 border border-cream3 rounded-lg"><option value="">Seleccionar contratista</option>{contractors.map(item => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select></label>
          <label className="text-sm text-gray-700">Código de contrato<input required value={form.codigo} onChange={event => setForm({ ...form, codigo: event.target.value })} className="form-input w-full mt-1 p-2.5 border border-cream3 rounded-lg" placeholder="Ej. OC-2026-014" /></label>
          <label className="text-sm text-gray-700">Categoría<input value={form.categoria} onChange={event => setForm({ ...form, categoria: event.target.value })} className="form-input w-full mt-1 p-2.5 border border-cream3 rounded-lg" placeholder="Ej. Montaje eléctrico" /></label>
          <label className="sm:col-span-2 text-sm text-gray-700">Nombre del servicio<input required value={form.nombre} onChange={event => setForm({ ...form, nombre: event.target.value })} className="form-input w-full mt-1 p-2.5 border border-cream3 rounded-lg" placeholder="Ej. Mantención eléctrica planta norte" /></label>
          <label className="text-sm text-gray-700">Responsable contratista<input value={form.responsableContratista} onChange={event => setForm({ ...form, responsableContratista: event.target.value })} className="form-input w-full mt-1 p-2.5 border border-cream3 rounded-lg" /></label>
          <label className="text-sm text-gray-700">Responsable mandante<input value={form.responsableMandante} onChange={event => setForm({ ...form, responsableMandante: event.target.value })} className="form-input w-full mt-1 p-2.5 border border-cream3 rounded-lg" /></label>
          <label className="text-sm text-gray-700">Inicio<input type="date" min={project.fechaInicio || undefined} max={project.fechaTermino || undefined} value={form.fechaInicio} onChange={event => setForm({ ...form, fechaInicio: event.target.value })} className="form-input w-full mt-1 p-2.5 border border-cream3 rounded-lg" /></label>
          <label className="text-sm text-gray-700">Término<input type="date" min={form.fechaInicio || project.fechaInicio || undefined} max={project.fechaTermino || undefined} value={form.fechaTermino} onChange={event => setForm({ ...form, fechaTermino: event.target.value })} className="form-input w-full mt-1 p-2.5 border border-cream3 rounded-lg" /></label>
          <label className="sm:col-span-2 text-sm text-gray-700">Estado<select value={form.estado} onChange={event => setForm({ ...form, estado: event.target.value as ServicioContrato['estado'] })} className="form-input w-full mt-1 p-2.5 border border-cream3 rounded-lg"><option value="borrador">Borrador</option><option value="activo">Activo</option><option value="suspendido">Suspendido</option><option value="finalizado">Finalizado</option></select></label>
        </div>
        <footer className="flex justify-between items-center gap-3 p-5 border-t border-cream"><span className="text-xs text-gray-500 flex items-center gap-2"><CalendarDays size={15} />Las obligaciones respetarán esta vigencia.</span><div className="flex gap-2"><button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>Cancelar</button><button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Guardando…' : editingId ? 'Guardar cambios' : 'Crear servicio'}</button></div></footer>
      </form>
    </div>}
  </article>;
}
