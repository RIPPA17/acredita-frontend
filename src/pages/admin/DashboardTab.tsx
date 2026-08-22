import { useMemo } from 'react';
import { ArrowRight, CheckCircle, Clock3, Download, FileCheck2, FileText, UserPlus, Users, Building2, FolderKanban } from 'lucide-react';
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
  const mandantes = getMandantes();
  const alertas = getAlertasVigencia();
  const invitacionesPendientes = getInvitaciones().filter((inv) => inv.estado === 'pendiente').length;
  const cola = buildColaDocs(GLOBAL_CONTRATISTAS, GLOBAL_PROYECTOS);

  const totalWorkers = GLOBAL_CONTRATISTAS.reduce((sum, contractor) => sum + (contractor.trabajadores?.length ?? 0), 0);

  const blockedCount = GLOBAL_CONTRATISTAS.filter((contractor) => {
    return calcularEstadoAcreditacion(contractor, contractor.proyectos?.[0]) === 'Vencido/Bloqueado';
  }).length;

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
    return { approved, blocked, inProcess, total, percentage: total ? Math.round((approved / total) * 100) : 0 };
  }, [GLOBAL_CONTRATISTAS]);

  const documentationHealth = useMemo(() => {
    let total = 0;
    let valid = 0;
    GLOBAL_CONTRATISTAS.forEach((contractor) => {
      const documents = [
        ...(contractor.documentos ?? []),
        ...((contractor.trabajadores ?? []).flatMap((worker) => worker.documentos ?? [])),
      ];
      documents.forEach((doc) => {
        total += 1;
        if ((doc.estado === 'aprobado' || doc.estado === 'por_vencer') && !esVencidoPorFecha(doc.vencimiento)) valid += 1;
      });
    });
    return total ? Math.round((valid / total) * 100) : 0;
  }, [GLOBAL_CONTRATISTAS]);

  const rejectedDocuments = useMemo(() => {
    return GLOBAL_CONTRATISTAS.reduce((sum, contractor) => {
      const companyRejected = (contractor.documentos ?? []).filter((doc) => doc.estado === 'rechazado').length;
      const workerRejected = (contractor.trabajadores ?? []).reduce(
        (workerSum, worker) => workerSum + (worker.documentos ?? []).filter((doc) => doc.estado === 'rechazado').length,
        0,
      );
      return sum + companyRejected + workerRejected;
    }, 0);
  }, [GLOBAL_CONTRATISTAS]);

  const expiringSoon = alertas.filter((alert) => alert.diasRestantes >= 0 && alert.diasRestantes <= 30).length;
  const expired = alertas.filter((alert) => alert.diasRestantes < 0).length;

  const issues: Issue[] = [
    blockedCount > 0 ? { tone: 'red', title: `${blockedCount} contratistas bloqueados`, description: 'Podrían afectar acceso o continuidad operacional.', action: 'Gestionar', onClick: () => setActiveTab('acreditaciones') } : null,
    rejectedDocuments > 0 ? { tone: 'red', title: `${rejectedDocuments} documentos rechazados`, description: 'Esperan una nueva carga o corrección.', action: 'Revisar', onClick: () => setActiveTab('cola') } : null,
    expiringSoon > 0 ? { tone: 'orange', title: `${expiringSoon} documentos próximos a vencer`, description: 'Vencimiento dentro de los próximos 30 días.', action: 'Ver', onClick: () => setActiveTab('acreditaciones') } : null,
    invitacionesPendientes > 0 ? { tone: 'blue', title: `${invitacionesPendientes} invitaciones pendientes`, description: 'Contratistas todavía no han aceptado.', action: 'Gestionar', onClick: () => setActiveTab('contratistas') } : null,
  ].filter(Boolean) as Issue[];

  const reviewRows = useMemo(() => {
    const rows = cola.slice(0, 4).map((item: any) => ({
      id: item.id,
      company: item.emp,
      document: item.title,
      project: item.proyecto || '—',
      status: item.prio === 'Alta' ? 'Revisión' : 'Pendiente',
      statusTone: item.prio === 'Alta' ? 'danger' : 'warning',
      onClick: () => { setSelectedDocId(item.id); setActiveTab('cola'); },
    }));
    const approved = ACTIVIDAD_RECIENTE.find((item) => String(item.estado).toLowerCase() === 'aprobado');
    if (rows.length < 4 && approved) {
      rows.push({
        id: `activity-${approved.id}`,
        company: approved.empresa,
        document: approved.documento,
        project: approved.proyecto || '—',
        status: 'Aprobado',
        statusTone: 'success',
        onClick: () => setActividadSeleccionada(approved),
      });
    }
    return rows.slice(0, 4);
  }, [ACTIVIDAD_RECIENTE, cola, setActiveTab, setActividadSeleccionada, setSelectedDocId]);

  const recentActivity = useMemo(() => {
    return ACTIVIDAD_RECIENTE.filter((item) => filtroActividad === 'todos' || String(item.estado ?? '').toLowerCase() === filtroActividad.toLowerCase()).slice(0, 3);
  }, [ACTIVIDAD_RECIENTE, filtroActividad]);

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

  const metricCards = [
    { label: 'Mandantes activos', value: mandantes.length, note: 'Organizaciones activas en Acredita', icon: Building2 },
    { label: 'Contratistas', value: GLOBAL_CONTRATISTAS.length, note: blockedCount ? `${blockedCount} con incumplimientos` : 'Sin incumplimientos críticos', icon: Users },
    { label: 'Trabajadores', value: totalWorkers, note: `${documentationHealth}% con documentación vigente`, icon: Users },
    { label: 'Revisión pendiente', value: cola.length, note: `${cola.filter((item: any) => item.prio === 'Alta').length} son prioridad alta`, icon: FileCheck2 },
  ];

  return (
    <div className="fade-in min-h-full bg-[#f5f7fb] text-[#172033] -m-5 md:-m-7 p-5 md:p-7 font-sans">
      <div className="max-w-[1700px] mx-auto">
        <header className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-5">
          <div>
            <div className="text-[12px] text-[#667085] mb-1">Inicio · Administración</div>
            <h1 className="text-[30px] leading-[1.1] font-extrabold tracking-[-0.03em]">Resumen de Acredita</h1>
            <p className="text-[14px] text-[#667085] mt-2">Estado general de mandantes, contratistas, acreditaciones y documentación.</p>
          </div>
          <div className="flex gap-2 w-full xl:w-auto">
            <button type="button" onClick={exportReport} className="inline-flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-[9px] border border-[#d0d5dd] bg-white text-[#344054] text-[13px] font-bold hover:bg-[#f8fafc] transition-colors flex-1 xl:flex-none">
              <Download size={15} /> Exportar reporte
            </button>
            <button type="button" onClick={() => setActiveTab('mandantes')} className="inline-flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-[9px] border border-[#1f5eff] bg-[#1f5eff] text-white text-[13px] font-bold hover:bg-[#1749c7] transition-colors flex-1 xl:flex-none">
              <UserPlus size={15} /> Nueva empresa
            </button>
          </div>
        </header>

        <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3.5 my-6">
          {metricCards.map((metric) => {
            const Icon = metric.icon;
            return (
              <article key={metric.label} className="bg-white border border-[#e7ebf2] rounded-[15px] shadow-[0_2px_8px_rgba(16,24,40,0.025)] p-[17px]">
                <div className="flex justify-between items-center">
                  <span className="text-[12px] text-[#667085] font-bold">{metric.label}</span>
                  <div className="w-[34px] h-[34px] rounded-[10px] bg-[#eef4ff] text-[#1f5eff] grid place-items-center"><Icon size={16} /></div>
                </div>
                <div className="text-[27px] leading-none font-extrabold mt-3">{metric.value.toLocaleString('es-CL')}</div>
                <div className="text-[11px] text-[#667085] mt-1">{metric.note}</div>
              </article>
            );
          })}
        </section>

        <section className="grid grid-cols-1 xl:grid-cols-[1.55fr_.85fr] gap-4 mb-4">
          <article className="bg-white border border-[#e7ebf2] rounded-[15px] shadow-[0_2px_8px_rgba(16,24,40,0.025)] overflow-hidden">
            <div className="flex items-start justify-between gap-4 p-[18px_20px] border-b border-[#e7ebf2]">
              <div><div className="font-extrabold text-[15px]">Atención requerida</div><div className="text-[12px] text-[#667085] mt-1">Lo más importante para resolver ahora.</div></div>
              <span className="text-[11px] font-extrabold rounded-full px-2 py-1 bg-[#eef4ff] text-[#1f5eff] whitespace-nowrap">{issues.length} incidencias</span>
            </div>
            <div className="p-3">
              {issues.length === 0 ? (
                <div className="flex items-center gap-3 p-4 rounded-xl bg-[#f8fafc] text-[13px] text-[#667085]"><CheckCircle size={18} className="text-[#16803c]" />No hay incidencias críticas pendientes.</div>
              ) : issues.map((issue, index) => (
                <div key={`${issue.title}-${index}`} className="grid grid-cols-[10px_1fr_auto] items-center gap-[11px] p-[13px] rounded-[11px] mb-[7px] last:mb-0 bg-[#fafbfc] hover:bg-[#f7f9fc] transition-colors">
                  <span className={`w-[9px] h-[9px] rounded-full ${issue.tone === 'red' ? 'bg-[#d92d20]' : issue.tone === 'orange' ? 'bg-[#f79009]' : 'bg-[#2e90fa]'}`} />
                  <div><div className="text-[13px] font-bold">{issue.title}</div><div className="text-[11px] text-[#667085] mt-[3px]">{issue.description}</div></div>
                  <button type="button" onClick={issue.onClick} className="text-[11px] font-extrabold text-[#1f5eff] inline-flex items-center gap-1 hover:underline">{issue.action} <ArrowRight size={12} /></button>
                </div>
              ))}
            </div>
          </article>

          <article className="bg-white border border-[#e7ebf2] rounded-[15px] shadow-[0_2px_8px_rgba(16,24,40,0.025)] overflow-hidden">
            <div className="p-[18px_20px] border-b border-[#e7ebf2]"><div className="font-extrabold text-[15px]">Salud de acreditación</div><div className="text-[12px] text-[#667085] mt-1">Contratistas activos</div></div>
            <div className="p-5">
              <div className="flex justify-between items-end"><b className="text-[36px] leading-none">{accreditationStats.percentage}%</b><span className="text-[12px] text-[#667085]">acreditados</span></div>
              <div className="h-[10px] bg-[#edf0f4] rounded-full overflow-hidden my-4"><div className="h-full bg-[#16803c] rounded-full" style={{ width: `${accreditationStats.percentage}%` }} /></div>
              <div className="grid gap-2.5 text-[12px]">
                <div className="flex justify-between"><span className="text-[#667085]">🟢 Acreditados</span><strong>{accreditationStats.approved}</strong></div>
                <div className="flex justify-between"><span className="text-[#667085]">🟡 En proceso</span><strong>{accreditationStats.inProcess}</strong></div>
                <div className="flex justify-between"><span className="text-[#667085]">🔴 Bloqueados</span><strong>{accreditationStats.blocked}</strong></div>
              </div>
            </div>
          </article>
        </section>

        <section className="grid grid-cols-1 xl:grid-cols-[1.3fr_.9fr] gap-4 mb-4">
          <article className="bg-white border border-[#e7ebf2] rounded-[15px] shadow-[0_2px_8px_rgba(16,24,40,0.025)] overflow-hidden">
            <div className="flex items-start justify-between gap-4 p-[18px_20px] border-b border-[#e7ebf2]">
              <div><div className="font-extrabold text-[15px]">Revisión documental</div><div className="text-[12px] text-[#667085] mt-1">Elementos que esperan una decisión del equipo administrador.</div></div>
              <button type="button" onClick={() => setActiveTab('cola')} className="text-[11px] font-extrabold text-[#1f5eff] inline-flex items-center gap-1 hover:underline whitespace-nowrap">Ver bandeja <ArrowRight size={12} /></button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead><tr>{['Empresa', 'Documento', 'Proyecto', 'Estado'].map((head) => <th key={head} className="text-left border-b border-[#e7ebf2] px-[18px] py-3 text-[10px] uppercase tracking-[0.05em] text-[#98a2b3] font-semibold">{head}</th>)}</tr></thead>
                <tbody>
                  {reviewRows.length === 0 ? <tr><td colSpan={4} className="px-[18px] py-6 text-[12px] text-[#667085]">No hay elementos para mostrar.</td></tr> : reviewRows.map((row: any) => (
                    <tr key={String(row.id)} className="hover:bg-[#fbfcfe] transition-colors">
                      <td className="border-b border-[#e7ebf2] px-[18px] py-3 text-[12px]"><button type="button" onClick={row.onClick} className="text-left"><div className="font-bold hover:text-[#1f5eff]">{row.company}</div><div className="text-[#667085]">Acredita</div></button></td>
                      <td className="border-b border-[#e7ebf2] px-[18px] py-3 text-[12px]">{row.document}</td>
                      <td className="border-b border-[#e7ebf2] px-[18px] py-3 text-[12px] text-[#667085]">{row.project}</td>
                      <td className="border-b border-[#e7ebf2] px-[18px] py-3 text-[12px]"><span className={`inline-flex rounded-full px-2 py-1 text-[10px] font-extrabold ${row.statusTone === 'danger' ? 'bg-[#fef3f2] text-[#d92d20]' : row.statusTone === 'success' ? 'bg-[#ecfdf3] text-[#16803c]' : 'bg-[#fffaeb] text-[#b54708]'}`}>{row.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>

          <article className="bg-white border border-[#e7ebf2] rounded-[15px] shadow-[0_2px_8px_rgba(16,24,40,0.025)] overflow-hidden">
            <div className="p-[18px_20px] border-b border-[#e7ebf2]"><div className="font-extrabold text-[15px]">Accesos rápidos</div><div className="text-[12px] text-[#667085] mt-1">Tareas frecuentes del administrador.</div></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 p-4">
              <button type="button" onClick={() => setActiveTab('cola')} className="border border-[#e7ebf2] bg-white rounded-xl text-left p-[13px] hover:bg-[#f8fafc] transition-colors"><div className="flex items-center gap-2 text-[12px] font-bold"><FileText size={15} className="text-[#1f5eff]" /> Revisar documentos</div><span className="block text-[11px] text-[#667085] mt-1">{cola.length} pendientes</span></button>
              <button type="button" onClick={() => setActiveTab('contratistas')} className="border border-[#e7ebf2] bg-white rounded-xl text-left p-[13px] hover:bg-[#f8fafc] transition-colors"><div className="flex items-center gap-2 text-[12px] font-bold"><Users size={15} className="text-[#1f5eff]" /> Ver contratistas</div><span className="block text-[11px] text-[#667085] mt-1">{blockedCount} con incidencias</span></button>
              <button type="button" onClick={() => setActiveTab('acreditaciones')} className="border border-[#e7ebf2] bg-white rounded-xl text-left p-[13px] hover:bg-[#f8fafc] transition-colors"><div className="flex items-center gap-2 text-[12px] font-bold"><FolderKanban size={15} className="text-[#1f5eff]" /> Ver acreditaciones</div><span className="block text-[11px] text-[#667085] mt-1">{GLOBAL_PROYECTOS.length} proyectos</span></button>
              <button type="button" onClick={() => setActiveTab('auditoria')} className="border border-[#e7ebf2] bg-white rounded-xl text-left p-[13px] hover:bg-[#f8fafc] transition-colors"><div className="flex items-center gap-2 text-[12px] font-bold"><Clock3 size={15} className="text-[#1f5eff]" /> Consultar auditoría</div><span className="block text-[11px] text-[#667085] mt-1">{expired > 0 ? `${expired} alertas vencidas` : 'Actividad reciente'}</span></button>
            </div>
          </article>
        </section>

        <section className="bg-white border border-[#e7ebf2] rounded-[15px] shadow-[0_2px_8px_rgba(16,24,40,0.025)] overflow-hidden">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3 p-[18px_20px] border-b border-[#e7ebf2]">
            <div><div className="font-extrabold text-[15px]">Actividad reciente</div><div className="text-[12px] text-[#667085] mt-1">Últimas acciones relevantes de la plataforma.</div></div>
            <div className="flex items-center gap-3"><select value={filtroActividad} onChange={(event) => setFiltroActividad(event.target.value)} className="text-[11px] border border-[#d0d5dd] rounded-lg px-2.5 py-2 bg-white"><option value="todos">Todos</option><option value="aprobado">Aprobados</option><option value="rechazado">Rechazados</option><option value="revision">En revisión</option></select><button type="button" onClick={() => setActiveTab('auditoria')} className="text-[11px] font-extrabold text-[#1f5eff] inline-flex items-center gap-1 hover:underline">Ver auditoría <ArrowRight size={12} /></button></div>
          </div>
          <div className="px-[18px] pb-3">
            {recentActivity.length === 0 ? <div className="py-6 text-[12px] text-[#667085]">No hay actividad reciente para este filtro.</div> : recentActivity.map((event, index) => {
              const name = event.revisor || event.actor || 'Sistema';
              return <button type="button" key={String(event.id ?? index)} onClick={() => setActividadSeleccionada(event)} className="w-full grid grid-cols-[30px_1fr_auto] items-center gap-2.5 py-[11px] border-b border-[#e7ebf2] last:border-b-0 text-left hover:bg-[#fbfcfe] transition-colors"><div className="w-[30px] h-[30px] rounded-[9px] bg-[#eef4ff] text-[#1f5eff] grid place-items-center text-[10px] font-extrabold">{initials(name)}</div><div><p className="m-0 text-[11px] leading-5 text-[#172033]"><strong>{name}</strong> · {event.evento || event.estado || 'Actualización'} · {event.documento || 'Actividad de plataforma'}</p><span className="text-[10px] text-[#98a2b3]">{event.empresa || 'Acredita'}</span></div><time className="text-[10px] text-[#98a2b3] whitespace-nowrap">{event.hora || event.fecha || 'Hoy'}</time></button>;
            })}
          </div>
        </section>

        <div className="text-[10px] text-[#98a2b3] text-right mt-2.5">Acredita · Panel de Administración</div>
      </div>
    </div>
  );
}
