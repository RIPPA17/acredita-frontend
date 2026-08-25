import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Bell, LayoutDashboard, Folder, Users,
  Settings, LogOut, AlertCircle, AlertTriangle, Info, Plus, ArrowRight,
  Eye, Download, FileText, CheckCircle, Calendar, ArrowLeft, UserPlus, XCircle, FileCheck, Send,
  Check, X, SlidersHorizontal, Table, Clock, ShieldCheck, Zap, Sparkles, TrendingUp,
  Building2, Plug, Save, ShieldAlert, ToggleRight, FolderOpen, ClipboardList,
  Pencil, Archive, Trash2, ChevronRight, MapPin, CalendarDays, Briefcase, Key, Activity, Menu, ChevronLeft
} from 'lucide-react';
import { getContratistas, saveContratistas, getProyectos, saveProyectos, getMandantes, calcularEstadoAcreditacion, calcularEstadoTrabajador, getRequisitos, saveRequisitos, esVencidoPorFecha, calcularAccesoPago, getAlertasVigencia, esPorVencerPorFecha, logoutUser, getCurrentSession, nombresDocumentoCoinciden } from '../data/localStorageDb';
import { Contratista, Mandante } from '../types';
import ConfigTab from './mandante/ConfigTab';
import type { ConfigTabId } from './mandante/config/configUtils';
import DashboardTab from './mandante/DashboardTab';
import ProyectosTab from './mandante/ProyectosTab';
import ContratistasTab from './mandante/ContratistasTab';
import ContractorInvitationModal from '../components/ContractorInvitationModal';

export default function MandantePortal() {
  const session = getCurrentSession();
  const mandanteLogueado = session?.role === 'mandante' && session.mandanteId
    ? getMandantes().find(m => m.id === session.mandanteId)
    : undefined;
  return mandanteLogueado
    ? <MandantePortalContent mandanteLogueado={mandanteLogueado} />
    : <InvalidMandanteSession />;
}

function InvalidMandanteSession() {
  React.useEffect(() => {
    logoutUser();
    window.location.replace('/');
  }, []);
  return null;
}

function MandantePortalContent({ mandanteLogueado }: { mandanteLogueado: Mandante }) {
  const navigate = useNavigate();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    return localStorage.getItem('sidebar_collapsed') === 'true';
  });

  const toggleSidebar = () => {
    const nextState = !sidebarCollapsed;
    setSidebarCollapsed(nextState);
    localStorage.setItem('sidebar_collapsed', String(nextState));
  };
  const [activeTab, setActiveTab] = useState('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeConfigTab, setActiveConfigTab] = useState<ConfigTabId>('empresa');
  const [configHasUnsavedChanges, setConfigHasUnsavedChanges] = useState(false);
  const [showNotif, setShowNotif] = useState(false);
  const [activeProjectTab, setActiveProjectTab] = useState('resumen');
  const [editingContractorId, setEditingContractorId] = useState<string | null>(null);
  const [toast, setToast] = useState<{msg: string, type: 'success'|'error'|'warning'} | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [vistaContratistas, setVistaContratistas] = useState<'proyectos' | string>('proyectos');
  const [selectedContratista, setSelectedContratista] = useState<string | null>(null);
  const [contractorFocus, setContractorFocus] = useState<{ projectId: string; workerRut?: string } | null>(null);
  const [ajustesEditando, setAjustesEditando] = useState(false);
  const [proyectoArchivado, setProyectoArchivado] = useState(false);
  const [proyectoSeleccionadoAjustes, setProyectoSeleccionadoAjustes] = useState<string | null>(null);

  const allProyectos = getProyectos();
  const allContratistas = getContratistas();

  const misProyectos = allProyectos.filter(p => p.mandanteId === mandanteLogueado.id);

  const PROYECTOS_AJUSTES = misProyectos.map(p => ({
    id: p.id,
    nombre: p.nombre,
    estado: p.estado,
    badge: p.id === 'costanera' ? 'b-red' : p.id === 'mackenna' ? 'b-yellow' : 'b-green'
  }));

  const goToProject = (projectId: string) => {
    setSelectedProjectId(projectId);
    setProyectoSeleccionadoAjustes(projectId);
    setActiveTab('proyectos');
    setActiveProjectTab('resumen');
  };

  const showToast = (msg: string, type: 'success'|'error'|'warning' = 'success') => {
    setToast({msg, type});
    setTimeout(() => setToast(null), 2500);
  };

  const changeMainTab = (nextTab: string) => {
    if (activeTab === 'config' && nextTab !== 'config' && configHasUnsavedChanges) {
      const shouldLeave = window.confirm('Tienes cambios sin guardar. ¿Quieres salir sin guardar?');
      if (!shouldLeave) return false;
    }
    setActiveTab(nextTab);
    return true;
  };

  const handleCellEdit = () => {
    showToast('Requisito actualizado');
  };

  const [isAddDocModalOpen, setIsAddDocModalOpen] = useState(false);
  const [newDocForm, setNewDocForm] = useState({ name: '', category: 'Laboral', frequency: 'Mensual', destino: 'empresa', obligatorio: true, criticidad: 'bloquea_pago' });

  const [showInvitarModal, setShowInvitarModal] = useState(false);
  const [formInvitacion, setFormInvitacion] = useState({correo: '', contratistaId: '', proyectoId: '', mensaje: ''});
  const [documentRequirements, setDocumentRequirements] = useState<any[]>([]);

  const activeProjectId = selectedProjectId || misProyectos[0]?.id || '';

  React.useEffect(() => {
    const reqs = getRequisitos().filter(r => r.proyectoId === activeProjectId && r.activo !== false);
    setDocumentRequirements(reqs.map(r => ({
      id: r.id,
      name: r.nombre,
      category: r.categoria,
      frequency: r.frecuencia,
      obligatorio: r.obligatorio,
      destino: r.destino,
      criticidad: r.criticidad,
      alertaDias: r.alertaDias
    })));
    setContractorsData(buildContractorsData(allContratistas, activeProjectId));
  }, [activeProjectId]);

  const buildContractorsData = (contratistasList: Contratista[], projId: string) => {
    const projReqs = getRequisitos().filter(r => r.proyectoId === projId && r.activo !== false);

    return contratistasList.filter(c => 
      c.proyectos.includes(projId)
    ).map(c => {
      const reqs: Record<string, boolean> = {};
      const status: Record<string, string> = {};

      projReqs.forEach(req => {
        reqs[req.id] = req.obligatorio;
        if (req.destino === 'empresa') {
          const doc = c.documentos.find(d =>
            d.proyectoId === projId && nombresDocumentoCoinciden(d.nombre, req.nombre)
          );
          status[req.id] = doc ? (doc.estado === 'aprobado' ? 'ok' : doc.estado === 'por_vencer' ? 'warn' : doc.estado === 'rechazado' ? 'error' : 'pending') : 'na';
        } else {
          const workers = c.trabajadores || [];
          if (workers.length === 0) {
            status[req.id] = 'na';
          } else {
            let hasError = false;
            let hasPending = false;
            let hasWarn = false;
            
            workers.forEach(w => {
              const doc = w.documentos?.find(d =>
                d.proyectoId === projId && nombresDocumentoCoinciden(d.nombre, req.nombre)
              );
              if (!doc) {
                if (req.obligatorio) hasPending = true;
              } else {
                const isVencido = esVencidoPorFecha(doc.vencimiento);
                if (doc.estado === 'rechazado' || isVencido) hasError = true;
                else if (doc.estado === 'pendiente' || doc.estado === 'revision') hasPending = true;
                else if (doc.estado === 'por_vencer') hasWarn = true;
              }
            });

            if (hasError) status[req.id] = 'error';
            else if (hasPending) status[req.id] = 'pending';
            else if (hasWarn) status[req.id] = 'warn';
            else status[req.id] = 'ok';
          }
        }
      });

      return {
        id: c.id,
        name: c.nombre,
        rut: c.rut,
        reqs,
        status,
        isNew: c.isNew
      };
    });
  };

  const [contractorsData, setContractorsData] = useState<any[]>([]);

  const handleAddRequirement = () => {
    if (!newDocForm.name.trim()) return;
    const newId = `${activeProjectId}_${newDocForm.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;

    const newReq = {
      id: newId,
      nombre: newDocForm.name,
      categoria: (newDocForm.category === 'Prevención de Riesgos' ? 'Prevención' : newDocForm.category) as 'Laboral' | 'Tributario' | 'Prevención',
      destino: newDocForm.destino as 'empresa' | 'trabajador',
      obligatorio: newDocForm.obligatorio,
      frecuencia: newDocForm.frequency,
      alertaDias: newDocForm.destino === 'trabajador' ? 15 : 7,
      criticidad: newDocForm.criticidad as 'bloquea_pago' | 'bloquea_acceso' | 'advertencia',
      proyectoId: activeProjectId,
      activo: true
    };

    const currentReqs = getRequisitos();
    saveRequisitos([...currentReqs, newReq]);

    // Reload states
    const updatedReqs = getRequisitos().filter(r => r.proyectoId === activeProjectId && r.activo !== false);
    setDocumentRequirements(updatedReqs.map(r => ({
      id: r.id,
      name: r.nombre,
      category: r.categoria,
      frequency: r.frecuencia,
      obligatorio: r.obligatorio,
      destino: r.destino,
      criticidad: r.criticidad,
      alertaDias: r.alertaDias
    })));
    setContractorsData(buildContractorsData(allContratistas, activeProjectId));

    setIsAddDocModalOpen(false);
    setNewDocForm({ name: '', category: 'Laboral', frequency: 'Mensual', destino: 'empresa', obligatorio: true, criticidad: 'bloquea_pago' });
    showToast('Requisito agregado con éxito');
  };

  const menuItems = [
    { id: 'dashboard', label: 'Inicio', icon: LayoutDashboard },
    { id: 'proyectos', label: 'Proyectos', icon: Folder },
    { id: 'contratistas', label: 'Contratistas', icon: Building2 },
    { id: 'config', label: 'Configuración', icon: Settings },
  ];

  return (
    <div className="h-screen flex flex-col font-sans bg-cream2 text-navy">
      {/* TOPBAR */}
      <div className="topbar">
        <div className="logo flex-shrink-0 flex items-center">
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="md:hidden text-cream hover:text-white mr-3 focus:outline-none"
            title="Abrir menú"
          >
            <Menu size={20} className="text-cream" />
          </button>
          Acre<b>dita</b>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative">
            <button 
              onClick={() => setShowNotif(!showNotif)}
              className="flex items-center justify-center relative w-8 h-8 rounded-md bg-white/10 text-cream hover:bg-white/20 transition-colors">
              <Bell size={18} />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-[#c03030] rounded-full border border-navy"></span>
            </button>

            {showNotif && <div className="fixed inset-0 z-[299]" onClick={() => setShowNotif(false)} />}
            
            {showNotif && (
              <div className="absolute top-11 w-[calc(100vw-24px)] max-w-[340px] bg-white rounded-xl shadow-2xl border border-cream3 z-[300] right-3 sm:right-0">
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-cream3 text-left">
                  <span className="font-semibold text-navy text-[15px]">Notificaciones</span>
                  <span className="badge b-red">2 urgentes</span>
                </div>

                {/* Items */}
                <div className="flex flex-col divide-y divide-cream3 max-h-[400px] overflow-y-auto w-full">
                  <div 
                    onClick={() => {
                      setActiveTab('proyectos');
                      setActiveProjectTab('contratistas');
                      setVistaContratistas('costanera');
                      setSelectedContratista('constructora-velez');
                      setShowNotif(false);
                    }}
                    className="flex items-start gap-3 px-4 py-3 bg-red-50 hover:bg-red-100/60 transition-colors cursor-pointer text-left"
                  >
                    <AlertCircle size={18} className="text-red-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-[13.8px] font-semibold text-red-700">3 documentos sin revisar +24hrs</p>
                      <p className="text-[12.5px] text-red-500 mt-0.5">Requieren atención urgente — cola de revisión</p>
                      <p className="text-[11.5px] text-gray-400 mt-1">Hace 2 horas</p>
                    </div>
                  </div>
                  <div 
                    onClick={() => {
                      setActiveTab('proyectos');
                      setActiveProjectTab('requisitos');
                      setShowNotif(false);
                    }}
                    className="flex items-start gap-3 px-4 py-3 bg-yellow-50 hover:bg-yellow-100/60 transition-colors cursor-pointer text-left"
                  >
                    <AlertTriangle size={18} className="text-yellow-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-[13.8px] font-semibold text-yellow-800">Plantilla "F30 SII" desactualizada</p>
                      <p className="text-[12.5px] text-yellow-700 mt-0.5">Revisar antes del 31 de mayo — Gestión de plantillas</p>
                      <p className="text-[11.5px] text-gray-400 mt-1">Hace 5 horas</p>
                    </div>
                  </div>
                  <div 
                    onClick={() => {
                      setActiveTab('proyectos');
                      setActiveProjectTab('contratistas');
                      setVistaContratistas('mackenna');
                      setSelectedContratista('electrica-sur');
                      setShowNotif(false);
                    }}
                    className="flex items-start gap-3 px-4 py-3 hover:bg-cream2 transition-colors cursor-pointer text-left"
                  >
                    <CheckCircle size={18} className="text-green-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-[13.8px] font-medium text-navy">Eléctrica Sur aprobó contrato de trabajo</p>
                      <p className="text-[11.5px] text-gray-400 mt-1">Hace 6 horas</p>
                    </div>
                  </div>
                  <div 
                    onClick={() => {
                      setActiveTab('proyectos');
                      setActiveProjectTab('contratistas');
                      setVistaContratistas('mackenna');
                      setSelectedContratista('tecnicosur');
                      setShowNotif(false);
                    }}
                    className="flex items-start gap-3 px-4 py-3 hover:bg-cream2 transition-colors cursor-pointer text-left"
                  >
                    <Users size={18} className="text-blue-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-[13.8px] font-medium text-navy">TécnicoSur SpA se registró en la plataforma</p>
                      <p className="text-[11.5px] text-gray-400 mt-1">Hace 8 horas</p>
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div className="px-4 py-2.5 border-t border-cream3 text-center">
                  <button 
                    onClick={() => setShowNotif(false)}
                    className="text-[13px] text-brown hover:underline font-medium">
                    Marcar todas como leídas
                  </button>
                </div>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition">
            <div className="w-8 h-8 rounded-full bg-brown text-[var(--brown-text,white)] flex items-center justify-center text-[13.2px] font-semibold">{mandanteLogueado.nombre.split(/\s+/).slice(0, 2).map(word => word[0]).join('').toUpperCase()}</div>
            <span className="text-[14.3px] text-cream hidden md:block">{mandanteLogueado.nombre}</span>
          </div>
        </div>
      </div>

      <div className="layout">
        {/* SIDEBAR */}
        <aside className={`hidden md:flex sidebar flex-col ${sidebarCollapsed ? 'collapsed' : ''}`}>
          <div className={`sb-org flex ${sidebarCollapsed ? 'flex-col items-center gap-2' : 'justify-between items-center'} px-4 py-3 border-b border-white/5`}>
            {!sidebarCollapsed && (
              <div className="truncate flex-1">
                <div className="sb-org-name truncate">{mandanteLogueado.nombre}</div>
                <div className="sb-org-sub truncate">Plan Pro · 3 proyectos</div>
              </div>
            )}
            {sidebarCollapsed && (
              <div className="w-8 h-8 rounded-lg bg-brown text-white flex items-center justify-center font-bold text-sm shrink-0">
                C
              </div>
            )}
            <button 
              onClick={toggleSidebar} 
              className="text-gray-400 hover:text-white p-1 hover:bg-white/10 rounded-lg cursor-pointer transition-colors animate-fade-in"
              title={sidebarCollapsed ? "Expandir menú" : "Colapsar menú"}
            >
              {sidebarCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
            </button>
          </div>
          
          <div className="sb-label">Principal</div>
          {menuItems.map(item => (
            <React.Fragment key={item.id}>
              <button 
                onClick={() => changeMainTab(item.id)}
                className={`sb-item w-full flex text-left ${activeTab === item.id ? 'active' : ''}`}
                title={sidebarCollapsed ? item.label : undefined}
              >
                <item.icon size={18} className="shrink-0" /> 
                <span className="flex-1">{item.label}</span>
              </button>
            </React.Fragment>
          ))}
          
          <div className="sb-bottom">
            <button 
              className="sb-item w-full flex text-left mt-auto" 
              onClick={() => { logoutUser(); navigate('/'); }}
              title={sidebarCollapsed ? "Cerrar sesión" : undefined}
            >
              <LogOut size={18} className="shrink-0" /> 
              <span className="flex-1">Cerrar sesión</span>
            </button>
          </div>
        </aside>

        {/* Mobile Sidebar Drawer Overlay */}
        {mobileMenuOpen && (
          <>
            <div 
              className="fixed inset-0 bg-black/60 z-[998] md:hidden" 
              onClick={() => setMobileMenuOpen(false)} 
            />
            <div className="fixed left-0 top-0 bottom-0 w-[260px] bg-navy z-[999] md:hidden flex flex-col pt-4 overflow-y-auto text-left shadow-2xl animate-slide-right">
              <div className="sb-org flex justify-between items-center pr-3 pb-3 border-b border-white/10">
                <div>
                  <div className="sb-org-name">{mandanteLogueado.nombre}</div>
                  <div className="sb-org-sub">Plan Pro · 3 proyectos activos</div>
                </div>
                <button onClick={() => setMobileMenuOpen(false)} className="text-gray-400 hover:text-white p-1">
                  <X size={20} />
                </button>
              </div>

              <div className="sb-label">Principal</div>
              {menuItems.map(item => (
                <React.Fragment key={item.id}>
                  <button 
                    onClick={() => { if (changeMainTab(item.id)) setMobileMenuOpen(false); }}
                    className={`sb-item w-full flex text-left ${activeTab === item.id ? 'active' : ''}`}
                  >
                    <item.icon size={18} className="shrink-0" /> 
                    <span className="flex-1">{item.label}</span>
                  </button>
                </React.Fragment>
              ))}
              
              <div className="sb-bottom">
                <button className="sb-item w-full flex text-left mt-auto" onClick={() => { logoutUser(); setMobileMenuOpen(false); navigate('/'); }}>
                  <LogOut size={18} /> Cerrar sesión
                </button>
              </div>
            </div>
          </>
        )}

        {/* MAIN CONTENT */}
        <div className="main pb-20 lg:pb-0">
          
          {/* DASHBOARD TAB */}
          {activeTab === 'dashboard' && (
            <DashboardTab
              allContratistas={allContratistas}
              misProyectos={misProyectos}
              onOpenProject={goToProject}
              onOpenContractor={(projectId, contractorId) => {
                setSelectedProjectId(projectId);
                setSelectedContratista(contractorId);
                setContractorFocus({ projectId });
                setActiveTab('contratistas');
              }}
              onOpenWorker={(projectId, contractorId, workerRut) => {
                setSelectedProjectId(projectId);
                setSelectedContratista(contractorId);
                setContractorFocus({ projectId, workerRut });
                setActiveTab('contratistas');
              }}
            />
          )}

          {/* PROYECTOS WIDE-CONTAINER WITH SUBTABS */}
          {activeTab === 'proyectos' && (
            <ProyectosTab
              activeProjectTab={activeProjectTab}
              setActiveProjectTab={setActiveProjectTab}
              vistaContratistas={vistaContratistas}
              setVistaContratistas={setVistaContratistas}
              misProyectos={misProyectos}
              allContratistas={allContratistas}
              selectedContratista={selectedContratista}
              setSelectedContratista={setSelectedContratista}
              proyectoSeleccionadoAjustes={proyectoSeleccionadoAjustes}
              setProyectoSeleccionadoAjustes={setProyectoSeleccionadoAjustes}
              PROYECTOS_AJUSTES={PROYECTOS_AJUSTES}
              ajustesEditando={ajustesEditando}
              setAjustesEditando={setAjustesEditando}
              showToast={showToast}
              newDocForm={newDocForm}
              setNewDocForm={setNewDocForm}
              isAddDocModalOpen={isAddDocModalOpen}
              setIsAddDocModalOpen={setIsAddDocModalOpen}
              proyectoArchivado={proyectoArchivado}
              setProyectoArchivado={setProyectoArchivado}
              selectedProjectId={selectedProjectId}
              setSelectedProjectId={setSelectedProjectId}
              setShowInvitarModal={setShowInvitarModal}
              contractorsData={contractorsData}
              documentRequirements={documentRequirements}
              editingContractorId={editingContractorId}
              setEditingContractorId={setEditingContractorId}
              handleCellEdit={handleCellEdit}
              handleAddRequirement={handleAddRequirement}
              setDocumentRequirements={setDocumentRequirements}
              onOpenContractor={(projectId, contractorId) => {
                setSelectedProjectId(projectId);
                setSelectedContratista(contractorId);
                setContractorFocus({ projectId });
                setActiveTab('contratistas');
              }}
            />
          )}

          {/* CONTRATISTAS DEL MANDANTE */}
          {activeTab === 'contratistas' && (
            <ContratistasTab
              misProyectos={misProyectos}
              allContratistas={allContratistas}
              selectedContratista={selectedContratista}
              setSelectedContratista={setSelectedContratista}
              focus={contractorFocus}
              onClearFocus={() => setContractorFocus(null)}
              onSetFocus={focus => setContractorFocus(focus)}
              onOpenProject={projectId => {
                setSelectedProjectId(projectId);
                setVistaContratistas(projectId);
                setActiveProjectTab('acreditaciones');
                setActiveTab('proyectos');
              }}
            />
          )}

          {/* CONFIGURACIÓN Y PREFERENCIAS */}
          {activeTab === 'config' && (
            <ConfigTab activeConfigTab={activeConfigTab} setActiveConfigTab={setActiveConfigTab} showToast={showToast} misProyectos={misProyectos} mandante={mandanteLogueado} onDirtyChange={setConfigHasUnsavedChanges} />
          )}

          {/* MOBILE NAVBAR */}
          <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex md:hidden z-50">
            {menuItems.map(item => (
              <button key={item.id} onClick={() => changeMainTab(item.id)}
                className={`flex-1 flex flex-col items-center py-3 text-[11px] gap-1
                  ${activeTab === item.id ? 'text-brown font-semibold' : 'text-gray-400'}`}>
                <item.icon size={20} />
                {item.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {toast && (
        <div className={`fixed bottom-6 right-6 z-[999] px-5 py-3 rounded-xl shadow-lg text-white text-sm font-medium flex items-center gap-2
          ${toast.type === 'success' ? 'bg-green-600' : toast.type === 'error' ? 'bg-red-500' : 'bg-yellow-500'}`}>
          {toast.type === 'success' && <CheckCircle size={18} />}
          {toast.type === 'warning' && <AlertTriangle size={18} />}
          {toast.type === 'error' && <XCircle size={18} />}
          {toast.msg}
        </div>
      )}

      <ContractorInvitationModal
  open={showInvitarModal}
  onClose={() => setShowInvitarModal(false)}
  contractors={allContratistas}
  projects={misProyectos}
  showToast={showToast}
/>
    </div>
  );
}
