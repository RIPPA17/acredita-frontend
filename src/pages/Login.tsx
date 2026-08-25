import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ShieldCheck, Bell, Clock } from 'lucide-react';
import { loginWithSupabase } from '../data/supabaseAuth';

export default function LoginPage() {
  const navigate = useNavigate();
  const searchParams = new URLSearchParams(window.location.search);
  const [rol, setRol] = useState<'mandante' | 'contratista' | 'admin'>(() => {
    const val = searchParams.get('rol');
    if (val === 'admin' || val === 'contratista' || val === 'mandante') return val;
    return 'mandante';
  });
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
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
      setErrorMsg(message === 'Invalid login credentials'
        ? 'Email o contraseña incorrectos'
        : message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <div className="grid md:grid-cols-2 min-h-screen">
        <div className="hidden md:flex bg-brown text-cream p-12 flex-col justify-between">
          <div>
            <div className="text-[24.2px] tracking-[2px] mb-12">Acre<b className="text-navy font-normal">dita</b></div>
            <h1 className="text-[41.8px] font-medium leading-[1.2] mb-6">
              Simplifica tu<br />cumplimiento laboral
            </h1>
            <p className="text-white/80 text-[17.6px] leading-relaxed max-w-[400px] mb-12">
              La plataforma más rápida y segura para la gestión de documentos entre mandantes y contratistas en Chile.
            </p>

            <div className="flex flex-col gap-6">
              <div className="flex items-start gap-4">
                <div className="bg-white/10 p-2.5 rounded-lg shrink-0">
                  <ShieldCheck size={20} className="text-cream" />
                </div>
                <div>
                  <div className="font-semibold text-[15.4px] mb-1">Acceso protegido</div>
                  <div className="text-white/70 text-[14.3px]">Cada cuenta accede únicamente a la información autorizada para su rol.</div>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="bg-white/10 p-2.5 rounded-lg shrink-0">
                  <Bell size={20} className="text-cream" />
                </div>
                <div>
                  <div className="font-semibold text-[15.4px] mb-1">Alertas automáticas</div>
                  <div className="text-white/70 text-[14.3px]">Avisos preventivos antes de que venza cualquier documento.</div>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="bg-white/10 p-2.5 rounded-lg shrink-0">
                  <Clock size={20} className="text-cream" />
                </div>
                <div>
                  <div className="font-semibold text-[15.4px] mb-1">Ahorro de tiempo</div>
                  <div className="text-white/70 text-[14.3px]">Centraliza la acreditación y evita perseguir documentación manualmente.</div>
                </div>
              </div>
            </div>
          </div>

          <div className="text-[13.2px] text-white/50">
            © 2026 Acredita SpA
          </div>
        </div>

        <div className="flex items-center justify-center p-8 bg-white">
          <div className="w-full max-w-[400px]">
            <div className="md:hidden text-center mb-10">
              <div className="text-[28px] text-navy tracking-[2px] font-medium">Acre<b className="text-brown font-normal">dita</b></div>
            </div>

            <div className="text-center mb-6">
              <h2 className="text-[28px] text-navy font-semibold mb-2">Iniciar sesión</h2>
              <p className="text-gray-500 text-[14.3px]">Ingresa con tu cuenta Acredita. El sistema detectará tu rol automáticamente.</p>
            </div>

            <div className="flex border-b border-cream3 mb-6">
              <button
                type="button"
                onClick={() => { setRol('mandante'); window.history.replaceState(null, '', '?rol=mandante'); }}
                className={`flex-1 pb-2.5 text-[13.5px] font-semibold transition-colors border-b-2 text-center ${rol === 'mandante' ? 'border-brown text-brown font-bold' : 'border-transparent text-gray-400 hover:text-navy'}`}
              >
                Mandante
              </button>
              <button
                type="button"
                onClick={() => { setRol('contratista'); window.history.replaceState(null, '', '?rol=contratista'); }}
                className={`flex-1 pb-2.5 text-[13.5px] font-semibold transition-colors border-b-2 text-center ${rol === 'contratista' ? 'border-navy text-navy font-bold' : 'border-transparent text-gray-400 hover:text-navy'}`}
              >
                Contratista
              </button>
              <button
                type="button"
                onClick={() => { setRol('admin'); window.history.replaceState(null, '', '?rol=admin'); }}
                className={`flex-1 pb-2.5 text-[13.5px] font-semibold transition-colors border-b-2 text-center ${rol === 'admin' ? 'border-[#ff7a00] text-[#ff7a00] font-bold' : 'border-transparent text-gray-400 hover:text-navy'}`}
              >
                Acredita
              </button>
            </div>

            <form onSubmit={handleLogin} className="flex flex-col gap-4">
              <div>
                <label htmlFor="login-email" className="block text-[13.2px] font-medium text-gray-700 mb-1.5">Email</label>
                <input
                  id="login-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="form-input w-full p-2.5 border border-cream3 rounded-lg focus:border-brown focus:ring-1 focus:ring-brown outline-none transition-all"
                  placeholder="tu@empresa.cl"
                  autoComplete="email"
                  required
                />
              </div>
              <div>
                <label htmlFor="login-password" className="block text-[13.2px] font-medium text-gray-700 mb-1.5">Contraseña</label>
                <input
                  id="login-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="form-input w-full p-2.5 border border-cream3 rounded-lg focus:border-brown focus:ring-1 focus:ring-brown outline-none transition-all"
                  placeholder="••••••••"
                  autoComplete="current-password"
                  required
                />
              </div>

              {errorMsg && (
                <div className="text-[#c03030] text-[13px] font-medium text-center bg-red-50 border border-red-200 rounded-lg p-2.5" role="alert">
                  {errorMsg}
                </div>
              )}

              <button type="submit" disabled={loading} className="btn btn-primary w-full justify-center py-2.5 text-[15.4px] disabled:opacity-60 disabled:cursor-not-allowed">
                {loading ? 'Verificando…' : 'Ingresar'}
              </button>
            </form>

            <div className="mt-6 text-center text-[13.2px] text-gray-500">
              ¿No tienes una cuenta? <Link to={`/registro?rol=${rol}`} className="text-brown font-medium hover:underline">Solicita acceso</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
