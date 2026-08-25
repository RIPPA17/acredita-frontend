import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle, ShieldCheck } from 'lucide-react';
import { isValidRut } from '../utils/rut';
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from '../data/supabaseAuth';

export default function RegistroPage() {
  const searchParams = new URLSearchParams(window.location.search);
  const requestedRole = searchParams.get('rol') === 'contratista' ? 'contratista' : 'mandante';
  const isContratista = requestedRole === 'contratista';

  const [form, setForm] = useState({
    nombre: '',
    empresa: '',
    rut: '',
    industria: '',
    correo: '',
    telefono: '',
  });
  const [enviado, setEnviado] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const update = (field: keyof typeof form, value: string) => setForm(current => ({ ...current, [field]: value }));

  const handleSubmit = async (event: React.FormEvent) => {
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
          status: 'pending',
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

  return (
    <div className="min-h-screen bg-[#faf9f8] flex items-center justify-center p-5">
      <div className="w-full max-w-[560px] bg-white rounded-2xl border border-cream3 shadow-xl overflow-hidden">
        <div className="bg-navy px-7 py-6 text-white">
          <div className="text-[22px] tracking-[2px] mb-4">Acre<b className="text-brown font-normal">dita</b></div>
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[1.5px] text-white/60 mb-2"><ShieldCheck size={14} /> Acceso controlado</div>
          <h1 className="text-2xl font-semibold">Solicitar acceso</h1>
          <p className="text-[13px] text-white/70 mt-2 leading-relaxed">Las cuentas se habilitan por Acredita o mediante una invitación de proyecto. Este formulario registra una solicitud real; no crea una cuenta automática.</p>
        </div>

        {enviado ? (
          <div className="p-8 text-center">
            <CheckCircle size={54} className="mx-auto text-emerald-600 mb-4" />
            <h2 className="text-xl font-semibold text-navy mb-2">Solicitud recibida</h2>
            <p className="text-[13px] text-gray-500 leading-relaxed mb-6">Guardamos tu solicitud para <b>{isContratista ? 'Contratista' : 'Mandante'}</b>. Acredita podrá revisarla y contactarte para habilitar el acceso correspondiente.</p>
            <div className="flex gap-3 justify-center">
              <Link to="/" className="btn btn-secondary">Volver al inicio</Link>
              <Link to="/login" className="btn btn-primary">Ya tengo acceso</Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-7 flex flex-col gap-4">
            <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2.5 text-[12px] text-blue-800">
              Solicitud para: <b>{isContratista ? 'Contratista' : 'Mandante'}</b>
            </div>

            <Field label="Nombre completo">
              <input required value={form.nombre} onChange={event => update('nombre', event.target.value)} className="form-input w-full" placeholder="Tu nombre" />
            </Field>
            <Field label="Empresa o razón social">
              <input required value={form.empresa} onChange={event => update('empresa', event.target.value)} className="form-input w-full" placeholder="Nombre de la empresa" />
            </Field>
            <Field label="RUT">
              <input required value={form.rut} onChange={event => update('rut', event.target.value)} className="form-input w-full" placeholder="76.123.456-7" />
            </Field>
            <Field label={isContratista ? 'Rubro' : 'Industria'}>
              <select required value={form.industria} onChange={event => update('industria', event.target.value)} className="form-input w-full">
                <option value="">Selecciona...</option>
                <option value="construccion">Construcción</option>
                <option value="mineria">Minería</option>
                <option value="energia">Energía</option>
                <option value="transporte">Transporte / Logística</option>
                <option value="servicios">Servicios</option>
                <option value="otro">Otro</option>
              </select>
            </Field>
            <Field label="Correo">
              <input required type="email" value={form.correo} onChange={event => update('correo', event.target.value)} className="form-input w-full" placeholder="tu@empresa.cl" />
            </Field>
            <Field label="Teléfono">
              <input type="tel" value={form.telefono} onChange={event => update('telefono', event.target.value)} className="form-input w-full" placeholder="+56 9 XXXX XXXX" />
            </Field>

            {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-[12px] text-red-700">{error}</div>}

            <button type="submit" disabled={loading} className="btn btn-primary w-full justify-center py-2.5 disabled:opacity-60">
              {loading ? 'Enviando…' : 'Enviar solicitud'}
            </button>
            <div className="text-center text-[12px] text-gray-500">¿Ya tienes una cuenta? <Link to="/login" className="text-brown font-semibold hover:underline">Inicia sesión</Link></div>
          </form>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[12.5px] font-medium text-gray-700 mb-1.5">{label}</span>
      {children}
    </label>
  );
}
