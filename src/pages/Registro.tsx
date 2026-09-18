import { useState, type FormEvent, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle, ShieldCheck } from 'lucide-react';
import { isValidRut } from '../utils/rut';
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from '../data/supabaseAuth';

export default function RegistroPage() {
  const searchParams = new URLSearchParams(window.location.search);
  const roleParam = searchParams.get('rol');
  const isAdminRequest = roleParam === 'admin';
  const requestedRole = roleParam === 'contratista' ? 'contratista' : 'mandante';
  const isContratista = requestedRole === 'contratista';

  const [form, setForm] = useState({ nombre: '', empresa: '', rut: '', industria: '', correo: '', telefono: '' });
  const [enviado, setEnviado] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const update = (field: keyof typeof form, value: string) => setForm(current => ({ ...current, [field]: value }));

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    if (!isValidRut(form.rut)) {
      setError('RUT inválido. Revisa el formato y dígito verificador.');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${SUPABASE_URL}/rest/v1/access_requests`, {
        method: 'POST',
        headers: {
          apikey: SUPABASE_PUBLISHABLE_KEY,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({
          requested_role: requestedRole,
          full_name: form.nombre.trim(),
          company_name: form.empresa.trim(),
          rut: form.rut.trim(),
          industry: form.industria || null,
          email: form.correo.trim().toLowerCase(),
          phone: form.telefono.trim() || null,
        }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.message || 'No fue posible enviar la solicitud.');
      }
      setEnviado(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible enviar la solicitud.');
    } finally {
      setLoading(false);
    }
  };

  if (isAdminRequest) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#faf9f8] p-5">
        <div className="w-full max-w-[520px] overflow-hidden rounded-2xl border border-cream3 bg-white shadow-xl">
          <div className="bg-navy px-7 py-6 text-white">
            <div className="mb-4 text-[22px] tracking-[2px]">Acre<b className="font-normal text-brown">dita</b></div>
            <div className="mb-2 flex items-center gap-2 text-[11px] uppercase tracking-[1.5px] text-white/60"><ShieldCheck size={14} /> Acceso interno</div>
            <h1 className="text-2xl font-semibold">Acceso equipo Acredita</h1>
          </div>
          <div className="p-7 text-center">
            <p className="text-[14px] leading-relaxed text-gray-600">Las cuentas del equipo Acredita se crean y habilitan internamente. Este perfil no admite solicitudes públicas de registro.</p>
            <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
              <Link to="/login?rol=admin" className="btn btn-primary justify-center">Iniciar sesión</Link>
              <Link to="/" className="btn btn-secondary justify-center">Volver al inicio</Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#faf9f8] p-5">
      <div className="w-full max-w-[560px] overflow-hidden rounded-2xl border border-cream3 bg-white shadow-xl">
        <div className="bg-navy px-7 py-6 text-white">
          <div className="mb-4 text-[22px] tracking-[2px]">Acre<b className="font-normal text-brown">dita</b></div>
          <div className="mb-2 flex items-center gap-2 text-[11px] uppercase tracking-[1.5px] text-white/60"><ShieldCheck size={14} /> Acceso controlado</div>
          <h1 className="text-2xl font-semibold">Solicitar acceso</h1>
          <p className="mt-2 text-[13px] leading-relaxed text-white/70">Las cuentas se habilitan por Acredita o mediante una invitación de proyecto. Este formulario registra una solicitud real; no crea una cuenta automática.</p>
        </div>

        {enviado ? (
          <div className="p-8 text-center" role="status" aria-live="polite">
            <CheckCircle size={54} className="mx-auto mb-4 text-emerald-600" />
            <h2 className="mb-2 text-xl font-semibold text-navy">Solicitud recibida</h2>
            <p className="mb-6 text-[13px] leading-relaxed text-gray-500">Guardamos tu solicitud para <b>{isContratista ? 'Contratista' : 'Mandante'}</b>. Acredita podrá revisarla y contactarte para habilitar el acceso correspondiente.</p>
            <div className="flex justify-center gap-3">
              <Link to="/" className="btn btn-secondary">Volver al inicio</Link>
              <Link to="/login" className="btn btn-primary">Ya tengo acceso</Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-7">
            <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2.5 text-[12px] text-blue-800">Solicitud para: <b>{isContratista ? 'Contratista' : 'Mandante'}</b></div>
            <Field label="Nombre completo"><input required value={form.nombre} onChange={event => update('nombre', event.target.value)} className="form-input w-full" placeholder="Tu nombre" /></Field>
            <Field label="Empresa o razón social"><input required value={form.empresa} onChange={event => update('empresa', event.target.value)} className="form-input w-full" placeholder="Nombre de la empresa" /></Field>
            <Field label="RUT"><input required value={form.rut} onChange={event => update('rut', event.target.value)} className="form-input w-full" placeholder="76.123.456-7" /></Field>
            <Field label={isContratista ? 'Rubro' : 'Industria'}>
              <select required value={form.industria} onChange={event => update('industria', event.target.value)} className="form-input w-full">
                <option value="">Selecciona...</option><option value="construccion">Construcción</option><option value="mineria">Minería</option><option value="energia">Energía</option><option value="transporte">Transporte / Logística</option><option value="servicios">Servicios</option><option value="otro">Otro</option>
              </select>
            </Field>
            <Field label="Correo"><input required type="email" value={form.correo} onChange={event => update('correo', event.target.value)} className="form-input w-full" placeholder="tu@empresa.cl" /></Field>
            <Field label="Teléfono"><input type="tel" value={form.telefono} onChange={event => update('telefono', event.target.value)} className="form-input w-full" placeholder="+56 9 XXXX XXXX" /></Field>
            {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-[12px] text-red-700">{error}</div>}
            <button type="submit" disabled={loading} className="btn btn-primary w-full justify-center py-2.5 disabled:opacity-60">{loading ? 'Enviando…' : 'Enviar solicitud'}</button>
            <p className="text-center text-[11.5px] leading-5 text-gray-400">Al enviar esta solicitud, tus datos se usarán para gestionar el acceso y contacto asociado. Consulta nuestro <Link to="/privacidad" className="font-medium text-brown hover:underline">Centro de privacidad</Link>.</p>
            <div className="text-center text-[12px] text-gray-500">¿Ya tienes una cuenta? <Link to="/login" className="font-semibold text-brown hover:underline">Inicia sesión</Link></div>
          </form>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block"><span className="mb-1.5 block text-[12.5px] font-medium text-gray-700">{label}</span>{children}</label>;
}
