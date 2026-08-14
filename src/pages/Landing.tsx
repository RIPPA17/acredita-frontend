import React, { useState } from 'react';
import { 
  ShieldCheck, Settings, Upload, CheckCircle, Eye, Bell, Banknote, 
  FileText, Sparkles, Archive, AlertTriangle, Users, Check, Plus, 
  Mail, Phone, MapPin, LayoutDashboard, Folder, ListChecks, X, Building2
} from 'lucide-react';
import { Link } from 'react-router-dom';

export default function LandingPage() {
  const [showLoginModal, setShowLoginModal] = useState(false);

  return (
    <div className="bg-white min-h-screen text-navy">
      {/* NAV */}
      <nav className="sticky top-0 z-[100] bg-navy flex items-center justify-between px-12 h-14">
        <div className="text-[24.2px] text-cream tracking-[2px]">Acre<b className="text-brown font-normal">dita</b></div>
        <div className="hidden md:flex gap-8 items-center">
          <a href="#como-funciona" className="text-[#9aabb8] text-[15.4px] hover:text-cream cursor-pointer transition-colors">Cómo funciona</a>
          <a href="#beneficios" className="text-[#9aabb8] text-[15.4px] hover:text-cream cursor-pointer transition-colors">Beneficios</a>
          <a href="#contacto" className="text-[#9aabb8] text-[15.4px] hover:text-cream cursor-pointer transition-colors">Contacto</a>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowLoginModal(true)} className="btn btn-outline">Iniciar sesión</button>
          <Link to="/registro?rol=mandante" className="btn btn-primary">Registrarse gratis</Link>
        </div>
      </nav>

      {/* HERO */}
      <div className="bg-navy pt-20 px-12 text-center overflow-hidden">
        <div className="inline-flex items-center gap-1.5 bg-brown/20 text-brown border border-brown/30 px-3.5 py-1 rounded-full text-[14.3px] mb-6">
          <ShieldCheck size={16} /> Cumplimiento documental especializado
        </div>
        <h1 className="text-[52.8px] text-cream leading-[1.1] tracking-tight mb-5 max-w-[700px] mx-auto font-medium">
          Deja de perseguir<br/>documentos.<br/><span className="text-brown">Acredita lo hace por ti.</span>
        </h1>
        <p className="text-[#9aabb8] text-[18.7px] max-w-[520px] mx-auto mb-8 leading-relaxed">
          La plataforma que conecta mandantes y contratistas, nuestro equipo experto valida los documentos y te avisa antes de que algo venza.
        </p>
        <div className="flex gap-3 justify-center mb-12">
          <Link to="/registro?rol=mandante" className="btn btn-primary btn-lg">Comenzar gratis</Link>
          <a href="#contacto" className="btn btn-outline btn-lg">Solicitar demo</a>
        </div>
        
        {/* MOCKUP */}
        <div className="bg-[#1e262f] border border-white/10 rounded-t-xl max-w-[880px] mx-auto flex flex-col h-[380px] shadow-2xl relative mt-4 translate-y-4">
          {/* Mockup Header */}
          <div className="h-10 border-b border-white/10 bg-[#141a20] flex items-center px-4 justify-between shrink-0 rounded-t-xl">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-red-400"></div>
              <div className="w-2.5 h-2.5 rounded-full bg-yellow-400"></div>
              <div className="w-2.5 h-2.5 rounded-full bg-green-400"></div>
            </div>
            <div className="text-[12.1px] font-medium text-white/50 bg-white/5 px-2 py-0.5 rounded-lg flex items-center justify-center min-w-[200px]">
              app.acredita.cl
            </div>
            <div className="w-[38px]"></div> {/* spacer for center alignment */}
          </div>
          
          <div className="flex flex-1 overflow-hidden">
            {/* Mockup Sidebar */}
            <div className="w-[180px] border-r border-white/10 bg-[#1e262f] pt-4 px-3 flex flex-col shrink-0 text-left">
              <div className="flex items-center gap-1.5 mb-5 px-2">
                <span className="text-[16.5px] font-medium text-cream tracking-wide">Acre<b className="text-brown font-normal">dita</b></span>
              </div>
              
              <div className="text-[9.9px] uppercase tracking-wider text-white/30 font-semibold px-2 mb-2">Principal</div>
              <div className="flex items-center gap-2 px-2 py-1.5 bg-brown/20 text-brown rounded-md mb-1">
                <LayoutDashboard size={13} className="shrink-0" /> <span className="text-[12.1px] font-medium">Dashboard</span>
              </div>
              <div className="flex items-center gap-2 px-2 py-1.5 text-white/50 rounded-md mb-1 hover:bg-white/5 transition cursor-default">
                <Folder size={13} className="shrink-0" /> <span className="text-[12.1px]">Proyectos</span>
              </div>
              <div className="flex items-center justify-between px-2 py-1.5 text-white/50 rounded-md mb-3 hover:bg-white/5 transition cursor-default">
                <div className="flex items-center gap-2">
                  <ListChecks size={13} className="shrink-0" /> <span className="text-[12.1px]">Checklist</span>
                </div>
                <span className="bg-[#c02020]/20 text-[#fca5a5] text-[9.9px] px-1.5 py-0.5 rounded-lg font-medium">2</span>
              </div>

              <div className="text-[9.9px] uppercase tracking-wider text-white/30 font-semibold px-2 mb-2 mt-1">Plataforma</div>
              <div className="flex items-center gap-2 px-2 py-1.5 text-white/50 rounded-md mb-1 hover:bg-white/5 transition cursor-default">
                <Users size={13} className="shrink-0" /> <span className="text-[12.1px]">Contratistas</span>
              </div>
              <div className="flex items-center gap-2 px-2 py-1.5 text-white/50 rounded-md hover:bg-white/5 transition cursor-default">
                <Banknote size={13} className="shrink-0" /> <span className="text-[12.1px]">Pagos</span>
              </div>
            </div>

            {/* Mockup Main */}
            <div className="flex-1 bg-[#1a2129] p-6 text-left flex flex-col relative overflow-hidden">
              {/* Fade out gradient at bottom */}
              <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[#1a2129] to-transparent z-10"></div>
              
              <div className="flex justify-between items-end mb-6 shrink-0 relative z-20">
                <div>
                  <h3 className="text-white/90 text-[15.4px] font-medium">Dashboard Mandante</h3>
                  <p className="text-white/40 text-[12.1px] mt-1">Vista general de cumplimiento, 18 de mayo 2026</p>
                </div>
                <div className="flex gap-2">
                  <div className="bg-white/5 border border-white/10 rounded-lg px-2.5 py-1 text-[12.1px] text-white/60">Exportar PDF</div>
                  <div className="bg-brown border border-brown/50 rounded-lg px-2.5 py-1 text-[12.1px] text-white">Nuevo Proyecto</div>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-3 mb-6 shrink-0 relative z-20">
                <div className="bg-[#1e262f] border border-white/5 rounded-lg p-3.5">
                  <div className="text-white/80 font-semibold text-[19.8px] leading-none mb-1.5">12</div>
                  <div className="text-[11px] text-white/40">Contratistas activos</div>
                </div>
                <div className="bg-[#2a6a3a]/20 border border-[#2a6a3a]/30 rounded-lg p-3.5">
                  <div className="text-[#4cd16f] font-semibold text-[19.8px] leading-none mb-1.5">8</div>
                  <div className="text-[11px] text-[#4cd16f]/70">En cumplimiento</div>
                </div>
                <div className="bg-[#c02020]/20 border border-[#c02020]/30 rounded-lg p-3.5">
                  <div className="text-[#fca5a5] font-semibold text-[19.8px] leading-none mb-1.5">1</div>
                  <div className="text-[11px] text-[#fca5a5]/70">Estado crítico</div>
                </div>
                <div className="bg-[#d4a000]/20 border border-[#d4a000]/30 rounded-lg p-3.5">
                  <div className="text-[#fde047] font-semibold text-[19.8px] leading-none mb-1.5">3</div>
                  <div className="text-[11px] text-[#fde047]/70">Con advertencias</div>
                </div>
              </div>

              <div className="bg-[#1e262f] border border-white/5 rounded-lg flex-1 overflow-hidden flex flex-col relative z-20">
                <div className="border-b border-white/5 py-2 px-3 bg-[#232d38] flex items-center">
                  <div className="text-[11px] text-white/40 w-[200px] font-medium uppercase tracking-wider">Contratista</div>
                  <div className="text-[11px] text-white/40 flex-1 font-medium uppercase tracking-wider">Proyecto</div>
                  <div className="text-[11px] text-white/40 w-[120px] font-medium text-right uppercase tracking-wider">Estado</div>
                </div>
                <div className="flex-1 px-3 py-1 flex flex-col gap-1">
                  <div className="flex items-center py-2.5 border-b border-white/5">
                    <div className="text-[12.7px] text-white/80 font-medium w-[200px] flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-red-400"></div> Servicios Integrales Lagos</div>
                    <div className="text-[12.7px] text-white/50 flex-1 truncate">Proyecto Costanera Norte</div>
                    <div className="text-right w-[120px]"><span className="text-[9.9px] bg-red-500/20 text-red-300 border border-red-500/20 px-2 py-0.5 rounded-lg font-medium tracking-wide">PAGO RETENIDO</span></div>
                  </div>
                  <div className="flex items-center py-2.5 border-b border-white/5">
                    <div className="text-[12.7px] text-white/80 font-medium w-[200px] flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-green-400"></div> Constructora Andrade Ltda</div>
                    <div className="text-[12.7px] text-white/50 flex-1 truncate">Bodega Logística Sur</div>
                    <div className="text-right w-[120px]"><span className="text-[9.9px] bg-green-500/20 text-green-300 border border-green-500/20 px-2 py-0.5 rounded-lg font-medium tracking-wide">AL DÍA</span></div>
                  </div>
                  <div className="flex items-center py-2.5 border-b border-white/5">
                    <div className="text-[12.7px] text-white/80 font-medium w-[200px] flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-yellow-400"></div> Servicios Norte Ltda.</div>
                    <div className="text-[12.7px] text-white/50 flex-1 truncate">Torre Mackenna</div>
                    <div className="text-right w-[120px]"><span className="text-[9.9px] bg-yellow-500/20 text-yellow-300 border border-yellow-500/20 px-2 py-0.5 rounded-lg font-medium tracking-wide">PENDIENTE</span></div>
                  </div>
                  <div className="flex items-center py-2.5">
                    <div className="text-[12.7px] text-white/80 font-medium w-[200px] flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-green-400"></div> Eléctrica Sur SpA</div>
                    <div className="text-[12.7px] text-white/50 flex-1 truncate">Bodega Logística Sur</div>
                    <div className="text-right w-[120px]"><span className="text-[9.9px] bg-green-500/20 text-green-300 border border-green-500/20 px-2 py-0.5 rounded-lg font-medium tracking-wide">AL DÍA</span></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* COMO FUNCIONA */}
      <div id="como-funciona" className="py-20 px-12 bg-white">
        <div className="text-center max-w-[700px] mx-auto">
          <h2 className="text-[44px] md:text-[52.8px] font-semibold text-brown tracking-tight mb-4 mt-8">Cómo funciona</h2>
          <div className="text-[24px] md:text-[28px] text-navy font-medium leading-[1.2] mb-4">Tres pasos. Sin papeleo.</div>
          <div className="text-[17.6px] text-[#7a7a6a] leading-[1.7]">Desde que el mandante crea el proyecto hasta que todos los documentos están aprobados, Acredita automatiza cada paso.</div>
        </div>
        <div className="grid md:grid-cols-3 gap-8 mt-12 max-w-[900px] mx-auto">
          <div className="text-center">
            <div className="w-[52px] h-[52px] rounded-xl bg-brown flex items-center justify-center mx-auto mb-5 text-[color:var(--brown-text,white)]"><Settings size={28} /></div>
            <h4 className="text-[19.8px] font-medium mb-2">1. Mandante configura</h4>
            <p className="text-[15.4px] text-[#7a7a6a] leading-relaxed">Elige la industria, define el checklist de documentos y fija las reglas de vigencia. Listo en minutos.</p>
          </div>
          <div className="text-center">
            <div className="w-[52px] h-[52px] rounded-xl bg-brown flex items-center justify-center mx-auto mb-5 text-[color:var(--brown-text,white)]"><Upload size={28} /></div>
            <h4 className="text-[19.8px] font-medium mb-2">2. Contratista sube</h4>
            <p className="text-[15.4px] text-[#7a7a6a] leading-relaxed">Recibe una invitación, sube sus documentos y nuestro equipo los valida al instante con feedback claro si algo está mal.</p>
          </div>
          <div className="text-center">
            <div className="w-[52px] h-[52px] rounded-xl bg-brown flex items-center justify-center mx-auto mb-5 text-[color:var(--brown-text,white)]"><CheckCircle size={28} /></div>
            <h4 className="text-[19.8px] font-medium mb-2">3. Todos en verde</h4>
            <p className="text-[15.4px] text-[#7a7a6a] leading-relaxed">El mandante aprueba, libera el pago y recibe el informe PDF de cumplimiento. Sin llamadas ni correos.</p>
          </div>
        </div>
      </div>

      {/* BENEFICIOS */}
      <div id="beneficios" className="bg-navy py-20 px-12">
        <div className="text-center max-w-[700px] mx-auto">
          <div className="inline-block bg-[#EBEBDD]/10 text-brown text-[12.7px] font-semibold tracking-[1.5px] uppercase py-1 px-3 rounded-md mb-4">Beneficios por rol</div>
          <div className="text-[33px] text-cream font-medium leading-[1.2]">Diseñado para ambos lados<br/>de la relación</div>
        </div>
        <div className="grid md:grid-cols-2 gap-12 max-w-[1000px] mx-auto mt-12">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-8">
            <h3 className="text-[19.8px] text-cream mb-6 flex items-center gap-2.5 font-medium">
              Para el Mandante <span className="bg-brown text-[var(--brown-text,white)] text-[12.1px] py-[3px] px-2.5 rounded-lg font-normal">Principal</span>
            </h3>
            <div className="flex items-start gap-2.5 mb-4">
              <Eye className="text-brown mt-[2px] shrink-0" size={20} />
              <div className="text-[15.4px] text-[#9aabb8] leading-relaxed"><strong className="block text-cream mb-0.5">Visibilidad total en tiempo real</strong>Ve el estado de cumplimiento de todos tus contratistas en un solo dashboard.</div>
            </div>
            <div className="flex items-start gap-2.5 mb-4">
              <Bell className="text-brown mt-[2px] shrink-0" size={20} />
              <div className="text-[15.4px] text-[#9aabb8] leading-relaxed"><strong className="block text-cream mb-0.5">Alertas automáticas</strong>Recibe notificaciones antes de que un documento venza, sin tener que revisar manualmente.</div>
            </div>
            <div className="flex items-start gap-2.5 mb-4">
              <Banknote className="text-brown mt-[2px] shrink-0" size={20} />
              <div className="text-[15.4px] text-[#9aabb8] leading-relaxed"><strong className="block text-cream mb-0.5">Control de pagos</strong>Libera o retén pagos basado en el cumplimiento real y documentado de cada contratista.</div>
            </div>
            <div className="flex items-start gap-2.5 mb-4">
              <FileText className="text-brown mt-[2px] shrink-0" size={20} />
              <div className="text-[15.4px] text-[#9aabb8] leading-relaxed"><strong className="block text-cream mb-0.5">Informes PDF</strong>Genera reportes de cumplimiento exportables para auditorías internas o externas.</div>
            </div>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-2xl p-8">
            <h3 className="text-[19.8px] text-cream mb-6 flex items-center gap-2.5 font-medium">
              Para el Contratista <span className="bg-brown text-[var(--brown-text,white)] text-[12.1px] py-[3px] px-2.5 rounded-lg font-normal">Gratis</span>
            </h3>
            <div className="flex items-start gap-2.5 mb-4">
              <Sparkles className="text-brown mt-[2px] shrink-0" size={20} />
              <div className="text-[15.4px] text-[#9aabb8] leading-relaxed"><strong className="block text-cream mb-0.5">Asesoría experta</strong>Asegúrate de preparar liquidaciones, contratos y más correctamente con la ayuda de nuestros especialistas.</div>
            </div>
            <div className="flex items-start gap-2.5 mb-4">
              <Archive className="text-brown mt-[2px] shrink-0" size={20} />
              <div className="text-[15.4px] text-[#9aabb8] leading-relaxed"><strong className="block text-cream mb-0.5">Biblioteca centralizada</strong>Sube un documento una vez y reutilízalo en todos los proyectos donde esté vigente.</div>
            </div>
            <div className="flex items-start gap-2.5 mb-4">
              <AlertTriangle className="text-brown mt-[2px] shrink-0" size={20} />
              <div className="text-[15.4px] text-[#9aabb8] leading-relaxed"><strong className="block text-cream mb-0.5">Nunca más un vencimiento sorpresa</strong>Alertas 30, 15 y 7 días antes de que expire cualquier documento.</div>
            </div>
            <div className="flex items-start gap-2.5 mb-4">
              <Users className="text-brown mt-[2px] shrink-0" size={20} />
              <div className="text-[15.4px] text-[#9aabb8] leading-relaxed"><strong className="block text-cream mb-0.5">Gestión de nómina</strong>Administra los documentos de cada trabajador y asígnalos a múltiples proyectos.</div>
            </div>
          </div>
        </div>
      </div>

      {/* TESTIMONIOS */}
      <div className="bg-white py-20 px-12">
        <div className="text-center max-w-[700px] mx-auto">
          <div className="inline-block bg-cream text-brown text-[12.7px] font-semibold tracking-[1.5px] uppercase py-1 px-3 rounded-md mb-4">Testimonios</div>
          <div className="text-[33px] font-medium leading-[1.2]">Lo que dicen nuestros clientes</div>
        </div>
        <div className="grid md:grid-cols-3 gap-6 max-w-[1000px] mx-auto mt-12">
          <div className="bg-cream2 rounded-xl p-8 border border-cream3">
            <div className="text-brown text-[15.4px] tracking-[2px] mb-4">★★★★★</div>
            <div className="text-[15.4px] text-[#5a5a4a] leading-relaxed italic mb-6">"Antes perdíamos 2 días al mes persiguiendo documentos por correo. Con Acredita todo llega solo y validado. No volvería atrás."</div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-navy text-cream flex items-center justify-center text-[14.3px] font-semibold shrink-0">JM</div>
              <div>
                <div className="text-[14.9px] font-medium">Jorge Morales</div>
                <div className="text-[13.2px] text-[#9a9a8a]">Jefe de Contratos · Constructora Andina SA</div>
              </div>
            </div>
          </div>
          <div className="bg-cream2 rounded-xl p-8 border border-cream3">
            <div className="text-brown text-[15.4px] tracking-[2px] mb-4">★★★★★</div>
            <div className="text-[15.4px] text-[#5a5a4a] leading-relaxed italic mb-6">"Como contratista, ya no me toman por sorpresa los vencimientos. Las alertas llegan justo a tiempo y el equipo experto me ahorra horas de papeleo."</div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-navy text-cream flex items-center justify-center text-[14.3px] font-semibold shrink-0">PR</div>
              <div>
                <div className="text-[14.9px] font-medium">Patricia Rojas</div>
                <div className="text-[13.2px] text-[#9a9a8a]">Gerente · Servicios Norte Ltda.</div>
              </div>
            </div>
          </div>
          <div className="bg-cream2 rounded-xl p-8 border border-cream3">
            <div className="text-brown text-[15.4px] tracking-[2px] mb-4">★★★★★</div>
            <div className="text-[15.4px] text-[#5a5a4a] leading-relaxed italic mb-6">"Implementamos Acredita en 3 proyectos simultáneos con más de 40 contratistas. El dashboard nos da control total sin contratar más personal."</div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-navy text-cream flex items-center justify-center text-[14.3px] font-semibold shrink-0">CA</div>
              <div>
                <div className="text-[14.9px] font-medium">Cristóbal Araya</div>
                <div className="text-[13.2px] text-[#9a9a8a]">Director de Operaciones · Minera Los Andes</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* CONTACTO */}
      <div id="contacto" className="bg-navy py-20 px-12">
        <div className="text-center max-w-[700px] mx-auto">
          <h2 className="text-[44px] md:text-[52.8px] font-semibold text-brown tracking-tight mb-4 mt-8">Contacto</h2>
          <div className="text-[24px] md:text-[28px] text-cream font-medium leading-[1.2] mb-4">¿Trabajas con contratistas?<br/>Hablemos.</div>
          <div className="text-[17.6px] text-[#9aabb8] leading-[1.7]">Ideal para cualquier negocio. Agenda una demo con nuestro equipo para descubrir cómo podemos optimizar tu gestión de contratistas.</div>
        </div>
        <div className="grid md:grid-cols-2 gap-12 max-w-[900px] mx-auto mt-12 items-start">
          <div className="bg-white/5 p-8 rounded-2xl border border-white/10 text-cream">
            <div className="form-group">
              <label className="form-label text-[15.4px]">Nombre completo</label>
              <input className="form-input w-full p-2.5 rounded-lg border !border-white/10 !bg-white/5 !text-white" placeholder="Jorge Morales" />
            </div>
            <div className="form-group mt-4">
              <label className="form-label text-[15.4px]">Empresa</label>
              <input className="form-input w-full p-2.5 rounded-lg border !border-white/10 !bg-white/5 !text-white" placeholder="Constructora Ejemplo SA" />
            </div>
            <div className="form-group mt-4">
              <label className="form-label text-[15.4px]">Industria</label>
              <select className="form-input w-full p-2.5 rounded-lg border !border-white/10 !bg-white/5 !text-white">
                <option value="" className="bg-navy">Selecciona una industria...</option>
                <option value="construccion" className="bg-navy">Construcción</option>
                <option value="mineria" className="bg-navy">Minería</option>
                <option value="energia" className="bg-navy">Energía</option>
                <option value="manufactura" className="bg-navy">Manufactura</option>
                <option value="logistica" className="bg-navy">Logística y Transporte</option>
                <option value="retail" className="bg-navy">Retail</option>
                <option value="telecomunicaciones" className="bg-navy">Telecomunicaciones</option>
                <option value="servicios" className="bg-navy">Servicios Generales</option>
                <option value="otro" className="bg-navy">Otro</option>
              </select>
            </div>
            <div className="form-group mt-4">
              <label className="form-label text-[15.4px]">Correo corporativo</label>
              <input className="form-input w-full p-2.5 rounded-lg border !border-white/10 !bg-white/5 !text-white" placeholder="jorge@empresa.cl" />
            </div>
            <div className="form-group mt-4">
              <label className="form-label text-[15.4px]">¿Cuántos trabajadores tiene la empresa?</label>
              <select className="form-input w-full p-2.5 rounded-lg border !border-white/10 !bg-white/5 !text-white">
                <option value="" className="bg-navy">Selecciona una opción...</option>
                <option value="1-50" className="bg-navy">1 - 50</option>
                <option value="51-200" className="bg-navy">51 - 200</option>
                <option value="201-500" className="bg-navy">201 - 500</option>
                <option value="501-1000" className="bg-navy">501 - 1000</option>
                <option value="1001-2000" className="bg-navy">1001 - 2000</option>
                <option value="2001-3000" className="bg-navy">2001 - 3000</option>
                <option value="3000+" className="bg-navy">Más de 3000</option>
              </select>
            </div>
            <div className="form-group mt-4 mb-6">
              <label className="form-label text-[15.4px]">Mensaje (opcional)</label>
              <textarea className="form-input w-full p-2.5 rounded-lg border !border-white/10 !bg-white/5 !text-white resize-none" rows={3} placeholder="Cuéntanos sobre tu caso..."></textarea>
            </div>
            <button className="btn btn-primary w-full justify-center text-[16.5px] py-3">Solicitar demo</button>
          </div>
          <div className="flex flex-col gap-6 pt-4 text-cream">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center shrink-0">
                <Mail className="text-brown" size={24} />
              </div>
              <div className="pt-1">
                <div className="text-[15.4px] font-medium mb-1">Correo</div>
                <div className="text-[14.9px] text-[#9aabb8]">contacto@acredita.cl</div>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center shrink-0">
                <Phone className="text-brown" size={24} />
              </div>
              <div className="pt-1">
                <div className="text-[15.4px] font-medium mb-1">Teléfono</div>
                <div className="text-[14.9px] text-[#9aabb8]">+569 7365 4860</div>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center shrink-0">
                <MapPin className="text-brown" size={24} />
              </div>
              <div className="pt-1">
                <div className="text-[15.4px] font-medium mb-1">Ubicación</div>
                <div className="text-[14.9px] text-[#9aabb8]">Avenida Providencia, Santiago, Chile</div>
              </div>
            </div>
            <div className="bg-white/5 rounded-xl p-6 border border-white/10 mt-2">
              <div className="text-[15.4px] font-medium mb-2">Respuesta garantizada en</div>
              <div className="text-[35.2px] font-semibold text-brown leading-none">24 hrs</div>
              <div className="text-[14.3px] text-[#9aabb8] mt-2">Días hábiles · Lun a Vie</div>
            </div>
          </div>
        </div>
      </div>

      {/* CTA FINAL */}
      <div className="bg-white py-24 px-12 text-center">
        <h2 className="text-[41.8px] text-navy leading-[1.2] mb-4 font-medium">¿Listo para dejar de<br/>perseguir <span className="text-brown">documentos</span>?</h2>
        <p className="text-[#6b7e8f] text-[17.6px] max-w-[480px] mx-auto mb-10 leading-[1.7]">Empieza gratis hoy. Sin tarjeta de crédito. Sin compromiso. El contratista siempre entra gratis.</p>
        <div className="flex gap-3 justify-center">
          <Link to="/registro?rol=mandante" className="btn btn-primary btn-lg">Comenzar gratis</Link>
          <a href="#contacto" className="btn btn-outline btn-lg">Solicitar demo</a>
        </div>
      </div>

      {/* FOOTER */}
      <footer className="bg-brown py-12 px-12 pb-8 text-cream">
        <div className="grid md:grid-cols-12 gap-8 mb-12 max-w-[1200px] mx-auto">
          <div className="md:col-span-5">
            <div className="text-[22px] tracking-[2px] mb-4 text-cream">Acre<b className="text-navy font-normal">dita</b></div>
            <p className="text-[14.3px] text-white/70 leading-[1.6] max-w-[260px]">Gestión documental especializada para mandantes y contratistas en Chile.</p>
          </div>
          <div className="md:col-span-2">
            <h5 className="text-[13.2px] tracking-[1.5px] uppercase text-white/50 mb-4 font-semibold">Producto</h5>
            <div className="flex flex-col gap-2.5 text-[14.3px] text-white/80">
              <a href="#" className="hover:text-cream transition-colors">Cómo funciona</a>
              <a href="#" className="hover:text-cream transition-colors">Para mandantes</a>
              <a href="#" className="hover:text-cream transition-colors">Para contratistas</a>
            </div>
          </div>
          <div className="md:col-span-2">
            <h5 className="text-[13.2px] tracking-[1.5px] uppercase text-white/50 mb-4 font-semibold">Empresa</h5>
            <div className="flex flex-col gap-2.5 text-[14.3px] text-white/80">
              <a href="#" className="hover:text-cream transition-colors">Nosotros</a>
              <a href="#" className="hover:text-cream transition-colors">Blog</a>
              <a href="#" className="hover:text-cream transition-colors">Contacto</a>
              <a href="#" className="hover:text-cream transition-colors">Trabaja con nosotros</a>
            </div>
          </div>
          <div className="md:col-span-3">
            <h5 className="text-[13.2px] tracking-[1.5px] uppercase text-white/50 mb-4 font-semibold">Legal</h5>
            <div className="flex flex-col gap-2.5 text-[14.3px] text-white/80">
              <a href="#" className="hover:text-cream transition-colors">Términos de uso</a>
              <a href="#" className="hover:text-cream transition-colors">Privacidad</a>
              <a href="#" className="hover:text-cream transition-colors">Seguridad</a>
              <a href="#" className="hover:text-cream transition-colors">Cookies</a>
            </div>
          </div>
        </div>
        <div className="border-t border-white/20 pt-6 flex justify-between items-center text-[13.2px] text-white/60 max-w-[1200px] mx-auto">
          <p>© 2026 Acredita SpA · Santiago, Chile</p>
          <p>Hecho con <span className="text-navy">♥</span> para simplificar el cumplimiento laboral</p>
        </div>
      </footer>
      {/* LOGIN MODAL */}
      {showLoginModal && (
        <div className="fixed inset-0 bg-black/50 z-[200] flex items-center justify-center p-4 fade-in">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 relative">
            <button 
              onClick={() => setShowLoginModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-navy transition-colors"
            >
              <X size={20} />
            </button>
            
            <h3 className="section-title text-center text-[22px] mb-6">¿Cómo quieres ingresar?</h3>
            
            <div className="flex flex-col gap-4">
              <Link 
                to="/login?rol=mandante" 
                className="flex items-center gap-4 p-4 border border-cream3 rounded-xl hover:bg-cream/50 hover:border-brown transition-all group"
              >
                <div className="w-12 h-12 bg-cream group-hover:bg-brown/10 rounded-lg flex items-center justify-center text-brown shrink-0">
                  <Building2 size={24} />
                </div>
                <div>
                  <div className="font-semibold text-navy text-[16px]">Soy Mandante</div>
                  <div className="text-[13.2px] text-gray-500 mt-1">Gestiono contratistas y reviso documentos.</div>
                </div>
              </Link>
              
              <Link 
                to="/registro?rol=contratista" 
                className="flex items-center gap-4 p-4 border border-cream3 rounded-xl hover:bg-cream/50 hover:border-brown transition-all group"
              >
                <div className="w-12 h-12 bg-cream group-hover:bg-brown/10 rounded-lg flex items-center justify-center text-brown shrink-0">
                  <Users size={24} />
                </div>
                <div>
                  <div className="font-semibold text-navy text-[16px]">Soy Contratista</div>
                  <div className="text-[13.2px] text-gray-500 mt-1">Subo mis documentos y acredito a mi equipo.</div>
                </div>
              </Link>
            </div>
            
            <div className="mt-6 text-center text-[13.2px] text-gray-500">
              ¿No tienes una cuenta? <Link to="/registro" className="text-brown font-medium hover:underline">Regístrate gratis</Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
