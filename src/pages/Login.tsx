import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ShieldCheck, Bell, Clock } from 'lucide-react';

export default function LoginPage() {
  const navigate = useNavigate();
  const searchParams = new URLSearchParams(window.location.search);
  const initialRol = searchParams.get('rol') || 'mandante';
  const [rol, setRol] = useState(initialRol);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const isMandante = rol === 'mandante';

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (email.toLowerCase().includes('mandante')) {
      navigate('/mandante');
    } else {
      navigate('/contratista');
    }
  };

  const switchRol = () => {
    setRol(isMandante ? 'contratista' : 'mandante');
    window.history.replaceState(null, '', `?rol=${isMandante ? 'contratista' : 'mandante'}`);
  };

  return (
    <div className="min-h-screen bg-white">
      <div className="grid md:grid-cols-2 min-h-screen">
        {/* Left Column (Hidden on Mobile) */}
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
                  <div className="font-semibold text-[15.4px] mb-1">Cero multas</div>
                  <div className="text-white/70 text-[14.3px]">Mitiga la responsabilidad solidaria con control automático.</div>
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
                  <div className="text-white/70 text-[14.3px]">Elimina las planillas Excel y horas persiguiendo papeles.</div>
                </div>
              </div>
            </div>
          </div>
          
          <div className="text-[13.2px] text-white/50">
            © 2026 Acredita SpA
          </div>
        </div>

        {/* Right Column (Form) */}
        <div className="flex items-center justify-center p-8 bg-white">
          <div className="w-full max-w-[400px]">
            {/* Mobile Logo */}
            <div className="md:hidden text-center mb-10">
              <div className="text-[28px] text-navy tracking-[2px] font-medium">Acre<b className="text-brown font-normal">dita</b></div>
            </div>

            <div className="text-center mb-8">
              <span className={`badge mb-4 ${isMandante ? 'b-brown' : 'b-blue'}`}>
                {isMandante ? 'Acceso Mandante' : 'Acceso Contratista'}
              </span>
              <h2 className="text-[28px] text-navy font-semibold mb-2">Iniciar sesión</h2>
              <p className="text-gray-500 text-[14.3px]">Ingresa tus credenciales para continuar</p>
            </div>

            <form onSubmit={handleLogin} className="flex flex-col gap-4">
              <div>
                <label className="block text-[13.2px] font-medium text-gray-700 mb-1.5">Email</label>
                <input 
                  type="email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="form-input w-full p-2.5 border border-cream3 rounded-lg focus:border-brown focus:ring-1 focus:ring-brown outline-none transition-all" 
                  placeholder="tu@empresa.cl" 
                  required 
                />
              </div>
              <div>
                <label className="block text-[13.2px] font-medium text-gray-700 mb-1.5">Contraseña</label>
                <input 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="form-input w-full p-2.5 border border-cream3 rounded-lg focus:border-brown focus:ring-1 focus:ring-brown outline-none transition-all" 
                  placeholder="••••••••" 
                  required 
                />
              </div>
              
              <div className="flex justify-end mb-2">
                <a href="#" className="text-[13.2px] text-brown font-medium hover:underline">¿Olvidaste tu contraseña?</a>
              </div>

              <button type="submit" className="btn btn-primary w-full justify-center py-2.5 text-[15.4px]">
                Ingresar
              </button>
            </form>

            <div className="mt-8 text-center text-[14.3px]">
              <button 
                onClick={switchRol}
                className="text-gray-500 hover:text-navy transition-colors"
              >
                ¿Eres {isMandante ? 'contratista' : 'mandante'}? <span className="font-medium underline">Cambiar rol</span>
              </button>
            </div>
            
            <div className="mt-8 text-center text-[13.2px] text-gray-500">
              ¿No tienes una cuenta? <Link to={`/registro?rol=${rol}`} className="text-brown font-medium hover:underline">Regístrate gratis</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
