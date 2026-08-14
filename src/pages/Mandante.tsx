import React, { useState } from 'react';
import { 
  Bell, LayoutDashboard, Folder, Users, ListChecks, Banknote, BarChart3, 
  Settings, LogOut, AlertCircle, AlertTriangle, Info, Plus, ArrowRight,
  Eye, Download, FileText, CheckCircle, Calendar, ArrowLeft, UserPlus, XCircle, FileCheck, Send,
  Check, X, SlidersHorizontal, Table, Clock, ShieldCheck, Zap, Sparkles, TrendingUp,
  Building2, Plug, Save, ShieldAlert, ToggleRight, FolderOpen, ClipboardList,
  Pencil, Archive, Trash2, ChevronRight, MapPin, CalendarDays, Briefcase
} from 'lucide-react';
import { getContratistas, saveContratistas, getProyectos, saveProyectos, getMandantes, getPlantillas, savePlantillas, calcularEstadoAcreditacion, calcularEstadoTrabajador } from '../data/localStorageDb';
import { Contratista } from '../types';

export default function MandantePortal() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [showNotif, setShowNotif] = useState(false);
  const [activeProjectTab, setActiveProjectTab] = useState('contratistas');
  const [proyectosView, setProyectosView] = useState('lista_proyectos');
  const [editingContractorId, setEditingContractorId] = useState<string | null>(null);
  const [toast, setToast] = useState<{msg: string, type: 'success'|'error'|'warning'} | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [vistaContratistas, setVistaContratistas] = useState<'proyectos' | string>('proyectos');
  const [selectedContratista, setSelectedContratista] = useState<string | null>(null);
  const [clienteSeleccionado, setClienteSeleccionado] = useState<any>(null);
  const [filtroDoc, setFiltroDoc] = useState<string | null>(null);
  const [ajustesEditando, setAjustesEditando] = useState(false);
  const [proyectoArchivado, setProyectoArchivado] = useState(false);
  const [proyectoSeleccionadoAjustes, setProyectoSeleccionadoAjustes] = useState<string | null>(null);

  const allMandantes = getMandantes();
  const allProyectos = getProyectos();
  const allContratistas = getContratistas();
  const allPlantillas = getPlantillas();

  const mandanteLogueado = allMandantes.find(m => m.id === 'andina') || allMandantes[0];
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
  const [newDocForm, setNewDocForm] = useState({ name: '', category: 'Laboral', frequency: 'Mensual' });

  const [showInvitarModal, setShowInvitarModal] = useState(false);
  const [formInvitacion, setFormInvitacion] = useState({correo: '', proyecto: '', mensaje: ''});
  const [documentRequirements, setDocumentRequirements] = useState(() => {
    return allPlantillas.map(p => ({
      id: p.id,
      name: p.nombre,
      category: p.categoria,
      frequency: p.frecuencia
    }));
  });

  const renderAcreditacionDetail = (contractorId: string, projectId: string, onClose: () => void, isDrawer: boolean) => {
    const cObj = allContratistas.find(c => c.id === contractorId);
    if (!cObj) return null;
    const pObj = allProyectos.find(p => p.id === projectId) || misProyectos[0];
    
    const contractorDocs = cObj.documentos || [];
    const workers = cObj.trabajadores || [];
    
    const totalDocs = contractorDocs.length;
    const approvedDocs = contractorDocs.filter(d => d.estado === 'aprobado').length;
    const totalWorkers = workers.length;
    const approvedWorkers = workers.filter(w => calcularEstadoTrabajador(w) === 'aprobado').length;
    
    const percentDocs = totalDocs > 0 ? Math.round((approvedDocs / totalDocs) * 100) : 100;
    
    const stateLabelVal = calcularEstadoAcreditacion(cObj);
    const stateLabel = stateLabelVal === 'Aprobado' ? 'Acreditado' : stateLabelVal === 'Vencido/Bloqueado' ? 'Bloqueado' : stateLabelVal;
    const badgeClass = stateLabelVal === 'Aprobado' ? 'b-green' : stateLabelVal === 'Vencido/Bloqueado' ? 'b-red' : 'b-yellow';

    const hasRejectedDocs = contractorDocs.some(d => d.estado === 'rechazado');
    let paymentLabel = 'Pago Habilitado';
    let paymentBadgeClass = 'b-green';
    if (hasRejectedDocs) {
      paymentLabel = 'Pago Retenido';
      paymentBadgeClass = 'b-red';
    } else if (contractorDocs.some(d => d.estado === 'revision' || d.estado === 'pendiente')) {
      paymentLabel = 'Pago en Revisión';
      paymentBadgeClass = 'b-yellow';
    }

    const pendingReqs: Array<{ source: string; detail: string; badge: string }> = [];
    contractorDocs.forEach(d => {
      if (d.estado !== 'aprobado') {
        pendingReqs.push({
          source: 'Empresa',
          detail: `${d.nombre} (${d.estado === 'rechazado' ? 'Rechazado' : d.estado === 'por_vencer' ? 'Por vencer' : d.estado === 'revision' ? 'En revisión' : 'Pendiente'})`,
          badge: d.estado === 'rechazado' ? 'b-red' : d.estado === 'por_vencer' ? 'b-yellow' : 'b-gray'
        });
      }
    });
    workers.forEach(w => {
      const wEstado = calcularEstadoTrabajador(w);
      if (wEstado !== 'aprobado') {
        pendingReqs.push({
          source: `Trabajador: ${w.nombre}`,
          detail: `${w.cargo || 'Operario'} · ${wEstado === 'rechazado' ? 'Examen/Doc rechazado' : wEstado === 'pendiente' ? 'Documentos pendientes' : 'Por vencer'}`,
          badge: wEstado === 'rechazado' ? 'b-red' : 'b-gray'
        });
      }
    });
    
    return (
      <div className={`${isDrawer ? 'fixed right-0 top-0 bottom-0 h-full w-[520px] bg-white shadow-[-10px_0_30px_rgba(0,0,0,0.15)] z-[400]' : 'card w-full'} flex flex-col overflow-hidden animate-slide-in`}>
        {/* Header */}
        <div className="p-5 border-b border-cream3 flex justify-between items-start shrink-0">
          <div>
            <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-widest mb-1">Ficha de Acreditación</div>
            <h3 className="text-lg font-bold text-navy flex items-center gap-2 flex-wrap">
              {cObj.nombre}
              <span className={`badge ${badgeClass} text-xs`}>{stateLabel}</span>
            </h3>
            <p className="text-xs text-gray-400 mt-1">RUT: {cObj.rut} · Proyecto: {pObj ? pObj.nombre : 'General'}</p>
          </div>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-navy p-1 rounded-lg hover:bg-cream transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-6">
          <div className="grid grid-cols-2 gap-3">
            <div className="card p-3.5 border border-cream3 bg-white">
              <div className="text-xs text-gray-400 uppercase font-semibold">Requisitos de Empresa</div>
              <div className="text-lg font-bold text-navy mt-1">{approvedDocs} / {totalDocs}</div>
              <div className="text-xs text-gray-500 mt-0.5">{percentDocs}% completado</div>
            </div>
            <div className="card p-3.5 border border-cream3 bg-white">
              <div className="text-xs text-gray-400 uppercase font-semibold">Acreditación Personal</div>
              <div className="text-lg font-bold text-navy mt-1">{approvedWorkers} / {totalWorkers}</div>
              <div className="text-xs text-gray-500 mt-0.5">Trabajadores acreditados</div>
            </div>
          </div>

          <div className="bg-cream/40 border border-cream3 rounded-2xl p-4 flex items-center justify-between">
            <div>
              <div className="text-[13px] font-semibold text-navy">Estado de Pago</div>
              <div className="text-xs text-gray-500 mt-0.5 font-sans">Basado en cumplimiento documental y contractual</div>
            </div>
            <span className={`badge ${paymentBadgeClass} text-xs font-semibold`}>{paymentLabel}</span>
          </div>

          <div>
            <h4 className="section-title text-sm uppercase tracking-wider text-gray-400 font-semibold mb-3">Requisitos pendientes o rechazados</h4>
            {pendingReqs.length > 0 ? (
              <div className="flex flex-col gap-2.5">
                {pendingReqs.map((req, idx) => (
                  <div key={idx} className="flex justify-between items-start p-3 border border-cream3 rounded-xl bg-gray-50/50">
                    <div>
                      <div className="text-[13.2px] font-semibold text-navy">{req.source}</div>
                      <div className="text-[12.1px] text-gray-500 mt-0.5">{req.detail}</div>
                    </div>
                    <span className={`badge ${req.badge} text-[10px]`}>Pendiente</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 flex flex-col items-center justify-center text-center bg-green-50/50 border border-green-100 rounded-xl text-green-700">
                <CheckCircle size={24} className="mb-1" />
                <div className="text-[13.2px] font-semibold">¡Acreditación Completada!</div>
                <div className="text-[12.1px] opacity-80">La empresa y todo su personal están 100% acreditados.</div>
              </div>
            )}
          </div>

          <div>
            <h4 className="section-title text-sm uppercase tracking-wider text-gray-400 font-semibold mb-3">Documentos de respaldo</h4>
            <div className="flex flex-col gap-2">
              {contractorDocs.map(doc => (
                <div key={doc.id} className="p-3 border border-cream3 rounded-xl bg-white flex justify-between items-center text-xs">
                  <div>
                    <div className="font-semibold text-navy">{doc.nombre}</div>
                    <div className="text-gray-400 mt-0.5">{doc.categoria} · Vence: {doc.vencimiento}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`badge text-[10px] ${
                      doc.estado === 'aprobado' ? 'b-green' :
                      doc.estado === 'por_vencer' ? 'b-yellow' :
                      doc.estado === 'rechazado' ? 'b-red' : 'b-gray'
                    }`}>
                      {doc.estado === 'aprobado' ? 'Aprobado' :
                       doc.estado === 'por_vencer' ? 'Por vencer' :
                       doc.estado === 'rechazado' ? 'Rechazado' : 'Pendiente'}
                    </span>
                    {(doc.estado === 'aprobado' || doc.estado === 'rechazado') && (
                      <button className="btn btn-ghost btn-sm py-1 px-1.5 h-6 text-[10px]" onClick={() => showToast('Abriendo visor...')}>Ver</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h4 className="section-title text-sm uppercase tracking-wider text-gray-400 font-semibold mb-3">Acreditación y Carpetas de Trabajadores</h4>
            <div className="flex flex-col gap-3">
              {workers.map(w => {
                const wEstado = calcularEstadoTrabajador(w);
                const wBadgeClass = wEstado === 'aprobado' ? 'b-green' : wEstado === 'rechazado' ? 'b-red' : 'b-yellow';
                const wStatusLabel = wEstado === 'aprobado' ? 'Habilitado' : wEstado === 'rechazado' ? 'Bloqueado' : 'Pendiente';
                return (
                  <div key={w.rut} className="p-3 border border-cream3 rounded-xl bg-white flex flex-col gap-2">
                    <div className="flex justify-between items-center text-xs">
                      <div>
                        <div className="font-semibold text-navy">{w.nombre}</div>
                        <div className="text-gray-400 mt-0.5">{w.cargo || 'Operario'} · RUT: {w.rut}</div>
                      </div>
                      <span className={`badge text-[10px] ${wBadgeClass}`}>{wStatusLabel}</span>
                    </div>
                    {/* Documents list of this worker */}
                    <div className="bg-cream2/30 rounded-lg p-2 flex flex-col gap-1.5 border border-cream3/30 mt-1">
                      {w.documentos && w.documentos.length > 0 ? (
                        w.documentos.map(wd => (
                          <div key={wd.id} className="flex justify-between items-center text-[11px] py-1 border-b border-cream3/25 last:border-b-0">
                            <span className="text-navy/80">{wd.nombre}</span>
                            <div className="flex items-center gap-1.5">
                              <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${
                                wd.estado === 'aprobado' ? 'bg-green-100 text-green-800' :
                                wd.estado === 'rechazado' ? 'bg-red-100 text-red-800' :
                                wd.estado === 'por_vencer' ? 'bg-yellow-100 text-yellow-800' :
                                wd.estado === 'revision' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'
                              }`}>
                                {wd.estado === 'aprobado' ? 'Aprobado' :
                                 wd.estado === 'rechazado' ? 'Rechazado' :
                                 wd.estado === 'por_vencer' ? 'Por vencer' :
                                 wd.estado === 'revision' ? 'En revisión' : 'Pendiente'}
                              </span>
                              {(wd.estado === 'aprobado' || wd.estado === 'rechazado' || wd.estado === 'revision') && (
                                <button 
                                  className="text-brown hover:underline text-[9px] font-medium"
                                  onClick={() => showToast(`Abriendo visor para ${wd.nombre} de ${w.nombre}...`)}
                                >
                                  Ver
                                </button>
                              )}
                            </div>
                          </div>
                        ))
                      ) : (
                        <span className="text-gray-400 text-[10px] italic">Sin documentos registrados.</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Dynamically build initial contractorsData state from allContratistas
  const buildContractorsData = (contratistasList: Contratista[]) => {
    return contratistasList.filter(c => 
      c.proyectos.some(pId => misProyectos.some(mp => mp.id === pId))
    ).map(c => {
      const reqs: Record<string, boolean> = {
        contrato: true,
        liqu: true,
        f30: true,
        odi: true,
        mutual: true
      };
      const status: Record<string, string> = {};
      
      // contrato
      const docContrato = c.documentos.find(d => d.nombre.toLowerCase().includes('contrato'));
      status['contrato'] = docContrato ? (docContrato.estado === 'aprobado' ? 'ok' : docContrato.estado === 'por_vencer' ? 'warn' : docContrato.estado === 'rechazado' ? 'error' : docContrato.estado === 'revision' ? 'pending' : 'pending') : 'na';
      
      // liqu
      const docLiqu = c.documentos.find(d => d.nombre.toLowerCase().includes('liquidación'));
      status['liqu'] = docLiqu ? (docLiqu.estado === 'aprobado' ? 'ok' : docLiqu.estado === 'por_vencer' ? 'warn' : docLiqu.estado === 'rechazado' ? 'error' : docLiqu.estado === 'revision' ? 'pending' : 'pending') : 'na';
      
      // f30
      const docF30 = c.documentos.find(d => d.nombre.toLowerCase().includes('f30'));
      status['f30'] = docF30 ? (docF30.estado === 'aprobado' ? 'ok' : docF30.estado === 'por_vencer' ? 'warn' : docF30.estado === 'rechazado' ? 'error' : docF30.estado === 'revision' ? 'pending' : 'pending') : 'na';
      
      // odi
      const docOdi = c.documentos.find(d => d.nombre.toLowerCase().includes('odi') || d.nombre.toLowerCase().includes('charla'));
      status['odi'] = docOdi ? (docOdi.estado === 'aprobado' ? 'ok' : docOdi.estado === 'por_vencer' ? 'warn' : docOdi.estado === 'rechazado' ? 'error' : docOdi.estado === 'revision' ? 'pending' : 'pending') : 'na';
      
      // mutual
      const docMutual = c.documentos.find(d => d.nombre.toLowerCase().includes('mutual'));
      status['mutual'] = docMutual ? (docMutual.estado === 'aprobado' ? 'ok' : docMutual.estado === 'por_vencer' ? 'warn' : docMutual.estado === 'rechazado' ? 'error' : docMutual.estado === 'revision' ? 'pending' : 'pending') : 'na';

      // Support dynamic custom documents if added in templates
      allPlantillas.forEach(req => {
        if (!status[req.id]) {
          const matchingDoc = c.documentos.find(d => d.id === req.id || d.nombre.toLowerCase() === req.nombre.toLowerCase());
          if (matchingDoc) {
            status[req.id] = matchingDoc.estado === 'aprobado' ? 'ok' : matchingDoc.estado === 'por_vencer' ? 'warn' : matchingDoc.estado === 'rechazado' ? 'error' : matchingDoc.estado === 'revision' ? 'pending' : 'pending';
            reqs[req.id] = true;
          } else {
            status[req.id] = 'na';
            reqs[req.id] = false;
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

  const [contractorsData, setContractorsData] = useState(() => buildContractorsData(allContratistas));

  const handleAddRequirement = () => {
    if (!newDocForm.name.trim()) return;
    const newId = newDocForm.name.toLowerCase().replace(/[^a-z0-9]/g, '_');
    setDocumentRequirements([...documentRequirements, { ...newDocForm, id: newId }]);
    
    // Add false for new req in all contractors
    setContractorsData(prev => prev.map(c => ({
      ...c,
      reqs: { ...c.reqs, [newId]: false },
      status: { ...c.status, [newId]: 'na' }
    })));
    
    setIsAddDocModalOpen(false);
    setNewDocForm({ name: '', category: 'Laboral', frequency: 'Mensual' });
    showToast('Configuración guardada');
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
                    <button className="btn btn-secondary whitespace-nowrap">Enviar invitación</button>
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
        <div className="logo flex-shrink-0">Acre<b>dita</b></div>
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
              <div className="absolute right-0 top-11 w-[340px] bg-white rounded-xl shadow-2xl border border-cream3 z-[300]">
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
        <aside className="hidden md:flex sidebar flex-col">
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
            <button className="sb-item w-full flex text-left mt-auto">
              <LogOut size={18} /> Cerrar sesión
            </button>
          </div>
        </aside>

        {/* MAIN CONTENT */}
        <div className="main pb-20 md:pb-0">
          
          {/* DASHBOARD TAB */}
          {activeTab === 'dashboard' && (() => {
            const todayStr = new Date().toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
            const formattedDate = todayStr.charAt(0).toUpperCase() + todayStr.slice(1);

            const activeContractors = contractorsData.length;
            
            let totalWorkers = 0;
            let approvedWorkers = 0;
            let pendingWorkers = 0;
            allContratistas.filter(c => 
              c.proyectos.some(pId => misProyectos.some(mp => mp.id === pId))
            ).forEach(c => {
              const workers = c.trabajadores || [];
              totalWorkers += workers.length;
              approvedWorkers += workers.filter(w => calcularEstadoTrabajador(w) === 'aprobado').length;
              pendingWorkers += workers.filter(w => calcularEstadoTrabajador(w) === 'pendiente' || calcularEstadoTrabajador(w) === 'rechazado').length;
            });

            const okContractorsList = contractorsData.filter(c => {
              const statusValues = Object.values(c.status).filter(s => s !== 'na');
              const contractorObj = allContratistas.find(co => co.id === c.id);
              const workers = contractorObj?.trabajadores || [];
              const allWOk = workers.every(w => calcularEstadoTrabajador(w) === 'aprobado');
              return statusValues.length > 0 && statusValues.every(s => s === 'ok') && allWOk;
            });
            const critContractorsList = contractorsData.filter(c => {
              const statusValues = Object.values(c.status).filter(s => s !== 'na');
              const contractorObj = allContratistas.find(co => co.id === c.id);
              const workers = contractorObj?.trabajadores || [];
              const hasWError = workers.some(w => calcularEstadoTrabajador(w) === 'rechazado');
              const hasCompanyError = statusValues.includes('error');
              return hasCompanyError || hasWError;
            });
            const warnContractorsList = contractorsData.filter(c => {
              const statusValues = Object.values(c.status).filter(s => s !== 'na');
              const contractorObj = allContratistas.find(co => co.id === c.id);
              const workers = contractorObj?.trabajadores || [];
              const hasWError = workers.some(w => calcularEstadoTrabajador(w) === 'rechazado');
              const hasWWarn = workers.some(w => calcularEstadoTrabajador(w) === 'por_vencer' || calcularEstadoTrabajador(w) === 'pendiente');
              const hasCompanyError = statusValues.includes('error');
              const hasCompanyWarn = statusValues.includes('warn');
              return (hasCompanyWarn || hasWWarn) && !hasCompanyError && !hasWError;
            });

            const overallPercent = 85;

            return (
              <div className="fade-in">
                <div className="page-header">
                  <div>
                    <h2 className="page-title">Dashboard</h2>
                    <p className="page-sub">{formattedDate} · Resumen general de acreditaciones</p>
                  </div>
                  <button className="btn btn-primary" onClick={() => setActiveTab('proyectos')}><Plus size={16} /> Nuevo proyecto</button>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
                  <div className="stat s-brown">
                    <div className="stat-n">{overallPercent}%</div>
                    <div className="stat-l">Acreditación General</div>
                  </div>
                  <div className="stat s-green">
                    <div className="stat-n">{okContractorsList.length}</div>
                    <div className="stat-l">Empresas Acreditadas</div>
                  </div>
                  <div className="stat s-green">
                    <div className="stat-n">{approvedWorkers} / {totalWorkers}</div>
                    <div className="stat-l">Trabajadores Acreditados</div>
                  </div>
                  <div className="stat s-orange">
                    <div className="stat-n">{contractorsData.filter(c => Object.values(c.status).includes('pending')).length + pendingWorkers}</div>
                    <div className="stat-l">Acreditaciones Pendientes</div>
                  </div>
                  <div className="stat s-red">
                    <div className="stat-n">{critContractorsList.length + warnContractorsList.length}</div>
                    <div className="stat-l">Requieren Atención</div>
                  </div>
                </div>

                {/* Acreditaciones que requieren atención */}
                <div className="card mb-6">
                  <div className="flex justify-between items-center mb-4 border-b border-cream3 pb-3">
                    <h3 className="section-title mb-0 flex items-center gap-2">
                      <AlertCircle size={18} className="text-red-600" />
                      Acreditaciones que requieren atención
                    </h3>
                    <span className="badge b-red font-semibold">{(critContractorsList.length + warnContractorsList.length)} empresas</span>
                  </div>

                  {(critContractorsList.length + warnContractorsList.length) > 0 ? (
                    <div className="flex flex-col gap-3.5">
                      {[...critContractorsList, ...warnContractorsList].map(c => {
                        const contractorObj = allContratistas.find(co => co.id === c.id);
                        const workers = contractorObj?.trabajadores || [];
                        const approvedW = workers.filter(w => calcularEstadoTrabajador(w) === 'aprobado').length;
                        const pendingW = workers.length - approvedW;
                        
                        const totalDocs = contractorObj?.documentos.length || 0;
                        const approvedDocs = contractorObj?.documentos.filter(d => d.estado === 'aprobado').length || 0;
                        
                        const isError = Object.values(c.status).includes('error') || workers.some(w => calcularEstadoTrabajador(w) === 'rechazado');
                        
                        return (
                          <div key={c.id} className="p-4 border border-cream3 rounded-2xl bg-white flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm hover:shadow-md transition-shadow">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1 flex-wrap">
                                <h4 className="text-[15.4px] font-semibold text-navy">{c.name}</h4>
                                <span className={`badge ${isError ? 'b-red' : 'b-yellow'} text-xs`}>
                                  {isError ? 'Crítico (Atención)' : 'Advertencia (Pendientes)'}
                                </span>
                              </div>
                              <p className="text-[13.2px] text-gray-500">
                                Empresa: <span className="font-semibold text-navy">{approvedDocs}/{totalDocs}</span> requisitos · Trabajadores: <span className="font-semibold text-navy">{approvedW}/{workers.length}</span> acreditados ({pendingW} pendientes)
                              </p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                              <button 
                                className="btn btn-ghost btn-sm"
                                onClick={() => showToast(`Recordatorio de acreditación enviado a ${c.name}`)}
                              >
                                <Send size={13} /> Recordar
                              </button>
                              <button 
                                className="btn btn-primary btn-sm"
                                onClick={() => {
                                  const contractor = contractorsData.find(cs => cs.id === c.id);
                                  if (contractor) setClienteSeleccionado(contractor);
                                }}
                              >
                                <Eye size={13} /> Ver acreditación
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="py-8 flex flex-col items-center justify-center text-center text-gray-500">
                      <CheckCircle size={36} className="text-green-500 mb-2" />
                      <p className="font-semibold text-navy">¡Todo al día!</p>
                      <p className="text-sm">Todas las empresas contratistas y trabajadores están correctamente acreditados.</p>
                    </div>
                  )}
                </div>
                
                <div className="flex justify-between items-center mb-4">
                  <h3 className="section-title mb-0">Proyectos activos</h3>
                  <button className="btn btn-ghost btn-sm" onClick={() => setActiveTab('proyectos')}>Ver todos <ArrowRight size={14} /></button>
                </div>
                
                <div className="card-grid">
                  {misProyectos.map(p => {
                    let badgeClass = 'b-green';
                    let badgeText = 'Al día';
                    let percent = 100;
                    let closingDate = 'Cierre Jun 2027';
                    let warnCount = 0;

                    // Calculate stats from actual contractor documents in the project
                    const projectContractors = contractorsData.filter(c => p.contratistas.includes(c.id));
                    let totalDocs = 0;
                    let approvedDocs = 0;
                    let projectTotalWorkers = 0;
                    let projectApprovedWorkers = 0;

                    projectContractors.forEach(c => {
                      const statuses = Object.values(c.status).filter(s => s !== 'na');
                      totalDocs += statuses.length;
                      approvedDocs += statuses.filter(s => s === 'ok').length;
                      if (statuses.includes('error') || statuses.includes('warn')) {
                        warnCount++;
                      }

                      const contractorObj = allContratistas.find(co => co.id === c.id);
                      const workers = contractorObj?.trabajadores || [];
                      projectTotalWorkers += workers.length;
                      projectApprovedWorkers += workers.filter(w => calcularEstadoTrabajador(w) === 'aprobado').length;
                    });
                    
                    if (totalDocs > 0) {
                      percent = Math.round((approvedDocs / totalDocs) * 100);
                    }

                    if (p.id === 'costanera') {
                      badgeClass = 'b-red';
                      badgeText = 'Crítico';
                      closingDate = 'Cierre Dic 2026';
                    } else if (p.id === 'mackenna') {
                      badgeClass = 'b-yellow';
                      badgeText = 'Atención';
                      closingDate = 'Cierre Jun 2027';
                    } else if (p.id === 'hospital') {
                      badgeClass = 'b-green';
                      badgeText = 'Al día';
                      closingDate = 'Cierre May 2027';
                    }

                    if (p.estado === 'Archivado') {
                      badgeClass = 'b-gray';
                      badgeText = 'Archivado';
                    }

                    return (
                      <div key={p.id} className="proj-card cursor-pointer" onClick={() => goToProject(p.id)}>
                        <div className="flex justify-between items-start mb-2">
                          <h4 className="text-[15.4px] font-medium">{p.nombre}</h4>
                          <span className={`badge ${badgeClass}`}>{badgeText}</span>
                        </div>
                        <p className="text-[13.2px] text-gray-500 mb-2.5">{p.contratistas.length} contratistas · {closingDate}</p>
                        <div className="prog-wrap"><div className="prog-fill" style={{ width: `${percent}%` }}></div></div>
                        <p className="text-[13.2px] text-navy font-semibold mt-1.5">{percent}% Acreditación General</p>
                        <p className="text-[12.1px] text-gray-500 mt-1">
                          {projectApprovedWorkers} / {projectTotalWorkers} trabajadores acreditados
                        </p>
                        {warnCount > 0 && (
                          <p className="text-[12px] text-red-500 mt-1">⚠ {warnCount} contratista requiere atención</p>
                        )}
                      </div>
                    );
                  })}
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
                <button className="btn btn-secondary" onClick={() => showToast('Reporte exportado')}><Download size={16} /> Exportar todos</button>
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
                          <button className="btn btn-ghost btn-sm" onClick={() => showToast('Informe PDF exportado')}><Download size={14} /> Informe PDF</button>
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
                            <button className="btn btn-ghost btn-sm text-red-400" onClick={() => showToast('Revisor eliminado', 'error')}>
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                    {ajustesEditando && (
                      <button className="btn btn-ghost btn-sm text-navy" onClick={() => showToast('Invitación enviada')}>
                        <Plus size={14} className="mr-1" /> Agregar revisor
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
                          projList[pIdx].estado = 'Archivado';
                          saveProyectos(projList);
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
                  {renderAcreditacionDetail(selectedContratista, vistaContratistas, () => { setSelectedContratista(null); setFiltroDoc(null); }, false)}
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
                              <button className="btn btn-ghost btn-sm text-gray-400">Reenviar</button>
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
                                <td className="px-4 py-3"><span className={`badge ${badgeClass}`}>{statusLabel}</span></td>
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
                <button className="btn btn-primary">Configurar Matriz</button>
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
                          
                          if (!contractor.reqs[docKey] || contractor.status[docKey] === 'na') {
                            return <span className="text-gray-400 font-medium block text-center" title="No requerido">—</span>;
                          }
                          
                          const status = contractor.status[docKey];
                          if (status === 'ok') return <CheckCircle size={20} className="text-[#2a6a3a] mx-auto block cursor-pointer" title="Aprobado" onClick={() => showToast('Documento aprobado')} />;
                          if (status === 'warn') return <AlertTriangle size={20} className="text-[#d4a000] mx-auto block cursor-pointer" title="Por vencer" />;
                          if (status === 'error') return <XCircle size={20} className="text-[#c02020] mx-auto block cursor-pointer" title="Rechazado" onClick={() => showToast('Documento rechazado', 'error')} />;
                          
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
                                <button className="btn btn-ghost btn-sm"><AlertCircle size={14} className="mr-1" /> Excepción manual</button>
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
                  <div className="card max-w-md w-full shadow-xl">
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
                <button className="btn btn-secondary" onClick={() => showToast('Reporte exportado')}>
                  <Download size={16} className="mr-2" /> Exportar PDF
                </button>
              </div>

              {(() => {
                const totalC = contractorsData.length;
                const okC = contractorsData.filter(c => {
                  const statusValues = Object.values(c.status).filter(s => s !== 'na');
                  const contractorObj = allContratistas.find(co => co.id === c.id);
                  const workers = contractorObj?.trabajadores || [];
                  const allWOk = workers.every(w => calcularEstadoTrabajador(w) === 'aprobado');
                  return statusValues.length > 0 && statusValues.every(s => s === 'ok') && allWOk;
                }).length;

                let totalW = 0;
                let approvedW = 0;
                allContratistas.filter(c => 
                  c.proyectos.some(pId => misProyectos.some(mp => mp.id === pId))
                ).forEach(c => {
                  const workers = c.trabajadores || [];
                  totalW += workers.length;
                  approvedW += workers.filter(w => calcularEstadoTrabajador(w) === 'aprobado').length;
                });
                const rate = totalC > 0 ? Math.round((okC / totalC) * 100) : 100;

                return (
                  <>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
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
                            const workers = cObj?.trabajadores || [];
                            const approvedWorkersCount = workers.filter(w => calcularEstadoTrabajador(w) === 'aprobado').length;
                            
                            const statusTextVal = cObj ? calcularEstadoAcreditacion(cObj) : 'No acreditado';
                            const statusText = statusTextVal === 'Aprobado' ? 'Acreditado' : statusTextVal === 'Vencido/Bloqueado' ? 'Bloqueado' : statusTextVal;
                            const badgeClass = statusTextVal === 'Aprobado' ? 'b-green' : statusTextVal === 'Vencido/Bloqueado' ? 'b-red' : 'b-yellow';

                            const projName = misProyectos.find(p => cObj?.proyectos.includes(p.id))?.nombre || 'General';

                            return (
                              <tr key={c.id} className="hover:bg-gray-50 border-b border-cream">
                                <td className="px-4 py-3 font-medium text-[14.3px]">{c.name}</td>
                                <td className="px-4 py-3 text-[14.3px]">{projName}</td>
                                <td className="px-4 py-3 text-[14.3px]">{okCount}/{totalCount}</td>
                                <td className="px-4 py-3 text-[14.3px]">{approvedWorkersCount}/{workers.length}</td>
                                <td className="px-4 py-3"><span className={`badge ${badgeClass}`}>{statusText}</span></td>
                                <td className="px-4 py-3 text-right">
                                  <button className="btn btn-ghost btn-sm text-gray-600 hover:text-navy" title="Descargar PDF" onClick={() => showToast('Descargando reporte PDF')}><Download size={16} /> PDF</button>
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
                  <button className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-white border border-cream3 text-navy font-medium text-[14.3px] shadow-sm">
                    <Building2 size={18} className="text-brown" /> Perfil de Empresa
                  </button>
                  <button className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-gray-500 hover:bg-cream hover:text-navy transition font-medium text-[14.3px]">
                    <Users size={18} /> Equipo y Accesos
                  </button>
                  <button className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-gray-500 hover:bg-cream hover:text-navy transition font-medium text-[14.3px]">
                    <Bell size={18} /> Alertas Automáticas
                  </button>
                  <button className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-gray-500 hover:bg-cream hover:text-navy transition font-medium text-[14.3px]">
                    <Plug size={18} /> Integraciones / API
                  </button>
                </div>

                {/* Contenido de Configuración */}
                <div className="lg:col-span-3 flex flex-col gap-4">
                  
                  {/* BLOQUE 1: DATOS DE LA EMPRESA */}
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

                  {/* BLOQUE 2: EQUIPO Y ACCESOS */}
                  <div className="card">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="section-title mb-0">Gestión de Usuarios Internos</h3>
                      <button className="btn btn-ghost btn-sm">Añadir Usuario</button>
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

                  {/* BLOQUE 3: INTEGRACIONES DESTACADAS */}
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
                          <button className="btn btn-secondary btn-sm">Generar API Key</button>
                          <button className="btn btn-ghost btn-sm">Ver Documentación</button>
                        </div>
                      </div>
                    </div>
                  </div>

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
          <div className="bg-white rounded-xl shadow-xl w-full max-w-[440px] overflow-hidden">
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
                setShowInvitarModal(false);
                const newId = 'nuevo_' + Date.now();
                const cleanName = formInvitacion.correo.split('@')[0];
                const cleanNameCapitalized = cleanName.charAt(0).toUpperCase() + cleanName.slice(1);
                
                // Determine project id
                const matchedProject = allProyectos.find(p => p.nombre === formInvitacion.proyecto) || allProyectos[0];
                
                // Create new contractor object
                const newContractor: Contratista = {
                  id: newId,
                  nombre: cleanNameCapitalized + ' SpA',
                  rut: '76.852.143-K',
                  proyectos: [matchedProject.id],
                  documentos: [
                    { id: 'd1', nombre: 'Contrato de Trabajo', categoria: 'Laboral', estado: 'pendiente', vencimiento: '31 Dic 2026' },
                    { id: 'd2', nombre: 'Certificado ODI', categoria: 'Prevención', estado: 'pendiente', vencimiento: '31 Dic 2026' },
                    { id: 'd3', nombre: 'Registro Mutual ACHS', categoria: 'Prevención', estado: 'pendiente', vencimiento: '31 Dic 2026' }
                  ],
                  isNew: true
                };

                // Save to localStorage
                const list = getContratistas();
                list.push(newContractor);
                saveContratistas(list);

                // Update project in localStorage
                const projList = getProyectos();
                const pIdx = projList.findIndex(p => p.id === matchedProject.id);
                if (pIdx !== -1) {
                  projList[pIdx].contratistas.push(newId);
                  saveProyectos(projList);
                }

                // Update React State
                setContractorsData(prev => [...prev, {
                  id: newId,
                  name: newContractor.nombre,
                  rut: newContractor.rut,
                  reqs: { contrato: true, odi: true, mutual: true } as any,
                  status: { contrato: 'pending', odi: 'pending', mutual: 'pending' } as any,
                  isPending: true,
                  isNew: true
                } as any]);

                showToast(`Invitación enviada a ${formInvitacion.correo}`);
                setFormInvitacion({correo: '', proyecto: '', mensaje: ''});
              }} className="flex flex-col gap-4">
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
                    value={formInvitacion.proyecto}
                    onChange={(e) => setFormInvitacion({...formInvitacion, proyecto: e.target.value})}
                    className="form-input w-full p-2.5 border border-cream3 rounded-lg focus:border-brown focus:ring-1 focus:ring-brown outline-none transition-all"
                    required
                  >
                    <option value="">Selecciona un proyecto...</option>
                    <option value="Hospital Regional Centro">Hospital Regional Centro</option>
                    <option value="Torre Mackenna">Torre Mackenna</option>
                    <option value="Ampliación Planta Solar">Ampliación Planta Solar</option>
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
            onClick={() => { setClienteSeleccionado(null); setFiltroDoc(null); }}
          />
          {renderAcreditacionDetail(clienteSeleccionado.id, misProyectos[0]?.id, () => { setClienteSeleccionado(null); setFiltroDoc(null); }, true)}
        </>
      )}
    </div>
  );
}
