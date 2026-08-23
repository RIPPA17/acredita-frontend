import { useState } from 'react';
import { Contratista, Proyecto, Mandante } from '../../types';
import { AcredRow, buildAcreditacionRows, badgeClass } from './acreditacionUtils';

export default function AcreditacionesTab({
  GLOBAL_CONTRATISTAS,
  GLOBAL_PROYECTOS,
  GLOBAL_MANDANTES,
  setSelectedAcreditacionContratista,
  showToast,
}: {
  GLOBAL_CONTRATISTAS: Contratista[];
  GLOBAL_PROYECTOS: Proyecto[];
  GLOBAL_MANDANTES: Mandante[];
  setSelectedAcreditacionContratista: (c: any) => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'warning') => void;
}) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [mandanteFilter, setMandanteFilter] = useState('');
  const [proyectoFilter, setProyectoFilter] = useState('');
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [miniTab, setMiniTab] = useState<'workers' | 'company'>('workers');

  const rows: AcredRow[] = buildAcreditacionRows(GLOBAL_CONTRATISTAS, GLOBAL_PROYECTOS, GLOBAL_MANDANTES);

  const countAprobadas = rows.filter(r => r.estado === 'Aprobado').length;
  const countEnProceso = rows.filter(r => r.estado === 'En proceso').length;
  const countBloqueadas = rows.filter(r => r.estado === 'Vencido/Bloqueado').length;
  const countTotal = rows.length;

  const filtered = rows.filter(r => {
    if (statusFilter && r.estado !== statusFilter) return false;
    if (mandanteFilter && r.mandanteId !== mandanteFilter) return false;
    if (proyectoFilter && r.proyectoId !== proyectoFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      const hay = [r.entity, r.rut, r.mandanteNombre, r.proyectoNombre].join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const current = filtered.find(r => r.key === selectedKey) ?? filtered[0];

  const selectRow = (key: string) => setSelectedKey(key);

  return (
    <div className="acredv2 fade-in pb-10">
      <style>{`
        .acredv2{--line:var(--cream3);--muted:#717b87;--red:#a6302f;--amber:#a06d14;--green:#2d7b45;--blue:#315b8a;}
        .acredv2 .head{display:flex;justify-content:space-between;align-items:flex-start;gap:20px;margin-bottom:18px;}
        .acredv2 .eyebrow{font-size:11px;text-transform:uppercase;letter-spacing:.12em;color:var(--brown);font-weight:800;}
        .acredv2 .title{font-size:29px;font-weight:850;color:var(--navy);margin:5px 0;}
        .acredv2 .sub{font-size:13px;color:var(--muted);max-width:950px;line-height:1.45;}
        .acredv2 .btn{border:1px solid var(--line);background:#fff;color:var(--navy);padding:9px 13px;border-radius:9px;font-size:12px;font-weight:800;cursor:pointer;font-family:inherit;}
        .acredv2 .btn:hover{background:var(--cream2);}

        .acredv2 .kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:14px;}
        .acredv2 .kpi{background:#fff;border:1px solid var(--line);border-radius:12px;padding:14px;}
        .acredv2 .k{font-size:9.5px;text-transform:uppercase;color:#8a919b;font-weight:800;letter-spacing:.05em;}
        .acredv2 .v{font-size:23px;font-weight:900;color:var(--navy);margin-top:7px;}
        .acredv2 .n{font-size:9.5px;color:var(--muted);margin-top:3px;}
        .acredv2 .kpi.good .v{color:var(--green);}
        .acredv2 .kpi.warn .v{color:var(--amber);}
        .acredv2 .kpi.danger .v{color:var(--red);}
        .acredv2 .kpi.blue .v{color:var(--blue);}

        .acredv2 .toolbar{display:flex;justify-content:space-between;gap:10px;align-items:center;margin-bottom:12px;}
        .acredv2 .filters{display:flex;gap:7px;flex-wrap:wrap;}
        .acredv2 .filter,.acredv2 .search-input{border:1px solid var(--line);background:#fff;border-radius:8px;padding:9px 10px;font-size:11.5px;color:#475467;font-family:inherit;}
        .acredv2 .search-input{min-width:280px;}

        .acredv2 .layout{display:grid;grid-template-columns:minmax(0,1.25fr) minmax(340px,.85fr);gap:14px;align-items:start;}
        .acredv2 .box{background:#fff;border:1px solid var(--line);border-radius:14px;box-shadow:0 3px 12px rgba(18,32,56,.035);overflow:hidden;}
        .acredv2 .box-head{padding:14px 16px;border-bottom:1px solid var(--line);display:flex;justify-content:space-between;align-items:center;gap:12px;}
        .acredv2 .box-title{font-size:14px;font-weight:900;color:var(--navy);}
        .acredv2 .box-sub{font-size:10px;color:var(--muted);margin-top:3px;}
        .acredv2 .badge{display:inline-flex;padding:3px 6px;border-radius:999px;font-size:8.5px;font-weight:800;white-space:nowrap;}
        .acredv2 .badge.red{background:#f9ecec;color:var(--red);}
        .acredv2 .badge.amber{background:#fbf4e3;color:var(--amber);}
        .acredv2 .badge.green{background:#edf7ef;color:var(--green);}
        .acredv2 .badge.gray{background:#f2f4f7;color:#667085;}
        .acredv2 .badge.blue{background:#edf3fa;color:var(--blue);}

        .acredv2 .table-wrap{overflow:auto;}
        .acredv2 .table{width:100%;border-collapse:collapse;}
        .acredv2 .table th,.acredv2 .table td{text-align:left;padding:6px 6px;border-bottom:1px solid #eee9e2;font-size:10px;vertical-align:middle;}
        .acredv2 .table th{font-size:8px;text-transform:uppercase;letter-spacing:.05em;color:#7b8490;background:#faf9f7;white-space:nowrap;}
        .acredv2 .table tbody tr{cursor:pointer;}
        .acredv2 .table tbody tr:hover{background:#fcfbf9;}
        .acredv2 .table tbody tr.active{background:#f8f2ec;}
        .acredv2 .name{font-weight:850;color:var(--navy);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:118px;}
        .acredv2 .subcell{font-size:8.5px;color:var(--muted);margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:118px;}
        .acredv2 .progress{height:5px;border-radius:999px;background:#eef0f2;overflow:hidden;margin-top:4px;min-width:38px;}
        .acredv2 .progress>div{height:100%;border-radius:999px;background:var(--green);}
        .acredv2 .progress.warn>div{background:var(--amber);}
        .acredv2 .progress.red>div{background:var(--red);}
        .acredv2 .icon{border:0;background:#f3f4f6;border-radius:6px;padding:4px 6px;font-size:9px;font-weight:800;color:#475467;cursor:pointer;font-family:inherit;white-space:nowrap;}
        .acredv2 .footer{padding:10px 14px;border-top:1px solid var(--line);display:flex;justify-content:space-between;align-items:center;}
        .acredv2 .muted{font-size:10px;color:var(--muted);}

        .acredv2 .detail{position:sticky;top:18px;}
        .acredv2 .hero{padding:16px;border-bottom:1px solid var(--line);}
        .acredv2 .hero-top{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;}
        .acredv2 .hero h2{font-size:17px;color:var(--navy);margin:0 0 3px;}
        .acredv2 .hero p{font-size:10px;color:var(--muted);margin:0;}
        .acredv2 .context{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:14px;}
        .acredv2 .context-item{border:1px solid var(--line);border-radius:9px;padding:9px;background:#faf9f7;}
        .acredv2 .context-item label{display:block;font-size:8.5px;text-transform:uppercase;color:#8a919b;font-weight:800;}
        .acredv2 .context-item strong{display:block;font-size:10.5px;color:var(--navy);margin-top:3px;}
        .acredv2 .summary{padding:14px 16px;border-bottom:1px solid var(--line);}
        .acredv2 .summary-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;}
        .acredv2 .summary-card{border:1px solid var(--line);border-radius:10px;padding:11px;}
        .acredv2 .summary-card .label{font-size:9px;color:var(--muted);text-transform:uppercase;font-weight:800;}
        .acredv2 .summary-card .big{font-size:19px;font-weight:900;color:var(--navy);margin-top:4px;}
        .acredv2 .summary-card .desc{font-size:9px;color:var(--muted);margin-top:3px;}
        .acredv2 .blockers{padding:14px 16px;border-bottom:1px solid var(--line);}
        .acredv2 .section-label{font-size:9.5px;text-transform:uppercase;letter-spacing:.06em;color:#8a919b;font-weight:800;margin:0 0 8px;}
        .acredv2 .blocker{border:1px solid var(--line);border-radius:10px;padding:10px;margin-bottom:8px;background:#fff;}
        .acredv2 .blocker:last-child{margin-bottom:0;}
        .acredv2 .blocker-top{display:flex;justify-content:space-between;gap:8px;align-items:flex-start;}
        .acredv2 .blocker b{font-size:10.5px;color:var(--navy);}
        .acredv2 .blocker p{font-size:9px;color:var(--muted);margin:4px 0 0;line-height:1.4;}
        .acredv2 .blocker-actions{display:flex;gap:6px;margin-top:8px;}
        .acredv2 .cta{padding:14px 16px;}
        .acredv2 .cta .btn{width:100%;}
        .acredv2 .tabs{display:flex;gap:6px;padding:0 16px 12px;}
        .acredv2 .tab{border:1px solid var(--line);background:#fff;color:#475467;padding:7px 10px;border-radius:8px;font-size:9.5px;font-weight:800;cursor:pointer;font-family:inherit;}
        .acredv2 .tab.active{background:#f3ece5;color:var(--brown);border-color:#dbc5ae;}
        .acredv2 .mini-list{padding:0 16px 14px;max-height:280px;overflow-y:auto;}
        .acredv2 .mini-row{display:grid;grid-template-columns:1fr auto;gap:8px;padding:9px 0;border-bottom:1px solid #f0ece7;}
        .acredv2 .mini-row:last-child{border-bottom:0;}
        .acredv2 .mini-row b{font-size:10.5px;color:var(--navy);}

        @media(max-width:1150px){.acredv2 .layout{grid-template-columns:1fr;}.acredv2 .detail{position:static;}}
        @media(max-width:680px){.acredv2 .kpis{grid-template-columns:1fr 1fr;}}
        @media(max-width:650px){.acredv2 .head{display:block;}.acredv2 .toolbar{display:block;}.acredv2 .filters{margin-top:8px;}.acredv2 .search-input{min-width:0;width:100%;}.acredv2 .context,.acredv2 .summary-grid{grid-template-columns:1fr;}}
      `}</style>

      <div className="head">
        <div>
          <div className="eyebrow">Estado operacional · Acredita</div>
          <div className="title">Acreditaciones</div>
          <p className="sub">Vista consolidada por contratista, mandante y proyecto. Permite detectar rápidamente qué acreditaciones están aprobadas, en proceso o bloqueadas y entrar directo al problema.</p>
        </div>
        <button className="btn" onClick={() => showToast('Exportando acreditaciones filtradas a CSV', 'success')}>Exportar</button>
      </div>

      <div className="kpis">
        <div className="kpi good"><div className="k">Aprobadas</div><div className="v">{countAprobadas}</div><div className="n">Habilitadas para operar</div></div>
        <div className="kpi warn"><div className="k">En proceso</div><div className="v">{countEnProceso}</div><div className="n">Con documentos pendientes</div></div>
        <div className="kpi danger"><div className="k">Bloqueadas</div><div className="v">{countBloqueadas}</div><div className="n">Con rechazo o vencimiento</div></div>
        <div className="kpi blue"><div className="k">Total</div><div className="v">{countTotal}</div><div className="n">Contratista + proyecto</div></div>
      </div>

      <div className="toolbar">
        <div className="filters">
          <input
            className="search-input"
            placeholder="Buscar contratista, mandante o proyecto..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <select className="filter" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="">Todos los estados</option>
            <option>Aprobado</option>
            <option>En proceso</option>
            <option>Vencido/Bloqueado</option>
          </select>
          <select className="filter" value={mandanteFilter} onChange={e => setMandanteFilter(e.target.value)}>
            <option value="">Todos los mandantes</option>
            {GLOBAL_MANDANTES.map(m => <option key={m.id} value={m.id}>{m.nombre}</option>)}
          </select>
          <select className="filter" value={proyectoFilter} onChange={e => setProyectoFilter(e.target.value)}>
            <option value="">Todos los proyectos</option>
            {GLOBAL_PROYECTOS.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
        </div>
      </div>

      <div className="layout">
        <section className="box">
          <div className="box-head">
            <div>
              <div className="box-title">Listado de acreditaciones</div>
              <div className="box-sub">Mostrando {filtered.length} acreditacion{filtered.length === 1 ? '' : 'es'}</div>
            </div>
            <span className="badge gray">Por proyecto</span>
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Contratista</th>
                  <th>Mandante / proyecto</th>
                  <th>Empresa</th>
                  <th>Trabajadores</th>
                  <th>Estado</th>
                  <th>Bloqueos</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => {
                  const cp = r.company.total > 0 ? Math.round((r.company.ok / r.company.total) * 100) : 100;
                  const wp = r.workers.total > 0 ? Math.round((r.workers.ok / r.workers.total) * 100) : 100;
                  return (
                    <tr key={r.key} className={current?.key === r.key ? 'active' : ''} onClick={() => selectRow(r.key)}>
                      <td>
                        <div className="name" title={r.entity}>{r.entity}</div>
                        <div className="subcell" title={r.rut}>{r.rut}</div>
                      </td>
                      <td>
                        <div className="name" title={r.mandanteNombre}>{r.mandanteNombre}</div>
                        <div className="subcell" title={r.proyectoNombre}>{r.proyectoNombre}</div>
                      </td>
                      <td>
                        <div className="name">{r.company.ok}/{r.company.total}</div>
                        <div className={`progress ${cp < 100 ? 'warn' : ''}`}><div style={{ width: `${cp}%` }} /></div>
                      </td>
                      <td>
                        <div className="name">{r.workers.ok}/{r.workers.total}</div>
                        <div className={`progress ${wp < 100 ? (r.estado === 'Vencido/Bloqueado' ? 'red' : 'warn') : ''}`}><div style={{ width: `${wp}%` }} /></div>
                      </td>
                      <td><span className={`badge ${badgeClass(r.estado)}`} title={r.estado}>{r.estado === 'Vencido/Bloqueado' ? 'Bloqueado' : r.estado}</span></td>
                      <td>
                        {r.blockers.length ? (
                          <span className={`badge ${r.estado === 'Vencido/Bloqueado' ? 'red' : 'amber'}`}>{r.blockers.length} prob.</span>
                        ) : (
                          <span className="badge green">Sin bloqueos</span>
                        )}
                      </td>
                      <td><button className="icon" onClick={e => { e.stopPropagation(); selectRow(r.key); }}>Ver</button></td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr><td colSpan={7} style={{ textAlign: 'center', padding: '32px 0', color: 'var(--muted)' }}>Sin resultados para este filtro.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="footer">
            <span className="muted">Una acreditación corresponde siempre a un contratista dentro de un proyecto específico.</span>
          </div>
        </section>

        <aside className="box detail">
          {current ? (
            <>
              <div className="hero">
                <div className="hero-top">
                  <div>
                    <h2>{current.entity}</h2>
                    <p>RUT {current.rut}</p>
                  </div>
                  <span className={`badge ${badgeClass(current.estado)}`}>{current.estado}</span>
                </div>
                <div className="context">
                  <div className="context-item"><label>Mandante</label><strong>{current.mandanteNombre}</strong></div>
                  <div className="context-item"><label>Proyecto</label><strong>{current.proyectoNombre}</strong></div>
                </div>
              </div>

              <div className="summary">
                <div className="section-label">Resumen de acreditación</div>
                <div className="summary-grid">
                  <div className="summary-card">
                    <div className="label">Empresa</div>
                    <div className="big">{current.company.ok}/{current.company.total}</div>
                    <div className="desc">{current.company.ok === current.company.total ? 'Requisitos aprobados' : `${current.company.total - current.company.ok} requisito${current.company.total - current.company.ok === 1 ? '' : 's'} pendiente${current.company.total - current.company.ok === 1 ? '' : 's'}`}</div>
                  </div>
                  <div className="summary-card">
                    <div className="label">Trabajadores</div>
                    <div className="big">{current.workers.ok}/{current.workers.total}</div>
                    <div className="desc">{current.workers.total === 0 ? 'Sin trabajadores asignados' : current.workers.ok === current.workers.total ? 'Todos acreditados' : `${current.workers.total - current.workers.ok} sin acreditar`}</div>
                  </div>
                </div>
              </div>

              <div className="blockers">
                <div className="section-label">Qué impide aprobar</div>
                {current.blockers.length ? current.blockers.map((b, i) => (
                  <div className="blocker" key={i}>
                    <div className="blocker-top">
                      <div>
                        <b>{b.nombre}</b>
                        <p>{b.tipo} · {b.detalle}</p>
                      </div>
                      <span className={`badge ${badgeClass(b.estado)}`}>{b.estado}</span>
                    </div>
                    <div className="blocker-actions">
                      <button className="icon" onClick={() => showToast(`Ver documento o trabajador asociado: ${b.nombre}`, 'warning')}>Ir al problema</button>
                    </div>
                  </div>
                )) : (
                  <div className="blocker">
                    <div className="blocker-top">
                      <div>
                        <b>Sin bloqueos</b>
                        <p>Empresa y trabajadores cumplen los requisitos obligatorios.</p>
                      </div>
                      <span className="badge green">Aprobado</span>
                    </div>
                  </div>
                )}
              </div>

              <div className="tabs">
                <button className={`tab ${miniTab === 'workers' ? 'active' : ''}`} onClick={() => setMiniTab('workers')}>Trabajadores</button>
                <button className={`tab ${miniTab === 'company' ? 'active' : ''}`} onClick={() => setMiniTab('company')}>Empresa</button>
              </div>
              <div className="mini-list">
                {(miniTab === 'workers' ? current.workerList : current.companyDocs).length === 0 && (
                  <p style={{ fontSize: '11px', color: 'var(--muted)', fontStyle: 'italic' }}>Sin registros.</p>
                )}
                {(miniTab === 'workers' ? current.workerList : current.companyDocs).map((item, i) => (
                  <div className="mini-row" key={i}>
                    <div><b>{item.nombre}</b></div>
                    <span className={`badge ${badgeClass(item.estado)}`}>{item.estado}</span>
                  </div>
                ))}
              </div>

              <div className="cta">
                <button
                  className="btn"
                  onClick={() => setSelectedAcreditacionContratista({ ...current.contratista, _fichaProyectoId: current.proyectoId })}
                >
                  Ver acreditación completa
                </button>
              </div>
            </>
          ) : (
            <div style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--muted)', fontSize: '12px' }}>
              Sin acreditaciones para mostrar.
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
