import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Bell, LayoutDashboard, Folder, Upload, Users,
  Settings, LogOut, AlertCircle, AlertTriangle, CheckCircle, ArrowRight, ArrowLeft,
  FileCheck, Clock, X, XCircle, CloudUpload, Download, Eye,
  Building2, MapPin, Search, Info, FileText, Plus, Send, ShieldCheck, Banknote,
  UserPlus, Briefcase, FolderOpen, Save, Shield, Mail, Smartphone, ToggleRight, ClipboardList, Menu,
  ChevronLeft, ChevronRight
} from 'lucide-react';
import { Documento } from '../types';
import { getContratistas, saveContratistas, getProyectos, saveProyectos, getMandantes, getPlantillas, calcularEstadoAcreditacion, calcularEstadoTrabajador, getRequisitos, saveRequisitos, esVencidoPorFecha, esPorVencerPorFecha, obtenerDiasRestantes, esTrabajadorAsignado, getInvitaciones, saveInvitaciones, logoutUser, getCurrentSession, aceptarInvitacion, getPreferenciasNotificacionesContratista } from '../data/localStorageDb';
import { isValidRut } from '../utils/rut';
import FichaAcreditacion from '../components/FichaAcreditacion';
import ContratistaNotificaciones from '../components/ContratistaNotificaciones';
import DashboardTab from './contratista/DashboardTab';
import SubirTab from './contratista/SubirTab';
import MisProyectosTab from './contratista/MisProyectosTab';
import TrabajadoresTab from './contratista/TrabajadoresTab';
import ConfigTab from './contratista/ConfigTab';
import { crearDocumentosPendientesProyecto } from './contratista/documentosUtils';
import { buildNotificacionesContratista, NotificacionContratista } from './contratista/notificacionesUtils';

const NOTIFICACIONES_LEIDAS_KEY = 'acredita_notificaciones_leidas_contratista';

function getNotificacionesLeidas(contratistaId: string): Set<string> {
  try {
    const data = JSON.parse(localStorage.getItem(NOTIFICACIONES_LEIDAS_KEY) || '{}') as Record<string, string[]>;
    return new Set(data[contratistaId] || []);
  } catch {
    return new Set();
  }
}

function saveNotificacionesLeidas(contratistaId: string, leidas: Set<string>): void {
  let data: Record<string, string[]> = {};
  try { data = JSON.parse(localStorage.getItem(NOTIFICACIONES_LEIDAS_KEY) || '{}'); } catch { data = {}; }
  data[contratistaId] = [...leidas];
  localStorage.setItem(NOTIFICACIONES_LEIDAS_KEY, JSON.stringify(data));
}

export default function ContratistaPortal() {
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
  const [showNotif, setShowNotif] = useState(false);
  const [invitacionAceptada, setInvitacionAceptada] = useState(false);
  const [tieneProyecto, setTieneProyecto] = useState(false);
  const [showWelcomeAlert, setShowWelcomeAlert] = useState(false);
  const [toast, setToast] = useState<{msg: string, type: 'success'|'error'|'warning'} | null>(null);
  const [showAddWorkerModal, setShowAddWorkerModal] = useState(false);
  const [showFichaAcreditacion, setShowFichaAcreditacion] = useState(false);
  const [selectedWorkerForDocs, setSelectedWorkerForDocs] = useState<any | null>(null);
  const [dataRevision, setDataRevision] = useState(0);
  const [newWorkerForm, setNewWorkerForm] = useState({
    nombre: '',
    rut: '',
    cargo: '',
  });

  const showToast = (msg: string, type: 'success'|'error'|'warning' = 'success') => {
    setToast({msg, type});
    setTimeout(() => setToast(null), 2500);
  };

  const handleLogout = () => {
    logoutUser();
    setMobileMenuOpen(false);
    navigate('/');
  };

  const menuItems = [
    { id: 'dashboard', label: 'Inicio', icon: LayoutDashboard },
    { id: 'proyectos', label: 'Mis proyectos', icon: Folder },
    { id: 'subir', label: 'Documentos', icon: Upload },
    { id: 'trabajadores', label: 'Trabajadores', icon: Users },
    { id: 'config', label: 'Configuración', icon: Settings },
  ];

  // Load contractors, projects, and mandantes from localStorageDb
  const allContratistas = getContratistas();
  const allProyectos = getProyectos();
  const allMandantes = getMandantes();

  const session = getCurrentSession();
  const contratistaLogueado = allContratistas.find(c => c.id === session?.contratistaId) || allContratistas[0];
  const [notificacionesLeidas, setNotificacionesLeidas] = useState<Set<string>>(() => getNotificacionesLeidas(contratistaLogueado.id));
  const misProyectos = allProyectos.filter(p => p.contratistas.includes(contratistaLogueado.id));
  const notificaciones = buildNotificacionesContratista({
    contratista: contratistaLogueado,
    proyectos: misProyectos,
    requisitos: getRequisitos(),
    preferencias: getPreferenciasNotificacionesContratista(contratistaLogueado.id),
  });
  const notificacionesSinLeer = notificaciones.filter(item => !notificacionesLeidas.has(item.id)).length;

  const marcarLeidas = (ids: string[]) => {
    setNotificacionesLeidas(actual => {
      const next = new Set<string>(actual);
      ids.forEach(id => next.add(id));
      saveNotificacionesLeidas(contratistaLogueado.id, next);
      return next;
    });
  };

  const abrirNotificaciones = () => {
    setNotificacionesLeidas(getNotificacionesLeidas(contratistaLogueado.id));
    setShowNotif(actual => !actual);
  };

  const navegarNotificacion = (notificacion: NotificacionContratista) => {
    marcarLeidas([notificacion.id]);
    setSelectedProyectoId(notificacion.proyectoId);
    if (notificacion.destino.tipo === 'trabajador' && notificacion.destino.trabajador) {
      setSelectedWorkerForDocs(notificacion.destino.trabajador);
      setActiveTab('trabajadores');
    } else if (notificacion.destino.tipo === 'acreditacion') {
      setShowFichaAcreditacion(true);
    } else {
      setActiveTab('subir');
    }
    setShowNotif(false);
  };

  React.useEffect(() => {
    if (!showNotif) return;
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') setShowNotif(false); };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [showNotif]);

  const [selectedProyectoId, setSelectedProyectoId] = useState(() => {
    return misProyectos[0]?.id || 'costanera';
  });

  const [documentosData, setDocumentosData] = useState<Documento[]>([]);

  React.useEffect(() => {
    const list = getContratistas();
    const cObj = list.find(c => c.id === contratistaLogueado.id);
    if (cObj) {
      const filteredDocs = cObj.documentos.filter(d => d.proyectoId === selectedProyectoId);
      setDocumentosData(filteredDocs);
      
    }
  }, [selectedProyectoId, dataRevision, contratistaLogueado.id]);

  React.useEffect(() => {
    const invs = getInvitaciones();
    const pending = invs.find(inv => inv.contratistaId === contratistaLogueado.id && inv.estado === 'pendiente');
    if (pending) {
      setTieneProyecto(true);
      setInvitacionAceptada(false);
    } else {
      if (misProyectos.length > 0) {
        setTieneProyecto(true);
        setInvitacionAceptada(true);
      } else {
        setTieneProyecto(false);
        setInvitacionAceptada(false);
      }
    }
  }, []);

  const handleAddWorkerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWorkerForm.nombre || !newWorkerForm.rut) return;
    if (!isValidRut(newWorkerForm.rut)) {
      showToast('RUT inválido, revisa el formato y dígito verificador', 'error');
      return;
    }

    const projectReqs = getRequisitos().filter(r => r.proyectoId === selectedProyectoId && r.destino === 'trabajador' && r.activo !== false);
    const list = getContratistas();
    const currentIdx = list.findIndex(c => c.id === contratistaLogueado.id);
    if (currentIdx === -1) {
      showToast('No fue posible encontrar al contratista.', 'error');
      return;
    }

    const contratista = list[currentIdx];
    contratista.trabajadores ||= [];
    const existingWorker = contratista.trabajadores.find(w => w.rut === newWorkerForm.rut);
    if (existingWorker && esTrabajadorAsignado(existingWorker, selectedProyectoId, misProyectos)) {
      showToast('Este trabajador ya está asignado a este proyecto.', 'warning');
      return;
    }

    const workerDocs = crearDocumentosPendientesProyecto(
      projectReqs,
      contratista.id,
      selectedProyectoId,
      newWorkerForm.rut,
    );

    if (existingWorker) {
      existingWorker.documentos = [...(existingWorker.documentos || []), ...workerDocs];
      existingWorker.estado = calcularEstadoTrabajador(existingWorker, selectedProyectoId);
    } else {
      contratista.trabajadores.push({
        nombre: newWorkerForm.nombre,
        rut: newWorkerForm.rut,
        estado: 'pendiente',
        cargo: newWorkerForm.cargo || 'Operario',
        faena: misProyectos.find(p => p.id === selectedProyectoId)?.nombre || selectedProyectoId,
        cumplimiento: 0,
        documentos: workerDocs,
      });
    }

    saveContratistas(list);
    setDataRevision(value => value + 1);

    setNewWorkerForm({
      nombre: '',
      rut: '',
      cargo: '',
    });
    setShowAddWorkerModal(false);
    showToast('Trabajador agregado con éxito');
  };

  if (tieneProyecto && !invitacionAceptada) {
    const invitacionPendiente = getInvitaciones().find(inv => inv.contratistaId === contratistaLogueado.id && inv.estado === 'pendiente');
    const requisitosInvitacion = invitacionPendiente
      ? getRequisitos().filter(req => req.proyectoId === invitacionPendiente.proyectoId && req.activo !== false)
      : [];
    return (
      <div className="min-h-screen flex items-center justify-center bg-cream2 p-4 font-sans text-navy">
        <div className="card max-w-md w-full fade-in shadow-xl border-none">
          <div className="flex justify-center mb-5">
            <span className="badge b-blue px-3 py-1 text-[13.2px] font-medium flex items-center gap-1.5"><Bell size={14} /> Nueva invitación</span>
          </div>
          <h2 className="section-title text-center text-xl mb-6">Te han invitado a un proyecto</h2>
          
          <div className="bg-white border border-cream3 rounded-xl p-4 mb-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-cream rounded-lg flex items-center justify-center text-brown shrink-0">
                <Building2 size={24} />
              </div>
              <div>
                <div className="font-semibold text-navy text-[15.4px]">{invitacionPendiente?.mandanteNombre || 'Mandante'}</div>
                <div className="text-[13.2px] text-gray-500">{invitacionPendiente?.proyectoNombre || 'Proyecto'}</div>
              </div>
            </div>
            
            <div className="border-t border-cream3 pt-4">
              <p className="text-[12px] font-semibold text-gray-500 uppercase tracking-wide mb-3">Documentos requeridos:</p>
              <ul className="text-[13.2px] text-gray-600 flex flex-col gap-2.5">
                {requisitosInvitacion.map(req => (
                  <li key={req.id} className="flex items-center gap-2"><FileText size={16} className="text-gray-400" /> {req.nombre}</li>
                ))}
              </ul>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <button 
              className="btn btn-primary w-full justify-center py-2.5 text-[15.4px]"
              onClick={() => {
                const invs = getInvitaciones();
                const pending = invs.find(inv => inv.contratistaId === contratistaLogueado.id && inv.estado === 'pendiente');
                if (pending) {
                  aceptarInvitacion(pending.id, contratistaLogueado.id);
                  
                  setInvitacionAceptada(true);
                  setTieneProyecto(true);
                  setSelectedProyectoId(pending.proyectoId);
                  setShowWelcomeAlert(true);
                  showToast('Invitación aceptada. Proyecto asociado.');
                  setTimeout(() => {
                    window.location.reload();
                  }, 1000);
                } else {
                  setInvitacionAceptada(true);
                  showToast('Invitación procesada');
                }
              }}
            >
              Aceptar y comenzar
            </button>
            <button 
              className="btn btn-ghost w-full justify-center text-gray-500 hover:text-navy py-2.5 text-[15.4px]"
              onClick={() => {
                const invs = getInvitaciones();
                const pending = invs.find(inv => inv.contratistaId === contratistaLogueado.id && inv.estado === 'pendiente');
                if (pending) {
                  pending.estado = 'rechazada';
                  saveInvitaciones(invs);
                }
                setTieneProyecto(false);
                showToast('Invitación rechazada', 'error');
                setTimeout(() => {
                  window.location.reload();
                }, 1000);
              }}
            >
              Rechazar invitación
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
              onClick={abrirNotificaciones}
              aria-label={showNotif ? 'Cerrar notificaciones' : 'Abrir notificaciones'}
              aria-expanded={showNotif}
              className="flex items-center justify-center relative w-8 h-8 rounded-md bg-white/10 text-cream hover:bg-white/20 transition-colors">
              <Bell size={18} />
              {notificacionesSinLeer > 0 && <span className="absolute -top-1.5 -right-1.5 min-w-[17px] h-[17px] px-1 flex items-center justify-center bg-[#c73b3b] text-white text-[8px] font-extrabold rounded-full border-2 border-navy">{notificacionesSinLeer}</span>}
            </button>

            {showNotif && <div className="fixed inset-0 z-[299]" onClick={() => setShowNotif(false)} />}
            
            {showNotif && <ContratistaNotificaciones contratistaNombre={contratistaLogueado.nombre} notificaciones={notificaciones} leidas={notificacionesLeidas} onMarcarLeida={id => marcarLeidas([id])} onMarcarTodas={() => marcarLeidas(notificaciones.map(item => item.id))} onAbrir={navegarNotificacion} />}
          </div>
          <div className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition">
            <div className="w-8 h-8 rounded-full bg-brown text-[var(--brown-text,white)] flex items-center justify-center text-[13.2px] font-semibold">
              {contratistaLogueado.nombre.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()}
            </div>
            <span className="text-[14.3px] text-cream hidden md:block">{contratistaLogueado.nombre}</span>
          </div>
        </div>
      </div>

      {!tieneProyecto && (
        <div className="bg-yellow-50 border-b border-yellow-200 px-6 py-3 flex items-center sticky top-[64px] z-40">
          <div className="flex items-center gap-2 text-yellow-800 text-sm">
            <AlertTriangle size={16} className="shrink-0"/>
            <span><strong>Aún no tienes proyectos asignados.</strong> Cuando un mandante te invite o asigne a un proyecto, aparecerá aquí.</span>
          </div>
        </div>
      )}

      {/* MOBILE QUICK ACCESS BANNER */}
      <div className="hidden bg-white border-b border-gray-100 px-4 py-3 gap-3">
        <button onClick={() => setActiveTab('subir')}
          className="flex-1 btn btn-primary text-sm py-2 flex items-center justify-center gap-2">
          <Upload size={16}/> Subir documento
        </button>
        <button onClick={() => setActiveTab('dashboard')}
          className="flex-1 btn btn-secondary text-sm py-2 flex items-center justify-center gap-2">
          <ClipboardList size={16}/> Mi estado
        </button>
      </div>

      <div className="layout">
        {/* SIDEBAR */}
        <aside className={`hidden md:flex sidebar flex-col ${sidebarCollapsed ? 'collapsed' : ''}`}>
          <div className={`sb-org flex ${sidebarCollapsed ? 'flex-col items-center gap-2' : 'justify-between items-center'} px-4 py-3 border-b border-white/5`}>
            {!sidebarCollapsed && (
              <div className="truncate flex-1">
                <div className="sb-org-name truncate">{contratistaLogueado.nombre}</div>
                <div className="sb-org-sub truncate">RUT {contratistaLogueado.rut}</div>
              </div>
            )}
            {sidebarCollapsed && (
              <div className="w-8 h-8 rounded-lg bg-brown text-white flex items-center justify-center font-bold text-sm shrink-0">
                {contratistaLogueado.nombre[0]}
              </div>
            )}
            <button 
              onClick={toggleSidebar} 
              className="text-gray-400 hover:text-white p-1 hover:bg-white/10 rounded-lg cursor-pointer transition-colors"
              title={sidebarCollapsed ? "Expandir menú" : "Colapsar menú"}
            >
              {sidebarCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
            </button>
          </div>
          
          <div className="sb-label">Principal</div>
          {menuItems.map(item => (
            <React.Fragment key={item.id}>
              <button 
                onClick={() => setActiveTab(item.id)}
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
              onClick={handleLogout}
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
                  <div className="sb-org-name">{contratistaLogueado.nombre}</div>
                  <div className="sb-org-sub">RUT {contratistaLogueado.rut} · {misProyectos.length} proyectos activos</div>
                </div>
                <button onClick={() => setMobileMenuOpen(false)} className="text-gray-400 hover:text-white p-1">
                  <X size={20} />
                </button>
              </div>

              <div className="sb-label">Principal</div>
              {menuItems.map(item => (
                <React.Fragment key={item.id}>
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
                <button className="sb-item w-full flex text-left mt-auto" onClick={handleLogout}>
                  <LogOut size={18} /> Cerrar sesión
                </button>
              </div>
            </div>
          </>
        )}

        {/* MAIN CONTENT */}
        <div className="main pb-24 lg:pb-0">
          
          {activeTab === 'dashboard' && (
            <DashboardTab
              contratistaLogueado={contratistaLogueado}
              selectedProyectoId={selectedProyectoId}
              setSelectedProyectoId={setSelectedProyectoId}
              misProyectos={misProyectos}
              allMandantes={allMandantes}
              showWelcomeAlert={showWelcomeAlert}
              setShowWelcomeAlert={setShowWelcomeAlert}
              documentosData={documentosData}
              setActiveTab={setActiveTab}
              setShowFichaAcreditacion={setShowFichaAcreditacion}
              setSelectedWorkerForDocs={setSelectedWorkerForDocs}
              setShowAddWorkerModal={setShowAddWorkerModal}
            />
          )}

          {activeTab === 'subir' && (
            <SubirTab
              contratistaLogueado={contratistaLogueado}
              misProyectos={misProyectos}
              allMandantes={allMandantes}
              selectedProyectoId={selectedProyectoId}
              setSelectedProyectoId={setSelectedProyectoId}
              onDataChanged={() => setDataRevision(value => value + 1)}
              showToast={showToast}
            />
          )}

          {activeTab === 'proyectos' && (
            <MisProyectosTab
              contratistaLogueado={contratistaLogueado}
              misProyectos={misProyectos}
              allMandantes={allMandantes}
              selectedProyectoId={selectedProyectoId}
              setSelectedProyectoId={setSelectedProyectoId}
              setActiveTab={setActiveTab}
              setSelectedWorkerForDocs={setSelectedWorkerForDocs}
              setShowFichaAcreditacion={setShowFichaAcreditacion}
            />
          )}

          {activeTab === 'trabajadores' && (
            <TrabajadoresTab
              selectedWorkerForDocs={selectedWorkerForDocs}
              setSelectedWorkerForDocs={setSelectedWorkerForDocs}
              contratistaLogueado={contratistaLogueado}
              selectedProyectoId={selectedProyectoId}
              setSelectedProyectoId={setSelectedProyectoId}
              misProyectos={misProyectos}
              allMandantes={allMandantes}
              setShowAddWorkerModal={setShowAddWorkerModal}
              onDataChanged={() => setDataRevision(value => value + 1)}
              showToast={showToast}
            />
          )}

          {activeTab === 'config' && (
            <ConfigTab
              contratistaLogueado={contratistaLogueado}
              misProyectos={misProyectos}
              allMandantes={allMandantes}
              session={session}
              onLogout={handleLogout}
              showToast={showToast}
            />
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
          {toast.type === 'success' && <CheckCircle size={18}/>}
          {toast.type === 'error' && <XCircle size={18}/>}
          {toast.type === 'warning' && <AlertTriangle size={18}/>}
          {toast.msg}
        </div>
      )}

      {showFichaAcreditacion && (
        <FichaAcreditacion
          tipo="empresa"
          contratista={contratistaLogueado}
          proyectoId={selectedProyectoId}
          onClose={() => setShowFichaAcreditacion(false)}
          rol="contratista"
          proyectos={misProyectos}
          mandantes={allMandantes}
          onProyectoChange={setSelectedProyectoId}
          onIrADocumentos={(proyectoId) => {
            setSelectedProyectoId(proyectoId);
            setActiveTab('subir');
          }}
          onIrATrabajador={(proyectoId, trabajador) => {
            setSelectedProyectoId(proyectoId);
            setSelectedWorkerForDocs(trabajador);
            setActiveTab('trabajadores');
          }}
        />
      )}

      {showAddWorkerModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowAddWorkerModal(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-[440px] max-h-[calc(100vh-24px)] overflow-y-auto font-sans" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center p-4 border-b border-cream">
              <h3 className="font-semibold text-navy text-[17.6px] flex items-center gap-2">
                <UserPlus size={18} className="text-brown" /> Agregar trabajador al proyecto
              </h3>
              <button 
                onClick={() => setShowAddWorkerModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded"
              >
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleAddWorkerSubmit} className="p-6 flex flex-col gap-4 max-h-[80vh] overflow-y-auto">
              <div>
                <label className="block text-[13px] font-medium text-gray-700 mb-1.5">Nombre completo</label>
                <input 
                  type="text" 
                  value={newWorkerForm.nombre}
                  onChange={(e) => setNewWorkerForm({...newWorkerForm, nombre: e.target.value})}
                  className="form-input w-full p-2.5 border border-cream3 rounded-lg focus:border-brown focus:ring-1 focus:ring-brown outline-none transition-all text-sm" 
                  placeholder="Ej. María González"
                  required 
                />
              </div>
              
              <div>
                <label className="block text-[13px] font-medium text-gray-700 mb-1.5">RUT</label>
                <input 
                  type="text" 
                  value={newWorkerForm.rut}
                  onChange={(e) => setNewWorkerForm({...newWorkerForm, rut: e.target.value})}
                  className="form-input w-full p-2.5 border border-cream3 rounded-lg focus:border-brown focus:ring-1 focus:ring-brown outline-none transition-all text-sm" 
                  placeholder="12.345.678-9" 
                  required 
                />
              </div>

              <div>
                <label className="block text-[13px] font-medium text-gray-700 mb-1.5">Cargo</label>
                <input 
                  type="text" 
                  value={newWorkerForm.cargo}
                  onChange={(e) => setNewWorkerForm({...newWorkerForm, cargo: e.target.value})}
                  className="form-input w-full p-2.5 border border-cream3 rounded-lg focus:border-brown focus:ring-1 focus:ring-brown outline-none transition-all text-sm" 
                  placeholder="Ej. Operador"
                  required 
                />
              </div>

              <div className="text-[11px] leading-relaxed bg-cream2 p-3 rounded-lg text-gray-600">
                La asignación es propia de este proyecto. Si el trabajador ya existe en otro proyecto, puede incorporarse aquí igualmente y se generará su checklist documental para este proyecto.
              </div>

              <div className="flex gap-3 mt-4">
                <button 
                  type="button"
                  onClick={() => setShowAddWorkerModal(false)}
                  className="flex-1 btn btn-ghost border border-cream3 text-navy py-2.5 font-medium rounded-lg text-sm"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  className="flex-1 btn btn-primary py-2.5 font-medium rounded-lg text-sm"
                >
                  Agregar trabajador
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
