import { Save, Building2, Users, Bell, Plug, ToggleRight } from 'lucide-react';

type ConfigSubTab = 'perfil' | 'equipo' | 'alertas' | 'api';

export default function ConfigTab({
  activeConfigTab,
  setActiveConfigTab,
  showToast,
}: {
  activeConfigTab: ConfigSubTab;
  setActiveConfigTab: (tab: ConfigSubTab) => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'warning') => void;
}) {
  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <h2 className="page-title">Configuración de la Cuenta</h2>
          <p className="page-sub">Preferencias de la empresa, equipo y conexiones del sistema</p>
        </div>
        <button className="btn btn-primary" onClick={() => showToast('Configuración guardada')}>
          <Save size={16} className="mr-2" /> Guardar Cambios
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">

        {/* Menú lateral de configuración interno */}
        <div className="lg:col-span-1 flex flex-col gap-1.5">
          <button
            className={`flex items-center gap-2 px-3 py-2.5 rounded-lg font-medium text-[14.3px] transition ${activeConfigTab === 'perfil' ? 'bg-white border border-cream3 text-navy shadow-sm' : 'text-gray-500 hover:bg-cream hover:text-navy'}`}
            onClick={() => setActiveConfigTab('perfil')}
          >
            <Building2 size={18} className="text-brown" /> Perfil de Empresa
          </button>
          <button
            className={`flex items-center gap-2 px-3 py-2.5 rounded-lg font-medium text-[14.3px] transition ${activeConfigTab === 'equipo' ? 'bg-white border border-cream3 text-navy shadow-sm' : 'text-gray-500 hover:bg-cream hover:text-navy'}`}
            onClick={() => setActiveConfigTab('equipo')}
          >
            <Users size={18} /> Equipo y Accesos
          </button>
          <button
            className={`flex items-center gap-2 px-3 py-2.5 rounded-lg font-medium text-[14.3px] transition ${activeConfigTab === 'alertas' ? 'bg-white border border-cream3 text-navy shadow-sm' : 'text-gray-500 hover:bg-cream hover:text-navy'}`}
            onClick={() => setActiveConfigTab('alertas')}
          >
            <Bell size={18} /> Alertas Automáticas
          </button>
          <button
            className={`flex items-center gap-2 px-3 py-2.5 rounded-lg font-medium text-[14.3px] transition ${activeConfigTab === 'api' ? 'bg-white border border-cream3 text-navy shadow-sm' : 'text-gray-500 hover:bg-cream hover:text-navy'}`}
            onClick={() => setActiveConfigTab('api')}
          >
            <Plug size={18} /> Integraciones / API
          </button>
        </div>

        {/* Contenido de Configuración */}
        <div className="lg:col-span-3 flex flex-col gap-4">

          {/* BLOQUE 1: DATOS DE LA EMPRESA */}
          {activeConfigTab === 'perfil' && (
            <div className="card">
              <h3 className="section-title mb-4">Datos Legales y de Facturación</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="form-group">
                  <label className="form-label">Razón Social</label>
                  <input className="form-input" defaultValue="Constructora Andina SA" />
                </div>
                <div className="form-group">
                  <label className="form-label">RUT Empresa</label>
                  <input className="form-input" defaultValue="96.123.456-K" disabled />
                </div>
                <div className="form-group">
                  <label className="form-label">Giro / Actividad Económica</label>
                  <input className="form-input" defaultValue="Construcción de edificios" />
                </div>
                <div className="form-group">
                  <label className="form-label">Representante Legal</label>
                  <input className="form-input" defaultValue="Carlos Araya" />
                </div>
              </div>
            </div>
          )}

          {/* BLOQUE 2: EQUIPO Y ACCESOS */}
          {activeConfigTab === 'equipo' && (
            <div className="card">
              <div className="flex justify-between items-center mb-4">
                <h3 className="section-title mb-0">Gestión de Usuarios Internos</h3>
                <button className="btn btn-ghost btn-sm cursor-not-allowed opacity-50 font-medium" disabled title="No disponible en demo">Añadir Usuario [Demo]</button>
              </div>
              <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
                <table className="table w-full text-left min-w-[600px]">
                <thead>
                  <tr>
                    <th className="px-4 py-3 border-b border-cream3 text-[13.2px] text-gray-600 bg-cream2 font-medium">Nombre</th>
                    <th className="px-4 py-3 border-b border-cream3 text-[13.2px] text-gray-600 bg-cream2 font-medium">Correo</th>
                    <th className="px-4 py-3 border-b border-cream3 text-[13.2px] text-gray-600 bg-cream2 font-medium">Rol de Acceso</th>
                    <th className="px-4 py-3 border-b border-cream3 text-[13.2px] text-gray-600 bg-cream2 font-medium">Proyectos Asignados</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="hover:bg-gray-50 border-b border-cream">
                    <td className="px-4 py-3 font-medium text-[14.3px]">Cristóbal Araya</td>
                    <td className="px-4 py-3 text-[14.3px] text-gray-500">caraya@andina.cl</td>
                    <td className="px-4 py-3"><span className="badge border border-brown text-brown">Administrador</span></td>
                    <td className="px-4 py-3 text-[13.2px]">Todos</td>
                  </tr>
                  <tr className="hover:bg-gray-50 border-b border-cream">
                    <td className="px-4 py-3 font-medium text-[14.3px]">Jorge Morales</td>
                    <td className="px-4 py-3 text-[14.3px] text-gray-500">jmorales@andina.cl</td>
                    <td className="px-4 py-3"><span className="badge b-gray">Prevencionista</span></td>
                    <td className="px-4 py-3 text-[13.2px]">Hospital Regional</td>
                  </tr>
                  <tr className="hover:bg-gray-50 border-b border-cream">
                    <td className="px-4 py-3 font-medium text-[14.3px]">Andrea Silva</td>
                    <td className="px-4 py-3 text-[14.3px] text-gray-500">asilva@andina.cl</td>
                    <td className="px-4 py-3"><span className="badge b-blue">Finanzas / Pagos</span></td>
                    <td className="px-4 py-3 text-[13.2px]">Todos</td>
                  </tr>
                </tbody>
              </table>
              </div>
            </div>
          )}

          {/* BLOQUE 3: ALERTAS AUTOMÁTICAS MOCK */}
          {activeConfigTab === 'alertas' && (
            <div className="card">
              <h3 className="section-title mb-4">Alertas Automáticas</h3>
              <p className="text-[13.2px] text-gray-500 mb-4">Configura las alertas y notificaciones automáticas que envía el sistema a los contratistas.</p>
              <div className="flex flex-col gap-3">
                <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <div>
                    <div className="text-[14px] font-semibold text-navy">Notificación de Vencimiento Próximo</div>
                    <div className="text-[12px] text-gray-500">Enviar aviso automático 15 días antes del vencimiento.</div>
                  </div>
                  <ToggleRight size={28} className="text-[#2a6a3a] cursor-pointer" />
                </div>
              </div>
            </div>
          )}

          {/* BLOQUE 4: INTEGRACIONES DESTACADAS */}
          {activeConfigTab === 'api' && (
            <div className="card border-l-4 border-l-brown">
              <div className="flex flex-col sm:flex-row items-start gap-4">
                <div className="w-12 h-12 bg-cream rounded-xl flex items-center justify-center shrink-0">
                  <Plug className="text-brown" size={24} />
                </div>
                <div className="flex-1">
                  <div className="flex justify-between items-start mb-1">
                    <h3 className="text-[16.5px] font-medium text-navy">Integración de Control de Acceso (Torniquetes)</h3>
                    <span className="badge b-yellow">Inactivo</span>
                  </div>
                  <p className="text-[13.2px] text-gray-500 mb-3 leading-relaxed">
                    Conecta Acredita con tu sistema físico de ingreso. Si un trabajador de una empresa contratista tiene sus documentos de seguridad vencidos (ej. ODI o Examen de Altura), la barrera bloqueará su acceso automáticamente.
                  </p>
                  <div className="flex gap-2">
                    <button className="btn btn-secondary btn-sm cursor-not-allowed opacity-50 font-medium" disabled title="No disponible en demo">Generar API Key [Demo]</button>
                    <button className="btn btn-ghost btn-sm cursor-not-allowed opacity-50 font-medium" disabled title="No disponible en demo">Ver Documentación [Demo]</button>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
