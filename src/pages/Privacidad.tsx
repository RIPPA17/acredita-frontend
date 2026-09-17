import { FormEvent, useState } from 'react';
import { ArrowLeft, CheckCircle2, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from '../data/supabaseAuth';

type RequestType = 'access' | 'rectification' | 'deletion' | 'opposition' | 'portability' | 'blocking';

const REQUEST_OPTIONS: Array<{ value: RequestType; label: string }> = [
  { value: 'access', label: 'Acceso a mis datos' },
  { value: 'rectification', label: 'Rectificación de mis datos' },
  { value: 'deletion', label: 'Supresión de mis datos' },
  { value: 'opposition', label: 'Oposición a un tratamiento' },
  { value: 'portability', label: 'Portabilidad de mis datos' },
  { value: 'blocking', label: 'Bloqueo temporal del tratamiento' },
];

export default function PrivacidadPage() {
  const [form, setForm] = useState({
    name: '',
    email: '',
    requestType: 'access' as RequestType,
    scope: '',
    details: '',
    temporaryBlock: false,
  });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (sending) return;
    setSending(true);
    setError('');

    try {
      const response = await fetch(`${SUPABASE_URL}/rest/v1/privacy_requests`, {
        method: 'POST',
        headers: {
          apikey: SUPABASE_PUBLISHABLE_KEY,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({
          request_type: form.requestType,
          requester_name: form.name.trim(),
          requester_email: form.email.trim().toLowerCase(),
          contact_channel: 'web',
          scope: form.scope.trim(),
          details: form.details.trim() || null,
          source: 'web',
          temporary_block_requested: form.temporaryBlock,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.message || 'No fue posible registrar la solicitud.');
      }

      setSent(true);
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : 'No fue posible registrar la solicitud.');
    } finally {
      setSending(false);
    }
  };

  return (
    <main className="min-h-screen bg-cream2 text-navy">
      <header className="bg-navy px-5 py-4 text-cream md:px-10">
        <div className="mx-auto flex max-w-[1050px] items-center justify-between">
          <Link to="/" className="text-[23px] tracking-[2px]">Acre<span className="text-brown">dita</span></Link>
          <Link to="/" className="flex items-center gap-2 text-sm text-cream/80 hover:text-cream"><ArrowLeft size={16} /> Volver</Link>
        </div>
      </header>

      <div className="mx-auto max-w-[1050px] px-5 py-12 md:px-10 md:py-16">
        <section className="mb-10 max-w-[760px]">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-brown/10 px-3 py-1.5 text-sm font-medium text-brown">
            <ShieldCheck size={16} /> Centro de privacidad
          </div>
          <h1 className="mb-4 text-[34px] font-semibold leading-tight md:text-[44px]">Tus datos, tus derechos y un canal directo para ejercerlos.</h1>
          <p className="text-[16px] leading-7 text-gray-600">
            Acredita está preparando su operación para el marco chileno de protección de datos que entra en vigencia el 1 de diciembre de 2026. Este canal permite registrar solicitudes relacionadas con tus datos personales y mantener trazabilidad de su gestión.
          </p>
        </section>

        <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
          <section className="rounded-2xl border border-cream3 bg-white p-6 shadow-sm md:p-8">
            <h2 className="mb-4 text-xl font-semibold">Cómo funciona</h2>
            <div className="space-y-4 text-sm leading-6 text-gray-600">
              <p><strong className="text-navy">1. Registra tu solicitud.</strong> No pedimos tu RUT completo en este formulario. Si necesitamos verificar tu identidad, lo haremos por un canal separado.</p>
              <p><strong className="text-navy">2. Acusamos recibo y verificamos identidad.</strong> La solicitud queda registrada con fecha, tipo y estado.</p>
              <p><strong className="text-navy">3. Revisamos el tratamiento correspondiente.</strong> El plazo general previsto por la Ley 21.719 es de hasta 30 días corridos, con una posible prórroga única de hasta 30 días.</p>
              <p><strong className="text-navy">4. Bloqueo temporal.</strong> Cuando corresponda, puedes solicitar la suspensión temporal del tratamiento. Las solicitudes fundadas de bloqueo temporal tienen un plazo legal de respuesta de dos días hábiles.</p>
            </div>

            <div className="mt-7 rounded-xl bg-cream2 p-4 text-sm leading-6 text-gray-600">
              <strong className="block text-navy">Canal de privacidad disponible</strong>
              Utiliza este formulario web. El correo específico de privacidad se publicará antes del go-live comercial.
            </div>
          </section>

          <section className="rounded-2xl border border-cream3 bg-white p-6 shadow-sm md:p-8">
            {sent ? (
              <div className="flex min-h-[420px] flex-col items-center justify-center text-center" role="status" aria-live="polite">
                <CheckCircle2 size={52} className="mb-5 text-green-600" aria-hidden="true" />
                <h2 className="mb-3 text-2xl font-semibold">Solicitud registrada</h2>
                <p className="max-w-[460px] text-sm leading-6 text-gray-600">Tu solicitud quedó registrada en Acredita. Conserva el correo que indicaste: será el canal principal para verificar identidad y comunicar la respuesta.</p>
                <button type="button" onClick={() => { setSent(false); setForm({ name: '', email: '', requestType: 'access', scope: '', details: '', temporaryBlock: false }); }} className="btn btn-primary mt-7">Registrar otra solicitud</button>
              </div>
            ) : (
              <form onSubmit={handleSubmit}>
                <h2 className="mb-6 text-xl font-semibold">Ejercer un derecho</h2>

                <label htmlFor="privacy-name" className="mb-1.5 block text-sm font-medium">Nombre completo</label>
                <input id="privacy-name" name="name" autoComplete="name" required maxLength={200} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="form-input mb-5 w-full rounded-lg border border-cream3 p-3" />

                <label htmlFor="privacy-email" className="mb-1.5 block text-sm font-medium">Correo de contacto</label>
                <input id="privacy-email" name="email" autoComplete="email" required type="email" maxLength={320} value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="form-input mb-5 w-full rounded-lg border border-cream3 p-3" />

                <label htmlFor="privacy-request-type" className="mb-1.5 block text-sm font-medium">Tipo de solicitud</label>
                <select id="privacy-request-type" name="requestType" value={form.requestType} onChange={e => setForm({ ...form, requestType: e.target.value as RequestType })} className="form-input mb-5 w-full rounded-lg border border-cream3 p-3">
                  {REQUEST_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>

                <label htmlFor="privacy-scope" className="mb-1.5 block text-sm font-medium">¿Qué datos o tratamiento quieres identificar?</label>
                <textarea id="privacy-scope" name="scope" required maxLength={1500} rows={3} value={form.scope} onChange={e => setForm({ ...form, scope: e.target.value })} className="form-input mb-5 w-full resize-none rounded-lg border border-cream3 p-3" placeholder="Ej.: datos de mi acreditación como trabajador en el proyecto…" />

                <label htmlFor="privacy-details" className="mb-1.5 block text-sm font-medium">Antecedentes adicionales <span className="font-normal text-gray-400">(opcional)</span></label>
                <textarea id="privacy-details" name="details" maxLength={5000} rows={4} value={form.details} onChange={e => setForm({ ...form, details: e.target.value })} className="form-input mb-5 w-full resize-none rounded-lg border border-cream3 p-3" />

                {['rectification', 'deletion', 'opposition'].includes(form.requestType) && (
                  <label htmlFor="privacy-temporary-block" className="mb-6 flex items-start gap-3 rounded-xl bg-cream2 p-4 text-sm leading-5 text-gray-700">
                    <input id="privacy-temporary-block" name="temporaryBlock" type="checkbox" checked={form.temporaryBlock} onChange={e => setForm({ ...form, temporaryBlock: e.target.checked })} className="mt-0.5" />
                    <span><strong className="block text-navy">Solicitar bloqueo temporal</strong>Suspender temporalmente el tratamiento de los datos involucrados mientras se resuelve la solicitud, cuando legalmente corresponda.</span>
                  </label>
                )}

                {error && <div className="mb-5 rounded-lg bg-red-50 p-3 text-sm text-red-700" role="alert" aria-live="assertive">{error}</div>}

                <button type="submit" disabled={sending} className="btn btn-primary w-full justify-center py-3 disabled:cursor-wait disabled:opacity-60">{sending ? 'Registrando…' : 'Registrar solicitud'}</button>
                <p className="mt-4 text-xs leading-5 text-gray-400">No incluyas contraseñas, claves, datos bancarios completos ni información médica que no sea estrictamente necesaria para identificar tu solicitud.</p>
              </form>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
