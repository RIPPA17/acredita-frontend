import { useState, useEffect } from 'react';
import {
  ArrowRight,
  ShieldAlert,
  Clock,
  CheckCircle,
  AlertTriangle,
  Briefcase,
  Layers
} from 'lucide-react';
import {
  getAlertasVigencia,
  getMandantes,
  calcularEstadoAcreditacion,
  calcularEstadoTrabajador
} from '../../data/localStorageDb';
import { Contratista, Proyecto } from '../../types';
import { buildColaDocs } from './colaUtils';

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

  // 1. Calculate active statistics dynamically
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

  let activeWorkersCount = 0;
  let approvedWorkersCount = 0;
  GLOBAL_CONTRATISTAS.forEach(c => {
    (c.trabajadores || []).forEach(w => {
      activeWorkersCount++;
      const pIds = c.proyectos;
      const isApproved = pIds.some(pId => calcularEstadoTrabajador(w, pId) === 'aprobado');
      if (isApproved) approvedWorkersCount++;
    });
  });

  const workersVigentesPercent = activeWorkersCount > 0 
    ? Math.round((approvedWorkersCount / activeWorkersCount) * 100) 
    : 94;

  const pendingInvitations = GLOBAL_CONTRATISTAS.filter(c => c.proyectos.length === 0).length || 6;

  // 2. Setup Unified correction items
  const waitingCorrectionList: any[] = [];
  GLOBAL_CONTRATISTAS.forEach(c => {
    c.documentos.forEach(d => {
      if (d.estado === 'rechazado') {
        const pId = c.proyectos[0] || 'costanera';
        const project = GLOBAL_PROYECTOS.find(p => p.id === pId);

        waitingCorrectionList.push({
          id: d.id,
          empresa: c.nombre,
          rut: c.rut,
          proyecto: project ? project.nombre : 'Faena Costanera',
          documento: d.nombre,
          motivo: d.motivo || 'Firma digital no legible en el anexo 2.',
          intentos: 2,
          fecha: d.vencimiento || '12-05-2026'
        });
      }
    });
  });

  const alertas = getAlertasVigencia();

  // 3. Health & progress stats
  const totalCount = GLOBAL_CONTRATISTAS.length || 1;
  const healthPercent = Math.round((accreditedCount / totalCount) * 100);

  // 4. Document queue preview
  const revisionDocs = dynamicCola.slice(0, 4);

  // 5. Normalise Activity feed
  const normalizarEstado = (e: unknown) => String(e ?? '').toLowerCase();
  const actividadFiltrada = ACTIVIDAD_RECIENTE.filter(
    a => filtroActividad === 'todos' || normalizarEstado(a.estado) === filtroActividad
  );
  const MAX_ACTIVIDAD = 3;
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

  return (
    <div className="fade-in space-y-6 pb-10">
      
      {/* TOAST ALERT */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-[9999] bg-navy text-cream border border-cream3 rounded-xl p-4 shadow-xl flex items-center gap-2.5 font-sans text-[13px] font-medium animate-slide-in">
          <CheckCircle size={18} className="text-green-500 shrink-0" />
          <span>{toast}</span>
        </div>
      )}

      {/* HEADER SECTION */}
      <div className="flex flex-wrap justify-between items-start gap-4">
        <div>
          <div className="text-[10px] uppercase font-extrabold tracking-widest text-brown mb-1 font-sans">Inicio · Administración</div>
          <h1 className="text-[24px] font-extrabold text-navy leading-none font-sans">Resumen de Acredita</h1>
          <p className="text-[13px] text-gray-500 mt-1.5 leading-relaxed font-sans">
            Estado general de mandantes, contratistas, acreditaciones y documentación.
          </p>
        </div>
        <div className="flex gap-2 font-sans">
          <button 
            onClick={() => triggerToast("Reporte exportado exitosamente (módulo en desarrollo)")}
            className="btn btn-ghost border border-cream3 rounded-xl font-bold bg-white text-navy hover:bg-navy hover:text-white px-4 py-2 text-[12.5px] cursor-pointer"
          >
            Exportar reporte
          </button>
          <button 
            onClick={() => triggerToast("Flujo de creación de nueva empresa iniciado (módulo en desarrollo)")}
            className="px-4 py-2 bg-brown text-white rounded-xl text-[12.5px] font-bold cursor-pointer hover:bg-brown/90 transition-all border-none shadow-sm"
          >
            + Nueva empresa
          </button>
        </div>
      </div>

      {/* METRICS ROW */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-4.5 bg-white border border-cream3 rounded-2xl flex flex-col justify-between shadow-sm">
          <div className="flex justify-between items-center">
            <span className="text-[11.5px] font-bold text-gray-400 uppercase tracking-wider font-sans">Mandantes activos</span>
            <span className="w-8 h-8 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center font-bold text-[13px]">M</span>
          </div>
          <div className="text-[26px] font-extrabold text-navy mt-2 leading-none font-sans font-mono">{mandantesCount}</div>
          <div className="text-[10.5px] text-gray-400 mt-1.5 font-sans font-medium">+2 durante el último mes</div>
        </div>

        <div className="card p-4.5 bg-white border border-cream3 rounded-2xl flex flex-col justify-between shadow-sm">
          <div className="flex justify-between items-center">
            <span className="text-[11.5px] font-bold text-gray-400 uppercase tracking-wider font-sans">Contratistas</span>
            <span className="w-8 h-8 rounded-xl bg-orange-50 text-orange-700 flex items-center justify-center font-bold text-[13px]">C</span>
          </div>
          <div className="text-[26px] font-extrabold text-navy mt-2 leading-none font-sans font-mono">{GLOBAL_CONTRATISTAS.length}</div>
          <div className="text-[10.5px] text-gray-400 mt-1.5 font-sans font-medium">{blockedCount} con incumplimientos</div>
        </div>

        <div className="card p-4.5 bg-white border border-cream3 rounded-2xl flex flex-col justify-between shadow-sm">
          <div className="flex justify-between items-center">
            <span className="text-[11.5px] font-bold text-gray-400 uppercase tracking-wider font-sans">Trabajadores</span>
            <span className="w-8 h-8 rounded-xl bg-green-50 text-green-700 flex items-center justify-center font-bold text-[13px]">T</span>
          </div>
          <div className="text-[26px] font-extrabold text-navy mt-2 leading-none font-sans font-mono">{totalWorkers}</div>
          <div className="text-[10.5px] text-gray-400 mt-1.5 font-sans font-medium">{workersVigentesPercent}% con documentación vigente</div>
        </div>

        <div className="card p-4.5 bg-white border border-cream3 rounded-2xl flex flex-col justify-between shadow-sm">
          <div className="flex justify-between items-center">
            <span className="text-[11.5px] font-bold text-gray-400 uppercase tracking-wider font-sans">Revisión pendiente</span>
            <span className="w-8 h-8 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center font-bold text-[13px]">!</span>
          </div>
          <div className="text-[26px] font-extrabold text-navy mt-2 leading-none font-sans font-mono">{dynamicCola.length}</div>
          <div className="text-[10.5px] text-gray-400 mt-1.5 font-sans font-medium">{dynamicCola.filter(d => d.prio === 'Alta').length} son prioridad alta</div>
        </div>
      </div>

      {/* HERO DUAL GRID: ATTENTION REQUIRED & ACCREDITATION HEALTH */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        
        {/* ATTENTION REQUIRED CARD */}
        <div className="card bg-white border border-cream3 rounded-2xl overflow-hidden shadow-sm lg:col-span-2 flex flex-col justify-between font-sans">
          <div className="p-4 px-5 border-b border-cream3 flex justify-between items-center bg-gray-50/20">
            <div>
              <h3 className="text-[14.5px] font-bold text-navy m-0 font-sans">Atención requerida</h3>
              <p className="text-[11.5px] text-gray-400 m-0 mt-0.5 font-sans">Lo más importante para resolver ahora.</p>
            </div>
            <span className="text-[10.5px] font-bold bg-[#fbe8e8] text-[#932d2d] rounded-full px-2.5 py-0.5 border border-[#f7cfcf] font-sans">
              {blockedCount + waitingCorrectionList.length + alertas.length + pendingInvitations} incidencias
            </span>
          </div>

          <div className="p-4.5 space-y-3.5 flex-1 flex flex-col justify-center">
            {/* INCIDENCIA 1: CONTRATISTAS BLOQUEADOS */}
            <div className="flex items-center justify-between gap-4 p-3 rounded-xl bg-[#FAF9F5] border border-cream3 hover:border-brown transition-all shadow-inner/5">
              <div className="flex items-center gap-3">
                <span className="w-2.5 h-2.5 rounded-full bg-[#a3312f] shrink-0"></span>
                <div>
                  <div className="text-[13px] font-bold text-navy font-sans">{blockedCount} contratistas bloqueados</div>
                  <div className="text-[11px] text-gray-400 mt-0.5 font-sans">Podrían afectar acceso o continuidad operacional en obra.</div>
                </div>
              </div>
              <button 
                onClick={() => setActiveTab('acreditaciones')} 
                className="text-[11.5px] font-extrabold text-brown hover:underline bg-transparent border-none cursor-pointer flex items-center gap-1 font-sans"
              >
                Gestionar <ArrowRight size={13} />
              </button>
            </div>

            {/* INCIDENCIA 2: DOCUMENTOS RECHAZADOS */}
            <div className="flex items-center justify-between gap-4 p-3 rounded-xl bg-[#FAF9F5] border border-cream3 hover:border-brown transition-all shadow-inner/5">
              <div className="flex items-center gap-3">
                <span className="w-2.5 h-2.5 rounded-full bg-[#a3312f] shrink-0"></span>
                <div>
                  <div className="text-[13px] font-bold text-navy font-sans">{waitingCorrectionList.length} documentos rechazados</div>
                  <div className="text-[11px] text-gray-400 mt-0.5 font-sans">Esperan una nueva carga o corrección por parte del contratista.</div>
                </div>
              </div>
              <button 
                onClick={() => setActiveTab('acreditaciones')} 
                className="text-[11.5px] font-extrabold text-brown hover:underline bg-transparent border-none cursor-pointer flex items-center gap-1 font-sans"
              >
                Revisar <ArrowRight size={13} />
              </button>
            </div>

            {/* INCIDENCIA 3: DOCUMENTOS PRÓXIMOS A VENCER */}
            <div className="flex items-center justify-between gap-4 p-3 rounded-xl bg-[#FAF9F5] border border-cream3 hover:border-brown transition-all shadow-inner/5">
              <div className="flex items-center gap-3">
                <span className="w-2.5 h-2.5 rounded-full bg-[#8a5a10] shrink-0"></span>
                <div>
                  <div className="text-[13px] font-bold text-navy font-sans">{alertas.length} alertas de vencimiento</div>
                  <div className="text-[11px] text-gray-400 mt-0.5 font-sans">Documentos que vencen dentro de los próximos 30 días.</div>
                </div>
              </div>
              <button 
                onClick={() => setActiveTab('acreditaciones')} 
                className="text-[11.5px] font-extrabold text-brown hover:underline bg-transparent border-none cursor-pointer flex items-center gap-1 font-sans"
              >
                Ver <ArrowRight size={13} />
              </button>
            </div>

            {/* INCIDENCIA 4: INVITACIONES PENDIENTES */}
            <div className="flex items-center justify-between gap-4 p-3 rounded-xl bg-[#FAF9F5] border border-cream3 hover:border-brown transition-all shadow-inner/5">
              <div className="flex items-center gap-3">
                <span className="w-2.5 h-2.5 rounded-full bg-[#245a8a] shrink-0"></span>
                <div>
                  <div className="text-[13px] font-bold text-navy font-sans">{pendingInvitations} invitaciones pendientes</div>
                  <div className="text-[11px] text-gray-400 mt-0.5 font-sans">Contratistas registrados que aún no aceptan la invitación.</div>
                </div>
              </div>
              <button 
                onClick={() => setActiveTab('contratistas')} 
                className="text-[11.5px] font-extrabold text-brown hover:underline bg-transparent border-none cursor-pointer flex items-center gap-1 font-sans"
              >
                Gestionar <ArrowRight size={13} />
              </button>
            </div>
          </div>
        </div>

        {/* ACCREDITATION HEALTH CHART */}
        <div className="card bg-white border border-cream3 rounded-2xl overflow-hidden shadow-sm flex flex-col justify-between font-sans">
          <div className="p-4 px-5 border-b border-cream3 bg-gray-50/20">
            <h3 className="text-[14.5px] font-bold text-navy m-0 font-sans">Salud de acreditación</h3>
            <p className="text-[11.5px] text-gray-400 m-0 mt-0.5 font-sans">Estado global de los contratistas activos.</p>
          </div>
          <div className="p-5 flex-1 flex flex-col justify-between gap-4 font-sans">
            <div className="flex justify-between items-end font-sans">
              <span className="text-[32px] font-black text-[#2f6b32] font-mono leading-none">{healthPercent}%</span>
              <span className="text-[12px] text-gray-400 font-bold uppercase tracking-wider font-sans">acreditados</span>
            </div>
            
            {/* Progress bar */}
            <div className="w-full h-2.5 bg-[#f1efe6] rounded-full overflow-hidden shrink-0">
              <div className="bg-[#2f6b32] h-full rounded-full transition-all duration-500" style={{ width: `${healthPercent}%` }}></div>
            </div>

            {/* Legend list */}
            <div className="space-y-2 mt-2 font-sans">
              <div className="flex justify-between text-[12.5px] font-medium border-b border-cream/35 pb-1.5 font-sans">
                <span className="text-gray-500 flex items-center gap-2 font-sans">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#2f6b32]"></span> Acreditados
                </span>
                <span className="font-bold text-navy font-mono">{accreditedCount}</span>
              </div>
              <div className="flex justify-between text-[12.5px] font-medium border-b border-cream/35 pb-1.5 font-sans">
                <span className="text-gray-500 flex items-center gap-2 font-sans">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#8a5a10]"></span> En proceso
                </span>
                <span className="font-bold text-navy font-mono">{inProcessCount}</span>
              </div>
              <div className="flex justify-between text-[12.5px] font-medium font-sans">
                <span className="text-gray-500 flex items-center gap-2 font-sans">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#a3312f]"></span> Bloqueados
                </span>
                <span className="font-bold text-navy font-mono">{blockedCount}</span>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* DUAL GRID: REVISION TABLE & QUICK ACTIONS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        
        {/* REVISIÓN DOCUMENTAL TABLE */}
        <div className="card bg-white border border-cream3 rounded-2xl overflow-hidden shadow-sm lg:col-span-2 flex flex-col justify-between font-sans">
          <div className="p-4 px-5 border-b border-cream3 flex justify-between items-center bg-gray-50/20">
            <div>
              <h3 className="text-[14.5px] font-bold text-navy m-0 font-sans">Revisión documental</h3>
              <p className="text-[11.5px] text-gray-400 m-0 mt-0.5 font-sans">Documentos recientes que esperan decisión de auditoría.</p>
            </div>
            <button 
              onClick={() => setActiveTab('cola')}
              className="text-[11px] font-extrabold text-brown hover:underline bg-transparent border-none cursor-pointer flex items-center gap-1 font-sans"
            >
              Ver bandeja completa <ArrowRight size={12} />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-[12px] border-collapse font-sans">
              <thead>
                <tr className="bg-cream2 text-navy font-bold uppercase tracking-wider text-[9.5px] border-b border-cream3">
                  <th className="p-3.5 px-5">Empresa</th>
                  <th className="p-3.5">Documento</th>
                  <th className="p-3.5">Proyecto</th>
                  <th className="p-3.5 px-5 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-cream">
                {revisionDocs.length > 0 ? (
                  revisionDocs.map(d => {
                    const c = GLOBAL_CONTRATISTAS.find(c => c.nombre === d.emp);
                    const rut = c ? c.rut : '—';
                    const isUrgente = d.prio === 'Alta';

                    return (
                      <tr key={d.id} className="hover:bg-gray-50/40 font-sans">
                        <td className="p-3.5 px-5">
                          <div className="font-bold text-navy text-[13px] font-sans">{d.emp}</div>
                          <div className="text-[10.5px] text-gray-400 font-mono mt-0.5">RUT: {rut}</div>
                        </td>
                        <td className="p-3.5 text-gray-600 font-sans">{d.title}</td>
                        <td className="p-3.5 text-gray-500 font-sans">{d.proyecto}</td>
                        <td className="p-3.5 px-5 text-right font-sans">
                          <button
                            onClick={() => {
                              setSelectedDocId(d.id);
                              setActiveTab('cola');
                            }}
                            className={`text-[10.5px] font-extrabold uppercase px-3 py-1.5 rounded-lg border transition-all cursor-pointer font-sans shadow-sm ${
                              isUrgente
                                ? 'bg-[#fbe8e8] text-[#932d2d] border-[#f7cfcf] hover:bg-[#932d2d] hover:text-white'
                                : 'bg-[#efecdf] text-navy border-brown/20 hover:bg-navy hover:text-white'
                            }`}
                          >
                            Revisar
                          </button>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={4} className="p-8 text-center text-gray-400 italic font-sans">
                      No hay documentos pendientes de revisión en cola.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* QUICK ACCESSES CARD */}
        <div className="card bg-white border border-cream3 rounded-2xl overflow-hidden shadow-sm flex flex-col justify-between font-sans">
          <div className="p-4 px-5 border-b border-cream3 bg-gray-50/20">
            <h3 className="text-[14.5px] font-bold text-navy m-0 font-sans">Accesos rápidos</h3>
            <p className="text-[11.5px] text-gray-400 m-0 mt-0.5 font-sans">Tareas frecuentes del administrador.</p>
          </div>
          <div className="p-4.5 grid grid-cols-2 gap-3 flex-1 font-sans justify-center">
            <button 
              onClick={() => setActiveTab('cola')}
              className="border border-cream3 bg-white rounded-xl p-3.5 text-left cursor-pointer hover:border-brown hover:bg-[#FAF9F5] transition-all flex flex-col justify-between min-h-[85px] font-sans shadow-sm"
            >
              <b className="text-[12px] text-navy font-bold flex items-center gap-1.5 font-sans"><CheckCircle size={13} className="text-gray-400" /> Revisar docs</b>
              <span className="text-[10.5px] text-gray-400 font-sans mt-2">{dynamicCola.length} pendientes</span>
            </button>
            <button 
              onClick={() => setActiveTab('acreditaciones')}
              className="border border-cream3 bg-white rounded-xl p-3.5 text-left cursor-pointer hover:border-brown hover:bg-[#FAF9F5] transition-all flex flex-col justify-between min-h-[85px] font-sans shadow-sm"
            >
              <b className="text-[12px] text-navy font-bold flex items-center gap-1.5 font-sans"><Layers size={13} className="text-gray-400" /> Contratistas</b>
              <span className="text-[10.5px] text-gray-400 font-sans mt-2">{blockedCount} bloqueados</span>
            </button>
            <button 
              onClick={() => setActiveTab('mandantes')}
              className="border border-cream3 bg-white rounded-xl p-3.5 text-left cursor-pointer hover:border-brown hover:bg-[#FAF9F5] transition-all flex flex-col justify-between min-h-[85px] font-sans shadow-sm"
            >
              <b className="text-[12px] text-navy font-bold flex items-center gap-1.5 font-sans"><Briefcase size={13} className="text-gray-400" /> Ver proyectos</b>
              <span className="text-[10.5px] text-gray-400 font-sans mt-2">{GLOBAL_PROYECTOS.length} activos</span>
            </button>
            <button 
              onClick={() => setActiveTab('auditoria')}
              className="border border-cream3 bg-white rounded-xl p-3.5 text-left cursor-pointer hover:border-brown hover:bg-[#FAF9F5] transition-all flex flex-col justify-between min-h-[85px] font-sans shadow-sm"
            >
              <b className="text-[12px] text-navy font-bold flex items-center gap-1.5 font-sans"><Clock size={13} className="text-gray-400" /> Auditoría</b>
              <span className="text-[10.5px] text-gray-400 font-sans mt-2">Actividad reciente</span>
            </button>
          </div>
        </div>

      </div>

      {/* RECENT ACTIVITY CARD */}
      <div className="card bg-white border border-cream3 rounded-2xl overflow-hidden shadow-sm font-sans">
        <div className="p-4 px-5 border-b border-cream3 flex justify-between items-center bg-gray-50/20">
          <div>
            <h3 className="text-[14.5px] font-bold text-navy m-0 font-sans">Actividad reciente</h3>
            <p className="text-[11.5px] text-gray-400 m-0 mt-0.5 font-sans">Últimos eventos registrados en la plataforma.</p>
          </div>
          <button 
            onClick={() => setActiveTab('auditoria')}
            className="text-[11px] font-extrabold text-brown hover:underline bg-transparent border-none cursor-pointer flex items-center gap-1 font-sans"
          >
            Ver auditoría completa <ArrowRight size={12} />
          </button>
        </div>
        
        <div className="p-4 px-5 divide-y divide-cream">
          {actividadVisible.map(a => {
            const estado = normalizarEstado(a.estado);
            const initials = getInitials(a.empresa);
            return (
              <div 
                key={a.id} 
                onClick={() => setActividadSeleccionada(a)}
                className="flex items-center gap-4 py-3 hover:bg-gray-50/30 cursor-pointer transition-colors"
              >
                <div className="w-[30px] h-[30px] rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center font-extrabold text-[10px] shrink-0 border border-blue-100 font-sans">
                  {initials}
                </div>
                <div className="flex-1 min-w-0 font-sans">
                  <p className="text-[12.5px] m-0 text-navy font-sans">
                    <strong>{a.empresa}</strong> · {a.documento} {a.detalle ? ` · ${a.detalle}` : ''}
                  </p>
                </div>
                <span className={`text-[10px] font-extrabold rounded-lg px-2 py-0.5 border uppercase tracking-wider ${
                  estado === 'aprobado' ? 'bg-[#e2f5e9] text-[#1c6b30] border-[#bee7ce]' :
                  estado === 'rechazado' ? 'bg-[#fbe8e8] text-[#932d2d] border-[#f7cfcf]' :
                  'bg-[#faf0dc] text-[#8a5a10] border-[#eecd94]'
                }`}>
                  {estado}
                </span>
                <span className="text-[11px] text-gray-400 w-16 text-right shrink-0 font-mono">{a.hora || a.fecha}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="text-[10px] text-gray-400 text-right font-sans">Acredita · Panel de Administración · 21/08/2026</div>

    </div>
  );
}
