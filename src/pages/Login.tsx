import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bell, Clock, ShieldCheck } from 'lucide-react';
import { loginWithSupabase } from '../data/supabaseAuth';

export default function LoginPage() {
  const navigate = useNavigate();
  const searchParams = new URLSearchParams(window.location.search);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrorMsg('');
    setLoading(true);
    try {
      const session = await loginWithSupabase(email, password);
      const home = session.role === 'admin' ? '/admin' : session.role === 'mandante' ? '/mandante' : '/contratista';
      const requestedNext = searchParams.get('next');
      const nextIsAllowed = requestedNext?.startsWith(`${home}/`) || requestedNext === home;
      navigate(nextIsAllowed && requestedNext ? requestedNext : home, { replace: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No fue posible iniciar sesión';
      setErrorMsg(message === 'Invalid login credentials' ? 'Correo o contraseña incorrectos' : message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <div className="grid min-h-screen md:grid-cols-2">
        <aside className="hidden flex-col justify-between bg-brown p-10 text-cream md:flex lg:p-12">
          <div>
            <div className="mb-12 text-[24px] tracking-[2px]">Acre<b className="font-normal text-navy">dita</b></div>
            <h1 className="mb-6 text-[36px] font-medium leading-[1.2] lg:text-[42px]">Simplifica tu<br />cumplimiento documental</h1>
            <p className="mb-12 max-w-[420px] text-[16px] leading-relaxed text-white/80 lg:text-[17px]">
              Centraliza la acreditación documental entre mandantes, contratistas y trabajadores.
            </p>
            <div className="flex max-w-[440px] flex-col gap-6">
              <Feature icon={<ShieldCheck size={20} />} title="Acceso protegido">Cada cuenta accede únicamente a la información autorizada para su rol.</Feature>
              <Feature icon={<Bell size={20} />} title="Alertas automáticas">Recibe avisos preventivos antes de que los documentos críticos venzan.</Feature>
              <Feature icon={<Clock size={20} />} title="Operación centralizada">Requisitos, revisiones, trabajadores y seguimiento en un mismo lugar.</Feature>
            </div>
          </div>
          <div className="text-[13px] text-white/50">© 2026 Acredita</div>
        </aside>

        <main className="flex items-center justify-center bg-white px-5 py-8 sm:p-8">
          <div className="w-full max-w-[400px]">
            <div className="mb-8 text-center md:hidden">
              <div className="text-[28px] font-medium tracking-[2px] text-navy">Acre<b className="font-normal text-brown">dita</b></div>
            </div>

            <div className="mb-7 text-center">
              <h2 className="mb-2 text-[28px] font-semibold text-navy">Iniciar sesión</h2>
              <p className="text-[14px] leading-relaxed text-gray-500">Ingresa con tu cuenta. Acredita detectará automáticamente tu organización, perfil y permisos.</p>
            </div>

            <form onSubmit={handleLogin} className="flex flex-col gap-4">
              <label className="block" htmlFor="login-email">
                <span className="mb-1.5 block text-[13px] font-medium text-gray-700">Correo electrónico</span>
                <input
                  id="login-email"
                  type="email"
                  value={email}
                  onChange={event => setEmail(event.target.value)}
                  className="form-input w-full p-2.5"
                  placeholder="tu@empresa.cl"
                  autoComplete="email"
                  required
                />
              </label>

              <div>
                <div className="mb-1.5 flex items-center justify-between gap-3">
                  <label htmlFor="login-password" className="text-[13px] font-medium text-gray-700">Contraseña</label>
                  <Link to={`/recuperar${email ? `?email=${encodeURIComponent(email)}` : ''}`} className="text-[12px] font-semibold text-brown hover:underline">¿Olvidaste tu contraseña?</Link>
                </div>
                <input
                  id="login-password"
                  type="password"
                  value={password}
                  onChange={event => setPassword(event.target.value)}
                  className="form-input w-full p-2.5"
                  placeholder="••••••••"
                  autoComplete="current-password"
                  required
                />
              </div>

              {errorMsg && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-center text-[13px] font-medium text-[#c03030]">{errorMsg}</div>}

              <button type="submit" disabled={loading} className="btn btn-primary w-full justify-center py-2.5 text-[15px] disabled:cursor-not-allowed disabled:opacity-60">
                {loading ? 'Verificando…' : 'Ingresar'}
              </button>
            </form>

            <div className="mt-6 rounded-xl border border-cream3 bg-cream2/55 px-4 py-3.5 text-center">
              <div className="text-[12px] font-semibold text-navy">¿Necesitas acceso?</div>
              <div className="mt-2 flex items-center justify-center gap-3 text-[12px]">
                <Link to="/registro?rol=mandante" className="font-semibold text-brown hover:underline">Soy Mandante</Link>
                <span className="text-gray-300">•</span>
                <Link to="/registro?rol=contratista" className="font-semibold text-brown hover:underline">Soy Contratista</Link>
              </div>
              <p className="mt-2 text-[11px] leading-relaxed text-gray-500">Las cuentas del equipo Acredita se habilitan internamente.</p>
            </div>

            <div className="mt-5 text-center text-[11.5px] text-gray-400">
              ¿Tienes una solicitud sobre tus datos personales? <Link to="/privacidad" className="font-semibold text-brown hover:underline">Centro de privacidad</Link>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

function Feature({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-4">
      <div className="shrink-0 rounded-lg bg-white/10 p-2.5">{icon}</div>
      <div>
        <div className="mb-1 text-[15px] font-semibold">{title}</div>
        <div className="text-[14px] text-white/70">{children}</div>
      </div>
    </div>
  );
}
