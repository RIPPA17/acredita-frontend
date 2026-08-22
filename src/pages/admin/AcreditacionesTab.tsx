import React, { useState, useEffect } from 'react';
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Clock,
  Search,
  Building,
  Key,
  Banknote,
  Send,
  Layers,
  ArrowRight,
  User,
  Briefcase
} from 'lucide-react';
import {
  calcularEstadoAcreditacion,
  calcularEstadoTrabajador,
  calcularAccesoPago,
  evaluarHabilitacionCompuerta,
  getRequisitos,
  esDocumentoCumplido,
  esVencidoPorFecha,
  obtenerDiasRestantes,
  getProyectos
} from '../../data/localStorageDb';
import { Contratista, Proyecto, Requisito } from '../../types';

export default function AcreditacionesTab({
  GLOBAL_CONTRATISTAS,
  GLOBAL_PROYECTOS,
  setSelectedAcreditacionContratista,
  setActiveTab,
}: {
  GLOBAL_CONTRATISTAS: Contratista[];
  GLOBAL_PROYECTOS: Proyecto[];
  setSelectedAcreditacionContratista: (c: any) => void;
  setActiveTab?: (tab: string) => void;
}) {
  // 1. States
  const [filtroProyecto, setFiltroProyecto] = useState<string>(GLOBAL_PROYECTOS[0]?.id || 'costanera');
  const [compuertaFiltro, setCompuertaFiltro] = useState<'ambas' | 'acceso' | 'pago'>('ambas');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'todos' | 'bloqueados' | 'habilitados'>('todos');
  
  // KPI Quick Filter
  const [kpiFilter, setKpiFilter] = useState<'revision' | 'contratista' | 'vence30' | null>(null);

  // Accordion
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Toast notification
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // If project context changes, reset kpi filters and expansion
  useEffect(() => {
    setExpandedId(null);
    setKpiFilter(null);
  }, [filtroProyecto]);

  // Handle Toast helper
  const triggerToast = (msg: string) => {
    setToast(msg);
  };

  // Get active requirements for selected project
  const reqs = getRequisitos().filter(r => r.proyectoId === filtroProyecto && r.activo !== false);

  // Filter contractors who belong to selected project
  const contractorsInProject = GLOBAL_CONTRATISTAS.filter(c => 
    c.proyectos.includes(filtroProyecto)
  );

  // Process data for each contractor in the context of selected project
  const processedContractors = contractorsInProject.map(c => {
    const accesoEval = evaluarHabilitacionCompuerta(c, filtroProyecto, 'acceso');
    const pagoEval = evaluarHabilitacionCompuerta(c, filtroProyecto, 'pago');

    // Requirements fraction for company (all requirements)
    const companyReqs = reqs.filter(r => r.destino === 'empresa');
    const companyMandatory = companyReqs.filter(r => r.obligatorio);
    const uploadedCompanyMandatory = companyMandatory.filter(req => {
      const doc = c.documentos?.find(d => 
        d.proyectoId === filtroProyecto &&
        (d.nombre.toLowerCase().includes(req.nombre.toLowerCase()) || 
         req.nombre.toLowerCase().includes(d.nombre.toLowerCase()))
      );
      return esDocumentoCumplido(doc, req);
    });

    const companyProgress = companyMandatory.length > 0 
      ? Math.round((uploadedCompanyMandatory.length / companyMandatory.length) * 100)
      : 100;

    // Workers enabled count
    const projectWorkers = (c.trabajadores || []).filter(w => 
      w.documentos?.some(d => d.proyectoId === filtroProyecto)
    );
    const enabledWorkers = projectWorkers.filter(w => 
      calcularEstadoTrabajador(w, filtroProyecto) === 'aprobado'
    );

    // Last activity date simulator based on document upload or chilene format today
    let lastActivity = '18/05/2026';
    const docs = c.documentos?.filter(d => d.proyectoId === filtroProyecto) || [];
    if (docs.length > 0) {
      const latestUploaded = docs.find(d => d.subido)?.subido;
      if (latestUploaded) lastActivity = latestUploaded;
    }

    return {
      contratista: c,
      acceso: accesoEval,
      pago: pagoEval,
      companyProgress,
      companyApprovedCount: uploadedCompanyMandatory.length,
      companyTotalCount: companyMandatory.length,
      workersEnabledCount: enabledWorkers.length,
      workersTotalCount: projectWorkers.length,
      lastActivity
    };
  });

  // Calculate KPIs based on processed list
  const kpiRevisionCount = processedContractors.filter(pc => 
    pc.acceso.responsable === 'interno' || pc.pago.responsable === 'interno'
  ).length;

  const kpiContratistaCount = processedContractors.filter(pc => 
    pc.acceso.responsable === 'contratista' || pc.pago.responsable === 'contratista'
  ).length;

  const kpiVence30Count = processedContractors.filter(pc => {
    const accVence = pc.acceso.proximoVencimiento?.diasRestantes;
    const pagVence = pc.pago.proximoVencimiento?.diasRestantes;
    const minVence = Math.min(
      accVence !== undefined ? accVence : Infinity,
      pagVence !== undefined ? pagVence : Infinity
    );
    return minVence <= 30 && minVence > 0;
  }).length;

  // Filter list by Search Term
  let filtered = processedContractors.filter(pc => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return true;
    return pc.contratista.nombre.toLowerCase().includes(term) || 
           pc.contratista.rut.toLowerCase().includes(term);
  });

  // Filter list by KPI Card click
  if (kpiFilter === 'revision') {
    filtered = filtered.filter(pc => pc.acceso.responsable === 'interno' || pc.pago.responsable === 'interno');
  } else if (kpiFilter === 'contratista') {
    filtered = filtered.filter(pc => pc.acceso.responsable === 'contratista' || pc.pago.responsable === 'contratista');
  } else if (kpiFilter === 'vence30') {
    filtered = filtered.filter(pc => {
      const accVence = pc.acceso.proximoVencimiento?.diasRestantes;
      const pagVence = pc.pago.proximoVencimiento?.diasRestantes;
      const minVence = Math.min(
        accVence !== undefined ? accVence : Infinity,
        pagVence !== undefined ? pagVence : Infinity
      );
      return minVence <= 30 && minVence > 0;
    });
  }

  // Filter list by Status Filter (Chips for Habilitadas/Bloqueadas) - applicable in single compuerta view
  if (compuertaFiltro === 'acceso' && statusFilter !== 'todos') {
    filtered = filtered.filter(pc => 
      statusFilter === 'bloqueados' ? pc.acceso.estado === 'bloqueado' : pc.acceso.estado === 'habilitado'
    );
  } else if (compuertaFiltro === 'pago' && statusFilter !== 'todos') {
    filtered = filtered.filter(pc => 
      statusFilter === 'bloqueados' ? pc.pago.estado === 'bloqueado' : pc.pago.estado === 'habilitado'
    );
  }

  // Helper for rendering Expiration Badge
  const renderVencimientoBadge = (venc: any) => {
    if (!venc) return <span className="text-gray-400 font-sans text-[12px]">Sin vencimiento</span>;
    const { documentoNombre, diasRestantes, fechaVencimiento } = venc;
    
    let colorClass = 'text-green-600 bg-green-50 border-green-200';
    if (diasRestantes <= 7) {
      colorClass = 'text-red-600 bg-red-50 border-red-200 font-bold';
    } else if (diasRestantes <= 30) {
      colorClass = 'text-amber-700 bg-amber-50 border-amber-200';
    }

    return (
      <div className={`inline-flex flex-col border rounded-lg p-1.5 px-2.5 font-sans ${colorClass}`}>
        <span className="text-[10px] uppercase font-bold tracking-wide opacity-80 truncate max-w-[140px]" title={documentoNombre}>
          {documentoNombre}
        </span>
        <span className="text-[11.5px] font-semibold mt-0.5">
          {diasRestantes <= 0 ? 'Vencido' : `${diasRestantes} días restantes`}
        </span>
        <span className="text-[9px] opacity-70">Vence: {fechaVencimiento}</span>
      </div>
    );
  };

  // Helper for rendering Accordion Detail Rows
  const renderDetailAccordion = (pc: any, targetCompuerta: 'acceso' | 'pago') => {
    const c = pc.contratista;
    
    const gateReqs = reqs.filter(r => {
      if (targetCompuerta === 'acceso') {
        return r.criticidad === 'bloquea_acceso' || r.criticidad === 'bloquea_ambas';
      } else {
        return r.criticidad === 'bloquea_pago' || r.criticidad === 'bloquea_ambas';
      }
    });

    const companyGateReqs = gateReqs.filter(r => r.destino === 'empresa');
    const workerGateReqs = gateReqs.filter(r => r.destino === 'trabajador');

    const otherGateName = targetCompuerta === 'acceso' ? 'Inspección de Pago' : 'Acceso a Faena';
    const otherGateEval = targetCompuerta === 'acceso' ? pc.pago : pc.acceso;
    const otherBadgeClass = otherGateEval.estado === 'habilitado' ? 'bg-[#e2f5e9] text-[#1c6b30]' : 'bg-[#fbe8e8] text-[#932d2d]';

    return (
      <div className="bg-[#FAF9F6] border-t border-cream3 p-4 px-6 font-sans">
        
        {/* OTHER GATE SUMMARY LINE */}
        <div className="flex items-center gap-2 mb-4 bg-white border border-cream3 rounded-xl p-3 px-4 shadow-sm">
          <Layers size={14} className="text-gray-400" />
          <span className="text-[12.5px] text-navy">
            Estado de <strong>{otherGateName}</strong>:
          </span>
          <span className={`text-[11px] font-bold rounded-full px-2 py-0.5 uppercase tracking-wide ${otherBadgeClass}`}>
            {otherGateEval.estado === 'bloqueado' && targetCompuerta === 'acceso' ? 'RETENIDO' : otherGateEval.estado.toUpperCase()}
          </span>
          {otherGateEval.estado === 'bloqueado' && (
            <span className="text-[11.5px] text-gray-500 truncate max-w-[400px]">
              · Motivo: {otherGateEval.motivo}
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* LEFT: COMPANY LEVEL REQUIREMENTS */}
          <div>
            <h5 className="text-[12px] font-bold uppercase tracking-wider text-brown mb-2.5 flex items-center gap-1.5">
              <Building size={14} /> Requisitos de Empresa ({companyGateReqs.length})
            </h5>
            
            {companyGateReqs.length === 0 ? (
              <p className="text-[12px] text-gray-400 italic font-sans">No hay requisitos de empresa para esta compuerta.</p>
            ) : (
              <div className="border border-cream3 rounded-xl overflow-hidden bg-white shadow-sm">
                <table className="w-full text-left text-[12px]">
                  <thead>
                    <tr className="bg-cream2 text-navy font-semibold border-b border-cream3">
                      <th className="p-2.5 px-3">Documento / Requisito</th>
                      <th className="p-2.5">Obligatorio</th>
                      <th className="p-2.5">Estado</th>
                      <th className="p-2.5 px-3">Vencimiento</th>
                    </tr>
                  </thead>
                  <tbody>
                    {companyGateReqs.map(req => {
                      const doc = c.documentos?.find((d: any) => 
                        d.proyectoId === filtroProyecto &&
                        (d.nombre.toLowerCase().includes(req.nombre.toLowerCase()) || 
                         req.nombre.toLowerCase().includes(d.nombre.toLowerCase()))
                      );

                      const cumplido = esDocumentoCumplido(doc, req);
                      const isVencido = doc ? esVencidoPorFecha(doc.vencimiento) : false;
                      
                      let statusBadge = <span className="text-gray-400 font-semibold">✗ No cargado</span>;
                      if (doc) {
                        if (doc.estado === 'revision') {
                          statusBadge = <span className="text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full font-bold">En revisión</span>;
                        } else if (doc.estado === 'rechazado') {
                          statusBadge = <span className="text-red-600 bg-red-50 px-2 py-0.5 rounded-full font-bold">✗ Rechazado</span>;
                        } else if (isVencido) {
                          statusBadge = <span className="text-red-700 bg-red-100 px-2 py-0.5 rounded-full font-bold">✗ Vencido</span>;
                        } else if (doc.estado === 'aprobado' || doc.estado === 'por_vencer') {
                          statusBadge = <span className="text-green-600 bg-green-50 px-2 py-0.5 rounded-full font-bold">✓ Aprobado</span>;
                        }
                      }

                      return (
                        <tr key={req.id} className="border-b border-cream hover:bg-gray-50/55 last:border-0 font-sans">
                          <td className="p-2.5 px-3">
                            <div className="font-semibold text-navy">{req.nombre}</div>
                            {doc && doc.explicacionRechazo && (
                              <div className="text-[10px] text-red-500 mt-0.5 font-sans leading-tight">
                                Rechazo: {doc.explicacionRechazo || doc.motivoRechazo}
                              </div>
                            )}
                          </td>
                          <td className="p-2.5 text-gray-500">{req.obligatorio ? 'Sí' : 'No'}</td>
                          <td className="p-2.5">{statusBadge}</td>
                          <td className="p-2.5 px-3 text-gray-500 font-mono">
                            {doc ? doc.vencimiento : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* RIGHT: WORKERS DETAILS */}
          <div>
            <h5 className="text-[12px] font-bold uppercase tracking-wider text-brown mb-2.5 flex items-center gap-1.5">
              <User size={14} /> Requisitos de Personal / Trabajadores ({(c.trabajadores || []).length})
            </h5>
            
            {(c.trabajadores || []).length === 0 ? (
              <p className="text-[12px] text-gray-400 italic font-sans">No hay trabajadores registrados en este contratista.</p>
            ) : (
              <div className="border border-cream3 rounded-xl overflow-hidden bg-white shadow-sm max-h-[280px] overflow-y-auto">
                <table className="w-full text-left text-[12px]">
                  <thead>
                    <tr className="bg-cream2 text-navy font-semibold border-b border-cream3">
                      <th className="p-2.5 px-3">Nombre</th>
                      <th className="p-2.5 font-mono">RUT</th>
                      <th className="p-2.5">Cumplimiento</th>
                      <th className="p-2.5 px-3">Estado Acceso</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(c.trabajadores || []).map((w: any) => {
                      const wState = calcularEstadoTrabajador(w, filtroProyecto);
                      const wCompliance = w.cumplimiento || 0;
                      
                      let badgeColor = 'bg-yellow-50 text-yellow-700 border-yellow-200';
                      let statusText = 'Pendiente';
                      if (wState === 'aprobado') {
                        badgeColor = 'bg-green-50 text-green-700 border-green-200';
                        statusText = 'Habilitado';
                      } else if (wState === 'rechazado') {
                        badgeColor = 'bg-red-50 text-red-700 border-red-200';
                        statusText = 'Inhabilitado';
                      }

                      return (
                        <tr key={w.rut} className="border-b border-cream hover:bg-gray-50/55 last:border-0 font-sans">
                          <td className="p-2.5 px-3">
                            <div className="font-semibold text-navy">{w.nombre}</div>
                            <div className="text-[10px] text-gray-400 font-sans">{w.cargo || 'Operario'}</div>
                          </td>
                          <td className="p-2.5 text-gray-500 font-mono">{w.rut}</td>
                          <td className="p-2.5">
                            <div className="flex items-center gap-1.5">
                              <div className="w-12 h-1.5 bg-gray-200 rounded-full overflow-hidden shrink-0">
                                <div className="bg-brown h-full" style={{ width: `${wCompliance}%` }}></div>
                              </div>
                              <span className="font-bold font-mono text-[10.5px] text-navy">{wCompliance}%</span>
                            </div>
                          </td>
                          <td className="p-2.5 px-3">
                            <span className={`inline-block text-[9.5px] font-bold uppercase px-1.5 py-0.5 rounded border ${badgeColor}`}>
                              {statusText}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>

        {/* BOTTOM ACTION BUTTONS */}
        <div className="flex gap-3 justify-end mt-5 border-t border-cream3 pt-4 bg-[#F2EFE9] -mx-6 -mb-4 p-4 px-6">
          {otherGateEval.responsable === 'interno' || pc[targetCompuerta].responsable === 'interno' ? (
            <button
              onClick={() => {
                if (setActiveTab) {
                  setActiveTab('cola');
                } else {
                  triggerToast('Pestaña de cola de revisión no accesible');
                }
              }}
              className="flex items-center gap-1.5 px-4 py-2 bg-purple-700 text-white rounded-lg text-[12px] font-bold hover:bg-purple-800 transition-colors border-none cursor-pointer shadow-sm font-sans"
            >
              Ir a cola de revisión <ArrowRight size={14} />
            </button>
          ) : null}

          <button
            onClick={() => {
              triggerToast(`Notificación enviada a ${c.nombre} para corregir requisitos`);
            }}
            className="flex items-center gap-1.5 px-4 py-2 bg-brown text-white rounded-lg text-[12px] font-bold hover:bg-[#854f0b] transition-colors border-none cursor-pointer shadow-sm font-sans"
          >
            <Send size={13} /> Notificar al contratista
          </button>
        </div>
      </div>
    );
  };

  // Grouping for Focused View
  const blockedFocusList = filtered.filter(pc => {
    if (compuertaFiltro === 'acceso') return pc.acceso.estado === 'bloqueado';
    return pc.pago.estado === 'bloqueado';
  });

  const enabledFocusList = filtered.filter(pc => {
    if (compuertaFiltro === 'acceso') return pc.acceso.estado === 'habilitado';
    return pc.pago.estado === 'habilitado';
  });

  return (
    <div className="fade-in space-y-5 font-sans relative pb-10">
      
      {/* TOAST ALERT */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-[9999] bg-navy text-cream border border-cream3 rounded-xl p-4 shadow-xl flex items-center gap-2.5 font-sans text-[13px] font-medium animate-slide-in">
          <CheckCircle size={18} className="text-green-500 shrink-0" />
          <span>{toast}</span>
        </div>
      )}

      {/* HEADER SECTION */}
      <div className="bg-[#12233f] border-2 border-cream3 rounded-2xl p-5 px-6 shadow-md text-cream flex flex-wrap justify-between items-center gap-4">
        <div>
          <h2 className="text-[20px] font-bold tracking-tight text-white m-0 font-sans font-bold">Tablero de Habilitación de Contratistas</h2>
          <p className="text-[12.5px] text-cream/70 m-0 mt-1 font-sans">
            Inspección y auditoría de compuertas operativas independientes de acceso físico y retención de pago.
          </p>
        </div>
        <div className="flex items-center gap-2.5 bg-black/20 border border-cream/15 p-2 px-3.5 rounded-xl font-sans shrink-0">
          <span className="text-[11.5px] font-bold text-cream/85">Contexto de Proyecto:</span>
          <select
            value={filtroProyecto}
            onChange={(e) => setFiltroProyecto(e.target.value)}
            className="bg-[#12233f] border border-cream/20 text-cream font-semibold rounded-lg px-2.5 py-1 text-[12.5px] cursor-pointer focus:outline-none focus:border-brown hover:bg-black/10"
          >
            {GLOBAL_PROYECTOS.map(p => (
              <option key={p.id} value={p.id} className="text-navy">{p.nombre}</option>
            ))}
          </select>
        </div>
      </div>

      {/* SUMMARY KPI CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        
        {/* CARD 1: INTERNAL REVIEWS */}
        <div 
          onClick={() => setKpiFilter(prev => prev === 'revision' ? null : 'revision')}
          className={`border-2 rounded-2xl p-4 px-5 bg-white cursor-pointer shadow-sm hover:shadow-md transition-all flex items-center justify-between gap-4 select-none ${
            kpiFilter === 'revision' ? 'border-purple-600 ring-2 ring-purple-100 bg-purple-50/10' : 'border-cream3 hover:border-navy/35'
          }`}
        >
          <div className="flex flex-col gap-1 min-w-0">
            <span className="text-[10.5px] uppercase font-bold text-purple-700 tracking-wider font-sans">
              Revisión Interna Pendiente
            </span>
            <span className="text-[12px] text-gray-500 font-sans mt-0.5 truncate">
              Bloqueos causados por validaciones de auditoría.
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[28px] font-black text-purple-700 font-sans font-mono leading-none">
              {kpiRevisionCount}
            </span>
            <span className="text-[9.5px] font-bold bg-purple-100 text-purple-700 rounded-full px-2 py-0.5">
              RETRASO AGY
            </span>
          </div>
        </div>

        {/* CARD 2: CONTRACTOR DELAYS */}
        <div 
          onClick={() => setKpiFilter(prev => prev === 'contratista' ? null : 'contratista')}
          className={`border-2 rounded-2xl p-4 px-5 bg-white cursor-pointer shadow-sm hover:shadow-md transition-all flex items-center justify-between gap-4 select-none ${
            kpiFilter === 'contratista' ? 'border-amber-600 ring-2 ring-amber-100 bg-amber-50/10' : 'border-cream3 hover:border-navy/35'
          }`}
        >
          <div className="flex flex-col gap-1 min-w-0">
            <span className="text-[10.5px] uppercase font-bold text-amber-700 tracking-wider font-sans">
              Esperando al Contratista
            </span>
            <span className="text-[12px] text-gray-500 font-sans mt-0.5 truncate">
              Documentos no cargados, vencidos o rechazados.
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[28px] font-black text-amber-700 font-sans font-mono leading-none">
              {kpiContratistaCount}
            </span>
            <span className="text-[9.5px] font-bold bg-amber-100 text-amber-700 rounded-full px-2 py-0.5 font-sans">
              RETRASO CONT.
            </span>
          </div>
        </div>

        {/* CARD 3: VENCEN EN 30 DIAS */}
        <div 
          onClick={() => setKpiFilter(prev => prev === 'vence30' ? null : 'vence30')}
          className={`border-2 rounded-2xl p-4 px-5 bg-white cursor-pointer shadow-sm hover:shadow-md transition-all flex items-center justify-between gap-4 select-none ${
            kpiFilter === 'vence30' ? 'border-navy ring-2 ring-navy/5 bg-gray-50/10' : 'border-cream3 hover:border-navy/35'
          }`}
        >
          <div className="flex flex-col gap-1 min-w-0">
            <span className="text-[10.5px] uppercase font-bold text-navy tracking-wider font-sans">
              Vencen en Próximos 30 Días
            </span>
            <span className="text-[12px] text-gray-500 font-sans mt-0.5 truncate">
              Alertas preventivas de expiración inminente.
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[28px] font-black text-navy font-sans font-mono leading-none">
              {kpiVence30Count}
            </span>
            <span className="text-[9.5px] font-bold bg-navy text-cream rounded-full px-2 py-0.5">
              ALERTAS
            </span>
          </div>
        </div>

      </div>

      {/* FILTER AND CONTROL BAR */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white border border-cream3 rounded-2xl p-3.5 px-4.5 shadow-sm">
        
        {/* VIEW SEGMENTED CONTROLLER */}
        <div className="flex border border-cream3 rounded-xl p-0.5 bg-cream/15 font-sans overflow-hidden">
          <button
            onClick={() => { setCompuertaFiltro('ambas'); setStatusFilter('todos'); }}
            className={`px-4.5 py-1.5 rounded-lg text-[12px] font-bold border-none transition-all cursor-pointer ${
              compuertaFiltro === 'ambas' ? 'bg-navy text-cream shadow-sm' : 'text-gray-500 bg-transparent hover:text-navy'
            }`}
          >
            Ambas compuertas
          </button>
          <button
            onClick={() => { setCompuertaFiltro('acceso'); setStatusFilter('todos'); }}
            className={`px-4.5 py-1.5 rounded-lg text-[12px] font-bold border-none transition-all cursor-pointer ${
              compuertaFiltro === 'acceso' ? 'bg-navy text-cream shadow-sm' : 'text-gray-500 bg-transparent hover:text-navy'
            }`}
          >
            Acceso a faena
          </button>
          <button
            onClick={() => { setCompuertaFiltro('pago'); setStatusFilter('todos'); }}
            className={`px-4.5 py-1.5 rounded-lg text-[12px] font-bold border-none transition-all cursor-pointer ${
              compuertaFiltro === 'pago' ? 'bg-navy text-cream shadow-sm' : 'text-gray-500 bg-transparent hover:text-navy'
            }`}
          >
            Estado de pago
          </button>
        </div>

        {/* SEARCH AND EXTRA FILTERS */}
        <div className="flex flex-wrap items-center gap-3.5 flex-1 max-w-lg justify-end">
          
          {/* SEARCH INPUT */}
          <div className="relative w-full max-w-[280px]">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar contratista o RUT..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full text-[12px] border border-cream3 rounded-xl pl-9 pr-4 py-2 font-sans bg-[#FBFBFA] focus:outline-none focus:border-brown placeholder-gray-400 focus:bg-white transition-all shadow-inner"
            />
          </div>

          {/* STATUS FILTER CHIPS */}
          {compuertaFiltro !== 'ambas' && (
            <div className="flex gap-1.5 border-l border-cream3 pl-3.5 font-sans">
              <button
                onClick={() => setStatusFilter('todos')}
                className={`text-[11.5px] font-bold rounded-full px-3 py-1.5 border transition-all cursor-pointer ${
                  statusFilter === 'todos'
                    ? 'bg-[#efecdf] text-navy border-brown/20'
                    : 'bg-white text-gray-500 border-cream3 hover:border-gray-400'
                }`}
              >
                Todas
              </button>
              <button
                onClick={() => setStatusFilter('bloqueados')}
                className={`text-[11.5px] font-bold rounded-full px-3 py-1.5 border transition-all cursor-pointer ${
                  statusFilter === 'bloqueados'
                    ? 'bg-red-50 text-red-700 border-red-200'
                    : 'bg-white text-gray-500 border-cream3 hover:border-gray-400'
                }`}
              >
                Bloqueadas
              </button>
              <button
                onClick={() => setStatusFilter('habilitados')}
                className={`text-[11.5px] font-bold rounded-full px-3 py-1.5 border transition-all cursor-pointer ${
                  statusFilter === 'habilitados'
                    ? 'bg-green-50 text-green-700 border-green-200'
                    : 'bg-white text-gray-500 border-cream3 hover:border-gray-400'
                }`}
              >
                Habilitadas
              </button>
            </div>
          )}

          {/* CLEAR FILTER INDICATOR */}
          {(kpiFilter !== null || searchTerm !== '' || statusFilter !== 'todos') && (
            <button
              onClick={() => {
                setKpiFilter(null);
                setSearchTerm('');
                setStatusFilter('todos');
              }}
              className="text-[11px] font-bold text-brown hover:underline cursor-pointer border-none bg-transparent font-sans"
            >
              Restablecer
            </button>
          )}

        </div>
      </div>

      {/* FILTER ACTIVE TAG */}
      {kpiFilter && (
        <div className="inline-flex items-center gap-1 bg-[#efecdf]/60 border border-brown/15 text-[11px] font-medium font-sans text-navy rounded-full px-3 py-1.5">
          <AlertTriangle size={12} className="text-brown" />
          <span>
            Mostrando solo contratistas filtrados por KPI: 
            <strong>
              {kpiFilter === 'revision' ? ' Revisión Interna Pendiente' : kpiFilter === 'contratista' ? ' Esperando al Contratista' : ' Vencen en 30 días'}
            </strong>
          </span>
          <button 
            onClick={() => setKpiFilter(null)}
            className="font-black text-brown hover:text-navy cursor-pointer border-none bg-transparent ml-1 text-xs"
          >
            ×
          </button>
        </div>
      )}

      {/* CONTRACTORS MAIN LIST/GRID CONTAINER */}
      
      {/* CASE A: AMBAS COMPUERTAS (SPLIT 2 COLUMNS) */}
      {compuertaFiltro === 'ambas' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5.5 min-h-[400px]">
          
          {/* COLUMN 1: ACCESO A FAENA */}
          <div className="space-y-3.5">
            <h3 className="text-[13.5px] font-bold uppercase tracking-wider text-brown flex items-center justify-between px-1 m-0">
              <span className="flex items-center gap-2"><Key size={15} /> Compuerta 1: Acceso a faena</span>
              <span className="text-[11.5px] font-semibold text-gray-500 lowercase font-sans">
                {filtered.filter(pc => pc.acceso.estado === 'bloqueado').length} bloqueados · {filtered.length} total
              </span>
            </h3>

            <div className="space-y-3">
              {filtered.map(pc => {
                const c = pc.contratista;
                const evalResult = pc.acceso;
                const isExpanded = expandedId === `${c.id}_acceso`;

                let bgClass = 'border-cream3 bg-white hover:shadow-sm';
                let statusBadgeColor = 'bg-[#e2f5e9] text-[#1c6b30] border-[#bee7ce]';
                if (evalResult.estado === 'bloqueado') {
                  bgClass = 'border-red-200 bg-[#fefefe] hover:border-red-300';
                  statusBadgeColor = 'bg-[#fbe8e8] text-[#932d2d] border-[#f7cfcf]';
                }

                return (
                  <div 
                    key={`${c.id}_acc`} 
                    className={`border-2 rounded-2xl overflow-hidden transition-all ${bgClass}`}
                  >
                    
                    {/* Compact Card Header */}
                    <div 
                      onClick={() => setExpandedId(isExpanded ? null : `${c.id}_acceso`)}
                      className="p-3.5 flex items-center justify-between gap-3 cursor-pointer select-none"
                    >
                      <div className="flex items-center gap-3.5 min-w-0 flex-1">
                        <div className="w-9 h-9 rounded-xl bg-navy text-cream flex items-center justify-center font-bold text-[12.5px] shrink-0 border border-cream3 shadow-sm">
                          {c.nombre.substring(0,2).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-[13.8px] text-navy truncate font-sans" title={c.nombre}>{c.nombre}</div>
                          <div className="text-[11px] text-gray-400 font-mono mt-0.5">RUT: {c.rut}</div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        {/* Responsible tag */}
                        {evalResult.estado === 'bloqueado' && (
                          <span className={`text-[8.5px] font-extrabold uppercase tracking-widest rounded-full px-2 py-0.5 border font-sans ${
                            evalResult.responsable === 'interno' 
                              ? 'bg-purple-50 text-purple-700 border-purple-200' 
                              : 'bg-amber-50 text-amber-700 border-amber-200'
                          }`}>
                            {evalResult.responsable === 'interno' ? 'REVISIÓN AGY' : 'ESPERA CONT.'}
                          </span>
                        )}

                        <span className={`text-[10px] font-bold rounded-full px-2.5 py-0.5 uppercase tracking-wide border font-sans ${statusBadgeColor}`}>
                          {evalResult.estado}
                        </span>

                        <ChevronDown 
                          size={16} 
                          className={`text-gray-400 transition-transform shrink-0 ${isExpanded ? 'rotate-180 text-navy' : ''}`} 
                        />
                      </div>
                    </div>

                    {/* Quick reason if blocked */}
                    {evalResult.estado === 'bloqueado' && !isExpanded && (
                      <div className="px-3.5 pb-3.5 pt-0 text-[11.5px] text-red-700 bg-red-50/10 font-sans border-t border-red-100/30 flex gap-1.5 items-start">
                        <AlertTriangle size={13} className="text-red-500 shrink-0 mt-0.5" />
                        <span className="truncate leading-normal font-sans" title={evalResult.motivo}>
                          {evalResult.motivo}
                        </span>
                      </div>
                    )}

                    {/* Expiration and progress snippet if Habilitado */}
                    {evalResult.estado === 'habilitado' && !isExpanded && evalResult.proximoVencimiento && (
                      <div className="px-3.5 pb-3 pt-0 text-[11px] text-gray-500 flex justify-between items-center gap-3 font-sans">
                        <span className="flex items-center gap-1 font-sans"><Clock size={11} /> Próx. Vencimiento:</span>
                        <span className="font-semibold text-navy shrink-0 font-sans">{evalResult.proximoVencimiento.documentoNombre} ({evalResult.proximoVencimiento.diasRestantes} d)</span>
                      </div>
                    )}

                    {/* Accordion Detail View */}
                    {isExpanded && renderDetailAccordion(pc, 'acceso')}

                  </div>
                );
              })}
              {filtered.length === 0 && (
                <div className="bg-white border border-cream3 rounded-2xl p-8 text-center text-[12.5px] text-gray-400 font-sans">
                  No hay contratistas en esta compuerta con los filtros activos.
                </div>
              )}
            </div>
          </div>

          {/* COLUMN 2: INSPECCION DE PAGO */}
          <div className="space-y-3.5">
            <h3 className="text-[13.5px] font-bold uppercase tracking-wider text-brown flex items-center justify-between px-1 m-0">
              <span className="flex items-center gap-2"><Banknote size={15} /> Compuerta 2: Inspección de pago</span>
              <span className="text-[11.5px] font-semibold text-gray-500 lowercase font-sans">
                {filtered.filter(pc => pc.pago.estado === 'bloqueado').length} retenidos · {filtered.length} total
              </span>
            </h3>

            <div className="space-y-3">
              {filtered.map(pc => {
                const c = pc.contratista;
                const evalResult = pc.pago;
                const isExpanded = expandedId === `${c.id}_pago`;

                let bgClass = 'border-cream3 bg-white hover:shadow-sm';
                let statusBadgeColor = 'bg-[#e2f5e9] text-[#1c6b30] border-[#bee7ce]';
                if (evalResult.estado === 'bloqueado') {
                  bgClass = 'border-red-200 bg-[#fefefe] hover:border-red-300';
                  statusBadgeColor = 'bg-[#fbe8e8] text-[#932d2d] border-[#f7cfcf]';
                }

                return (
                  <div 
                    key={`${c.id}_pag`} 
                    className={`border-2 rounded-2xl overflow-hidden transition-all ${bgClass}`}
                  >
                    
                    {/* Compact Card Header */}
                    <div 
                      onClick={() => setExpandedId(isExpanded ? null : `${c.id}_pago`)}
                      className="p-3.5 flex items-center justify-between gap-3 cursor-pointer select-none"
                    >
                      <div className="flex items-center gap-3.5 min-w-0 flex-1">
                        <div className="w-9 h-9 rounded-xl bg-navy text-cream flex items-center justify-center font-bold text-[12.5px] shrink-0 border border-cream3 shadow-sm">
                          {c.nombre.substring(0,2).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-[13.8px] text-navy truncate font-sans" title={c.nombre}>{c.nombre}</div>
                          <div className="text-[11px] text-gray-400 font-mono mt-0.5">RUT: {c.rut}</div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        {/* Responsible tag */}
                        {evalResult.estado === 'bloqueado' && (
                          <span className={`text-[8.5px] font-extrabold uppercase tracking-widest rounded-full px-2 py-0.5 border font-sans ${
                            evalResult.responsable === 'interno' 
                              ? 'bg-purple-50 text-purple-700 border-purple-200' 
                              : 'bg-amber-50 text-amber-700 border-amber-200'
                          }`}>
                            {evalResult.responsable === 'interno' ? 'REVISIÓN AGY' : 'ESPERA CONT.'}
                          </span>
                        )}

                        <span className={`text-[10px] font-bold rounded-full px-2.5 py-0.5 uppercase tracking-wide border font-sans ${statusBadgeColor}`}>
                          {evalResult.estado === 'bloqueado' ? 'RETENIDO' : 'LIBERADO'}
                        </span>

                        <ChevronDown 
                          size={16} 
                          className={`text-gray-400 transition-transform shrink-0 ${isExpanded ? 'rotate-180 text-navy' : ''}`} 
                        />
                      </div>
                    </div>

                    {/* Quick reason if blocked */}
                    {evalResult.estado === 'bloqueado' && !isExpanded && (
                      <div className="px-3.5 pb-3.5 pt-0 text-[11.5px] text-red-700 bg-red-50/10 font-sans border-t border-red-100/30 flex gap-1.5 items-start">
                        <AlertTriangle size={13} className="text-red-500 shrink-0 mt-0.5" />
                        <span className="truncate leading-normal font-sans" title={evalResult.motivo}>
                          {evalResult.motivo}
                        </span>
                      </div>
                    )}

                    {/* Expiration and progress snippet if Habilitado */}
                    {evalResult.estado === 'habilitado' && !isExpanded && evalResult.proximoVencimiento && (
                      <div className="px-3.5 pb-3 pt-0 text-[11px] text-gray-500 flex justify-between items-center gap-3 font-sans">
                        <span className="flex items-center gap-1 font-sans"><Clock size={11} /> Próx. Vencimiento:</span>
                        <span className="font-semibold text-navy shrink-0 font-sans">{evalResult.proximoVencimiento.documentoNombre} ({evalResult.proximoVencimiento.diasRestantes} d)</span>
                      </div>
                    )}

                    {/* Accordion Detail View */}
                    {isExpanded && renderDetailAccordion(pc, 'pago')}

                  </div>
                );
              })}
              {filtered.length === 0 && (
                <div className="bg-white border border-cream3 rounded-2xl p-8 text-center text-[12.5px] text-gray-400 font-sans">
                  No hay contratistas en esta compuerta con los filtros activos.
                </div>
              )}
            </div>
          </div>

        </div>
      )}

      {/* CASE B: SINGLE COMPUERTA (ACCESO OR PAGO FULL WIDTH VIEW) WITH HEADERS AND DETAILS */}
      {compuertaFiltro !== 'ambas' && (
        <div className="space-y-6 min-h-[400px]">
          
          {/* RENDER BLOCKED GROUP FIRST */}
          <div className="space-y-3">
            <div className="bg-[#fbe8e8] border border-[#f7cfcf] rounded-xl p-2.5 px-4.5 text-[12px] font-bold text-[#932d2d] uppercase tracking-wide font-sans shadow-sm flex items-center justify-between">
              <span>✗ BLOQUEADAS EN {compuertaFiltro === 'acceso' ? 'ACCESO A FAENA' : 'ESTADO DE PAGO'}</span>
              <span className="font-mono text-[13px] bg-red-100/60 px-2 py-0.5 rounded-full">{blockedFocusList.length}</span>
            </div>

            {blockedFocusList.length === 0 ? (
              <div className="bg-white border border-dashed border-cream3 rounded-2xl p-6 text-center text-[12.5px] text-gray-400 font-sans">
                No hay empresas bloqueadas en esta compuerta.
              </div>
            ) : (
              <div className="border border-cream3 bg-white rounded-2xl overflow-hidden shadow-sm">
                <table className="w-full text-left text-[12.5px] border-collapse font-sans">
                  <thead>
                    <tr className="bg-cream2 text-navy font-bold border-b border-cream3">
                      <th className="p-3.5 px-5">Empresa Contratista</th>
                      <th className="p-3.5">Estado</th>
                      <th className="p-3.5">Próximo Vencimiento</th>
                      <th className="p-3.5 font-sans">Requisitos Empresa</th>
                      {compuertaFiltro === 'acceso' && <th className="p-3.5">Personal Habilitado</th>}
                      <th className="p-3.5">Última Actividad</th>
                      <th className="p-3.5 px-5 text-right"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {blockedFocusList.map(pc => {
                      const c = pc.contratista;
                      const evalResult = compuertaFiltro === 'acceso' ? pc.acceso : pc.pago;
                      const isExpanded = expandedId === `${c.id}_focused`;

                      return (
                        <React.Fragment key={c.id}>
                          <tr 
                            onClick={() => setExpandedId(isExpanded ? null : `${c.id}_focused`)}
                            className="border-b border-cream hover:bg-gray-50/60 last:border-0 cursor-pointer transition-colors"
                          >
                            <td className="p-3.5 px-5">
                              <div className="font-bold text-navy text-[13.8px]">{c.nombre}</div>
                              <div className="text-[11px] text-gray-400 font-mono mt-0.5">RUT: {c.rut}</div>
                            </td>
                            <td className="p-3.5">
                              <div className="flex flex-col gap-1 items-start font-sans">
                                <span className={`text-[10px] font-bold rounded-full px-2.5 py-0.5 border uppercase tracking-wide bg-[#fbe8e8] text-[#932d2d] border-[#f7cfcf]`}>
                                  {compuertaFiltro === 'pago' ? 'RETENIDO' : 'BLOQUEADO'}
                                </span>
                                <span className={`text-[8.5px] font-extrabold uppercase tracking-widest rounded px-1.5 py-0.5 border mt-0.5 ${
                                  evalResult.responsable === 'interno' 
                                    ? 'bg-purple-50 text-purple-700 border-purple-200' 
                                    : 'bg-amber-50 text-amber-700 border-amber-200'
                                }`}>
                                  {evalResult.responsable === 'interno' ? 'REVISIÓN AGY' : 'ESPERA CONT.'}
                                </span>
                              </div>
                            </td>
                            <td className="p-3.5">{renderVencimientoBadge(evalResult.proximoVencimiento)}</td>
                            <td className="p-3.5">
                              <div className="flex items-center gap-2">
                                <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden shrink-0">
                                  <div className="bg-[#a32d2d] h-full" style={{ width: `${pc.companyProgress}%` }}></div>
                                </div>
                                <span className="font-bold font-mono text-[11px] text-gray-600 shrink-0">{pc.companyProgress}% ({pc.companyApprovedCount}/{pc.companyTotalCount})</span>
                              </div>
                            </td>
                            {compuertaFiltro === 'acceso' && (
                              <td className="p-3.5 font-sans">
                                <div className="font-semibold text-navy">
                                  {pc.workersEnabledCount} / {pc.workersTotalCount} habilitados
                                </div>
                                <div className="text-[9.5px] text-gray-400 mt-0.5">Personal asignado a faena</div>
                              </td>
                            )}
                            <td className="p-3.5 font-mono text-gray-500">{pc.lastActivity}</td>
                            <td className="p-3.5 px-5 text-right">
                              <ChevronDown 
                                size={18} 
                                className={`text-gray-400 transition-transform ${isExpanded ? 'rotate-180 text-navy' : ''}`} 
                              />
                            </td>
                          </tr>
                          {isExpanded && (
                            <tr>
                              <td colSpan={compuertaFiltro === 'acceso' ? 7 : 6} className="p-0">
                                {renderDetailAccordion(pc, compuertaFiltro)}
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* RENDER HABILITATED GROUP SECOND */}
          <div className="space-y-3">
            <div className="bg-[#e2f5e9] border border-[#bee7ce] rounded-xl p-2.5 px-4.5 text-[12px] font-bold text-[#1c6b30] uppercase tracking-wide font-sans shadow-sm flex items-center justify-between">
              <span>✓ HABILITADAS EN {compuertaFiltro === 'acceso' ? 'ACCESO A FAENA' : 'ESTADO DE PAGO'}</span>
              <span className="font-mono text-[13px] bg-green-100/60 px-2 py-0.5 rounded-full">{enabledFocusList.length}</span>
            </div>

            {enabledFocusList.length === 0 ? (
              <div className="bg-white border border-dashed border-cream3 rounded-2xl p-6 text-center text-[12.5px] text-gray-400 font-sans">
                No hay empresas habilitadas en esta compuerta.
              </div>
            ) : (
              <div className="border border-cream3 bg-white rounded-2xl overflow-hidden shadow-sm">
                <table className="w-full text-left text-[12.5px] border-collapse font-sans">
                  <thead>
                    <tr className="bg-cream2 text-navy font-bold border-b border-cream3">
                      <th className="p-3.5 px-5">Empresa Contratista</th>
                      <th className="p-3.5">Estado</th>
                      <th className="p-3.5">Próximo Vencimiento</th>
                      <th className="p-3.5">Requisitos Empresa</th>
                      {compuertaFiltro === 'acceso' && <th className="p-3.5">Personal Habilitado</th>}
                      <th className="p-3.5">Última Actividad</th>
                      <th className="p-3.5 px-5 text-right"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {enabledFocusList.map(pc => {
                      const c = pc.contratista;
                      const evalResult = compuertaFiltro === 'acceso' ? pc.acceso : pc.pago;
                      const isExpanded = expandedId === `${c.id}_focused`;

                      return (
                        <React.Fragment key={c.id}>
                          <tr 
                            onClick={() => setExpandedId(isExpanded ? null : `${c.id}_focused`)}
                            className="border-b border-cream hover:bg-gray-50/60 last:border-0 cursor-pointer transition-colors"
                          >
                            <td className="p-3.5 px-5">
                              <div className="font-bold text-navy text-[13.8px]">{c.nombre}</div>
                              <div className="text-[11px] text-gray-400 font-mono mt-0.5">RUT: {c.rut}</div>
                            </td>
                            <td className="p-3.5 font-sans">
                              <span className={`text-[10px] font-bold rounded-full px-2.5 py-0.5 border uppercase tracking-wide bg-[#e2f5e9] text-[#1c6b30] border-[#bee7ce]`}>
                                {compuertaFiltro === 'pago' ? 'LIBERADO' : 'HABILITADO'}
                              </span>
                            </td>
                            <td className="p-3.5">{renderVencimientoBadge(evalResult.proximoVencimiento)}</td>
                            <td className="p-3.5 font-sans">
                              <div className="flex items-center gap-2">
                                <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden shrink-0">
                                  <div className="bg-[#2a6a3a] h-full" style={{ width: `${pc.companyProgress}%` }}></div>
                                </div>
                                <span className="font-bold font-mono text-[11px] text-gray-600 shrink-0">{pc.companyProgress}% ({pc.companyApprovedCount}/{pc.companyTotalCount})</span>
                              </div>
                            </td>
                            {compuertaFiltro === 'acceso' && (
                              <td className="p-3.5 font-sans">
                                <div className="font-semibold text-navy">
                                  {pc.workersEnabledCount} / {pc.workersTotalCount} habilitados
                                </div>
                                <div className="text-[9.5px] text-gray-400 mt-0.5">Personal asignado a faena</div>
                              </td>
                            )}
                            <td className="p-3.5 font-mono text-gray-500">{pc.lastActivity}</td>
                            <td className="p-3.5 px-5 text-right">
                              <ChevronDown 
                                size={18} 
                                className={`text-gray-400 transition-transform ${isExpanded ? 'rotate-180 text-navy' : ''}`} 
                              />
                            </td>
                          </tr>
                          {isExpanded && (
                            <tr>
                              <td colSpan={compuertaFiltro === 'acceso' ? 7 : 6} className="p-0">
                                {renderDetailAccordion(pc, compuertaFiltro)}
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>
      )}

    </div>
  );
}
