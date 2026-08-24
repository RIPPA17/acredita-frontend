import { useMemo, useState } from 'react';
import { AlertCircle, Archive, ArrowLeft, BriefcaseBusiness, CalendarDays, CheckCircle2, ChevronRight, Clock3, KeyRound, MapPin, Plus, Settings2, UsersRound, WalletCards } from 'lucide-react';
import { calcularAccesoPago, calcularEstadoAcreditacion, calcularEstadoTrabajador, esTrabajadorAsignado, getProyectos, getRequisitos, saveProyectos, saveRequisitos } from '../../data/localStorageDb';
import { Contratista, Proyecto, Requisito } from '../../types';
import { buildMandanteProjectSummaries } from './inicio/inicioUtils';
import { buildProjectPresentations, companyObligationSummary, projectStateRank, ProjectPresentation } from './proyectos/proyectosUtils';
import './ProyectosTab.css';

type DetailTab = 'resumen' | 'contratistas' | 'requisitos' | 'acreditaciones';
type ProjectFilter = 'Todos los estados' | 'Bloqueado' | 'En proceso' | 'Acreditado';
interface Props {
  activeProjectTab: string; setActiveProjectTab: (value: string) => void;
  misProyectos: Proyecto[]; allContratistas: Contratista[];
  proyectoSeleccionadoAjustes: string | null; setProyectoSeleccionadoAjustes: (value: string | null) => void;
  showToast: (message: string, type?: 'success' | 'error' | 'warning') => void;
  setNewDocForm: (value: any) => void; setIsAddDocModalOpen: (value: boolean) => void;
  proyectoArchivado: boolean; setProyectoArchivado: (value: boolean) => void;
  selectedProjectId: string | null; setSelectedProjectId: (value: string | null) => void; onOpenContractor: (projectId: string, contractorId: string) => void;
  [key: string]: any;
}
type ProjectMetadata = Proyecto & Partial<{ direccion: string; ubicacion: string; comuna: string; ciudad: string; region: string; fechaInicio: string; inicio: string; fecha_inicio: string }>;

const stateClass = (state: string) => state === 'Acreditado' || state === 'Al día' ? 'green' : state === 'Bloqueado' || state === 'Con problemas' ? 'red' : state === 'Sin requisitos' ? 'gray' : 'yellow';
const accreditationLabel = (state: ReturnType<typeof calcularEstadoAcreditacion>) => state === 'Aprobado' ? 'Acreditado' : state === 'Vencido/Bloqueado' ? 'Bloqueado' : 'En proceso';
const projectLocation = (project: Proyecto) => {
  const item = project as ProjectMetadata;
  if (item.ubicacion) return item.ubicacion;
  if (item.direccion) return item.direccion;
  const parts = [item.comuna || item.ciudad, item.region].filter(Boolean);
  return parts.length ? parts.join(', ') : 'Ubicación no registrada';
};
const projectStartDate = (project: Proyecto) => {
  const item = project as ProjectMetadata;
  const raw = item.fechaInicio || item.inicio || item.fecha_inicio;
  if (!raw) return 'Fecha de inicio no registrada';
  const date = new Date(`${raw}T12:00:00`);
  return Number.isNaN(date.getTime()) ? raw : new Intl.DateTimeFormat('es-CL', { day: 'numeric', month: 'short', year: 'numeric' }).format(date).replace('.', '');
};

function DocumentationBlock({ summary }: { summary: ProjectPresentation }) {
  const { obligations } = summary;
  const percent = obligations.total ? Math.round((obligations.upToDate / obligations.total) * 100) : 0;
  const detail = obligations.total === 0 ? 'Sin requisitos configurados' : obligations.pending === 0 ? 'Sin obligaciones pendientes' : obligations.critical > 0 ? `${obligations.pending} obligaciones requieren atención` : `${obligations.pending} obligaciones pendientes`;
  return <div className="mandante-proyectos-documentation">
    <div className="mandante-proyectos-doc-heading"><span>Documentación total del proyecto</span><strong>{obligations.total ? `${obligations.upToDate} de ${obligations.total} al día` : 'Sin requisitos configurados'}</strong></div>
    <div className="mandante-proyectos-progress" aria-label={`${percent}% de obligaciones al día`}><span className={stateClass(obligations.state)} style={{ width: `${percent}%` }} /></div>
    <div className="mandante-proyectos-doc-footer"><span>{detail}</span><b className={`mandante-proyectos-badge ${stateClass(obligations.state)}`}>{obligations.state}</b></div>
  </div>;
}

export default function ProyectosTab({ activeProjectTab, setActiveProjectTab, misProyectos, allContratistas, proyectoSeleccionadoAjustes, setProyectoSeleccionadoAjustes, showToast, setNewDocForm, setIsAddDocModalOpen, proyectoArchivado, setProyectoArchivado, selectedProjectId, setSelectedProjectId, onOpenContractor }: Props) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<ProjectFilter>('Todos los estados');
  const [configuring, setConfiguring] = useState(false);
  const [requirementsVersion, setRequirementsVersion] = useState(0);
  const summaries = useMemo(() => buildProjectPresentations(misProyectos, allContratistas), [misProyectos, allContratistas, requirementsVersion]);
  const selectedId = proyectoSeleccionadoAjustes || (activeProjectTab !== 'resumen' ? selectedProjectId : null);
  const selected = summaries.find(summary => summary.project.id === selectedId);
  const detailTab = (['resumen', 'contratistas', 'requisitos', 'acreditaciones'].includes(activeProjectTab) ? activeProjectTab : 'resumen') as DetailTab;
  const requirements = selected ? getRequisitos().filter(requirement => requirement.proyectoId === selected.project.id && requirement.activo !== false) : [];
  const executive = selected ? buildMandanteProjectSummaries([selected.project], allContratistas)[0] : null;
  const visible = summaries.filter(summary => filter === 'Todos los estados' || summary.state === filter).filter(summary => {
    const query = search.trim().toLocaleLowerCase('es');
    return !query || `${summary.project.nombre} ${projectLocation(summary.project)}`.toLocaleLowerCase('es').includes(query);
  }).sort((a, b) => projectStateRank[a.state] - projectStateRank[b.state] || a.project.nombre.localeCompare(b.project.nombre, 'es'));

  const openProject = (summary: ProjectPresentation) => {
    setProyectoSeleccionadoAjustes(summary.project.id); setSelectedProjectId(summary.project.id); setProyectoArchivado(summary.project.estado === 'Archivado'); setActiveProjectTab('resumen'); setConfiguring(false); window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const backToProjects = () => { setProyectoSeleccionadoAjustes(null); setActiveProjectTab('resumen'); setConfiguring(false); };
  const archiveProject = () => {
    if (!selected) return;
    const projects = getProyectos(); const index = projects.findIndex(project => project.id === selected.project.id);
    if (index < 0) return;
    projects[index].estado = 'Archivado'; saveProyectos(projects); setProyectoArchivado(true); showToast('Proyecto archivado', 'warning');
  };
  const addRequirement = () => {
    if (!selected) return;
    setNewDocForm({ name: '', category: 'Laboral', frequency: 'Mensual', destino: 'empresa', obligatorio: true, criticidad: 'bloquea_pago', projectId: selected.project.id }); setIsAddDocModalOpen(true);
  };

  if (!selected) return <section className="mandante-proyectos fade-in">
    <header className="mandante-proyectos-page-head"><div><h1>Proyectos</h1><p>Vista general de tus proyectos. Abre una tarjeta para revisar toda su gestión y acreditación.</p></div><div className="mandante-proyectos-toolbar">
      <label><span className="sr-only">Buscar proyecto</span><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar proyecto..." /></label>
      <label><span className="sr-only">Filtrar por estado</span><select value={filter} onChange={event => setFilter(event.target.value as ProjectFilter)}><option>Todos los estados</option><option>Bloqueado</option><option>En proceso</option><option>Acreditado</option></select></label>
    </div></header>
    <div className="mandante-proyectos-grid">{visible.map(summary => <button type="button" className="mandante-proyectos-card" key={summary.project.id} onClick={() => openProject(summary)}>
      <div className="mandante-proyectos-cover"><div><span>{summary.project.estado === 'Archivado' ? 'Proyecto archivado' : 'Proyecto activo'}</span><h2>{summary.project.nombre}</h2></div><b className={`mandante-proyectos-badge ${stateClass(summary.state)}`}>{summary.state}</b></div>
      <div className="mandante-proyectos-card-body"><div className="mandante-proyectos-presentation"><span><MapPin />{projectLocation(summary.project)}</span><span><CalendarDays />{projectStartDate(summary.project)}</span></div>
        <div className="mandante-proyectos-people"><span><strong>{summary.workers.length}</strong>Trabajadores</span><span><strong>{summary.contractors.length}</strong>Contratistas</span></div><DocumentationBlock summary={summary} /><span className="mandante-proyectos-open">Ver proyecto <ChevronRight /></span></div>
    </button>)}</div>
    {visible.length === 0 && <div className="mandante-proyectos-empty">No hay proyectos que coincidan con la búsqueda y el estado seleccionado.</div>}
  </section>;

  if (configuring) return <section className="mandante-proyectos fade-in"><button type="button" className="mandante-proyectos-back" onClick={() => setConfiguring(false)}><ArrowLeft /> Volver al proyecto</button>
    <div className="mandante-proyectos-config"><header><div><span>Configuración del proyecto</span><h1>{selected.project.nombre}</h1><p>Administra el estado del proyecto sin salir de su contexto.</p></div><Settings2 /></header>
      <div className="mandante-proyectos-config-grid"><div><span>Ubicación</span><strong>{projectLocation(selected.project)}</strong></div><div><span>Fecha de inicio</span><strong>{projectStartDate(selected.project)}</strong></div><div><span>Estado administrativo</span><strong>{selected.project.estado}</strong></div><div><span>Requisitos activos</span><strong>{requirements.length}</strong></div></div>
      <div className="mandante-proyectos-danger"><div><strong>Archivar proyecto</strong><p>El proyecto deja de considerarse activo, pero conserva su información.</p></div><button type="button" onClick={archiveProject} disabled={proyectoArchivado}><Archive />{proyectoArchivado ? 'Proyecto archivado' : 'Archivar proyecto'}</button></div>
    </div></section>;

  return <section className="mandante-proyectos mandante-proyectos-detail fade-in">
    <button type="button" className="mandante-proyectos-back" onClick={backToProjects}><ArrowLeft /> Volver a proyectos</button>
    <header className="mandante-proyectos-hero"><div><span>{selected.project.estado === 'Archivado' ? 'Proyecto archivado' : 'Proyecto activo'}</span><h1>{selected.project.nombre}</h1><p>Gestiona la acreditación completa del proyecto desde un espacio dedicado.</p></div><div className="mandante-proyectos-hero-actions"><b className={`mandante-proyectos-badge ${stateClass(selected.state)}`}>{selected.state}</b><button type="button" onClick={() => setConfiguring(true)}><Settings2 /> Configurar proyecto</button></div></header>
    <nav className="mandante-proyectos-tabs" aria-label="Secciones del proyecto">{(['resumen', 'contratistas', 'requisitos', 'acreditaciones'] as DetailTab[]).map(tab => <button type="button" key={tab} className={detailTab === tab ? 'active' : ''} onClick={() => setActiveProjectTab(tab)}>{tab.charAt(0).toUpperCase() + tab.slice(1)}</button>)}</nav>
    {detailTab === 'resumen' && <SummaryPanel selected={selected} executive={executive} />}
    {detailTab === 'contratistas' && <ContractorsPanel selected={selected} projects={misProyectos} onOpen={onOpenContractor} />}
    {detailTab === 'requisitos' && <RequirementsPanel requirements={requirements} onAdd={addRequirement} onChanged={() => setRequirementsVersion(value => value + 1)} showToast={showToast} />}
    {detailTab === 'acreditaciones' && <AccreditationsPanel selected={selected} requirements={requirements} onOpen={onOpenContractor} />}
  </section>;
}

function SummaryPanel({ selected, executive }: { selected: ProjectPresentation; executive: ReturnType<typeof buildMandanteProjectSummaries>[number] | null }) {
  return <div className="mandante-proyectos-panel"><div className="mandante-proyectos-kpis"><div><BriefcaseBusiness /><span>Contratistas</span><strong>{selected.contractors.length}</strong></div><div><UsersRound /><span>Trabajadores habilitados</span><strong>{selected.workersEnabled}/{selected.workers.length}</strong></div><div className={selected.access === 'Habilitado' ? 'good' : 'bad'}><KeyRound /><span>Acceso</span><strong>{selected.access}</strong></div><div className={selected.payment === 'Habilitado' ? 'good' : 'bad'}><WalletCards /><span>Pago</span><strong>{selected.payment}</strong></div></div>
    <div className="mandante-proyectos-two-columns"><article className="mandante-proyectos-section-card"><h2>Requiere atención</h2><p>Problemas que afectan la operación o el avance de la acreditación.</p><div className="mandante-proyectos-attention-list">{(executive?.priorities || []).map(priority => <div key={priority.key}><span className={priority.kind === 'por_vencer' ? 'yellow' : 'red'}>{priority.kind === 'por_vencer' ? <Clock3 /> : <AlertCircle />}</span><div><strong>{priority.title}</strong><p>{priority.detail}</p></div></div>)}{!executive?.priorities.length && <div className="mandante-proyectos-clear"><CheckCircle2 /> No hay casos que requieran acción.</div>}</div></article>
      <article className="mandante-proyectos-section-card"><h2>Situación general</h2><p>Resumen del estado actual del proyecto.</p><dl className="mandante-proyectos-summary-list"><div><dt>Acreditaciones aprobadas</dt><dd>{selected.approvedAccreditations} de {selected.contractors.length}</dd></div><div><dt>Acreditaciones bloqueadas</dt><dd>{selected.blockedAccreditations}</dd></div><div><dt>Casos que requieren atención</dt><dd>{selected.attentionCount}</dd></div><div><dt>En revisión por Acredita</dt><dd>{selected.inReview}</dd></div></dl></article></div>
  </div>;
}

function ContractorsPanel({ selected, projects, onOpen }: { selected: ProjectPresentation; projects: Proyecto[]; onOpen: Props['onOpenContractor'] }) {
  return <article className="mandante-proyectos-section-card mandante-proyectos-panel"><h2>Contratistas del proyecto</h2><p>Cada empresa se evalúa dentro de este proyecto, nunca de forma global.</p><div className="mandante-proyectos-table-wrap"><table><thead><tr><th>Contratista</th><th>Acreditación</th><th>Trabajadores</th><th>Acceso</th><th>Pago</th><th>Acción</th></tr></thead><tbody>{selected.contractors.map(contractor => {
    const accreditation = accreditationLabel(calcularEstadoAcreditacion(contractor, selected.project.id));
    const assigned = (contractor.trabajadores || []).filter(worker => esTrabajadorAsignado(worker, selected.project.id, projects));
    const enabled = assigned.filter(worker => ['aprobado', 'por_vencer'].includes(calcularEstadoTrabajador(worker, selected.project.id))).length;
    const result = calcularAccesoPago(contractor, selected.project.id);
    return <tr key={contractor.id}><td><strong>{contractor.nombre}</strong><small>{contractor.rut}</small></td><td><b className={`mandante-proyectos-badge ${stateClass(accreditation)}`}>{accreditation}</b></td><td>{enabled}/{assigned.length}</td><td>{result.accesoBloqueado ? 'Con bloqueos' : 'Habilitado'}</td><td>{result.pagoBloqueado ? 'Retenido' : 'Habilitado'}</td><td><button type="button" onClick={() => onOpen(selected.project.id, contractor.id)}>Ver contratista</button></td></tr>;
  })}</tbody></table></div></article>;
}

function RequirementsPanel({ requirements, onAdd, onChanged, showToast }: { requirements: Requisito[]; onAdd: () => void; onChanged: () => void; showToast: Props['showToast'] }) {
  return <article className="mandante-proyectos-section-card mandante-proyectos-panel"><div className="mandante-proyectos-section-head"><div><h2>Requisitos del proyecto</h2><p>Define qué debe cumplir cada empresa y trabajador.</p></div><button type="button" onClick={onAdd}><Plus /> Agregar requisito</button></div><div className="mandante-proyectos-requirements">{requirements.map(requirement => <div className="mandante-proyectos-requirement" key={requirement.id}><div><strong>{requirement.nombre}</strong><span>{requirement.destino === 'empresa' ? 'Empresa' : 'Trabajador'} · {requirement.frecuencia} · {requirement.criticidad.replaceAll('_', ' ')} · Alerta {requirement.alertaDias} días</span></div><button type="button" className={requirement.obligatorio ? 'mandatory' : 'optional'} onClick={() => {
    const list = getRequisitos(); const index = list.findIndex(item => item.id === requirement.id); if (index < 0) return; list[index].obligatorio = !list[index].obligatorio; saveRequisitos(list); onChanged(); showToast(list[index].obligatorio ? 'Requisito marcado como obligatorio' : 'Requisito marcado como opcional');
  }}>{requirement.obligatorio ? 'Obligatorio' : 'Opcional'}</button></div>)}{requirements.length === 0 && <div className="mandante-proyectos-empty">No hay requisitos activos para este proyecto.</div>}</div></article>;
}

function AccreditationsPanel({ selected, requirements, onOpen }: { selected: ProjectPresentation; requirements: Requisito[]; onOpen: Props['onOpenContractor'] }) {
  return <article className="mandante-proyectos-section-card mandante-proyectos-panel"><h2>Acreditaciones del proyecto</h2><p>Vista consolidada de Contratista + Mandante + Proyecto.</p><div className="mandante-proyectos-accreditations">{selected.contractors.map(contractor => {
    const accreditation = accreditationLabel(calcularEstadoAcreditacion(contractor, selected.project.id)); const workers = selected.workers.filter(item => item.contractor.id === contractor.id); const enabled = workers.filter(item => ['aprobado', 'por_vencer'].includes(calcularEstadoTrabajador(item.worker, selected.project.id))).length; const result = calcularAccesoPago(contractor, selected.project.id);
    return <div key={contractor.id}><span><strong>{contractor.nombre}</strong><small>{selected.project.nombre}</small></span><span><small>Estado</small><b className={`mandante-proyectos-badge ${stateClass(accreditation)}`}>{accreditation}</b></span><span><small>Empresa</small><strong>{companyObligationSummary(contractor, selected.project.id, requirements)}</strong></span><span><small>Trabajadores</small><strong>{enabled}/{workers.length}</strong></span><span><small>Acceso</small><strong>{result.accesoBloqueado ? 'Bloqueado' : 'Habilitado'}</strong></span><span><small>Pago</small><strong>{result.pagoBloqueado ? 'Retenido' : 'Habilitado'}</strong></span><button type="button" onClick={() => onOpen(selected.project.id, contractor.id)}>Abrir</button></div>;
  })}</div></article>;
}
