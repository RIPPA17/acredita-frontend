import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Bell, LayoutDashboard, Folder, Users, ListChecks, Banknote, BarChart3, 
  Settings, LogOut, AlertCircle, AlertTriangle, Info, Plus, ArrowRight,
  Eye, Download, FileText, CheckCircle, Calendar, ArrowLeft, UserPlus, XCircle, FileCheck, Send,
  Check, X, SlidersHorizontal, Table, Clock, ShieldCheck, Zap, Sparkles, TrendingUp,
  Building2, Plug, Save, ShieldAlert, ToggleRight, FolderOpen, ClipboardList,
  Pencil, Archive, Trash2, ChevronRight, MapPin, CalendarDays, Briefcase, Key, Activity, Menu
} from 'lucide-react';
import { getContratistas, saveContratistas, getProyectos, saveProyectos, getMandantes, getPlantillas, savePlantillas, calcularEstadoAcreditacion, calcularEstadoTrabajador, getRequisitos, saveRequisitos, esVencidoPorFecha, calcularAccesoPago, getAlertasVigencia, esPorVencerPorFecha, getInvitaciones, saveInvitaciones, esTrabajadorAsignado, getCurrentSession, logoutUser, crearInvitacion, registrarAuditoria } from '../data/localStorageDb';
import { Contratista } from '../types';
import FichaAcreditacion from '../components/FichaAcreditacion';

export default function MandantePortal() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeConfigTab, setActiveConfigTab] = useState<'perfil' | 'equipo' | 'alertas' | 'api'>('perfil');
  const [showNotif, setShowNotif] = useState(false);
  const [activeProjectTab, setActiveProjectTab] = useState('contratistas');
  const [proyectosView, setProyectosView] = useState('lista_proyectos');
  const [editingContractorId, setEditingContractorId] = useState<string | null>(null);
  const [toast, setToast] = useState<{msg: string, type: 'success'|'error'|'warning'} | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [vistaContratistas, setVistaContratistas] = useState<'proyectos' | string>('proyectos');
  const [selectedContratista, setSelectedContratista] = useState<string | null>(null);
  const [clienteSeleccionado, setClienteSeleccionado] = useState<any>(null);
  const [fichaTrabajador, setFichaTrabajador] = useState<any>(undefined);
  const [filtroControl, setFiltroControl] = useState<'todos' | 'aprobados' | 'en_proceso' | 'bloqueados' | 'atencion'>('todos');
  const [dashboardSubTab, setDashboardSubTab] = useState<'contratistas' | 'trabajadores'>('contratistas');
  const [filtroDoc, setFiltroDoc] = useState<string | null>(null);
  const [ajustesEditando, setAjustesEditando] = useState(false);
  const [proyectoArchivado, setProyectoArchivado] = useState(false);
  const [proyectoSeleccionadoAjustes, setProyectoSeleccionadoAjustes] = useState<string | null>(null);

  const allMandantes = getMandantes();
  const allProyectos = getProyectos();
  const allContratistas = getContratistas();
  const allPlantillas = getPlantillas();

  const session = getCurrentSession();
  const mandanteLogueado = allMandantes.find(m => m.id === session?.mandanteId) || allMandantes[0];
  const misProyectos = allProyectos.filter(p => p.mandanteId === mandanteLogueado.id);

  const PROYECTOS_AJUSTES = misProyectos.map(p => ({
    id: p.id,
    nombre: p.nombre,
    estado: p.estado,
    badge: p.id === 'costanera' ? 'b-red' : p.id === 'mackenna' ? 'b-yellow' : 'b-green'
  }));

  const DOCS_CONTRATISTAS: Record<string, any[]> = {};
  allContratistas.forEach(c => {
    DOCS_CONTRATISTAS[c.id] = c.documentos.map(d => ({
      id: d.id,
      nombre: d.nombre,
      categoria: d.categoria,
      estado: d.estado,
      vencimiento: d.vencimiento,
      motivo: d.motivo || d.observacion
    }));
  });

  const goToProject = (projectId: string) => {
    setSelectedProjectId(projectId);
    setActiveTab('proyectos');
    setActiveProjectTab('contratistas');
  };
  const [onboardingStep, setOnboardingStep] = useState<number | null>(1);

  const [projectsData, setProjectsData] = useState([1, 2]);

  const showToast = (msg: string, type: 'success'|'error'|'warning' = 'success') => {
    setToast({msg, type});
    setTimeout(() => setToast(null), 2500);
  };

  const handleCellEdit = () => {
    showToast('Requisito actualizado');
  };

  const [isAddDocModalOpen, setIsAddDocModalOpen] = useState(false);
  const [newDocForm, setNewDocForm] = useState({ name: '', category: 'Laboral', frequency: 'Mensual', destino: 'empresa', obligatorio: true, criticidad: 'bloquea_pago' });

  const [showInvitarModal, setShowInvitarModal] = useState(false);
  const [formInvitacion, setFormInvitacion] = useState({correo: '', contratistaId: '', proyectoId: '', mensaje: ''});
  const [documentRequirements, setDocumentRequirements] = useState<any[]>([]);

  // Aislamiento de datos: Filtrar el proyecto seleccionado si no pertenece al mandante logueado
  const isProjValido = selectedProjectId ? misProyectos.some(p => p.id === selectedProjectId) : false;
  const activeProjectId = isProjValido ? selectedProjectId! : (misProyectos[0]?.id || '');

  // Aislamiento de datos: Contratistas permitidos para este mandante
  const permitidosContratistasIds = React.useMemo(() => {
    const ids = new Set<string>();
    misProyectos.forEach(p => {
      p.contratistas?.forEach(cid => ids.add(cid));
    });
    return ids;
  }, [misProyectos]);

  // Si vistaContratistas es un ID de contratista que no pertenece a los proyectos del mandante, hacemos fallback
  const activeContractorId = (vistaContratistas !== 'proyectos' && vistaContratistas !== 'config_req') ? vistaContratistas : null;
  React.useEffect(() => {
    if (activeContractorId && !permitidosContratistasIds.has(activeContractorId)) {
      setVistaContratistas('proyectos');
    }
  }, [vistaContratistas, permitidosContratistasIds, activeContractorId]);

  React.useEffect(() => {
    if (!activeProjectId) return;
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
  }, [activeProjectId, allProyectos]);

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
            d.nombre.toLowerCase().includes(req.nombre.toLowerCase()) || 
            req.nombre.toLowerCase().includes(d.nombre.toLowerCase())
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
                d.nombre.toLowerCase().includes(req.nombre.toLowerCase()) || 
                req.nombre.toLowerCase().includes(d.nombre.toLowerCase())
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

    const session = getCurrentSession();
    registrarAuditoria({
      usuarioId: session?.email || mandanteLogueado.id,
      rol: 'mandante',
      accion: 'cambio_requisitos',
      entidad: 'requisito',
      entidadId: newReq.id,
      proyectoId: activeProjectId,
      estadoNuevo: 'activo',
      detalle: `Agregado requisito ${newReq.nombre} para ${newReq.destino} con criticidad ${newReq.criticidad}`
    });

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
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'proyectos', label: 'Proyectos', icon: Folder },
    { id: 'reportes', label: 'Reportes', icon: BarChart3, section: 'Gestión' },
    { id: 'config', label: 'Configuración', icon: Settings, section: 'Cuenta' },
  ];

  if (onboardingStep !== null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cream2 p-4 font-sans text-navy">
        <div className="card w-full max-w-[480px] shadow-xl border-none">
          <div className="text-center mb-6">
            <div className="text-[13.2px] font-semibold text-gray-500 uppercase tracking-widest mb-2">
              Paso {onboardingStep} de 3
            </div>
            <div className="flex justify-center gap-2">
              {[1, 2, 3].map((step) => (
                <div 
                  key={step} 
                  className={`w-2 h-2 rounded-full ${step <= onboardingStep ? 'bg-brown' : 'bg-gray-300'}`}
                ></div>
              ))}
            </div>
          </div>

          {onboardingStep === 1 && (
            <div className="fade-in">
              <h2 className="section-title text-center text-xl mb-6">Configura tu empresa</h2>
              <div className="flex flex-col gap-4 mb-6">
                <div>
                  <label className="block text-[13.2px] font-medium text-gray-700 mb-1">RUT Empresa</label>
                  <input type="text" className="form-input w-full" placeholder="76.123.456-7" />
                </div>
                <div>
                  <label className="block text-[13.2px] font-medium text-gray-700 mb-1">Nombre Empresa</label>
                  <input type="text" className="form-input w-full" placeholder="Constructora Andina SA" />
                </div>
              </div>
              <button 
                className="btn btn-primary w-full justify-center text-[15.4px] py-2.5"
                onClick={() => setOnboardingStep(2)}
              >
                Continuar →
              </button>
            </div>
          )}

          {onboardingStep === 2 && (
            <div className="fade-in">
              <h2 className="section-title text-center text-xl mb-6">Crea tu primer proyecto</h2>
              <div className="flex flex-col gap-4 mb-6">
                <div>
                  <label className="block text-[13.2px] font-medium text-gray-700 mb-1">Nombre proyecto</label>
                  <input type="text" className="form-input w-full" placeholder="Torre Mackenna" />
                </div>
                <div>
                  <label className="block text-[13.2px] font-medium text-gray-700 mb-1">Fecha de cierre</label>
                  <input type="date" className="form-input w-full" />
                </div>
              </div>
              <button 
                className="btn btn-primary w-full justify-center text-[15.4px] py-2.5"
                onClick={() => setOnboardingStep(3)}
              >
                Continuar →
              </button>
            </div>
          )}

          {onboardingStep === 3 && (
            <div className="fade-in">
              <h2 className="section-title text-center text-xl mb-6">Invita a tu primer contratista</h2>
              <div className="flex flex-col gap-4 mb-6">
                <div>
                  <label className="block text-[13.2px] font-medium text-gray-700 mb-1">Email del contratista</label>
                  <div className="flex gap-2">
                    <input type="email" className="form-input w-full" placeholder="contacto@empresa.cl" />
                    <button className="btn btn-secondary whitespace-nowrap cursor-not-allowed opacity-55" disabled title="No disponible en demo">Enviar invitación [Demo]</button>
                  </div>
                </div>
              </div>
              <button 
                className="btn btn-primary w-full justify-center text-[15.4px] py-2.5"
                onClick={() => setOnboardingStep(null)}
              >
                Ir al dashboard
              </button>
            </div>
          )}

          <div className="mt-4 text-center">
            <button 
              className="text-[13.2px] text-gray-400 hover:text-navy transition-colors underline"
              onClick={() => setOnboardingStep(null)}
            >
              Saltar por ahora
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col font-sans bg-cream2 text-navy">
      {/* TOPBAR */}
      <div className="topbar">
        <div className="logo flex-shrink-0 flex items-center">
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="lg:hidden text-cream hover:text-white mr-3 focus:outline-none"
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
                      setFiltroDoc('rechazado');
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
                      setActiveProjectTab('checklist');
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
                      setFiltroDoc('aprobado');
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
            <div className="w-8 h-8 rounded-full bg-brown text-[var(--brown-text,white)] flex items-center justify-center text-[13.2px] font-semibold">CA</div>
            <span className="text-[14.3px] text-cream hidden md:block">Constructora Andina SA</span>
          </div>
        </div>
      </div>

      <div className="layout">
        {/* SIDEBAR */}
        <aside className="hidden lg:flex sidebar flex-col">
          <div className="sb-org">
            <div className="sb-org-name">Constructora Andina SA</div>
            <div className="sb-org-sub">Plan Pro · 3 proyectos activos</div>
          </div>
          
          <div className="sb-label">Principal</div>
          {menuItems.map(item => (
            <React.Fragment key={item.id}>
              {item.section && <div className="sb-label mt-2">{item.section}</div>}
              <button 
                onClick={() => setActiveTab(item.id)}
                className={`sb-item w-full flex text-left ${activeTab === item.id ? 'active' : ''}`}
              >
                <item.icon size={18} className="shrink-0" /> 
                <span className="flex-1">{item.label}</span>
              </button>
            </React.Fragment>
          ))}
          
          <div className="sb-bottom">
            <button className="sb-item w-full flex text-left mt-auto" onClick={() => { logoutUser(); navigate('/'); }}>
              <LogOut size={18} /> Cerrar sesión
            </button>
          </div>
        </aside>

        {/* Mobile Sidebar Drawer Overlay */}
        {mobileMenuOpen && (
          <>
            <div 
              className="fixed inset-0 bg-black/60 z-[998] lg:hidden" 
              onClick={() => setMobileMenuOpen(false)} 
            />
            <div className="fixed left-0 top-0 bottom-0 w-[260px] bg-navy z-[999] lg:hidden flex flex-col pt-4 overflow-y-auto text-left shadow-2xl animate-slide-right">
              <div className="sb-org flex justify-between items-center pr-3 pb-3 border-b border-white/10">
                <div>
                  <div className="sb-org-name">Constructora Andina SA</div>
                  <div className="sb-org-sub">Plan Pro · 3 proyectos activos</div>
                </div>
                <button onClick={() => setMobileMenuOpen(false)} className="text-gray-400 hover:text-white p-1">
                  <X size={20} />
                </button>
              </div>

              <div className="sb-label">Principal</div>
              {menuItems.map(item => (
                <React.Fragment key={item.id}>
                  {item.section && <div className="sb-label mt-2">{item.section}</div>}
                  <button 
                    onClick={() => { setActiveTab(item.id); setMobileMenuOpen(false); }}
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
          {activeTab === 'dashboard' && (() => {
            const todayStr = new Date().toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
            const formattedDate = todayStr.charAt(0).toUpperCase() + todayStr.slice(1);

            const projReqs = getRequisitos().filter(r => r.proyectoId === activeProjectId && r.activo !== false);

            const projContractors = allContratistas.filter(c => c.proyectos.includes(activeProjectId));
            
            const projWorkers = projContractors.flatMap(c => 
              (c.trabajadores || []).filter(w => 
                esTrabajadorAsignado(w, activeProjectId, allProyectos)
              )
            );

            const countContractors = projContractors.length;
            const countWorkers = projWorkers.length;

            const countApprovedWorkers = projWorkers.filter(w => calcularEstadoTrabajador(w, activeProjectId) === 'aprobado').length;
            const countPendingWorkers = projWorkers.filter(w => {
              const s = calcularEstadoTrabajador(w, activeProjectId);
              return s === 'pendiente' || s === 'por_vencer';
            }).length;
            const countBlockedWorkers = projWorkers.filter(w => calcularEstadoTrabajador(w, activeProjectId) === 'rechazado').length;

            const overallPercent = countWorkers > 0 ? Math.round((countApprovedWorkers / countWorkers) * 100) : 100;

            const attentionContractors = projContractors.filter(c => calcularEstadoAcreditacion(c, activeProjectId) !== 'Aprobado');

            const criticalProblems: any[] = [];
            
            projContractors.forEach(c => {
              const companyReqs = projReqs.filter(r => r.destino === 'empresa');
              companyReqs.forEach(req => {
                const doc = c.documentos.find(d => 
                  d.proyectoId === activeProjectId &&
                  (d.nombre.toLowerCase().includes(req.nombre.toLowerCase()) || 
                   req.nombre.toLowerCase().includes(d.nombre.toLowerCase()))
                );
                if (doc) {
                  const isVencido = esVencidoPorFecha(doc.vencimiento);
                  if (req.obligatorio && (doc.estado === 'rechazado' || isVencido)) {
                    criticalProblems.push({
                      tipo: 'empresa',
                      id: c.id,
                      name: c.nombre,
                      issue: `${req.nombre} ${isVencido ? 'vencido' : 'rechazado'}`,
                      contratista: c.nombre,
                      objetoContratista: c,
                      objetoTrabajador: undefined
                    });
                  }
                }
              });

              const workerReqs = projReqs.filter(r => r.destino === 'trabajador');
              const cWorkers = c.trabajadores || [];
              cWorkers.forEach(w => {
                const isAssigned = esTrabajadorAsignado(w, activeProjectId, allProyectos);
                if (!isAssigned) return;

                workerReqs.forEach(req => {
                  const doc = w.documentos?.find(d => 
                    d.proyectoId === activeProjectId &&
                    (d.nombre.toLowerCase().includes(req.nombre.toLowerCase()) || 
                     req.nombre.toLowerCase().includes(d.nombre.toLowerCase()))
                  );
                  if (doc) {
                    const isVencido = esVencidoPorFecha(doc.vencimiento);
                    if (req.obligatorio && (doc.estado === 'rechazado' || isVencido)) {
                      criticalProblems.push({
                        tipo: 'trabajador',
                        id: w.rut,
                        name: w.nombre,
                        issue: `${req.nombre} ${isVencido ? 'vencido' : 'rechazado'}`,
                        contratista: c.nombre,
                        objetoContratista: c,
                        objetoTrabajador: w
                      });
                    }
                  }
                });
              });
            });

            let dynamicApprovedDocsCount = 0;
            let dynamicRejectedDocsCount = 0;
            let dynamicPendingDocsCount = 0;

            projContractors.forEach(c => {
              c.documentos.forEach(d => {
                if (d.proyectoId === activeProjectId) {
                  if (d.estado === 'aprobado' && !esVencidoPorFecha(d.vencimiento)) dynamicApprovedDocsCount++;
                  else if (d.estado === 'rechazado' || esVencidoPorFecha(d.vencimiento)) dynamicRejectedDocsCount++;
                  else if (d.estado === 'revision') dynamicPendingDocsCount++;
                }
              });
              (c.trabajadores || []).forEach(w => {
                (w.documentos || []).forEach(d => {
                  if (d.proyectoId === activeProjectId) {
                    if (d.estado === 'aprobado' && !esVencidoPorFecha(d.vencimiento)) dynamicApprovedDocsCount++;
                    else if (d.estado === 'rechazado' || esVencidoPorFecha(d.vencimiento)) dynamicRejectedDocsCount++;
                    else if (d.estado === 'revision') dynamicPendingDocsCount++;
                  }
                });
              });
            });
            const dynamicAlertasCount = getAlertasVigencia(activeProjectId).length;

            const filteredContractors = projContractors.filter(c => {
              const state = calcularEstadoAcreditacion(c, activeProjectId);
              if (filtroControl === 'todos') return true;
              if (filtroControl === 'aprobados') return state === 'Aprobado';
              if (filtroControl === 'en_proceso') return state === 'En proceso';
              if (filtroControl === 'bloqueados') return state === 'Vencido/Bloqueado';
              if (filtroControl === 'atencion') return state !== 'Aprobado';
              return true;
            });

            const filteredWorkers = projWorkers.filter(w => {
              const state = calcularEstadoTrabajador(w, activeProjectId);
              if (filtroControl === 'todos') return true;
              if (filtroControl === 'aprobados') return state === 'aprobado';
              if (filtroControl === 'en_proceso') return state === 'pendiente' || state === 'por_vencer';
              if (filtroControl === 'bloqueados') return state === 'rechazado';
              if (filtroControl === 'atencion') return state !== 'aprobado';
              return true;
            });

            return (
              <div className="fade-in space-y-6">
                
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div>
                    <h2 className="page-title text-navy font-bold text-[22px]">Dashboard de Control</h2>
                    <p className="page-sub text-gray-500 text-[13.5px]">{formattedDate} · Resumen general de acreditaciones</p>
                  </div>
                  <div className="flex gap-2">
                    <select
                      value={activeProjectId}
                      onChange={(e) => setSelectedProjectId(e.target.value)}
                      className="form-input text-[13px] py-1.5 px-3 w-auto bg-white border border-cream3 rounded-xl font-medium text-navy cursor-pointer"
                    >
                      {misProyectos.map(p => (
                        <option key={p.id} value={p.id}>{p.nombre}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                  <div className="stat s-brown">
                    <div className="stat-n">{overallPercent}%</div>
                    <div className="stat-l">Acreditación General</div>
                  </div>
                  <div className="stat s-green">
                    <div className="stat-n">{countContractors}</div>
                    <div className="stat-l">Contratistas Totales</div>
                  </div>
                  <div className="stat s-blue">
                    <div className="stat-n">{countWorkers}</div>
                    <div className="stat-l">Trabajadores Totales</div>
                  </div>
                  <div className="stat s-green">
                    <div className="stat-n">{countApprovedWorkers}</div>
                    <div className="stat-l">Trabajadores Aprobados</div>
                  </div>
                  <div className="stat s-yellow">
                    <div className="stat-n">{countPendingWorkers}</div>
                    <div className="stat-l">Trabajadores En Proceso</div>
                  </div>
                  <div className="stat s-red">
                    <div className="stat-n">{countBlockedWorkers}</div>
                    <div className="stat-l">Trabajadores Bloqueados</div>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-6">
                  
                  <div className="space-y-6">
                    <div className="card bg-white border border-cream3 shadow-sm p-5">
                      <div className="flex justify-between items-center mb-4 border-b border-cream3 pb-3">
                        <h3 className="section-title mb-0 flex items-center gap-2 font-bold text-[16px] text-navy">
                          <AlertCircle size={18} className="text-red-500" />
                          CONTRATISTAS QUE REQUIEREN ATENCIÓN
                        </h3>
                        <span className="badge b-red text-xs font-semibold">{attentionContractors.length} empresas</span>
                      </div>

                      {attentionContractors.length > 0 ? (
                        <div className="flex flex-col gap-3.5">
                          {attentionContractors.map(c => {
                            const cWorkers = c.trabajadores || [];
                            const approvedW = cWorkers.filter(w => calcularEstadoTrabajador(w, activeProjectId) === 'aprobado').length;
                            const pct = cWorkers.length > 0 ? Math.round((approvedW / cWorkers.length) * 100) : 100;
                            const affectedW = cWorkers.filter(w => {
                              const s = calcularEstadoTrabajador(w, activeProjectId);
                              return s === 'pendiente' || s === 'rechazado';
                            }).length;
                            const cState = calcularEstadoAcreditacion(c, activeProjectId);

                            let numPendientes = 0;
                            let numPorVencer = 0;
                            let numVencidosRechazados = 0;

                            projReqs.forEach(req => {
                              if (req.destino === 'empresa') {
                                const doc = c.documentos.find(d => 
                                  d.proyectoId === activeProjectId &&
                                  (d.nombre.toLowerCase().includes(req.nombre.toLowerCase()) || 
                                   req.nombre.toLowerCase().includes(d.nombre.toLowerCase()))
                                );
                                if (!doc) {
                                  if (req.obligatorio) numPendientes++;
                                } else {
                                  const isVencido = esVencidoPorFecha(doc.vencimiento);
                                  const isPorVencer = esPorVencerPorFecha(doc.vencimiento, req.alertaDias);
                                  if (doc.estado === 'rechazado' || isVencido) numVencidosRechazados++;
                                  else if (doc.estado === 'pendiente' || doc.estado === 'revision') numPendientes++;
                                  else if (isPorVencer) numPorVencer++;
                                }
                              } else {
                                cWorkers.forEach(w => {
                                  const doc = w.documentos?.find(d => 
                                    d.proyectoId === activeProjectId &&
                                    (d.nombre.toLowerCase().includes(req.nombre.toLowerCase()) || 
                                     req.nombre.toLowerCase().includes(d.nombre.toLowerCase()))
                                  );
                                  if (!doc) {
                                    if (req.obligatorio) numPendientes++;
                                  } else {
                                    const isVencido = esVencidoPorFecha(doc.vencimiento);
                                    const isPorVencer = esPorVencerPorFecha(doc.vencimiento, req.alertaDias);
                                    if (doc.estado === 'rechazado' || isVencido) numVencidosRechazados++;
                                    else if (doc.estado === 'pendiente' || doc.estado === 'revision') numPendientes++;
                                    else if (isPorVencer) numPorVencer++;
                                  }
                                });
                              }
                            });

                            const motives: string[] = [];
                            if (numVencidosRechazados > 0) motives.push(`${numVencidosRechazados} doc. rechazados/vencidos`);
                            if (numPendientes > 0) motives.push(`${numPendientes} doc. pendientes`);
                            if (numPorVencer > 0) motives.push(`${numPorVencer} doc. por vencer`);
                            const principalMotivo = motives.join(', ') || 'Pendiente de acreditación general';

                            const stateBadge = cState === 'Vencido/Bloqueado' ? 'b-red' : 'b-yellow';

                            return (
                              <div key={c.id} className="p-4 border border-cream3 rounded-2xl bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm font-sans">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                                    <h4 className="text-[14.5px] font-semibold text-navy">{c.nombre}</h4>
                                    <span className={`badge ${stateBadge} text-[10.5px]`}>{cState}</span>
                                    <span className="text-gray-400 text-xs">Cumplimiento: <strong>{pct}%</strong></span>
                                  </div>
                                  <p className="text-[12.5px] text-gray-500">
                                    Afectados: <span className="font-semibold text-red-600">{affectedW} trabajadores</span> · Motivo: <span className="font-medium text-navy">{principalMotivo}</span>
                                  </p>
                                </div>
                                <button
                                  className="btn btn-primary btn-sm shrink-0"
                                  onClick={() => setClienteSeleccionado(c)}
                                >
                                  Ver
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-center py-6 text-gray-400 text-xs font-sans">Ningún contratista requiere atención inmediata.</p>
                      )}
                    </div>

                    <div className="card bg-white border border-cream3 shadow-sm p-5 font-sans">
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4 pb-3 border-b border-cream3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setDashboardSubTab('contratistas')}
                            className={`text-[15px] font-bold pb-1 border-b-2 transition-all ${dashboardSubTab === 'contratistas' ? 'border-brown text-navy' : 'border-transparent text-gray-400'}`}
                          >
                            Empresas Contratistas
                          </button>
                          <span className="text-gray-300">|</span>
                          <button
                            onClick={() => setDashboardSubTab('trabajadores')}
                            className={`text-[15px] font-bold pb-1 border-b-2 transition-all ${dashboardSubTab === 'trabajadores' ? 'border-brown text-navy' : 'border-transparent text-gray-400'}`}
                          >
                            Trabajadores del Proyecto
                          </button>
                        </div>
                        
                        <select
                          value={filtroControl}
                          onChange={(e) => setFiltroControl(e.target.value as any)}
                          className="form-input text-[12.5px] py-1 px-2.5 w-auto bg-cream/40 border-cream3 rounded-lg font-medium text-navy cursor-pointer"
                        >
                          <option value="todos">Todos</option>
                          <option value="aprobados">Aprobados</option>
                          <option value="en_proceso">En proceso</option>
                          <option value="bloqueados">Vencidos/Bloqueados</option>
                          <option value="atencion">Requieren atención</option>
                        </select>
                      </div>

                      {dashboardSubTab === 'contratistas' ? (
                        filteredContractors.length > 0 ? (
                          <div className="overflow-x-auto">
                            <table className="table w-full text-left text-[13px]">
                              <thead>
                                <tr>
                                  <th className="px-3 py-2 bg-cream2 text-navy border-b border-cream3">Empresa / RUT</th>
                                  <th className="px-3 py-2 bg-cream2 text-navy border-b border-cream3">Estado</th>
                                  <th className="px-3 py-2 bg-cream2 text-navy border-b border-cream3">Cumplimiento</th>
                                  <th className="px-3 py-2 bg-cream2 text-navy border-b border-cream3 text-right">Acción</th>
                                </tr>
                              </thead>
                              <tbody>
                                {filteredContractors.map(c => {
                                  const cState = calcularEstadoAcreditacion(c, activeProjectId);
                                  const cWorkers = c.trabajadores || [];
                                  const approvedW = cWorkers.filter(w => calcularEstadoTrabajador(w, activeProjectId) === 'aprobado').length;
                                  const pct = cWorkers.length > 0 ? Math.round((approvedW / cWorkers.length) * 100) : 100;
                                  
                                  const badgeColor = cState === 'Aprobado' ? 'b-green' : cState === 'Vencido/Bloqueado' ? 'b-red' : 'b-yellow';

                                  return (
                                    <tr key={c.id} className="hover:bg-gray-50 border-b border-cream last:border-b-0">
                                      <td className="px-3 py-2.5">
                                        <div className="font-semibold text-navy">{c.nombre}</div>
                                        <div className="text-[11px] text-gray-500">{c.rut}</div>
                                      </td>
                                      <td className="px-3 py-2.5">
                                        <span className={`badge ${badgeColor} text-[10.5px]`}>{cState}</span>
                                      </td>
                                      <td className="px-3 py-2.5 font-medium text-navy">{pct}%</td>
                                      <td className="px-3 py-2.5 text-right">
                                        <button 
                                          className="text-brown hover:underline text-[12px] font-semibold"
                                          onClick={() => setClienteSeleccionado(c)}
                                        >
                                          Ver Ficha
                                        </button>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <p className="text-center py-6 text-gray-400 text-xs">No hay contratistas bajo este filtro.</p>
                        )
                      ) : (
                        filteredWorkers.length > 0 ? (
                          <div className="overflow-x-auto">
                            <table className="table w-full text-left text-[13px]">
                              <thead>
                                <tr>
                                  <th className="px-3 py-2 bg-cream2 text-navy border-b border-cream3">Trabajador</th>
                                  <th className="px-3 py-2 bg-cream2 text-navy border-b border-cream3">Contratista</th>
                                  <th className="px-3 py-2 bg-cream2 text-navy border-b border-cream3">Cargo</th>
                                  <th className="px-3 py-2 bg-cream2 text-navy border-b border-cream3">Asignación</th>
                                  <th className="px-3 py-2 bg-cream2 text-navy border-b border-cream3">Estado acreditación</th>
                                  <th className="px-3 py-2 bg-cream2 text-navy border-b border-cream3">Habilitación</th>
                                  <th className="px-3 py-2 bg-cream2 text-navy border-b border-cream3">Motivo</th>
                                  <th className="px-3 py-2 bg-cream2 text-navy border-b border-cream3 text-right">Acción</th>
                                </tr>
                              </thead>
                              <tbody>
                                {filteredWorkers.map(w => {
                                  const wState = calcularEstadoTrabajador(w, activeProjectId);
                                  const contractor = projContractors.find(c => (c.trabajadores || []).some(tw => tw.rut === w.rut));
                                  const badgeColor = wState === 'aprobado' ? 'b-green' : wState === 'rechazado' ? 'b-red' : 'b-yellow';
                                  const statusText = wState === 'aprobado' ? '🟢 Aprobado' : wState === 'rechazado' ? '🔴 Vencido/Bloqueado' : '🟡 En proceso';
                                  
                                  const activeProjectObj = misProyectos.find(p => p.id === activeProjectId);
                                  const activeProjectName = activeProjectObj ? activeProjectObj.nombre : 'Proyecto';

                                  let blockReason = '—';
                                  if (wState !== 'aprobado') {
                                    const missingDoc = w.documentos?.find(d => {
                                      if (d.proyectoId !== activeProjectId) return false;
                                      const isVencido = esVencidoPorFecha(d.vencimiento);
                                      const req = projReqs.find(r => d.nombre.toLowerCase().includes(r.nombre.toLowerCase()) || r.nombre.toLowerCase().includes(d.nombre.toLowerCase()));
                                      return req?.obligatorio && (d.estado === 'rechazado' || isVencido || d.estado === 'pendiente' || d.estado === 'revision');
                                    });
                                    if (missingDoc) {
                                      const isVencido = esVencidoPorFecha(missingDoc.vencimiento);
                                      blockReason = `${missingDoc.nombre} ${isVencido ? 'vencido' : missingDoc.estado === 'rechazado' ? 'rechazado' : 'pendiente'}`;
                                    } else {
                                      const missingReq = projReqs.find(req => req.obligatorio && !w.documentos?.some(d => d.proyectoId === activeProjectId && (d.nombre.toLowerCase().includes(req.nombre.toLowerCase()) || req.nombre.toLowerCase().includes(d.nombre.toLowerCase()))));
                                      if (missingReq) {
                                        blockReason = `${missingReq.nombre} pendiente`;
                                      } else {
                                        blockReason = 'En proceso';
                                      }
                                    }
                                  }

                                  const isHabilitado = wState === 'aprobado';

                                  return (
                                    <tr key={w.rut} className="hover:bg-gray-50 border-b border-cream last:border-b-0">
                                      <td className="px-3 py-2.5">
                                        <div className="font-semibold text-navy">{w.nombre}</div>
                                        <div className="text-[11px] text-gray-500">{w.rut}</div>
                                      </td>
                                      <td className="px-3 py-2.5 text-gray-600 font-medium">{contractor ? contractor.nombre : '—'}</td>
                                      <td className="px-3 py-2.5 text-gray-500">{w.cargo || 'Operario'}</td>
                                      <td className="px-3 py-2.5 text-gray-600 font-medium">✓ Asignado a {activeProjectName}</td>
                                      <td className="px-3 py-2.5">
                                        <span className={`badge ${badgeColor} text-[10.5px]`}>{statusText}</span>
                                      </td>
                                      <td className="px-3 py-2.5">
                                        <span className={`badge ${isHabilitado ? 'b-green' : 'b-red'} text-[10.5px]`}>
                                          {isHabilitado ? '✓ Habilitado' : '❌ No habilitado'}
                                        </span>
                                      </td>
                                      <td className="px-3 py-2.5 text-gray-500 italic">{blockReason}</td>
                                      <td className="px-3 py-2.5 text-right">
                                        <button 
                                          className="text-brown hover:underline text-[12px] font-semibold"
                                          onClick={() => {
                                            if (contractor) {
                                              setClienteSeleccionado(contractor);
                                              setFichaTrabajador(w);
                                            }
                                          }}
                                        >
                                          Ver Ficha
                                        </button>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <p className="text-center py-6 text-gray-400 text-xs">No hay trabajadores bajo este filtro.</p>
                        )
                      )}
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className="card bg-white border border-cream3 shadow-sm p-5 font-sans">
                      <div className="flex justify-between items-center mb-4 border-b border-cream3 pb-3">
                        <h3 className="section-title mb-0 flex items-center gap-2 font-bold text-[16px] text-navy">
                          <XCircle size={18} className="text-red-600 animate-pulse" />
                          PROBLEMAS CRÍTICOS
                        </h3>
                        <span className="badge b-red text-xs font-semibold">{criticalProblems.length} bloqueos</span>
                      </div>

                      {criticalProblems.length > 0 ? (
                        <div className="flex flex-col gap-3 max-h-[350px] overflow-y-auto pr-1">
                          {criticalProblems.map((prob, idx) => (
                            <div key={idx} className="p-3 bg-red-50/40 border border-red-100 rounded-xl space-y-2 text-[12.5px]">
                              <div className="flex justify-between items-start">
                                <div>
                                  <span className="font-bold text-red-700">🔴 {prob.name}</span>
                                  <div className="text-[11px] text-gray-500 mt-0.5">Empresa: {prob.contratista}</div>
                                </div>
                                <button
                                  className="text-brown hover:underline text-[11px] font-semibold"
                                  onClick={() => {
                                    setClienteSeleccionado(prob.objetoContratista);
                                    if (prob.tipo === 'trabajador') {
                                      setFichaTrabajador(prob.objetoTrabajador);
                                    } else {
                                      setFichaTrabajador(undefined);
                                    }
                                  }}
                                >
                                  Ver detalle
                                </button>
                              </div>
                              <div className="text-[12px] text-red-900 font-medium">Causa: <span className="underline">{prob.issue}</span></div>
                              <div className="border-t border-red-100/60 pt-1.5 mt-1">
                                <div className="text-[10px] font-bold text-red-700 uppercase tracking-wider mb-1">Impacto:</div>
                                <div className="grid grid-cols-2 gap-1 text-[11px] text-red-600 font-medium">
                                  <span>🔴 Bloquea ingreso</span>
                                  <span>🔴 Bloquea trabajo</span>
                                  <span>🔴 Bloquea asignación</span>
                                  <span>🔴 Bloquea pago</span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-center py-6 text-gray-400 text-xs">No hay problemas críticos en este proyecto.</p>
                      )}
                    </div>

                    <div className="card bg-white border border-cream3 shadow-sm p-5 font-sans">
                      <h3 className="section-title mb-4 pb-3 border-b border-cream3 text-navy font-bold text-[16px] flex items-center gap-2">
                        <Activity size={18} className="text-brown" />
                        ACTIVIDAD DE ACREDITA (EN PROYECTO)
                      </h3>
                      <div className="grid grid-cols-2 gap-3 text-center text-[13px]">
                        <div className="bg-green-50 border border-green-100 p-3 rounded-xl">
                          <div className="text-lg font-bold text-green-700">{dynamicApprovedDocsCount}</div>
                          <div className="text-[11px] text-gray-500 mt-0.5">Aprobados</div>
                        </div>
                        <div className="bg-red-50 border border-red-100 p-3 rounded-xl">
                          <div className="text-lg font-bold text-red-700">{dynamicRejectedDocsCount}</div>
                          <div className="text-[11px] text-gray-500 mt-0.5">Rechazados/Vencidos</div>
                        </div>
                        <div className="bg-blue-50 border border-blue-100 p-3 rounded-xl">
                          <div className="text-lg font-bold text-blue-700">{dynamicPendingDocsCount}</div>
                          <div className="text-[11px] text-gray-500 mt-0.5">Pendientes</div>
                        </div>
                        <div className="bg-yellow-50 border border-yellow-100 p-3 rounded-xl">
                          <div className="text-lg font-bold text-[#b45309]">{dynamicAlertasCount}</div>
                          <div className="text-[11px] text-gray-500 mt-0.5">Alertas de Vigencia</div>
                        </div>
                      </div>
                    </div>

                  </div>

                </div>

              </div>
            );
          })()}

          {/* PROYECTOS WIDE-CONTAINER WITH SUBTABS */}
          {activeTab === 'proyectos' && (
            <div className="fade-in flex flex-col h-full">
              <div className="tab-bar mb-6 shrink-0">
                <button className={`tab ${activeProjectTab === 'contratistas' ? 'active' : ''}`} onClick={() => setActiveProjectTab('contratistas')}>Proyectos</button>
                <button className={`tab ${activeProjectTab === 'proyectos' ? 'active' : ''}`} onClick={() => setActiveProjectTab('proyectos')}>Ajustes del Proyecto</button>
                <button className={`tab ${activeProjectTab === 'checklist' ? 'active' : ''}`} onClick={() => setActiveProjectTab('checklist')}>Checklist</button>
                <button className={`tab ${activeProjectTab === 'pagos' ? 'active' : ''}`} onClick={() => setActiveProjectTab('pagos')}>Estado de Pago</button>
              </div>

          {/* PAGOS TAB (Complex example) */}
          {activeProjectTab === 'pagos' && (
            <div className="fade-in">
              <div className="page-header">
                <div>
                  <h2 className="page-title">Estado de pago — Mayo 2026</h2>
                  <p className="page-sub">Habilitación de pago por contratista · Torre Mackenna</p>
                </div>
                <button className="btn btn-secondary cursor-not-allowed opacity-50 font-medium" disabled title="No disponible en demo">
                  <Download size={16} /> Exportar todos [Demo]
                </button>
              </div>
              
              <div className="card-grid">
                {(() => {
                  const activePaymentProjectId = (vistaContratistas && vistaContratistas !== 'proyectos') ? vistaContratistas : 'mackenna';
                  const paymentProjectObj = misProyectos.find(p => p.id === activePaymentProjectId) || misProyectos[0];
                  const paymentContractors = allContratistas.filter(c => paymentProjectObj?.contratistas.includes(c.id));

                  if (paymentContractors.length === 0) {
                    return <div className="text-gray-400 py-4 col-span-2 text-center text-sm">No hay contratistas asignados a este proyecto.</div>;
                  }

                  return paymentContractors.map(c => {
                    const approvedCount = c.documentos.filter(d => d.estado === 'aprobado').length;
                    const totalCount = c.documentos.length;
                    const pct = totalCount > 0 ? Math.round((approvedCount / totalCount) * 100) : 0;
                    
                    const hasRejected = c.documentos.some(d => d.estado === 'rechazado');
                    const hasRevision = c.documentos.some(d => d.estado === 'revision' || d.estado === 'pendiente');

                    let statusLabel = 'Pago habilitado';
                    let badgeClass = 'b-green';
                    let borderColor = 'border-l-[#2a6a3a]';
                    let barColor = 'bg-[#2a6a3a]';

                    if (hasRejected) {
                      statusLabel = 'Pago retenido';
                      badgeClass = 'b-red';
                      borderColor = 'border-l-[#c02020]';
                      barColor = 'bg-[#c02020]';
                    } else if (hasRevision) {
                      statusLabel = 'En revisión';
                      badgeClass = 'b-yellow';
                      borderColor = 'border-l-[#c08000]';
                      barColor = 'bg-[#c08000]';
                    }

                    return (
                      <div key={c.id} className={`card border-l-4 ${borderColor} rounded-l-none`}>
                        <div className="flex justify-between items-start mb-2">
                          <div><strong className="text-[15.4px]">{c.nombre}</strong><br/><span className="text-[13.2px] text-gray-400">{c.rut}</span></div>
                          <span className={`badge ${badgeClass}`}>{statusLabel}</span>
                        </div>
                        <div className="text-[14.3px] text-gray-500 mb-3">{approvedCount}/{totalCount} documentos aprobados · {pct}% de avance</div>
                        <div className="prog-wrap"><div className="prog-fill" style={{ width: `${pct}%`, backgroundColor: barColor === 'bg-[#c02020]' ? '#c02020' : barColor === 'bg-[#c08000]' ? '#c08000' : '#2a6a3a' }}></div></div>
                        <div className="mt-3 flex gap-2">
                          <button className="btn btn-ghost btn-sm cursor-not-allowed opacity-50 font-medium" disabled title="No disponible en demo"><Download size={14} /> Informe PDF [Demo]</button>
                          <button className="btn btn-ghost btn-sm" onClick={() => { setSelectedContratista(c.id); setActiveTab('dashboard'); }}><Eye size={14} /> Ver docs</button>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          )}

          {/* Proyectos Tab */}
          {activeProjectTab === 'proyectos' && (
            <div className="fade-in max-w-4xl">
              {proyectoSeleccionadoAjustes === null ? (
                <div className="fade-in">
                  <div className="page-header">
                    <div>
                      <h2 className="page-title">Ajustes del Proyecto</h2>
                      <p className="page-sub">Selecciona el proyecto que deseas configurar</p>
                             <div className="card-grid">
                    {misProyectos.map(p => {
                      let imgUrl = "https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&q=80&w=400";
                      let badgeClass = "b-green";
                      let badgeText = "Al día";
                      let barColor = "bg-[#2a6a3a]";
                      let percent = 100;
                      let loc = "Mackenna 890, San Joaquín";
                      let dates = "Inicio: 10 Feb 2026 · Cierre: Jun 2027";
                      let workersCount = 52;

                      if (p.id === 'costanera') {
                        imgUrl = "https://images.unsplash.com/photo-1541888946425-d81bb19240f5?auto=format&fit=crop&q=80&w=400";
                        badgeClass = "b-red";
                        badgeText = "Crítico";
                        barColor = "bg-[#c02020]";
                        percent = 45;
                        loc = "Costanera 200, Santiago";
                        dates = "Inicio: 15 Ene 2026 · Cierre: Dic 2026";
                        workersCount = 28;
                      } else if (p.id === 'mackenna') {
                        imgUrl = "https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&q=80&w=400";
                        badgeClass = "b-yellow text-yellow-900 border-none bg-yellow-100";
                        badgeText = "Atención";
                        barColor = "bg-[#c08000]";
                        percent = 85;
                        loc = "Mackenna 890, San Joaquín";
                        dates = "Inicio: 10 Feb 2026 · Cierre: Jun 2027";
                        workersCount = 52;
                      } else if (p.id === 'hospital') {
                        imgUrl = "https://images.unsplash.com/photo-1581094794329-c8112a89af12?auto=format&fit=crop&q=80&w=400";
                        badgeClass = "b-green";
                        badgeText = "Al día";
                        barColor = "bg-[#2a6a3a]";
                        percent = 88;
                        loc = "Av. Libertad 200, Concepción";
                        dates = "Inicio: 15 Mar 2025 · Cierre: 10 May 2027";
                        workersCount = 112;
                      }

                      // Adjust if archived
                      if (p.estado === 'Archivado') {
                        badgeClass = "b-gray";
                        badgeText = "Archivado";
                        barColor = "bg-gray-400";
                      }

                      return (
                        <div key={p.id} className="proj-card cursor-pointer hover:shadow-md transition-shadow" onClick={() => { setProyectoSeleccionadoAjustes(p.id); setProyectoArchivado(p.estado === 'Archivado'); }}>
                          <img src={imgUrl} alt={p.nombre} className="w-full h-28 rounded-lg object-cover border border-cream3 mb-3" referrerPolicy="no-referrer" />
                          <div className="flex justify-between items-start mb-3">
                            <h4 className="text-[15.4px] font-bold text-navy leading-tight">{p.nombre}</h4>
                            <span className={`badge ${badgeClass}`}>{badgeText}</span>
                          </div>
                          <div className="flex flex-col gap-1.5 mb-3">
                            <div className="flex items-center gap-2 text-[12.5px] text-gray-500">
                              <MapPin size={13} className="text-brown flex-shrink-0" /> {loc}
                            </div>
                            <div className="flex items-center gap-2 text-[12.5px] text-gray-500">
                              <CalendarDays size={13} className="text-brown flex-shrink-0" /> {dates}
                            </div>
                            <div className="flex items-center gap-2 text-[12.5px] text-gray-500">
                              <Users size={13} className="text-brown flex-shrink-0" /> {workersCount} trabajadores activos
                            </div>
                            <div className="flex items-center gap-2 text-[12.5px] text-gray-500">
                              <Briefcase size={13} className="text-brown flex-shrink-0" /> {p.contratistas.length} empresas contratistas
                            </div>
                          </div>
                          <div className="prog-wrap"><div className="prog-fill" style={{ width: `${percent}%`, backgroundColor: barColor === 'bg-[#c02020]' ? '#c02020' : barColor === 'bg-[#c08000]' ? '#c08000' : '#2a6a3a' }}></div></div>
                          <p className="text-[12.5px] text-gray-600 mt-1.5">{percent}% documentos aprobados</p>
                        </div>
                      );
                    })}
                  </div>                   </div>

                  </div>
                </div>
              ) : (
                <>
                  <div
                    className="text-[13.2px] text-gray-500 cursor-pointer mb-2 flex items-center gap-1 w-max hover:text-navy"
                    onClick={() => { setProyectoSeleccionadoAjustes(null); setAjustesEditando(false); }}
                  >
                    <ArrowLeft size={14} /> Ajustes del Proyecto
                  </div>
                  <div className="page-header">
                    <div>
                      <h2 className="page-title">{PROYECTOS_AJUSTES.find(p => p.id === proyectoSeleccionadoAjustes)?.nombre}</h2>
                      <p className="page-sub">Establece los datos base del proyecto activo</p>
                    </div>
                    <button className="btn btn-primary" onClick={() => { setAjustesEditando(!ajustesEditando); showToast(ajustesEditando ? 'Cambios guardados' : 'Modo edición activado'); }}>
                      {ajustesEditando ? <><Save size={15} className="mr-1" /> Guardar cambios</> : <><Pencil size={15} className="mr-1" /> Editar proyecto</>}
                    </button>
                  </div>

                  <div className="card mb-4">
                    <h3 className="section-title mb-4">Datos del Proyecto</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="form-label">Nombre del proyecto</label>
                        <input className="form-input w-full" defaultValue={PROYECTOS_AJUSTES.find(p => p.id === proyectoSeleccionadoAjustes)?.nombre || ""} disabled={!ajustesEditando} />
                      </div>
                      <div>
                        <label className="form-label">Dirección de la obra</label>
                        <input className="form-input w-full" defaultValue="Av. Costanera 1200, Santiago" disabled={!ajustesEditando} />
                      </div>
                      <div>
                        <label className="form-label">Fecha de inicio</label>
                        <input type="date" className="form-input w-full" defaultValue="2026-01-15" disabled={!ajustesEditando} />
                      </div>
                      <div>
                        <label className="form-label">Fecha de cierre estimada</label>
                        <input type="date" className="form-input w-full" defaultValue="2026-12-15" disabled={!ajustesEditando} />
                      </div>
                      <div>
                        <label className="form-label">Estado del proyecto</label>
                        <select className="form-input w-full" disabled={!ajustesEditando}>
                          <option>Activo</option>
                          <option>Pausado</option>
                          <option>Cerrado</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* MATRIZ DE REQUISITOS DEL PROYECTO */}
                  <div className="card mb-4">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="section-title mb-0">Requisitos del Proyecto</h3>
                      {ajustesEditando && (
                        <button 
                          onClick={() => {
                            setNewDocForm({
                              name: '',
                              category: 'Laboral',
                              frequency: 'Mensual',
                              destino: 'empresa',
                              obligatorio: true,
                              criticidad: 'bloquea_pago'
                            });
                            setIsAddDocModalOpen(true);
                          }}
                          className="btn btn-ghost btn-sm text-brown"
                        >
                          <Plus size={14} className="mr-1" /> Añadir Requisito
                        </button>
                      )}
                    </div>
                    
                    <div className="overflow-x-auto">
                      <table className="table w-full text-left text-sm font-sans">
                        <thead>
                          <tr className="border-b border-cream3 text-[11.5px] text-gray-500 font-semibold uppercase">
                            <th className="py-2.5">Requisito</th>
                            <th className="py-2.5">Aplica a</th>
                            <th className="py-2.5">Obligatorio</th>
                            <th className="py-2.5">Criticidad</th>
                            <th className="py-2.5">Frecuencia</th>
                            {ajustesEditando && <th className="py-2.5 text-right">Acción</th>}
                          </tr>
                        </thead>
                        <tbody>
                          {(() => {
                            const reqs = getRequisitos().filter(r => r.proyectoId === proyectoSeleccionadoAjustes);
                            if (reqs.length === 0) {
                              return (
                                <tr>
                                  <td colSpan={6} className="py-4 text-center text-gray-400 text-sm">
                                    No hay requisitos activos para este proyecto.
                                  </td>
                                </tr>
                              );
                            }

                            return reqs.map(req => {
                              const toggleActive = () => {
                                const list = getRequisitos();
                                const rIdx = list.findIndex(r => r.id === req.id);
                                if (rIdx !== -1) {
                                  const prevActivo = list[rIdx].activo;
                                  list[rIdx].activo = !list[rIdx].activo;
                                  saveRequisitos(list);

                                  const session = getCurrentSession();
                                  registrarAuditoria({
                                    usuarioId: session?.email || mandanteLogueado.id,
                                    rol: 'mandante',
                                    accion: 'cambio_requisitos',
                                    entidad: 'requisito',
                                    entidadId: req.id,
                                    proyectoId: selectedProjectId,
                                    estadoAnterior: prevActivo ? 'activo' : 'inactivo',
                                    estadoNuevo: list[rIdx].activo ? 'activo' : 'inactivo',
                                    detalle: `Requisito ${req.nombre} ${list[rIdx].activo ? 'activado' : 'desactivado'}`
                                  });

                                  showToast(list[rIdx].activo ? 'Requisito activado' : 'Requisito desactivado');
                                  setDocumentRequirements([]);
                                }
                              };

                              const toggleObligatorio = () => {
                                const list = getRequisitos();
                                const rIdx = list.findIndex(r => r.id === req.id);
                                if (rIdx !== -1) {
                                  const prevObligatorio = list[rIdx].obligatorio;
                                  list[rIdx].obligatorio = !list[rIdx].obligatorio;
                                  saveRequisitos(list);

                                  const session = getCurrentSession();
                                  registrarAuditoria({
                                    usuarioId: session?.email || mandanteLogueado.id,
                                    rol: 'mandante',
                                    accion: 'cambio_requisitos',
                                    entidad: 'requisito',
                                    entidadId: req.id,
                                    proyectoId: selectedProjectId,
                                    estadoAnterior: prevObligatorio ? 'obligatorio' : 'opcional',
                                    estadoNuevo: list[rIdx].obligatorio ? 'obligatorio' : 'opcional',
                                    detalle: `Requisito ${req.nombre} marcado como ${list[rIdx].obligatorio ? 'obligatorio' : 'opcional'}`
                                  });

                                  showToast(list[rIdx].obligatorio ? 'Requisito marcado como obligatorio' : 'Requisito marcado como opcional');
                                  setDocumentRequirements([]);
                                }
                              };

                              const changeDestino = (newDest: 'empresa' | 'trabajador') => {
                                const list = getRequisitos();
                                const rIdx = list.findIndex(r => r.id === req.id);
                                if (rIdx !== -1) {
                                  const prevDestino = list[rIdx].destino;
                                  list[rIdx].destino = newDest;
                                  saveRequisitos(list);

                                  const session = getCurrentSession();
                                  registrarAuditoria({
                                    usuarioId: session?.email || mandanteLogueado.id,
                                    rol: 'mandante',
                                    accion: 'cambio_requisitos',
                                    entidad: 'requisito',
                                    entidadId: req.id,
                                    proyectoId: selectedProjectId,
                                    estadoAnterior: prevDestino,
                                    estadoNuevo: newDest,
                                    detalle: `Destinatario de requisito ${req.nombre} cambiado a ${newDest}`
                                  });

                                  showToast('Destinatario de requisito modificado');
                                  setDocumentRequirements([]);
                                }
                              };

                              return (
                                <tr key={req.id} className={`border-b border-cream/50 ${!req.activo ? 'opacity-40' : ''}`}>
                                  <td className="py-3 font-semibold text-navy">
                                    {req.nombre}
                                  </td>
                                  <td className="py-3">
                                    {ajustesEditando ? (
                                      <select
                                        value={req.destino}
                                        onChange={(e) => changeDestino(e.target.value as any)}
                                        className="text-[12px] border border-cream3 rounded px-1 py-0.5 bg-white text-navy focus:outline-none"
                                      >
                                        <option value="empresa">Empresa</option>
                                        <option value="trabajador">Trabajador</option>
                                      </select>
                                    ) : (
                                      <span className={`badge ${req.destino === 'trabajador' ? 'b-yellow' : 'b-green'} text-[10px] py-0.5 px-1.5`}>
                                        {req.destino === 'trabajador' ? 'Trabajador' : 'Empresa'}
                                      </span>
                                    )}
                                  </td>
                                  <td className="py-3">
                                    <input 
                                      type="checkbox" 
                                      checked={req.obligatorio} 
                                      onChange={toggleObligatorio} 
                                      disabled={!ajustesEditando}
                                      className="accent-navy w-4 h-4 cursor-pointer"
                                    />
                                  </td>
                                  <td className="py-3 font-medium">
                                    <span className={`text-[11px] ${req.criticidad === 'bloquea_acceso' ? 'text-red-600' : req.criticidad === 'bloquea_pago' ? 'text-yellow-600' : 'text-gray-500'}`}>
                                      {req.criticidad === 'bloquea_acceso' ? 'Bloquea Acceso' : req.criticidad === 'bloquea_pago' ? 'Bloquea Pago' : 'Advertencia'}
                                    </span>
                                  </td>
                                  <td className="py-3 text-gray-500 text-[12px]">
                                    {req.frecuencia}
                                  </td>
                                  {ajustesEditando && (
                                    <td className="py-3 text-right">
                                      <button 
                                        onClick={toggleActive} 
                                        className={`btn btn-xs py-0.5 px-2 rounded font-bold border-none text-white ${req.activo ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'}`}
                                      >
                                        {req.activo ? 'Desactivar' : 'Activar'}
                                      </button>
                                    </td>
                                  )}
                                </tr>
                              );
                            });
                          })()}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="card mb-4">
                    <h3 className="section-title mb-4">Revisores con acceso</h3>
                    <div className="flex flex-col gap-2 mb-3">
                      {[
                        { nombre: 'Carolina Muñoz', rol: 'Administrador', avatar: 'CM' },
                        { nombre: 'Felipe Rojas', rol: 'Revisor', avatar: 'FR' },
                      ].map(u => (
                        <div key={u.nombre} className="flex items-center justify-between py-2 border-b border-cream">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-navy text-white flex items-center justify-center text-[12px] font-bold">{u.avatar}</div>
                            <div>
                              <div className="text-[14px] font-medium text-navy">{u.nombre}</div>
                              <div className="text-[12px] text-gray-400">{u.rol}</div>
                            </div>
                          </div>
                          {ajustesEditando && u.rol !== 'Administrador' && (
                            <button className="btn btn-ghost btn-sm text-gray-300 cursor-not-allowed" disabled title="No disponible en demo">
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                    {ajustesEditando && (
                      <button className="btn btn-ghost btn-sm text-gray-400 cursor-not-allowed" disabled title="No disponible en demo">
                        <Plus size={14} className="mr-1" /> Agregar revisor [Demo]
                      </button>
                    )}
                  </div>

                  <div className="card mb-4">
                    <h3 className="section-title mb-4">Notificaciones</h3>
                    <div className="flex flex-col gap-3">
                      {[
                        { label: 'Documentos rechazados', desc: 'Aviso inmediato al rechazar un documento' },
                        { label: 'Documentos por vencer', desc: 'Aviso con 7 días de anticipación' },
                        { label: 'Resumen semanal', desc: 'Estado general del proyecto cada lunes' },
                      ].map(n => (
                        <div key={n.label} className="flex items-center justify-between">
                          <div>
                            <div className="text-[14px] font-medium text-navy">{n.label}</div>
                            <div className="text-[12px] text-gray-400">{n.desc}</div>
                          </div>
                          <input type="checkbox" defaultChecked className="accent-navy w-4 h-4 cursor-pointer" disabled={!ajustesEditando} />
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="card border border-red-200 mb-4">
                    <h3 className="section-title text-red-500 mb-1">Zona de peligro</h3>
                    <p className="text-[13.2px] text-gray-500 mb-4">Estas acciones no se pueden deshacer fácilmente.</p>
                    <button
                      className="btn btn-sm bg-red-50 text-red-600 border border-red-200 hover:bg-red-100"
                      onClick={() => {
                        const projList = getProyectos();
                        const pIdx = projList.findIndex(p => p.id === selectedProjectId);
                        if (pIdx !== -1) {
                          const prevEstado = projList[pIdx].estado;
                          projList[pIdx].estado = 'Archivado';
                          saveProyectos(projList);
                          
                          const session = getCurrentSession();
                          registrarAuditoria({
                            usuarioId: session?.email || mandanteLogueado.id,
                            rol: 'mandante',
                            accion: 'modificacion_proyecto',
                            entidad: 'proyecto',
                            entidadId: selectedProjectId,
                            proyectoId: selectedProjectId,
                            estadoAnterior: prevEstado,
                            estadoNuevo: 'Archivado',
                            detalle: `Proyecto ${projList[pIdx].nombre} archivado por mandante`
                          });
                        }
                        setProyectoArchivado(true);
                        showToast('Proyecto archivado', 'error');
                      }}
                      disabled={proyectoArchivado}
                    >
                      <Archive size={14} className="mr-1" /> {proyectoArchivado ? 'Proyecto archivado' : 'Archivar proyecto'}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Contratistas Tab */}
          {activeProjectTab === 'contratistas' && (
            <div className="fade-in">
              {vistaContratistas === 'proyectos' ? (
                <>
                  <div className="page-header">
                    <div>
                      <h2 className="page-title">Proyectos</h2>
                      <p className="page-sub">Gestión de contratistas agrupados por proyecto</p>
                    </div>
                    <button className="btn btn-primary" onClick={() => setShowInvitarModal(true)}>
                      <UserPlus size={16} className="mr-1" /> Invitar Contratista
                    </button>
                  </div>

                  <div className="card-grid">
                    {misProyectos.map(p => {
                      const countContratistas = p.contratistas.length;
                      let badgeClass = 'b-green';
                      let badgeText = 'Al día';
                      let barColor = 'bg-green-500';
                      let percent = 100;

                      if (p.id === 'costanera') {
                        badgeClass = 'b-red';
                        badgeText = 'Crítico';
                        barColor = 'bg-red-500';
                        percent = 71;
                      } else if (p.id === 'mackenna') {
                        badgeClass = 'bg-yellow-100 text-yellow-800 border-none';
                        badgeText = 'Atención';
                        barColor = 'bg-yellow-500';
                        percent = 85;
                      }

                      if (p.estado === 'Archivado') {
                        badgeClass = 'b-gray';
                        badgeText = 'Archivado';
                        barColor = 'bg-gray-400';
                      }

                      return (
                        <div key={p.id} className="proj-card cursor-pointer hover:shadow-md transition-shadow font-sans" onClick={() => setVistaContratistas(p.id)}>
                          <div className="flex justify-between items-start mb-2">
                            <h4 className="text-[15.4px] font-medium text-navy">{p.nombre}</h4>
                            <span className={`badge ${badgeClass}`}>{badgeText}</span>
                          </div>
                          <div className="flex items-center text-[13.2px] text-gray-500 mb-2.5 gap-3">
                            <span className="flex items-center gap-1"><Users size={14} /> {countContratistas} contratistas</span>
                            <span className="flex items-center gap-1"><Calendar size={14} /> Cierre 30 Nov 2026</span>
                          </div>
                          <div className="prog-wrap">
                            <div className="prog-fill" style={{ width: `${percent}%`, backgroundColor: barColor === 'bg-red-500' ? '#c02020' : barColor === 'bg-yellow-500' ? '#c08000' : '#2a6a3a' }}></div>
                          </div>
                          <p className="text-[13.2px] text-gray-600 mt-1.5 mb-2">{percent}% documentos aprobados</p>
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : selectedContratista ? (
                <>
                  <div className="text-[14px] font-medium text-black cursor-pointer mb-4 flex items-center gap-1.5 w-max hover:opacity-80 transition-opacity" onClick={() => { setSelectedContratista(null); setFiltroDoc(null); }}>
                    <ArrowLeft size={18} className="text-orange-500" /> Volver a contratistas
                  </div>
                  {(() => {
                    const cObj = allContratistas.find(c => c.id === selectedContratista);
                    if (!cObj) return null;
                    return (
                      <FichaAcreditacion
                        tipo="empresa"
                        contratista={cObj}
                        proyectoId={vistaContratistas === 'todos' ? cObj.proyectos[0] || 'costanera' : vistaContratistas}
                        onClose={() => { setSelectedContratista(null); setFiltroDoc(null); }}
                        rol="mandante"
                      />
                    );
                  })()}
                </>
              ) : (
                <>
                  <div className="text-[14px] font-medium text-black cursor-pointer mb-2 flex items-center gap-1.5 w-max hover:opacity-80 transition-opacity" onClick={() => { setVistaContratistas('proyectos'); setSelectedContratista(null); setFiltroDoc(null); }}>
                    <ArrowLeft size={18} className="text-orange-500" /> Proyectos
                  </div>
                  {(() => {
                    const proyectoActivoObj = misProyectos.find(p => p.id === vistaContratistas);
                    let badgeClass = 'b-green';
                    let badgeText = 'Al día';
                    if (proyectoActivoObj) {
                      if (proyectoActivoObj.id === 'costanera') {
                        badgeClass = 'b-red';
                        badgeText = 'Crítico';
                      } else if (proyectoActivoObj.id === 'mackenna') {
                        badgeClass = 'bg-yellow-100 text-yellow-800 border-none';
                        badgeText = 'Atención';
                      }
                    }
                    return (
                      <div className="page-header">
                        <div>
                          <h2 className="page-title flex items-center gap-2 font-sans">
                            {proyectoActivoObj?.nombre}
                            <span className={`badge ${badgeClass}`}>{badgeText}</span>
                          </h2>
                          <p className="page-sub">Directorio de Contratistas</p>
                        </div>
                        <button className="btn btn-primary" onClick={() => setShowInvitarModal(true)}>
                          <UserPlus size={16} className="mr-1" /> Invitar Contratista
                        </button>
                      </div>
                    );
                  })()}

                  <div className="flex gap-2 mb-4">
                    <input type="text" className="form-input flex-1 min-w-[200px]" placeholder="Buscar por razón social o RUT..." />
                    <select className="form-input min-w-[180px]">
                      <option>Todos los estados</option>
                      <option>Al día</option>
                      <option>Con advertencias</option>
                      <option>Estado crítico</option>
                    </select>
                  </div>

                  <div className="card p-0 overflow-x-auto mb-24">
                    <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
                      <table className="table w-full text-left min-w-[600px]">
                      <thead>
                        <tr>
                          <th className="px-4 py-3 border-b border-cream3 text-[13.2px] text-gray-600 bg-cream2 font-medium">Empresa / RUT</th>
                          <th className="px-4 py-3 border-b border-cream3 text-[13.2px] text-gray-600 bg-cream2 font-medium">Proyectos Asignados</th>
                          <th className="px-4 py-3 border-b border-cream3 text-[13.2px] text-gray-600 bg-cream2 font-medium min-w-[150px]">Progreso Acreditación</th>
                          <th className="px-4 py-3 border-b border-cream3 text-[13.2px] text-gray-600 bg-cream2 font-medium">Estado Acreditación</th>
                          <th className="px-4 py-3 border-b border-cream3 text-[13.2px] text-gray-600 bg-cream2 font-medium text-right">Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {contractorsData.filter(c => c.isPending).map(c => (
                          <tr key={c.id} className="hover:bg-gray-50 border-b border-cream">
                            <td className="px-4 py-3">
                              <div className="font-bold text-[14.3px] text-navy">{c.name}</div>
                              <div className="text-[12.1px] text-gray-500">{c.rut}</div>
                            </td>
                            <td className="px-4 py-3">
                              <span className="badge b-gray mr-1">Pre-asignado</span>
                            </td>
                            <td className="px-4 py-3">
                              <span className="text-[12.1px] font-medium text-gray-500">N/A</span>
                            </td>
                            <td className="px-4 py-3"><span className="badge b-yellow">Invitación pendiente</span></td>
                            <td className="px-4 py-3 text-right">
                              <button className="btn btn-ghost btn-sm text-gray-300 cursor-not-allowed" disabled title="No disponible en demo">Reenviar [Demo]</button>
                            </td>
                          </tr>
                        ))}
                        
                        {(() => {
                          const proyectoActivoObj = misProyectos.find(p => p.id === vistaContratistas);
                          const contratistasDelProyecto = proyectoActivoObj ? allContratistas.filter(c => proyectoActivoObj.contratistas.includes(c.id)) : [];
                          
                          return contratistasDelProyecto.map(c => {
                            const contractorInState = contractorsData.find(cs => cs.id === c.id);
                            const okCount = contractorInState ? Object.values(contractorInState.status).filter(s => s === 'ok').length : 0;
                            const totalCount = contractorInState ? Object.values(contractorInState.status).filter(s => s !== 'na').length : 0;
                            const percent = totalCount > 0 ? Math.round((okCount / totalCount) * 100) : 0;
                            
                            // Determine accreditation state
                            const contractorObj = allContratistas.find(co => co.id === c.id);
                            const workers = contractorObj?.trabajadores || [];
                            
                            const statusLabelVal = contractorObj ? calcularEstadoAcreditacion(contractorObj) : 'No acreditado';
                            const statusLabel = statusLabelVal === 'Aprobado' ? 'Acreditado' : statusLabelVal === 'Vencido/Bloqueado' ? 'Bloqueado' : statusLabelVal;
                            const badgeClass = statusLabelVal === 'Aprobado' ? 'b-green' : statusLabelVal === 'Vencido/Bloqueado' ? 'b-red' : 'b-yellow';
                            const barColor = statusLabelVal === 'Aprobado' ? 'bg-[#2a6a3a]' : statusLabelVal === 'Vencido/Bloqueado' ? 'bg-[#c02020]' : 'bg-[#c08000]';
                            const { accesoBloqueado: accB, pagoBloqueado: pagB } = contractorObj ? calcularAccesoPago(contractorObj, vistaContratistas) : { accesoBloqueado: false, pagoBloqueado: false };

                            return (
                              <tr key={c.id} className="hover:bg-gray-50 border-b border-cream cursor-pointer" onClick={() => setSelectedContratista(c.id)}>
                                <td className="px-4 py-3">
                                  <div className="font-bold text-[14.3px] text-navy">{c.nombre}</div>
                                  <div className="text-[12.1px] text-gray-500">{c.rut}</div>
                                </td>
                                <td className="px-4 py-3">
                                  <span className="badge b-gray mr-1">
                                    {proyectoActivoObj?.nombre || 'Proyecto'}
                                  </span>
                                </td>
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-2">
                                    <div className="prog-wrap flex-1 min-w-[80px] m-0">
                                      <div className="prog-fill" style={{ width: `${percent}%`, backgroundColor: barColor === 'bg-[#c02020]' ? '#c02020' : barColor === 'bg-[#c08000]' ? '#c08000' : '#2a6a3a' }}></div>
                                    </div>
                                    <span className="text-[12.1px] font-medium text-gray-700">{percent}%</span>
                                  </div>
                                </td>
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-2">
                                    <span className={`badge ${badgeClass}`}>{statusLabel}</span>
                                    <div className="flex items-center gap-1.5 shrink-0">
                                      <Key 
                                        size={14} 
                                        className={accB ? "text-red-500" : "text-green-600"} 
                                        title={accB ? "Acceso: Bloqueado" : "Acceso: Habilitado"}
                                      />
                                      <Banknote 
                                        size={14} 
                                        className={pagB ? "text-red-500" : "text-green-600"} 
                                        title={pagB ? "Pago: Bloqueado" : "Pago: Habilitado"}
                                      />
                                    </div>
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-right">
                                  <button className="btn btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); setSelectedContratista(c.id); }}><Eye size={14} className="mr-1" /> Ver acreditación</button>
                                </td>
                              </tr>
                            );
                          });
                        })()}
                      </tbody>
                    </table>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Checklist Tab (Matriz Documental) */}
          {activeProjectTab === 'checklist' && (
            <div className="fade-in">
              <div className="page-header">
                <div>
                  <h2 className="page-title">Matriz Documental (Checklist)</h2>
                  <p className="page-sub">Control detallado de requisitos y excepciones</p>
                </div>
                <button className="btn btn-primary cursor-not-allowed opacity-50" disabled title="No disponible en demo">Configurar Matriz [Demo]</button>
              </div>

              <div className="flex gap-2 mb-6">
                <select className="form-input min-w-[180px]">
                  <option>Todos los proyectos</option>
                  <option>Hospital Regional Centro</option>
                  <option>Torre Mackenna</option>
                </select>
                <input type="text" className="form-input min-w-[200px]" placeholder="Buscar Contratista..." />
              </div>

              <div className="flex gap-4 mb-3 items-center text-[12.1px]">
                <span className="font-semibold text-gray-500 uppercase tracking-wider">Estados:</span>
                <div className="flex items-center gap-3">
                  <span className="badge b-green flex items-center gap-1.5"><CheckCircle size={12} /> Aprobado</span>
                  <span className="badge b-yellow flex items-center gap-1.5"><AlertTriangle size={12} /> Por vencer</span>
                  <span className="badge b-red flex items-center gap-1.5"><XCircle size={12} /> Rechazado</span>
                  <span className="badge b-gray flex items-center gap-1.5"><span className="text-gray-400 font-bold">—</span> No requerido</span>
                </div>
              </div>

              {contractorsData.length === 0 ? (
                <div className="text-center py-20 text-gray-400">
                  <ClipboardList size={48} className="mx-auto mb-4 text-gray-300" />
                  <p className="font-medium text-gray-500 mb-1">No hay documentos por revisar</p>
                  <p className="text-sm">Los documentos aparecerán aquí cuando un contratista suba archivos.</p>
                </div>
              ) : (
                <div className="card p-0 overflow-x-auto">
                  <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
                    <table className="table w-full text-center min-w-[600px]">
                    <thead>
                      <tr>
                        <th className="px-4 py-3 border-b border-cream3 text-[13.2px] text-gray-600 bg-cream2 font-medium text-left min-w-[200px]">Empresa Contratista</th>
                        {documentRequirements.map((req) => (
                          <th key={req.id} className="px-4 py-3 border-b border-cream3 text-[13.2px] text-gray-600 bg-cream2 font-medium">
                            {req.name}
                          </th>
                        ))}
                        <th className="px-4 py-3 border-b border-cream3 text-[13.2px] text-gray-600 bg-cream2 font-medium text-center min-w-[150px]">
                          <button 
                            onClick={() => setIsAddDocModalOpen(true)}
                            className="btn btn-ghost btn-sm px-2 py-1 mx-auto text-navy hover:bg-cream"
                          >
                            <Plus size={14} className="mr-1" /> Añadir Documento
                          </button>
                        </th>
                        <th className="px-4 py-3 border-b border-cream3 text-[13.2px] text-gray-600 bg-cream2 font-medium text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {contractorsData.map(contractor => {
                        const isEditing = editingContractorId === contractor.id;
                        
                        const renderCell = (docKey: string) => {
                          if (isEditing) {
                            return (
                              <input 
                                type="checkbox" 
                                className="accent-navy w-4 h-4 mx-auto block cursor-pointer rounded border-gray-300" 
                                defaultChecked={contractor.reqs[docKey]} 
                                onChange={handleCellEdit}
                              />
                            );
                          }
                          
                          const status = contractor.status[docKey];
                          if (status === 'na') {
                            return <span className="text-gray-400 font-medium block text-center" title="No requerido">—</span>;
                          }
                          
                          if (status === 'ok') return <CheckCircle size={20} className="text-[#2a6a3a] mx-auto block" title="Aprobado" />;
                          if (status === 'warn') return <AlertTriangle size={20} className="text-[#d4a000] mx-auto block" title="Por vencer" />;
                          if (status === 'error') return <XCircle size={20} className="text-[#c02020] mx-auto block" title="Rechazado" />;
                          if (status === 'pending') return <Clock size={20} className="text-amber-500 mx-auto block animate-pulse" title="Pendiente de carga o revisión" />;
                          
                          return <span className="text-gray-400 font-medium block text-center" title="No requerido">—</span>;
                        };

                        return (
                          <tr key={contractor.id} className={`border-b border-cream transition-colors ${isEditing ? 'bg-[#f4efe9]' : 'hover:bg-gray-50'}`}>
                            <td className="px-4 py-3 text-left">
                              <div className="flex justify-between items-start">
                                <div>
                                  <div className="font-bold text-[14.3px] text-navy flex items-center gap-2">
                                    {contractor.name}
                                  </div>
                                  <div className="text-[12.1px] text-gray-500">{contractor.rut}</div>
                                </div>
                              </div>
                              <div className="mt-2">
                                {isEditing ? (
                                  <span className="text-[11px] font-semibold text-[#8b5e34] uppercase tracking-wider flex items-center gap-1">
                                    Configurando matriz
                                  </span>
                                ) : (
                                  <button 
                                    onClick={() => setEditingContractorId(contractor.id)}
                                    className="btn btn-ghost btn-sm px-2 py-1 h-auto text-[11.5px] text-gray-500 hover:text-navy hover:bg-cream"
                                  >
                                    <SlidersHorizontal size={13} className="mr-1" /> Asignar Requisitos
                                  </button>
                                )}
                              </div>
                            </td>
                            {documentRequirements.map((req) => (
                              <td key={req.id} className="px-4 py-3 align-middle">{renderCell(req.id)}</td>
                            ))}
                            <td className="px-4 py-3 align-middle"></td>
                            <td className="px-4 py-3 text-right align-middle">
                              {isEditing ? (
                                <div className="flex justify-end gap-1.5">
                                  <button onClick={() => setEditingContractorId(null)} className="btn btn-ghost btn-sm px-2 py-1.5 h-auto text-gray-500 hover:text-red-600 hover:bg-red-50" title="Cancelar"><X size={16}/></button>
                                  <button onClick={() => { setEditingContractorId(null); showToast('Configuración guardada'); }} className="btn btn-primary btn-sm px-2 py-1.5 h-auto shadow-sm" title="Guardar cambios"><Check size={16}/></button>
                                </div>
                              ) : (
                                <button className="btn btn-ghost btn-sm cursor-not-allowed opacity-50 font-medium" disabled title="No disponible en demo"><AlertCircle size={14} className="mr-1" /> Excepción manual [Demo]</button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  </div>
                </div>
              )}

              {/* Modal de Creación de Documento */}
              {isAddDocModalOpen && (
                <div className="fixed inset-0 bg-navy/40 z-50 flex items-center justify-center p-4">
                  <div className="card max-w-md w-full max-h-[calc(100vh-24px)] overflow-y-auto shadow-xl">
                    <h3 className="section-title mb-4">Añadir Nuevo Documento</h3>
                    
                    <div className="form-group mb-4">
                      <label className="form-label text-[13.2px]">Nombre del documento</label>
                      <input 
                        type="text" 
                        className="form-input" 
                        placeholder="Ej. Certificado SEC"
                        value={newDocForm.name}
                        onChange={(e) => setNewDocForm({...newDocForm, name: e.target.value})}
                      />
                    </div>
                    
                    <div className="form-group mb-4">
                      <label className="form-label text-[13.2px]">Categoría</label>
                      <select 
                        className="form-input"
                        value={newDocForm.category}
                        onChange={(e) => setNewDocForm({...newDocForm, category: e.target.value})}
                      >
                        <option value="Laboral">Laboral</option>
                        <option value="Prevención de Riesgos">Prevención de Riesgos</option>
                        <option value="Certificación Técnica">Certificación Técnica</option>
                        <option value="Legal">Legal</option>
                      </select>
                    </div>

                    <div className="form-group mb-4">
                      <label className="form-label text-[13.2px]">Aplica a</label>
                      <select 
                        className="form-input"
                        value={newDocForm.destino}
                        onChange={(e) => setNewDocForm({...newDocForm, destino: e.target.value})}
                      >
                        <option value="empresa">Empresa Contratista</option>
                        <option value="trabajador">Trabajador (Personal)</option>
                      </select>
                    </div>

                    <div className="form-group mb-4">
                      <label className="form-label text-[13.2px]">Criticidad / Acción ante incumplimiento</label>
                      <select 
                        className="form-input"
                        value={newDocForm.criticidad}
                        onChange={(e) => setNewDocForm({...newDocForm, criticidad: e.target.value})}
                      >
                        <option value="bloquea_acceso">Bloquea Acceso a Faena</option>
                        <option value="bloquea_pago">Bloquea Pago de Factura</option>
                        <option value="advertencia">Solo Advertencia (Opcional)</option>
                      </select>
                    </div>

                    <div className="form-group mb-4">
                      <label className="form-label text-[13.2px] flex items-center gap-2">
                        <input 
                          type="checkbox" 
                          checked={newDocForm.obligatorio}
                          onChange={(e) => setNewDocForm({...newDocForm, obligatorio: e.target.checked})}
                          className="accent-navy w-4 h-4 cursor-pointer"
                        />
                        ¿Es Obligatorio para Acreditación?
                      </label>
                    </div>

                    <div className="form-group mb-6">
                      <label className="form-label text-[13.2px]">Frecuencia de renovación</label>
                      <select 
                        className="form-input"
                        value={newDocForm.frequency}
                        onChange={(e) => setNewDocForm({...newDocForm, frequency: e.target.value})}
                      >
                        <option value="Mensual">Mensual</option>
                        <option value="Anual">Anual</option>
                        <option value="Por Proyecto">Por Proyecto</option>
                        <option value="Indefinido">Indefinido</option>
                      </select>
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t border-cream">
                      <button 
                        className="btn btn-ghost" 
                        onClick={() => setIsAddDocModalOpen(false)}
                      >
                        Cancelar
                      </button>
                      <button 
                        className="btn btn-primary"
                        onClick={handleAddRequirement}
                        disabled={!newDocForm.name.trim()}
                      >
                        Guardar Requisito
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
          {/* Cierre del Wrapper de Proyectos */}
            </div>
          )}

          {/* REPORTES Y ANALÍTICA DE BENEFICIOS */}
          {activeTab === 'reportes' && (
            <div className="fade-in">
              <div className="page-header">
                <div>
                  <h2 className="page-title">Reportes de cumplimiento</h2>
                  <p className="page-sub">Mayo 2026</p>
                </div>
                <button className="btn btn-secondary cursor-not-allowed opacity-50" disabled title="No disponible en demo">
                  <Download size={16} className="mr-2" /> Exportar PDF [Demo]
                </button>
              </div>

              {(() => {
                const totalC = contractorsData.length;
                const okC = contractorsData.filter(c => {
                  const statusValues = Object.values(c.status).filter(s => s !== 'na');
                  const contractorObj = allContratistas.find(co => co.id === c.id);
                  const workers = (contractorObj?.trabajadores || []).filter(w => esTrabajadorAsignado(w, activeProjectId, allProyectos));
                  const allWOk = workers.length > 0 ? workers.every(w => calcularEstadoTrabajador(w, activeProjectId) === 'aprobado') : true;
                  return statusValues.length > 0 && statusValues.every(s => s === 'ok') && allWOk;
                }).length;

                let totalW = 0;
                let approvedW = 0;
                allContratistas.filter(c => 
                  c.proyectos.includes(activeProjectId)
                ).forEach(c => {
                  const workers = (c.trabajadores || []).filter(w => esTrabajadorAsignado(w, activeProjectId, allProyectos));
                  totalW += workers.length;
                  approvedW += workers.filter(w => calcularEstadoTrabajador(w, activeProjectId) === 'aprobado').length;
                });
                const rate = totalC > 0 ? Math.round((okC / totalC) * 100) : 100;

                return (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                      <div className="stat"><div className="stat-n">{totalC}</div><div className="stat-l">Total contratistas</div></div>
                      <div className="stat s-green"><div className="stat-n">{okC}</div><div className="stat-l">Empresas Acreditadas</div></div>
                      <div className="stat s-green"><div className="stat-n">{approvedW} / {totalW}</div><div className="stat-l">Trabajadores Acreditados</div></div>
                      <div className="stat s-green"><div className="stat-n">{rate}%</div><div className="stat-l">Tasa Acreditación General</div></div>
                    </div>

                    <div className="card p-0 overflow-x-auto mb-6">
                      <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
                        <table className="table w-full text-left min-w-[600px]">
                        <thead>
                          <tr>
                            <th className="px-4 py-3 border-b border-cream3 text-[13.2px] text-gray-600 bg-cream2 font-medium">Contratista</th>
                            <th className="px-4 py-3 border-b border-cream3 text-[13.2px] text-gray-600 bg-cream2 font-medium">Proyecto</th>
                            <th className="px-4 py-3 border-b border-cream3 text-[13.2px] text-gray-600 bg-cream2 font-medium">Requisitos Empresa</th>
                            <th className="px-4 py-3 border-b border-cream3 text-[13.2px] text-gray-600 bg-cream2 font-medium">Personal Acreditado</th>
                            <th className="px-4 py-3 border-b border-cream3 text-[13.2px] text-gray-600 bg-cream2 font-medium">Estado</th>
                            <th className="px-4 py-3 border-b border-cream3 text-[13.2px] text-gray-600 bg-cream2 font-medium text-right">Acción</th>
                          </tr>
                        </thead>
                        <tbody>
                          {contractorsData.map(c => {
                            const okCount = Object.values(c.status).filter(s => s === 'ok').length;
                            const totalCount = Object.values(c.status).filter(s => s !== 'na').length;
                            
                            const cObj = allContratistas.find(co => co.id === c.id);
                            const workers = (cObj?.trabajadores || []).filter(w => esTrabajadorAsignado(w, activeProjectId, allProyectos));
                            const approvedWorkersCount = workers.filter(w => calcularEstadoTrabajador(w, activeProjectId) === 'aprobado').length;
                            
                            const statusTextVal = cObj ? calcularEstadoAcreditacion(cObj, activeProjectId) : 'No acreditado';
                            const statusText = statusTextVal === 'Aprobado' ? 'Acreditado' : statusTextVal === 'Vencido/Bloqueado' ? 'Bloqueado' : statusTextVal;
                            const badgeClass = statusTextVal === 'Aprobado' ? 'b-green' : statusTextVal === 'Vencido/Bloqueado' ? 'b-red' : 'b-yellow';
                            const { accesoBloqueado: accB, pagoBloqueado: pagB } = cObj ? calcularAccesoPago(cObj, activeProjectId) : { accesoBloqueado: false, pagoBloqueado: false };

                            const projName = misProyectos.find(p => p.id === activeProjectId)?.nombre || 'General';

                            return (
                              <tr key={c.id} className="hover:bg-gray-50 border-b border-cream">
                                <td className="px-4 py-3 font-medium text-[14.3px]">{c.name}</td>
                                <td className="px-4 py-3 text-[14.3px]">{projName}</td>
                                <td className="px-4 py-3 text-[14.3px]">{okCount}/{totalCount}</td>
                                <td className="px-4 py-3 text-[14.3px]">{approvedWorkersCount}/{workers.length}</td>
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-2">
                                    <span className={`badge ${badgeClass}`}>{statusText}</span>
                                    <div className="flex items-center gap-1.5 shrink-0">
                                      <Key 
                                        size={14} 
                                        className={accB ? "text-red-500" : "text-green-600"} 
                                        title={accB ? "Acceso: Bloqueado" : "Acceso: Habilitado"}
                                      />
                                      <Banknote 
                                        size={14} 
                                        className={pagB ? "text-red-500" : "text-green-600"} 
                                        title={pagB ? "Pago: Bloqueado" : "Pago: Habilitado"}
                                      />
                                    </div>
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-right">
                                  <button className="btn btn-ghost btn-sm text-gray-300 cursor-not-allowed" disabled title="No disponible en demo"><Download size={16} /> PDF [Demo]</button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                      </div>
                    </div>
                  </>
                );
              })()}

              <div className="card">
                <h3 className="section-title mb-4">Documentos por vencer este mes</h3>
                <ul className="flex flex-col gap-3">
                  {(() => {
                    const docsPorVencer: Array<{ documento: string; contractorName: string; dias: number }> = [];
                    allContratistas.filter(c => 
                      c.proyectos.some(pId => misProyectos.some(mp => mp.id === pId))
                    ).forEach(c => {
                      c.documentos.forEach(d => {
                        if (d.estado === 'por_vencer') {
                          const mockDays = d.nombre.toLowerCase().includes('mutual') ? 6 : d.nombre.toLowerCase().includes('f30') ? 12 : 15;
                          docsPorVencer.push({
                            documento: d.nombre,
                            contractorName: c.nombre,
                            dias: mockDays
                          });
                        }
                      });
                    });

                    if (docsPorVencer.length === 0) {
                      return <li className="text-gray-400 py-3 text-center text-sm">No hay documentos por vencer este mes.</li>;
                    }

                    return docsPorVencer.map((item, idx) => (
                      <li key={idx} className="flex items-center justify-between p-3 border border-cream3 rounded-xl bg-gray-50">
                        <div className="flex items-center gap-3">
                          <AlertTriangle size={18} className="text-[#d4a000]" />
                          <div>
                            <div className="font-semibold text-navy text-[14.3px]">{item.documento}</div>
                            <div className="text-[12.1px] text-gray-500">{item.contractorName}</div>
                          </div>
                        </div>
                        <div className="text-[13.2px] font-medium text-[#d4a000] bg-[#fdf5dd] px-2 py-1 rounded-md">Vence en {item.dias} días</div>
                      </li>
                    ));
                  })()}
                </ul>
              </div>
            </div>
          )}

          {/* CONFIGURACIÓN Y PREFERENCIAS */}
          {activeTab === 'config' && (
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
          )}

          {/* MOBILE NAVBAR */}
          <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex md:hidden z-50">
            {menuItems.map(item => (
              <button key={item.id} onClick={() => setActiveTab(item.id)}
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

      {showInvitarModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-[440px] max-h-[calc(100vh-24px)] overflow-y-auto">
            <div className="flex justify-between items-center p-4 border-b border-cream">
              <h3 className="font-medium text-navy text-[17.6px]">Invitar Contratista</h3>
              <button 
                onClick={() => setShowInvitarModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6">
              <form onSubmit={(e) => {
                e.preventDefault();
                
                const res = crearInvitacion(
                  mandanteLogueado.id,
                  formInvitacion.proyectoId,
                  formInvitacion.contratistaId,
                  formInvitacion.correo,
                  formInvitacion.mensaje
                );

                if (!res.success) {
                  showToast(res.error || 'Error al enviar invitación', 'error');
                  return;
                }

                setShowInvitarModal(false);
                const newInv = res.invitacion!;

                // Add placeholder/pending row to the local state list for display
                setContractorsData(prev => [...prev, {
                  id: newInv.id,
                  name: newInv.contratistaNombre,
                  rut: newInv.contratistaRut,
                  reqs: { contrato: true, odi: true, mutual: true } as any,
                  status: { contrato: 'pending', odi: 'pending', mutual: 'pending' } as any,
                  isPending: true,
                  isNew: true
                } as any]);

                showToast(`Invitación enviada a ${formInvitacion.correo}`);
                setFormInvitacion({correo: '', contratistaId: '', proyectoId: '', mensaje: ''});
              }} className="flex flex-col gap-4">
                <div>
                  <label className="block text-[13.2px] font-medium text-gray-700 mb-1.5">Contratista a invitar</label>
                  <select 
                    value={formInvitacion.contratistaId}
                    onChange={(e) => {
                      const cid = e.target.value;
                      setFormInvitacion({
                        ...formInvitacion,
                        contratistaId: cid,
                        correo: cid === 'tecnicosur' ? 'tecnico@tecnicosur.cl' : cid === 'servicios-norte' ? 'norte@serviciosnorte.cl' : ''
                      });
                    }}
                    className="form-input w-full p-2.5 border border-cream3 rounded-lg focus:border-brown focus:ring-1 focus:ring-brown outline-none transition-all"
                    required
                  >
                    <option value="">Selecciona un contratista...</option>
                    {allContratistas.map(c => (
                      <option key={c.id} value={c.id}>{c.nombre} ({c.rut})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[13.2px] font-medium text-gray-700 mb-1.5">Correo del contratista</label>
                  <input 
                    type="email" 
                    value={formInvitacion.correo}
                    onChange={(e) => setFormInvitacion({...formInvitacion, correo: e.target.value})}
                    className="form-input w-full p-2.5 border border-cream3 rounded-lg focus:border-brown focus:ring-1 focus:ring-brown outline-none transition-all" 
                    placeholder="tu@empresa.cl" 
                    required 
                  />
                </div>

                <div>
                  <label className="block text-[13.2px] font-medium text-gray-700 mb-1.5">Proyecto al que se invita</label>
                  <select 
                    value={formInvitacion.proyectoId}
                    onChange={(e) => setFormInvitacion({...formInvitacion, proyectoId: e.target.value})}
                    className="form-input w-full p-2.5 border border-cream3 rounded-lg focus:border-brown focus:ring-1 focus:ring-brown outline-none transition-all"
                    required
                  >
                    <option value="">Selecciona un proyecto...</option>
                    {misProyectos.map(p => (
                      <option key={p.id} value={p.id}>{p.nombre}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[13.2px] font-medium text-gray-700 mb-1.5">Mensaje opcional</label>
                  <textarea 
                    value={formInvitacion.mensaje}
                    onChange={(e) => setFormInvitacion({...formInvitacion, mensaje: e.target.value})}
                    className="form-input w-full p-2.5 border border-cream3 rounded-lg focus:border-brown focus:ring-1 focus:ring-brown outline-none transition-all resize-none" 
                    rows={2}
                    placeholder="Hola, te invitamos a acreditar tu empresa para trabajar con nosotros..." 
                  ></textarea>
                </div>
                
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm text-gray-600 font-mono mb-2 break-all">
                  Mensaje incluirá: <br/>
                  "Accede aquí: app.acredita.cl/invitacion"
                </div>

                <div className="flex justify-end gap-3 mt-2">
                  <button 
                    type="button" 
                    onClick={() => {
                      navigator.clipboard.writeText('app.acredita.cl/invitacion');
                      showToast('Link copiado');
                    }} 
                    className="btn btn-secondary"
                  >
                    Copiar link de invitación
                  </button>
                  <button type="submit" className="btn btn-primary">Enviar invitación</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
      {/* Sliding Side Drawer for Contractor Details */}
      {clienteSeleccionado && (
        <>
          <div 
            className="fixed inset-0 bg-black/20 z-[399] transition-opacity duration-300"
            onClick={() => { setClienteSeleccionado(null); setFiltroDoc(null); setFichaTrabajador(undefined); }}
          />
          {(() => {
            const cObj = allContratistas.find(c => c.id === clienteSeleccionado.id);
            if (!cObj) return null;
            return (
              <FichaAcreditacion
                tipo={fichaTrabajador ? "trabajador" : "empresa"}
                contratista={cObj}
                trabajador={fichaTrabajador}
                proyectoId={activeProjectId}
                onClose={() => { setClienteSeleccionado(null); setFiltroDoc(null); setFichaTrabajador(undefined); }}
                rol="mandante"
              />
            );
          })()}
        </>
      )}
    </div>
  );
}
