import { useState, useEffect } from 'react';
import {
  ArrowRight,
  Clock,
  CheckCircle,
  AlertTriangle,
  Briefcase,
  Layers,
  ShieldAlert
} from 'lucide-react';
import {
  getAlertasVigencia,
  getMandantes,
  getInvitaciones,
  calcularEstadoAcreditacion,
  calcularEstadoTrabajador
} from '../../data/localStorageDb';
import { Contratista, Proyecto } from '../../types';
import { buildColaDocs } from './colaUtils';

type Severidad = 'critico' | 'atencion' | 'normal';

type ItemCola = {
  key: string;
  sev: Severidad;
  empresa: string;
  documento: string;
  meta: string;
  tiempo: string;
  accion: string;
  onAccion: () => void;
  sortOrder: number;
};

const SEV_LABEL: Record<Severidad, string> = {
  critico: 'Crítico',
  atencion: 'Atención',
  normal: 'Normal',
};

export default function DashboardTab({
  GLOBAL_CONTRATISTAS,
  GLOBAL_PROYECTOS,
  setActiveTab,
  aprobadosHoy,
  rechazadosHoy,
  setSelectedDocId,
  filtroActividad,
  setFiltroActividad,
  ACTIVIDAD_RECIENTE,
  setActividadSeleccionada,
  setSelectedAcreditacionContratista,
}: {
  GLOBAL_CONTRATISTAS: Contratista[];
  GLOBAL_PROYECTOS: Proyecto[];
  setActiveTab: (v: string) => void;
  aprobadosHoy: number;
  rechazadosHoy: number;
  setSelectedDocId: (id: number | null) => void;
  filtroActividad: string;
  setFiltroActividad: (v: string) => void;
  ACTIVIDAD_RECIENTE: any[];
  setActividadSeleccionada: (v: any) => void;
  setSelectedAcreditacionContratista?: (c: any) => void;
}) {
  const [filtroCola, setFiltroCola] = useState<'todos' | Severidad>('todos');
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const triggerToast = (msg: string) => {
    setToast(msg);
  };

  const dynamicCola = buildColaDocs(GLOBAL_CONTRATISTAS, GLOBAL_PROYECTOS);
  const alertas = getAlertasVigencia();

  // 1. Dynamic Metric Calculations
  const mandantesCount = getMandantes().length;
  
  const blockedCount = GLOBAL_CONTRATISTAS.filter(c => {
    const pId = c.proyectos[0];
    return calcularEstadoAcreditacion(c, pId) === 'Vencido/Bloqueado';
  }).length;

  const inProcessCount = GLOBAL_CONTRATISTAS.filter(c => {
    const pId = c.proyectos[0];
    return calcularEstadoAcreditacion(c, pId) === 'En proceso';
  }).length;

  const accreditedCount = GLOBAL_CONTRATISTAS.filter(c => {
    const pId = c.proyectos[0];
    return calcularEstadoAcreditacion(c, pId) === 'Aprobado';
  }).length;

  const totalWorkers = GLOBAL_CONTRATISTAS.reduce((acc, c) => acc + (c.trabajadores?.length || 0), 0);
  const pendingDocsCount = dynamicCola.length;

  // 2. Scan for actual rejected documents
  let rejectedDocsCount = 0;
  const waitingCorrectionList: any[] = [];
  GLOBAL_CONTRATISTAS.forEach(c => {
    (c.documentos || []).forEach(d => {
      if (d.estado === 'rechazado') {
        rejectedDocsCount++;
        const pId = d.proyectoId || c.proyectos[0] || 'costanera';
        const project = GLOBAL_PROYECTOS.find(p => p.id === pId);
        waitingCorrectionList.push({
          id: d.id,
          empresa: c.nombre,
          proyecto: project ? project.nombre : 'Proyecto no asignado',
          documento: d.nombre,
          motivo: d.explicacionRechazo || d.motivoRechazo || 'Rechazado'
        });
      }
    });

    (c.trabajadores || []).forEach(w => {
      (w.documentos || []).forEach(d => {
        if (d.estado === 'rechazado') {
          rejectedDocsCount++;
          const pId = d.proyectoId || c.proyectos[0] || 'costanera';
          const project = GLOBAL_PROYECTOS.find(p => p.id === pId);
          waitingCorrectionList.push({
            id: d.id,
            empresa: c.nombre,
            proyecto: project ? project.nombre : 'Proyecto no asignado',
            documento: `${d.nombre} (${w.nombre})`,
            motivo: d.explicacionRechazo || d.motivoRechazo || 'Rechazado'
          });
        }
      });
    });
  });

  // 3. Scan for actual expired and warning documents
  const expiredDocsCount = alertas.filter(a => a.diasRestantes < 0).length;
  const expiringSoonDocsCount = alertas.filter(a => a.diasRestantes >= 0 && a.diasRestantes <= 30).length;
  const pendingInvitations = getInvitaciones().filter(inv => inv.estado === 'pendiente').length;

  // 4. Assemble the Unified priority queue
  const itemsCola: ItemCola[] = [];

  // A. Pending reviews
  dynamicCola.forEach(d => {
    const isUrgente = d.prio === 'Alta';
    itemsCola.push({
      key: `cola-${d.id}`,
      sev: isUrgente ? 'critico' : 'normal',
      empresa: d.emp,
      documento: d.title,
      meta: `${d.proyecto} · esperando revisión${d.origen === 'Trabajador' ? ` · ${d.trabajadorNombre}` : ''}`,
      tiempo: d.time || 'hace unas horas',
      accion: 'Revisar',
      onAccion: () => { setSelectedDocId(d.id); setActiveTab('cola'); },
      sortOrder: isUrgente ? 10 : 200
    });
  });

  // B. Alerts
  alertas.forEach(a => {
    const isVencido = a.diasRestantes < 0;
    const isUrgente = a.diasRestantes <= 7;
    const isAtencion = a.diasRestantes > 7 && a.diasRestantes <= 30;

    itemsCola.push({
      key: `alerta-${a.id}`,
      sev: isVencido || isUrgente ? 'critico' : isAtencion ? 'atencion' : 'normal',
      empresa: a.empresaNombre,
      documento: a.documentoNombre,
      meta: [
        a.proyectoNombre,
        isVencido ? `vencido el ${a.vencimiento}` : `vence en ${a.diasRestantes} días`,
        a.trabajadorNombre,
        a.bloquea ? 'bloquea faena' : null
      ].filter(Boolean).join(' · '),
      tiempo: isVencido ? 'Vencido' : `${a.diasRestantes} d`,
      accion: 'Ver',
      onAccion: () => {
        if (setSelectedAcreditacionContratista) {
          const cObj = GLOBAL_CONTRATISTAS.find(c => c.nombre === a.empresaNombre);
          if (cObj) setSelectedAcreditacionContratista(cObj);
        }
        setActiveTab('acreditaciones');
      },
      sortOrder: isVencido ? -100 : a.diasRestantes
    });
  });

  // C. Rejected documents awaiting correction
  waitingCorrectionList.forEach(w => {
    itemsCola.push({
      key: `correccion-${w.id}`,
      sev: 'atencion',
      empresa: w.empresa,
      documento: w.documento,
      meta: `${w.proyecto} · rechazado: ${w.motivo}`,
      tiempo: 'Corrección',
      accion: 'Ver',
      onAccion: () => {
        if (setSelectedAcreditacionContratista) {
          const cObj = GLOBAL_CONTRATISTAS.find(c => c.nombre === w.empresa);
          if (cObj) setSelectedAcreditacionContratista(cObj);
        }
        setActiveTab('acreditaciones');
      },
      sortOrder: 150
    });
  });

  // Sort queue by severity (critico -> atencion -> normal) and sortOrder
  const ordenSev: Record<Severidad, number> = { critico: 0, atencion: 1, normal: 2 };
  itemsCola.sort((a, b) => {
    if (ordenSev[a.sev] !== ordenSev[b.sev]) {
      return ordenSev[a.sev] - ordenSev[b.sev];
    }
    return a.sortOrder - b.sortOrder;
  });

  const conteo = {
    todos: itemsCola.length,
    critico: itemsCola.filter(i => i.sev === 'critico').length,
    atencion: itemsCola.filter(i => i.sev === 'atencion').length,
    normal: itemsCola.filter(i => i.sev === 'normal').length,
  };

  const totalCount = GLOBAL_CONTRATISTAS.length || 1;
  const healthPercent = Math.round((accreditedCount / totalCount) * 100);

  const colaVisible = filtroCola === 'todos' ? itemsCola : itemsCola.filter(i => i.sev === filtroCola);
  const MAX_COLA = 4;
  const colaPaginada = colaVisible.slice(0, MAX_COLA);

  // 5. Gather real actionable issues for the "Atención requerida" panel
  const incidencias: Array<{
    dotClass: 'red' | 'orange' | 'blue';
    title: string;
    desc: string;
    actionLabel: string;
    onClick: () => void;
  }> = [];

  if (blockedCount > 0) {
    incidencias.push({
      dotClass: 'red',
      title: `${blockedCount} contratistas bloqueados`,
      desc: 'Presentan incumplimientos de compuerta que suspenden su acceso a faena.',
      actionLabel: 'Ver contratistas',
      onClick: () => setActiveTab('acreditaciones')
    });
  }

  if (rejectedDocsCount > 0) {
    incidencias.push({
      dotClass: 'red',
      title: `${rejectedDocsCount} documentos rechazados`,
      desc: 'Esperan una nueva carga o corrección por parte del contratista.',
      actionLabel: 'Ver contratistas',
      onClick: () => setActiveTab('acreditaciones')
    });
  }

  if (expiredDocsCount > 0) {
    incidencias.push({
      dotClass: 'red',
      title: `${expiredDocsCount} documentos vencidos`,
      desc: 'Documentos obligatorios cuya vigencia ha caducado.',
      actionLabel: 'Ver alertas',
      onClick: () => setActiveTab('acreditaciones')
    });
  }

  if (expiringSoonDocsCount > 0) {
    incidencias.push({
      dotClass: 'orange',
      title: `${expiringSoonDocsCount} documentos próximos a vencer`,
      desc: 'Avisos de expiración dentro de los próximos 30 días.',
      actionLabel: 'Ver alertas',
      onClick: () => setActiveTab('acreditaciones')
    });
  }

  if (pendingInvitations > 0) {
    incidencias.push({
      dotClass: 'blue',
      title: `${pendingInvitations} invitaciones pendientes`,
      desc: 'Contratistas registrados que aún no aceptan su invitación de registro.',
      actionLabel: 'Ver invitaciones',
      onClick: () => setActiveTab('contratistas')
    });
  }

  // 6. Recent Activity
  const normalizarEstado = (e: unknown) => String(e ?? '').toLowerCase();
  
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

  const filtros: Array<{ id: 'todos' | Severidad; label: string }> = [
    { id: 'todos', label: 'Todos' },
    { id: 'critico', label: 'Críticos' },
    { id: 'atencion', label: 'Atención' },
    { id: 'normal', label: 'Normal' },
  ];

  const mockCasosDecision = [
    { id: 1, empresa: 'TécnicoSur SpA', documento: 'Certificado ODI', proyecto: 'Torre Mackenna', detalle: 'Excepción de firma notarial para trabajador extranjero' },
    { id: 2, empresa: 'Constructora del Sol', documento: 'Certificado Antecedentes', proyecto: 'Planta Solar', detalle: 'Discrepancia en validación de firma digital homologada' },
    { id: 3, empresa: 'Eléctrica del Sur', documento: 'Examen de Altura Física', proyecto: 'Torre Mackenna', detalle: 'Criterio de vigencia de examen médico extranjero' },
    { id: 4, empresa: 'Lagos y Cía', documento: 'Declaración jurada F30', proyecto: 'Costanera Norte', detalle: 'Revisión de cláusula de responsabilidad solidaria' },
  ];

  const handleRevisarCaso = (nombreEmpresa: string) => {
    if (setSelectedAcreditacionContratista) {
      const cObj = GLOBAL_CONTRATISTAS.find(c => c.nombre.toLowerCase().includes(nombreEmpresa.toLowerCase().split(' ')[0]));
      if (cObj) setSelectedAcreditacionContratista(cObj);
    }
    setActiveTab('acreditaciones');
  };

  return (
    <div className="fade-in space-y-4 pb-6 max-w-[1300px] mx-auto w-full px-1">
      
      {/* TOAST ALERT */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-[9999] bg-navy text-cream border border-cream3 rounded-xl p-4 shadow-xl flex items-center gap-2.5 font-sans text-[13px] font-medium animate-slide-in">
          <CheckCircle size={18} className="text-green-500 shrink-0" />
          <span>{toast}</span>
        </div>
      )}

      {/* HEADER */}
      <div className="flex flex-wrap justify-between items-start gap-4">
        <div>
          <div className="text-[10px] uppercase font-extrabold tracking-widest text-brown mb-1 font-sans">Inicio · Administración</div>
          <h1 className="text-[20px] font-extrabold text-navy leading-none font-sans">Resumen de Acredita</h1>
          <p className="text-[12.5px] text-gray-500 mt-1.5 leading-relaxed font-sans">
            Estado general de mandantes, contratistas, acreditaciones y documentación.
          </p>
        </div>
      </div>

      {/* FIRST DUAL BLOCK: ATTENTION REQUIRED & HEALTH */}
      <div className="grid grid-cols-1 xl:grid-cols-[1.65fr_1fr] gap-4 items-start">
        
        {/* ATTENTION REQUIRED */}
        <div className="card bg-white border border-cream3 rounded-2xl overflow-hidden shadow-sm flex flex-col justify-between font-sans">
          <div className="p-3.5 px-4.5 border-b border-cream3 flex justify-between items-center bg-gray-50/20">
            <div>
              <h3 className="text-[14px] font-bold text-navy m-0 font-sans">Atención requerida</h3>
              <p className="text-[11px] text-gray-400 m-0 mt-0.5 font-sans font-medium">Lo más importante para resolver ahora.</p>
            </div>
            <span className="text-[10.5px] font-bold bg-[#fbe8e8] text-[#932d2d] rounded-full px-2.5 py-0.5 border border-[#f7cfcf] font-sans">
              {incidencias.length} incidencias
            </span>
          </div>

          <div className="p-3.5 space-y-2 flex-1 flex flex-col justify-center">
            {incidencias.length > 0 ? (
              incidencias.map((inc, i) => (
                <div key={i} className="flex items-center justify-between gap-4 p-2.5 rounded-xl bg-[#FAF9F5] border border-cream3/60 hover:border-brown transition-all">
                  <div className="flex items-center gap-2.5">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${
                      inc.dotClass === 'red' ? 'bg-[#a3312f]' : inc.dotClass === 'orange' ? 'bg-[#8a5a10]' : 'bg-[#245a8a]'
                    }`}></span>
                    <div>
                      <div className="text-[12.5px] font-bold text-navy font-sans">{inc.title}</div>
                      <div className="text-[10.5px] text-gray-400 mt-0.5 font-sans">{inc.desc}</div>
                    </div>
                  </div>
                  <button 
                    onClick={inc.onClick}
                    className="text-[10.5px] font-extrabold text-brown hover:underline bg-transparent border-none cursor-pointer flex items-center gap-0.5 font-sans whitespace-nowrap"
                  >
                    {inc.actionLabel} →
                  </button>
                </div>
              ))
            ) : (
              <div className="p-8 text-center text-gray-400 text-[12.5px] italic font-sans">
                No hay incidencias críticas pendientes de revisión. Todo al día.
              </div>
            )}
          </div>
        </div>

        {/* HEALTH & MAIN KPIS */}
        <div className="space-y-4">
          
          {/* HEALTH BAR */}
          <div className="card bg-white border border-cream3 rounded-2xl overflow-hidden shadow-sm flex flex-col justify-between font-sans">
            <div className="p-3.5 px-4.5 border-b border-cream3 bg-gray-50/20">
              <h3 className="text-[14px] font-bold text-navy m-0 font-sans">Salud de acreditación</h3>
              <p className="text-[11px] text-gray-400 m-0 mt-0.5 font-sans font-medium">Contratistas activos.</p>
            </div>
            <div className="p-3.5 flex flex-col gap-3 font-sans">
              <div className="flex justify-between items-end font-sans">
                <span className="text-[26px] font-black text-[#2f6b32] font-mono leading-none">{healthPercent}%</span>
                <span className="text-[11px] text-gray-400 font-bold uppercase tracking-wider font-sans">acreditados</span>
              </div>
              
              <div className="w-full h-2 bg-[#f1efe6] rounded-full overflow-hidden shrink-0">
                <div className="bg-[#2f6b32] h-full rounded-full transition-all duration-500" style={{ width: `${healthPercent}%` }}></div>
              </div>

              <div className="space-y-1.5 mt-1 font-sans text-[12px]">
                <div className="flex justify-between font-medium border-b border-cream/35 pb-1 font-sans">
                  <span className="text-gray-500 flex items-center gap-1.5 font-sans">
                    <span className="w-2 h-2 rounded-full bg-[#2f6b32]"></span> Acreditados
                  </span>
                  <span className="font-bold text-navy font-mono">{accreditedCount}</span>
                </div>
                <div className="flex justify-between font-medium border-b border-cream/35 pb-1 font-sans">
                  <span className="text-gray-500 flex items-center gap-1.5 font-sans">
                    <span className="w-2 h-2 rounded-full bg-[#8a5a10]"></span> En proceso
                  </span>
                  <span className="font-bold text-navy font-mono">{inProcessCount}</span>
                </div>
                <div className="flex justify-between font-medium font-sans">
                  <span className="text-gray-500 flex items-center gap-1.5 font-sans">
                    <span className="w-2 h-2 rounded-full bg-[#a3312f]"></span> Bloqueados
                  </span>
                  <span className="font-bold text-navy font-mono">{blockedCount}</span>
                </div>
              </div>
            </div>
          </div>

          {/* COMPACT MAIN KPIS LIST */}
          <div className="card p-3.5 bg-white border border-cream3 rounded-2xl shadow-sm space-y-2">
            <h4 className="text-[10.5px] font-bold text-gray-400 uppercase tracking-wider mb-1 font-sans">Indicadores generales</h4>
            <div className="flex justify-between items-center py-1 border-b border-cream/20 text-[12px]">
              <span className="text-gray-500 font-sans">Mandantes activos</span>
              <span className="font-bold text-navy font-mono bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-[11px]">{mandantesCount}</span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-cream/20 text-[12px]">
              <span className="text-gray-500 font-sans">Contratistas registrados</span>
              <span className="font-bold text-navy font-mono bg-orange-50 text-orange-700 px-2 py-0.5 rounded text-[11px]">{GLOBAL_CONTRATISTAS.length}</span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-cream/20 text-[12px]">
              <span className="text-gray-500 font-sans">Trabajadores activos</span>
              <span className="font-bold text-navy font-mono bg-green-50 text-green-700 px-2 py-0.5 rounded text-[11px]">{totalWorkers}</span>
            </div>
            <div className="flex justify-between items-center py-1 text-[12px]">
              <span className="text-gray-500 font-sans">Revisión pendiente</span>
              <span className="font-bold text-navy font-mono bg-purple-50 text-purple-700 px-2 py-0.5 rounded text-[11px]">{dynamicCola.length}</span>
            </div>
          </div>

        </div>

      </div>

      {/* SECOND DUAL BLOCK: COLA PRIORITARIA & ACCESOS / ACTIVIDAD */}
      <div className="grid grid-cols-1 xl:grid-cols-[1.65fr_1fr] gap-4 items-start">
        
        {/* COLA PRIORITARIA */}
        <div className="card p-0 overflow-hidden bg-white border border-cream3 rounded-2xl shadow-sm font-sans flex flex-col justify-between">
          <div className="p-3.5 px-4.5 border-b border-cream3 flex flex-wrap justify-between items-center bg-gray-50/20 gap-2">
            <div>
              <h3 className="text-[14px] font-bold text-navy m-0 font-sans">Cola prioritaria</h3>
              <p className="text-[11px] text-gray-400 m-0 mt-0.5 font-sans font-medium">Validaciones y alertas en orden de urgencia.</p>
            </div>
            <div className="flex gap-2 text-[10px] text-gray-400 font-sans font-medium">
              {(['critico', 'atencion', 'normal'] as Severidad[]).map(s => (
                <span key={s} className="flex items-center gap-1">
                  <span className={`w-1.5 h-1.5 rounded-full ${s === 'critico' ? 'bg-[#a3312f]' : s === 'atencion' ? 'bg-[#8a5a10]' : 'bg-[#767467]'}`} />
                  {SEV_LABEL[s]}
                </span>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5 px-3 py-2 border-b border-cream3 bg-gray-50/10">
            {filtros.map(f => (
              <button
                key={f.id}
                onClick={() => setFiltroCola(f.id)}
                className={`chip font-sans font-bold text-[10.5px] px-2.5 py-1 rounded-full border transition-all ${
                  filtroCola === f.id ? 'active' : ''
                }`}
              >
                {f.label} <span className="chip-count font-mono ml-1">{conteo[f.id]}</span>
              </button>
            ))}
          </div>

          {colaPaginada.length > 0 ? (
            <div className="divide-y divide-cream">
              {colaPaginada.map(item => (
                <div key={item.key} className="qrow flex items-center justify-between gap-3 p-3 hover:bg-[#FAF9F5] transition-colors">
                  <span className={`sev sev-${item.sev} text-[8.5px] font-extrabold uppercase px-1.5 py-0.5 rounded border tracking-wider shrink-0 w-14 text-center ${
                    item.sev === 'critico' ? 'bg-[#fbe8e8] text-[#932d2d] border-[#f7cfcf]' :
                    item.sev === 'atencion' ? 'bg-[#faf0dc] text-[#8a5a10] border-[#eecd94]' :
                    'bg-[#f1efe6] text-[#767467] border-gray-300'
                  }`}>
                    {SEV_LABEL[item.sev]}
                  </span>
                  
                  <div className="flex-1 min-w-0 font-sans">
                    <div className="text-[12.5px] font-bold text-navy truncate font-sans">
                      {item.empresa} — {item.documento}
                    </div>
                    <div className="text-[10.5px] text-gray-400 truncate font-sans" title={item.meta}>
                      {item.meta}
                    </div>
                  </div>

                  <span className={`text-[10px] font-mono shrink-0 hidden sm:block w-16 text-right ${
                    item.tiempo === 'Vencido' || item.tiempo === 'Corrección' ? 'text-[#a3312f] font-bold' : 'text-gray-400'
                  }`}>
                    {item.tiempo}
                  </span>

                  <button 
                    onClick={item.onAccion} 
                    className="px-2.5 py-1.5 border border-cream3 bg-white hover:bg-navy hover:text-cream rounded-lg text-[10.5px] font-bold text-navy cursor-pointer transition-all shrink-0 font-sans shadow-sm"
                  >
                    {item.accion}
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center text-gray-400 text-[12.5px] italic font-sans">
              No hay nada pendiente con el filtro seleccionado.
            </div>
          )}

          {colaVisible.length > MAX_COLA && (
            <div className="px-3.5 py-2.5 border-t border-cream bg-gray-50/10 flex justify-between items-center text-[10.5px] text-gray-400 font-sans">
              <span>Mostrando {MAX_COLA} de {colaVisible.length} registros</span>
              <button 
                onClick={() => setActiveTab('cola')}
                className="text-brown font-extrabold hover:underline bg-transparent border-none cursor-pointer flex items-center gap-0.5 text-[10.5px]"
              >
                Ver bandeja completa ({colaVisible.length}) →
              </button>
            </div>
          )}
        </div>

        {/* ACCESOS & DAILY KPIS */}
        <div className="space-y-4">
          
          {/* QUICK TILES */}
          <div className="card bg-white border border-cream3 rounded-2xl overflow-hidden shadow-sm flex flex-col justify-between font-sans">
            <div className="p-3.5 px-4.5 border-b border-cream3 bg-gray-50/20">
              <h3 className="text-[14px] font-bold text-navy m-0 font-sans">Accesos rápidos</h3>
              <p className="text-[11px] text-gray-400 m-0 mt-0.5 font-sans font-medium">Tareas frecuentes.</p>
            </div>
            <div className="p-3.5 grid grid-cols-2 gap-2 font-sans justify-center">
              <button 
                onClick={() => setActiveTab('cola')}
                className="border border-cream3 bg-white rounded-xl p-3 text-left cursor-pointer hover:border-brown hover:bg-[#FAF9F5] transition-all flex flex-col justify-between min-h-[72px] font-sans shadow-sm"
              >
                <b className="text-[11.5px] text-navy font-bold flex items-center gap-1 font-sans"><CheckCircle size={12} className="text-gray-400" /> Revisar docs</b>
                <span className="text-[10px] text-gray-400 font-sans mt-1">{dynamicCola.length} pendientes</span>
              </button>
              <button 
                onClick={() => setActiveTab('acreditaciones')}
                className="border border-cream3 bg-white rounded-xl p-3 text-left cursor-pointer hover:border-brown hover:bg-[#FAF9F5] transition-all flex flex-col justify-between min-h-[72px] font-sans shadow-sm"
              >
                <b className="text-[11.5px] text-navy font-bold flex items-center gap-1 font-sans"><Layers size={12} className="text-gray-400" /> Contratistas</b>
                <span className="text-[10px] text-gray-400 font-sans mt-1">{blockedCount} bloqueados</span>
              </button>
              <button 
                onClick={() => setActiveTab('mandantes')}
                className="border border-cream3 bg-white rounded-xl p-3 text-left cursor-pointer hover:border-brown hover:bg-[#FAF9F5] transition-all flex flex-col justify-between min-h-[72px] font-sans shadow-sm"
              >
                <b className="text-[11.5px] text-navy font-bold flex items-center gap-1 font-sans"><Briefcase size={12} className="text-gray-400" /> Ver proyectos</b>
                <span className="text-[10px] text-gray-400 font-sans mt-1">{GLOBAL_PROYECTOS.length} activos</span>
              </button>
              <button 
                onClick={() => setActiveTab('auditoria')}
                className="border border-cream3 bg-white rounded-xl p-3 text-left cursor-pointer hover:border-brown hover:bg-[#FAF9F5] transition-all flex flex-col justify-between min-h-[72px] font-sans shadow-sm"
              >
                <b className="text-[11.5px] text-navy font-bold flex items-center gap-1 font-sans"><Clock size={12} className="text-gray-400" /> Auditoría</b>
                <span className="text-[10px] text-gray-400 font-sans mt-1">Actividad</span>
              </button>
            </div>
          </div>

          {/* COMPACT DAILY KPIS */}
          <div className="card p-3.5 bg-white border border-cream3 rounded-2xl shadow-sm space-y-2">
            <h4 className="text-[10.5px] font-bold text-gray-400 uppercase tracking-wider mb-1 font-sans">Actividad de hoy</h4>
            <div className="flex justify-between items-center py-1 border-b border-cream/20 text-[12px]">
              <span className="text-gray-500 font-sans">Esperando corrección</span>
              <span className="font-bold text-navy font-mono bg-red-50 text-red-700 px-2 py-0.5 rounded text-[11px]">{waitingCorrectionList.length}</span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-cream/20 text-[12px]">
              <span className="text-gray-500 font-sans">Casos en seguimiento</span>
              <span className="font-bold text-navy font-mono bg-amber-50 text-amber-700 px-2 py-0.5 rounded text-[11px]">{inProcessCount}</span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-cream/20 text-[12px]">
              <span className="text-gray-500 font-sans">Aprobados hoy</span>
              <span className="font-bold text-navy font-mono bg-green-50 text-green-700 px-2 py-0.5 rounded text-[11px]">{aprobadosHoy}</span>
            </div>
            <div className="flex justify-between items-center py-1 text-[12px]">
              <span className="text-gray-500 font-sans">Rechazados hoy</span>
              <span className="font-bold text-navy font-mono bg-red-50 text-red-700 px-2 py-0.5 rounded text-[11px]">{rechazadosHoy}</span>
            </div>
          </div>

        </div>

      </div>

      {/* FULL WIDTH BLOCK: REQUIEREN DECISIÓN */}
      <div className="card border border-cream3 shadow-sm bg-white font-sans p-0 overflow-hidden">
        <div className="p-3.5 px-4.5 border-b border-cream3 bg-gray-50/20">
          <h3 className="text-[14px] font-bold text-navy m-0 font-sans flex items-center gap-2">
            <ShieldAlert size={16} className="text-[#a32d2d]" />
            Requieren decisión
          </h3>
          <p className="text-[11px] text-gray-400 m-0 mt-0.5 font-sans font-medium">Casos complejos escalados al Jefe de Verificadores.</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-none shadow-none rounded-none m-0">
            <thead>
              <tr className="border-b border-cream3">
                <th className="p-3 px-4.5 bg-gray-50/30 text-gray-500 text-[11.5px] font-bold uppercase tracking-wider">Caso / Empresa</th>
                <th className="p-3 bg-gray-50/30 text-gray-500 text-[11.5px] font-bold uppercase tracking-wider">Proyecto / Documento</th>
                <th className="p-3 bg-gray-50/30 text-gray-500 text-[11.5px] font-bold uppercase tracking-wider">Detalle</th>
                <th className="p-3 bg-gray-50/30 text-gray-500 text-[11.5px] font-bold uppercase tracking-wider text-center">Estado</th>
                <th className="p-3 px-4.5 bg-gray-50/30 text-gray-500 text-[11.5px] font-bold uppercase tracking-wider text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cream">
              {mockCasosDecision.map(caso => (
                <tr key={caso.id} className="hover:bg-gray-50/40 text-[12.5px] font-sans">
                  <td className="p-3 px-4.5 font-sans">
                    <div className="font-bold text-navy">{caso.empresa}</div>
                  </td>
                  <td className="p-3 font-sans text-gray-600">
                    <div>{caso.proyecto}</div>
                    <div className="text-[11px] text-gray-400 mt-0.5">{caso.documento}</div>
                  </td>
                  <td className="p-3 font-sans text-gray-500 max-w-[280px] truncate" title={caso.detalle}>
                    {caso.detalle}
                  </td>
                  <td className="p-3 font-sans text-center">
                    <span className="badge bg-[#faf0dc] text-[#8a5a10] border border-[#eecd94] text-[9.5px] font-bold uppercase px-2 py-0.5 rounded">
                      Escalado
                    </span>
                  </td>
                  <td className="p-3 px-4.5 font-sans text-right">
                    <button
                      onClick={() => handleRevisarCaso(caso.empresa)}
                      className="px-2.5 py-1 border border-cream3 bg-white hover:bg-navy hover:text-cream rounded-md text-[10.5px] font-bold text-navy cursor-pointer transition-all font-sans shadow-sm"
                    >
                      Revisar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="text-[10px] text-gray-400 text-right font-sans pt-2">Acredita · Panel de Administración · 21/08/2026</div>

    </div>
  );
}
