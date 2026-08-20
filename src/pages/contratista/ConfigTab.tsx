import { Save, Building2, Bell, Shield, Mail, Smartphone, ToggleRight } from 'lucide-react';

type ConfigSubTab = 'perfil' | 'alertas' | 'seguridad';

interface CanalAlertas {
  rechazoEmail: boolean;
  vencimientoEmail: boolean;
  vencimientoWhatsapp: boolean;
  aprobacionEmail: boolean;
}

export default function ConfigTab({
  activeConfigTab,
  setActiveConfigTab,
  canalAlertas,
  setCanalAlertas,
}: {
  activeConfigTab: ConfigSubTab;
  setActiveConfigTab: (v: ConfigSubTab) => void;
  canalAlertas: CanalAlertas;
  setCanalAlertas: (updater: (prev: CanalAlertas) => CanalAlertas) => void;
}) {
  return (
    <div className="fade-in">
      <div className="page-header mb-6">
        <div>
          <h2 className="page-title">Configuración de la Cuenta</h2>
          <p className="page-sub">Administra tu perfil comercial, alertas automáticas y seguridad</p>
        </div>
        <button className="btn btn-primary shadow-sm cursor-not-allowed opacity-50 font-medium" disabled title="No disponible en demo">
          <Save size={16} className="mr-2" /> Guardar [Demo]
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">

        {/* MENÚ LATERAL DE CONFIGURACIÓN */}
        <div className="lg:col-span-1 flex flex-col gap-1.5">
          <button
            className={`flex items-center gap-2 px-3 py-2.5 rounded-lg font-medium text-[14.3px] transition ${activeConfigTab === 'perfil' ? 'bg-white border border-cream3 text-navy shadow-sm' : 'text-gray-500 hover:bg-cream hover:text-navy'}`}
            onClick={() => setActiveConfigTab('perfil')}
          >
            <Building2 size={18} className="text-brown" /> Perfil Comercial
          </button>
          <button
            className={`flex items-center gap-2 px-3 py-2.5 rounded-lg font-medium text-[14.3px] transition ${activeConfigTab === 'alertas' ? 'bg-white border border-cream3 text-navy shadow-sm' : 'text-gray-500 hover:bg-cream hover:text-navy'}`}
            onClick={() => setActiveConfigTab('alertas')}
          >
            <Bell size={18} /> Alertas y Avisos
          </button>
          <button
            className={`flex items-center gap-2 px-3 py-2.5 rounded-lg font-medium text-[14.3px] transition ${activeConfigTab === 'seguridad' ? 'bg-white border border-cream3 text-navy shadow-sm' : 'text-gray-500 hover:bg-cream hover:text-navy'}`}
            onClick={() => setActiveConfigTab('seguridad')}
          >
            <Shield size={18} /> Seguridad y Accesos
          </button>
        </div>

        {/* CONTENIDO DE CONFIGURACIÓN */}
        <div className="lg:col-span-3 flex flex-col gap-4">

          {/* BLOQUE 1: DATOS DE LA EMPRESA */}
          {activeConfigTab === 'perfil' && (
            <div className="card">
              <h3 className="section-title mb-4">Información de la Empresa</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="form-group">
                  <label className="form-label">Razón Social</label>
                  <input className="form-input" defaultValue="Servicios Integrales Lagos Ltda." />
                </div>
                <div className="form-group">
                  <label className="form-label">RUT Empresa</label>
                  <input className="form-input" defaultValue="76.543.210-K" disabled />
                </div>
                <div className="form-group md:col-span-2">
                  <label className="form-label">Dirección Comercial</label>
                  <input className="form-input" defaultValue="Av. Providencia 1234, Oficina 502, Santiago" />
                </div>
                <div className="form-group">
                  <label className="form-label">Giro Principal</label>
                  <input className="form-input" defaultValue="Obras menores en construcción" />
                </div>
                <div className="form-group">
                  <label className="form-label">Representante Legal</label>
                  <input className="form-input" defaultValue="Roberto Lagos" />
                </div>
              </div>
            </div>
          )}

          {/* BLOQUE 2: CENTRO DE NOTIFICACIONES */}
          {activeConfigTab === 'alertas' && (
            <div className="card">
              <div className="flex items-start gap-3 mb-5">
                <div className="w-10 h-10 rounded-xl bg-cream flex items-center justify-center shrink-0 text-brown">
                  <Bell size={20} />
                </div>
                <div>
                  <h3 className="section-title mb-1">Centro de Alertas</h3>
                  <p className="text-[13.2px] text-gray-500">Configura cómo y cuándo quieres que Acredita te avise sobre el estado de tu documentación.</p>
                </div>
              </div>

              <div className="flex flex-col gap-0 border border-cream3 rounded-xl overflow-hidden">
                {/* Alerta 1 */}
                <div className="flex items-center justify-between p-4 bg-white border-b border-cream3">
                  <div>
                    <div className="text-[14.3px] font-medium text-navy">Rechazo de Documentos</div>
                    <div className="text-[12.1px] text-gray-500">Aviso inmediato si un Mandante rechaza una subida.</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      className={`flex items-center gap-1.5 text-[12.1px] font-medium px-2 py-1 rounded-md transition ${canalAlertas.rechazoEmail ? 'text-brown bg-cream' : 'text-gray-400 bg-gray-50'}`}
                      onClick={() => setCanalAlertas(prev => ({ ...prev, rechazoEmail: !prev.rechazoEmail }))}
                    >
                      <Mail size={14} /> Email
                    </button>
                    <ToggleRight size={28} className="text-[#2a6a3a] cursor-pointer" />
                  </div>
                </div>

                {/* Alerta 2 */}
                <div className="flex items-center justify-between p-4 bg-white border-b border-cream3">
                  <div>
                    <div className="text-[14.3px] font-medium text-navy">Alerta Preventiva de Vencimiento</div>
                    <div className="text-[12.1px] text-gray-500">Aviso 15 y 5 días antes de que caduque un certificado.</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      className={`flex items-center gap-1.5 text-[12.1px] font-medium px-2 py-1 rounded-md transition ${canalAlertas.vencimientoEmail ? 'text-brown bg-cream' : 'text-gray-400 bg-gray-50'}`}
                      onClick={() => setCanalAlertas(prev => ({ ...prev, vencimientoEmail: !prev.vencimientoEmail }))}
                    >
                      <Mail size={14} /> Email
                    </button>
                    <button
                      className={`flex items-center gap-1.5 text-[12.1px] font-medium px-2 py-1 rounded-md transition ${canalAlertas.vencimientoWhatsapp ? 'text-brown bg-cream' : 'text-gray-400 bg-gray-50'}`}
                      onClick={() => setCanalAlertas(prev => ({ ...prev, vencimientoWhatsapp: !prev.vencimientoWhatsapp }))}
                    >
                      <Smartphone size={14} /> WhatsApp
                    </button>
                    <ToggleRight size={28} className="text-[#2a6a3a] cursor-pointer" />
                  </div>
                </div>

                {/* Alerta 3 */}
                <div className="flex items-center justify-between p-4 bg-white">
                  <div>
                    <div className="text-[14.3px] font-medium text-navy">Aprobación Exitosa</div>
                    <div className="text-[12.1px] text-gray-500">Resumen cuando todos los documentos de una faena están al día.</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      className={`flex items-center gap-1.5 text-[12.1px] font-medium px-2 py-1 rounded-md transition ${canalAlertas.aprobacionEmail ? 'text-brown bg-cream' : 'text-gray-400 bg-gray-50'}`}
                      onClick={() => setCanalAlertas(prev => ({ ...prev, aprobacionEmail: !prev.aprobacionEmail }))}
                    >
                      <Mail size={14} /> Email
                    </button>
                    <ToggleRight size={28} className="text-gray-300 cursor-pointer" />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* BLOQUE 3: SEGURIDAD Y ACCESOS */}
          {activeConfigTab === 'seguridad' && (
            <div className="card">
              <h3 className="section-title mb-4">Seguridad y Accesos</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="form-group">
                  <label className="form-label">Contraseña Actual</label>
                  <input className="form-input" type="password" placeholder="••••••••" />
                </div>
                <div className="form-group">
                  <label className="form-label">Nueva Contraseña</label>
                  <input className="form-input" type="password" placeholder="Mínimo 8 caracteres" />
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
