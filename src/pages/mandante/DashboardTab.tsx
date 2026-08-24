import { useMemo, useState } from 'react';
import { AlertCircle, Clock3 } from 'lucide-react';
import { Contratista, Proyecto } from '../../types';
import { buildMandanteProjectSummaries, MandantePriority, sortProjectSummaries } from './inicio/inicioUtils';
import './DashboardTab.css';

export default function DashboardTab({ allContratistas, misProyectos, onOpenProject, onOpenContractor, onOpenWorker }: {
  allContratistas: Contratista[];
  misProyectos: Proyecto[];
  onOpenProject: (projectId: string) => void;
  onOpenContractor: (projectId: string, contractorId: string) => void;
  onOpenWorker: (projectId: string, contractorId: string, workerRut: string) => void;
}) {
  const [projectFilter, setProjectFilter] = useState('all');
  const activeProjects = useMemo(() => misProyectos.filter(project => !['archivado', 'cerrado'].includes(project.estado.toLowerCase())), [misProyectos]);
  const contextProjects = projectFilter === 'all' ? activeProjects : activeProjects.filter(project => project.id === projectFilter);
  const summaries = sortProjectSummaries(buildMandanteProjectSummaries(contextProjects, allContratistas));
  const priorityIdentities = new Set<string>();
  const priorities = summaries.flatMap(summary => summary.priorities)
    .sort((a, b) => a.score - b.score)
    .filter(priority => {
      const identity = priority.workerRut
        ? `${priority.projectId}:${priority.contractorId}:${priority.workerRut}`
        : `${priority.projectId}:empresa`;
      if (priorityIdentities.has(identity)) return false;
      priorityIdentities.add(identity);
      return true;
    })
    .slice(0, 3);
  const projectsWithProblems = summaries.filter(summary => summary.state !== 'Acreditado' || summary.blockedAccreditations > 0 || summary.retainedPayments > 0).length;
  const workersWithoutAccess = summaries.reduce((total, summary) => total + summary.workersTotal - summary.workersEnabled, 0);
  const retainedPayments = summaries.reduce((total, summary) => total + summary.retainedPayments, 0);
  const mostCritical = summaries[0];
  const upToDate = summaries.filter(summary => summary.state === 'Acreditado' && summary.attentionCount === 0);
  const primaryImpact = summaries.some(summary => summary.blockedAccreditations > 0) ? 'Acceso con bloqueos' : retainedPayments > 0 ? 'Pagos con retenciones' : summaries.some(summary => summary.attentionCount > 0) ? 'Pendientes críticos' : 'Sin impacto operativo';
  const quickCopy = mostCritical && mostCritical.state !== 'Acreditado' ? `Hoy el foco está en ${mostCritical.project.nombre}. ${primaryImpact}.` : 'Tus proyectos no presentan bloqueos críticos.';

  const openPriority = (priority: MandantePriority) => {
    if (priority.workerRut) onOpenWorker(priority.projectId, priority.contractorId, priority.workerRut);
    else onOpenContractor(priority.projectId, priority.contractorId);
  };

  return (
    <div className="mandante-inicio fade-in">
      <section className="mandante-inicio-hero">
        <div><div className="mandante-inicio-eyebrow">Control ejecutivo</div><h1>Inicio</h1><p>Una vista simple para saber cómo están tus proyectos, qué está bloqueando la operación y dónde necesitas actuar.</p></div>
        <select className="mandante-inicio-selector" value={projectFilter} onChange={event => setProjectFilter(event.target.value)} aria-label="Filtrar Inicio por proyecto">
          <option value="all">Todos los proyectos</option>
          {activeProjects.map(project => <option key={project.id} value={project.id}>{project.nombre}</option>)}
        </select>
      </section>

      <section className="mandante-inicio-section">
        <div className="mandante-inicio-head"><div><h2>Lo que importa hoy</h2><div className="mandante-inicio-sub">Indicadores que requieren conocimiento o decisión</div></div></div>
        <div className="mandante-inicio-kpis">
          <div className="mandante-inicio-kpi navy"><span>Proyectos activos</span><strong>{summaries.length}</strong><small>{summaries.length === 0 ? 'Aún no tienes proyectos activos' : `${summaries.filter(summary => summary.state === 'Acreditado').length} completamente al día`}</small></div>
          <div className="mandante-inicio-kpi yellow"><span>Proyectos con problemas</span><strong>{projectsWithProblems}</strong><small>{projectsWithProblems === 0 ? 'No hay proyectos con problemas' : 'Requieren acción o seguimiento'}</small></div>
          <div className="mandante-inicio-kpi red"><span>Trabajadores sin acceso</span><strong>{workersWithoutAccess}</strong><small>{workersWithoutAccess === 0 ? 'Todos los trabajadores habilitados' : 'Según su acreditación por proyecto'}</small></div>
          <div className="mandante-inicio-kpi brown"><span>Pagos retenidos</span><strong>{retainedPayments}</strong><small>{retainedPayments === 0 ? 'No hay pagos retenidos' : 'Acreditaciones con retención'}</small></div>
        </div>
      </section>

      <section className="mandante-inicio-section mandante-inicio-grid">
        <div className="mandante-inicio-card">
          <div className="mandante-inicio-head"><div><h2>Estado de tus proyectos</h2><div className="mandante-inicio-sub">La información principal para decidir dónde entrar</div></div></div>
          {summaries.length === 0 ? <div className="mandante-inicio-empty"><strong>Aún no tienes proyectos activos</strong><p>Los proyectos asociados a tu organización aparecerán aquí.</p></div> : <div className="mandante-inicio-projects">{summaries.map(summary => {
            const badgeTone = summary.state === 'Bloqueado' ? 'red' : summary.state === 'En proceso' ? 'yellow' : 'green';
            return <button type="button" key={summary.project.id} className="mandante-inicio-project" onClick={() => onOpenProject(summary.project.id)}><div className="mandante-inicio-project-top"><div><div className="mandante-inicio-project-name">{summary.project.nombre}</div><div className="mandante-inicio-note">{summary.contractors.length} contratista{summary.contractors.length === 1 ? '' : 's'} asociado{summary.contractors.length === 1 ? '' : 's'}</div></div><span className={`mandante-inicio-badge ${badgeTone}`}>{summary.state}</span></div><div className="mandante-inicio-metrics"><div className="mandante-inicio-metric"><strong>{summary.workersEnabled}/{summary.workersTotal}</strong><span>Trabajadores habilitados</span></div><div className={`mandante-inicio-metric ${summary.access === 'Habilitado' ? 'good' : 'bad'}`}><strong>{summary.access}</strong><span>Acceso</span></div><div className={`mandante-inicio-metric ${summary.payment === 'Habilitado' ? 'good' : 'bad'}`}><strong>{summary.payment}</strong><span>Pago</span></div><div className={`mandante-inicio-metric ${summary.attentionCount === 0 ? 'good' : summary.state === 'Bloqueado' ? 'bad' : 'warn'}`}><strong>{summary.attentionCount}</strong><span>Casos que requieren atención</span></div></div></button>;
          })}</div>}
        </div>

        <div>
          <div className="mandante-inicio-card">
            <div className="mandante-inicio-head"><div><h2>Requiere atención</h2><div className="mandante-inicio-sub">Solo lo que necesita acción o seguimiento</div></div>{priorities.length > 0 && <span className="mandante-inicio-badge red">{priorities.length} prioritarios</span>}</div>
            {priorities.length === 0 ? <div className="mandante-inicio-empty"><strong>Todo al día</strong><p>No hay casos críticos en el contexto seleccionado.</p></div> : <div className="mandante-inicio-priorities">{priorities.map(priority => <div className="mandante-inicio-priority" key={priority.key}><div className={`mandante-inicio-icon ${priority.kind === 'por_vencer' ? 'yellow' : 'red'}`}>{priority.kind === 'por_vencer' ? <Clock3 size={18} /> : <AlertCircle size={18} />}</div><div><strong>{priority.title}</strong><p>{priority.detail}</p></div><button type="button" className="mandante-inicio-action" onClick={() => openPriority(priority)}>{priority.workerRut ? 'Ver trabajador' : 'Ver caso'}</button></div>)}</div>}
          </div>

          <div className="mandante-inicio-quick mandante-inicio-section">
            <h3>Lectura rápida</h3><p className="mandante-inicio-quick-copy">{quickCopy}</p>
            <div className="mandante-inicio-quick-list">
              <div className="mandante-inicio-quick-row"><span>Proyecto más crítico</span><strong>{mostCritical?.project.nombre || 'Ninguno'}</strong></div>
              <div className="mandante-inicio-quick-row"><span>Proyecto completamente al día</span><strong>{upToDate.length === 0 ? 'Ninguno' : upToDate.length === 1 ? upToDate[0].project.nombre : `${upToDate.length} proyectos al día`}</strong></div>
              <div className="mandante-inicio-quick-row"><span>Principal impacto operativo</span><strong>{primaryImpact}</strong></div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
