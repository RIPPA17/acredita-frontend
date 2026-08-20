import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Bell, LayoutDashboard, Folder, Upload, Archive, Sparkles, Users, 
  Settings, LogOut, AlertCircle, AlertTriangle, CheckCircle, ArrowRight, ArrowLeft,
  FileCheck, Clock, X, XCircle, CloudUpload, Download, Eye,
  Building2, MapPin, Search, Info, FileText, Plus, Send, ShieldCheck, Banknote,
  UserPlus, Briefcase, FolderOpen, Save, Shield, Mail, Smartphone, ToggleRight, ClipboardList, Menu
} from 'lucide-react';
import { Documento } from '../types';
import { getContratistas, saveContratistas, getProyectos, saveProyectos, getMandantes, getPlantillas, calcularEstadoAcreditacion, calcularEstadoTrabajador, getRequisitos, saveRequisitos, esVencidoPorFecha, esPorVencerPorFecha, obtenerDiasRestantes, getMotivoBloqueoTrabajador, getInvitaciones, saveInvitaciones } from '../data/localStorageDb';
import { isValidRut } from '../utils/rut';
import FichaAcreditacion from '../components/FichaAcreditacion';
import DocumentDetailPanel from './contratista/DocumentDetailPanel';
import DashboardTab from './contratista/DashboardTab';
import SubirTab from './contratista/SubirTab';
import MisProyectosTab from './contratista/MisProyectosTab';
import BibliotecaTab from './contratista/BibliotecaTab';
import AsesoriaTab from './contratista/AsesoriaTab';
import TrabajadoresTab from './contratista/TrabajadoresTab';
import ConfigTab from './contratista/ConfigTab';

export default function ContratistaPortal() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [selectedDocumentForPanel, setSelectedDocumentForPanel] = useState<Documento | null>(null);
  const [showNotif, setShowNotif] = useState(false);
  const [invitacionAceptada, setInvitacionAceptada] = useState(false);
  const [tieneProyecto, setTieneProyecto] = useState(false);
  const [showWelcomeAlert, setShowWelcomeAlert] = useState(false);
  const [toast, setToast] = useState<{msg: string, type: 'success'|'error'|'warning'} | null>(null);
  const [showAddWorkerModal, setShowAddWorkerModal] = useState(false);
  const [showFichaAcreditacion, setShowFichaAcreditacion] = useState(false);
  const [fichaTipo, setFichaTipo] = useState<'empresa' | 'trabajador'>('empresa');
  const [fichaTrabajador, setFichaTrabajador] = useState<any>(null);
  const [activeConfigTab, setActiveConfigTab] = useState<'perfil' | 'alertas' | 'seguridad'>('perfil');
  const [canalAlertas, setCanalAlertas] = useState({
    rechazoEmail: true,
    vencimientoEmail: true,
    vencimientoWhatsapp: false,
    aprobacionEmail: true
  });
  const [selectedWorkerForDocs, setSelectedWorkerForDocs] = useState<any | null>(null);
  const [newWorkerForm, setNewWorkerForm] = useState({
    nombre: '',
    rut: '',
    cargo: '',
    faena: 'Torre Mackenna'
  });

  const showToast = (msg: string, type: 'success'|'error'|'warning' = 'success') => {
    setToast({msg, type});
    setTimeout(() => setToast(null), 2500);
  };

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'proyectos', label: 'Mis proyectos', icon: Folder },
    { id: 'subir', label: 'Subir documentos', icon: Upload, badge: 2, section: 'Documentos' },
    { id: 'biblioteca', label: 'Biblioteca', icon: Archive },
    { id: 'asesoria', label: 'Asesoría experta', icon: Sparkles, section: 'Herramientas' },
    { id: 'trabajadores', label: 'Mis trabajadores', icon: Users },
    { id: 'config', label: 'Configuración', icon: Settings, section: 'Cuenta' },
  ];

  // Load contractors, projects, and mandantes from localStorageDb
  const allContratistas = getContratistas();
  const allProyectos = getProyectos();
  const allMandantes = getMandantes();

  const contratistaLogueado = allContratistas.find(c => c.id === 'tecnicosur') || allContratistas[0];
  const misProyectos = allProyectos.filter(p => p.contratistas.includes(contratistaLogueado.id));

  const [selectedProyectoId, setSelectedProyectoId] = useState(() => {
    return misProyectos[0]?.id || 'costanera';
  });

  const [documentosData, setDocumentosData] = useState<Documento[]>([]);
  const [trabajadoresData, setTrabajadoresData] = useState<any[]>([]);

  React.useEffect(() => {
    const list = getContratistas();
    const cObj = list.find(c => c.id === contratistaLogueado.id);
    if (cObj) {
      const filteredDocs = cObj.documentos.filter(d => d.proyectoId === selectedProyectoId);
      setDocumentosData(filteredDocs);
      
      const projectWorkers = cObj.trabajadores?.filter(w => 
        w.documentos?.some(wd => wd.proyectoId === selectedProyectoId)
      ) || [];
      setTrabajadoresData(projectWorkers);
    }
  }, [selectedProyectoId]);

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

  const numProyectos = misProyectos.length;
  const numAprobados = documentosData.filter(d => d.estado === 'aprobado').length;
  const numPendientes = documentosData.filter(d => d.estado === 'pendiente').length;
  const numRechazados = documentosData.filter(d => d.estado === 'rechazado').length;
  const numPorVencer = documentosData.filter(d => d.estado === 'por_vencer').length;
  const approvedWorkers = trabajadoresData.filter(t => calcularEstadoTrabajador(t, selectedProyectoId) === 'aprobado').length;
  const totalWorkers = trabajadoresData.length;
  const pendingWorkers = trabajadoresData.filter(t => calcularEstadoTrabajador(t, selectedProyectoId) !== 'aprobado').length;

  const handleUploadDocument = (docId: string, actionMsg: string = 'Documento subido correctamente', workerRut?: string) => {
    const list = getContratistas();
    const currentIdx = list.findIndex(c => c.id === contratistaLogueado.id);
    const today = new Date();
    const day = today.getDate();
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const todayStr = `${day} ${months[today.getMonth()]} ${today.getFullYear()}`;

    if (currentIdx !== -1) {
      if (workerRut) {
        const workerIdx = list[currentIdx].trabajadores?.findIndex(w => w.rut === workerRut);
        if (workerIdx !== undefined && workerIdx !== -1) {
          const docIdx = list[currentIdx].trabajadores![workerIdx].documentos?.findIndex(d => d.id === docId);
          if (docIdx !== undefined && docIdx !== -1) {
            const docObj = list[currentIdx].trabajadores![workerIdx].documentos![docIdx];
            docObj.estado = 'revision';
            docObj.subido = todayStr;
            docObj.archivoReferencia = `mock_file_${docId}.pdf`;
            delete docObj.motivoRechazo;
            delete docObj.explicacionRechazo;
            delete docObj.solucionRechazo;
            delete docObj.motivo;
            delete docObj.observacion;
            
            const workerObj = list[currentIdx].trabajadores![workerIdx];
            workerObj.estado = calcularEstadoTrabajador(workerObj, selectedProyectoId);
            
            saveContratistas(list);
            
            const projectWorkers = list[currentIdx].trabajadores?.filter(w => 
              w.documentos?.some(wd => wd.proyectoId === selectedProyectoId)
            ) || [];
            setTrabajadoresData(projectWorkers);
            showToast(actionMsg, 'success');
          }
        }
      } else {
        const docIdx = list[currentIdx].documentos.findIndex(d => d.id === docId);
        if (docIdx !== -1) {
          const docObj = list[currentIdx].documentos[docIdx];
          docObj.estado = 'revision';
          docObj.subido = todayStr;
          docObj.archivoReferencia = `mock_file_${docId}.pdf`;
          delete docObj.motivoRechazo;
          delete docObj.explicacionRechazo;
          delete docObj.solucionRechazo;
          delete docObj.motivo;
          delete docObj.observacion;
          saveContratistas(list);
          
          setDocumentosData(list[currentIdx].documentos.filter(d => d.proyectoId === selectedProyectoId));
          showToast(actionMsg, 'success');
        }
      }
    }
    
    if (!workerRut) {
      setDocumentosData(prev => prev.map(d => {
        if (d.id === docId) {
          return { 
            ...d, 
            estado: 'revision', 
            subido: todayStr,
            motivoRechazo: undefined,
            explicacionRechazo: undefined,
            solucionRechazo: undefined,
            motivo: undefined,
            observacion: undefined
          };
        }
        return d;
      }));
    }
    
    if (selectedDocumentForPanel && selectedDocumentForPanel.id === docId) {
      setSelectedDocumentForPanel({ 
        ...selectedDocumentForPanel, 
        estado: 'revision', 
        subido: todayStr,
        motivoRechazo: undefined,
        explicacionRechazo: undefined,
        solucionRechazo: undefined,
        motivo: undefined,
        observacion: undefined
      });
    }

    showToast(actionMsg, 'success');
  };

  const handleAddWorkerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWorkerForm.nombre || !newWorkerForm.rut) return;
    if (!isValidRut(newWorkerForm.rut)) {
      showToast('RUT inválido, revisa el formato y dígito verificador', 'error');
      return;
    }

    // Get requirements for the active project
    const projectReqs = getRequisitos().filter(r => r.proyectoId === selectedProyectoId && r.destino === 'trabajador' && r.activo !== false);
    const workerDocs = projectReqs.map((r, idx) => ({
      id: `wdoc_${Date.now()}_${idx}`,
      nombre: r.nombre,
      categoria: r.categoria as 'Laboral' | 'Prevención' | 'Tributario',
      estado: 'pendiente' as const,
      vencimiento: '—',
      proyectoId: selectedProyectoId
    }));

    const list = getContratistas();
    const currentIdx = list.findIndex(c => c.id === contratistaLogueado.id);
    if (currentIdx !== -1) {
      const existingWorkerIdx = list[currentIdx].trabajadores?.findIndex(w => w.rut === newWorkerForm.rut);
      if (existingWorkerIdx !== undefined && existingWorkerIdx !== -1) {
        const existingWorker = list[currentIdx].trabajadores![existingWorkerIdx];
        const otherProjId = existingWorker.documentos?.[0]?.proyectoId || selectedProyectoId;
        const globalState = calcularEstadoTrabajador(existingWorker, otherProjId);
        if (globalState !== 'aprobado') {
          const motivo = getMotivoBloqueoTrabajador(existingWorker, otherProjId);
          showToast(`No se puede asignar: El trabajador ${existingWorker.nombre} está ${globalState === 'rechazado' ? 'Bloqueado' : 'En proceso'} (${motivo}).`, 'error');
          return;
        }

        if (!existingWorker.documentos) existingWorker.documentos = [];
        const alreadyHasDocs = existingWorker.documentos.some(d => d.proyectoId === selectedProyectoId);
        if (!alreadyHasDocs) {
          existingWorker.documentos = [...existingWorker.documentos, ...workerDocs];
        }
        existingWorker.estado = calcularEstadoTrabajador(existingWorker, selectedProyectoId);
      } else {
        const newWorker = {
          nombre: newWorkerForm.nombre,
          rut: newWorkerForm.rut,
          estado: 'pendiente' as const,
          cargo: newWorkerForm.cargo || 'Operario',
          faena: misProyectos.find(p => p.id === selectedProyectoId)?.nombre || 'Planta Norte',
          cumplimiento: 0,
          documentos: workerDocs
        };
        if (!list[currentIdx].trabajadores) {
          list[currentIdx].trabajadores = [];
        }
        list[currentIdx].trabajadores!.push(newWorker);
      }
      saveContratistas(list);

      const projectWorkers = list[currentIdx].trabajadores?.filter(w => 
        w.documentos?.some(wd => wd.proyectoId === selectedProyectoId)
      ) || [];
      setTrabajadoresData(projectWorkers);
    }

    setNewWorkerForm({
      nombre: '',
      rut: '',
      cargo: '',
      faena: 'Torre Mackenna'
    });
    setShowAddWorkerModal(false);
    showToast('Trabajador agregado con éxito');
  };

  if (tieneProyecto && !invitacionAceptada) {
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
                <div className="font-semibold text-navy text-[15.4px]">Constructora Andina SA</div>
                <div className="text-[13.2px] text-gray-500">Proyecto Torre Mackenna</div>
              </div>
            </div>
            
            <div className="border-t border-cream3 pt-4">
              <p className="text-[12px] font-semibold text-gray-500 uppercase tracking-wide mb-3">Documentos requeridos:</p>
              <ul className="text-[13.2px] text-gray-600 flex flex-col gap-2.5">
                <li className="flex items-center gap-2"><FileText size={16} className="text-gray-400" /> Contrato de trabajo</li>
                <li className="flex items-center gap-2"><FileText size={16} className="text-gray-400" /> Liquidaciones de sueldo</li>
                <li className="flex items-center gap-2"><FileText size={16} className="text-gray-400" /> F30 SII</li>
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
                  pending.estado = 'aceptada';
                  saveInvitaciones(invs);
                  
                  // Associate contractor to project
                  const projsList = getProyectos();
                  const pIdx = projsList.findIndex(p => p.id === pending.proyectoId);
                  if (pIdx !== -1 && !projsList[pIdx].contratistas.includes(contratistaLogueado.id)) {
                    projsList[pIdx].contratistas.push(contratistaLogueado.id);
                    saveProyectos(projsList);
                  }

                  // Associate project to contractor
                  const contrList = getContratistas();
                  const cIdx = contrList.findIndex(c => c.id === contratistaLogueado.id);
                  if (cIdx !== -1) {
                    const cObj = contrList[cIdx];
                    if (!cObj.proyectos.includes(pending.proyectoId)) {
                      cObj.proyectos.push(pending.proyectoId);
                    }
                    
                    // Create default documents for the contractor for this project
                    const companyReqs = getRequisitos().filter(r => r.proyectoId === pending.proyectoId && r.destino === 'empresa' && r.activo !== false);
                    const newCompanyDocs = companyReqs.map((r, idx) => ({
                      id: `cdoc_${Date.now()}_${idx}`,
                      nombre: r.nombre,
                      categoria: r.categoria as 'Laboral' | 'Prevención' | 'Tributario',
                      estado: 'pendiente' as const,
                      vencimiento: '—',
                      proyectoId: pending.proyectoId
                    }));
                    if (!cObj.documentos) cObj.documentos = [];
                    cObj.documentos = [...cObj.documentos, ...newCompanyDocs];
                    
                    saveContratistas(contrList);
                  }
                  
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
                    onClick={() => { setActiveTab('subir'); setShowNotif(false); }}
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
                    onClick={() => { setActiveTab('subir'); setShowNotif(false); }}
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
                    onClick={() => { setActiveTab('subir'); setShowNotif(false); }}
                    className="flex items-start gap-3 px-4 py-3 hover:bg-cream2 transition-colors cursor-pointer text-left"
                  >
                    <CheckCircle size={18} className="text-green-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-[13.8px] font-medium text-navy">Eléctrica Sur aprobó contrato de trabajo</p>
                      <p className="text-[11.5px] text-gray-400 mt-1">Hace 6 horas</p>
                    </div>
                  </div>
                  <div 
                    onClick={() => { setActiveTab('proyectos'); setShowNotif(false); }}
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
            <div className="w-8 h-8 rounded-full bg-brown text-[var(--brown-text,white)] flex items-center justify-center text-[13.2px] font-semibold">SN</div>
            <span className="text-[14.3px] text-cream hidden md:block">Servicios Norte Ltda.</span>
          </div>
        </div>
      </div>

      {!tieneProyecto && (
        <div className="bg-yellow-50 border-b border-yellow-200 px-6 py-3 flex items-center justify-between sticky top-[64px] z-40">
          <div className="flex items-center gap-2 text-yellow-800 text-sm">
            <AlertTriangle size={16}/>
            <span>Aún no tienes proyectos asignados. Comparte tu perfil para que un mandante te encuentre.</span>
          </div>
          <button 
            className="btn btn-sm btn-secondary" 
            onClick={() => {
              navigator.clipboard.writeText('app.acredita.cl/contratista/mi-perfil');
              showToast('Link copiado al portapapeles');
            }}
          >
            Copiar link de perfil
          </button>
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
        <aside className="hidden lg:flex sidebar flex-col">
          <div className="sb-org">
            <div className="sb-org-name">Servicios Norte Ltda.</div>
            <div className="sb-org-sub">RUT 78.112.445-9 · 3 proyectos activos</div>
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
                {item.badge && <span className="sb-badge bg-brown">{item.badge}</span>}
              </button>
            </React.Fragment>
          ))}
          
          <div className="sb-bottom">
            <button className="sb-item w-full flex text-left mt-auto" onClick={() => navigate('/')}>
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
                  <div className="sb-org-name">Servicios Norte Ltda.</div>
                  <div className="sb-org-sub">RUT 78.112.445-9 · 3 proyectos activos</div>
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
                    {item.badge && <span className="sb-badge bg-brown">{item.badge}</span>}
                  </button>
                </React.Fragment>
              ))}
              
              <div className="sb-bottom">
                <button className="sb-item w-full flex text-left mt-auto" onClick={() => { setMobileMenuOpen(false); navigate('/'); }}>
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
              trabajadoresData={trabajadoresData}
              numAprobados={numAprobados}
              numRechazados={numRechazados}
              numPendientes={numPendientes}
              numPorVencer={numPorVencer}
              approvedWorkers={approvedWorkers}
              totalWorkers={totalWorkers}
              pendingWorkers={pendingWorkers}
              setActiveTab={setActiveTab}
              setSelectedDocumentForPanel={setSelectedDocumentForPanel}
              setFichaTipo={setFichaTipo}
              setFichaTrabajador={setFichaTrabajador}
              setShowFichaAcreditacion={setShowFichaAcreditacion}
            />
          )}

          {activeTab === 'subir' && (
            <SubirTab
              misProyectos={misProyectos}
              numAprobados={numAprobados}
              numPorVencer={numPorVencer}
              numRechazados={numRechazados}
              numPendientes={numPendientes}
              documentosData={documentosData}
              selectedProyectoId={selectedProyectoId}
              setSelectedDocumentForPanel={setSelectedDocumentForPanel}
            />
          )}

          {activeTab === 'proyectos' && (
            <MisProyectosTab setActiveTab={setActiveTab} />
          )}

          {activeTab === 'biblioteca' && (
            <BibliotecaTab setShowAddWorkerModal={setShowAddWorkerModal} />
          )}

          {activeTab === 'asesoria' && (
            <AsesoriaTab />
          )}

          {activeTab === 'trabajadores' && (
            <TrabajadoresTab
              selectedWorkerForDocs={selectedWorkerForDocs}
              setSelectedWorkerForDocs={setSelectedWorkerForDocs}
              contratistaLogueado={contratistaLogueado}
              selectedProyectoId={selectedProyectoId}
              setSelectedProyectoId={setSelectedProyectoId}
              setFichaTipo={setFichaTipo}
              setFichaTrabajador={setFichaTrabajador}
              setShowFichaAcreditacion={setShowFichaAcreditacion}
              setSelectedDocumentForPanel={setSelectedDocumentForPanel}
              misProyectos={misProyectos}
              trabajadoresData={trabajadoresData}
              setShowAddWorkerModal={setShowAddWorkerModal}
            />
          )}

          {activeTab === 'config' && (
            <ConfigTab
              activeConfigTab={activeConfigTab}
              setActiveConfigTab={setActiveConfigTab}
              canalAlertas={canalAlertas}
              setCanalAlertas={setCanalAlertas}
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
          tipo={fichaTipo}
          contratista={contratistaLogueado}
          trabajador={fichaTrabajador}
          proyectoId={selectedProyectoId}
          onClose={() => setShowFichaAcreditacion(false)}
          rol="contratista"
          onCorregirDocumento={(doc) => {
            setSelectedDocumentForPanel(doc);
            setShowFichaAcreditacion(false);
          }}
        />
      )}

      {selectedDocumentForPanel && (
        <DocumentDetailPanel 
          doc={selectedDocumentForPanel} 
          onClose={() => setSelectedDocumentForPanel(null)} 
          onUpload={(docId, msg) => handleUploadDocument(docId, msg, selectedWorkerForDocs?.rut)}
          showToast={showToast} 
        />
      )}

      {showAddWorkerModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowAddWorkerModal(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-[440px] max-h-[calc(100vh-24px)] overflow-y-auto font-sans" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center p-4 border-b border-cream">
              <h3 className="font-semibold text-navy text-[17.6px] flex items-center gap-2">
                <UserPlus size={18} className="text-brown" /> Agregar trabajador
              </h3>
              <button 
                onClick={() => setShowAddWorkerModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded"
              >
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleAddWorkerSubmit} className="p-6 flex flex-col gap-4 max-h-[80vh] overflow-y-auto">
              {(() => {
                const list = getContratistas();
                const currentC = list.find(c => c.id === contratistaLogueado.id);
                const existingWorkers = currentC?.trabajadores || [];
                const unassignedWorkers = existingWorkers.filter(w => !w.documentos?.some(d => d.proyectoId === selectedProyectoId));

                if (unassignedWorkers.length === 0) return null;

                return (
                  <div className="border-b border-cream3 pb-4 mb-2">
                    <label className="block text-[13px] font-bold text-navy mb-2">Asignar de la plantilla de la empresa</label>
                    <div className="flex flex-col gap-2 max-h-[160px] overflow-y-auto pr-1">
                      {unassignedWorkers.map(w => {
                        const globalProjId = w.documentos?.[0]?.proyectoId || selectedProyectoId;
                        const globalState = calcularEstadoTrabajador(w, globalProjId);
                        const isAprobado = globalState === 'aprobado';
                        
                        const stateBadge = globalState === 'aprobado' ? 'b-green' : globalState === 'rechazado' ? 'b-red' : 'b-yellow';
                        const statusLabel = globalState === 'aprobado' ? 'Aprobado' : globalState === 'rechazado' ? 'Bloqueado' : 'En proceso';
                        const motivo = globalState !== 'aprobado' ? getMotivoBloqueoTrabajador(w, globalProjId) : '';

                        return (
                          <div key={w.rut} className="flex justify-between items-center p-2.5 bg-cream/30 border border-cream3 rounded-lg text-[12.5px] font-sans">
                            <div className="flex-1 min-w-0 mr-2">
                              <div className="font-semibold text-navy truncate">{w.nombre}</div>
                              <div className="text-[11px] text-gray-500 font-mono">{w.rut}</div>
                              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                <span className={`badge ${stateBadge} text-[9px] py-0 px-1`}>{statusLabel}</span>
                                {motivo && <span className="text-[10px] text-red-600 font-semibold truncate max-w-[130px]" title={motivo}>{motivo}</span>}
                              </div>
                            </div>
                            {isAprobado ? (
                              <button
                                type="button"
                                onClick={() => {
                                  const projectReqs = getRequisitos().filter(r => r.proyectoId === selectedProyectoId && r.destino === 'trabajador' && r.activo !== false);
                                  const workerDocs = projectReqs.map((r, idx) => ({
                                    id: `wdoc_${Date.now()}_${idx}`,
                                    nombre: r.nombre,
                                    categoria: r.categoria as 'Laboral' | 'Prevención' | 'Tributario',
                                    estado: 'pendiente' as const,
                                    vencimiento: '—',
                                    proyectoId: selectedProyectoId
                                  }));

                                  const listData = getContratistas();
                                  const currentIdx = listData.findIndex(c => c.id === contratistaLogueado.id);
                                  if (currentIdx !== -1) {
                                    const workerIdx = listData[currentIdx].trabajadores?.findIndex(tw => tw.rut === w.rut);
                                    if (workerIdx !== undefined && workerIdx !== -1) {
                                      const wk = listData[currentIdx].trabajadores![workerIdx];
                                      if (!wk.documentos) wk.documentos = [];
                                      wk.documentos = [...wk.documentos, ...workerDocs];
                                      wk.estado = calcularEstadoTrabajador(wk, selectedProyectoId);
                                      saveContratistas(listData);

                                      const updatedWorkers = listData[currentIdx].trabajadores?.filter(tw => 
                                        tw.documentos?.some(wd => wd.proyectoId === selectedProyectoId)
                                      ) || [];
                                      setTrabajadoresData(updatedWorkers);
                                      showToast(`Trabajador ${w.nombre} asignado con éxito`);
                                      setShowAddWorkerModal(false);
                                    }
                                  }
                                }}
                                className="btn btn-primary btn-sm py-1 px-2.5 text-[11px] shrink-0 font-medium"
                              >
                                Asignar
                              </button>
                            ) : (
                              <span className="badge b-gray py-1 px-2 text-[10.5px] text-gray-500 font-semibold cursor-not-allowed shrink-0">
                                [No habilitado]
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              <div className="text-[13px] font-bold text-navy border-t border-cream pt-2 mt-1">Registrar nuevo trabajador</div>

              <div>
                <label className="block text-[13px] font-medium text-gray-700 mb-1.5">Nombre Completo</label>
                <input 
                  type="text" 
                  value={newWorkerForm.nombre}
                  onChange={(e) => setNewWorkerForm({...newWorkerForm, nombre: e.target.value})}
                  className="form-input w-full p-2.5 border border-cream3 rounded-lg focus:border-brown focus:ring-1 focus:ring-brown outline-none transition-all text-sm" 
                  placeholder="Juan Pérez" 
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
                <label className="block text-[13px] font-medium text-gray-700 mb-1.5">Cargo / Función</label>
                <input 
                  type="text" 
                  value={newWorkerForm.cargo}
                  onChange={(e) => setNewWorkerForm({...newWorkerForm, cargo: e.target.value})}
                  className="form-input w-full p-2.5 border border-cream3 rounded-lg focus:border-brown focus:ring-1 focus:ring-brown outline-none transition-all text-sm" 
                  placeholder="Operador de Maquinaria, Jornalero, Eléctrico..." 
                  required 
                />
              </div>

              <div>
                <label className="block text-[13px] font-medium text-gray-700 mb-1.5">Asignar a Faena / Proyecto</label>
                <select 
                  value={newWorkerForm.faena}
                  onChange={(e) => setNewWorkerForm({...newWorkerForm, faena: e.target.value})}
                  className="form-input w-full p-2.5 border border-cream3 rounded-lg focus:border-brown focus:ring-1 focus:ring-brown outline-none transition-all text-sm bg-white"
                  required
                >
                  {misProyectos.map(p => (
                    <option key={p.id} value={p.nombre}>{p.nombre}</option>
                  ))}
                </select>
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
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
