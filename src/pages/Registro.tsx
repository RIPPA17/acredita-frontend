import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ShieldCheck, Bell, Clock, CheckCircle } from 'lucide-react';
import { isValidRut } from '../utils/rut';

export default function RegistroPage() {
  const navigate = useNavigate();
  const searchParams = new URLSearchParams(window.location.search);
  const rol = searchParams.get('rol') || 'mandante';
  const isContratista = rol === 'contratista';

  const [enviado, setEnviado] = useState(false);
  
  const [nombre, setNombre] = useState('');
  const [empresa, setEmpresa] = useState('');
  const [rut, setRut] = useState('');
  const [industria, setIndustria] = useState('');
  const [correo, setCorreo] = useState('');
  const [telefono, setTelefono] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [errorPassword, setErrorPassword] = useState(false);
  const [errorRut, setErrorRut] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidRut(rut)) {
      setErrorRut(true);
      return;
    }
    setErrorRut(false);
    if (password !== confirmPassword) {
      setErrorPassword(true);
      return;
    }
    setErrorPassword(false);
    setEnviado(true);
  };

  return (
    <div className="min-h-screen bg-white">
      <div className="grid md:grid-cols-2 min-h-screen">
        {/* Left Column (Hidden on Mobile) */}
        <div className="hidden md:flex bg-navy text-cream p-12 flex-col justify-between">
          <div>
            <div className="text-[24.2px] tracking-[2px] mb-12 text-white">Acre<b className="text-cream font-normal">dita</b></div>
            <h1 className="text-[41.8px] font-medium leading-[1.2] mb-6 text-white">
              {isContratista ? (
                <>Acredita tu empresa y<br />trabaja sin interrupciones</>
              ) : (
                <>Gestiona el cumplimiento<br />de todos tus contratistas</>
              )}
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
                  <div className="font-semibold text-white text-[15.4px] mb-1">Cero multas</div>
                  <div className="text-white/70 text-[14.3px]">Mitiga la responsabilidad solidaria con control automático.</div>
                </div>
              </div>
              
              <div className="flex items-start gap-4">
                <div className="bg-white/10 p-2.5 rounded-lg shrink-0">
                  <Bell size={20} className="text-cream" />
                </div>
                <div>
                  <div className="font-semibold text-white text-[15.4px] mb-1">Alertas automáticas</div>
                  <div className="text-white/70 text-[14.3px]">Avisos preventivos antes de que venza cualquier documento.</div>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="bg-white/10 p-2.5 rounded-lg shrink-0">
                  <Clock size={20} className="text-cream" />
                </div>
                <div>
                  <div className="font-semibold text-white text-[15.4px] mb-1">Ahorro de tiempo</div>
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

            {enviado ? (
              <div className="text-center">
                <CheckCircle size={64} className="mx-auto text-green-500 mb-6" />
                {isContratista ? (
                  <>
                    <h2 className="text-[28px] text-navy font-semibold mb-4">¡Ya casi estás!</h2>
                    <p className="text-gray-600 mb-8 leading-relaxed">
                      Tu cuenta fue creada. Cuando un mandante te invite a un proyecto, recibirás un correo con los pasos a seguir.
                    </p>
                    <button 
                      onClick={() => navigate('/contratista')}
                      className="btn btn-primary w-full justify-center py-3 text-[15.4px]"
                    >
                      Ver mi panel
                    </button>
                  </>
                ) : (
                  <>
                    <h2 className="text-[28px] text-navy font-semibold mb-4">¡Cuenta creada!</h2>
                    <p className="text-gray-600 mb-8 leading-relaxed">
                      Un ejecutivo de Acredita te contactará en las próximas 24 horas hábiles para activar tu acceso completo.
                    </p>
                    <button 
                      onClick={() => navigate('/mandante')}
                      className="btn btn-primary w-full justify-center py-3 text-[15.4px]"
                    >
                      Explorar la plataforma
                    </button>
                  </>
                )}
              </div>
            ) : (
              <>
                <div className="text-center mb-8">
                  <h2 className="text-[28px] text-navy font-semibold mb-2">Crear cuenta</h2>
                  <p className="text-gray-500 text-[14.3px]">Completa tus datos para comenzar</p>
                </div>

                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                  <div>
                    <label className="block text-[13.2px] font-medium text-gray-700 mb-1.5">Nombre completo</label>
                    <input 
                      type="text" 
                      value={nombre}
                      onChange={(e) => setNombre(e.target.value)}
                      className="form-input w-full p-2.5 border border-cream3 rounded-lg focus:border-brown focus:ring-1 focus:ring-brown outline-none transition-all" 
                      placeholder="Tu nombre" 
                      required 
                    />
                  </div>
                  <div>
                    <label className="block text-[13.2px] font-medium text-gray-700 mb-1.5">{isContratista ? 'RUT personal' : 'RUT empresa'}</label>
                    <input 
                      type="text" 
                      value={rut}
                      onChange={(e) => setRut(e.target.value)}
                      className="form-input w-full p-2.5 border border-cream3 rounded-lg focus:border-brown focus:ring-1 focus:ring-brown outline-none transition-all" 
                      placeholder={isContratista ? "12.345.678-9" : "76.123.456-7"}
                      required
                    />
                    {errorRut && (
                      <div className="text-red-500 text-xs mt-1">RUT inválido, revisa el formato y dígito verificador</div>
                    )}
                  </div>
                  <div>
                    <label className="block text-[13.2px] font-medium text-gray-700 mb-1.5">{isContratista ? 'Empresa o razón social' : 'Empresa'}</label>
                    <input 
                      type="text" 
                      value={empresa}
                      onChange={(e) => setEmpresa(e.target.value)}
                      className="form-input w-full p-2.5 border border-cream3 rounded-lg focus:border-brown focus:ring-1 focus:ring-brown outline-none transition-all" 
                      placeholder={isContratista ? "Nombre de la empresa o razón social" : "Nombre de tu empresa"} 
                      required 
                    />
                  </div>
                  {isContratista ? (
                    <div>
                      <label className="block text-[13.2px] font-medium text-gray-700 mb-1.5">Rubro</label>
                      <select 
                        value={industria}
                        onChange={(e) => setIndustria(e.target.value)}
                        className="form-input w-full p-2.5 border border-cream3 rounded-lg focus:border-brown focus:ring-1 focus:ring-brown outline-none transition-all"
                        required
                      >
                        <option value="">Selecciona un rubro...</option>
                        <option value="construccion">Construcción</option>
                        <option value="electricidad">Electricidad</option>
                        <option value="gasfiteria">Gasfitería</option>
                        <option value="aseo">Aseo</option>
                        <option value="seguridad">Seguridad</option>
                        <option value="transporte">Transporte</option>
                        <option value="otro">Otro</option>
                      </select>
                    </div>
                  ) : (
                    <div>
                      <label className="block text-[13.2px] font-medium text-gray-700 mb-1.5">Industria</label>
                      <select 
                        value={industria}
                        onChange={(e) => setIndustria(e.target.value)}
                        className="form-input w-full p-2.5 border border-cream3 rounded-lg focus:border-brown focus:ring-1 focus:ring-brown outline-none transition-all"
                        required
                      >
                        <option value="">Selecciona una industria...</option>
                        <option value="construccion">Construcción</option>
                        <option value="mineria">Minería</option>
                        <option value="energia">Energía</option>
                        <option value="manufactura">Manufactura</option>
                        <option value="logistica">Logística y Transporte</option>
                        <option value="retail">Retail</option>
                        <option value="telecomunicaciones">Telecomunicaciones</option>
                        <option value="servicios">Servicios Generales</option>
                      </select>
                    </div>
                  )}
                  <div>
                    <label className="block text-[13.2px] font-medium text-gray-700 mb-1.5">{isContratista ? 'Correo' : 'Correo corporativo'}</label>
                    <input 
                      type="email" 
                      value={correo}
                      onChange={(e) => setCorreo(e.target.value)}
                      className="form-input w-full p-2.5 border border-cream3 rounded-lg focus:border-brown focus:ring-1 focus:ring-brown outline-none transition-all" 
                      placeholder="tu@empresa.cl" 
                      required 
                    />
                  </div>
                  <div>
                    <label className="block text-[13.2px] font-medium text-gray-700 mb-1.5">Teléfono</label>
                    <input 
                      type="tel" 
                      value={telefono}
                      onChange={(e) => setTelefono(e.target.value)}
                      className="form-input w-full p-2.5 border border-cream3 rounded-lg focus:border-brown focus:ring-1 focus:ring-brown outline-none transition-all" 
                      placeholder="+56 9 XXXX XXXX" 
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
                  <div>
                    <label className="block text-[13.2px] font-medium text-gray-700 mb-1.5">Repetir contraseña</label>
                    <input 
                      type="password" 
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="form-input w-full p-2.5 border border-cream3 rounded-lg focus:border-brown focus:ring-1 focus:ring-brown outline-none transition-all" 
                      placeholder="••••••••" 
                      required 
                    />
                    {errorPassword && (
                      <div className="text-red-500 text-xs mt-1">Las contraseñas no coinciden</div>
                    )}
                  </div>
                  
                  <button type="submit" className="btn btn-primary w-full justify-center py-2.5 text-[15.4px] mt-2">
                    Crear cuenta
                  </button>
                </form>

                <div className="mt-8 text-center text-[13.2px] text-gray-500">
                  ¿Ya tienes una cuenta? <Link to="/login" className="text-brown font-medium hover:underline">Inicia sesión aquí</Link>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
