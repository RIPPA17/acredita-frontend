import { useEffect, useMemo } from 'react';
import { ArrowRight, CheckCircle, Clock3, Download, FileCheck2, FileText, UserPlus, Users, Building2, FolderKanban, Home, AlertTriangle, ClipboardCheck, Settings } from 'lucide-react';
import { getAlertasVigencia, getInvitaciones, getMandantes, calcularEstadoAcreditacion, esVencidoPorFecha } from '../../data/localStorageDb';
import { Contratista, Proyecto } from '../../types';
import { buildColaDocs } from './colaUtils';

type DashboardProps = {
  GLOBAL_CONTRATISTAS: Contratista[];
  GLOBAL_PROYECTOS: Proyecto[];
  setActiveTab: (value: string) => void;
  aprobadosHoy: number;
  rechazadosHoy: number;
  setSelectedDocId: (id: number | null) => void;
  filtroActividad: string;
  setFiltroActividad: (value: string) => void;
  ACTIVIDAD_RECIENTE: any[];
  setActividadSeleccionada: (value: any) => void;
};

type Issue = {
  tone: 'red' | 'orange' | 'blue';
  title: string;
  description: string;
  action: string;
  onClick: () => void;
};

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
}

export default function DashboardTab({
  GLOBAL_CONTRATISTAS,
  GLOBAL_PROYECTOS,
  setActiveTab,
  setSelectedDocId,
  filtroActividad,
  setFiltroActividad,
  ACTIVIDAD_RECIENTE,
  setActividadSeleccionada,
}: DashboardProps) {
  useEffect(() => {
    document.body.classList.add('dashboard-prototype');
    return () => document.body.classList.remove('dashboard-prototype');
  }, []);

  const mandantes = getMandantes();
  const alertas = getAlertasVigencia();
  const invitacionesPendientes = getInvitaciones().filter((inv) => inv.estado === 'pendiente').length;
  const cola = buildColaDocs(GLOBAL_CONTRATISTAS, GLOBAL_PROYECTOS);
  const totalWorkers = GLOBAL_CONTRATISTAS.reduce((sum, contractor) => sum + (contractor.trabajadores?.length ?? 0), 0);

  const blockedCount = GLOBAL_CONTRATISTAS.filter((contractor) => calcularEstadoAcreditacion(contractor, contractor.proyectos?.[0]) === 'Vencido/Bloqueado').length;

  const accreditationStats = useMemo(() => {
    let approved = 0;
    let blocked = 0;
    let inProcess = 0;
    GLOBAL_CONTRATISTAS.forEach((contractor) => {
      const state = calcularEstadoAcreditacion(contractor, contractor.proyectos?.[0]);
      if (state === 'Aprobado') approved += 1;
      else if (state === 'Vencido/Bloqueado') blocked += 1;
      else inProcess += 1;
    });
    const total = GLOBAL_CONTRATISTAS.length;
    return { approved, blocked, inProcess, percentage: total ? Math.round((approved / total) * 100) : 0 };
  }, [GLOBAL_CONTRATISTAS]);

  const documentationHealth = useMemo(() => {
    let total = 0;
    let valid = 0;
    GLOBAL_CONTRATISTAS.forEach((contractor) => {
      const documents = [...(contractor.documentos ?? []), ...((contractor.trabajadores ?? []).flatMap((worker) => worker.documentos ?? []))];
      documents.forEach((doc) => {
        total += 1;
        if ((doc.estado === 'aprobado' || doc.estado === 'por_vencer') && !esVencidoPorFecha(doc.vencimiento)) valid += 1;
      });
    });
    return total ? Math.round((valid / total) * 100) : 0;
  }, [GLOBAL_CONTRATISTAS]);

  const rejectedDocuments = useMemo(() => GLOBAL_CONTRATISTAS.reduce((sum, contractor) => {
    const companyRejected = (contractor.documentos ?? []).filter((doc) => doc.estado === 'rechazado').length;
    const workerRejected = (contractor.trabajadores ?? []).reduce((workerSum, worker) => workerSum + (worker.documentos ?? []).filter((doc) => doc.estado === 'rechazado').length, 0);
    return sum + companyRejected + workerRejected;
  }, 0), [GLOBAL_CONTRATISTAS]);

  const expiringSoon = alertas.filter((alert) => alert.diasRestantes >= 0 && alert.diasRestantes <= 30).length;
  const expired = alertas.filter((alert) => alert.diasRestantes < 0).length;

  const issues: Issue[] = [
    blockedCount > 0 ? { tone: 'red', title: `${blockedCount} contratistas bloqueados`, description: 'Podrían afectar acceso o continuidad operacional.', action: 'Gestionar', onClick: () => setActiveTab('acreditaciones') } : null,
    rejectedDocuments > 0 ? { tone: 'red', title: `${rejectedDocuments} documentos rechazados`, description: 'Esperan una nueva carga o corrección.', action: 'Revisar', onClick: () => setActiveTab('cola') } : null,
    expiringSoon > 0 ? { tone: 'orange', title: `${expiringSoon} documentos próximos a vencer`, description: 'Vencimiento dentro de los próximos 30 días.', action: 'Ver', onClick: () => setActiveTab('acreditaciones') } : null,
    invitacionesPendientes > 0 ? { tone: 'blue', title: `${invitacionesPendientes} invitaciones pendientes`, description: 'Contratistas todavía no han aceptado.', action: 'Gestionar', onClick: () => setActiveTab('contratistas') } : null,
  ].filter(Boolean) as Issue[];

  const reviewRows = useMemo(() => cola.slice(0, 4).map((item: any) => ({
    id: item.id,
    company: item.emp,
    document: item.title,
    project: item.proyecto || '—',
    status: item.prio === 'Alta' ? 'Revisión' : 'Pendiente',
    statusTone: item.prio === 'Alta' ? 'danger' : 'warning',
    onClick: () => { setSelectedDocId(item.id); setActiveTab('cola'); },
  })), [cola, setActiveTab, setSelectedDocId]);

  const recentActivity = useMemo(() => ACTIVIDAD_RECIENTE.filter((item) => filtroActividad === 'todos' || String(item.estado ?? '').toLowerCase() === filtroActividad.toLowerCase()).slice(0, 3), [ACTIVIDAD_RECIENTE, filtroActividad]);

  const exportReport = () => {
    const rows = [
      ['Indicador', 'Valor'],
      ['Mandantes activos', String(mandantes.length)],
      ['Contratistas', String(GLOBAL_CONTRATISTAS.length)],
      ['Trabajadores', String(totalWorkers)],
      ['Revisión pendiente', String(cola.length)],
      ['Acreditados', String(accreditationStats.approved)],
      ['En proceso', String(accreditationStats.inProcess)],
      ['Bloqueados', String(accreditationStats.blocked)],
    ];
    const csv = rows.map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'reporte-acredita.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const nav = [
    { label: 'Inicio', icon: Home, tab: 'dashboard', active: true },
    { label: 'Mandantes', icon: Building2, tab: 'mandantes' },
    { label: 'Contratistas', icon: Users, tab: 'contratistas' },
    { label: 'Proyectos', icon: FolderKanban, tab: 'acreditaciones' },
  ];
  const operation = [
    { label: 'Revisión documental', icon: ClipboardCheck, tab: 'cola', count: cola.length },
    { label: 'Incumplimientos', icon: AlertTriangle, tab: 'acreditaciones', count: blockedCount },
    { label: 'Auditoría', icon: FileText, tab: 'auditoria' },
  ];

  return (
    <div className="dashboard-prototype-page">
      <aside className="dashboard-prototype-sidebar">
        <div className="dashboard-brand"><div className="dashboard-logo">A</div><span>Acredita</span></div>
        <div className="dashboard-group"><div className="dashboard-group-title">Principal</div><div className="dashboard-nav">{nav.map((item) => { const Icon = item.icon; return <button key={item.label} type="button" className="dashboard-nav-item active" onClick={() => setActiveTab(item.tab)}><Icon size={16} /><span>{item.label}</span></button>; })}</div></div>
        <div className="dashboard-group"><div className="dashboard-group-title">Operación</div><div className="dashboard-nav">{operation.map((item) => { const Icon = item.icon; return <button key={item.label} type="button" className="dashboard-nav-item" onClick={() => setActiveTab(item.tab)}><Icon size={16} /><span>{item.label}</span>{item.count !== undefined && <em className="dashboard-count">{item.count}</em>}</button>; })}</div></div>
        <div className="dashboard-group"><div className="dashboard-group-title">Sistema</div><div className="dashboard-nav"><button type="button" className="dashboard-nav-item" onClick={() => setActiveTab('reglas')}><Settings size={16} /><span>Configuración</span></button></div></div>
      </aside>

      <main className="dashboard-prototype-main">
        <div className="dashboard-top">
          <div><div className="dashboard-eyebrow">Inicio · Administración</div><h1>Resumen de Acredita</h1><div className="dashboard-sub">Estado general de mandantes, contratistas, acreditaciones y documentación.</div></div>
          <div className="dashboard-actions"><button type="button" onClick={exportReport} className="dashboard-btn"> <Download size={14}/> Exportar reporte</button><button type="button" onClick={() => setActiveTab('mandantes')} className="dashboard-btn dashboard-primary"><UserPlus size={14}/> + Nueva empresa</button></div>
        </div>

        <section className="dashboard-metrics">{
          [
            { label: 'Mandantes activos', value: mandantes.length, note: '+2 durante el último mes', icon: Building2 },
            { label: 'Contratistas', value: GLOBAL_CONTRATISTAS.length, note: `${blockedCount} con incumplimientos`, icon: Users },
            { label: 'Trabajadores', value: totalWorkers, note: `${documentationHealth}% con documentación vigente`, icon: Users },
            { label: 'Revisión pendiente', value: cola.length, note: `${cola.filter((item: any) => item.prio === 'Alta').length} son prioridad alta`, icon: FileCheck2 },
          ].map((metric) => { const Icon = metric.icon; return <article className="dashboard-card dashboard-metric" key={metric.label}><div className="dashboard-metric-top"><span>{metric.label}</span><div className="dashboard-metric-icon"><Icon size={16}/></div></div><div className="dashboard-metric-value">{metric.value.toLocaleString('es-CL')}</div><div className="dashboard-metric-note">{metric.note}</div></article>; })
        }</section>

        <section className="dashboard-hero">
          <article className="dashboard-card dashboard-attention"><div className="dashboard-head"><div><div className="dashboard-title">Atención requerida</div><div className="dashboard-desc">Lo más importante para resolver ahora.</div></div><span className="dashboard-pill">{issues.length} incidencias</span></div><div className="dashboard-issues">{issues.length === 0 ? <div className="dashboard-empty"><CheckCircle size={17}/> No hay incidencias críticas pendientes.</div> : issues.map((issue, index) => <div className="dashboard-issue" key={`${issue.title}-${index}`}><i className={`dashboard-dot ${issue.tone}`}></i><div><strong>{issue.title}</strong><small>{issue.description}</small></div><button type="button" onClick={issue.onClick}>{issue.action} <ArrowRight size={12}/></button></div>)}</div></article>
          <article className="dashboard-card"><div className="dashboard-head"><div><div className="dashboard-title">Salud de acreditación</div><div className="dashboard-desc">Contratistas activos</div></div></div><div className="dashboard-readiness"><div className="dashboard-score"><b>{accreditationStats.percentage}%</b><span>acreditados</span></div><div className="dashboard-bar"><i style={{width: `${accreditationStats.percentage}%`}}></i></div><div className="dashboard-legend"><div><span>🟢 Acreditados</span><strong>{accreditationStats.approved}</strong></div><div><span>🟡 En proceso</span><strong>{accreditationStats.inProcess}</strong></div><div><span>🔴 Bloqueados</span><strong>{accreditationStats.blocked}</strong></div></div></div></article>
        </section>

        <section className="dashboard-grid">
          <article className="dashboard-card dashboard-table-card"><div className="dashboard-head"><div><div className="dashboard-title">Revisión documental</div><div className="dashboard-desc">Elementos que esperan una decisión del equipo administrador.</div></div><button type="button" className="dashboard-link" onClick={() => setActiveTab('cola')}>Ver bandeja <ArrowRight size={12}/></button></div><div className="dashboard-table-wrap"><table className="dashboard-table"><thead><tr><th>Empresa</th><th>Documento</th><th>Proyecto</th><th>Estado</th></tr></thead><tbody>{reviewRows.length === 0 ? <tr><td colSpan={4}>No hay elementos para mostrar.</td></tr> : reviewRows.map((row: any) => <tr key={String(row.id)} onClick={row.onClick}><td><div className="dashboard-company">{row.company}</div><small>Acredita</small></td><td>{row.document}</td><td className="dashboard-muted">{row.project}</td><td><span className={`dashboard-status ${row.statusTone}`}>{row.status}</span></td></tr>)}</tbody></table></div></article>
          <article className="dashboard-card"><div className="dashboard-head"><div><div className="dashboard-title">Accesos rápidos</div><div className="dashboard-desc">Tareas frecuentes del administrador.</div></div></div><div className="dashboard-quick"><button type="button" onClick={() => setActiveTab('cola')}><b>✓ Revisar documentos</b><span>{cola.length} pendientes</span></button><button type="button" onClick={() => setActiveTab('contratistas')}><b>◫ Ver contratistas</b><span>{blockedCount} con incidencias</span></button><button type="button" onClick={() => setActiveTab('acreditaciones')}><b>◈ Ver proyectos</b><span>{GLOBAL_PROYECTOS.length} activos</span></button><button type="button" onClick={() => setActiveTab('auditoria')}><b>◌ Consultar auditoría</b><span>{expired ? `${expired} alertas vencidas` : 'Actividad reciente'}</span></button></div></article>
        </section>

        <section className="dashboard-card dashboard-activity"><div className="dashboard-head"><div><div className="dashboard-title">Actividad reciente</div><div className="dashboard-desc">Últimas acciones relevantes de la plataforma.</div></div><button type="button" className="dashboard-link" onClick={() => setActiveTab('auditoria')}>Ver auditoría <ArrowRight size={12}/></button></div><div className="dashboard-activity-list">{recentActivity.length === 0 ? <div className="dashboard-empty">No hay actividad reciente para este filtro.</div> : recentActivity.map((event, index) => { const name = event.revisor || event.actor || 'Sistema'; return <button key={String(event.id ?? index)} type="button" onClick={() => setActividadSeleccionada(event)} className="dashboard-event"><div className="dashboard-avatar">{initials(name)}</div><div><p><strong>{name}</strong> · {event.evento || event.estado || 'Actualización'} · {event.documento || 'Actividad de plataforma'}</p><span>{event.empresa || 'Acredita'}</span></div><time>{event.hora || event.fecha || 'Hoy'}</time></button>; })}</div></section>
        <div className="dashboard-footer">Acredita · Panel de Administración</div>
      </main>
    </div>
  );
}
