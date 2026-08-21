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
import { getContratistas, saveContratistas, getProyectos, saveProyectos, getMandantes, getPlantillas, calcularEstadoAcreditacion, calcularEstadoTrabajador, getRequisitos, saveRequisitos, esVencidoPorFecha, esPorVencerPorFecha, obtenerDiasRestantes, getMotivoBloqueoTrabajador, getInvitaciones, saveInvitaciones, esTrabajadorAsignado, getCurrentSession, logoutUser, aceptarInvitacion, rechazarInvitacion, registrarAuditoria } from '../data/localStorageDb';
import FichaAcreditacion from '../components/FichaAcreditacion';

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

  const session = getCurrentSession();
  const contratistaLogueado = allContratistas.find(c => c.id === session?.contratistaId) || allContratistas[0];
  const misProyectos = allProyectos.filter(p => p.contratistas.includes(contratistaLogueado.id));

  const [selectedProyectoId, setSelectedProyectoId] = useState(() => {
    return misProyectos[0]?.id || '';
  });

  React.useEffect(() => {
    if (selectedProyectoId && !misProyectos.some(p => p.id === selectedProyectoId)) {
      setSelectedProyectoId(misProyectos[0]?.id || '');
    }
  }, [selectedProyectoId, misProyectos]);

  const [documentosData, setDocumentosData] = useState<Documento[]>([]);
  const [trabajadoresData, setTrabajadoresData] = useState<any[]>([]);

  React.useEffect(() => {
    const list = getContratistas();
    const cObj = list.find(c => c.id === contratistaLogueado.id);
    if (cObj) {
      const filteredDocs = cObj.documentos.filter(d => d.proyectoId === selectedProyectoId);
      setDocumentosData(filteredDocs);
      
      const projectWorkers = cObj.trabajadores?.filter(w => 
        esTrabajadorAsignado(w, selectedProyectoId, allProyectos)
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

    const session = getCurrentSession();
    const actorEmail = session?.email || contratistaLogueado.id;
    const actorRol = session?.role || 'contratista';

    if (currentIdx !== -1) {
      if (workerRut) {
        const workerIdx = list[currentIdx].trabajadores?.findIndex(w => w.rut === workerRut);
        if (workerIdx !== undefined && workerIdx !== -1) {
          const docIdx = list[currentIdx].trabajadores![workerIdx].documentos?.findIndex(d => d.id === docId);
          if (docIdx !== undefined && docIdx !== -1) {
            const docObj = list[currentIdx].trabajadores![workerIdx].documentos![docIdx];
            const prevEstado = docObj.estado;
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
            
            registrarAuditoria({
              usuarioId: actorEmail,
              rol: actorRol,
              contratistaId: contratistaLogueado.id,
              proyectoId: selectedProyectoId,
              accion: prevEstado === 'pendiente' ? 'carga_documento' : 'reemplazo_documento',
              entidad: 'documento_trabajador',
              entidadId: docObj.id,
              estadoAnterior: prevEstado,
              estadoNuevo: 'revision',
              detalle: `${prevEstado === 'pendiente' ? 'Cargado' : 'Reemplazado'} documento ${docObj.nombre} del trabajador ${workerObj.nombre}`
            });

            const projectWorkers = list[currentIdx].trabajadores?.filter(w => 
              esTrabajadorAsignado(w, selectedProyectoId, allProyectos)
            ) || [];
            setTrabajadoresData(projectWorkers);
            showToast(actionMsg, 'success');
          }
        }
      } else {
        const docIdx = list[currentIdx].documentos.findIndex(d => d.id === docId);
        if (docIdx !== -1) {
          const docObj = list[currentIdx].documentos[docIdx];
          const prevEstado = docObj.estado;
          docObj.estado = 'revision';
          docObj.subido = todayStr;
          docObj.archivoReferencia = `mock_file_${docId}.pdf`;
          delete docObj.motivoRechazo;
          delete docObj.explicacionRechazo;
          delete docObj.solucionRechazo;
          delete docObj.motivo;
          delete docObj.observacion;
          saveContratistas(list);
          
          registrarAuditoria({
            usuarioId: actorEmail,
            rol: actorRol,
            contratistaId: contratistaLogueado.id,
            proyectoId: selectedProyectoId,
            accion: prevEstado === 'pendiente' ? 'carga_documento' : 'reemplazo_documento',
            entidad: 'documento_empresa',
            entidadId: docObj.id,
            estadoAnterior: prevEstado,
            estadoNuevo: 'revision',
            detalle: `${prevEstado === 'pendiente' ? 'Cargado' : 'Reemplazado'} documento ${docObj.nombre} de la empresa`
          });

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
    const session = getCurrentSession();
    const actorEmail = session?.email || contratistaLogueado.id;
    const actorRol = session?.role || 'contratista';

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

        registrarAuditoria({
          usuarioId: actorEmail,
          rol: actorRol,
          contratistaId: contratistaLogueado.id,
          proyectoId: selectedProyectoId,
          accion: 'asignacion_trabajador',
          entidad: 'trabajador',
          entidadId: existingWorker.rut,
          detalle: `Asignado trabajador existente ${existingWorker.nombre} (${existingWorker.rut}) al proyecto`
        });
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

        registrarAuditoria({
          usuarioId: actorEmail,
          rol: actorRol,
          contratistaId: contratistaLogueado.id,
          proyectoId: selectedProyectoId,
          accion: 'creacion_trabajador',
          entidad: 'trabajador',
          entidadId: newWorker.rut,
          detalle: `Creado y asignado nuevo trabajador ${newWorker.nombre} (${newWorker.rut})`
        });
      }
      saveContratistas(list);

      const projectWorkers = list[currentIdx].trabajadores?.filter(w => 
        esTrabajadorAsignado(w, selectedProyectoId, allProyectos)
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
                  const res = aceptarInvitacion(pending.id, contratistaLogueado.id);
                  if (!res.success) {
                    showToast(res.error || 'Error al aceptar invitación', 'error');
                    return;
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
                  const res = rechazarInvitacion(pending.id, contratistaLogueado.id);
                  if (!res.success) {
                    showToast(res.error || 'Error al rechazar invitación', 'error');
                    return;
                  }
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
                <button className="sb-item w-full flex text-left mt-auto" onClick={() => { logoutUser(); setMobileMenuOpen(false); navigate('/'); }}>
                  <LogOut size={18} /> Cerrar sesión
                </button>
              </div>
            </div>
          </>
        )}

        {/* MAIN CONTENT */}
        <div className="main pb-24 lg:pb-0">
          
          {/* DASHBOARD */}
          {activeTab === 'dashboard' && (
            <div className="fade-in flex flex-col gap-6">
              <div className="page-header">
                <div>
                  <h2 className="page-title">Mi dashboard - {contratistaLogueado.nombre}</h2>
                  <div className="flex items-center gap-3 mt-1 text-[12.5px]">
                    <span className="text-gray-500 font-medium">RUT: {contratistaLogueado.rut}</span>
                    <span className="text-gray-300">|</span>
                    <select
                      value={selectedProyectoId}
                      onChange={(e) => setSelectedProyectoId(e.target.value)}
                      className="text-[12.5px] border border-cream3 rounded-md px-2 py-0.5 bg-white text-navy focus:outline-none focus:border-brown font-semibold cursor-pointer"
                    >
                      {misProyectos.map(p => (
                        <option key={p.id} value={p.id}>Proyecto: {p.nombre}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
              
              {showWelcomeAlert && (
                <div className="alert alert-success fade-in mb-2 flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <CheckCircle size={18} className="shrink-0" /> 
                    <span><strong>Bienvenido al proyecto</strong> — revisa los requisitos de acreditación abajo.</span>
                  </div>
                  <button onClick={() => setShowWelcomeAlert(false)} className="text-[#2a6a3a] hover:opacity-70">
                    <X size={16} />
                  </button>
                </div>
              )}
              
              {/* Tu Acreditación Card */}
              <div className="card bg-cream border border-cream3 p-5">
                <h3 className="section-title text-[15px] font-bold text-navy mb-4 flex items-center justify-between gap-2 w-full">
                  <span className="flex items-center gap-2">
                    <CheckCircle size={18} className="text-green-600" />
                    Tu Acreditación
                  </span>
                  {(() => {
                    const status = calcularEstadoAcreditacion(contratistaLogueado);
                    const badgeClass = status === 'Aprobado' ? 'b-green' : status === 'Vencido/Bloqueado' ? 'b-red' : 'b-yellow';
                    return <span className={`badge ${badgeClass} text-[11px]`}>{status === 'Aprobado' ? 'Acreditado' : status === 'Vencido/Bloqueado' ? 'Bloqueado' : status}</span>;
                  })()}
                </h3>
                
                <div className="flex flex-col md:flex-row gap-6 items-center">
                  {/* Left side: indicators */}
                  <div className="flex-1 w-full flex flex-col gap-4">
                    <div>
                      <div className="flex justify-between items-center text-[13.2px] font-semibold text-navy mb-1.5">
                        <span>Requisitos de Empresa</span>
                        <span className="text-gray-500 font-medium">{numAprobados} / {documentosData.length} aprobados</span>
                      </div>
                      <div className="prog-wrap"><div className="prog-fill" style={{ width: `${documentosData.length > 0 ? Math.round((numAprobados / documentosData.length) * 100) : 100}%` }}></div></div>
                    </div>
                    <div>
                      <div className="flex justify-between items-center text-[13.2px] font-semibold text-navy mb-1.5">
                        <span>Acreditación de Personal</span>
                        <span className="text-gray-500 font-medium">{approvedWorkers} / {totalWorkers} trabajadores acreditados</span>
                      </div>
                      <div className="prog-wrap"><div className="prog-fill" style={{ width: `${totalWorkers > 0 ? Math.round((approvedWorkers / totalWorkers) * 100) : 100}%`, backgroundColor: '#2a6a3a' }}></div></div>
                    </div>
                  </div>

                  {/* Right side: Payment Status secondary info */}
                  <div className="w-full md:w-56 bg-white border border-cream3 rounded-2xl p-4 flex flex-col items-center justify-center text-center">
                    <span className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-1">Estado de Pago</span>
                    {(() => {
                      const status = calcularEstadoAcreditacion(contratistaLogueado, selectedProyectoId);
                      const isAprobado = status === 'Aprobado';
                      return (
                        <span className={`badge ${isAprobado ? 'b-green' : 'b-red'} text-xs font-bold py-1 px-3 mb-3`}>
                          {isAprobado ? 'Pago Habilitado' : 'Pago Retenido'}
                        </span>
                      );
                    })()}
                    <button 
                      className="btn btn-secondary btn-sm w-full py-1 text-[11px] font-semibold"
                      onClick={() => {
                        setFichaTipo('empresa');
                        setFichaTrabajador(null);
                        setShowFichaAcreditacion(true);
                      }}
                    >
                      Ver Ficha
                    </button>
                  </div>
                </div>
              </div>

              {/* Te Faltan Section */}
              <div className="card">
                <div className="flex justify-between items-center mb-4 border-b border-cream3 pb-3">
                  <h3 className="section-title mb-0 flex items-center gap-2">
                    <AlertCircle size={18} className="text-red-600" />
                    Requisitos por completar ("Te falta")
                  </h3>
                  <span className="badge b-red font-semibold">{numRechazados + numPendientes + numPorVencer} pendientes</span>
                </div>

                {numRechazados + numPendientes + numPorVencer > 0 ? (
                   <div className="flex flex-col gap-3">
                     {/* Rejected company documents */}
                     {documentosData.filter(d => d.estado === 'rechazado').map(d => (
                       <div key={d.id} className="p-3 border border-red-100 bg-red-50/50 rounded-xl flex justify-between items-center gap-3">
                         <div className="flex-1">
                           <div className="text-[13.8px] font-bold text-red-800 flex items-center gap-1.5">
                             <XCircle size={15} /> Empresa: {d.nombre} (Rechazado)
                           </div>
                           <p className="text-[12.1px] text-red-600 mt-1"><strong>Motivo:</strong> {d.motivo || d.observacion || 'Rechazado por auditoría'}</p>
                         </div>
                          <button className="btn btn-primary btn-sm shrink-0" onClick={() => { setActiveTab('subir'); setSelectedDocumentForPanel(d); }}>
                            Corregir
                          </button>
                       </div>
                     ))}
                     
                     {/* Rejected worker statuses */}
                     {trabajadoresData.filter(t => t.estado === 'rechazado').map((t, idx) => (
                       <div key={idx} className="p-3 border border-red-100 bg-red-50/50 rounded-xl flex justify-between items-center gap-3">
                         <div className="flex-1">
                           <div className="text-[13.8px] font-bold text-red-800 flex items-center gap-1.5">
                             <XCircle size={15} /> Trabajador: {t.nombre} (Rechazado)
                           </div>
                           <p className="text-[12.1px] text-red-600 mt-1"><strong>Observación:</strong> {t.detalle || 'Documentación rechazada o vencida'}</p>
                         </div>
                         <button className="btn btn-primary btn-sm shrink-0" onClick={() => setActiveTab('trabajadores')}>
                           Ver trabajador
                         </button>
                       </div>
                     ))}

                     {/* Pending or expiring company documents */}
                     {documentosData.filter(d => d.estado === 'pendiente' || d.estado === 'por_vencer').map(d => (
                       <div key={d.id} className="p-3 border border-cream3 bg-gray-50/50 rounded-xl flex justify-between items-center gap-3">
                         <div className="flex-1">
                           <div className="text-[13.8px] font-semibold text-navy flex items-center gap-1.5">
                             {d.estado === 'por_vencer' ? <AlertTriangle size={15} className="text-yellow-600" /> : <Clock size={15} className="text-gray-400" />}
                             Empresa: {d.nombre} ({d.estado === 'por_vencer' ? 'Por vencer' : 'Pendiente subir'})
                           </div>
                           <p className="text-[12.1px] text-gray-500 mt-0.5">{d.vencimiento && d.vencimiento !== '-' ? `Vence: ${d.vencimiento}` : 'Pendiente de subir'}</p>
                         </div>
                         <button className="btn btn-primary btn-sm shrink-0" onClick={() => setActiveTab('subir')}>
                           Subir
                         </button>
                       </div>
                     ))}
                     
                     <div className="mt-2">
                       <button className="btn btn-primary w-full justify-center" onClick={() => setActiveTab('subir')}>
                         Continuar acreditación
                       </button>
                     </div>
                   </div>
                ) : (
                   <div className="py-8 flex flex-col items-center justify-center text-center text-gray-500">
                     <CheckCircle size={36} className="text-green-500 mb-2" />
                     <p className="font-semibold text-navy">¡Acreditación al día!</p>
                     <p className="text-sm">No tienes requisitos pendientes ni rechazados en tu portal.</p>
                   </div>
                )}
              </div>

              {/* Workers Summary Card */}
              <div className="card">
                <div className="flex justify-between items-center mb-4 border-b border-cream3 pb-3">
                  <h3 className="section-title mb-0 flex items-center gap-2">
                    <Users size={18} className="text-navy" />
                    Personal Acreditado
                  </h3>
                  <span className="badge b-gray font-semibold">{totalWorkers} trabajadores</span>
                </div>
                 
                <p className="text-sm text-gray-600 mb-4 leading-relaxed">
                  Tienes <strong>{approvedWorkers}</strong> trabajadores acreditados y listos para ingresar a faena de un total de {totalWorkers} ({pendingWorkers} pendientes o con observaciones).
                </p>
                 
                <button className="btn btn-secondary w-full justify-center flex items-center gap-1.5" onClick={() => setActiveTab('trabajadores')}>
                  <Users size={14} /> Ver trabajadores
                </button>
              </div>

              {/* Estado por proyecto */}
              <div className="flex justify-between items-center mb-1">
                <h3 className="section-title mb-0">Estado por proyecto</h3>
                <button className="btn btn-ghost btn-sm" onClick={() => setActiveTab('proyectos')}>Ver todos <ArrowRight size={14} /></button>
              </div>
              
              <div className="card-grid">
                {misProyectos.map(p => {
                  const mandante = allMandantes.find(m => m.id === p.mandanteId);
                  let badgeType = 'b-green';
                  let statusText = 'Al día';
                  let percent = 100;
                  let detailText = 'Pago habilitado';
                  
                  if (p.id === 'mackenna') {
                    badgeType = 'b-yellow';
                    statusText = 'Atención';
                    percent = 85;
                    detailText = '85% · 1 por vencer · pago habilitado';
                  } else if (p.id === 'solar') {
                    badgeType = 'b-red';
                    statusText = 'Crítico';
                    percent = 50;
                    detailText = '50% · 1 rechazado · pago retenido';
                  } else if (p.id === 'bodega') {
                    badgeType = 'b-green';
                    statusText = 'Al día';
                    percent = 100;
                    detailText = '100% · pago habilitado';
                  }
                  
                  return (
                    <div key={p.id} className="proj-card" onClick={() => setActiveTab('subir')}>
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="text-[15.4px] font-medium">{mandante?.nombre || 'Mandante'}</h4>
                        <span className={`badge ${badgeType}`}>{statusText}</span>
                      </div>
                      <p className="text-[13.2px] text-gray-500 mb-2">Proyecto {p.nombre}</p>
                      <div className="prog-wrap"><div className="prog-fill" style={{ width: `${percent}%`, backgroundColor: badgeType === 'b-red' ? '#c02020' : badgeType === 'b-yellow' ? '#c08000' : '#2a6a3a' }}></div></div>
                      <p className="text-[13.2px] text-gray-600 mt-2">{detailText}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* SUBIR DOCUMENTOS (Checklist) */}
          {activeTab === 'subir' && (
            <div className="fade-in">
              <div className="page-header">
                <div>
                  <h2 className="page-title">Checklist de documentos</h2>
                  <p className="page-sub">Proyecto Torre Mackenna · Constructora Andina SA</p>
                </div>
                <select className="form-input py-1.5 min-w-[200px]">
                  {misProyectos.map(p => (
                    <option key={p.id}>Proyecto {p.nombre}</option>
                  ))}
                </select>
              </div>
              
              <div className="flex gap-2 flex-wrap mb-4">
                <span className="badge b-green px-3 py-1"><CheckCircle size={14} /> Aprobados: {numAprobados}</span>
                <span className="badge b-yellow px-3 py-1"><Clock size={14} /> Por vencer: {numPorVencer}</span>
                <span className="badge b-red px-3 py-1"><X size={14} /> Rechazados: {numRechazados}</span>
                <span className="badge b-gray px-3 py-1"><Upload size={14} /> Pendientes: {numPendientes}</span>
              </div>
              
              <div className="md:hidden flex flex-col gap-3">
                {documentosData.map(doc => {
                  const isVencido = esVencidoPorFecha(doc.vencimiento);
                  const req = getRequisitos().find(r => r.proyectoId === selectedProyectoId && (doc.nombre.toLowerCase().includes(r.nombre.toLowerCase()) || r.nombre.toLowerCase().includes(doc.nombre.toLowerCase())));
                  const alertaDias = req ? req.alertaDias : 30;
                  const isPorVencer = esPorVencerPorFecha(doc.vencimiento, alertaDias);
                  const diasRestantes = obtenerDiasRestantes(doc.vencimiento);

                  let badgeColor = 'b-gray';
                  let statusLabel = doc.estado;
                  let subtext = doc.vencimiento && doc.vencimiento !== '—' ? `Vence: ${doc.vencimiento}` : 'Sin vencimiento';

                  if (doc.estado === 'aprobado') {
                    if (isVencido) {
                      badgeColor = 'b-red';
                      statusLabel = 'Vencido';
                      subtext = 'Tu documento está vencido';
                    } else if (isPorVencer) {
                      badgeColor = 'b-yellow';
                      statusLabel = 'Por vencer';
                      subtext = `Tu documento vence en ${diasRestantes} días`;
                    } else {
                      badgeColor = 'b-green';
                      statusLabel = 'Aprobado';
                    }
                  } else if (doc.estado === 'rechazado') {
                    badgeColor = 'b-red';
                    statusLabel = 'Rechazado';
                  } else if (doc.estado === 'revision') {
                    badgeColor = 'b-blue';
                    statusLabel = 'En revisión';
                  }

                  return (
                    <div key={doc.id} className="card p-4 flex flex-col gap-2 cursor-pointer hover:shadow-sm transition-all" onClick={() => setSelectedDocumentForPanel(doc)}>
                      <div className="flex justify-between items-start">
                        <span className="font-medium text-sm text-navy">{doc.nombre}</span>
                        <span className={`badge ${badgeColor} text-xs`}>{statusLabel}</span>
                      </div>
                      <span className="text-xs text-gray-500">{subtext}</span>
                      {doc.observacion && <span className="text-xs text-red-500">{doc.observacion}</span>}
                    </div>
                  );
                })}
              </div>

              <div className="card hidden md:block">
                {documentosData.map(doc => {
                  const isVencido = esVencidoPorFecha(doc.vencimiento);
                  const req = getRequisitos().find(r => r.proyectoId === selectedProyectoId && (doc.nombre.toLowerCase().includes(r.nombre.toLowerCase()) || r.nombre.toLowerCase().includes(doc.nombre.toLowerCase())));
                  const alertaDias = req ? req.alertaDias : 30;
                  const isPorVencer = esPorVencerPorFecha(doc.vencimiento, alertaDias);
                  const diasRestantes = obtenerDiasRestantes(doc.vencimiento);

                  let RowIcon = Clock;
                  let iconColorClass = 'text-gray-400';
                  let rowBgClass = '';
                  let badgeClass = 'b-gray';
                  let badgeLabel = 'Pendiente';
                  let subtext = `Sin subir · Vence el ${doc.vencimiento}`;
                  let actionBtn = (
                    <button className="btn btn-secondary btn-sm" onClick={() => setSelectedDocumentForPanel(doc)}>
                      <Upload size={14} /> Subir
                    </button>
                  );

                  let effectiveEstado = doc.estado;
                  if (doc.estado === 'aprobado') {
                    if (isVencido) effectiveEstado = 'vencido';
                    else if (isPorVencer) effectiveEstado = 'por_vencer';
                  }

                  if (effectiveEstado === 'aprobado') {
                    RowIcon = FileCheck;
                    iconColorClass = 'text-[#2a6a3a]';
                    badgeClass = 'b-green';
                    badgeLabel = 'Aprobado';
                    subtext = 'Subido · Validación automática';
                    actionBtn = (
                      <button className="btn btn-ghost btn-sm" onClick={() => setSelectedDocumentForPanel(doc)}>
                        <Eye size={14}/>
                      </button>
                    );
                  } else if (effectiveEstado === 'por_vencer') {
                    RowIcon = AlertTriangle;
                    iconColorClass = 'text-[#c08000]';
                    rowBgClass = 'bg-[#fffdf5] -mx-4 px-4 py-3 border-y border-cream3 rounded-md';
                    badgeClass = 'b-yellow';
                    badgeLabel = 'Por vencer';
                    subtext = `Tu documento vence en ${diasRestantes} días`;
                    actionBtn = (
                      <button className="btn btn-primary btn-sm" onClick={() => setSelectedDocumentForPanel(doc)}>
                        <Upload size={14} /> Renovar
                      </button>
                    );
                  } else if (effectiveEstado === 'rechazado' || effectiveEstado === 'vencido') {
                    RowIcon = X;
                    iconColorClass = 'text-[#c02020]';
                    rowBgClass = 'bg-[#fff8f8] -mx-4 px-4 py-3 border-b border-cream3 rounded-md';
                    badgeClass = 'b-red';
                    badgeLabel = effectiveEstado === 'vencido' ? 'Vencido' : 'Rechazado';
                    subtext = effectiveEstado === 'vencido' ? 'Tu documento está vencido' : (doc.observacion || 'Documento rechazado.');
                    actionBtn = (
                      <button className="btn btn-danger btn-sm" onClick={() => setSelectedDocumentForPanel(doc)}>
                        <Upload size={14} /> Corregir
                      </button>
                    );
                  } else if (effectiveEstado === 'revision') {
                    RowIcon = Clock;
                    iconColorClass = 'text-blue-500';
                    badgeClass = 'b-blue';
                    badgeLabel = 'En revisión';
                    subtext = 'Enviado para revisión por auditoría';
                    actionBtn = (
                      <button className="btn btn-ghost btn-sm" onClick={() => setSelectedDocumentForPanel(doc)}>
                        <Eye size={14}/>
                      </button>
                    );
                  }

                  return (
                    <div key={doc.id} className={`doc-row cursor-pointer hover:bg-cream/40 ${rowBgClass} transition-colors`} onClick={() => setSelectedDocumentForPanel(doc)}>
                      <RowIcon size={20} className={`${iconColorClass} shrink-0`} />
                      <div className="flex-1 font-sans">
                        <div className="text-[15.4px] font-medium text-navy">{doc.nombre}</div>
                        <div className={`text-[13.2px] ${doc.estado === 'por_vencer' ? 'text-[#a07000]' : doc.estado === 'rechazado' ? 'text-[#c03030]' : 'text-gray-400'}`}>
                          {subtext}
                        </div>
                      </div>
                      <span className={`badge ${badgeClass}`}>{badgeLabel}</span>
                      <div className="doc-meta font-sans">{doc.vencimiento && doc.vencimiento !== '—' ? doc.vencimiento : ''}</div>
                      <div onClick={(e) => e.stopPropagation()}>
                        {actionBtn}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="card mt-4">
                <h3 className="section-title">Subir nuevo documento</h3>
                <div className="border-2 border-dashed border-cream3 rounded-xl p-8 flex flex-col items-center justify-center bg-cream2 hover:bg-[#faf5f0] hover:border-brown transition-colors cursor-pointer text-center">
                  <CloudUpload size={32} className="text-brown mb-2" />
                  <div className="text-[15.4px] font-medium text-navy mb-1">Arrastra el archivo aquí o haz clic para seleccionar</div>
                  <div className="text-[13.2px] text-gray-500">PDF, JPG o PNG · máx. 10 MB</div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                  <div className="form-group">
                    <label className="form-label">Tipo de documento</label>
                    <select className="form-input">
                      <option>Liquidación de sueldo</option>
                      <option>Contrato de trabajo</option>
                      <option>F30 SII</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Trabajador (si aplica)</label>
                    <select className="form-input">
                      <option>— Empresa general —</option>
                      <option>Juan Pérez González</option>
                    </select>
                  </div>
                </div>
                <button className="btn btn-primary w-full py-2.5 mt-2 cursor-not-allowed opacity-55" disabled title="Usa la sección 'Mis proyectos' o la Ficha para subir documentos de forma interactiva"><Upload size={16} /> Subir y validar [Demo]</button>
              </div>
            </div>
          )}

          {/* MIS PROYECTOS */}
          {activeTab === 'proyectos' && (
            <div className="fade-in">
              <div className="page-header">
                <div>
                  <h2 className="page-title">Mis Proyectos Asignados</h2>
                  <p className="page-sub">Obras y faenas donde prestas servicios</p>
                </div>
                <div className="relative">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input type="text" className="form-input pl-9 w-64" placeholder="Buscar proyecto..." />
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {/* Critical */}
                <div className="card !p-0 border-l-4 border-l-[#c02020] overflow-hidden flex flex-col h-full bg-white shadow-sm">
                  <div className="p-4 border-b border-cream">
                    <div className="flex justify-between items-start mb-2">
                       <div className="flex gap-2 items-center text-gray-500 uppercase text-[11px] font-bold tracking-wider">
                         <Building2 size={14} /> CONSTRUCTORA ANDINA SA
                       </div>
                    </div>
                    <h3 className="text-[18px] font-bold text-navy flex items-center gap-2">
                      <MapPin size={18} className="text-gray-400"/> Proyecto Costanera Norte
                    </h3>
                  </div>
                  
                  <div className="p-4 flex-1 flex flex-col justify-center">
                    <div className="bg-[#fff8f8] border border-[#f5e6e6] rounded-lg p-4 mb-2">
                       <div className="flex items-center gap-2 text-[#c02020] font-medium text-[13.2px] mb-3">
                         <AlertCircle size={16} /> Requiere tu atención
                       </div>
                       <div className="prog-wrap !m-0 mb-3 border border-cream/50 bg-white"><div className="prog-fill w-[71%] bg-[#c02020]"></div></div>
                       <div className="text-[12.1px] flex items-center gap-2 flex-wrap">
                         <span className="text-[#c02020] font-semibold">1 Rechazado</span>
                         <span className="text-gray-400 text-[10px]">●</span>
                         <span className="text-gray-500">2 Pendientes</span>
                         <span className="text-gray-400 text-[10px]">●</span>
                         <span className="text-[#2a6a3a]">5 Aprobados</span>
                       </div>
                    </div>
                  </div>
                  
                  <div className="p-4 pt-0 mt-auto">
                    <button className="btn btn-primary w-full py-2.5 font-medium" onClick={() => setActiveTab('subir')}>
                      Corregir documentos <ArrowRight size={16} className="ml-2" />
                    </button>
                  </div>
                </div>
                
                {/* Warning */}
                <div className="card !p-0 border-l-4 border-l-[#d4a000] overflow-hidden flex flex-col h-full bg-white shadow-sm">
                  <div className="p-4 border-b border-cream">
                    <div className="flex justify-between items-start mb-2">
                       <div className="flex gap-2 items-center text-gray-500 uppercase text-[11px] font-bold tracking-wider">
                         <Building2 size={14} /> INMOBILIARIA PACÍFICO
                       </div>
                    </div>
                    <h3 className="text-[18px] font-bold text-navy flex items-center gap-2">
                      <MapPin size={18} className="text-gray-400"/> Edificio Vista Mar
                    </h3>
                  </div>
                  
                  <div className="p-4 flex-1 flex flex-col justify-center">
                    <div className="bg-[#fffdf5] border border-[#f5f0e6] rounded-lg p-4 mb-2">
                       <div className="flex items-center gap-2 text-[#d4a000] font-medium text-[13.2px] mb-3">
                         <Clock size={16} /> Vencimientos próximos
                       </div>
                       <div className="prog-wrap !m-0 mb-3 border border-cream/50 bg-white"><div className="prog-fill w-[88%] bg-[#d4a000]"></div></div>
                       <div className="text-[12.1px] flex items-center gap-2 flex-wrap">
                         <span className="text-gray-500">0 Rechazados</span>
                         <span className="text-gray-400 text-[10px]">●</span>
                         <span className="text-[#d4a000] font-semibold">1 Pendiente</span>
                         <span className="text-gray-400 text-[10px]">●</span>
                         <span className="text-[#2a6a3a]">7 Aprobados</span>
                       </div>
                    </div>
                  </div>
                  
                  <div className="p-4 pt-0 mt-auto">
                    <button className="btn btn-secondary w-full py-2.5 font-medium" onClick={() => setActiveTab('subir')}>
                      Renovar documentos <ArrowRight size={16} className="ml-2" />
                    </button>
                  </div>
                </div>

                {/* OK */}
                <div className="card !p-0 border-l-4 border-l-[#2a6a3a] overflow-hidden flex flex-col h-full bg-white shadow-sm">
                  <div className="p-4 border-b border-cream">
                    <div className="flex justify-between items-start mb-2">
                       <div className="flex gap-2 items-center text-gray-500 uppercase text-[11px] font-bold tracking-wider">
                         <Building2 size={14} /> MINERA LOS ANDES
                       </div>
                    </div>
                    <h3 className="text-[18px] font-bold text-navy flex items-center gap-2">
                      <MapPin size={18} className="text-gray-400"/> Faena Atacama 2
                    </h3>
                  </div>
                  
                  <div className="p-4 flex-1 flex flex-col justify-center">
                    <div className="bg-[#f5fbf6] border border-[#e6f5e9] rounded-lg p-4 mb-2">
                       <div className="flex items-center gap-2 text-[#2a6a3a] font-medium text-[13.2px] mb-3">
                         <CheckCircle size={16} /> Todo al día (Pago habilitado)
                       </div>
                       <div className="prog-wrap !m-0 mb-3 border border-cream/50 bg-white"><div className="prog-fill w-[100%] bg-[#2a6a3a]"></div></div>
                       <div className="text-[12.1px] flex items-center gap-2 flex-wrap">
                         <span className="text-gray-500">0 Rechazados</span>
                         <span className="text-gray-400 text-[10px]">●</span>
                         <span className="text-gray-500">0 Pendientes</span>
                         <span className="text-gray-400 text-[10px]">●</span>
                         <span className="text-[#2a6a3a] font-semibold">8 Aprobados</span>
                       </div>
                    </div>
                  </div>
                  
                  <div className="p-4 pt-0 mt-auto">
                    <button className="btn btn-ghost w-full py-2.5 border border-cream hover:bg-cream font-medium" onClick={() => setActiveTab('subir')}>
                      Ver carpeta del proyecto
                    </button>
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* BIBLIOTECA DIGITAL (PORTAL CONTRATISTA) */}
          {activeTab === 'biblioteca' && (
            <div className="fade-in">
              <div className="page-header">
                <div>
                  <h2 className="page-title">Biblioteca Documental</h2>
                  <p className="page-sub">Tu archivo centralizado: sube tus documentos una vez y utilízalos en cualquier faena activa</p>
                </div>
              </div>

              {/* Alerta informativa del beneficio */}
              <div className="alert alert-info mb-5 text-[14.3px]">
                <Info size={16} className="shrink-0" />
                <span>
                  <strong>Tip de eficiencia:</strong> Los documentos que subas aquí quedarán disponibles como "formatos maestros". Al asignar personal o carpetas a un nuevo proyecto, el sistema los completará automáticamente sin que tengas que volver a subirlos.
                </span>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
                
                {/* COLUMNA IZQUIERDA: DOCUMENTOS DE LA EMPRESA (5 Columnas) */}
                <div className="xl:col-span-5 flex flex-col gap-4">
                  <div className="card">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="section-title mb-0">Documentos de la Empresa</h3>
                      <button className="btn btn-ghost btn-sm cursor-not-allowed opacity-50 font-medium" disabled title="No disponible en demo">
                        <CloudUpload size={14} className="mr-1" /> Subir Maestro [Demo]
                      </button>
                    </div>

                    <div className="flex flex-col gap-3">
                      {/* Documento 1 */}
                      <div className="p-3 bg-cream2 rounded-xl border border-cream3 flex items-start gap-3">
                        <div className="w-9 h-9 bg-navy text-cream rounded-lg flex items-center justify-center shrink-0">
                          <FileText size={18} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[14.3px] font-semibold text-navy truncate">Certificado de Antecedentes Laborales (F30)</div>
                          <div className="text-[12.1px] text-gray-500 mt-0.5">Período: Abril 2026</div>
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            <span className="badge b-green py-0.5 px-2 text-[11px]">Aprobado Maestro</span>
                            <span className="badge b-gray py-0.5 px-2 text-[11px] text-gray-600">Usado en 2 faenas</span>
                          </div>
                        </div>
                        <button className="text-gray-300 cursor-not-allowed p-1" disabled title="Visor deshabilitado en demo"><Eye size={15} /></button>
                      </div>

                      {/* Documento 2 */}
                      <div className="p-3 bg-cream2 rounded-xl border border-cream3 flex items-start gap-3">
                        <div className="w-9 h-9 bg-navy text-cream rounded-lg flex items-center justify-center shrink-0">
                          <FileText size={18} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[14.3px] font-semibold text-navy truncate">Certificado Adhesión Mutualidad</div>
                          <div className="text-[12.1px] text-gray-500 mt-0.5">Vence: 15 Dic 2026</div>
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            <span className="badge b-green py-0.5 px-2 text-[11px]">Vigente</span>
                            <span className="badge b-gray py-0.5 px-2 text-[11px] text-gray-600">Usado en 3 faenas</span>
                          </div>
                        </div>
                        <button className="text-gray-300 cursor-not-allowed p-1" disabled title="Visor deshabilitado en demo"><Eye size={15} /></button>
                      </div>

                      {/* Documento 3 */}
                      <div className="p-3 bg-cream2 rounded-xl border border-[#fdf0d0] bg-[#fffdf5] flex items-start gap-3">
                        <div className="w-9 h-9 bg-brown text-cream rounded-lg flex items-center justify-center shrink-0">
                          <FileText size={18} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[14.3px] font-semibold text-navy truncate">Patente Municipal Comercial</div>
                          <div className="text-[12.1px] text-[#a07000] font-medium mt-0.5 flex items-center gap-1">
                            <Clock size={12} /> Vence en 14 días
                          </div>
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            <span className="badge b-yellow py-0.5 px-2 text-[11px]">Renovación Requerida</span>
                          </div>
                        </div>
                        <button className="btn btn-secondary btn-sm px-2 py-1 text-[11px] cursor-not-allowed opacity-50" disabled title="Actualización deshabilitada en demo">Actualizar</button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* COLUMNA DERECHA: CARPETAS DE TRABAJADORES (7 Columnas) */}
                <div className="xl:col-span-7 flex flex-col gap-4">
                  <div className="card">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="section-title mb-0">Nómina y Carpetas de Trabajadores</h3>
                      <button className="btn btn-primary btn-sm flex items-center" onClick={() => setShowAddWorkerModal(true)}>
                        <Plus size={14} className="mr-1" /> Registrar Trabajador
                      </button>
                    </div>

                    <div className="flex flex-col gap-2.5">
                      {/* Trabajador 1 */}
                      <div className="p-3 border border-cream3 rounded-xl hover:bg-cream2/40 transition flex items-center gap-3">
                        <div className="avatar text-[12.1px] font-semibold bg-navy text-cream flex items-center justify-center h-10 w-10 rounded-full">JP</div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[14.3px] font-medium text-navy truncate">Juan Pérez González</div>
                          <div className="text-[12.1px] text-gray-400">RUT: 18.453.211-0 · Operador de Maquinaria</div>
                        </div>
                        <div className="text-right shrink-0 px-2">
                          <div className="text-[13.2px] font-semibold text-[#2a6a3a]">4 / 4 Docs</div>
                          <div className="text-[11px] text-gray-400">Habilitado</div>
                        </div>
                        <button className="btn btn-ghost btn-sm px-2.5 cursor-not-allowed opacity-50" disabled title="No disponible en demo">
                          <Folder size={14} />
                        </button>
                      </div>

                      {/* Trabajador 2 */}
                      <div className="p-3 border border-cream3 rounded-xl hover:bg-cream2/40 transition flex items-center gap-3">
                        <div className="avatar text-[12.1px] font-semibold bg-navy text-cream flex items-center justify-center h-10 w-10 rounded-full">AM</div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[14.3px] font-medium text-navy truncate">Alejandro Muñoz Silva</div>
                          <div className="text-[12.1px] text-gray-400">RUT: 16.784.322-K · Eléctricista Montador</div>
                        </div>
                        <div className="text-right shrink-0 px-2">
                          <div className="text-[13.2px] font-semibold text-[#a07000]">3 / 4 Docs</div>
                          <div className="text-[11px] text-[#a07000] font-medium">1 por vencer</div>
                        </div>
                        <button className="btn btn-ghost btn-sm px-2.5 cursor-not-allowed opacity-50" disabled title="No disponible en demo">
                          <Folder size={14} />
                        </button>
                      </div>

                      {/* Trabajador 3 */}
                      <div className="p-3 border border-[#fde8e8] bg-[#fff8f8] rounded-xl flex items-center gap-3">
                        <div className="avatar text-[12.1px] font-semibold bg-[#7a2020] text-cream flex items-center justify-center h-10 w-10 rounded-full">CR</div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[14.3px] font-medium text-navy truncate">Carlos Rojas Méndez</div>
                          <div className="text-[12.1px] text-gray-400">RUT: 19.223.445-8 · Jornalero</div>
                        </div>
                        <div className="text-right shrink-0 px-2">
                          <div className="text-[13.2px] font-semibold text-[#c02020]">2 / 4 Docs</div>
                          <div className="text-[11px] text-[#c02020] font-medium">1 Rechazado</div>
                        </div>
                        <button className="btn btn-secondary btn-sm px-2.5 bg-gray-300 text-gray-500 cursor-not-allowed border-none" disabled title="No disponible en demo">
                          <Upload size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* ASESORÍA Y REDACCIÓN EXPERTA (PORTAL CONTRATISTA) */}
          {activeTab === 'asesoria' && (
            <div className="fade-in">
              <div className="page-header mb-6">
                <div>
                  <h2 className="page-title flex items-center gap-2">
                    <Sparkles className="text-brown" size={22} /> Asesoría y Redacción Experta
                  </h2>
                  <p className="page-sub">Delega la burocracia. Nuestro equipo de especialistas redacta y tramita tus documentos complejos.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                
                {/* COLUMNA IZQUIERDA: PROPUESTA DE VALOR Y BENEFICIOS */}
                <div className="lg:col-span-5 flex flex-col gap-4">
                  <div className="bg-navy text-cream rounded-xl p-6 shadow-lg">
                    <h3 className="text-[17.6px] font-medium mb-2">¿Documentos rechazados o sin tiempo para redactarlos?</h3>
                    <p className="text-[13.2px] text-[#9aabb8] mb-6 leading-relaxed">
                      Sabemos que tu foco está en la operación. Nuestro equipo interno de prevención de riesgos y administración asume la carga por ti. Evaluamos tu caso y te entregamos una solución a la medida, garantizando la aprobación por parte del Mandante.
                    </p>
                    
                    <div className="flex flex-col gap-4">
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 bg-cream/10 p-1.5 rounded-lg text-brown"><ShieldCheck size={18} /></div>
                        <div>
                          <div className="font-medium text-[14.3px]">Aprobación Garantizada</div>
                          <div className="text-[12.1px] text-[#9aabb8]">Redactamos bajo los estándares exactos que exige tu Mandante.</div>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 bg-cream/10 p-1.5 rounded-lg text-brown"><Clock size={18} /></div>
                        <div>
                          <div className="font-medium text-[14.3px]">Agilidad Operativa</div>
                          <div className="text-[12.1px] text-[#9aabb8]">Tiempos de respuesta rápidos para que no pierdas estados de pago.</div>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 bg-cream/10 p-1.5 rounded-lg text-brown"><Banknote size={18} /></div>
                        <div>
                          <div className="font-medium text-[14.3px]">Cotización a la Medida</div>
                          <div className="text-[12.1px] text-[#9aabb8]">Evaluamos la complejidad de tu requerimiento sin costo inicial.</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Casos de uso comunes */}
                  <div className="card bg-cream2 border-none">
                    <h4 className="text-[13.2px] font-semibold uppercase tracking-wider text-gray-500 mb-3">Servicios más solicitados</h4>
                    <ul className="flex flex-col gap-2">
                      <li className="flex items-center gap-2 text-[13.2px] text-navy"><CheckCircle size={14} className="text-brown" /> Confección de Reglamento Interno (RIOHS)</li>
                      <li className="flex items-center gap-2 text-[13.2px] text-navy"><CheckCircle size={14} className="text-brown" /> Matrices de Riesgo (MIPER) específicas</li>
                      <li className="flex items-center gap-2 text-[13.2px] text-navy"><CheckCircle size={14} className="text-brown" /> Redacción de Contratos de Trabajo a trato</li>
                      <li className="flex items-center gap-2 text-[13.2px] text-navy"><CheckCircle size={14} className="text-brown" /> Gestión y regularización de F30 / F30-1</li>
                    </ul>
                  </div>
                </div>

                {/* COLUMNA DERECHA: FORMULARIO DE SOLICITUD */}
                <div className="lg:col-span-7">
                  <div className="card p-6">
                    <h3 className="section-title mb-1">Cuéntanos qué necesitas</h3>
                    <p className="text-[13.2px] text-gray-500 mb-5">Un especialista de Acredita analizará tu solicitud y te enviará una propuesta formal en menos de 24 horas.</p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div className="form-group">
                        <label className="form-label">Tipo de Asesoría Principal</label>
                        <select className="form-input">
                          <option>Prevención de Riesgos (RIOHS, ODI, MIPER)</option>
                          <option>Laboral y Contratos (Anexos, Liquidaciones)</option>
                          <option>Trámites Externos (Mutual, DT, SII)</option>
                          <option>Otra necesidad específica</option>
                        </select>
                      </div>
                      <div className="form-group">
                        <label className="form-label">Proyecto o Mandante (Opcional)</label>
                        <select className="form-input">
                          <option>-- Seleccionar faena --</option>
                          <option>Proyecto Costanera Norte (Andina SA)</option>
                          <option>Ampliación Bodega Sur (Retail Centro)</option>
                        </select>
                      </div>
                    </div>

                    <div className="form-group mb-4">
                      <label className="form-label">Nivel de Urgencia</label>
                      <div className="flex gap-4 mt-1">
                        <label className="flex items-center gap-2 text-[13.2px] cursor-pointer">
                          <input type="radio" name="urgencia" defaultChecked className="accent-brown" /> 
                          <span>Estándar (3-5 días hábiles)</span>
                        </label>
                        <label className="flex items-center gap-2 text-[13.2px] cursor-pointer text-[#a07000] font-medium">
                          <input type="radio" name="urgencia" className="accent-[#d4a000]" /> 
                          <span>Urgente (Bloqueo de acceso/pago)</span>
                        </label>
                      </div>
                    </div>

                    <div className="form-group mb-5">
                      <label className="form-label">Detalla tu requerimiento</label>
                      <textarea 
                        className="form-input min-h-[120px] resize-y" 
                        placeholder="Ej: Hola, necesito crear un Reglamento Interno desde cero porque el Mandante me lo rechazó por estar desactualizado a la norma de este año..."
                      ></textarea>
                    </div>

                    <div className="form-group mb-6">
                      <label className="form-label">¿Tienes algún documento base? (Opcional)</label>
                      <div className="border-2 border-dashed border-cream3 rounded-xl p-4 text-center hover:bg-cream2 transition cursor-pointer">
                        <FileText size={24} className="mx-auto mb-2 text-gray-400" />
                        <span className="text-[13.2px] text-navy font-medium">Haz clic o arrastra un archivo aquí</span>
                        <div className="text-[11px] text-gray-400 mt-1">PDF, Word o imágenes (Max. 10MB)</div>
                      </div>
                    </div>

                    <button className="btn btn-primary w-full py-3 text-[15.4px] justify-center cursor-not-allowed opacity-55" disabled title="No disponible en demo">
                      <Send size={18} className="mr-2" /> Solicitar Cotización [Demo]
                    </button>
                    
                    <p className="text-center text-[11px] text-gray-400 mt-4">
                      * El envío de este formulario no genera ningún cobro automático. Pagarás solo si apruebas nuestra cotización.
                    </p>
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* MIS TRABAJADORES (PORTAL CONTRATISTA) */}
          {activeTab === 'trabajadores' && (
            selectedWorkerForDocs ? (
              <div className="fade-in flex flex-col gap-5">
                <div className="page-header mb-4">
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={() => setSelectedWorkerForDocs(null)} 
                      className="btn btn-ghost p-2 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-navy transition-colors"
                      title="Volver al Directorio"
                    >
                      <ArrowLeft size={20} />
                    </button>
                    <div>
                      <h2 className="page-title flex items-center gap-2">
                        Carpeta de Documentos: {selectedWorkerForDocs.nombre}
                      </h2>
                      <p className="page-sub">RUT: {selectedWorkerForDocs.rut} · Cargo: {selectedWorkerForDocs.cargo || 'Operario'}</p>
                    </div>
                  </div>
                  {(() => {
                    const list = getContratistas();
                    const cObj = list.find(c => c.id === contratistaLogueado.id);
                    const freshWorker = cObj?.trabajadores?.find(w => w.rut === selectedWorkerForDocs.rut);
                    const statusVal = freshWorker ? calcularEstadoTrabajador(freshWorker, selectedProyectoId) : 'pendiente';
                    const badgeClass = statusVal === 'aprobado' ? 'b-green' : statusVal === 'rechazado' ? 'b-red' : 'b-yellow';
                    return (
                      <div className="flex items-center gap-2">
                        <span className={`badge ${badgeClass} text-xs font-bold py-1.5 px-3`}>
                          {statusVal === 'aprobado' ? 'Habilitado' : statusVal === 'rechazado' ? 'Bloqueado' : 'Pendiente'}
                        </span>
                        <button 
                          className="btn btn-secondary btn-sm px-2.5 py-1 text-[11px] font-semibold"
                          onClick={() => {
                            setFichaTipo('trabajador');
                            setFichaTrabajador(freshWorker);
                            setShowFichaAcreditacion(true);
                          }}
                        >
                          Ver Ficha
                        </button>
                      </div>
                    );
                  })()}
                </div>

                <div className="card">
                  <h3 className="section-title mb-4">Checklist de Requisitos</h3>
                  <div className="flex flex-col gap-3">
                    {(() => {
                      const list = getContratistas();
                      const cObj = list.find(c => c.id === contratistaLogueado.id);
                      const freshWorker = cObj?.trabajadores?.find(w => w.rut === selectedWorkerForDocs.rut);
                      const docsList = (freshWorker?.documentos || []).filter(d => d.proyectoId === selectedProyectoId);
                      
                      if (docsList.length === 0) {
                        return <p className="text-gray-500 text-[13.5px] p-4 text-center">No hay requisitos configurados para este trabajador en este proyecto.</p>;
                      }

                      return docsList.map(doc => {
                        let RowIcon = Clock;
                        let iconColorClass = 'text-gray-400';
                        let rowBgClass = '';
                        let badgeClass = 'b-gray';
                        let badgeLabel = 'Pendiente';
                        let subtext = `Sin subir · Requisito Obligatorio`;
                        let actionBtn = (
                          <button className="btn btn-secondary btn-sm" onClick={() => setSelectedDocumentForPanel(doc)}>
                            <Upload size={14} /> Subir
                          </button>
                        );

                        if (doc.estado === 'aprobado') {
                          RowIcon = FileCheck;
                          iconColorClass = 'text-[#2a6a3a]';
                          badgeClass = 'b-green';
                          badgeLabel = 'Aprobado';
                          subtext = 'Subido · Validación automática';
                          actionBtn = (
                            <button className="btn btn-ghost btn-sm" onClick={() => setSelectedDocumentForPanel(doc)}>
                              <Eye size={14}/>
                            </button>
                          );
                        } else if (doc.estado === 'por_vencer') {
                          RowIcon = AlertTriangle;
                          iconColorClass = 'text-[#c08000]';
                          rowBgClass = 'bg-[#fffdf5] -mx-4 px-4 py-3 border-y border-cream3 rounded-md';
                          badgeClass = 'b-yellow';
                          badgeLabel = 'Por vencer';
                          subtext = doc.observacion || `Vence el ${doc.vencimiento}`;
                          actionBtn = (
                            <button className="btn btn-primary btn-sm" onClick={() => setSelectedDocumentForPanel(doc)}>
                              <Upload size={14} /> Renovar
                            </button>
                          );
                        } else if (doc.estado === 'rechazado') {
                          RowIcon = X;
                          iconColorClass = 'text-[#c02020]';
                          rowBgClass = 'bg-[#fff8f8] -mx-4 px-4 py-3 border-b border-cream3 rounded-md';
                          badgeClass = 'b-red';
                          badgeLabel = 'Rechazado';
                          subtext = doc.observacion || 'Documento rechazado.';
                          actionBtn = (
                            <button className="btn btn-danger btn-sm" onClick={() => setSelectedDocumentForPanel(doc)}>
                              <Upload size={14} /> Corregir
                            </button>
                          );
                        } else if (doc.estado === 'revision') {
                          RowIcon = Clock;
                          iconColorClass = 'text-blue-500';
                          badgeClass = 'b-blue';
                          badgeLabel = 'En revisión';
                          subtext = 'Enviado para revisión por auditoría';
                          actionBtn = (
                            <button className="btn btn-ghost btn-sm" onClick={() => setSelectedDocumentForPanel(doc)}>
                              <Eye size={14}/>
                            </button>
                          );
                        }

                        return (
                          <div 
                            key={doc.id} 
                            className={`doc-row cursor-pointer hover:bg-cream/40 ${rowBgClass} transition-colors`} 
                            onClick={() => setSelectedDocumentForPanel(doc)}
                          >
                            <RowIcon size={20} className={`${iconColorClass} shrink-0`} />
                            <div className="flex-1 font-sans">
                              <div className="text-[15.4px] font-medium text-navy">{doc.nombre}</div>
                              <div className={`text-[13.2px] ${doc.estado === 'por_vencer' ? 'text-[#a07000]' : doc.estado === 'rechazado' ? 'text-[#c03030]' : 'text-gray-400'}`}>
                                {subtext}
                              </div>
                            </div>
                            <span className={`badge ${badgeClass}`}>{badgeLabel}</span>
                            <div className="doc-meta font-sans">{doc.vencimiento && doc.vencimiento !== '—' ? doc.vencimiento : ''}</div>
                            <div onClick={(e) => e.stopPropagation()}>
                              {actionBtn}
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>
              </div>
            ) : (
              <div className="fade-in">
                <div className="page-header mb-6">
                  <div>
                    <h2 className="page-title flex items-center gap-2">
                      <Users className="text-brown" size={22} /> Directorio de Trabajadores
                    </h2>
                    <p className="page-sub">Gestiona la documentación y habilitación de tu personal en terreno</p>
                  </div>
                  <button className="btn btn-primary shadow-sm hover:shadow-md" onClick={() => setShowAddWorkerModal(true)}>
                    <UserPlus size={16} className="mr-2" /> Agregar Trabajador
                  </button>
                </div>

                {/* BARRA DE BÚSQUEDA Y FILTROS */}
                <div className="flex flex-col md:flex-row gap-3 mb-6 bg-white p-3 rounded-xl border border-cream3 shadow-sm">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <input 
                      type="text" 
                      placeholder="Buscar por nombre, RUT o cargo..." 
                      className="form-input w-full pl-9 py-2 border-none bg-cream2/50 focus:bg-white text-[14.3px]"
                    />
                  </div>
                  <div className="flex gap-2">
                    <select className="form-input py-2 text-[13.2px] border-none bg-cream2/50 cursor-pointer">
                      <option>Todos los estados</option>
                      <option>Habilitados (Al día)</option>
                      <option>Con problemas (Rojo)</option>
                    </select>
                    <select
                      value={selectedProyectoId}
                      onChange={(e) => setSelectedProyectoId(e.target.value)}
                      className="form-input py-2 text-[13.2px] border-none bg-cream2/50 cursor-pointer"
                    >
                      {misProyectos.map(p => (
                        <option key={p.id} value={p.id}>{p.nombre}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* GRID DE PERFILES DE TRABAJADORES */}
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                  {trabajadoresData.map((worker: any) => {
                    const workerEstado = calcularEstadoTrabajador(worker, selectedProyectoId);
                    let statusColor = 'border-t-[#2a6a3a]';
                    let badge = <span className="badge b-green" title="Habilitado para ingreso">Al día</span>;
                    let cardBg = 'bg-[#f4fbf6]';
                    let cardBorder = 'border-[#d4f0de]/50';
                    let textColor = 'text-[#1a6030]';
                    let barColor = 'bg-[#2a6a3a]';
                    let barBg = 'bg-[#f4fbf6]';
                    let actionBtn = (
                      <button 
                        onClick={() => setSelectedWorkerForDocs(worker)}
                        className="btn btn-ghost w-full border border-cream3 text-gray-600 hover:text-navy"
                      >
                        <FolderOpen size={16} className="mr-2" /> Ver Carpeta
                      </button>
                    );

                    if (workerEstado === 'rechazado') {
                      statusColor = 'border-t-[#c02020]';
                      badge = <span className="badge bg-[#fde8e8] text-[#c02020] border border-[#fde8e8]" title="Acceso bloqueado">Bloqueado</span>;
                      cardBg = 'bg-[#fff8f8]';
                      cardBorder = 'border-[#fde8e8]';
                      textColor = 'text-[#c02020]';
                      barColor = 'bg-[#c02020]';
                      barBg = 'bg-[#fde8e8]';
                      actionBtn = (
                        <button 
                          onClick={() => setSelectedWorkerForDocs(worker)}
                          className="btn btn-primary w-full bg-[#c02020] hover:bg-[#a01515] border-none"
                        >
                          Solucionar ahora
                        </button>
                      );
                    } else if (workerEstado === 'por_vencer') {
                      statusColor = 'border-t-[#d4a000]';
                      badge = <span className="badge b-yellow">Advertencia</span>;
                      cardBg = 'bg-[#fffdf5]';
                      cardBorder = 'border-[#fdf0d0]';
                      textColor = 'text-[#a07000]';
                      barColor = 'bg-[#d4a000]';
                      barBg = 'bg-[#fdf0d0]';
                      actionBtn = (
                        <button 
                          onClick={() => setSelectedWorkerForDocs(worker)}
                          className="btn btn-secondary w-full"
                        >
                          Actualizar documento
                        </button>
                      );
                    } else if (workerEstado === 'pendiente') {
                      statusColor = 'border-t-gray-400';
                      badge = <span className="badge b-gray">Pendiente</span>;
                      cardBg = 'bg-gray-50';
                      cardBorder = 'border-gray-200';
                      textColor = 'text-gray-500';
                      barColor = 'bg-gray-400';
                      barBg = 'bg-gray-200';
                      actionBtn = (
                        <button 
                          onClick={() => setSelectedWorkerForDocs(worker)}
                          className="btn btn-secondary w-full"
                        >
                          Subir carpeta
                        </button>
                      );
                    }

                    const initials = worker.nombre
                      .split(' ')
                      .map((n: string) => n[0])
                      .join('')
                      .substring(0, 2)
                      .toUpperCase();

                    const projObj = misProyectos.find(p => p.id === selectedProyectoId);
                    const projectName = projObj ? projObj.nombre : 'Proyecto';

                    const motive = workerEstado !== 'aprobado' ? getMotivoBloqueoTrabajador(worker, selectedProyectoId) : '';

                    const workerReqs = getRequisitos().filter(r => 
                      r.proyectoId === selectedProyectoId && 
                      r.destino === 'trabajador' && 
                      r.activo !== false &&
                      r.obligatorio === true
                    );
                    const approvedReqsCount = workerReqs.filter(req => {
                      const doc = worker.documentos?.find(d => 
                        d.proyectoId === selectedProyectoId && 
                        (d.nombre.toLowerCase().includes(req.nombre.toLowerCase()) || 
                         req.nombre.toLowerCase().includes(d.nombre.toLowerCase()))
                      );
                      return doc && doc.estado === 'aprobado' && !esVencidoPorFecha(doc.vencimiento);
                    }).length;
                    
                    const dynamicCompliance = workerReqs.length > 0
                      ? Math.round((approvedReqsCount / workerReqs.length) * 100)
                      : 0;

                    return (
                      <div key={worker.rut} className={`card hover:shadow-md transition-shadow group border-t-4 ${statusColor}`}>
                        <div className="flex justify-between items-start mb-3">
                          <div className="flex gap-3">
                            <div className="avatar w-11 h-11 text-[14.3px] bg-navy text-cream flex items-center justify-center font-bold">{initials}</div>
                            <div>
                              <div className="font-semibold text-[15.4px] text-navy group-hover:text-brown transition-colors">{worker.nombre}</div>
                              <div className="text-[12.1px] text-gray-500 font-mono mt-0.5">{worker.rut}</div>
                            </div>
                          </div>
                          {badge}
                        </div>
                        
                        <div className="flex items-center gap-1.5 text-[13.2px] text-gray-600 mb-2">
                          <Briefcase size={14} className="text-gray-400" /> {worker.cargo || 'Operario'}
                        </div>

                        <div className="space-y-1.5 mb-4 text-[12.5px] text-gray-600 border-t border-cream pt-2">
                          <div><strong>Proyecto:</strong> {projectName}</div>
                          <div><strong>Asignación:</strong> <span className="text-green-700 font-semibold">✓ Asignado</span></div>
                          <div><strong>Puede trabajar:</strong> <span className={workerEstado === 'aprobado' ? 'text-green-700 font-semibold' : 'text-red-600 font-semibold'}>{workerEstado === 'aprobado' ? 'Sí' : 'No'}</span></div>
                          {motive && <div className="text-red-600 font-medium"><strong>Motivo:</strong> {motive}</div>}
                        </div>

                        <div className={`rounded-lg p-3 mb-4 border ${cardBg} ${cardBorder}`}>
                          <div className="flex justify-between items-center text-[12.1px] mb-1.5">
                            <span className={`${textColor} font-medium`}>Cumplimiento General</span>
                            <span className={`font-bold ${textColor}`}>{dynamicCompliance}%</span>
                          </div>
                          <div className={`prog-wrap h-1.5 ${barBg}`}>
                            <div className={`prog-fill ${barColor}`} style={{ width: `${dynamicCompliance}%` }}></div>
                          </div>
                        </div>

                        {actionBtn}
                      </div>
                    );
                  })}
                </div>
              </div>
            )
          )}

          {/* CONFIGURACIÓN Y PREFERENCIAS (PORTAL CONTRATISTA) */}
          {activeTab === 'config' && (
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
                <UserPlus size={18} className="text-brown" /> Agregar Trabajador
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
                                        esTrabajadorAsignado(tw, selectedProyectoId, allProyectos)
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

              <div className="text-[13px] font-bold text-navy border-t border-cream pt-2 mt-1">Registrar Nuevo Trabajador</div>

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

interface DocumentDetailPanelProps {
  doc: Documento;
  onClose: () => void;
  onUpload: (docId: string, actionMsg: string) => void;
  showToast: (msg: string, type?: 'success'|'error'|'warning') => void;
}

function DocumentDetailPanel({ doc, onClose, onUpload, showToast }: DocumentDetailPanelProps) {
  if (!doc) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 fade-in" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-[460px] max-h-[calc(100vh-24px)] overflow-y-auto font-sans" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-cream">
          <h3 className="font-medium text-navy text-[17px] flex items-center gap-2">
            {doc.nombre}
          </h3>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors p-1.5 hover:bg-gray-100 rounded-lg"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 flex flex-col gap-5">
          {/* Badge de estado */}
          <div className="flex items-center gap-2">
            <span className="text-[13px] text-gray-500 font-medium">Estado actual:</span>
            <span className={`badge ${
              doc.estado === 'aprobado' ? 'b-green' :
              doc.estado === 'rechazado' ? 'b-red' : 
              doc.estado === 'por_vencer' ? 'b-yellow' : 
              doc.estado === 'revision' ? 'b-blue' : 'b-gray'
            }`}>
              {doc.estado === 'aprobado' ? 'Aprobado' :
               doc.estado === 'rechazado' ? 'Rechazado' :
               doc.estado === 'por_vencer' ? 'Por vencer' :
               doc.estado === 'revision' ? 'En revisión' : 'Pendiente'}
            </span>
          </div>

          {/* Details based on status */}
          {doc.estado === 'rechazado' && (
            <>
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 flex flex-col gap-3">
                <div className="flex items-center gap-2 font-bold text-[14.5px]">
                  <span>❌ Documento rechazado</span>
                </div>
                <div className="text-[13px] font-medium text-red-800">
                  {doc.nombre}
                </div>
              </div>

              {/* Motivo */}
              {(doc.motivoRechazo || doc.motivo) && (
                <div className="flex flex-col gap-1">
                  <span className="text-[12.5px] font-semibold text-gray-500 uppercase tracking-wider">Motivo</span>
                  <div className="bg-gray-50 border border-gray-200 text-gray-800 rounded-lg p-3 text-[13.5px] leading-relaxed">
                    {doc.motivoRechazo || doc.motivo}
                  </div>
                </div>
              )}

              {/* ¿Qué ocurrió? */}
              <div className="flex flex-col gap-1">
                <span className="text-[12.5px] font-semibold text-gray-500 uppercase tracking-wider">¿Qué ocurrió?</span>
                <div className="bg-gray-50 border border-gray-200 text-gray-800 rounded-lg p-3 text-[13.5px] leading-relaxed">
                  {doc.explicacionRechazo || doc.observacion || doc.motivo || 'El documento no cumple con los requisitos del mandante.'}
                </div>
              </div>

              {/* ¿Cómo solucionarlo? */}
              {doc.solucionRechazo && (
                <div className="flex flex-col gap-1">
                  <span className="text-[12.5px] font-semibold text-gray-500 uppercase tracking-wider">¿Cómo solucionarlo?</span>
                  <div className="bg-gray-50 border border-gray-200 text-gray-800 rounded-lg p-3 text-[13.5px] leading-relaxed">
                    {doc.solucionRechazo}
                  </div>
                </div>
              )}

              <button 
                className="btn btn-primary w-full mt-2 flex items-center justify-center gap-2 py-2.5 font-medium shadow-sm" 
                onClick={() => { 
                  onUpload(doc.id, 'Documento reemplazado con éxito. Queda en estado de revisión.'); 
                  onClose(); 
                }}
              >
                <Upload size={16} /> Reemplazar documento
              </button>
            </>
          )}

          {doc.estado === 'pendiente' && (
            <>
              <div className="flex flex-col gap-2">
                <span className="text-[13px] font-semibold text-gray-700">Qué se necesita</span>
                <div className="bg-gray-50 border border-gray-200 text-gray-700 rounded-lg p-3.5 text-[13.5px] leading-relaxed flex flex-col gap-1">
                  <div><span className="font-semibold">Categoría:</span> {doc.categoria || 'Laboral'}</div>
                  {doc.vencimiento && doc.vencimiento !== '—' && (
                    <div><span className="font-semibold">Fecha límite:</span> {doc.vencimiento}</div>
                  )}
                </div>
              </div>
              
              <div className="flex flex-col gap-3">
                <span className="text-[13px] font-semibold text-navy">Pasos a seguir</span>
                <div className="flex flex-col gap-3">
                  <div className="flex items-start gap-3">
                    <span className="w-5 h-5 shrink-0 rounded-full bg-gray-100 text-gray-700 text-xs font-bold flex items-center justify-center mt-0.5">1</span>
                    <span className="text-[13px] text-gray-600">Prepara el documento vigente y legible.</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="w-5 h-5 shrink-0 rounded-full bg-gray-100 text-gray-700 text-xs font-bold flex items-center justify-center mt-0.5">2</span>
                    <span className="text-[13px] text-gray-600">Verifica que tenga todas las firmas requeridas.</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="w-5 h-5 shrink-0 rounded-full bg-gray-100 text-gray-700 text-xs font-bold flex items-center justify-center mt-0.5">3</span>
                    <span className="text-[13px] text-gray-600">Súbelo en formato PDF.</span>
                  </div>
                </div>
              </div>

              <button 
                className="btn btn-primary w-full mt-2 flex items-center justify-center gap-2 py-2.5 font-medium" 
                onClick={() => { onUpload(doc.id, 'Documento subido correctamente'); onClose(); }}
              >
                <Upload size={16} /> Subir documento
              </button>
            </>
          )}

          {doc.estado === 'revision' && (
            <>
              <div className="bg-blue-50 border border-blue-200 text-blue-800 rounded-lg p-4 text-[13.8px] leading-relaxed flex flex-col gap-1.5 font-sans mb-3">
                <div>El documento ha sido enviado y se encuentra en cola de revisión por el equipo auditor de Acredita.</div>
                {doc.subido && (
                  <div><span className="font-semibold text-blue-950">Fecha de envío:</span> {doc.subido}</div>
                )}
              </div>

              {/* Mock Viewer Section */}
              <div className="border border-cream3 rounded-xl p-4 bg-gray-50 flex flex-col items-center justify-center text-center py-6 font-sans mb-3">
                <FileText size={32} className="text-gray-400 mb-2" />
                <div className="font-semibold text-navy text-[13.5px] truncate max-w-[280px]">{doc.archivoReferencia || `mock_file_${doc.id}.pdf`}</div>
                <div className="text-[11px] text-gray-500 mt-1">Vista previa no disponible en entorno demo</div>
              </div>

              <div className="flex flex-col gap-2">
                <span className="text-[13px] font-semibold text-gray-500 uppercase tracking-wider">Detalles del Requisito</span>
                <div className="bg-gray-50 border border-gray-200 text-gray-700 rounded-lg p-3 text-[13.5px]">
                  <div><span className="font-semibold">Categoría:</span> {doc.categoria || 'Laboral'}</div>
                  {doc.vencimiento && doc.vencimiento !== '—' && (
                    <div><span className="font-semibold">Fecha de vencimiento declarada:</span> {doc.vencimiento}</div>
                  )}
                </div>
              </div>
            </>
          )}

          {doc.estado === 'por_vencer' && (
            <>
              <div className="flex flex-col gap-2">
                <span className="text-[13px] font-semibold text-yellow-700">Por qué importa</span>
                <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-lg p-3.5 text-[13.5px] leading-relaxed">
                  Vence el <span className="font-semibold">{doc.vencimiento}</span>. Si no se renueva a tiempo, el proyecto puede quedar bloqueado para pago o acceso a faena.
                </div>
              </div>
              
              <div className="flex flex-col gap-3">
                <span className="text-[13px] font-semibold text-navy">Pasos a seguir</span>
                <div className="flex flex-col gap-3">
                  <div className="flex items-start gap-3">
                    <span className="w-5 h-5 shrink-0 rounded-full bg-yellow-100 text-yellow-800 text-xs font-bold flex items-center justify-center mt-0.5">1</span>
                    <span className="text-[13px] text-gray-600">Solicita el documento actualizado con anticipación.</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="w-5 h-5 shrink-0 rounded-full bg-yellow-100 text-yellow-800 text-xs font-bold flex items-center justify-center mt-0.5">2</span>
                    <span className="text-[13px] text-gray-600">Verifica que la nueva fecha de vigencia sea posterior a hoy.</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="w-5 h-5 shrink-0 rounded-full bg-yellow-100 text-yellow-800 text-xs font-bold flex items-center justify-center mt-0.5">3</span>
                    <span className="text-[13px] text-gray-600">Sube la renovación antes de la fecha de vencimiento.</span>
                  </div>
                </div>
              </div>

              <button 
                className="btn bg-[#c08000] hover:bg-[#a06a00] text-white w-full mt-2 flex items-center justify-center gap-2 py-2.5 font-medium border-none" 
                onClick={() => { onUpload(doc.id, 'Subiendo renovación'); onClose(); }}
              >
                <Upload size={16} /> Subir renovación
              </button>
            </>
          )}

          {doc.estado === 'aprobado' && (
            <>
              <div className="bg-green-50 border border-green-200 text-green-800 rounded-lg p-4 text-[13.8px] leading-relaxed flex flex-col gap-1.5 mb-3 font-sans">
                <div><span className="font-semibold text-green-950">Vigencia:</span> Vigente hasta {doc.vencimiento || 'Indefinido'}</div>
                {doc.revisor && (
                  <div><span className="font-semibold text-green-950">Revisado por:</span> {doc.revisor}</div>
                )}
              </div>

              {/* Mock Viewer Section */}
              <div className="border border-cream3 rounded-xl p-4 bg-gray-50 flex flex-col items-center justify-center text-center py-6 font-sans">
                <FileText size={32} className="text-gray-400 mb-2" />
                <div className="font-semibold text-navy text-[13.5px] truncate max-w-[280px]">{doc.archivoReferencia || `${doc.nombre}.pdf`}</div>
                <div className="text-[11px] text-gray-500 mt-1">Vista previa no disponible en entorno demo</div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
