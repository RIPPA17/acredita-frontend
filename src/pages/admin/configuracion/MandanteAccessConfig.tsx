import { useEffect, useState, type FormEvent } from 'react';
import { Building2, MailPlus, RefreshCw, ShieldCheck } from 'lucide-react';
import {
  inviteMandanteUser,
  listMandantesForAccess,
  type MandanteAccessOption,
} from '../../../data/supabaseMandanteAccess';

export default function MandanteAccessConfig({
  showToast,
}: {
  showToast: (msg: string, type?: 'success' | 'error' | 'warning') => void;
}) {
  const [mandantes, setMandantes] = useState<MandanteAccessOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<string | null>(null);
  const [form, setForm] = useState({ mandanteId: '', fullName: '', email: '' });

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await listMandantesForAccess();
      setMandantes(rows);
      setForm(current => ({ ...current, mandanteId: current.mandanteId || rows[0]?.id || '' }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible cargar los Mandantes.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (saving || !form.mandanteId || !form.fullName.trim() || !form.email.trim()) return;
    setSaving(true);
    setLastResult(null);
    try {
      const result = await inviteMandanteUser(form);
      const message = result.invited
        ? `Invitación enviada a ${result.email} para ${result.mandante}.`
        : `${result.email} ya tenía una cuenta; el acceso a ${result.mandante} quedó habilitado.`;
      setLastResult(message);
      setForm(current => ({ ...current, fullName: '', email: '' }));
      showToast(message);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'No fue posible otorgar el acceso.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-[16px] font-semibold text-navy">Accesos Mandante</h3>
          <p className="mt-1 max-w-[720px] text-[12.5px] leading-relaxed text-gray-500">
            Invita a la persona administradora de una organización Mandante. Acredita crea o reutiliza su cuenta, asigna la membresía correcta y envía el correo de acceso cuando corresponde.
          </p>
        </div>
        <button type="button" onClick={() => void load()} className="btn btn-secondary shrink-0" disabled={loading}>
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />Actualizar
        </button>
      </div>

      <div className="flex gap-2 rounded-xl border border-blue-100 bg-blue-50 p-3 text-[12px] leading-relaxed text-blue-800">
        <ShieldCheck size={17} className="mt-0.5 shrink-0" />
        <span>Solo el equipo Acredita puede ejecutar esta acción. El backend rechaza cuentas asociadas a roles incompatibles para evitar que una misma sesión mezcle organizaciones o portales.</span>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-[12.5px] text-red-700">{error}</div>
      ) : loading ? (
        <div className="py-14 text-center text-[13px] text-gray-400">Cargando organizaciones…</div>
      ) : mandantes.length === 0 ? (
        <div className="rounded-xl border border-dashed border-cream3 bg-cream2/60 py-12 text-center text-[13px] text-gray-500">
          Primero crea una organización Mandante desde la sección Mandantes.
        </div>
      ) : (
        <form onSubmit={submit} className="rounded-xl border border-cream3 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2"><Building2 size={18} className="text-brown" /><div><strong className="block text-[14px] text-navy">Invitar administrador Mandante</strong><span className="text-[11.5px] text-gray-500">La persona recibirá acceso al portal Mandante de la organización seleccionada.</span></div></div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="sm:col-span-2 text-[12.5px] font-medium text-gray-700">Organización
              <select required value={form.mandanteId} onChange={event => setForm({ ...form, mandanteId: event.target.value })} className="form-input mt-1 w-full p-2.5 border rounded-lg">
                {mandantes.map(item => <option key={item.id} value={item.id}>{item.name}{item.rut ? ` · ${item.rut}` : ''}</option>)}
              </select>
            </label>
            <label className="text-[12.5px] font-medium text-gray-700">Nombre de la persona
              <input required minLength={2} maxLength={160} value={form.fullName} onChange={event => setForm({ ...form, fullName: event.target.value })} className="form-input mt-1 w-full p-2.5 border rounded-lg" placeholder="Nombre y apellido" />
            </label>
            <label className="text-[12.5px] font-medium text-gray-700">Correo
              <input required type="email" value={form.email} onChange={event => setForm({ ...form, email: event.target.value })} className="form-input mt-1 w-full p-2.5 border rounded-lg" placeholder="persona@empresa.cl" />
            </label>
          </div>
          {lastResult && <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-[12px] text-emerald-800">{lastResult}</div>}
          <div className="mt-4 flex justify-end">
            <button type="submit" className="btn btn-primary" disabled={saving}><MailPlus size={14} />{saving ? 'Otorgando acceso…' : 'Invitar y otorgar acceso'}</button>
          </div>
        </form>
      )}
    </div>
  );
}
