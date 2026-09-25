import React from 'react';
import { Building2, CheckCircle2, X } from 'lucide-react';
import { createAdminContractor } from '../data/supabaseContractorDirectory';
import { restoreSupabaseSession } from '../data/supabaseAuth';
import { hydrateCoreDataFromSupabase } from '../data/supabaseCoreData';
import { isValidRut } from '../utils/rut';

type Props = {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  showToast: (message: string, type?: 'success' | 'error' | 'warning') => void;
};

const emptyForm = () => ({
  name: '',
  legalName: '',
  rut: '',
  address: '',
  contactName: '',
  contactEmail: '',
  contactPhone: '',
});

export default function AdminContractorCreateModal({ open, onClose, onCreated, showToast }: Props) {
  const [form, setForm] = React.useState(emptyForm);
  const [saving, setSaving] = React.useState(false);
  const [createdName, setCreatedName] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    setForm(emptyForm());
    setCreatedName(null);
  }, [open]);

  if (!open) return null;

  const close = () => {
    if (saving) return;
    onClose();
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving) return;
    if (!form.name.trim() || !form.rut.trim() || !form.contactName.trim() || !form.contactEmail.trim()) return;
    if (!isValidRut(form.rut)) {
      showToast('El RUT del contratista no es válido.', 'error');
      return;
    }

    setSaving(true);
    try {
      const created = await createAdminContractor({
        name: form.name,
        legalName: form.legalName || form.name,
        rut: form.rut,
        address: form.address,
        contactName: form.contactName,
        contactEmail: form.contactEmail,
        contactPhone: form.contactPhone,
      });
      const session = await restoreSupabaseSession();
      if (session) await hydrateCoreDataFromSupabase(session);
      setCreatedName(created.contractor_name);
      onCreated();
      showToast('Contratista creado en el directorio de Acredita.');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'No fue posible crear el contratista.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return <div className="fixed inset-0 z-[520] flex items-center justify-center bg-black/50 p-4" onClick={close}>
    <div className="w-full max-w-[560px] max-h-[calc(100vh-24px)] overflow-y-auto rounded-xl bg-white shadow-xl" onClick={event => event.stopPropagation()}>
      <div className="flex items-center justify-between border-b border-cream p-4">
        <div>
          <h3 className="flex items-center gap-2 text-[17.6px] font-medium text-navy"><Building2 size={19} /> Nuevo contratista</h3>
          <p className="mt-0.5 text-xs text-gray-500">Administración crea la empresa maestra. Después los Mandantes podrán incorporarla a sus proyectos.</p>
        </div>
        <button type="button" onClick={close} disabled={saving} className="text-gray-400 hover:text-gray-600 disabled:opacity-40"><X size={20} /></button>
      </div>

      {createdName ? <div className="p-7 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-green-700"><CheckCircle2 size={32} /></div>
        <h4 className="text-lg font-semibold text-navy">Contratista creado</h4>
        <p className="mt-2 text-sm text-gray-600"><strong>{createdName}</strong> ya está disponible en el directorio para ser incorporado a proyectos.</p>
        <button type="button" onClick={close} className="btn btn-primary mt-6">Cerrar</button>
      </div> : <form onSubmit={submit} className="flex flex-col gap-4 p-6">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="text-[13px] font-medium text-gray-700">Nombre comercial
            <input aria-label="Nombre comercial del contratista" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} className="form-input mt-1.5 w-full" placeholder="Transportes Ejemplo" required />
          </label>
          <label className="text-[13px] font-medium text-gray-700">RUT
            <input aria-label="RUT del contratista" value={form.rut} onChange={e=>setForm({...form,rut:e.target.value})} className="form-input mt-1.5 w-full" placeholder="76.123.456-7" required />
            {form.rut.trim() && !isValidRut(form.rut) && <small className="mt-1 block text-red-600">RUT inválido.</small>}
          </label>
        </div>

        <label className="text-[13px] font-medium text-gray-700">Razón social
          <input aria-label="Razón social del contratista" value={form.legalName} onChange={e=>setForm({...form,legalName:e.target.value})} className="form-input mt-1.5 w-full" placeholder="Transportes Ejemplo SpA" />
        </label>

        <label className="text-[13px] font-medium text-gray-700">Dirección <span className="font-normal text-gray-400">opcional</span>
          <input aria-label="Dirección del contratista" value={form.address} onChange={e=>setForm({...form,address:e.target.value})} className="form-input mt-1.5 w-full" placeholder="Av. Ejemplo 123, Santiago" />
        </label>

        <div className="mt-1 border-t border-cream pt-4">
          <strong className="text-sm text-navy">Responsable principal</strong>
          <p className="mb-3 mt-1 text-[11.5px] text-gray-500">Este contacto será el destinatario cuando la empresa sea incorporada a un proyecto.</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="text-[13px] font-medium text-gray-700">Nombre
              <input aria-label="Responsable del contratista" value={form.contactName} onChange={e=>setForm({...form,contactName:e.target.value})} className="form-input mt-1.5 w-full" placeholder="Nombre y apellido" required />
            </label>
            <label className="text-[13px] font-medium text-gray-700">Correo
              <input aria-label="Correo del responsable del contratista" type="email" value={form.contactEmail} onChange={e=>setForm({...form,contactEmail:e.target.value})} className="form-input mt-1.5 w-full" placeholder="responsable@empresa.cl" required />
            </label>
          </div>
          <label className="mt-3 block text-[13px] font-medium text-gray-700">Teléfono <span className="font-normal text-gray-400">opcional</span>
            <input aria-label="Teléfono del responsable del contratista" value={form.contactPhone} onChange={e=>setForm({...form,contactPhone:e.target.value})} className="form-input mt-1.5 w-full" placeholder="+56 9 1234 5678" />
          </label>
        </div>

        <div className="rounded-lg border border-blue-100 bg-blue-50 p-3 text-[11.5px] leading-relaxed text-blue-800">
          Crear la empresa <strong>no la asigna a ningún proyecto</strong>. Los Mandantes solo podrán seleccionar empresas previamente registradas por Acredita.
        </div>

        <div className="flex justify-end gap-3 border-t border-cream pt-4">
          <button type="button" onClick={close} disabled={saving} className="btn btn-ghost">Cancelar</button>
          <button type="submit" disabled={saving || (!!form.rut.trim() && !isValidRut(form.rut))} className="btn btn-primary disabled:opacity-60">{saving ? 'Creando…' : 'Crear contratista'}</button>
        </div>
      </form>}
    </div>
  </div>;
}
