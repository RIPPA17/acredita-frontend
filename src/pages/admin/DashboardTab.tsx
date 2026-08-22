import { useState, useEffect } from 'react';
import {
  ArrowRight,
  Clock,
  CheckCircle,
  AlertTriangle,
  Briefcase,
  Layers
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
      onAccion: () => setActiveTab('acreditaciones'),
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
      onAccion: () => setActiveTab('acreditaciones'),
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

  const colaVisible = filtroCola === 'todos' ? itemsCola : itemsCola.filter(i => i.sev === filtroCola);
  const MAX_COLA = 5;
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
  const actividadFiltrada = ACTIVIDAD_RECIENTE.filter(
    a => filtroActividad === 'todos' || normalizarEstado(a.estado) === filtroActividad
  );
  const MAX_ACTIVIDAD = 4;
  const actividadVisible = actividadFiltrada.slice(0, MAX_ACTIVIDAD);

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

  return (
    <div className="fade-in space-y-5 pb-6">
      
      {/* TOAST ALERT */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-[9999] bg-navy text-cream border border-cream3 rounded-xl p-4 shadow-xl flex items-center gap-2.5 font-sans text-[13px] font-medium animate-slide-in">
          <CheckCircle size={18} className="text-green-500 shrink-0" />
          <span>{toast}</span>
        </div>
      )}

      {/* HEADER */}
      <div className="page-header mb-3">
        <div>
          <h2 className="page-title text-navy font-bold text-[20px] font-sans">Centro de operaciones</h2>
          <p className="page-sub text-gray-500 text-[13px] font-sans mt-0.5">
            Monitoreo en tiempo real y resolución de incidencias operacionales.
          </p>
        </div>
      </div>

      {/* TWO-COLUMN LAYOUT */}
      <div className="grid grid-cols-1 xl:grid-cols-[1.8fr_1fr] gap-4 items-start">
        
        {/* COLUMN LEFT: MAIN ACTION ITEMS */}
        <div className="space-y-5">
          
          {/* ATENCIÓN REQUERIDA */}
          <div>
            <h3 className="section-title text-[14.5px] font-semibold text-navy mb-2">Atención requerida</h3>
            <div className="card p-3 bg-white border border-cream3 rounded-2xl shadow-sm">
              {incidencias.length > 0 ? (
                <div className="space-y-2">
                  {incidencias.map((inc, i) => (
                    <div key={i} className="flex items-center justify-between gap-4 p-2.5 rounded-xl bg-cream2/30 border border-cream3/60 hover:bg-[#FAF9F5] transition-all">
                      <div className="flex items-center gap-2.5">
                        <span className={`w-2 h-2 rounded-full shrink-0 ${
                          inc.dotClass === 'red' ? 'bg-[#a3312f]' : inc.dotClass === 'orange' ? 'bg-[#8a5a10]' : 'bg-[#245a8a]'
                        }`}></span>
                        <div>
                          <div className="text-[12.5px] font-bold text-navy font-sans">{inc.title}</div>
                          <div className="text-[10.5px] text-gray-400 font-sans mt-0.5">{inc.desc}</div>
                        </div>
                      </div>
                      <button 
                        onClick={inc.onClick}
                        className="text-[10.5px] font-extrabold text-brown hover:underline bg-transparent border-none cursor-pointer flex items-center gap-0.5 font-sans whitespace-nowrap"
                      >
                        {inc.actionLabel} →
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-6 text-center text-gray-400 text-[12.5px] italic font-sans">
                  No hay incidencias que requieran atención actualmente. Todo al día.
                </div>
              )}
            </div>
          </div>

          {/* COLA PRIORITARIA */}
          <div>
            <div className="flex flex-wrap justify-between items-end gap-3 mb-2">
              <div>
                <h3 className="section-title text-[14.5px] font-semibold text-navy mb-0">Cola prioritaria</h3>
              </div>
              <div className="flex gap-2 text-[10.5px] text-gray-400 font-sans font-medium">
                {(['critico', 'atencion', 'normal'] as Severidad[]).map(s => (
                  <span key={s} className="flex items-center gap-1">
                    <span className={`w-2 h-2 rounded-full ${s === 'critico' ? 'bg-[#a3312f]' : s === 'atencion' ? 'bg-[#8a5a10]' : 'bg-[#767467]'}`} />
                    {SEV_LABEL[s]}
                  </span>
                ))}
              </div>
            </div>

            <div className="card p-0 overflow-hidden bg-white border border-cream3 rounded-2xl shadow-sm">
              <div className="flex flex-wrap gap-2 px-3 py-2 border-b border-cream3 bg-gray-50/20">
                {filtros.map(f => (
                  <button
                    key={f.id}
                    onClick={() => setFiltroCola(f.id)}
                    className={`chip font-sans font-bold text-[11px] px-3 py-1 rounded-full border transition-all ${
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
                      <span className={`sev sev-${item.sev} text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded border tracking-wider shrink-0 w-14 text-center ${
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
                        <div className="text-[11px] text-gray-500 truncate font-sans" title={item.meta}>
                          {item.meta}
                        </div>
                      </div>

                      <span className={`text-[10.5px] font-mono shrink-0 hidden sm:block w-16 text-right ${
                        item.tiempo === 'Vencido' || item.tiempo === 'Corrección' ? 'text-[#a3312f] font-bold' : 'text-gray-400'
                      }`}>
                        {item.tiempo}
                      </span>

                      <button 
                        onClick={item.onAccion} 
                        className="px-2.5 py-1 border border-cream3 bg-white hover:bg-navy hover:text-cream rounded-md text-[11px] font-bold text-navy cursor-pointer transition-all shrink-0 font-sans shadow-sm"
                      >
                        {item.accion}
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-6 text-center text-gray-400 text-[12.5px] italic font-sans">
                  {filtroCola === 'todos' ? 'No hay nada pendiente. Todo al día.' : `No hay registros en la categoría "${SEV_LABEL[filtroCola as Severidad]}".`}
                </div>
              )}

              {colaVisible.length > MAX_COLA && (
                <div className="px-3.5 py-2.5 border-t border-cream bg-gray-50/10 flex justify-between items-center text-[11px] text-gray-500 font-sans">
                  <span>Mostrando {MAX_COLA} de {colaVisible.length} registros pendientes</span>
                  <button 
                    onClick={() => setActiveTab('cola')}
                    className="text-brown font-extrabold hover:underline bg-transparent border-none cursor-pointer flex items-center gap-0.5"
                  >
                    Ver bandeja completa ({colaVisible.length}) →
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* COLUMN RIGHT: STATS & ACTIVITY */}
        <div className="space-y-5">
          
          {/* STATS - 4 COMPACT HORIZONTAL CARDS */}
          <div>
            <h3 className="section-title text-[14.5px] font-semibold text-navy mb-2">Indicadores</h3>
            <div className="grid grid-cols-1 gap-2.5">
              
              {/* Card 1: Mandantes */}
              <div className="flex items-center justify-between p-3 bg-white border border-cream3 rounded-2xl shadow-sm">
                <span className="text-[12px] font-bold text-gray-500 font-sans">Mandantes activos</span>
                <span className="text-[16px] font-extrabold text-navy font-mono bg-blue-50 text-blue-700 w-8 h-6 flex items-center justify-center rounded-lg">{mandantesCount}</span>
              </div>

              {/* Card 2: Contratistas */}
              <div className="flex items-center justify-between p-3 bg-white border border-cream3 rounded-2xl shadow-sm">
                <span className="text-[12px] font-bold text-gray-500 font-sans">Contratistas registrados</span>
                <span className="text-[16px] font-extrabold text-navy font-mono bg-orange-50 text-orange-700 w-8 h-6 flex items-center justify-center rounded-lg">{GLOBAL_CONTRATISTAS.length}</span>
              </div>

              {/* Card 3: Trabajadores */}
              <div className="flex items-center justify-between p-3 bg-white border border-cream3 rounded-2xl shadow-sm">
                <span className="text-[12px] font-bold text-gray-500 font-sans">Trabajadores activos</span>
                <span className="text-[16px] font-extrabold text-navy font-mono bg-green-50 text-green-700 w-12 h-6 flex items-center justify-center rounded-lg">{totalWorkers}</span>
              </div>

              {/* Card 4: Revision pendiente */}
              <div className="flex items-center justify-between p-3 bg-white border border-cream3 rounded-2xl shadow-sm">
                <span className="text-[12px] font-bold text-gray-500 font-sans">Revisión pendiente</span>
                <span className="text-[16px] font-extrabold text-navy font-mono bg-purple-50 text-purple-700 w-8 h-6 flex items-center justify-center rounded-lg">{pendingDocsCount}</span>
              </div>

            </div>
          </div>

          {/* ACTIVIDAD RECIENTE */}
          <div>
            <div className="flex justify-between items-end mb-2">
              <h3 className="section-title text-[14.5px] font-semibold text-navy mb-0">Actividad reciente</h3>
              <select
                value={filtroActividad}
                onChange={(e) => setFiltroActividad(e.target.value)}
                className="form-input text-[10.5px] py-0.5 px-2 w-auto bg-white border border-cream3 rounded-lg focus:outline-none focus:border-brown font-sans font-bold text-navy"
              >
                <option value="todos">Todos</option>
                <option value="revision">Revisión</option>
                <option value="aprobado">Aprobado</option>
                <option value="rechazado">Rechazado</option>
                <option value="registrado">Registrado</option>
              </select>
            </div>

            <div className="card p-0 overflow-hidden bg-white border border-cream3 rounded-2xl shadow-sm">
              {actividadVisible.length > 0 ? (
                <div className="divide-y divide-cream font-sans">
                  {actividadVisible.map(a => {
                    const estado = normalizarEstado(a.estado);
                    const initials = getInitials(a.empresa);
                    return (
                      <div
                        key={a.id}
                        className="arow cursor-pointer flex items-center gap-2.5 p-2.5 hover:bg-[#FAF9F5] transition-colors"
                        onClick={() => setActividadSeleccionada(a)}
                      >
                        <span className="w-6 h-6 rounded-md bg-blue-50 text-blue-700 flex items-center justify-center font-extrabold text-[9px] shrink-0 border border-blue-100">
                          {initials}
                        </span>
                        <div className="flex-1 min-w-0 font-sans">
                          <div className="font-bold text-navy text-[12px] truncate">{a.empresa}</div>
                          <div className="text-gray-500 text-[10.5px] truncate font-sans">{a.documento}</div>
                        </div>
                        <span className={`text-[8.5px] font-extrabold rounded-md px-1.5 py-0.5 border uppercase tracking-wider shrink-0 ${
                          estado === 'aprobado' ? 'bg-[#e2f5e9] text-[#1c6b30] border-[#bee7ce]' :
                          estado === 'rechazado' ? 'bg-[#fbe8e8] text-[#932d2d] border-[#f7cfcf]' :
                          'bg-[#faf0dc] text-[#8a5a10] border-[#eecd94]'
                        }`}>
                          {estado}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-6 text-center text-gray-400 text-[12.5px] italic font-sans">No hay actividad.</div>
              )}
              {actividadFiltrada.length > MAX_ACTIVIDAD && (
                <div className="px-3.5 py-2.5 border-t border-cream bg-gray-50/10 flex justify-between items-center text-[10.5px] text-gray-400 font-sans">
                  <span>Mostrando {MAX_ACTIVIDAD} de {actividadFiltrada.length} eventos</span>
                  <button 
                    onClick={() => setActiveTab('auditoria')}
                    className="text-brown font-extrabold hover:underline bg-transparent border-none cursor-pointer flex items-center gap-0.5 text-[10.5px]"
                  >
                    Ver auditoría ({actividadFiltrada.length}) →
                  </button>
                </div>
              )}
            </div>
          </div>

        </div>

      </div>

      <div className="text-[10px] text-gray-400 text-right font-sans pt-2">Acredita · Panel de Administración · 21/08/2026</div>

    </div>
  );
}
