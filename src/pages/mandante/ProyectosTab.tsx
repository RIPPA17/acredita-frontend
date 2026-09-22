import { useMemo, useState } from 'react';
import { AlertCircle, Archive, ArrowLeft, BriefcaseBusiness, CalendarDays, CheckCircle2, ChevronRight, Clock3, Download, KeyRound, MapPin, Pencil, Plus, Save, Settings2, UsersRound, WalletCards, X } from 'lucide-react';
import { calcularAccesoPago, calcularEstadoAcreditacion, calcularEstadoTrabajador, configuracionRequisitoRequiereObligatoriedad, esTrabajadorAsignado, getContratistas, getProyectos, getRequisitos, saveProyectos, saveRequisitos } from '../../data/businessStore';
import { Contratista, Proyecto, Requisito } from '../../types';
import { buildMandanteProjectSummaries } from './inicio/inicioUtils';
import { buildProjectPresentations, companyObligationSummary, projectStateRank, ProjectPresentation } from './proyectos/proyectosUtils';
import { confirmBusinessPersistence } from '../../data/supabasePersistence';
import './ProyectosTab.css';
import ServicesPanel from '../../components/ServicesPanel';
import { getCierresDocumentales, getObligacionesDocumentales, getServiciosProyecto } from '../../data/operationalCore';
import CompliancePeriodsPanel from '../../components/CompliancePeriodsPanel';
import { setContractorParent } from '../../data/supabaseContractorHierarchy';
import AssetsPanel from '../../components/AssetsPanel';
import { downloadProjectPackage } from '../../data/projectReports';
import OperationsCenter from '../../components/OperationsCenter';

type DetailTab = 'resumen' | 'contratistas' | 'servicios' | 'activos' | 'requisitos' | 'periodos' | 'operacion' | 'acreditaciones';
type ProjectFilter = 'Todos los estados' | 'Bloqueado' | 'En proceso' | 'Acreditado';
type RequirementEditForm = {
  frequency: string;
  criticidad: Requisito['criticidad'];
  alertaDias: number;
  diasPlazo: number;
  description: string;
  checklist: string;
  categories: string;
  bloqueaTrabajo: boolean;
  bloqueaAsignacion: boolean;
  servicioId: string;
};
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
  const [servicesVersion, setServicesVersion] = useState(0);
  const [periodsVersion, setPeriodsVersion] = useState(0);
  const [contractorsVersion, setContractorsVersion] = useState(0);
  const contractors = contractorsVersion > 0 ? getContratistas() : allContratistas;
  const summaries = useMemo(() => buildProjectPresentations(misProyectos, contractors), [misProyectos, contractors, requirementsVersion, contractorsVersion]);
  const selectedId = proyectoSeleccionadoAjustes || (activeProjectTab !== 'resumen' ? selectedProjectId : null);
  const selected = summaries.find(summary => summary.project.id === selectedId);
  const detailTab = (['resumen', 'contratistas', 'servicios', 'activos', 'requisitos', 'periodos', 'operacion', 'acreditaciones'].includes(activeProjectTab) ? activeProjectTab : 'resumen') as DetailTab;
  const requirements = selected ? getRequisitos().filter(requirement => requirement.proyectoId === selected.project.id && requirement.activo !== false) : [];
  const executive = selected ? buildMandanteProjectSummaries([selected.project], contractors)[0] : null;
  const visible = summaries.filter(summary => filter === 'Todos los estados' || summary.state === filter).filter(summary => {
    const query = search.trim().toLocaleLowerCase('es');
    return !query || `${summary.project.nombre} ${projectLocation(summary.project)}`.toLocaleLowerCase('es').includes(query);
  }).sort((a, b) => projectStateRank[a.state] - projectStateRank[b.state] || a.project.nombre.localeCompare(b.project.nombre, 'es'));

  const openProject = (summary: ProjectPresentation) => {
    setProyectoSeleccionadoAjustes(summary.project.id); setSelectedProjectId(summary.project.id); setProyectoArchivado(summary.project.estado === 'Archivado'); setActiveProjectTab('resumen'); setConfiguring(false); window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const backToProjects = () => { setProyectoSeleccionadoAjustes(null); setActiveProjectTab('resumen'); setConfiguring(false); };
  const archiveProject = async () => {
    if (!selected) return;
    const confirmed = window.confirm(`¿Archivar "${selected.project.nombre}"?\n\nEl proyecto dejará de considerarse activo, pero conservará su información y trazabilidad.`);
    if (!confirmed) return;
    const projects = getProyectos(); const index = projects.findIndex(project => project.id === selected.project.id);
    if (index < 0) return;
    projects[index].estado = 'Archivado';
    saveProyectos(projects);
    try {
      await confirmBusinessPersistence('core');
      setProyectoArchivado(true);
      showToast('Proyecto archivado', 'warning');
    } catch (error) {
      setProyectoArchivado(getProyectos().find(project => project.id === selected.project.id)?.estado === 'Archivado');
      console.error('No fue posible archivar el proyecto.', error);
      showToast('No fue posible archivar el proyecto. Intenta nuevamente.', 'error');
    }
  };
  const addRequirement = () => {
    if (!selected) return;
    setNewDocForm({ name: '', category: 'Laboral', frequency: 'Mensual', destino: 'empresa', obligatorio: true, criticidad: 'bloquea_pago', description: '', checklist: '', categories: '', bloqueaTrabajo: false, bloqueaAsignacion: false, servicioId: '', dueDays: 5, projectId: selected.project.id }); setIsAddDocModalOpen(true);
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
    <div className="mandante-proyectos-config"><header><div><span>Administración del proyecto</span><h1>{selected.project.nombre}</h1><p>Consulta sus datos generales y administra su estado sin salir del contexto.</p></div><Settings2 /></header>
      <div className="mandante-proyectos-config-grid"><div><span>Ubicación</span><strong>{projectLocation(selected.project)}</strong></div><div><span>Fecha de inicio</span><strong>{projectStartDate(selected.project)}</strong></div><div><span>Estado administrativo</span><strong>{selected.project.estado}</strong></div><div><span>Requisitos activos</span><strong>{requirements.length}</strong></div></div>
      <div className="mandante-proyectos-danger"><div><strong>Archivar proyecto</strong><p>El proyecto deja de considerarse activo, pero conserva su información.</p></div><button type="button" onClick={archiveProject} disabled={proyectoArchivado}><Archive />{proyectoArchivado ? 'Proyecto archivado' : 'Archivar proyecto'}</button></div>
    </div></section>;

  return <section className="mandante-proyectos mandante-proyectos-detail fade-in">
    <button type="button" className="mandante-proyectos-back" onClick={backToProjects}><ArrowLeft /> Volver a proyectos</button>
    <header className="mandante-proyectos-hero"><div><span>{selected.project.estado === 'Archivado' ? 'Proyecto archivado' : 'Proyecto activo'}</span><h1>{selected.project.nombre}</h1><p>Gestiona la acreditación completa del proyecto desde un espacio dedicado.</p></div><div className="mandante-proyectos-hero-actions"><b className={`mandante-proyectos-badge ${stateClass(selected.state)}`}>{selected.state}</b><button type="button" onClick={() => setConfiguring(true)}><Settings2 /> Administrar proyecto</button></div></header>
    <nav className="mandante-proyectos-tabs" aria-label="Secciones del proyecto">{(['resumen', 'contratistas', 'servicios', 'activos', 'requisitos', 'periodos', 'operacion', 'acreditaciones'] as DetailTab[]).map(tab => <button type="button" key={tab} className={detailTab === tab ? 'active' : ''} onClick={() => setActiveProjectTab(tab)}>{tab.charAt(0).toUpperCase() + tab.slice(1)}</button>)}</nav>
    {detailTab === 'resumen' && <SummaryPanel selected={selected} executive={executive} />}
    {detailTab === 'contratistas' && <ContractorsPanel selected={selected} projects={misProyectos} onOpen={onOpenContractor} onChanged={() => setContractorsVersion(value => value + 1)} showToast={showToast} />}
    {detailTab === 'servicios' && <ServicesPanel project={selected.project} contractors={selected.contractors} services={getServiciosProyecto(selected.project.id)} onChanged={() => setServicesVersion(value => value + 1)} showToast={showToast} />}
    {detailTab === 'activos' && <AssetsPanel project={selected.project} contractors={selected.contractors} services={getServiciosProyecto(selected.project.id)} showToast={showToast} />}
    {detailTab === 'requisitos' && <RequirementsPanel requirements={requirements} onAdd={addRequirement} onChanged={() => setRequirementsVersion(value => value + 1)} showToast={showToast} />}
    {detailTab === 'periodos' && <CompliancePeriodsPanel periods={getCierresDocumentales().filter(item => item.proyectoId === selected.project.id)} onChanged={() => setPeriodsVersion(value => value + 1)} showToast={showToast} />}
    {detailTab === 'operacion' && <OperationsCenter project={selected.project} contractors={selected.contractors} showToast={showToast} />}
    {detailTab === 'acreditaciones' && <AccreditationsPanel selected={selected} requirements={requirements} onOpen={onOpenContractor} />}
  </section>;
}

function SummaryPanel({ selected, executive }: { selected: ProjectPresentation; executive: ReturnType<typeof buildMandanteProjectSummaries>[number] | null }) {
  return <div className="mandante-proyectos-panel"><div className="mandante-proyectos-kpis"><div><BriefcaseBusiness /><span>Contratistas</span><strong>{selected.contractors.length}</strong></div><div><UsersRound /><span>Trabajadores habilitados</span><strong>{selected.workersEnabled}/{selected.workers.length}</strong></div><div className={selected.access === 'Habilitado' ? 'good' : 'bad'}><KeyRound /><span>Acceso</span><strong>{selected.access}</strong></div><div className={selected.payment === 'Habilitado' ? 'good' : 'bad'}><WalletCards /><span>Pago</span><strong>{selected.payment}</strong></div></div>
    <div className="mandante-proyectos-two-columns"><article className="mandante-proyectos-section-card"><h2>Requiere atención</h2><p>Problemas que afectan la operación o el avance de la acreditación.</p><div className="mandante-proyectos-attention-list">{(executive?.priorities || []).map(priority => <div key={priority.key}><span className={priority.kind === 'por_vencer' ? 'yellow' : 'red'}>{priority.kind === 'por_vencer' ? <Clock3 /> : <AlertCircle />}</span><div><strong>{priority.title}</strong><p>{priority.detail}</p></div></div>)}{!executive?.priorities.length && <div className="mandante-proyectos-clear"><CheckCircle2 /> No hay casos que requieran acción.</div>}</div></article>
      <article className="mandante-proyectos-section-card"><h2>Situación general</h2><p>Resumen del estado actual del proyecto.</p><dl className="mandante-proyectos-summary-list"><div><dt>Acreditaciones aprobadas</dt><dd>{selected.approvedAccreditations} de {selected.contractors.length}</dd></div><div><dt>Acreditaciones bloqueadas</dt><dd>{selected.blockedAccreditations}</dd></div><div><dt>Casos que requieren atención</dt><dd>{selected.attentionCount}</dd></div><div><dt>En revisión por Acredita</dt><dd>{selected.inReview}</dd></div></dl></article></div>
  </div>;
}

function ContractorsPanel({ selected, projects, onOpen, onChanged, showToast }: { selected: ProjectPresentation; projects: Proyecto[]; onOpen: Props['onOpenContractor']; onChanged: () => void; showToast: Props['showToast'] }) {
  const [savingId, setSavingId] = useState<string | null>(null);
  const contractorById = new Map(selected.contractors.map(item => [item.id, item]));
  const canBeParent = (candidate: Contratista, childId: string) => {
    if (candidate.id === childId) return false;
    let current: Contratista | undefined = candidate;
    const visited = new Set<string>();
    while (current?.contratistaPadreId && !visited.has(current.id)) {
      if (current.contratistaPadreId === childId) return false;
      visited.add(current.id);
      current = contractorById.get(current.contratistaPadreId);
    }
    return true;
  };
  const updateParent = async (contractor: Contratista, parentId: string) => {
    if (savingId) return;
    setSavingId(contractor.id);
    try {
      await setContractorParent(selected.project.id, contractor.id, parentId || undefined);
      onChanged();
      showToast(parentId ? 'Relación de subcontratación actualizada.' : 'Contratista marcado como principal.');
    } catch (error) {
      console.error('No fue posible actualizar la relación del contratista.', error);
      showToast('No fue posible actualizar la relación de subcontratación.', 'error');
    } finally {
      setSavingId(null);
    }
  };
  return <article className="mandante-proyectos-section-card mandante-proyectos-panel"><h2>Contratistas del proyecto</h2><p>Organiza contratistas principales y subcontratistas, manteniendo una acreditación independiente por empresa.</p><div className="mandante-proyectos-table-wrap"><table><thead><tr><th>Contratista</th><th>Relación</th><th>Acreditación</th><th>Trabajadores</th><th>Acceso</th><th>Pago</th><th>Acción</th></tr></thead><tbody>{selected.contractors.map(contractor => {
    const accreditation = accreditationLabel(calcularEstadoAcreditacion(contractor, selected.project.id));
    const assigned = (contractor.trabajadores || []).filter(worker => esTrabajadorAsignado(worker, selected.project.id, projects));
    const enabled = assigned.filter(worker => ['aprobado', 'por_vencer'].includes(calcularEstadoTrabajador(worker, selected.project.id))).length;
    const result = calcularAccesoPago(contractor, selected.project.id);
    return <tr key={contractor.id}><td><strong>{contractor.nombre}</strong><small>{contractor.rut}</small></td><td><select aria-label={`Relación de ${contractor.nombre}`} value={contractor.contratistaPadreId || ''} disabled={savingId === contractor.id} onChange={event => void updateParent(contractor, event.target.value)}><option value="">Principal</option>{selected.contractors.filter(item => canBeParent(item, contractor.id)).map(item => <option value={item.id} key={item.id}>Subcontratista de {item.nombre}</option>)}</select></td><td><b className={`mandante-proyectos-badge ${stateClass(accreditation)}`}>{accreditation}</b></td><td>{enabled}/{assigned.length}</td><td>{result.accesoEstado === 'bloqueado' ? 'Con bloqueos' : result.accesoEstado === 'pendiente' ? 'Pendiente' : 'Habilitado'}</td><td>{result.pagoEstado === 'bloqueado' ? 'Retenido' : result.pagoEstado === 'pendiente' ? 'Pendiente' : 'Habilitado'}</td><td><button type="button" onClick={() => onOpen(selected.project.id, contractor.id)}>Ver contratista</button></td></tr>;
  })}</tbody></table></div></article>;
}

function RequirementsPanel({ requirements, onAdd, onChanged, showToast }: { requirements: Requisito[]; onAdd: () => void; onChanged: () => void; showToast: Props['showToast'] }) {
  const [savingRequirementId, setSavingRequirementId] = useState<string | null>(null);
  const [editingRequirement, setEditingRequirement] = useState<Requisito | null>(null);
  const [editForm, setEditForm] = useState<RequirementEditForm | null>(null);

  const toggleRequired = async (requirement: Requisito) => {
    if (savingRequirementId) return;
    if (
      requirement.obligatorio
      && configuracionRequisitoRequiereObligatoriedad(requirement.criticidad, Boolean(requirement.bloqueaTrabajo), Boolean(requirement.bloqueaAsignacion))
    ) {
      showToast('Un requisito que bloquea una operación no puede ser opcional.', 'warning');
      return;
    }
    const list = getRequisitos();
    const index = list.findIndex(item => item.id === requirement.id);
    if (index < 0) return;
    list[index].obligatorio = !list[index].obligatorio;
    setSavingRequirementId(requirement.id);
    saveRequisitos(list);
    try {
      await confirmBusinessPersistence('core');
      onChanged();
      showToast(list[index].obligatorio ? 'Requisito marcado como obligatorio' : 'Requisito marcado como opcional');
    } catch (error) {
      onChanged();
      console.error('No fue posible actualizar el requisito.', error);
      showToast('No fue posible actualizar el requisito. Intenta nuevamente.', 'error');
    } finally {
      setSavingRequirementId(null);
    }
  };

  const openEdit = (requirement: Requisito) => {
    setEditingRequirement(requirement);
    setEditForm({
      frequency: requirement.frecuencia,
      criticidad: requirement.criticidad,
      alertaDias: requirement.alertaDias,
      diasPlazo: requirement.diasPlazo ?? 5,
      description: requirement.descripcion || '',
      checklist: (requirement.checklistRevision || []).join('\n'),
      categories: (requirement.categoriasAplicables || []).join(', '),
      bloqueaTrabajo: Boolean(requirement.bloqueaTrabajo),
      bloqueaAsignacion: Boolean(requirement.bloqueaAsignacion),
      servicioId: requirement.servicioId || '',
    });
  };

  const saveEdit = async () => {
    if (!editingRequirement || !editForm || savingRequirementId) return;
    const list = getRequisitos();
    const index = list.findIndex(item => item.id === editingRequirement.id);
    if (index < 0) return;
    setSavingRequirementId(editingRequirement.id);
    const mustBeRequired = configuracionRequisitoRequiereObligatoriedad(
      editForm.criticidad,
      editForm.bloqueaTrabajo,
      editForm.bloqueaAsignacion,
    );
    list[index] = {
      ...list[index],
      obligatorio: mustBeRequired ? true : list[index].obligatorio,
      frecuencia: editForm.frequency,
      criticidad: editForm.criticidad,
      alertaDias: Math.min(365, Math.max(0, Number(editForm.alertaDias) || 0)),
      diasPlazo: Math.min(90, Math.max(0, Number(editForm.diasPlazo) || 0)),
      descripcion: editForm.description.trim() || undefined,
      checklistRevision: editForm.checklist.split('\n').map(item => item.trim()).filter(Boolean),
      categoriasAplicables: editForm.categories.split(',').map(item => item.trim()).filter(Boolean),
      bloqueaTrabajo: editForm.bloqueaTrabajo,
      bloqueaAsignacion: editForm.bloqueaAsignacion,
      servicioId: editForm.servicioId || undefined,
    };
    saveRequisitos(list);
    try {
      await confirmBusinessPersistence('core');
      onChanged();
      setEditingRequirement(null);
      setEditForm(null);
      showToast('Configuración del requisito actualizada');
    } catch (error) {
      onChanged();
      console.error('No fue posible actualizar el requisito.', error);
      showToast('No fue posible guardar los cambios del requisito.', 'error');
    } finally {
      setSavingRequirementId(null);
    }
  };

  return <>
    <article className="mandante-proyectos-section-card mandante-proyectos-panel"><div className="mandante-proyectos-section-head"><div><h2>Requisitos del proyecto</h2><p>Define qué debe cumplir cada empresa y trabajador.</p></div><button type="button" onClick={onAdd}><Plus /> Agregar requisito</button></div><div className="mandante-proyectos-requirements">{requirements.map(requirement => <div className="mandante-proyectos-requirement" key={requirement.id}><div><strong>{requirement.nombre}</strong><span>{requirement.destino === 'empresa' ? 'Empresa' : 'Trabajador'} · {requirement.frecuencia} · {requirement.criticidad.replaceAll('_', ' ')} · Alerta {requirement.alertaDias} días · Plazo {requirement.diasPlazo ?? 5} días</span>{requirement.descripcion && <p>{requirement.descripcion}</p>}{Boolean(requirement.checklistRevision?.length) && <small>{requirement.checklistRevision!.length} criterios de revisión</small>}{Boolean(requirement.categoriasAplicables?.length) && <small>Aplica a: {requirement.categoriasAplicables!.join(', ')}</small>}</div><div className="mandante-proyectos-requirement-actions"><button type="button" className="edit" onClick={() => openEdit(requirement)}><Pencil /> Editar</button><button type="button" role="switch" aria-checked={requirement.obligatorio} disabled={savingRequirementId === requirement.id} className={`requirement-switch ${requirement.obligatorio ? 'mandatory' : 'optional'}`} onClick={() => void toggleRequired(requirement)}><span className="requirement-switch-track"><i /></span><b>{savingRequirementId === requirement.id ? 'Guardando…' : requirement.obligatorio ? 'Obligatorio' : 'Opcional'}</b></button></div></div>)}{requirements.length === 0 && <div className="mandante-proyectos-empty">No hay requisitos activos para este proyecto.</div>}</div></article>

    {editingRequirement && editForm && <div className="fixed inset-0 z-[650] flex items-center justify-center bg-black/50 p-4" onClick={() => !savingRequirementId && setEditingRequirement(null)}>
      <div className="max-h-[calc(100vh-24px)] w-full max-w-[560px] overflow-y-auto rounded-xl bg-white shadow-2xl" onClick={event => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-4 border-b border-cream p-4">
          <div><h3 className="text-[17px] font-semibold text-navy">Editar configuración del requisito</h3><p className="mt-1 text-xs text-gray-500">{editingRequirement.nombre} · {editingRequirement.destino === 'empresa' ? 'Empresa' : 'Trabajador'}</p></div>
          <button type="button" className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600" aria-label="Cerrar" onClick={() => setEditingRequirement(null)}><X size={19} /></button>
        </div>
        <div className="flex flex-col gap-4 p-5">
          <div className="rounded-lg border border-cream3 bg-cream2/60 p-3 text-[11px] leading-relaxed text-gray-600"><strong className="text-navy">Identidad protegida.</strong> El nombre y el destino no se editan aquí para conservar la asociación con documentos y obligaciones existentes.</div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="text-[12px] font-medium text-gray-700">Frecuencia<select value={editForm.frequency} onChange={event => setEditForm({ ...editForm, frequency: event.target.value })} className="form-input mt-1.5 w-full rounded-lg border border-cream3 p-2.5"><option>Mensual</option><option>Bimensual</option><option>Trimestral</option><option>Por Proyecto</option><option>6 meses</option><option>1 año</option><option>Indefinido</option></select></label>
            <label className="text-[12px] font-medium text-gray-700">Criticidad<select value={editForm.criticidad} onChange={event => setEditForm({ ...editForm, criticidad: event.target.value as Requisito['criticidad'] })} className="form-input mt-1.5 w-full rounded-lg border border-cream3 p-2.5"><option value="bloquea_pago">Bloquea pago</option><option value="bloquea_acceso">Bloquea acceso</option><option value="bloquea_ambas">Bloquea acceso y pago</option><option value="advertencia">Solo advertencia</option></select></label>
          </div>
          <label className="text-[12px] font-medium text-gray-700">Ámbito<select value={editForm.servicioId} onChange={event => setEditForm({ ...editForm, servicioId: event.target.value })} className="form-input mt-1.5 w-full rounded-lg border border-cream3 p-2.5"><option value="">Todo el proyecto</option>{getServiciosProyecto(editingRequirement.proyectoId).map(service => <option key={service.id} value={service.id}>{service.codigo} · {service.nombre}</option>)}</select></label>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="text-[12px] font-medium text-gray-700">Alerta preventiva (días)<input type="number" min="0" max="365" value={editForm.alertaDias} onChange={event => setEditForm({ ...editForm, alertaDias: Number(event.target.value) })} className="form-input mt-1.5 w-full rounded-lg border border-cream3 p-2.5" /></label>
            <label className="text-[12px] font-medium text-gray-700">Plazo después del período<input type="number" min="0" max="90" value={editForm.diasPlazo} onChange={event => setEditForm({ ...editForm, diasPlazo: Number(event.target.value) })} className="form-input mt-1.5 w-full rounded-lg border border-cream3 p-2.5" /></label>
          </div>
          <label className="text-[12px] font-medium text-gray-700">Descripción para el contratista<textarea value={editForm.description} onChange={event => setEditForm({ ...editForm, description: event.target.value })} className="form-input mt-1.5 min-h-20 w-full rounded-lg border border-cream3 p-2.5" /></label>
          <label className="text-[12px] font-medium text-gray-700">Checklist de revisión<textarea value={editForm.checklist} onChange={event => setEditForm({ ...editForm, checklist: event.target.value })} className="form-input mt-1.5 min-h-24 w-full rounded-lg border border-cream3 p-2.5" placeholder="Un criterio por línea" /></label>
          {editingRequirement.destino === 'trabajador' && <label className="text-[12px] font-medium text-gray-700">Categorías aplicables<input value={editForm.categories} onChange={event => setEditForm({ ...editForm, categories: event.target.value })} className="form-input mt-1.5 w-full rounded-lg border border-cream3 p-2.5" placeholder="Conductor, Trabajo en altura" /><span className="mt-1 block text-[10.5px] font-normal text-gray-500">Sepáralas por coma. Estas categorías aparecerán como opciones al asignar trabajadores.</span></label>}
          <div className="grid grid-cols-1 gap-2 rounded-lg bg-cream2 p-3 sm:grid-cols-2"><label className="flex items-center gap-2 text-xs text-navy"><input type="checkbox" checked={editForm.bloqueaTrabajo} onChange={event => setEditForm({ ...editForm, bloqueaTrabajo: event.target.checked })} /> Bloquea trabajo</label><label className="flex items-center gap-2 text-xs text-navy"><input type="checkbox" checked={editForm.bloqueaAsignacion} onChange={event => setEditForm({ ...editForm, bloqueaAsignacion: event.target.checked })} /> Bloquea asignación</label></div>
          {configuracionRequisitoRequiereObligatoriedad(editForm.criticidad, editForm.bloqueaTrabajo, editForm.bloqueaAsignacion) && <p className="text-[10.5px] text-gray-500">Esta configuración implica bloqueo operativo, por lo que el requisito se mantendrá obligatorio.</p>}
          <div className="flex justify-end gap-3 border-t border-cream pt-4"><button type="button" className="btn btn-ghost" disabled={Boolean(savingRequirementId)} onClick={() => setEditingRequirement(null)}>Cancelar</button><button type="button" className="btn btn-primary" disabled={Boolean(savingRequirementId)} onClick={() => void saveEdit()}><Save size={15} /> {savingRequirementId ? 'Guardando…' : 'Guardar cambios'}</button></div>
        </div>
      </div>
    </div>}
  </>;
}

function AccreditationsPanel({ selected, requirements, onOpen }: { selected: ProjectPresentation; requirements: Requisito[]; onOpen: Props['onOpenContractor'] }) {
  const exportReport = async () => {
    const today = new Date().toISOString().slice(0, 10);
    const obligations = getObligacionesDocumentales().filter(item => item.proyectoId === selected.project.id && item.activo && item.periodoInicio <= today);
    await downloadProjectPackage(selected.project, selected.contractors, requirements, obligations);
  };
  return <article className="mandante-proyectos-section-card mandante-proyectos-panel"><div className="mandante-proyectos-section-head"><div><h2>Acreditaciones del proyecto</h2><p>Vista consolidada de Contratista + Mandante + Proyecto.</p></div><button type="button" onClick={() => void exportReport()}><Download /> Exportar paquete</button></div><div className="mandante-proyectos-accreditations">{selected.contractors.map(contractor => {
    const accreditation = accreditationLabel(calcularEstadoAcreditacion(contractor, selected.project.id)); const workers = selected.workers.filter(item => item.contractor.id === contractor.id); const enabled = workers.filter(item => ['aprobado', 'por_vencer'].includes(calcularEstadoTrabajador(item.worker, selected.project.id))).length; const result = calcularAccesoPago(contractor, selected.project.id);
    return <div key={contractor.id}><span><strong>{contractor.nombre}</strong><small>{selected.project.nombre}</small></span><span><small>Estado</small><b className={`mandante-proyectos-badge ${stateClass(accreditation)}`}>{accreditation}</b></span><span><small>Empresa</small><strong>{companyObligationSummary(contractor, selected.project.id, requirements)}</strong></span><span><small>Trabajadores</small><strong>{enabled}/{workers.length}</strong></span><span><small>Acceso</small><strong>{result.accesoEstado === 'bloqueado' ? 'Bloqueado' : result.accesoEstado === 'pendiente' ? 'Pendiente' : 'Habilitado'}</strong></span><span><small>Pago</small><strong>{result.pagoEstado === 'bloqueado' ? 'Retenido' : result.pagoEstado === 'pendiente' ? 'Pendiente' : 'Habilitado'}</strong></span><button type="button" onClick={() => onOpen(selected.project.id, contractor.id)}>Abrir</button></div>;
  })}</div></article>;
}
