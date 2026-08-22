import React, { useState, useEffect } from 'react';
import {
  Search,
  Building,
  Key,
  Banknote,
  Send,
  Layers,
  ArrowRight,
  User,
  CheckCircle,
  AlertTriangle,
  ChevronDown,
  Clock,
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
  // 1. States matching the mockup flow
  const [filtroProyecto, setFiltroProyecto] = useState<string>(GLOBAL_PROYECTOS[0]?.id || 'costanera');
  const [compuertaFiltro, setCompuertaFiltro] = useState<'ambas' | 'acceso' | 'pago'>('ambas');
  
  // Single compuerta status filters (Todas / Bloqueadas / Habilitadas)
  const [filt, setFilt] = useState<{ acceso: string; pago: string }>({ acceso: 'todos', pago: 'todos' });
  const [q, setQ] = useState<{ acceso: string; pago: string }>({ acceso: '', pago: '' });

  // KPI Quick Filter ('nos' = waiting internal review, 'ellos' = waiting contractor, 'venc' = vence in 30 days)
  const [respFilter, setRespFilter] = useState<'nos' | 'ellos' | 'venc' | null>(null);

  // Accordion state: separate for access & payment
  const [open, setOpen] = useState<{ acceso: string | null; pago: string | null }>({ acceso: null, pago: null });

  // Toast notification
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Clean filters when project changes
  useEffect(() => {
    setOpen({ acceso: null, pago: null });
    setRespFilter(null);
    setQ({ acceso: '', pago: '' });
    setFilt({ acceso: 'todos', pago: 'todos' });
  }, [filtroProyecto]);

  const triggerToast = (msg: string) => {
    setToast(msg);
  };

  const GATEMETA = {
    acceso: {
      title: 'Acceso a faena',
      sub: 'Seguridad y contrato · empresa y trabajador',
      icon: (
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4" />
          <path d="M10 17l5-5-5-5" />
          <path d="M15 12H3" />
        </svg>
      ),
      blockTxt: 'Sin acceso',
      passTxt: 'Habilitado'
    },
    pago: {
      title: 'Estado de pago',
      sub: 'Cumplimiento laboral y previsional',
      icon: (
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="2" y="5" width="20" height="14" rx="2" />
          <path d="M2 10h20" />
        </svg>
      ),
      blockTxt: 'Pago retenido',
      passTxt: 'Autorizado'
    }
  };

  const getInitials = (nombre: string) => {
    return nombre
      .split(' ')
      .filter(w => w.length > 2 || /^[A-ZÁÉÍÓÚ]/.test(w))
      .slice(0, 2)
      .map(w => w[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getWorkerInitials = (nombre: string) => {
    return nombre.replace('.', '').split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
  };

  const getVencTxt = (dias: number | null, fecha: string | null) => {
    if (dias === null) return '—';
    if (dias < 0) return 'Vencido';
    if (dias === 0) return 'Hoy';
    if (dias <= 30) return `${dias} días`;
    return fecha || '—';
  };

  // Get requirements for current project context
  const reqs = getRequisitos().filter(r => r.proyectoId === filtroProyecto && r.activo !== false);

  // Filter contractors associated with active project
  const contractorsInProject = GLOBAL_CONTRATISTAS.filter(c => 
    c.proyectos.includes(filtroProyecto)
  );

  // Generate color palette index from contractor name to preserve avatar style
  const getAvatarColor = (name: string) => {
    const colors = ['bg-[#6b4f9e]', 'bg-[#2f6b7a]', 'bg-[#2f6b32]', 'bg-[#7a5a3a]', 'bg-[#245a8a]', 'bg-[#8a4a5a]'];
    let sum = 0;
    for (let i = 0; i < name.length; i++) sum += name.charCodeAt(i);
    return colors[sum % colors.length];
  };

  // Process data statically to build the same dataset structure as in variables
  const processedCompanies = contractorsInProject.map(c => {
    const accesoEval = evaluarHabilitacionCompuerta(c, filtroProyecto, 'acceso');
    const pagoEval = evaluarHabilitacionCompuerta(c, filtroProyecto, 'pago');

    // 1. Acceso requirements
    const accesoReqsList = reqs.filter(r => r.criticidad === 'bloquea_acceso' || r.criticidad === 'bloquea_ambas');
    const accesoEmpReqs = accesoReqsList.filter(r => r.destino === 'empresa');
    const accesoUploaded = accesoEmpReqs.filter(req => {
      const doc = c.documentos?.find(d => 
        d.proyectoId === filtroProyecto &&
        (d.nombre.toLowerCase().includes(req.nombre.toLowerCase()) || 
         req.nombre.toLowerCase().includes(d.nombre.toLowerCase()))
      );
      return esDocumentoCumplido(doc, req);
    });

    const accesoReqs = accesoReqsList.map(req => {
      const doc = req.destino === 'empresa' 
        ? c.documentos?.find(d => d.proyectoId === filtroProyecto && (d.nombre.toLowerCase().includes(req.nombre.toLowerCase()) || req.nombre.toLowerCase().includes(d.nombre.toLowerCase())))
        : null;

      const cumplido = doc ? esDocumentoCumplido(doc, req) : false;
      const isVencido = doc ? esVencidoPorFecha(doc.vencimiento) : false;
      const diasRestantes = doc ? obtenerDiasRestantes(doc.vencimiento) : null;
      
      let s = 'Pendiente de carga';
      let st = 'warn';
      if (doc) {
        if (doc.estado === 'revision') {
          s = 'En revisión';
          st = 'info';
        } else if (doc.estado === 'rechazado') {
          s = 'Rechazado';
          st = 'crit';
        } else if (isVencido) {
          s = 'Vencido';
          st = 'crit';
        } else {
          s = 'Aprobado';
          st = 'ok';
        }
      }

      return {
        n: req.nombre,
        ob: req.obligatorio ? 1 : 0,
        s,
        st,
        v: doc ? doc.vencimiento : '—',
        soon: (diasRestantes !== null && diasRestantes <= 7) ? 1 : 0
      };
    });

    // Workers for access
    const projectWorkers = (c.trabajadores || []).filter(w => 
      w.documentos?.some(d => d.proyectoId === filtroProyecto)
    );
    const enabledWorkers = projectWorkers.filter(w => 
      calcularEstadoTrabajador(w, filtroProyecto) === 'aprobado'
    );
    const workersList = projectWorkers.map(w => {
      const wState = calcularEstadoTrabajador(w, filtroProyecto);
      let s = 'Pendiente';
      let st = 'info';
      if (wState === 'aprobado') {
        s = 'Habilitado';
        st = 'ok';
      } else if (wState === 'rechazado') {
        s = 'Inhabilitado';
        st = 'crit';
      } else if (wState === 'por_vencer') {
        s = 'Por vencer';
        st = 'warn';
      }

      return {
        n: w.nombre,
        s,
        st
      };
    });

    // 2. Pago requirements
    const pagoReqsList = reqs.filter(r => r.criticidad === 'bloquea_pago' || r.criticidad === 'bloquea_ambas');
    const pagoEmpReqs = pagoReqsList.filter(r => r.destino === 'empresa');
    const pagoUploaded = pagoEmpReqs.filter(req => {
      const doc = c.documentos?.find(d => 
        d.proyectoId === filtroProyecto &&
        (d.nombre.toLowerCase().includes(req.nombre.toLowerCase()) || 
         req.nombre.toLowerCase().includes(d.nombre.toLowerCase()))
      );
      return esDocumentoCumplido(doc, req);
    });

    const pagoReqs = pagoReqsList.map(req => {
      const doc = c.documentos?.find(d => 
        d.proyectoId === filtroProyecto &&
        (d.nombre.toLowerCase().includes(req.nombre.toLowerCase()) || 
         req.nombre.toLowerCase().includes(d.nombre.toLowerCase()))
      );

      const cumplido = doc ? esDocumentoCumplido(doc, req) : false;
      const isVencido = doc ? esVencidoPorFecha(doc.vencimiento) : false;
      const diasRestantes = doc ? obtenerDiasRestantes(doc.vencimiento) : null;

      let s = 'Pendiente de carga';
      let st = 'warn';
      if (doc) {
        if (doc.estado === 'revision') {
          s = 'En revisión';
          st = 'info';
        } else if (doc.estado === 'rechazado') {
          s = 'Rechazado';
          st = 'crit';
        } else if (isVencido) {
          s = 'Vencido';
          st = 'crit';
        } else {
          s = 'Aprobado';
          st = 'ok';
        }
      }

      return {
        n: req.nombre,
        ob: req.obligatorio ? 1 : 0,
        s,
        st,
        v: doc ? doc.vencimiento : '—',
        soon: (diasRestantes !== null && diasRestantes <= 7) ? 1 : 0
      };
    });

    // Expiry details mapping
    const getGateVencInfo = (gateEval: any) => {
      if (!gateEval.proximoVencimiento) {
        return { vencDias: null, vencDoc: null, vencFecha: '—' };
      }
      return {
        vencDias: gateEval.proximoVencimiento.diasRestantes,
        vencDoc: gateEval.proximoVencimiento.documentoNombre,
        vencFecha: gateEval.proximoVencimiento.fechaVencimiento
      };
    };

    const accVenc = getGateVencInfo(accesoEval);
    const pagVence = getGateVencInfo(pagoEval);

    // Simulate upload activity date
    let lastActivity = 'hace 1d';
    const docs = c.documentos?.filter(d => d.proyectoId === filtroProyecto) || [];
    if (docs.length > 0) {
      lastActivity = 'hace 6h';
    }

    return {
      emp: c.nombre,
      rut: c.rut,
      colorClass: getAvatarColor(c.nombre),
      original: c,
      acceso: {
        estado: accesoEval.estado === 'bloqueado' ? 'block' : 'pass',
        resp: accesoEval.responsable || null,
        motivo: accesoEval.estado === 'bloqueado' 
          ? (accesoEval.motivo || 'Requisitos pendientes') 
          : `Todos los requisitos vigentes · ${enabledWorkers.length} de ${projectWorkers.length} trabajadores habilitados`,
        reqOk: accesoUploaded.length,
        reqTot: accesoEmpReqs.length,
        wOk: enabledWorkers.length,
        wTot: projectWorkers.length,
        act: lastActivity,
        vencDias: accVenc.vencDias,
        vencDoc: accVenc.vencDoc,
        vencFecha: accVenc.vencFecha,
        reqs: accesoReqs,
        pers: workersList
      },
      pago: {
        estado: pagoEval.estado === 'bloqueado' ? 'block' : 'pass',
        resp: pagoEval.responsable || null,
        motivo: pagoEval.estado === 'bloqueado'
          ? (pagoEval.motivo || 'Cumplimiento pendiente')
          : 'Cumplimiento laboral al día',
        reqOk: pagoUploaded.length,
        reqTot: pagoEmpReqs.length,
        act: lastActivity,
        vencDias: pagVence.vencDias,
        vencDoc: pagVence.vencDoc,
        vencFecha: pagVence.vencFecha,
        reqs: pagoReqs,
        pers: []
      }
    };
  });

  // Calculate overall tallies for the summary cards
  let countNos = 0;
  let countEllos = 0;
  processedCompanies.forEach(e => {
    ['acceso', 'pago'].forEach(g => {
      const gate = (e as any)[g];
      if (gate.estado === 'block') {
        if (gate.resp === 'interno') {
          countNos++;
        } else {
          countEllos++;
        }
      }
    });
  });

  const countVenc = processedCompanies.flatMap(e => [e.acceso.vencDias, e.pago.vencDias])
    .filter(d => d !== null && d >= 0 && d <= 30).length;

  const handleKpiClick = (type: 'nos' | 'ellos' | 'venc') => {
    if (respFilter === type) {
      setRespFilter(null);
    } else {
      setRespFilter(type);
    }
  };

  const getFilteredCompanies = (gate: 'acceso' | 'pago', isSoloMode: boolean) => {
    let result = processedCompanies;

    // Filter by KPI card selection
    if (respFilter === 'nos') {
      result = result.filter(e => (e as any)[gate].estado === 'block' && (e as any)[gate].resp === 'interno');
    } else if (respFilter === 'ellos') {
      result = result.filter(e => (e as any)[gate].estado === 'block' && (e as any)[gate].resp === 'contratista');
    } else if (respFilter === 'venc') {
      result = result.filter(e => {
        const d = (e as any)[gate].vencDias;
        return d !== null && d >= 0 && d <= 30;
      });
    }

    // Filter by search query and chips if in solo mode
    if (isSoloMode) {
      const activeFilter = filt[gate];
      if (activeFilter === 'block') {
        result = result.filter(e => (e as any)[gate].estado === 'block');
      } else if (activeFilter === 'pass') {
        result = result.filter(e => (e as any)[gate].estado === 'pass');
      }

      const activeQuery = q[gate].toLowerCase().trim();
      if (activeQuery) {
        result = result.filter(e => e.emp.toLowerCase().includes(activeQuery) || e.rut.toLowerCase().includes(activeQuery));
      }
    }

    // Sort: Blocked first, then alphabetical by company name
    return [...result].sort((a, b) => {
      const aBlock = (a as any)[gate].estado === 'block' ? 0 : 1;
      const bBlock = (b as any)[gate].estado === 'block' ? 0 : 1;
      return aBlock - bBlock || a.emp.localeCompare(b.emp);
    });
  };

  // Toggle Accordion
  const toggleRow = (gate: 'acceso' | 'pago', index: string) => {
    setOpen(prev => ({
      ...prev,
      [gate]: prev[gate] === index ? null : index
    }));
  };

  // Render list items according to mockup design using dashboard colors
  const renderRow = (e: any, index: number, gate: 'acceso' | 'pago', isSoloMode: boolean) => {
    const g = (e as any)[gate];
    const m = GATEMETA[gate];
    const isOpen = open[gate] === `${index}`;
    const otherGate = gate === 'acceso' ? 'pago' : 'acceso';
    const isOtherBlocked = e[otherGate].estado === 'block';

    const pct = g.reqTot > 0 ? Math.round((g.reqOk / g.reqTot) * 100) : 100;
    const isRed = g.estado === 'block';
    
    // Status text details
    const daysRestantes = g.vencDias;
    let vencColorClass = 'text-gray-500 font-semibold';
    if (daysRestantes !== null) {
      if (daysRestantes <= 7) {
        vencColorClass = 'text-[#a3312f] font-bold';
      } else if (daysRestantes <= 30) {
        vencColorClass = 'text-[#8a5a10] font-semibold';
      }
    }

    return (
      <React.Fragment key={`${index}_${gate}`}>
        <div 
          onClick={() => toggleRow(gate, `${index}`)}
          className={`flex items-center gap-4.5 p-4.5 border-b border-cream3 cursor-pointer hover:bg-[#FAF9F5] transition-colors font-sans bg-white ${isOpen ? 'bg-[#FAF9F5]' : ''}`}
        >
          <div className={`w-[34px] h-[34px] rounded-xl text-white font-bold text-[11px] flex items-center justify-center shrink-0 shadow-inner ${e.colorClass}`}>
            {getInitials(e.emp)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-[13.5px] text-navy">{e.emp}</span>
              {g.estado === 'block' && g.resp && (
                <span className={`text-[8.5px] font-extrabold uppercase tracking-widest rounded px-2 py-0.5 border ${
                  g.resp === 'interno' 
                    ? 'bg-[#eeebf7] text-[#5a4a8a] border-[#c3b9e0]' 
                    : 'bg-[#faf0dc] text-[#8a5a10] border-[#eecd94]'
                }`}>
                  {g.resp === 'interno' ? 'REVISIÓN INTERNA' : 'ESPERA CONTRATISTA'}
                </span>
              )}
            </div>
            <div className={`text-[11.5px] mt-1 font-medium ${isRed ? 'text-[#a3312f]' : 'text-gray-500'}`}>
              {g.motivo}
            </div>
          </div>

          {/* Progress Columns (Visible in single compuerta mode) */}
          {isSoloMode && (
            <div className="hidden md:block shrink-0 text-center min-w-[75px] font-sans">
              <div className="font-bold text-[12.5px] text-navy">{g.reqOk}/{g.reqTot}</div>
              <div className="text-[9.5px] text-gray-400 font-bold uppercase tracking-wider mt-0.5">Requisitos</div>
              <div className="w-16 h-1 bg-cream2 rounded-full overflow-hidden mx-auto mt-1">
                <div className={`h-full ${isRed ? 'bg-[#a3312f]' : 'bg-[#2f6b32]'}`} style={{ width: `${pct}%` }}></div>
              </div>
            </div>
          )}

          {isSoloMode && gate === 'acceso' && (
            <div className="hidden md:block shrink-0 text-center min-w-[85px] font-sans">
              <div className="font-bold text-[12.5px] text-navy">{g.wOk}/{g.wTot}</div>
              <div className="text-[9.5px] text-gray-400 font-bold uppercase tracking-wider mt-0.5">Trabajadores</div>
            </div>
          )}

          {/* Expiration Column */}
          <div className="hidden md:block shrink-0 text-right min-w-[100px] font-sans">
            <div className={`text-[11.5px] ${vencColorClass}`}>
              {getVencTxt(g.vencDias, g.vencFecha)}
            </div>
            <div className="text-[9.5px] text-gray-400 mt-0.5">
              {g.vencDoc ? 'Próx: ' + g.vencDoc : 'Sin vencimiento'}
            </div>
          </div>

          {/* Overall Gate Status Label */}
          <span className={`text-[10px] font-bold rounded-lg px-2.5 py-1 border uppercase tracking-wider text-center shrink-0 ${
            isRed
              ? 'bg-[#fbe8e8] text-[#932d2d] border-[#f7cfcf]'
              : 'bg-[#e2f5e9] text-[#1c6b30] border-[#bee7ce]'
          }`}>
            {g.estado === 'block' ? m.blockTxt : m.passTxt}
          </span>
          
          <ChevronDown 
            size={14} 
            className={`text-gray-400 transition-transform shrink-0 ${isOpen ? 'rotate-180 text-navy' : ''}`} 
          />
        </div>

        {/* Detailed Accordion Row */}
        {isOpen && (
          <div className="bg-[#FAF9F5] border-t border-cream3 p-5 px-6 font-sans">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* Requirements List */}
              <div className="space-y-2">
                <h4 className="text-[9.5px] font-bold uppercase tracking-wider text-gray-400 mb-1">Requisitos de {gate === 'acceso' ? 'acceso' : 'pago'}</h4>
                {g.reqs.length === 0 ? (
                  <p className="text-[12px] text-gray-400 italic">No hay requisitos configurados.</p>
                ) : (
                  g.reqs.map((x: any, idx: number) => (
                    <div key={idx} className="flex items-center gap-3 p-2.5 px-3 rounded-lg bg-white border border-cream3 text-[12.5px] font-sans">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${
                        x.st === 'ok' ? 'bg-[#2f6b32]' : x.st === 'crit' ? 'bg-[#a3312f]' : x.st === 'warn' ? 'bg-[#8a5a10]' : 'bg-[#245a8a]'
                      }`}></span>
                      <span className="flex-1 font-semibold text-navy truncate" title={x.n}>{x.n}</span>
                      {x.ob === 1 && <span className="text-[9px] font-extrabold bg-cream text-gray-500 rounded px-1.5 py-0.5">OBLIGATORIO</span>}
                      <span className={`text-[11px] font-bold ${
                        x.st === 'ok' ? 'text-[#2f6b32]' : x.st === 'crit' ? 'text-[#a3312f]' : x.st === 'warn' ? 'text-[#8a5a10]' : 'text-[#245a8a]'
                      }`}>{x.s}</span>
                      <span className={`text-[10px] text-gray-500 font-mono w-16 text-right shrink-0 ${x.soon ? 'text-[#a3312f] font-bold' : ''}`}>{x.v}</span>
                    </div>
                  ))
                )}
              </div>

              {/* Workers List (Access Only) */}
              {gate === 'acceso' && (
                <div className="space-y-2">
                  <h4 className="text-[9.5px] font-bold uppercase tracking-wider text-gray-400 mb-1">Trabajadores en este proyecto</h4>
                  {g.pers.length === 0 ? (
                    <p className="text-[12px] text-gray-400 italic">No hay trabajadores asignados.</p>
                  ) : (
                    g.pers.map((w: any, idx: number) => (
                      <div key={idx} className="flex items-center gap-2.5 p-2 px-3 rounded-lg bg-white border border-cream3 text-[12.5px] font-sans">
                        <span className="w-6 h-6 rounded-full bg-[#2c3a49] text-white text-[9px] font-bold flex items-center justify-center shrink-0">
                          {getWorkerInitials(w.n)}
                        </span>
                        <span className="flex-1 font-semibold text-navy truncate" title={w.n}>{w.n}</span>
                        <span className={`text-[11px] font-bold ${
                          w.st === 'ok' ? 'text-[#2f6b32]' : w.st === 'crit' ? 'text-[#a3312f]' : 'text-[#8a5a10]'
                        }`}>{w.s}</span>
                      </div>
                    ))
                  )}
                </div>
              )}

            </div>

            {/* Other Gate Status Box */}
            <div className="text-[11.5px] text-gray-600 bg-cream p-2.5 rounded-lg mt-4 font-sans border border-cream3/60">
              En <b>{GATEMETA[otherGate].title}</b> esta empresa está <b>{isOtherBlocked ? GATEMETA[otherGate].blockTxt.toLowerCase() : GATEMETA[otherGate].passTxt.toLowerCase()}</b>.
            </div>

            {/* Action Buttons Row */}
            <div className="flex gap-2 flex-wrap justify-end mt-4 border-t border-cream3/50 pt-3 bg-cream/15 -mx-6 -mb-5 p-3 px-6 rounded-b-2xl">
              <button 
                onClick={() => setSelectedAcreditacionContratista(e.original)}
                className="px-3.5 py-1.5 border border-[#ecdcb8] bg-[#f4ecdb] hover:bg-[#b3893f] hover:text-white rounded-lg text-[12px] font-bold text-[#b3893f] cursor-pointer transition-all shadow-sm"
              >
                Ver ficha completa
              </button>
              
              <button
                onClick={() => {
                  if (g.resp === 'interno') {
                    if (setActiveTab) {
                      setActiveTab('cola');
                    } else {
                      triggerToast('Pestaña de cola de revisión no accesible');
                    }
                  } else {
                    triggerToast(`Notificación enviada a ${e.emp} para corregir requisitos`);
                  }
                }}
                className="px-3.5 py-1.5 border border-cream3 bg-white hover:bg-navy hover:text-white rounded-lg text-[12px] font-bold text-navy cursor-pointer transition-all shadow-sm"
              >
                {g.resp === 'interno' ? 'Ir a cola de revisión' : 'Notificar al contratista'}
              </button>

              <button 
                onClick={() => triggerToast(`Historial de cambios consultado para ${e.emp}`)}
                className="px-3.5 py-1.5 border border-cream3 bg-white hover:bg-navy hover:text-white rounded-lg text-[12px] font-bold text-navy cursor-pointer transition-all shadow-sm"
              >
                Ver historial
              </button>
            </div>
          </div>
        )}
      </React.Fragment>
    );
  };

  // Render Gate list container
  const renderGateList = (gate: 'acceso' | 'pago', isSoloMode: boolean) => {
    const m = GATEMETA[gate];
    const filteredRows = getFilteredCompanies(gate, isSoloMode);

    const nb = processedCompanies.filter(e => (e as any)[gate].estado === 'block').length;
    const np = processedCompanies.length - nb;

    let body;
    if (isSoloMode) {
      const blocked = filteredRows.filter(r => (r as any)[gate].estado === 'block');
      const passed = filteredRows.filter(r => (r as any)[gate].estado !== 'block');

      body = (
        <>
          {blocked.length > 0 && (
            <>
              <div className="padding-y-[9px] px-[18px] bg-cream2 font-sans font-bold text-[10px] uppercase tracking-wider text-gray-500 border-b border-cream3 py-2 border-t border-t-cream3">
                Bloqueadas · {blocked.length}
              </div>
              {blocked.map((r, i) => renderRow(r, i, gate, true))}
            </>
          )}
          {passed.length > 0 && (
            <>
              <div className="padding-y-[9px] px-[18px] bg-cream2 font-sans font-bold text-[10px] uppercase tracking-wider text-gray-500 border-b border-cream3 py-2 border-t border-t-cream3">
                Habilitadas · {passed.length}
              </div>
              {passed.map((r, i) => renderRow(r, i + blocked.length, gate, true))}
            </>
          )}
          {filteredRows.length === 0 && (
            <div className="p-10 text-center text-gray-400 font-sans text-[13px] bg-white rounded-2xl">
              Sin resultados para este filtro.
            </div>
          )}
        </>
      );
    } else {
      body = filteredRows.length > 0 ? (
        filteredRows.map((r, i) => renderRow(r, i, gate, false))
      ) : (
        <div className="p-8 text-center text-gray-400 font-sans text-[12.5px] bg-white rounded-2xl">
          Nada pendiente con este filtro.
        </div>
      );
    }

    return (
      <div className="bg-white border border-cream3 rounded-2xl overflow-hidden shadow-sm flex flex-col font-sans">
        {/* Gate Header */}
        <div className="p-[15px] px-[18px] border-b-2 border-navy flex items-center gap-3 flex-wrap bg-white">
          <div className={`w-[38px] h-[38px] rounded-xl flex items-center justify-center shrink-0 ${
            gate === 'acceso' ? 'bg-[#e6eff7] text-[#245a8a]' : 'bg-[#f4ecdb] text-[#b3893f]'
          }`}>{m.icon}</div>
          <div className="flex-1 min-w-0">
            <h2 className="font-sans text-[15px] font-bold text-navy m-0">{m.title}</h2>
            <div className="text-[11.5px] text-gray-500 mt-0.5 font-sans leading-none">{m.sub}</div>
          </div>
          <div className="flex gap-2 shrink-0 font-sans">
            <div className="bg-[#fbe8e8] border border-[#eeb5b2] text-center p-1.5 px-3.5 rounded-xl min-w-[56px] font-sans">
              <div className="text-[18px] font-bold text-[#a3312f] font-mono leading-none">{nb}</div>
              <div className="text-[9.5px] font-bold text-[#a3312f] uppercase tracking-wider mt-1 leading-none">Bloq.</div>
            </div>
            <div className="bg-[#e9f3e8] border border-[#bfdcc0] text-center p-1.5 px-3.5 rounded-xl min-w-[56px] font-sans">
              <div className="text-[18px] font-bold text-[#2f6b32] font-mono leading-none">{np}</div>
              <div className="text-[9.5px] font-bold text-[#2f6b32] uppercase tracking-wider mt-1 leading-none">Ok</div>
            </div>
          </div>
        </div>

        {/* Tools (Only in Single gate mode) */}
        {isSolo && (
          <div className="flex flex-wrap items-center gap-3 p-3.5 px-4.5 border-b border-cream3 bg-cream2/30 font-sans">
            <div className="relative flex-1 min-w-[190px] font-sans">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-navy opacity-45 pointer-events-none" />
              <input
                type="text"
                placeholder="Buscar empresa o RUT..."
                value={q[gate]}
                onChange={(e) => {
                  const val = e.target.value;
                  setQ(prev => ({ ...prev, [gate]: val }));
                }}
                className="w-full pl-9 pr-3.5 py-2 border border-[#c7c3b5] rounded-xl text-[12.5px] bg-[#f1efe6] text-navy focus:outline-none focus:border-brown focus:bg-white transition-colors"
              />
            </div>
            <div className="flex gap-1.5 flex-wrap font-sans">
              <button
                onClick={() => setFilt(prev => ({ ...prev, [gate]: 'todos' }))}
                className={`border border-[#c7c3b5] text-[11.5px] font-bold px-3 py-1.5 rounded-full cursor-pointer transition-all ${
                  filt[gate] === 'todos' ? 'bg-navy text-white border-navy' : 'bg-[#f1efe6] text-navy hover:border-navy'
                }`}
              >
                Todas
              </button>
              <button
                onClick={() => setFilt(prev => ({ ...prev, [gate]: 'block' }))}
                className={`border border-[#c7c3b5] text-[11.5px] font-bold px-3 py-1.5 rounded-full cursor-pointer transition-all ${
                  filt[gate] === 'block' ? 'bg-[#a3312f] text-white border-[#a3312f]' : 'bg-[#f1efe6] text-navy hover:border-[#a3312f]'
                }`}
              >
                Bloqueadas
              </button>
              <button
                onClick={() => setFilt(prev => ({ ...prev, [gate]: 'pass' }))}
                className={`border border-[#c7c3b5] text-[11.5px] font-bold px-3 py-1.5 rounded-full cursor-pointer transition-all ${
                  filt[gate] === 'pass' ? 'bg-[#2f6b32] text-white border-[#2f6b32]' : 'bg-[#f1efe6] text-navy hover:border-[#2f6b32]'
                }`}
              >
                Habilitadas
              </button>
            </div>
          </div>
        )}

        {/* List Body */}
        <div className="divide-y divide-cream3 max-h-[600px] overflow-y-auto">{body}</div>
      </div>
    );
  };

  const isSolo = compuertaFiltro !== 'ambas';

  return (
    <div className="fade-in font-sans pb-10 space-y-4">
      
      {/* TOAST ALERT */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-[9999] bg-navy text-cream border border-cream3 rounded-xl p-4 shadow-xl flex items-center gap-2.5 font-sans text-[13px] font-medium animate-slide-in">
          <CheckCircle size={18} className="text-green-500 shrink-0" />
          <span>{toast}</span>
        </div>
      )}

      {/* HEADER SECTION - Styled to match global portal header styling */}
      <div className="relative overflow-hidden rounded-2xl p-6 px-7 text-white shadow-md bg-gradient-to-r from-navy to-[#2c3a49] border-2 border-cream3">
        <div className="absolute top-[-50%] right-[-5%] w-[380px] h-[380px] rounded-full bg-gradient-to-tr from-brown/10 to-transparent pointer-events-none"></div>
        <div className="relative z-10 flex flex-wrap justify-between items-start gap-4">
          <div>
            <div className="text-[10px] uppercase font-extrabold tracking-widest text-brown mb-1.5">Panel de administración</div>
            <h1 className="text-[23px] font-extrabold tracking-tight text-white m-0 font-sans">Habilitación de contratistas</h1>
            <p className="text-[12.5px] text-[#a3aeb8] m-0 mt-1.5 max-w-xl leading-relaxed font-sans">
              Quién está habilitado para entrar a faena y para cursar estado de pago, y qué falta para desbloquear a cada uno.
            </p>
          </div>
          <div className="flex items-center gap-2.5 bg-white/5 border border-white/10 p-2.5 px-4 rounded-xl font-sans shrink-0">
            <span className="text-[11.5px] font-bold text-cream/80">Proyecto:</span>
            <select
              value={filtroProyecto}
              onChange={(e) => setFiltroProyecto(e.target.value)}
              className="bg-[#2c3a49] border border-white/20 text-white font-semibold rounded-lg px-2.5 py-1 text-[13px] cursor-pointer focus:outline-none focus:border-brown hover:bg-white/10"
            >
              {GLOBAL_PROYECTOS.map(p => (
                <option key={p.id} value={p.id} className="text-navy">{p.nombre}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Perspective Select Segmented Controls */}
        <div className="relative z-10 flex bg-white/10 border border-white/15 p-0.5 rounded-xl gap-0.5 mt-5 w-fit font-sans overflow-hidden">
          <button
            onClick={() => { setCompuertaFiltro('ambas'); setRespFilter(null); }}
            className={`px-4.5 py-1.5 rounded-lg text-[12.5px] font-bold border-none transition-all cursor-pointer ${
              compuertaFiltro === 'ambas' ? 'bg-white text-navy shadow-sm' : 'text-[#a3aeb8] bg-transparent hover:text-white'
            }`}
          >
            Ambas compuertas
          </button>
          <button
            onClick={() => { setCompuertaFiltro('acceso'); setRespFilter(null); }}
            className={`px-4.5 py-1.5 rounded-lg text-[12.5px] font-bold border-none transition-all cursor-pointer flex items-center gap-2 ${
              compuertaFiltro === 'acceso' ? 'bg-white text-navy shadow-sm' : 'text-[#a3aeb8] bg-transparent hover:text-white'
            }`}
          >
            Acceso a faena <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[#fbe8e8] text-[#932d2d]">{processedCompanies.filter(pc => pc.acceso.estado === 'block').length}</span>
          </button>
          <button
            onClick={() => { setCompuertaFiltro('pago'); setRespFilter(null); }}
            className={`px-4.5 py-1.5 rounded-lg text-[12.5px] font-bold border-none transition-all cursor-pointer flex items-center gap-2 ${
              compuertaFiltro === 'pago' ? 'bg-white text-navy shadow-sm' : 'text-[#a3aeb8] bg-transparent hover:text-white'
            }`}
          >
            Estado de pago <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[#fbe8e8] text-[#932d2d]">{processedCompanies.filter(pc => pc.pago.estado === 'block').length}</span>
          </button>
        </div>
      </div>

      {/* RESPOND BAR / KPI SUMMARY CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4.5 mb-5 mt-5">
        <div 
          onClick={() => handleKpiClick('nos')}
          className={`bg-white border border-cream3 rounded-2xl p-4.5 flex items-center gap-4 cursor-pointer shadow-sm hover:border-brown transition-all relative overflow-hidden select-none ${
            respFilter === 'nos' ? 'border-purple ring-2 ring-purple/10 bg-purple-50/5' : ''
          }`}
        >
          <div className="w-[36px] h-[36px] rounded-xl flex items-center justify-center shrink-0 font-sans bg-[#eeebf7] text-[#5a4a8a]">⏳</div>
          <div className="flex-1">
            <div className="text-[20px] font-black font-sans leading-none text-[#5a4a8a]">{countNos}</div>
            <div className="text-[11.5px] font-bold text-gray-500 mt-1">Esperando revisión interna</div>
            <div className="text-[10px] text-gray-400 mt-0.5">La acción es nuestra</div>
          </div>
        </div>

        <div 
          onClick={() => handleKpiClick('ellos')}
          className={`bg-white border border-cream3 rounded-2xl p-4.5 flex items-center gap-4 cursor-pointer shadow-sm hover:border-brown transition-all relative overflow-hidden select-none ${
            respFilter === 'ellos' ? 'border-brown ring-2 ring-brown/10 bg-cream/10' : ''
          }`}
        >
          <div className="w-[36px] h-[36px] rounded-xl flex items-center justify-center shrink-0 font-sans bg-[#faf0dc] text-[#8a5a10]">↗</div>
          <div className="flex-1">
            <div className="text-[20px] font-black font-sans leading-none text-[#8a5a10]">{countEllos}</div>
            <div className="text-[11.5px] font-bold text-gray-500 mt-1">Esperando al contratista</div>
            <div className="text-[10px] text-gray-400 mt-0.5">Falta que carguen o corrijan</div>
          </div>
        </div>

        <div 
          onClick={() => handleKpiClick('venc')}
          className={`bg-white border border-cream3 rounded-2xl p-4.5 flex items-center gap-4 cursor-pointer shadow-sm hover:border-brown transition-all relative overflow-hidden select-none ${
            respFilter === 'venc' ? 'border-[#245a8a] ring-2 ring-[#245a8a]/10 bg-blue-50/5' : ''
          }`}
        >
          <div className="w-[36px] h-[36px] rounded-xl flex items-center justify-center shrink-0 font-sans bg-[#e6eff7] text-[#245a8a]">⏱</div>
          <div className="flex-1">
            <div className="text-[20px] font-black font-sans leading-none text-[#245a8a]">{countVenc}</div>
            <div className="text-[11.5px] font-bold text-gray-500 mt-1">Vencen en 30 días</div>
            <div className="text-[10px] text-gray-400 mt-0.5">Bloquearán si no se renuevan</div>
          </div>
        </div>
      </div>

      {/* GATES LIST CONTAINER */}
      <div className={`gates ${isSolo ? 'solo' : 'both'}`}>
        {!isSolo ? (
          <>
            {renderGateList('acceso', false)}
            {renderGateList('pago', false)}
          </>
        ) : (
          renderGateList(compuertaFiltro, true)
        )}
      </div>

      {/* EXPLANATORY FOOTNOTE */}
      <p className="text-[12px] text-gray-500 font-sans mt-4">
        {respFilter === 'nos' 
          ? 'Mostrando solo bloqueos que dependen de una revisión nuestra.' 
          : respFilter === 'ellos'
            ? 'Mostrando solo bloqueos que dependen de que el contratista cargue o corrija.'
            : 'Las dos compuertas son independientes: una empresa puede estar habilitada para entrar a faena y aun así tener el pago retenido.'}
      </p>

    </div>
  );
}
