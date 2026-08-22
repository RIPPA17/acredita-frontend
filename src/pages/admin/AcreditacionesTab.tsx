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
  ChevronDown
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

  const RESP = {
    nos: { l: 'REVISIÓN INTERNA', cls: 'nos' },
    ellos: { l: 'ESPERA CONTRATISTA', cls: 'ellos' }
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

  const getVencCls = (dias: number | null) => {
    if (dias === null) return 'far';
    if (dias <= 7) return 'soon';
    if (dias <= 30) return 'mid';
    return 'far';
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
    const colors = ['#6b4f9e', '#2f6b7a', '#2f6b32', '#7a5a3a', '#245a8a', '#8a4a5a'];
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
      color: getAvatarColor(c.nombre),
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

  // Render list items according to mockup design
  const renderRow = (e: any, index: number, gate: 'acceso' | 'pago', isSoloMode: boolean) => {
    const g = (e as any)[gate];
    const m = GATEMETA[gate];
    const isOpen = open[gate] === `${index}`;
    const otherGate = gate === 'acceso' ? 'pago' : 'acceso';
    const isOtherBlocked = e[otherGate].estado === 'block';

    const pct = g.reqTot > 0 ? Math.round((g.reqOk / g.reqTot) * 100) : 100;
    const barCls = g.estado === 'block' ? (pct < 60 ? 'crit' : 'warn') : 'ok';
    const r = g.resp ? (g.resp === 'interno' ? RESP.nos : RESP.ellos) : null;

    return (
      <React.Fragment key={`${index}_${gate}`}>
        <div 
          onClick={() => toggleRow(gate, `${index}`)}
          className={`grow ${isOpen ? 'open' : ''}`}
        >
          <div className="av font-sans" style={{ backgroundColor: e.color }}>
            {getInitials(e.emp)}
          </div>
          <div className="gi">
            <div className="gnrow">
              <span className="gn">{e.emp}</span>
              {r && <span className={`rtag ${r.cls}`}>{r.l}</span>}
            </div>
            <div className={`gm ${g.estado === 'block' ? 'crit' : 'ok'}`}>{g.motivo}</div>
          </div>

          <div className="xcol font-sans">
            <div className="xv">{g.reqOk}/{g.reqTot}</div>
            <div className="xl">Requisitos</div>
            <div className="xbar"><i className={barCls} style={{ width: `${pct}%` }}></i></div>
          </div>

          {gate === 'acceso' && (
            <div className="xcol font-sans">
              <div className="xv">{g.wOk}/{g.wTot}</div>
              <div className="xl font-sans">Trabajadores</div>
            </div>
          )}

          <div className="venc font-sans">
            <div className={`vencd ${getVencCls(g.vencDias)}`}>
              {getVencTxt(g.vencDias, g.vencFecha)}
            </div>
            <div className="vencl">
              {g.vencDoc ? 'Próx: ' + g.vencDoc : 'Sin vencimientos'}
            </div>
          </div>

          <span className={`st ${g.estado === 'block' ? 'block' : 'pass'}`}>
            {g.estado === 'block' ? m.blockTxt : m.passTxt}
          </span>
          <span className="chev font-mono">▾</span>
        </div>

        {isOpen && (
          <div className="gdetail">
            <div className="ddual font-sans">
              <div className="dsec">
                <h4>Requisitos de {gate === 'acceso' ? 'acceso' : 'pago'}</h4>
                {g.reqs.length === 0 ? (
                  <p className="text-[12px] text-gray-400 italic">No hay requisitos.</p>
                ) : (
                  g.reqs.map((x: any, idx: number) => (
                    <div key={idx} className="req">
                      <span className={`rd ${x.st}`}></span>
                      <span className="rn">{x.n}</span>
                      {x.ob === 1 && <span className="oblig">OBLIGATORIO</span>}
                      <span className={`rs ${x.st}`}>{x.s}</span>
                      <span className={`rvenc ${x.soon ? 'soon' : ''}`}>{x.v}</span>
                    </div>
                  ))
                )}
              </div>

              {gate === 'acceso' && (
                <div className="dsec">
                  <h4>Trabajadores en este proyecto</h4>
                  {g.pers.length === 0 ? (
                    <p className="text-[12px] text-gray-400 italic">No hay trabajadores asignados.</p>
                  ) : (
                    g.pers.map((w: any, idx: number) => (
                      <div key={idx} className="wrow">
                        <span className="wav">{getWorkerInitials(w.n)}</span>
                        <span className="rn">{w.n}</span>
                        <span className={`rs ${w.st}`}>{w.s}</span>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            <div className="xhint font-sans">
              En <b>{GATEMETA[otherGate].title}</b> esta empresa está <b>{isOtherBlocked ? GATEMETA[otherGate].blockTxt.toLowerCase() : GATEMETA[otherGate].passTxt.toLowerCase()}</b>.
            </div>

            <div className="dact">
              <button 
                onClick={() => setSelectedAcreditacionContratista(e.original)}
                className="btn-sm primary shadow-sm"
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
                className="btn-sm shadow-sm"
              >
                {g.resp === 'interno' ? 'Ir a cola de revisión' : 'Notificar al contratista'}
              </button>

              <button 
                onClick={() => triggerToast(`Historial de cambios consultado para ${e.emp}`)}
                className="btn-sm shadow-sm"
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
              <div className="groupbar">Bloqueadas · {blocked.length}</div>
              {blocked.map((r, i) => renderRow(r, i, gate, true))}
            </>
          )}
          {passed.length > 0 && (
            <>
              <div className="groupbar">Habilitadas · {passed.length}</div>
              {passed.map((r, i) => renderRow(r, i + blocked.length, gate, true))}
            </>
          )}
          {filteredRows.length === 0 && (
            <div className="p-10 text-center text-gray-400 font-sans text-[13px]">
              Sin resultados para este filtro.
            </div>
          )}
        </>
      );
    } else {
      body = filteredRows.length > 0 ? (
        filteredRows.map((r, i) => renderRow(r, i, gate, false))
      ) : (
        <div className="p-8 text-center text-gray-400 font-sans text-[12.5px]">
          Nada pendiente con este filtro.
        </div>
      );
    }

    return (
      <div className={`gate ${isSoloMode ? 'solo' : ''} font-sans`}>
        {/* Gate Header */}
        <div className="gate-head">
          <div className={`gate-icon ${gate} shrink-0`}>{m.icon}</div>
          <div className="gt">
            <h2>{m.title}</h2>
            <div className="gs">{m.sub}</div>
          </div>
          <div className="tally font-sans">
            <div className="tal block">
              <div className="n font-mono">{nb}</div>
              <div className="l font-sans">Bloq.</div>
            </div>
            <div className="tal pass">
              <div className="n font-mono">{np}</div>
              <div className="l font-sans">Ok</div>
            </div>
          </div>
        </div>

        {/* Tools (Only in Single gate mode) */}
        {isSoloMode && (
          <div className="ftools font-sans">
            <div className="search">
              <Search size={14} className="text-navy opacity-45" />
              <input
                type="text"
                placeholder="Buscar empresa o RUT..."
                value={q[gate]}
                onChange={(e) => {
                  const val = e.target.value;
                  setQ(prev => ({ ...prev, [gate]: val }));
                }}
              />
            </div>
            <div className="fchips font-sans">
              <button
                onClick={() => setFilt(prev => ({ ...prev, [gate]: 'todos' }))}
                className={`fchip ${filt[gate] === 'todos' ? 'active' : ''}`}
              >
                Todas
              </button>
              <button
                onClick={() => setFilt(prev => ({ ...prev, [gate]: 'block' }))}
                className={`fchip ${filt[gate] === 'block' ? 'active' : ''}`}
              >
                Bloqueadas
              </button>
              <button
                onClick={() => setFilt(prev => ({ ...prev, [gate]: 'pass' }))}
                className={`fchip ${filt[gate] === 'pass' ? 'active' : ''}`}
              >
                Habilitadas
              </button>
            </div>
          </div>
        )}

        {/* List Body */}
        <div className="glist">{body}</div>
      </div>
    );
  };

  const isSolo = compuertaFiltro !== 'ambas';

  return (
    <div className="acred-tab-container fade-in pb-10">
      
      {/* Embedded CSS matching the mockup design layout exactly, but inheriting page color variables */}
      <style>{`
        .acred-tab-container {
          --line: var(--cream3);
          --crit: #a3312f; --crit-bg: #fbebea; --crit-border: #eeb5b2;
          --warn: #8a5a10; --warn-bg: #faf0dc; --warn-border: #eecd94;
          --ok: #2f6b32; --ok-bg: #e9f3e8; --ok-border: #bfdcc0;
          --info: #245a8a; --info-bg: #e6eff7; --info-border: #a8c6e0;
          --purple: #5a4a8a; --purple-bg: #eeebf7; --purple-border: #c3b9e0;
          --gray: #767467; --gray-bg: var(--cream2); --sub: #8a8778;
        }

        .topband{background:linear-gradient(135deg, var(--navy) 0%, var(--navy2) 60%, #33424f 100%); padding:1.5rem 2rem 1.4rem; position:relative; overflow:hidden; border-radius: 16px;}
        .topband::after{content:''; position:absolute; top:-50%; right:-4%; width:380px; height:380px; border-radius:50%; background:radial-gradient(circle,rgba(201,164,94,0.14),transparent 70%);}
        .wrap{max-width:1320px; margin:0 auto; position:relative; z-index:1;}
        .eyebrow{font-size:10.5px; letter-spacing:2px; text-transform:uppercase; color:var(--brown2); font-weight:600; margin-bottom:5px;}
        .ph{display:flex; justify-content:space-between; align-items:flex-start; gap:1rem; flex-wrap:wrap;}
        .ph h1{font-size:24px; font-weight:700; margin:0; color:#fff; font-family: inherit;}
        .ph p{font-size:13px; color:#a3aeb8; margin:5px 0 0; max-width:520px; line-height: 1.4;}
        .projsel{background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.22); color:#fff; padding:8px 12px; border-radius:10px; font-size:13.5px; font-weight:600; font-family:inherit; cursor:pointer;}
        .projsel option{color:var(--navy);}

        .persp{display:flex; background:rgba(255,255,255,0.09); border:1px solid rgba(255,255,255,0.18); border-radius:11px; padding:3px; gap:2px; margin-top:1.1rem; width:fit-content;}
        .persp button{border:none; background:transparent; padding:8px 16px; border-radius:8px; font-size:12.5px; font-weight:600; color:#a3aeb8; cursor:pointer; font-family:inherit; display:flex; align-items:center; gap:7px; transition: all 0.1s;}
        .persp button:hover{color:#fff;}
        .persp button.active{background:#fff; color:var(--navy);}
        .persp .cnt{font-size:10.5px; font-weight:700; padding:1px 6px; border-radius:9px; background:var(--crit-bg); color:var(--crit);}

        /* responsibility split summary */
        .respbar{display:flex; gap:12px; margin-bottom:1.1rem; margin-top:1.3rem; flex-wrap:wrap;}
        .respcard{
          flex:1; min-width:230px; background:#fff; border:1px solid var(--cream3); border-radius:13px; padding:13px 16px;
          display:flex; align-items:center; gap:12px; cursor:pointer; transition:all .12s;
        }
        .respcard:hover{border-color:var(--brown);}
        .respcard.active{border-color:var(--navy); box-shadow:inset 0 0 0 1.5px var(--navy); background-color: var(--cream2);}
        .respicon{width:36px; height:36px; border-radius:10px; display:flex; align-items:center; justify-content:center; flex-shrink:0; font-size:15px;}
        .respicon.nos{background:var(--purple-bg); color:var(--purple);}
        .respicon.ellos{background:var(--warn-bg); color:var(--warn);}
        .respicon.venc{background:var(--info-bg); color:var(--info);}
        .respt{flex:1;}
        .respn{font-size:20px; font-weight:700; line-height:1;}
        .respn.nos{color:var(--purple);} .respn.ellos{color:var(--warn);} .respn.venc{color:var(--info);}
        .respl{font-size:11.5px; color:var(--sub); font-weight:600; margin-top:3px;}
        .resps{font-size:10.5px; color:var(--sub); margin-top:1px;}

        .gates{display:grid; gap:16px;}
        .gates.both{grid-template-columns:1fr 1fr;}
        .gates.solo{grid-template-columns:1fr;}

        .gate{background:#fff; border:1px solid var(--cream3); border-radius:16px; overflow:hidden; box-shadow:0 10px 26px rgba(20,25,30,0.06);}
        .gate-head{padding:15px 18px; border-bottom:2px solid var(--navy); display:flex; align-items:center; gap:12px; flex-wrap:wrap;}
        .gate-icon{width:38px; height:38px; border-radius:11px; display:flex; align-items:center; justify-content:center; flex-shrink:0;}
        .gate-icon.acceso{background:var(--info-bg); color:var(--info);}
        .gate-icon.pago{background:var(--gold-soft); color:var(--gold);}
        .gt{flex:1; min-width:150px;}
        .gate-head h2{font-size:15px; font-weight:600; margin:0;}
        .gate-head .gs{font-size:11.5px; color:var(--sub); margin-top:2px;}
        .tally{display:flex; gap:7px; flex-shrink:0;}
        .tal{text-align:center; padding:5px 11px; border-radius:9px; min-width:52px;}
        .tal .n{font-size:18px; font-weight:700; line-height:1;}
        .tal .l{font-size:9.5px; font-weight:600; letter-spacing:.3px; text-transform:uppercase; margin-top:3px;}
        .tal.block{background:var(--crit-bg); border:1px solid var(--crit-border);} .tal.block .n,.tal.block .l{color:var(--crit);}
        .tal.pass{background:var(--ok-bg); border:1px solid var(--ok-border);} .tal.pass .n,.tal.pass .l{color:var(--ok);}

        .ftools{display:flex; gap:10px; padding:12px 18px; border-bottom:1px solid var(--cream3); flex-wrap:wrap; align-items:center;}
        .search{position:relative; flex:1; min-width:190px;}
        .search input{width:100%; padding:8px 12px 8px 32px; border:1px solid var(--line); border-radius:9px; font-size:12.5px; font-family:inherit; background:var(--cream2); color:var(--navy); transition: all 0.12s;}
        .search input:focus{outline:none; border-color:var(--brown); background:#fff;}
        .search svg{position:absolute; left:10px; top:50%; transform:translateY(-50%); opacity:.45;}
        .fchips{display:flex; gap:5px; flex-wrap:wrap;}
        .fchip{border:1px solid var(--line); background:var(--cream2); color:var(--navy); font-size:11.5px; font-weight:600; padding:6px 12px; border-radius:18px; cursor:pointer; font-family:inherit;}
        .fchip.active{background:var(--navy); color:#fff; border-color:var(--navy);}

        .groupbar{padding:9px 18px; background:var(--cream2); font-size:10px; font-weight:700; letter-spacing:.6px; text-transform:uppercase; color:var(--sub); border-bottom:1px solid var(--cream3);}

        .glist{max-height:600px; overflow-y:auto;}
        .grow{display:flex; align-items:center; gap:11px; padding:12px 18px; border-bottom:1px solid var(--cream2); cursor:pointer; font-family: inherit;}
        .grow:hover,.grow.open{background:var(--cream2); opacity: 0.95;}
        .av{width:34px; height:34px; border-radius:10px; color:#fff; font-weight:700; font-size:11px; display:flex; align-items:center; justify-content:center; flex-shrink:0;}
        .gi{flex:1; min-width:0;}
        .gnrow{display:flex; align-items:center; gap:7px; flex-wrap:wrap;}
        .gn{font-size:13.2px; font-weight:600; color:var(--navy);}
        
        .rtag{font-size:9px; font-weight:700; padding:2px 7px; border-radius:5px; letter-spacing:.3px; white-space:nowrap;}
        .rtag.nos{background:var(--purple-bg); color:var(--purple); border:1px solid var(--purple-border);}
        .rtag.ellos{background:var(--warn-bg); color:var(--warn); border:1px solid var(--warn-border);}
        .gm{font-size:11.5px; margin-top:3px;}
        .gm.crit{color:var(--crit); font-weight:500;} .gm.ok{color:var(--sub);}

        .xcol{display:none; flex-shrink:0; text-align:center;}
        .solo .xcol{display:block;}
        .xcol .xv{font-size:12.5px; font-weight:700; color:var(--navy);}
        .xcol .xl{font-size:9.5px; color:var(--sub); font-weight:600; text-transform:uppercase; letter-spacing:.3px; margin-top:2px;}
        .xbar{width:64px; height:4px; background:var(--cream2); border-radius:3px; overflow:hidden; margin:4px auto 0;}
        .xbar i{display:block; height:100%; border-radius:3px;}
        .xbar i.ok{background:var(--ok);} .xbar i.crit{background:var(--crit);} .xbar i.warn{background:var(--warn);}

        /* next expiry column */
        .venc{flex-shrink:0; text-align:right; min-width:96px;}
        .vencd{font-size:11.5px; font-weight:700;}
        .vencd.soon{color:var(--crit);} .vencd.mid{color:var(--warn);} .vencd.far{color:var(--sub); font-weight:600;}
        .vencl{font-size:9.5px; color:var(--sub); margin-top:1px;}

        .st{font-size:10.5px; font-weight:700; padding:4px 10px; border-radius:7px; white-space:nowrap; flex-shrink:0;}
        .st.block{background:var(--crit-bg); color:var(--crit); border:1px solid var(--crit-border);}
        .st.pass{background:var(--ok-bg); color:var(--ok); border:1px solid var(--ok-border);}
        .chev{color:#b8b4a4; font-size:10px; flex-shrink:0; transition:transform .15s;}
        .grow.open .chev{transform:rotate(180deg);}

        .gdetail{padding:2px 18px 16px; background:var(--cream2); opacity: 0.98; border-bottom:1px solid var(--cream3);}
        .ddual{display:grid; gap:14px;}
        .solo .ddual{grid-template-columns:1fr 1fr;}
        .dsec{margin-top:11px;}
        .dsec h4{font-size:9.5px; font-weight:700; letter-spacing:.6px; text-transform:uppercase; color:var(--sub); margin:0 0 7px;}
        
        .req,.wrow{display:flex; align-items:center; gap:9px; padding:6px 10px; border-radius:8px; background:#fff; border:1px solid var(--cream3); margin-bottom:5px; font-size:12.3px;}
        .rd{width:7px; height:7px; border-radius:50%; flex-shrink:0;}
        .rd.ok{background:var(--ok);} .rd.crit{background:var(--crit);} .rd.warn{background:var(--warn);} .rd.info{background:var(--info);}
        .rn{flex:1; color:var(--navy);}
        .oblig{font-size:9px; font-weight:700; background:var(--gray-bg); color:var(--gray); padding:2px 6px; border-radius:4px;}
        .rs{font-size:11px; font-weight:600; color:var(--sub); white-space:nowrap;}
        .rs.crit{color:var(--crit);} .rs.warn{color:var(--warn);} .rs.ok{color:var(--ok);} .rs.info{color:var(--info);}
        .rvenc{font-size:10px; color:var(--sub); white-space:nowrap; min-width:74px; text-align:right;}
        .rvenc.soon{color:var(--crit); font-weight:600;}
        
        .wav{width:24px; height:24px; border-radius:50%; background:var(--navy2); color:#fff; font-size:9px; font-weight:700; display:flex; align-items:center; justify-content:center; flex-shrink:0;}
        
        .dact{display:flex; gap:7px; margin-top:11px; flex-wrap:wrap;}
        .btn-sm{padding:7px 13px; border-radius:8px; font-size:12px; font-weight:600; cursor:pointer; font-family:inherit; border:1px solid var(--line); background:#fff; color:var(--navy); transition: all 0.1s;}
        .btn-sm:hover{background:var(--navy); color:#fff; border-color:var(--navy);}
        .btn-sm.primary{background:var(--gold-soft); color:var(--gold); border-color:#ecdcb8;}
        .btn-sm.primary:hover{background:var(--gold); color:#fff;}
        
        .xhint{font-size:11px; color:var(--sub); padding:7px 10px; background:var(--gray-bg); border-radius:7px; margin-top:9px; display:none;}
        .solo .xhint{display:block;}
        .xhint b{color:var(--navy);}

        .note{max-width:1320px; margin:1.2rem auto 0; font-size:12px; color:var(--sub);}
        
        @media (max-width:1000px){
          .gates.both{grid-template-columns:1fr;}
          .solo .ddual{grid-template-columns:1fr;}
          .venc{display:none;}
        }
      `}</style>

      {/* TOAST ALERT */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-[9999] bg-navy text-cream border border-cream3 rounded-xl p-4 shadow-xl flex items-center gap-2.5 font-sans text-[13px] font-medium animate-slide-in">
          <CheckCircle size={18} className="text-green-500 shrink-0" />
          <span>{toast}</span>
        </div>
      )}

      {/* TOP BAND HEADER */}
      <div className="topband font-sans">
        <div className="wrap">
          <div className="ph">
            <div>
              <div className="eyebrow">Panel de administración</div>
              <h1>Habilitación de contratistas</h1>
              <p>Quién está habilitado para entrar a faena y para cursar estado de pago, y qué falta para desbloquear a cada uno.</p>
            </div>
            <select 
              value={filtroProyecto}
              onChange={(e) => setFiltroProyecto(e.target.value)}
              className="projsel"
            >
              {GLOBAL_PROYECTOS.map(p => (
                <option key={p.id} value={p.id}>{p.nombre}</option>
              ))}
            </select>
          </div>
          <div className="persp" id="persp">
            <button 
              onClick={() => { setCompuertaFiltro('ambas'); setRespFilter(null); }}
              className={compuertaFiltro === 'ambas' ? 'active' : ''}
            >
              Ambas compuertas
            </button>
            <button 
              onClick={() => { setCompuertaFiltro('acceso'); setRespFilter(null); }}
              className={compuertaFiltro === 'acceso' ? 'active' : ''}
            >
              Acceso a faena <span className="cnt font-mono">{processedCompanies.filter(pc => pc.acceso.estado === 'block').length}</span>
            </button>
            <button 
              onClick={() => { setCompuertaFiltro('pago'); setRespFilter(null); }}
              className={compuertaFiltro === 'pago' ? 'active' : ''}
            >
              Estado de pago <span className="cnt font-mono">{processedCompanies.filter(pc => pc.pago.estado === 'block').length}</span>
            </button>
          </div>
        </div>
      </div>

      {/* RESPOND BAR / KPI SUMMARY CARDS */}
      <div className="respbar" id="respbar">
        <div 
          onClick={() => handleKpiClick('nos')}
          className={`respcard ${respFilter === 'nos' ? 'active' : ''}`}
        >
          <div className="respicon nos">⏳</div>
          <div className="respt">
            <div className="respn nos font-mono font-bold">{countNos}</div>
            <div className="respl font-sans font-bold">Esperando revisión interna</div>
            <div className="resps font-sans">La acción es nuestra</div>
          </div>
        </div>

        <div 
          onClick={() => handleKpiClick('ellos')}
          className={`respcard ${respFilter === 'ellos' ? 'active' : ''}`}
        >
          <div className="respicon ellos">↗</div>
          <div className="respt">
            <div className="respn ellos font-mono font-bold">{countEllos}</div>
            <div className="respl font-sans font-bold">Esperando al contratista</div>
            <div className="resps font-sans">Falta que carguen o corrijan</div>
          </div>
        </div>

        <div 
          onClick={() => handleKpiClick('venc')}
          className={`respcard ${respFilter === 'venc' ? 'active' : ''}`}
        >
          <div className="respicon venc">⏱</div>
          <div className="respt">
            <div className="respn venc font-mono font-bold">{countVenc}</div>
            <div className="respl font-sans font-bold">Vencen en 30 días</div>
            <div className="resps font-sans">Bloquearán si no se renuevan</div>
          </div>
        </div>
      </div>

      {/* GATES GRID */}
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
      <p className="note font-sans text-gray-400 text-xs mt-4">
        {respFilter === 'nos' 
          ? 'Mostrando solo bloqueos que dependen de una revisión nuestra.' 
          : respFilter === 'ellos'
            ? 'Mostrando solo bloqueos que dependen de que el contratista cargue o corrija.'
            : 'Las dos compuertas son independientes: una empresa puede estar habilitada para entrar a faena y aun así tener el pago retenido.'}
      </p>

    </div>
  );
}
