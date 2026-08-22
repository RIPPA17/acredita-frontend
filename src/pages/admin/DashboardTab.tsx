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
  const MAX_ACTIVIDAD = 6;
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
    <div className="fade-in space-y-6 pb-10">
      
      {/* TOAST ALERT */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-[9999] bg-navy text-cream border border-cream3 rounded-xl p-4 shadow-xl flex items-center gap-2.5 font-sans text-[13px] font-medium animate-slide-in">
          <CheckCircle size={18} className="text-green-500 shrink-0" />
          <span>{toast}</span>
        </div>
      )}

      {/* HEADER */}
      <div className="page-header">
        <div>
          <h2 className="page-title text-navy font-bold text-[22px] font-sans">Centro de operaciones</h2>
          <p className="page-sub text-gray-500 text-[13.5px] font-sans">
            Monitoreo en tiempo real y resolución de incidencias operacionales.
          </p>
        </div>
      </div>

      {/* RESUMEN - 4 METRICS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="stat-mini">
          <div className="stat-mini-n">{mandantesCount}</div>
          <div className="stat-mini-l">Mandantes activos</div>
        </div>
        <div className="stat-mini">
          <div className="stat-mini-n">{GLOBAL_CONTRATISTAS.length}</div>
          <div className="stat-mini-l">Contratistas registrados</div>
        </div>
        <div className="stat-mini">
          <div className="stat-mini-n">{totalWorkers}</div>
          <div className="stat-mini-l">Trabajadores activos</div>
        </div>
        <div className="stat-mini">
          <div className="stat-mini-n" style={{ color: '#5a4a8a' }}>{pendingDocsCount}</div>
          <div className="stat-mini-l">Revisión pendiente</div>
        </div>
      </div>

      {/* ATENCIÓN REQUERIDA */}
      <div>
        <div className="flex justify-between items-end mb-3">
          <div>
            <h3 className="section-title mb-0 text-[16px] font-semibold text-navy">Atención requerida</h3>
            <p className="text-[11.5px] text-gray-500 mt-0.5">Problemas detectados que requieren tu intervención.</p>
          </div>
        </div>

        <div className="card p-4.5 bg-white border border-cream3 rounded-2xl shadow-sm">
          {incidencias.length > 0 ? (
            <div className="space-y-2">
              {incidencias.map((inc, i) => (
                <div key={i} className="flex items-center justify-between gap-4 p-3 rounded-xl bg-cream2/30 border border-cream3/60 hover:bg-[#FAF9F5] transition-all">
                  <div className="flex items-center gap-3">
                    <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                      inc.dotClass === 'red' ? 'bg-[#a3312f]' : inc.dotClass === 'orange' ? 'bg-[#8a5a10]' : 'bg-[#245a8a]'
                    }`}></span>
                    <div>
                      <div className="text-[13px] font-bold text-navy font-sans">{inc.title}</div>
                      <div className="text-[11px] text-gray-400 mt-0.5 font-sans">{inc.desc}</div>
                    </div>
                  </div>
                  <button 
                    onClick={inc.onClick}
                    className="text-[11px] font-extrabold text-brown hover:underline bg-transparent border-none cursor-pointer flex items-center gap-1 font-sans"
                  >
                    {inc.actionLabel} →
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center text-gray-400 text-[13.5px] italic font-sans">
              No hay incidencias que requieran atención actualmente. Todo al día.
            </div>
          )}
        </div>
      </div>

      {/* COLA PRIORITARIA */}
      <div>
        <div className="flex flex-wrap justify-between items-end gap-3 mb-3">
          <div>
            <h3 className="section-title mb-0 text-[16px] font-semibold text-navy">Cola prioritaria</h3>
            <p className="text-[11.5px] text-gray-500 mt-0.5">
              Validaciones documentales, alertas y correcciones unificadas y ordenadas por nivel de urgencia.
            </p>
          </div>
          <div className="flex gap-3.5 text-[11.5px] text-gray-500 font-sans font-medium">
            {(['critico', 'atencion', 'normal'] as Severidad[]).map(s => (
              <span key={s} className="flex items-center gap-1.5">
                <span className={`w-2.5 h-2.5 rounded-full ${s === 'critico' ? 'bg-[#a3312f]' : s === 'atencion' ? 'bg-[#8a5a10]' : 'bg-[#767467]'}`} />
                {SEV_LABEL[s]}
              </span>
            ))}
          </div>
        </div>

        <div className="card p-0 overflow-hidden bg-white border border-cream3 rounded-2xl shadow-sm">
          <div className="flex flex-wrap gap-2 px-4 py-3 border-b border-cream3 bg-gray-50/20">
            {filtros.map(f => (
              <button
                key={f.id}
                onClick={() => setFiltroCola(f.id)}
                className={`chip font-sans font-bold text-[11.5px] px-3.5 py-1.5 rounded-full border transition-all ${
                  filtroCola === f.id ? 'active' : ''
                }`}
              >
                {f.label} <span className="chip-count font-mono ml-1">{conteo[f.id]}</span>
              </button>
            ))}
          </div>

          {colaVisible.length > 0 ? (
            <div className="divide-y divide-cream">
              {colaVisible.map(item => (
                <div key={item.key} className="qrow flex items-center justify-between gap-4 p-4 hover:bg-[#FAF9F5] transition-colors">
                  <span className={`sev sev-${item.sev} text-[9.5px] font-extrabold uppercase px-2 py-0.5 rounded border tracking-wider shrink-0 w-16 text-center ${
                    item.sev === 'critico' ? 'bg-[#fbe8e8] text-[#932d2d] border-[#f7cfcf]' :
                    item.sev === 'atencion' ? 'bg-[#faf0dc] text-[#8a5a10] border-[#eecd94]' :
                    'bg-[#f1efe6] text-[#767467] border-gray-300'
                  }`}>
                    {SEV_LABEL[item.sev]}
                  </span>
                  
                  <div className="flex-1 min-w-0 font-sans">
                    <div className="text-[13px] font-bold text-navy truncate font-sans">
                      {item.empresa} — {item.documento}
                    </div>
                    <div className="text-[11.5px] text-gray-500 truncate font-sans" title={item.meta}>
                      {item.meta}
                    </div>
                  </div>

                  <span className={`text-[11px] font-mono shrink-0 hidden sm:block w-20 text-right ${
                    item.tiempo === 'Vencido' || item.tiempo === 'Corrección' ? 'text-[#a3312f] font-bold' : 'text-gray-400'
                  }`}>
                    {item.tiempo}
                  </span>

                  <button 
                    onClick={item.onAccion} 
                    className="px-3.5 py-1.5 border border-cream3 bg-white hover:bg-navy hover:text-cream rounded-lg text-[12px] font-bold text-navy cursor-pointer transition-all shrink-0 font-sans shadow-sm"
                  >
                    {item.accion}
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center text-gray-400 text-[13.5px] italic font-sans">
              {filtroCola === 'todos' ? 'No hay nada pendiente. Todo al día.' : `No hay registros en la categoría "${SEV_LABEL[filtroCola as Severidad]}".`}
            </div>
          )}
        </div>
      </div>

      {/* ACTIVIDAD RECIENTE */}
      <div>
        <div className="flex flex-wrap justify-between items-end gap-3 mb-3">
          <div>
            <h3 className="section-title mb-0 text-[16px] font-semibold text-navy">Actividad reciente</h3>
            <p className="text-[11.5px] text-gray-500 mt-0.5">Últimos eventos registrados en la operación.</p>
          </div>
          <select
            value={filtroActividad}
            onChange={(e) => setFiltroActividad(e.target.value)}
            className="form-input text-[11.5px] py-1 px-2.5 w-auto bg-white border border-cream3 rounded-lg focus:outline-none focus:border-brown font-sans font-bold text-navy"
          >
            <option value="todos">Todos los estados</option>
            <option value="revision">En revisión</option>
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
                    className="arow cursor-pointer flex items-center justify-between gap-4 p-3.5 hover:bg-[#FAF9F5] transition-colors"
                    onClick={() => setActividadSeleccionada(a)}
                  >
                    <span className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center font-extrabold text-[10px] shrink-0 border border-blue-100">
                      {initials}
                    </span>
                    <span className="font-bold text-navy text-[13px] w-[170px] shrink-0 truncate">{a.empresa}</span>
                    <span className="flex-1 text-gray-600 text-[12.5px] truncate font-sans" title={a.detalle || a.documento}>
                      {a.documento}{a.detalle ? ` · ${a.detalle}` : ''}
                    </span>
                    <span className={`text-[10px] font-extrabold rounded-lg px-2 py-0.5 border uppercase tracking-wider shrink-0 ${
                      estado === 'aprobado' ? 'bg-[#e2f5e9] text-[#1c6b30] border-[#bee7ce]' :
                      estado === 'rechazado' ? 'bg-[#fbe8e8] text-[#932d2d] border-[#f7cfcf]' :
                      'bg-[#faf0dc] text-[#8a5a10] border-[#eecd94]'
                    }`}>
                      {estado}
                    </span>
                    <span className="text-[11.5px] text-gray-400 shrink-0 text-right whitespace-nowrap w-20 font-mono">{a.hora || a.fecha}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-8 text-center text-gray-400 text-[13.5px] italic font-sans">No hay actividad con este estado.</div>
          )}
          {actividadFiltrada.length > MAX_ACTIVIDAD && (
            <div className="px-4 py-2.5 text-[11px] text-gray-400 border-t border-cream bg-gray-50/20 text-center font-sans">
              Mostrando {MAX_ACTIVIDAD} de {actividadFiltrada.length} eventos recientes · Haz clic en "Auditoría" en el menú para ver el historial completo.
            </div>
          )}
        </div>
      </div>

      <div className="text-[10px] text-gray-400 text-right font-sans">Acredita · Panel de Administración · 21/08/2026</div>

    </div>
  );
}
