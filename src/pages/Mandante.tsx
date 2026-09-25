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
import { configuracionRequisitoRequiereObligatoriedad, getContratistas, getProyectos, getMandantes, getRequisitos, saveRequisitos, logoutUser, getCurrentSession } from '../data/businessStore';
import { Mandante } from '../types';
import ConfigTab from './mandante/ConfigTab';
import type { ConfigTabId } from './mandante/config/configUtils';
import DashboardTab from './mandante/DashboardTab';
import ProyectosTab from './mandante/ProyectosTab';
import ContratistasTab from './mandante/ContratistasTab';
import ContractorInvitationModal from '../components/ContractorInvitationModal';
import DataSyncButton from '../components/DataSyncButton';
import { useDataSync } from '../components/DataSyncContext';
import { usePortalTab } from '../hooks/usePortalTab';
import { useSidebarPreference } from '../hooks/useSidebarPreference';
import OperationalNotificationsPanel from '../components/OperationalNotificationsPanel';
import { buildMandanteNotifications, mergeMandanteNotifications, type OperationalNotification } from '../data/operationalNotifications';
import { loadReadNotificationKeys, loadStoredNotifications, markNotificationKeysRead, type StoredNotification } from '../data/supabaseNotifications';
import { confirmBusinessPersistence } from '../data/supabasePersistence';
import { getServiciosProyecto } from '../data/operationalCore';
import { buildMandanteContractorsData } from './mandante/contractorsData';

export default function MandantePortal() {
  const { revision: dataSyncRevision } = useDataSync();
  const session = getCurrentSession();
  const mandanteLogueado = session?.role === 'mandante' && session.mandanteId
    ? getMandantes().find(m => m.id === session.mandanteId)
    : undefined;
  return mandanteLogueado
    ? <MandantePortalContent mandanteLogueado={mandanteLogueado} dataSyncRevision={dataSyncRevision} />
    : <InvalidMandanteSession />;
}

function InvalidMandanteSession() {
  React.useEffect(() => {
    logoutUser();
    window.location.replace('/');
  }, []);
  return null;
}

function MandantePortalContent({ mandanteLogueado, dataSyncRevision }: { mandanteLogueado: Mandante; dataSyncRevision: number }) {
  const navigate = useNavigate();
  const session = getCurrentSession();
  const { sidebarCollapsed, toggleSidebar } = useSidebarPreference(false);
  const [activeTab, setActiveTab] = usePortalTab('mandante');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeConfigTab, setActiveConfigTab] = useState<ConfigTabId>('empresa');
  const [configHasUnsavedChanges, setConfigHasUnsavedChanges] = useState(false);
  const [showNotif, setShowNotif] = useState(false);
  const [notificacionesLeidas, setNotificacionesLeidas] = useState<Set<string>>(new Set());
  const [notificacionesPersistidas, setNotificacionesPersistidas] = useState<StoredNotification[]>([]);
  const [activeProjectTab, setActiveProjectTab] = useState('resumen');
  const [editingContractorId, setEditingContractorId] = useState<string | null>(null);
  const [toast, setToast] = useState<{msg: string, type: 'success'|'error'|'warning'} | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [vistaContratistas, setVistaContratistas] = useState<'proyectos' | string>('proyectos');
  const [selectedContratista, setSelectedContratista] = useState<string | null>(null);
  const [contractorFocus, setContractorFocus] = useState<{ projectId: string; workerRut?: string; requirementId?: string; documentId?: string } | null>(null);
  const [operationFocus, setOperationFocus] = useState<{ mode: 'evaluacion' | 'pago' | 'ticket'; itemId?: string } | null>(null);
  const [ajustesEditando, setAjustesEditando] = useState(false);
  const [proyectoArchivado, setProyectoArchivado] = useState(false);
  const [proyectoSeleccionadoAjustes, setProyectoSeleccionadoAjustes] = useState<string | null>(null);

  const allProyectos = getProyectos();
  const allContratistas = getContratistas();

  const misProyectos = allProyectos.filter(p => p.mandanteId === mandanteLogueado.id);

  const notificacionesActuales = buildMandanteNotifications(mandanteLogueado.id, allContratistas, allProyectos);
  const notificacionesOperativas = mergeMandanteNotifications(notificacionesActuales, notificacionesPersistidas);
  const notificacionesSinLeer = notificacionesOperativas.filter(item => !notificacionesLeidas.has(item.id)).length;

  React.useEffect(() => {
    if (!session?.profileId) return;
    let cancelled = false;
    Promise.all([
      loadReadNotificationKeys(session.profileId, session),
      loadStoredNotifications(session.profileId, session),
    ]).then(([keys, stored]) => {
      if (cancelled) return;
      setNotificacionesLeidas(keys);
      setNotificacionesPersistidas(stored);
    }).catch(() => {
      if (cancelled) return;
      setNotificacionesLeidas(new Set());
      setNotificacionesPersistidas([]);
    });
    return () => { cancelled = true; };
  }, [session?.profileId, dataSyncRevision]);

  React.useEffect(() => {
    if (!showNotif || !session?.profileId) return;
    let cancelled = false;
    Promise.all([
      loadReadNotificationKeys(session.profileId, session),
      loadStoredNotifications(session.profileId, session),
    ]).then(([keys, stored]) => {
      if (cancelled) return;
      setNotificacionesLeidas(keys);
      setNotificacionesPersistidas(stored);
    }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [showNotif, session?.profileId, dataSyncRevision]);

  const marcarNotificacionesLeidas = (ids: string[]) => {
    setNotificacionesLeidas(actual => {
      const next = new Set(actual);
      ids.forEach(id => next.add(id));
      return next;
    });
    if (session?.profileId) void markNotificationKeysRead(session.profileId, ids, session).catch(() => undefined);
  };

  const goToProject = (projectId: string) => {
    setOperationFocus(null);
    setSelectedProjectId(projectId);
    setProyectoSeleccionadoAjustes(projectId);
    setActiveTab('proyectos');
    setActiveProjectTab('resumen');
  };

  const abrirNotificacionOperativa = (notificacion: OperationalNotification) => {
    marcarNotificacionesLeidas([notificacion.id]);
    const projectId = notificacion.proyectoId;

    if (projectId && notificacion.contratistaId && ['acreditacion', 'trabajador', 'documento'].includes(notificacion.destino)) {
      setOperationFocus(null);
      setSelectedProjectId(projectId);
      setSelectedContratista(notificacion.contratistaId);
      setContractorFocus({
        projectId,
        workerRut: notificacion.workerRut,
        requirementId: notificacion.requirementId,
        documentId: notificacion.documentId,
      });
      setActiveTab('contratistas');
    } else if (projectId && ['operacion', 'soporte'].includes(notificacion.destino)) {
      const mode = notificacion.destino === 'soporte' ? 'ticket' : notificacion.operationMode || 'evaluacion';
      setSelectedProjectId(projectId);
      setProyectoSeleccionadoAjustes(projectId);
      setActiveProjectTab('operacion');
      setOperationFocus({ mode, itemId: notificacion.operationItemId });
      setActiveTab('proyectos');
    } else if (projectId) {
      goToProject(projectId);
    } else {
      setOperationFocus(null);
      setActiveTab('proyectos');
    }
    setShowNotif(false);
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
  const [savingRequirement, setSavingRequirement] = useState(false);
  const [newDocForm, setNewDocForm] = useState({ name: '', category: 'Laboral', frequency: 'Mensual', destino: 'empresa', obligatorio: true, criticidad: 'bloquea_pago', description: '', checklist: '', categories: '', bloqueaTrabajo: false, bloqueaAsignacion: false, servicioId: '', alertDays: 7, dueDays: 5 });

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
    setContractorsData(buildMandanteContractorsData(allContratistas, activeProjectId));
  }, [activeProjectId, dataSyncRevision]);

  const [contractorsData, setContractorsData] = useState<any[]>([]);

  const handleAddRequirement = async () => {
    if (!newDocForm.name.trim() || !activeProjectId || savingRequirement) return;
    const project = getProyectos().find(item => item.id === activeProjectId);
    if (!project || project.estado === 'Archivado') {
      showToast('Un proyecto archivado se mantiene solo para consulta.', 'warning');
      return;
    }

    const normalizedName = newDocForm.name.trim().toLocaleLowerCase('es');
    const duplicate = getRequisitos().some(item =>
      item.proyectoId === activeProjectId
      && item.activo !== false
      && item.destino === newDocForm.destino
      && (item.servicioId || '') === (newDocForm.servicioId || '')
      && item.nombre.trim().toLocaleLowerCase('es') === normalizedName
    );
    if (duplicate) {
      showToast('Ya existe un requisito activo con ese nombre, destino y ámbito.', 'warning');
      return;
    }

    const uniqueValues = (value: string) => Array.from(new Map(
      value.split(/[,\n]/).map(item => item.trim()).filter(Boolean).map(item => [item.toLocaleLowerCase('es'), item])
    ).values());
    const randomPart = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID().replaceAll('-', '')
      : `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    const newId = `requisito_${activeProjectId}_${randomPart}`;
    const newReq = {
      id: newId,
      nombre: newDocForm.name.trim(),
      categoria: (newDocForm.category === 'Prevención de Riesgos' ? 'Prevención' : newDocForm.category) as 'Laboral' | 'Tributario' | 'Prevención',
      destino: newDocForm.destino as 'empresa' | 'trabajador',
      obligatorio: configuracionRequisitoRequiereObligatoriedad(
        newDocForm.criticidad as 'bloquea_pago' | 'bloquea_acceso' | 'bloquea_ambas' | 'advertencia',
        newDocForm.bloqueaTrabajo,
        newDocForm.bloqueaAsignacion,
      ) ? true : newDocForm.obligatorio,
      frecuencia: newDocForm.frequency,
      alertaDias: Math.min(365, Math.max(0, Number(newDocForm.alertDays) || 0)),
      criticidad: newDocForm.criticidad as 'bloquea_pago' | 'bloquea_acceso' | 'bloquea_ambas' | 'advertencia',
      proyectoId: activeProjectId,
      activo: true,
      descripcion: newDocForm.description.trim() || undefined,
      checklistRevision: uniqueValues(newDocForm.checklist),
      categoriasAplicables: newDocForm.destino === 'trabajador' ? uniqueValues(newDocForm.categories) : [],
      bloqueaTrabajo: newDocForm.bloqueaTrabajo,
      bloqueaAsignacion: newDocForm.bloqueaAsignacion,
      servicioId: newDocForm.servicioId || undefined,
      diasPlazo: Math.min(90, Math.max(0, Number(newDocForm.dueDays) || 0)),
    };
    setSavingRequirement(true);
    try {
      const currentReqs = getRequisitos();
      saveRequisitos([...currentReqs, newReq]);
      await confirmBusinessPersistence('core');
      const updatedReqs = getRequisitos().filter(r => r.proyectoId === activeProjectId && r.activo !== false);
      setDocumentRequirements(updatedReqs.map(r => ({ id: r.id, name: r.nombre, category: r.categoria, frequency: r.frecuencia, obligatorio: r.obligatorio, destino: r.destino, criticidad: r.criticidad, alertaDias: r.alertaDias })));
      setContractorsData(buildMandanteContractorsData(allContratistas, activeProjectId));
      setIsAddDocModalOpen(false);
      setNewDocForm({ name: '', category: 'Laboral', frequency: 'Mensual', destino: 'empresa', obligatorio: true, criticidad: 'bloquea_pago', description: '', checklist: '', categories: '', bloqueaTrabajo: false, bloqueaAsignacion: false, servicioId: '', alertDays: 7, dueDays: 5 });
      showToast('Requisito agregado con éxito');
    } catch (error) {
      const restored = getRequisitos().filter(r => r.proyectoId === activeProjectId && r.activo !== false);
      setDocumentRequirements(restored.map(r => ({ id: r.id, name: r.nombre, category: r.categoria, frequency: r.frecuencia, obligatorio: r.obligatorio, destino: r.destino, criticidad: r.criticidad, alertaDias: r.alertaDias })));
      console.error('No fue posible agregar el requisito.', error);
      showToast('No fue posible guardar el requisito. Intenta nuevamente.', 'error');
    } finally {
      setSavingRequirement(false);
    }
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
          <DataSyncButton />
          <div className="relative">
            <button
              onClick={() => setShowNotif(!showNotif)}
              aria-label={showNotif ? 'Cerrar notificaciones' : 'Abrir notificaciones'}
              aria-expanded={showNotif}
              className="flex items-center justify-center relative w-8 h-8 rounded-md bg-white/10 text-cream hover:bg-white/20 transition-colors"
            >
              <Bell size={18} />
              {notificacionesSinLeer > 0 && <span className="absolute -top-1.5 -right-1.5 min-w-[17px] h-[17px] px-1 flex items-center justify-center bg-[#c73b3b] text-white text-[8px] font-extrabold rounded-full border-2 border-navy">{notificacionesSinLeer}</span>}
            </button>
            {showNotif && <div className="fixed inset-0 z-[299]" onClick={() => setShowNotif(false)} />}
            {showNotif && <OperationalNotificationsPanel
              contextLabel={mandanteLogueado.nombre}
              notificaciones={notificacionesOperativas}
              leidas={notificacionesLeidas}
              onMarcarLeida={id => marcarNotificacionesLeidas([id])}
              onMarcarTodas={() => marcarNotificacionesLeidas(notificacionesOperativas.map(item => item.id))}
              onAbrir={abrirNotificacionOperativa}
            />}
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
                <div className="sb-org-sub truncate">{misProyectos.length} proyecto{misProyectos.length === 1 ? '' : 's'} visible{misProyectos.length === 1 ? '' : 's'}</div>
              </div>
            )}
            {sidebarCollapsed && (
              <div className="w-8 h-8 rounded-lg bg-brown text-white flex items-center justify-center font-bold text-sm shrink-0">
                {mandanteLogueado.nombre[0]?.toUpperCase() || 'M'}
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
                  <div className="sb-org-sub">{misProyectos.length} proyecto{misProyectos.length === 1 ? '' : 's'} visible{misProyectos.length === 1 ? '' : 's'}</div>
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
              mandanteId={mandanteLogueado.id}
              allContratistas={allContratistas}
              selectedContratista={selectedContratista}
              setSelectedContratista={setSelectedContratista}
              proyectoSeleccionadoAjustes={proyectoSeleccionadoAjustes}
              setProyectoSeleccionadoAjustes={setProyectoSeleccionadoAjustes}
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
              operationFocus={operationFocus}
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
            <ConfigTab activeConfigTab={activeConfigTab} setActiveConfigTab={setActiveConfigTab} showToast={showToast} misProyectos={misProyectos} mandante={mandanteLogueado} session={session} onDirtyChange={setConfigHasUnsavedChanges} />
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


      {isAddDocModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-[500] flex items-center justify-center p-4" onClick={() => !savingRequirement && setIsAddDocModalOpen(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-[460px] max-h-[calc(100vh-24px)] overflow-y-auto" onClick={event => event.stopPropagation()}>
            <div className="flex justify-between items-center p-4 border-b border-cream">
              <div><h3 className="font-medium text-navy text-[17.6px]">Agregar requisito</h3><p className="text-xs text-gray-500 mt-0.5">Configura una obligación para este proyecto.</p></div>
              <button type="button" disabled={savingRequirement} onClick={() => setIsAddDocModalOpen(false)} className="text-gray-400 hover:text-gray-600 disabled:opacity-50"><X size={20} /></button>
            </div>
            <div className="p-6 flex flex-col gap-4">
              <div><label className="block text-[13.2px] font-medium text-gray-700 mb-1.5">Nombre</label><input value={newDocForm.name} onChange={event => setNewDocForm({ ...newDocForm, name: event.target.value })} className="form-input w-full p-2.5 border border-cream3 rounded-lg" placeholder="Ej. F30 SII" /></div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div><label className="block text-[13.2px] font-medium text-gray-700 mb-1.5">Categoría</label><select value={newDocForm.category} onChange={event => setNewDocForm({ ...newDocForm, category: event.target.value })} className="form-input w-full p-2.5 border border-cream3 rounded-lg"><option>Laboral</option><option>Tributario</option><option>Prevención de Riesgos</option></select></div>
                <div><label className="block text-[13.2px] font-medium text-gray-700 mb-1.5">Destino</label><select value={newDocForm.destino} onChange={event => { const destino = event.target.value; setNewDocForm({ ...newDocForm, destino, alertDays: destino === 'trabajador' ? 15 : 7, categories: destino === 'trabajador' ? newDocForm.categories : '' }); }} className="form-input w-full p-2.5 border border-cream3 rounded-lg"><option value="empresa">Empresa</option><option value="trabajador">Trabajador</option></select></div>
              </div>
              <div><label className="block text-[13.2px] font-medium text-gray-700 mb-1.5">Ámbito del requisito</label><select value={newDocForm.servicioId} onChange={event => setNewDocForm({ ...newDocForm, servicioId: event.target.value })} className="form-input w-full p-2.5 border border-cream3 rounded-lg"><option value="">Todo el proyecto</option>{getServiciosProyecto(activeProjectId).map(service => <option key={service.id} value={service.id}>{service.codigo} · {service.nombre}</option>)}</select></div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div><label className="block text-[13.2px] font-medium text-gray-700 mb-1.5">Frecuencia</label><select value={newDocForm.frequency} onChange={event => setNewDocForm({ ...newDocForm, frequency: event.target.value })} className="form-input w-full p-2.5 border border-cream3 rounded-lg"><option>Mensual</option><option>Bimensual</option><option>Trimestral</option><option>Por Proyecto</option><option>6 meses</option><option>1 año</option><option>Indefinido</option></select></div>
                <div><label className="block text-[13.2px] font-medium text-gray-700 mb-1.5">Criticidad</label><select value={newDocForm.criticidad} onChange={event => { const criticidad = event.target.value; setNewDocForm({ ...newDocForm, criticidad, obligatorio: configuracionRequisitoRequiereObligatoriedad(criticidad as any, newDocForm.bloqueaTrabajo, newDocForm.bloqueaAsignacion) ? true : newDocForm.obligatorio }); }} className="form-input w-full p-2.5 border border-cream3 rounded-lg"><option value="bloquea_pago">Bloquea pago</option><option value="bloquea_acceso">Bloquea acceso</option><option value="bloquea_ambas">Bloquea acceso y pago</option><option value="advertencia">Solo advertencia</option></select></div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div><label className="block text-[13.2px] font-medium text-gray-700 mb-1.5">Alerta preventiva (días)</label><input aria-label="Alerta preventiva" type="number" min="0" max="365" value={newDocForm.alertDays} onChange={event => setNewDocForm({ ...newDocForm, alertDays: Number(event.target.value) })} className="form-input w-full p-2.5 border border-cream3 rounded-lg" /><p className="text-[10.5px] text-gray-500 mt-1">Cuántos días antes del vencimiento se avisará.</p></div>
                <div><label className="block text-[13.2px] font-medium text-gray-700 mb-1.5">Plazo después del período</label><input aria-label="Plazo después del período" type="number" min="0" max="90" value={newDocForm.dueDays} onChange={event => setNewDocForm({ ...newDocForm, dueDays: Number(event.target.value) })} className="form-input w-full p-2.5 border border-cream3 rounded-lg" /><p className="text-[10.5px] text-gray-500 mt-1">Define la fecha límite automática de cada obligación.</p></div>
              </div>
              <div><label className="block text-[13.2px] font-medium text-gray-700 mb-1.5">Descripción para el contratista</label><textarea value={newDocForm.description} onChange={event => setNewDocForm({ ...newDocForm, description: event.target.value })} className="form-input w-full p-2.5 border border-cream3 rounded-lg min-h-20" placeholder="Qué debe presentar y a qué período debe corresponder." /></div>
              <div><label className="block text-[13.2px] font-medium text-gray-700 mb-1.5">Checklist de revisión</label><textarea value={newDocForm.checklist} onChange={event => setNewDocForm({ ...newDocForm, checklist: event.target.value })} className="form-input w-full p-2.5 border border-cream3 rounded-lg min-h-24" placeholder={'Un criterio por línea\nRUT correcto\nPeríodo correcto\nDocumento íntegro y legible'} /><p className="text-[10.5px] text-gray-500 mt-1">La misma pauta será visible para quien carga y quien revisa.</p></div>
              {newDocForm.destino === 'trabajador' && <div><label className="block text-[13.2px] font-medium text-gray-700 mb-1.5">Categorías aplicables</label><input value={newDocForm.categories} onChange={event => setNewDocForm({ ...newDocForm, categories: event.target.value })} className="form-input w-full p-2.5 border border-cream3 rounded-lg" placeholder="General, Conductor, Trabajo en altura" /><p className="text-[10.5px] text-gray-500 mt-1">Sepáralas por coma. Vacío significa que aplica a todos.</p></div>}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 rounded-lg bg-cream2 p-3"><label className="flex items-center gap-2 text-xs text-navy"><input type="checkbox" checked={newDocForm.bloqueaTrabajo} onChange={event => setNewDocForm({ ...newDocForm, bloqueaTrabajo: event.target.checked, obligatorio: event.target.checked ? true : newDocForm.obligatorio })} /> Bloquea trabajo</label><label className="flex items-center gap-2 text-xs text-navy"><input type="checkbox" checked={newDocForm.bloqueaAsignacion} onChange={event => setNewDocForm({ ...newDocForm, bloqueaAsignacion: event.target.checked, obligatorio: event.target.checked ? true : newDocForm.obligatorio })} /> Bloquea asignación</label></div>
              <label className="flex items-center gap-2 text-sm text-navy"><input type="checkbox" checked={newDocForm.obligatorio} disabled={configuracionRequisitoRequiereObligatoriedad(newDocForm.criticidad as any, newDocForm.bloqueaTrabajo, newDocForm.bloqueaAsignacion)} onChange={event => setNewDocForm({ ...newDocForm, obligatorio: event.target.checked })} /> Requisito obligatorio</label>
              {configuracionRequisitoRequiereObligatoriedad(newDocForm.criticidad as any, newDocForm.bloqueaTrabajo, newDocForm.bloqueaAsignacion) && <p className="text-[10.5px] text-gray-500 -mt-2">Los requisitos que bloquean una operación son siempre obligatorios.</p>}
              <div className="flex justify-end gap-3 pt-4 border-t border-cream"><button type="button" disabled={savingRequirement} onClick={() => setIsAddDocModalOpen(false)} className="btn btn-ghost">Cancelar</button><button type="button" disabled={savingRequirement || !newDocForm.name.trim()} onClick={() => void handleAddRequirement()} className="btn btn-primary disabled:opacity-60 disabled:cursor-not-allowed">{savingRequirement ? 'Guardando…' : 'Agregar requisito'}</button></div>
            </div>
          </div>
        </div>
      )}

      <ContractorInvitationModal
  open={showInvitarModal}
  onClose={() => setShowInvitarModal(false)}
  projects={misProyectos}
  initialProjectKey={selectedProjectId || undefined}
  showToast={showToast}
/>
    </div>
  );
}
