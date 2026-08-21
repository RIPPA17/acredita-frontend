import { useState } from 'react';
import { ArrowRight, ShieldAlert, Clock } from 'lucide-react';
import { getAlertasVigencia } from '../../data/localStorageDb';
import { Contratista, Proyecto } from '../../types';
import { buildColaDocs } from './colaUtils';

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
      <div className="page-header">
        <div>
          <h2 className="page-title text-navy font-bold text-[22px]">Centro de operaciones</h2>
          <p className="page-sub text-gray-500 text-[13.5px]">
            Monitoreo y control de acreditaciones
          </p>
        </div>
      </div>

      {/* Banner: the single thing to look at first */}
      <div className="ops-banner">
        <div className="flex items-center gap-6">
          <div className="ops-banner-n">
            {conteo.todos}
            <small>total</small>
          </div>
          <div>
            <div className="ops-banner-t">Hoy requieren tu atención</div>
            <div className="ops-banner-s">
              {conteo.critico > 0 && (
                <span className="text-[#f0a5a5] font-semibold">{conteo.critico} críticos</span>
              )}
              {conteo.critico > 0 && ' · '}
              {conteo.atencion} en atención · {conteo.normal} normales
              {conteo.todos > 0 && ' — empieza por lo más urgente'}
            </div>
          </div>
        </div>
        <button
          onClick={() => {
            if (primerPendiente) setSelectedDocId(primerPendiente.id);
            setActiveTab('cola');
          }}
          className="btn btn-primary btn-lg shrink-0"
        >
          Comenzar revisión <ArrowRight size={16} />
        </button>
      </div>

      {/* Secondary metrics, subordinate to the banner */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="stat-mini">
          <div className="stat-mini-n">{waitingCorrectionList.length}</div>
          <div className="stat-mini-l">Esperando corrección</div>
        </div>
        <div className="stat-mini">
          <div className="stat-mini-n">{mockCasosSeguimiento.length}</div>
          <div className="stat-mini-l">Casos en seguimiento</div>
        </div>
        <div className="stat-mini">
          <div className="stat-mini-n" style={{ color: '#1e7a3c' }}>{aprobadosHoy}</div>
          <div className="stat-mini-l">Aprobados hoy</div>
        </div>
        <div className="stat-mini">
          <div className="stat-mini-n" style={{ color: '#b83232' }}>{rechazadosHoy}</div>
          <div className="stat-mini-l">Rechazados hoy</div>
        </div>
      </div>

      {/* Unified priority queue */}
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

        <div className="card p-0 overflow-hidden">
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
        <div className="card p-0 overflow-hidden">
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

        <div className="card p-0 overflow-hidden bg-white/70">
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
