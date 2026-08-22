import { useState } from 'react';
import { ArrowRight, ShieldAlert, Clock, Building2, Users, HardHat, ClipboardList } from 'lucide-react';
import { getAlertasVigencia, getInvitaciones, calcularEstadoAcreditacion } from '../../data/localStorageDb';
import { Contratista, Proyecto } from '../../types';
import { buildColaDocs } from './colaUtils';
import { GLOBAL_MANDANTES } from './globalData';

/**
 * One severity taxonomy for the whole dashboard. Everything that used to be
 * labelled "Alta prioridad", "Crítica", "Atención", "urgente" or "Bloquea
 * faena" now maps onto exactly these three levels.
 */
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
  showToast,
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
  showToast?: (msg: string, type?: 'success' | 'error' | 'warning') => void;
}) {
  const [filtroCola, setFiltroCola] = useState<'todos' | Severidad>('todos');

  const dynamicCola = buildColaDocs(GLOBAL_CONTRATISTAS, GLOBAL_PROYECTOS);

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

  const mockCasosSeguimiento = [
    { id: "seg-1", empresa: "TécnicoSur SpA", proyecto: "Torre Mackenna", detalle: "ODI de Alejandro Muñoz", info: "2 rechazos consecutivos por huella digital borrosa" },
    { id: "seg-2", empresa: "Constructora del Sol", proyecto: "Planta Solar", detalle: "Registro Mutual ACHS", info: "Documentación de faena no corresponde al período" },
    { id: "seg-3", empresa: "Eléctrica del Sur", proyecto: "Torre Mackenna", detalle: "Contrato de Trabajo de Juan Pérez", info: "RUT de trabajador no coincide con credencial" },
    { id: "seg-4", empresa: "Lagos y Cía", proyecto: "Costanera Norte", detalle: "F30 de Empresa", info: "3 intentos fallidos de subida de planilla SII" },
    { id: "seg-5", empresa: "Servicios Generales Ltda", proyecto: "Costanera Norte", detalle: "Certificado de Antecedentes de Carlos Rojas", info: "Documento con vigencia vencida por 3 meses" }
  ];

  const mockCasosDecision = [
    { id: "dec-1", empresa: "TécnicoSur SpA", proyecto: "Torre Mackenna", detalle: "Certificado ODI", info: "Excepción de firma notarial para trabajador extranjero (Jefe Verificador)" },
    { id: "dec-2", empresa: "Constructora del Sol", proyecto: "Planta Solar", detalle: "Certificado Antecedentes", info: "Discrepancia en validación de firma digital homologada (Jefe Verificador)" },
    { id: "dec-3", empresa: "Eléctrica del Sur", proyecto: "Torre Mackenna", detalle: "Examen de Altura Física", info: "Criterio de vigencia de examen médico extranjero (Jefe Verificador)" },
    { id: "dec-4", empresa: "Lagos y Cía", proyecto: "Costanera Norte", detalle: "Declaración jurada F30", info: "Revisión de cláusula de responsabilidad solidaria (Jefe Verificador)" }
  ];

  /* --- The three former panels, merged into one prioritised queue --- */
  const itemsCola: ItemCola[] = [
    ...dynamicCola.map((d): ItemCola => ({
      key: `cola-${d.id}`,
      sev: d.prio === 'Alta' ? 'critico' : 'normal',
      empresa: d.emp,
      documento: d.title,
      meta: `${d.proyecto} · esperando revisión${d.origen === 'Trabajador' ? ` · ${d.trabajadorNombre}` : ''}`,
      tiempo: d.time,
      accion: 'Revisar',
      onAccion: () => { setSelectedDocId(d.id); setActiveTab('cola'); },
    })),
    ...alertas.map((a): ItemCola => ({
      key: `alerta-${a.id}`,
      sev: a.criticidad === 'Crítica' || a.bloquea ? 'critico' : a.criticidad === 'Atención' ? 'atencion' : 'normal',
      empresa: a.empresaNombre,
      documento: a.documentoNombre,
      meta: [
        a.proyectoNombre,
        a.diasRestantes < 0 ? `vencido el ${a.vencimiento}` : `vence en ${a.diasRestantes} días`,
        a.trabajadorNombre,
        a.bloquea ? 'bloquea faena' : null,
      ].filter(Boolean).join(' · '),
      tiempo: a.diasRestantes < 0 ? 'Vencido' : `${a.diasRestantes} d`,
      accion: 'Ver',
      onAccion: () => setActiveTab('acreditaciones'),
    })),
    ...waitingCorrectionList.map((w): ItemCola => ({
      key: `correccion-${w.id}`,
      sev: 'atencion',
      empresa: w.empresa,
      documento: w.documento,
      meta: `${w.proyecto} · rechazado: ${w.motivo}`,
      tiempo: `${w.intentos} int.`,
      accion: 'Ver',
      onAccion: () => setActiveTab('acreditaciones'),
    })),
  ];

  const ordenSev: Record<Severidad, number> = { critico: 0, atencion: 1, normal: 2 };
  itemsCola.sort((a, b) => ordenSev[a.sev] - ordenSev[b.sev]);

  const conteo = {
    todos: itemsCola.length,
    critico: itemsCola.filter(i => i.sev === 'critico').length,
    atencion: itemsCola.filter(i => i.sev === 'atencion').length,
    normal: itemsCola.filter(i => i.sev === 'normal').length,
  };

  const colaVisible = filtroCola === 'todos' ? itemsCola : itemsCola.filter(i => i.sev === filtroCola);

  const primerPendiente = dynamicCola[0];

  /* --- Top-of-page KPIs and "Atención requerida" / "Salud de acreditación",
     adapted from the uploaded prototype but wired to real data instead of the
     mock counts it shipped with. --- */
  const totalMandantes = GLOBAL_MANDANTES.length;
  const totalProyectos = GLOBAL_PROYECTOS.length;
  const totalContratistas = GLOBAL_CONTRATISTAS.length;
  const contratistasConIncumplimiento = GLOBAL_CONTRATISTAS.filter(c =>
    c.documentos.some(d => d.estado === 'rechazado' || d.estado === 'por_vencer')
  ).length;
  const totalTrabajadores = GLOBAL_CONTRATISTAS.reduce((sum, c) => sum + (c.trabajadores?.length || 0), 0);
  const trabajadoresVigentes = GLOBAL_CONTRATISTAS.reduce(
    (sum, c) => sum + (c.trabajadores?.filter(t => t.estado === 'aprobado').length || 0), 0
  );
  const pctVigente = totalTrabajadores > 0 ? Math.round((trabajadoresVigentes / totalTrabajadores) * 100) : 0;
  const revisionPendiente = dynamicCola.length;
  const prioridadAlta = dynamicCola.filter(d => d.prio === 'Alta').length;

  const contratistasBloqueados = GLOBAL_CONTRATISTAS.filter(
    c => calcularEstadoAcreditacion(c) === 'Vencido/Bloqueado'
  ).length;
  const contratistasAprobados = GLOBAL_CONTRATISTAS.filter(
    c => calcularEstadoAcreditacion(c) === 'Aprobado'
  ).length;
  const contratistasEnProceso = totalContratistas - contratistasAprobados - contratistasBloqueados;
  const pctAcreditados = totalContratistas > 0 ? Math.round((contratistasAprobados / totalContratistas) * 100) : 0;

  const documentosRechazados = GLOBAL_CONTRATISTAS.reduce(
    (sum, c) => sum + c.documentos.filter(d => d.estado === 'rechazado').length, 0
  );
  const invitacionesPendientes = getInvitaciones().filter(i => i.estado === 'pendiente').length;

  const issuesAtencion = [
    contratistasBloqueados > 0 && {
      key: 'bloq', color: '#a32d2d',
      titulo: `${contratistasBloqueados} contratistas bloqueados`,
      detalle: 'Podrían afectar acceso o continuidad operacional.',
      accion: 'Gestionar', onClick: () => setActiveTab('contratistas'),
    },
    documentosRechazados > 0 && {
      key: 'rech', color: '#a32d2d',
      titulo: `${documentosRechazados} documentos rechazados`,
      detalle: 'Esperan una nueva carga o corrección.',
      accion: 'Revisar', onClick: () => setActiveTab('acreditaciones'),
    },
    alertas.length > 0 && {
      key: 'venc', color: '#b58600',
      titulo: `${alertas.length} documentos por vencer o vencidos`,
      detalle: 'Requieren seguimiento de vigencia en los próximos 30 días.',
      accion: 'Ver', onClick: () => setActiveTab('acreditaciones'),
    },
    invitacionesPendientes > 0 && {
      key: 'inv', color: 'var(--brown)',
      titulo: `${invitacionesPendientes} invitaciones pendientes`,
      detalle: 'Contratistas todavía no han aceptado la invitación.',
      accion: 'Gestionar', onClick: () => setActiveTab('mandantes'),
    },
  ].filter(Boolean) as Array<{ key: string; color: string; titulo: string; detalle: string; accion: string; onClick: () => void }>;

  /* Admin.tsx passes activity items shaped { empresa, documento, fecha, estado,
     detalle } with estado capitalised, so compare case-insensitively — the old
     lowercase comparison silently matched nothing. */
  const normalizarEstado = (e: unknown) => String(e ?? '').toLowerCase();
  const actividadFiltrada = ACTIVIDAD_RECIENTE.filter(
    a => filtroActividad === 'todos' || normalizarEstado(a.estado) === filtroActividad
  );
  const MAX_ACTIVIDAD = 8;
  const actividadVisible = actividadFiltrada.slice(0, MAX_ACTIVIDAD);

  const filtros: Array<{ id: 'todos' | Severidad; label: string }> = [
    { id: 'todos', label: 'Todos' },
    { id: 'critico', label: 'Críticos' },
    { id: 'atencion', label: 'Atención' },
    { id: 'normal', label: 'Normal' },
  ];

  return (
    <div className="fade-in space-y-6">
      <div className="page-header items-start flex-wrap gap-3">
        <div>
          <div className="text-[11.5px] text-gray-500 mb-1 uppercase tracking-wide">Inicio · Administración</div>
          <h2 className="page-title text-navy font-bold text-[26px]">Resumen de Acredita</h2>
          <p className="page-sub text-gray-500 text-[13.5px] mt-1">
            Estado general de mandantes, contratistas, acreditaciones y documentación.
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={() => showToast?.('Generando reporte de cumplimiento...', 'success')}
            className="btn btn-ghost"
          >
            Exportar reporte
          </button>
          <button
            onClick={() => {
              if (primerPendiente) setSelectedDocId(primerPendiente.id);
              setActiveTab('cola');
            }}
            className="btn btn-primary"
          >
            Comenzar revisión <ArrowRight size={16} />
          </button>
        </div>
      </div>

      {/* Top-level KPIs — icons wrap in a tinted square badge, like the prototype's .metric-icon */}
      <section className="stats">
        <div className="stat s-brown shadow-[0_2px_8px_rgba(38,48,59,0.04)]">
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-[12px] font-bold text-gray-500">Mandantes activos</span>
            <div className="w-[34px] h-[34px] rounded-[10px] grid place-items-center shrink-0" style={{ background: 'rgba(154,105,78,0.12)' }}>
              <Building2 size={17} className="text-brown" />
            </div>
          </div>
          <div className="stat-n !font-bold">{totalMandantes}</div>
          <div className="stat-l">{totalProyectos} proyectos asociados</div>
        </div>
        <div className="stat s-blue shadow-[0_2px_8px_rgba(38,48,59,0.04)]">
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-[12px] font-bold text-gray-500">Contratistas</span>
            <div className="w-[34px] h-[34px] rounded-[10px] grid place-items-center shrink-0" style={{ background: 'rgba(47,111,176,0.12)' }}>
              <Users size={17} className="text-[#2f6fb0]" />
            </div>
          </div>
          <div className="stat-n !font-bold">{totalContratistas}</div>
          <div className="stat-l">{contratistasConIncumplimiento} con incumplimientos</div>
        </div>
        <div className="stat s-green shadow-[0_2px_8px_rgba(38,48,59,0.04)]">
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-[12px] font-bold text-gray-500">Trabajadores</span>
            <div className="w-[34px] h-[34px] rounded-[10px] grid place-items-center shrink-0" style={{ background: 'rgba(42,128,64,0.12)' }}>
              <HardHat size={17} className="text-[#2a8040]" />
            </div>
          </div>
          <div className="stat-n !font-bold">{totalTrabajadores}</div>
          <div className="stat-l">{pctVigente}% con documentación vigente</div>
        </div>
        <div className="stat s-orange shadow-[0_2px_8px_rgba(38,48,59,0.04)]">
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-[12px] font-bold text-gray-500">Revisión pendiente</span>
            <div className="w-[34px] h-[34px] rounded-[10px] grid place-items-center shrink-0" style={{ background: 'rgba(212,122,26,0.12)' }}>
              <ClipboardList size={17} className="text-[#d47a1a]" />
            </div>
          </div>
          <div className="stat-n !font-bold">{revisionPendiente}</div>
          <div className="stat-l">{prioridadAlta} son prioridad alta</div>
        </div>
      </section>

      {/* Hero: what needs attention, and overall accreditation health */}
      <section className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-4">
        <div className="card p-0 overflow-hidden flex flex-col shadow-[0_2px_8px_rgba(38,48,59,0.04)]">
          <div className="flex justify-between items-start px-5 py-4 border-b border-cream3">
            <div>
              <div className="text-[15px] font-bold text-navy">Atención requerida</div>
              <div className="text-[11.5px] text-gray-500 mt-0.5">Lo más importante para resolver ahora.</div>
            </div>
            <span className="badge b-brown shrink-0">
              {issuesAtencion.length} incidencia{issuesAtencion.length === 1 ? '' : 's'}
            </span>
          </div>
          <div className="p-3 flex flex-col gap-1.5">
            {issuesAtencion.length > 0 ? (
              issuesAtencion.map(issue => (
                <div key={issue.key} className="flex items-center gap-3 p-3 rounded-[11px] bg-cream2">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: issue.color }} />
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-semibold text-navy">{issue.titulo}</div>
                    <div className="text-[11px] text-gray-500 mt-0.5">{issue.detalle}</div>
                  </div>
                  <button onClick={issue.onClick} className="text-[11px] font-bold text-brown shrink-0 hover:underline">
                    {issue.accion} →
                  </button>
                </div>
              ))
            ) : (
              <p className="text-center py-8 text-gray-400 text-[13.5px]">Sin incidencias. Todo al día.</p>
            )}
          </div>
        </div>

        <div className="card shadow-[0_2px_8px_rgba(38,48,59,0.04)]">
          <div className="text-[15px] font-bold text-navy">Salud de acreditación</div>
          <div className="text-[11.5px] text-gray-500 mt-0.5 mb-4">Contratistas activos</div>
          <div className="flex items-end justify-between">
            <span className="text-[36px] font-extrabold text-navy leading-none">{pctAcreditados}%</span>
            <span className="text-[12px] text-gray-500 mb-1.5">acreditados</span>
          </div>
          <div className="prog-wrap my-4">
            <div className="prog-fill" style={{ width: `${pctAcreditados}%` }} />
          </div>
          <div className="flex flex-col gap-2.5 text-[12.5px]">
            <div className="flex justify-between items-center">
              <span className="flex items-center gap-1.5 text-gray-500">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: '#2a8040' }} />
                Acreditados
              </span>
              <strong className="text-navy">{contratistasAprobados}</strong>
            </div>
            <div className="flex justify-between items-center">
              <span className="flex items-center gap-1.5 text-gray-500">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: '#b58600' }} />
                En proceso
              </span>
              <strong className="text-navy">{contratistasEnProceso}</strong>
            </div>
            <div className="flex justify-between items-center">
              <span className="flex items-center gap-1.5 text-gray-500">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: '#a32d2d' }} />
                Bloqueados
              </span>
              <strong className="text-navy">{contratistasBloqueados}</strong>
            </div>
          </div>
        </div>
      </section>

      {/* Same-day activity, subordinate to the KPIs above */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="stat-mini shadow-[0_2px_8px_rgba(38,48,59,0.04)]">
          <div className="stat-mini-n">{waitingCorrectionList.length}</div>
          <div className="stat-mini-l">Esperando corrección</div>
        </div>
        <div className="stat-mini shadow-[0_2px_8px_rgba(38,48,59,0.04)]">
          <div className="stat-mini-n">{mockCasosSeguimiento.length}</div>
          <div className="stat-mini-l">Casos en seguimiento</div>
        </div>
        <div className="stat-mini shadow-[0_2px_8px_rgba(38,48,59,0.04)]">
          <div className="stat-mini-n" style={{ color: '#1e7a3c' }}>{aprobadosHoy}</div>
          <div className="stat-mini-l">Aprobados hoy</div>
        </div>
        <div className="stat-mini shadow-[0_2px_8px_rgba(38,48,59,0.04)]">
          <div className="stat-mini-n" style={{ color: '#b83232' }}>{rechazadosHoy}</div>
          <div className="stat-mini-l">Rechazados hoy</div>
        </div>
      </div>

      {/* Unified priority queue + quick access, side by side like the prototype's
          "Revisión documental" / "Accesos rápidos" pair */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.3fr_0.9fr] gap-4">
        <div>
          <div className="flex flex-wrap justify-between items-end gap-3 mb-3">
            <div>
              <h3 className="section-title mb-0 text-[16px] font-semibold text-navy">Cola prioritaria</h3>
              <p className="text-[11.5px] text-gray-500 mt-0.5">
                Pendientes de revisión, alertas de vigencia y correcciones, unificadas y ordenadas por urgencia.
              </p>
            </div>
            <div className="flex gap-3.5 text-[11.5px] text-gray-500">
              {(['critico', 'atencion', 'normal'] as Severidad[]).map(s => (
                <span key={s} className="flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${s === 'critico' ? 'bg-[#a32d2d]' : s === 'atencion' ? 'bg-[#b58600]' : 'bg-gray-400'}`} />
                  {SEV_LABEL[s]}
                </span>
              ))}
            </div>
          </div>

          <div className="card p-0 overflow-hidden shadow-[0_2px_8px_rgba(38,48,59,0.04)]">
            <div className="flex flex-wrap gap-2 px-4 py-3 border-b border-cream3">
              {filtros.map(f => (
                <button
                  key={f.id}
                  onClick={() => setFiltroCola(f.id)}
                  className={`chip ${filtroCola === f.id ? 'active' : ''}`}
                >
                  {f.label} <span className="chip-count">{conteo[f.id]}</span>
                </button>
              ))}
            </div>

            {colaVisible.length > 0 ? (
              colaVisible.map(item => (
                <div key={item.key} className="qrow">
                  <span className={`sev sev-${item.sev} w-[76px] px-0`}>{SEV_LABEL[item.sev]}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13.5px] font-semibold text-navy truncate">
                      {item.empresa} — {item.documento}
                    </div>
                    <div className="text-[11.5px] text-gray-500 truncate" title={item.meta}>{item.meta}</div>
                  </div>
                  <span className="text-[11.5px] text-gray-400 shrink-0 hidden sm:block text-right whitespace-nowrap">{item.tiempo}</span>
                  <button onClick={item.onAccion} className="btn btn-ghost btn-sm shrink-0">
                    {item.accion}
                  </button>
                </div>
              ))
            ) : (
              <p className="text-center py-8 text-gray-400 text-[13.5px]">
                {filtroCola === 'todos' ? 'No hay nada pendiente. Todo al día.' : `No hay items en "${SEV_LABEL[filtroCola as Severidad]}".`}
              </p>
            )}
          </div>
        </div>

        <div>
          <div className="mb-3">
            <h3 className="section-title mb-0 text-[16px] font-semibold text-navy">Accesos rápidos</h3>
            <p className="text-[11.5px] text-gray-500 mt-0.5">Tareas frecuentes del administrador.</p>
          </div>
          <div className="card grid grid-cols-2 gap-2.5 shadow-[0_2px_8px_rgba(38,48,59,0.04)]">
            <button
              onClick={() => { if (primerPendiente) setSelectedDocId(primerPendiente.id); setActiveTab('cola'); }}
              className="text-left border border-cream3 rounded-[12px] p-3 hover:border-brown transition-colors"
            >
              <b className="block text-[12px] font-semibold text-navy">Revisar documentos</b>
              <span className="block text-[11px] text-gray-500 mt-1">{revisionPendiente} pendientes</span>
            </button>
            <button
              onClick={() => setActiveTab('contratistas')}
              className="text-left border border-cream3 rounded-[12px] p-3 hover:border-brown transition-colors"
            >
              <b className="block text-[12px] font-semibold text-navy">Ver contratistas</b>
              <span className="block text-[11px] text-gray-500 mt-1">{contratistasConIncumplimiento} con incidencias</span>
            </button>
            <button
              onClick={() => setActiveTab('acreditaciones')}
              className="text-left border border-cream3 rounded-[12px] p-3 hover:border-brown transition-colors"
            >
              <b className="block text-[12px] font-semibold text-navy">Ver acreditaciones</b>
              <span className="block text-[11px] text-gray-500 mt-1">{totalContratistas} activos</span>
            </button>
            <button
              onClick={() => setActiveTab('auditoria')}
              className="text-left border border-cream3 rounded-[12px] p-3 hover:border-brown transition-colors"
            >
              <b className="block text-[12px] font-semibold text-navy">Consultar auditoría</b>
              <span className="block text-[11px] text-gray-500 mt-1">Actividad reciente</span>
            </button>
          </div>
        </div>
      </div>

      {/* Cases escalated to the verification lead. There is no screen for this
          yet, so each row shows a static marker instead of a dead button. */}
      <div>
        <div className="flex justify-between items-end gap-3 mb-3">
          <div>
            <h3 className="section-title mb-0 text-[16px] font-semibold text-navy flex items-center gap-2">
              <ShieldAlert size={17} className="text-[#a32d2d]" />
              Requieren decisión
            </h3>
            <p className="text-[11.5px] text-gray-500 mt-0.5">
              Casos escalados al Jefe de Verificadores.
            </p>
          </div>
        </div>
        <div className="card p-0 overflow-hidden shadow-[0_2px_8px_rgba(38,48,59,0.04)]">
          {mockCasosDecision.map(caso => (
            <div key={caso.id} className="qrow">
              <div className="flex-1 min-w-0">
                <div className="text-[13.5px] font-semibold text-navy truncate">
                  {caso.empresa} — {caso.detalle}
                </div>
                <div className="text-[11.5px] text-gray-500 truncate" title={caso.info}>
                  {caso.proyecto} · {caso.info}
                </div>
              </div>
              <span className="text-[11.5px] text-gray-400 shrink-0 flex items-center gap-1.5">
                <Clock size={13} /> Escalado
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Recent activity: quieter than the queue above */}
      <div>
        <div className="flex flex-wrap justify-between items-end gap-3 mb-3">
          <div>
            <h3 className="section-title mb-0 text-[16px] font-semibold text-navy">Actividad reciente</h3>
            <p className="text-[11.5px] text-gray-500 mt-0.5">Últimos eventos de la operación.</p>
          </div>
          <select
            value={filtroActividad}
            onChange={(e) => setFiltroActividad(e.target.value)}
            className="form-input text-[11.5px] py-1 px-2 w-auto"
          >
            <option value="todos">Todos los estados</option>
            <option value="revision">En revisión</option>
            <option value="aprobado">Aprobado</option>
            <option value="rechazado">Rechazado</option>
            <option value="registrado">Registrado</option>
          </select>
        </div>

        <div className="card p-0 overflow-hidden bg-white/70 shadow-[0_2px_8px_rgba(38,48,59,0.04)]">
          {actividadVisible.length > 0 ? (
            actividadVisible.map(a => {
              const estado = normalizarEstado(a.estado);
              const badge = estado === 'aprobado' ? 'b-green'
                : estado === 'rechazado' ? 'b-red'
                : estado === 'registrado' ? 'b-blue' : 'b-yellow';
              const label = estado === 'aprobado' ? 'Aprobado'
                : estado === 'rechazado' ? 'Rechazado'
                : estado === 'registrado' ? 'Registrado' : 'En revisión';
              return (
                <div
                  key={a.id}
                  className="arow cursor-pointer"
                  onClick={() => setActividadSeleccionada(a)}
                >
                  <span className="font-semibold text-navy w-[170px] shrink-0 truncate">{a.empresa}</span>
                  <span className="flex-1 text-gray-600 truncate" title={a.detalle || a.documento}>
                    {a.documento}{a.detalle ? ` · ${a.detalle}` : ''}
                  </span>
                  <span className={`badge ${badge} text-[11.5px] shrink-0`}>{label}</span>
                  <span className="text-[11.5px] text-gray-400 shrink-0 text-right whitespace-nowrap">{a.hora || a.fecha}</span>
                </div>
              );
            })
          ) : (
            <p className="text-center py-8 text-gray-400 text-[13.5px]">No hay actividad con este estado.</p>
          )}
          {actividadFiltrada.length > MAX_ACTIVIDAD && (
            <div className="px-4 py-2.5 text-[11.5px] text-gray-400 border-t border-cream text-center">
              Mostrando {MAX_ACTIVIDAD} de {actividadFiltrada.length} eventos
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
