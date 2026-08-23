import { ClipboardList, ShieldCheck, Building2, Users } from 'lucide-react';
import { Contratista, Proyecto } from '../../types';
import { buildColaDocs, buildCorrectionDocs } from './colaUtils';
import { buildAcreditacionRows, badgeClass, AcredRow } from './acreditacionUtils';
import { GLOBAL_MANDANTES } from './globalData';

const VERIFICADORES_HOY = [
  { nombre: 'María González', rol: 'Analista de acreditación', peso: 0.38 },
  { nombre: 'Carlos Soto', rol: 'Analista de acreditación', peso: 0.30 },
  { nombre: 'Ana Ruiz', rol: 'Supervisora', peso: 0.20 },
];
const VERIFICADORES_ACTIVOS = 4;

const rankEstado = (e: AcredRow['estado']) => (e === 'Vencido/Bloqueado' ? 0 : e === 'En proceso' ? 1 : 2);

export default function DashboardTab({
  GLOBAL_CONTRATISTAS,
  GLOBAL_PROYECTOS,
  setActiveTab,
  aprobadosHoy,
  rechazadosHoy,
  setSelectedDocId,
}: {
  GLOBAL_CONTRATISTAS: Contratista[];
  GLOBAL_PROYECTOS: Proyecto[];
  setActiveTab: (v: string) => void;
  aprobadosHoy: number;
  rechazadosHoy: number;
  setSelectedDocId: (id: number | null) => void;
}) {
  const dynamicCola = buildColaDocs(GLOBAL_CONTRATISTAS, GLOBAL_PROYECTOS);
  const correctionDocs = buildCorrectionDocs(GLOBAL_CONTRATISTAS, GLOBAL_PROYECTOS);

  // Mirrors ColaRevisionTab's own illustrative claim simulation (2 of the
  // oldest/highest-priority pending docs shown as "already taken" once there
  // are enough of them), so this KPI agrees with what that tab shows.
  const enRevisionCount = dynamicCola.length >= 3 ? 2 : 0;
  const porRevisarCount = dynamicCola.length - enRevisionCount;
  const esperandoCorreccionCount = correctionDocs.length;

  const acredRows = buildAcreditacionRows(GLOBAL_CONTRATISTAS, GLOBAL_PROYECTOS, GLOBAL_MANDANTES);
  const bloqueadasCount = acredRows.filter(r => r.estado === 'Vencido/Bloqueado').length;

  // "Requiere atención": worst acreditación per contratista (not per project,
  // so the same company in 3 projects doesn't crowd out other companies),
  // top 5 by severity.
  const worstPerContratista = new Map<string, AcredRow>();
  acredRows.forEach(r => {
    const existing = worstPerContratista.get(r.contratista.id);
    if (!existing || rankEstado(r.estado) < rankEstado(existing.estado)) worstPerContratista.set(r.contratista.id, r);
  });
  const atencion = Array.from(worstPerContratista.values())
    .filter(r => r.estado !== 'Aprobado')
    .sort((a, b) => rankEstado(a.estado) - rankEstado(b.estado))
    .slice(0, 5);

  const problemText = (r: AcredRow) => {
    if (r.estado === 'Vencido/Bloqueado') {
      const empresaBlockers = r.blockers.filter(b => b.tipo === 'Empresa');
      const trabajadorBlockers = r.blockers.filter(b => b.tipo === 'Trabajador');
      if (empresaBlockers.length > 0) return `${empresaBlockers[0].detalle}. La acreditación no puede completarse.`;
      if (trabajadorBlockers.length > 0) return `${trabajadorBlockers.length} trabajador${trabajadorBlockers.length === 1 ? '' : 'es'} impide${trabajadorBlockers.length === 1 ? '' : 'n'} completar la acreditación.`;
      return 'Requisitos obligatorios rechazados o vencidos.';
    }
    const pendientes = dynamicCola.filter(d => d.emp === r.entity && d.proyecto === r.proyectoNombre).length;
    if (pendientes > 0) return `${pendientes} documento${pendientes === 1 ? '' : 's'} pendiente${pendientes === 1 ? '' : 's'} de revisión.`;
    return 'Documentación en proceso de validación.';
  };

  const revisadosHoy = aprobadosHoy + rechazadosHoy;

  const irACola = () => {
    const first = dynamicCola[0];
    if (first) setSelectedDocId(first.id);
    setActiveTab('cola');
  };

  return (
    <div className="dashv2 fade-in pb-10">
      <style>{`
        .dashv2{--line:var(--cream3);--muted:#717b87;--red:#a6302f;--amber:#a06d14;--green:#2d7b45;--blue:#315b8a;}
        .dashv2 .head{margin-bottom:18px;}
        .dashv2 .eyebrow{font-size:11px;text-transform:uppercase;letter-spacing:.12em;color:var(--brown);font-weight:800;}
        .dashv2 .title{font-size:29px;font-weight:850;color:var(--navy);margin:5px 0;}
        .dashv2 .sub{font-size:13px;color:var(--muted);max-width:900px;line-height:1.45;}

        .dashv2 .kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:14px;}
        .dashv2 .kpi{background:#fff;border:1px solid var(--line);border-radius:12px;padding:15px;cursor:pointer;transition:.15s;border:none;text-align:left;font-family:inherit;}
        .dashv2 .kpi{border:1px solid var(--line);}
        .dashv2 .kpi:hover{transform:translateY(-1px);box-shadow:0 5px 16px rgba(18,32,56,.06);}
        .dashv2 .kpi-top{display:flex;justify-content:space-between;align-items:flex-start;gap:8px;}
        .dashv2 .k{font-size:9.5px;text-transform:uppercase;color:#8a919b;font-weight:800;letter-spacing:.05em;}
        .dashv2 .v{font-size:25px;font-weight:900;color:var(--navy);margin-top:7px;}
        .dashv2 .n{font-size:9.5px;color:var(--muted);margin-top:3px;}
        .dashv2 .link{font-size:9.5px;font-weight:850;color:var(--brown);margin-top:10px;}
        .dashv2 .kpi.warn .v{color:var(--amber);}
        .dashv2 .kpi.danger .v{color:var(--red);}
        .dashv2 .kpi.good .v{color:var(--green);}
        .dashv2 .kpi.blue .v{color:var(--blue);}
        .dashv2 .badge{display:inline-flex;padding:5px 8px;border-radius:999px;font-size:9.5px;font-weight:800;white-space:nowrap;}
        .dashv2 .badge.red{background:#f9ecec;color:var(--red);}
        .dashv2 .badge.amber{background:#fbf4e3;color:var(--amber);}
        .dashv2 .badge.green{background:#edf7ef;color:var(--green);}
        .dashv2 .badge.gray{background:#f2f4f7;color:#667085;}
        .dashv2 .badge.blue{background:#edf3fa;color:var(--blue);}

        .dashv2 .layout{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(300px,.65fr);gap:14px;}
        .dashv2 .box{background:#fff;border:1px solid var(--line);border-radius:14px;box-shadow:0 3px 12px rgba(18,32,56,.035);overflow:hidden;}
        .dashv2 .box-head{padding:14px 16px;border-bottom:1px solid var(--line);display:flex;justify-content:space-between;align-items:center;gap:12px;}
        .dashv2 .box-title{font-size:14px;font-weight:900;color:var(--navy);}
        .dashv2 .box-sub{font-size:10px;color:var(--muted);margin-top:3px;}
        .dashv2 .attention{padding:2px 16px 6px;}
        .dashv2 .attention-item{padding:13px 0;border-bottom:1px solid #f0ece7;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:14px;align-items:center;}
        .dashv2 .attention-item:last-child{border-bottom:0;}
        .dashv2 .attention-title{display:flex;gap:8px;align-items:center;flex-wrap:wrap;}
        .dashv2 .attention-title b{font-size:11.5px;color:var(--navy);}
        .dashv2 .meta{font-size:9.5px;color:var(--muted);margin-top:3px;line-height:1.4;}
        .dashv2 .problem{font-size:10px;color:#475467;margin-top:5px;line-height:1.4;}
        .dashv2 .icon{border:1px solid var(--line);background:#fff;border-radius:8px;padding:8px 10px;font-size:10px;font-weight:800;color:#475467;cursor:pointer;font-family:inherit;white-space:nowrap;}
        .dashv2 .footer{padding:11px 14px;border-top:1px solid var(--line);display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;}
        .dashv2 .muted{font-size:10px;color:var(--muted);}
        .dashv2 .btn{border:1px solid var(--line);background:#fff;color:var(--navy);padding:9px 13px;border-radius:9px;font-size:12px;font-weight:800;cursor:pointer;font-family:inherit;white-space:nowrap;}
        .dashv2 .btn:hover{background:var(--cream2);}

        .dashv2 .today{padding:14px 16px;}
        .dashv2 .metric-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;}
        .dashv2 .metric-card{border:1px solid var(--line);border-radius:10px;padding:11px;background:#faf9f7;}
        .dashv2 .metric-card .label{font-size:8.5px;text-transform:uppercase;color:#8a919b;font-weight:800;}
        .dashv2 .metric-card .number{font-size:20px;font-weight:900;color:var(--navy);margin-top:4px;}
        .dashv2 .section-label{font-size:9.5px;text-transform:uppercase;letter-spacing:.06em;color:#8a919b;font-weight:800;margin:16px 0 7px;}
        .dashv2 .verifier{display:flex;justify-content:space-between;gap:10px;padding:9px 0;border-bottom:1px solid #f0ece7;}
        .dashv2 .verifier:last-child{border-bottom:0;}
        .dashv2 .verifier b{font-size:10.5px;color:var(--navy);}
        .dashv2 .verifier span{font-size:9.5px;color:var(--muted);}

        .dashv2 .quick{margin-top:14px;}
        .dashv2 .quick-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;padding:14px;}
        .dashv2 .quick-card{border:1px solid var(--line);border-radius:11px;padding:14px;background:#fff;cursor:pointer;transition:.15s;text-align:left;font-family:inherit;}
        .dashv2 .quick-card:hover{background:#faf9f7;transform:translateY(-1px);}
        .dashv2 .quick-icon{width:32px;height:32px;border-radius:9px;background:#f3ece5;color:var(--brown);display:grid;place-items:center;margin-bottom:10px;}
        .dashv2 .quick-card b{display:block;font-size:11px;color:var(--navy);}
        .dashv2 .quick-card span{display:block;font-size:9.5px;color:var(--muted);margin-top:4px;line-height:1.4;}
        .dashv2 .quick-card .go{margin-top:10px;font-size:9px;font-weight:850;color:var(--brown);}

        @media(max-width:1150px){.dashv2 .layout{grid-template-columns:1fr;}}
        @media(max-width:1050px){.dashv2 .quick-grid{grid-template-columns:1fr 1fr;}}
        @media(max-width:680px){.dashv2 .kpis{grid-template-columns:1fr 1fr;}}
        @media(max-width:650px){.dashv2 .quick-grid{grid-template-columns:1fr;}.dashv2 .attention-item{grid-template-columns:1fr;}}
      `}</style>

      <div className="head">
        <div className="eyebrow">Centro de Operaciones · Acredita</div>
        <div className="title">Inicio</div>
        <div className="sub">Resumen de la operación de acreditación y tareas que requieren atención.</div>
      </div>

      <div className="kpis">
        <button className="kpi warn" onClick={irACola}>
          <div className="kpi-top"><div className="k">Por revisar</div><span className="badge amber">Pendiente</span></div>
          <div className="v">{porRevisarCount}</div><div className="n">Documentos pendientes de revisión</div><div className="link">Ver cola →</div>
        </button>
        <button className="kpi blue" onClick={() => setActiveTab('cola')}>
          <div className="kpi-top"><div className="k">En revisión</div><span className="badge blue">Activo</span></div>
          <div className="v">{enRevisionCount}</div><div className="n">Documentos tomados por verificadores</div><div className="link">Ver documentos →</div>
        </button>
        <button className="kpi danger" onClick={() => setActiveTab('cola')}>
          <div className="kpi-top"><div className="k">Esperando corrección</div><span className="badge red">Atención</span></div>
          <div className="v">{esperandoCorreccionCount}</div><div className="n">Documentos rechazados esperando nueva versión</div><div className="link">Ver correcciones →</div>
        </button>
        <button className="kpi danger" onClick={() => setActiveTab('acreditaciones')}>
          <div className="kpi-top"><div className="k">Acreditaciones bloqueadas</div><span className="badge red">Bloqueado</span></div>
          <div className="v">{bloqueadasCount}</div><div className="n">Con documentos obligatorios rechazados o vencidos</div><div className="link">Ver acreditaciones →</div>
        </button>
      </div>

      <div className="layout">
        <section className="box">
          <div className="box-head">
            <div><div className="box-title">Requiere atención</div><div className="box-sub">Situaciones que necesitan una acción del equipo</div></div>
            <span className="badge red">{atencion.length} pendiente{atencion.length === 1 ? '' : 's'}</span>
          </div>
          <div className="attention">
            {atencion.length > 0 ? atencion.map(r => (
              <div className="attention-item" key={r.key}>
                <div>
                  <div className="attention-title">
                    <b>{r.entity}</b>
                    <span className={`badge ${badgeClass(r.estado)}`}>{r.estado === 'Vencido/Bloqueado' ? 'Bloqueado' : r.estado}</span>
                  </div>
                  <div className="meta">{r.mandanteNombre} · {r.proyectoNombre}</div>
                  <div className="problem">{problemText(r)}</div>
                </div>
                <button
                  className="icon"
                  onClick={() => r.estado === 'Vencido/Bloqueado' ? setActiveTab('acreditaciones') : setActiveTab('cola')}
                >
                  {r.estado === 'Vencido/Bloqueado' ? 'Ver acreditación' : 'Ir a revisión'}
                </button>
              </div>
            )) : (
              <p style={{ textAlign: 'center', padding: '32px 0', color: 'var(--muted)', fontSize: '13px' }}>Sin incidencias. Todo al día.</p>
            )}
          </div>
          <div className="footer">
            <span className="muted">Priorizado por bloqueos y documentos pendientes.</span>
            <button className="btn" onClick={() => setActiveTab('acreditaciones')}>Ver todas las acreditaciones</button>
          </div>
        </section>

        <aside className="box">
          <div className="box-head"><div><div className="box-title">Operación de hoy</div><div className="box-sub">Resumen del trabajo de revisión</div></div><span className="badge green">Hoy</span></div>
          <div className="today">
            <div className="metric-grid">
              <div className="metric-card"><div className="label">Revisados</div><div className="number">{revisadosHoy}</div></div>
              <div className="metric-card"><div className="label">Aprobados</div><div className="number">{aprobadosHoy}</div></div>
              <div className="metric-card"><div className="label">Rechazados</div><div className="number">{rechazadosHoy}</div></div>
              <div className="metric-card"><div className="label">Verificadores activos</div><div className="number">{VERIFICADORES_ACTIVOS}</div></div>
            </div>
            <div className="section-label">Más activos hoy</div>
            {VERIFICADORES_HOY.map(v => (
              <div className="verifier" key={v.nombre}>
                <div><b>{v.nombre}</b><br /><span>{v.rol}</span></div>
                <span><b>{Math.round(revisadosHoy * v.peso)}</b> revisiones</span>
              </div>
            ))}
            <button className="btn" style={{ width: '100%', marginTop: '12px' }} onClick={() => setActiveTab('auditoria')}>Ver verificadores</button>
          </div>
        </aside>
      </div>

      <section className="box quick">
        <div className="box-head"><div><div className="box-title">Accesos rápidos</div><div className="box-sub">Entradas directas a las tareas principales del MVP</div></div></div>
        <div className="quick-grid">
          <button className="quick-card" onClick={() => setActiveTab('cola')}>
            <div className="quick-icon"><ClipboardList size={17} /></div>
            <b>Cola de revisión</b><span>Revisar documentos pendientes y continuar el flujo.</span><div className="go">Abrir →</div>
          </button>
          <button className="quick-card" onClick={() => setActiveTab('acreditaciones')}>
            <div className="quick-icon"><ShieldCheck size={17} /></div>
            <b>Acreditaciones</b><span>Revisar estados, bloqueos y causas.</span><div className="go">Abrir →</div>
          </button>
          <button className="quick-card" onClick={() => setActiveTab('mandantes')}>
            <div className="quick-icon"><Building2 size={17} /></div>
            <b>Mandantes</b><span>Consultar mandantes y sus proyectos.</span><div className="go">Abrir →</div>
          </button>
          <button className="quick-card" onClick={() => setActiveTab('contratistas')}>
            <div className="quick-icon"><Users size={17} /></div>
            <b>Contratistas</b><span>Consultar empresas, trabajadores y acreditaciones.</span><div className="go">Abrir →</div>
          </button>
        </div>
      </section>
    </div>
  );
}
