import React from 'react';
import { CheckCircle, UserPlus, X } from 'lucide-react';
import { isValidRut } from '../utils/rut';
import { createAdminContractor, type CreateAdminContractorResult } from '../data/supabaseAdminContractors';

type Props = {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  showToast: (message: string, type?: 'success' | 'error' | 'warning') => void;
};

export default function AdminCreateContractorModal({ open, onClose, onCreated, showToast }: Props) {
  const [form, setForm] = React.useState({
    companyName: '',
    rut: '',
    fullName: '',
    email: '',
    phone: '',
  });
  const [saving, setSaving] = React.useState(false);
  const [created, setCreated] = React.useState<CreateAdminContractorResult | null>(null);

  React.useEffect(() => {
    if (!open) return;
    setForm({ companyName: '', rut: '', fullName: '', email: '', phone: '' });
    setCreated(null);
    setSaving(false);
  }, [open]);

  if (!open) return null;

  const close = () => {
    if (saving) return;
    onClose();
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving) return;
    if (!isValidRut(form.rut)) {
      showToast('El RUT del contratista no es válido.', 'error');
      return;
    }

    setSaving(true);
    try {
      const result = await createAdminContractor(form);
      setCreated(result);
      onCreated();
      showToast('Contratista creado correctamente');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'No fue posible crear el contratista.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[calc(100vh-24px)] w-full max-w-[520px] overflow-y-auto rounded-2xl border border-cream3 bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-cream3 px-5 py-4">
          <div>
            <div className="mb-1 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[1.4px] text-brown"><UserPlus size={14} /> Administración</div>
            <h3 className="text-[18px] font-semibold text-navy">Crear contratista</h3>
            <p className="mt-1 text-[12px] leading-relaxed text-gray-500">Crea la empresa y habilita a su responsable principal. Después los Mandantes podrán incorporarla a sus proyectos.</p>
          </div>
          <button type="button" onClick={close} className="text-gray-400 hover:text-gray-600" aria-label="Cerrar"><X size={20} /></button>
        </div>

        {created ? (
          <div className="p-7 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100"><CheckCircle size={34} className="text-green-700" /></div>
            <h4 className="text-lg font-semibold text-navy">{created.contractor.name} quedó creado</h4>
            <p className="mt-2 text-sm leading-relaxed text-gray-600">
              El responsable es <strong>{created.responsible.full_name}</strong> ({created.responsible.email}).
              {created.invited ? ' Le enviamos un correo para crear su contraseña y activar el acceso.' : ' La cuenta ya existía y quedó vinculada a esta empresa.'}
            </p>
            <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50 p-3 text-left text-xs leading-relaxed text-blue-800">
              La empresa todavía no pertenece a ningún proyecto. El Mandante deberá seleccionarla desde <strong>Incorporar contratista</strong>.
            </div>
            <button type="button" onClick={close} className="btn btn-primary mt-6 w-full justify-center">Entendido</button>
          </div>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-4 p-6">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block sm:col-span-2">
                <span className="mb-1.5 block text-[12.5px] font-medium text-gray-700">Empresa / razón social</span>
                <input required maxLength={200} value={form.companyName} onChange={event => setForm({ ...form, companyName: event.target.value })} className="form-input w-full" placeholder="Servicios Ejemplo SpA" />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-[12.5px] font-medium text-gray-700">RUT</span>
                <input required maxLength={32} value={form.rut} onChange={event => setForm({ ...form, rut: event.target.value })} className="form-input w-full" placeholder="76.123.456-7" />
                {form.rut.trim() && !isValidRut(form.rut) && <span className="mt-1 block text-[11px] text-red-600">RUT inválido.</span>}
              </label>
              <label className="block">
                <span className="mb-1.5 block text-[12.5px] font-medium text-gray-700">Teléfono responsable</span>
                <input type="tel" maxLength={40} value={form.phone} onChange={event => setForm({ ...form, phone: event.target.value })} className="form-input w-full" placeholder="+56 9 XXXX XXXX" />
              </label>
              <label className="block sm:col-span-2">
                <span className="mb-1.5 block text-[12.5px] font-medium text-gray-700">Nombre del responsable principal</span>
                <input required maxLength={160} value={form.fullName} onChange={event => setForm({ ...form, fullName: event.target.value })} className="form-input w-full" placeholder="María González" />
              </label>
              <label className="block sm:col-span-2">
                <span className="mb-1.5 block text-[12.5px] font-medium text-gray-700">Correo del responsable</span>
                <input required type="email" maxLength={320} value={form.email} onChange={event => setForm({ ...form, email: event.target.value })} className="form-input w-full" placeholder="documentos@empresa.cl" />
              </label>
            </div>

            <div className="rounded-xl border border-amber-100 bg-amber-50 p-3 text-[11.5px] leading-relaxed text-amber-900">
              El correo quedará como responsable principal del contratista. Si la cuenta no existe, Acredita enviará una invitación para crear la contraseña.
            </div>

            <div className="flex justify-end gap-3 border-t border-cream pt-4">
              <button type="button" disabled={saving} onClick={close} className="btn btn-secondary">Cancelar</button>
              <button type="submit" disabled={saving || (!!form.rut.trim() && !isValidRut(form.rut))} className="btn btn-primary disabled:opacity-60">
                <UserPlus size={15} /> {saving ? 'Creando…' : 'Crear contratista'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
