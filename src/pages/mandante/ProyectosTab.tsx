import { useMemo, useState } from 'react';
import { AlertCircle, Archive, ArrowLeft, BriefcaseBusiness, CalendarDays, CheckCircle2, ChevronRight, Clock3, Download, KeyRound, MapPin, Pencil, Plus, RotateCcw, Save, Settings2, UsersRound, WalletCards, X } from 'lucide-react';
import { calcularAccesoPago, calcularAccesoTrabajador, calcularEstadoAcreditacion, configuracionRequisitoRequiereObligatoriedad, esTrabajadorAsignado, getContratistas, getProyectos, getRequisitos, saveProyectos, saveRequisitos } from '../../data/businessStore';
import { Contratista, Proyecto, Requisito } from '../../types';
import { buildMandanteProjectSummaries } from './inicio/inicioUtils';
import { buildProjectPresentations, companyObligationSummary, projectStateRank, ProjectPresentation } from './proyectos/proyectosUtils';
import { confirmBusinessPersistence } from '../../data/supabasePersistence';
import './ProyectosTab.css';
import ServicesPanel from '../../components/ServicesPanel';
import { getCierresDocumentales, getObligacionesDocumentales, getServiciosProyecto } from '../../data/operationalCore';
import CompliancePeriodsPanel from '../../components/CompliancePeriodsPanel';
import { setContractorParent, setContractorProjectActive } from '../../data/supabaseContractorHierarchy';
import AssetsPanel from '../../components/AssetsPanel';
import { downloadProjectPackage } from '../../data/projectReports';
import OperationsCenter from '../../components/OperationsCenter';
import { archiveMandanteProject } from '../../data/supabaseProjectLifecycle';

type DetailTab = 'resumen' | 'contratistas' | 'servicios' | 'activos' | 'requisitos' | 'periodos' | 'operacion' | 'acreditaciones';
type ProjectFilter = 'Todos los estados' | 'Bloqueado' | 'En proceso' | 'Acreditado' | 'Histórico';
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
  misProyectos: Proyecto[]; mandanteId: string; allContratistas: Contratista[];
  proyectoSeleccionadoAjustes: string | null; setProyectoSeleccionadoAjustes: (value: string | null) => void;
  showToast: (message: string, type?: 'success' | 'error' | 'warning') => void;
  setNewDocForm: (value: any) => void; setIsAddDocModalOpen: (value: boolean) => void;
  proyectoArchivado: boolean; setProyectoArchivado: (value: boolean) => void;
  selectedProjectId: string | null; setSelectedProjectId: (value: string | null) => void; onOpenContractor: (projectId: string, contractorId: string) => void;
  operationFocus?: { mode: 'evaluacion' | 'pago' | 'ticket'; itemId?: string } | null;
  [key: string]: any;
}
type ProjectMetadata = Proyecto & Partial<{ direccion: string; ubicacion: string; comuna: string; ciudad: string; region: string; fechaInicio: string; inicio: string; fecha_inicio: string }>;
type ProjectForm = {
  nombre: string;
  ubicacion: string;
  fechaInicio: string;
  fechaTermino: string;
  descripcion: string;
  responsableNombre: string;
  responsableEmail: string;
  responsableTelefono: string;
};

const emptyProjectForm = (): ProjectForm => ({
  nombre: '',
  ubicacion: '',
  fechaInicio: '',
  fechaTermino: '',
  descripcion: '',
  responsableNombre: '',
  responsableEmail: '',
  responsableTelefono: '',
});

const projectFormFrom = (project: Proyecto): ProjectForm => ({
  nombre: project.nombre || '',
  ubicacion: project.ubicacion || '',
  fechaInicio: project.fechaInicio || '',
  fechaTermino: project.fechaTermino || '',
  descripcion: project.descripcion || '',
  responsableNombre: project.responsableNombre || '',
  responsableEmail: project.responsableEmail || '',
  responsableTelefono: project.responsableTelefono || '',
});

const validEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

const projectReadiness = (project: Proyecto) => {
  const items = [
    { label: 'Nombre del proyecto', ok: Boolean(project.nombre.trim()) },
    { label: 'Ubicación', ok: Boolean(project.ubicacion?.trim()) },
    { label: 'Fecha de inicio', ok: Boolean(project.fechaInicio) },
    { label: 'Responsable principal', ok: Boolean(project.responsableNombre?.trim()) },
    { label: 'Correo del responsable', ok: Boolean(project.responsableEmail && validEmail(project.responsableEmail)) },
  ];
  const datesOk = !project.fechaTermino || !project.fechaInicio || project.fechaTermino >= project.fechaInicio;
  items.push({ label: 'Fechas coherentes', ok: datesOk });
  return { items, ready: items.every(item => item.ok) };
};

const projectAdministrativeLabel = (project: Proyecto) => project.estado === 'Archivado'
  ? 'Proyecto archivado'
  : project.estado === 'Borrador'
    ? 'Proyecto en borrador'
    : 'Proyecto activo';

const stateClass = (state: string) => state === 'Acreditado' || state === 'Al día' ? 'green' : state === 'Bloqueado' || state === 'Con problemas' ? 'red' : state === 'Sin requisitos' || state === 'Borrador' || state === 'Histórico' ? 'gray' : 'yellow';
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

export default function ProyectosTab({ activeProjectTab, setActiveProjectTab, misProyectos, mandanteId, allContratistas, proyectoSeleccionadoAjustes, setProyectoSeleccionadoAjustes, showToast, setNewDocForm, setIsAddDocModalOpen, proyectoArchivado, setProyectoArchivado, selectedProjectId, setSelectedProjectId, onOpenContractor, setShowInvitarModal, operationFocus }: Props) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<ProjectFilter>('Todos los estados');
  const [configuring, setConfiguring] = useState(false);
  const [requirementsVersion, setRequirementsVersion] = useState(0);
  const [servicesVersion, setServicesVersion] = useState(0);
  const [periodsVersion, setPeriodsVersion] = useState(0);
  const [contractorsVersion, setContractorsVersion] = useState(0);
  const [projectsVersion, setProjectsVersion] = useState(0);
  const [isCreateProjectOpen, setIsCreateProjectOpen] = useState(false);
  const [savingProject, setSavingProject] = useState(false);
  const [projectForm, setProjectForm] = useState<ProjectForm>(emptyProjectForm);
  const contractors = contractorsVersion > 0 ? getContratistas() : allContratistas;
  const currentProjects = projectsVersion > 0 ? getProyectos().filter(project => project.mandanteId === mandanteId) : misProyectos;
  const summaries = useMemo(() => buildProjectPresentations(currentProjects, contractors), [currentProjects, contractors, requirementsVersion, contractorsVersion, projectsVersion]);
  const selectedId = proyectoSeleccionadoAjustes || (activeProjectTab !== 'resumen' ? selectedProjectId : null);
  const selected = summaries.find(summary => summary.project.id === selectedId);
  const detailTab = (['resumen', 'contratistas', 'servicios', 'activos', 'requisitos', 'periodos', 'operacion', 'acreditaciones'].includes(activeProjectTab) ? activeProjectTab : 'resumen') as DetailTab;
  const projectRequirements = selected ? getRequisitos().filter(requirement => requirement.proyectoId === selected.project.id) : [];
  const requirements = projectRequirements.filter(requirement => requirement.activo !== false);
  const retiredRequirements = projectRequirements.filter(requirement => requirement.activo === false);
  const executive = selected ? buildMandanteProjectSummaries([selected.project], contractors)[0] : null;
  const projectCandidate = selected ? {
    ...selected.project,
    nombre: projectForm.nombre,
    ubicacion: projectForm.ubicacion || undefined,
    fechaInicio: projectForm.fechaInicio || undefined,
    fechaTermino: projectForm.fechaTermino || undefined,
    descripcion: projectForm.descripcion || undefined,
    responsableNombre: projectForm.responsableNombre || undefined,
    responsableEmail: projectForm.responsableEmail || undefined,
    responsableTelefono: projectForm.responsableTelefono || undefined,
  } : null;
  const readiness = projectCandidate ? projectReadiness(projectCandidate) : null;
  const visible = summaries.filter(summary =>
    filter === 'Todos los estados'
      || (filter === 'Histórico' ? summary.project.estado === 'Archivado' : summary.project.estado !== 'Archivado' && summary.state === filter)
  ).filter(summary => {
    const query = search.trim().toLocaleLowerCase('es');
    return !query || `${summary.project.nombre} ${projectLocation(summary.project)}`.toLocaleLowerCase('es').includes(query);
  }).sort((a, b) => Number(a.project.estado === 'Archivado') - Number(b.project.estado === 'Archivado') || projectStateRank[a.state] - projectStateRank[b.state] || a.project.nombre.localeCompare(b.project.nombre, 'es'));

  const openProject = (summary: ProjectPresentation) => {
    setProyectoSeleccionadoAjustes(summary.project.id); setSelectedProjectId(summary.project.id); setProyectoArchivado(summary.project.estado === 'Archivado'); setActiveProjectTab('resumen'); setConfiguring(false); window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const openProjectConfiguration = () => {
    if (!selected) return;
    setProjectForm(projectFormFrom(selected.project));
    setConfiguring(true);
  };
  const backToProjects = () => { setProyectoSeleccionadoAjustes(null); setActiveProjectTab('resumen'); setConfiguring(false); };

  const validateProjectForm = (form: ProjectForm, requireComplete = false): string | null => {
    if (!form.nombre.trim()) return 'Ingresa un nombre para el proyecto.';
    if (form.fechaInicio && form.fechaTermino && form.fechaTermino < form.fechaInicio) return 'La fecha de término no puede ser anterior a la fecha de inicio.';
    if (form.responsableEmail.trim() && !validEmail(form.responsableEmail)) return 'Ingresa un correo válido para el responsable.';
    if (requireComplete) {
      if (!form.ubicacion.trim()) return 'Falta registrar la ubicación del proyecto.';
      if (!form.fechaInicio) return 'Falta registrar la fecha de inicio.';
      if (!form.responsableNombre.trim()) return 'Falta definir al responsable principal.';
      if (!form.responsableEmail.trim() || !validEmail(form.responsableEmail)) return 'Falta un correo válido para el responsable principal.';
    }
    return null;
  };

  const persistProjectForm = async (project: Proyecto, nextStatus = project.estado) => {
    const projects = getProyectos();
    const index = projects.findIndex(item => item.id === project.id);
    if (index < 0) throw new Error('Proyecto no encontrado');
    projects[index] = {
      ...projects[index],
      nombre: projectForm.nombre.trim(),
      ubicacion: projectForm.ubicacion.trim() || undefined,
      fechaInicio: projectForm.fechaInicio || undefined,
      fechaTermino: projectForm.fechaTermino || undefined,
      descripcion: projectForm.descripcion.trim() || undefined,
      responsableNombre: projectForm.responsableNombre.trim() || undefined,
      responsableEmail: projectForm.responsableEmail.trim().toLowerCase() || undefined,
      responsableTelefono: projectForm.responsableTelefono.trim() || undefined,
      estado: nextStatus,
    };
    saveProyectos(projects);
    await confirmBusinessPersistence('core');
    setProjectsVersion(value => value + 1);
    return projects[index];
  };

  const createProject = async () => {
    if (savingProject) return;
    const validation = validateProjectForm(projectForm);
    if (validation) { showToast(validation, 'warning'); return; }
    const duplicate = getProyectos().some(project =>
      project.mandanteId === mandanteId
      && project.estado !== 'Archivado'
      && project.nombre.trim().toLocaleLowerCase('es') === projectForm.nombre.trim().toLocaleLowerCase('es')
    );
    if (duplicate) { showToast('Ya existe un proyecto visible con ese nombre.', 'warning'); return; }

    const randomPart = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID().replaceAll('-', '')
      : `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    const project: Proyecto = {
      id: `proyecto_${randomPart}`,
      nombre: projectForm.nombre.trim(),
      mandanteId,
      estado: 'Borrador',
      contratistas: [],
      ubicacion: projectForm.ubicacion.trim() || undefined,
      fechaInicio: projectForm.fechaInicio || undefined,
      fechaTermino: projectForm.fechaTermino || undefined,
      descripcion: projectForm.descripcion.trim() || undefined,
      responsableNombre: projectForm.responsableNombre.trim() || undefined,
      responsableEmail: projectForm.responsableEmail.trim().toLowerCase() || undefined,
      responsableTelefono: projectForm.responsableTelefono.trim() || undefined,
    };

    setSavingProject(true);
    try {
      saveProyectos([...getProyectos(), project]);
      await confirmBusinessPersistence('core');
      setProjectsVersion(value => value + 1);
      setIsCreateProjectOpen(false);
      setProyectoSeleccionadoAjustes(project.id);
      setSelectedProjectId(project.id);
      setProyectoArchivado(false);
      setActiveProjectTab('resumen');
      setProjectForm(projectFormFrom(project));
      setConfiguring(true);
      showToast('Proyecto creado como borrador');
    } catch (error) {
      console.error('No fue posible crear el proyecto.', error);
      showToast('No fue posible crear el proyecto. Intenta nuevamente.', 'error');
    } finally {
      setSavingProject(false);
    }
  };

  const saveProjectConfiguration = async () => {
    if (!selected || savingProject || selected.project.estado === 'Archivado') return;
    const validation = validateProjectForm(projectForm);
    if (validation) { showToast(validation, 'warning'); return; }
    const duplicate = getProyectos().some(project =>
      project.id !== selected.project.id
      && project.mandanteId === mandanteId
      && project.estado !== 'Archivado'
      && project.nombre.trim().toLocaleLowerCase('es') === projectForm.nombre.trim().toLocaleLowerCase('es')
    );
    if (duplicate) { showToast('Ya existe un proyecto visible con ese nombre.', 'warning'); return; }
    setSavingProject(true);
    try {
      await persistProjectForm(selected.project);
      showToast('Datos del proyecto actualizados');
    } catch (error) {
      console.error('No fue posible actualizar el proyecto.', error);
      showToast('No fue posible guardar los cambios del proyecto.', 'error');
    } finally {
      setSavingProject(false);
    }
  };

  const activateProject = async () => {
    if (!selected || savingProject || selected.project.estado === 'Archivado') return;
    const validation = validateProjectForm(projectForm, true);
    if (validation) { showToast(validation, 'warning'); return; }
    setSavingProject(true);
    try {
      await persistProjectForm(selected.project, 'Activo');
      showToast('Proyecto activado y listo para operar');
    } catch (error) {
      console.error('No fue posible activar el proyecto.', error);
      showToast('No fue posible activar el proyecto.', 'error');
    } finally {
      setSavingProject(false);
    }
  };

  const archiveProject = async () => {
    if (!selected || savingProject) return;
    const reason = window.prompt(
      `Motivo de cierre de "${selected.project.nombre}":\n\nAl archivar, el proyecto pasa definitivamente a historial: se finalizan sus relaciones operativas y queda disponible solo para consulta.`,
    )?.trim();
    if (reason === undefined) return;
    if (reason.length < 3) {
      showToast('Indica un motivo de cierre de al menos 3 caracteres.', 'warning');
      return;
    }
    setSavingProject(true);
    try {
      await archiveMandanteProject(selected.project.id, reason);
      setProyectoArchivado(true);
      setProjectsVersion(value => value + 1);
      setContractorsVersion(value => value + 1);
      setServicesVersion(value => value + 1);
      setPeriodsVersion(value => value + 1);
      setConfiguring(false);
      showToast('Proyecto cerrado y enviado a historial', 'warning');
    } catch (error) {
      console.error('No fue posible archivar el proyecto.', error);
      showToast(error instanceof Error ? error.message : 'No fue posible cerrar el proyecto.', 'error');
    } finally {
      setSavingProject(false);
    }
  };
  const addRequirement = () => {
    if (!selected) return;
    if (selected.project.estado === 'Archivado') {
      showToast('Un proyecto archivado se mantiene solo para consulta.', 'warning');
      return;
    }
    setNewDocForm({ name: '', category: 'Laboral', frequency: 'Mensual', destino: 'empresa', obligatorio: true, criticidad: 'bloquea_pago', description: '', checklist: '', categories: '', bloqueaTrabajo: false, bloqueaAsignacion: false, servicioId: '', alertDays: 7, dueDays: 5, projectId: selected.project.id });
    setIsAddDocModalOpen(true);
  };

  if (!selected) return <>
    <section className="mandante-proyectos fade-in">
      <header className="mandante-proyectos-page-head">
        <div><h1>Proyectos</h1><p>Vista general de tus proyectos. Crea, configura y revisa cada proyecto desde aquí.</p></div>
        <div className="mandante-proyectos-toolbar">
          <button type="button" className="mandante-proyectos-primary-action" onClick={() => { setProjectForm(emptyProjectForm()); setIsCreateProjectOpen(true); }}><Plus /> Nuevo proyecto</button>
          <label><span className="sr-only">Buscar proyecto</span><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar proyecto..." /></label>
          <label><span className="sr-only">Filtrar por estado</span><select value={filter} onChange={event => setFilter(event.target.value as ProjectFilter)}><option>Todos los estados</option><option>Bloqueado</option><option>En proceso</option><option>Acreditado</option><option>Histórico</option></select></label>
        </div>
      </header>
      <div className="mandante-proyectos-grid">{visible.map(summary => <button type="button" className="mandante-proyectos-card" key={summary.project.id} onClick={() => openProject(summary)}>
        <div className="mandante-proyectos-cover"><div><span>{projectAdministrativeLabel(summary.project)}</span><h2>{summary.project.nombre}</h2></div><b className={`mandante-proyectos-badge ${stateClass(summary.project.estado === 'Borrador' ? 'Borrador' : summary.project.estado === 'Archivado' ? 'Histórico' : summary.state)}`}>{summary.project.estado === 'Borrador' ? 'Borrador' : summary.project.estado === 'Archivado' ? 'Histórico' : summary.state}</b></div>
        <div className="mandante-proyectos-card-body"><div className="mandante-proyectos-presentation"><span><MapPin />{projectLocation(summary.project)}</span><span><CalendarDays />{projectStartDate(summary.project)}</span></div>
          <div className="mandante-proyectos-people"><span><strong>{summary.workers.length}</strong>Trabajadores</span><span><strong>{summary.contractors.length}</strong>Contratistas</span></div><DocumentationBlock summary={summary} /><span className="mandante-proyectos-open">Ver proyecto <ChevronRight /></span></div>
      </button>)}</div>
      {visible.length === 0 && <div className="mandante-proyectos-empty">{summaries.length === 0 ? 'Aún no hay proyectos. Crea el primero para comenzar.' : 'No hay proyectos que coincidan con la búsqueda y el estado seleccionado.'}</div>}
    </section>

    {isCreateProjectOpen && <div className="fixed inset-0 z-[700] flex items-center justify-center bg-black/50 p-4" onClick={() => !savingProject && setIsCreateProjectOpen(false)}>
      <div className="max-h-[calc(100vh-24px)] w-full max-w-[620px] overflow-y-auto rounded-xl bg-white shadow-2xl" onClick={event => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-4 border-b border-cream p-4">
          <div><h3 className="text-[18px] font-semibold text-navy">Crear proyecto</h3><p className="mt-1 text-xs text-gray-500">Se guardará primero como borrador. Podrás activarlo cuando sus datos básicos estén completos.</p></div>
          <button type="button" aria-label="Cerrar" disabled={savingProject} className="rounded p-1 text-gray-400 hover:bg-gray-100" onClick={() => setIsCreateProjectOpen(false)}><X size={19} /></button>
        </div>
        <ProjectFormFields form={projectForm} setForm={setProjectForm} disabled={savingProject} />
        <div className="flex justify-end gap-3 border-t border-cream px-5 py-4">
          <button type="button" className="btn btn-ghost" disabled={savingProject} onClick={() => setIsCreateProjectOpen(false)}>Cancelar</button>
          <button type="button" className="btn btn-primary" disabled={savingProject || !projectForm.nombre.trim()} onClick={() => void createProject()}>{savingProject ? 'Creando…' : 'Crear borrador'}</button>
        </div>
      </div>
    </div>}
  </>;

  if (configuring) return <section className="mandante-proyectos fade-in">
    <button type="button" className="mandante-proyectos-back" onClick={() => setConfiguring(false)}><ArrowLeft /> Volver al proyecto</button>
    <div className="mandante-proyectos-config">
      <header><div><span>{projectAdministrativeLabel(selected.project)}</span><h1>{selected.project.nombre}</h1><p>Edita los datos generales, define al responsable y controla cuándo el proyecto queda operativo.</p></div><Settings2 /></header>

      <div className="mandante-proyectos-config-grid">
        <div><span>Estado administrativo</span><strong>{selected.project.estado}</strong></div>
        <div><span>Preparación</span><strong>{readiness?.ready ? 'Datos básicos completos' : `${readiness?.items.filter(item => item.ok).length || 0} de ${readiness?.items.length || 0} controles completos`}</strong></div>
        <div><span>Requisitos activos</span><strong>{requirements.length}</strong></div>
        <div><span>Responsable</span><strong>{selected.project.responsableNombre || 'No definido'}</strong></div>
      </div>

      <div className="mandante-proyectos-config-body">
        <section className="mandante-proyectos-config-card">
          <div className="mandante-proyectos-section-head"><div><h2>Datos generales</h2><p>Información principal que verá el equipo del Mandante y Acredita.</p></div></div>
          <ProjectFormFields form={projectForm} setForm={setProjectForm} disabled={savingProject || selected.project.estado === 'Archivado'} />
          {selected.project.estado !== 'Archivado' && <div className="mandante-proyectos-config-actions">
            <button type="button" className="btn btn-ghost" disabled={savingProject} onClick={() => setProjectForm(projectFormFrom(selected.project))}>Descartar cambios</button>
            <button type="button" className="btn btn-primary" disabled={savingProject} onClick={() => void saveProjectConfiguration()}><Save size={15} /> {savingProject ? 'Guardando…' : 'Guardar cambios'}</button>
          </div>}
        </section>

        <section className="mandante-proyectos-config-card">
          <h2>Preparación del proyecto</h2>
          <p>Estos datos deben estar completos antes de activar el proyecto.</p>
          <div className="mandante-proyectos-readiness">{readiness?.items.map(item => <div key={item.label} className={item.ok ? 'ready' : 'pending'}>{item.ok ? <CheckCircle2 /> : <AlertCircle />}<span>{item.label}</span><strong>{item.ok ? 'Listo' : 'Pendiente'}</strong></div>)}</div>
          {selected.project.estado === 'Borrador' && <button type="button" className="mandante-proyectos-activate" disabled={savingProject || !readiness?.ready} onClick={() => void activateProject()}><CheckCircle2 /> {readiness?.ready ? 'Activar proyecto' : 'Completa los datos para activar'}</button>}
          {selected.project.estado === 'Activo' && <div className="mandante-proyectos-active-note"><CheckCircle2 /> El proyecto está activo y disponible para la operación.</div>}
          {selected.project.estado === 'Archivado' && <div className="mandante-proyectos-archived-note"><Archive /><span><strong>Proyecto histórico · solo consulta.</strong>{selected.project.archivadoEn ? ` Cerrado el ${new Intl.DateTimeFormat('es-CL', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(selected.project.archivadoEn))}.` : ''}{selected.project.motivoArchivo ? ` Motivo: ${selected.project.motivoArchivo}` : ''}</span></div>}
        </section>
      </div>

      {selected.project.estado !== 'Archivado' && <div className="mandante-proyectos-danger"><div><strong>Archivar proyecto</strong><p>El proyecto deja de considerarse activo, pero conserva su información, documentos e historial.</p></div><button type="button" onClick={archiveProject} disabled={savingProject || proyectoArchivado}><Archive />Archivar proyecto</button></div>}
    </div>
  </section>;

  return <section className="mandante-proyectos mandante-proyectos-detail fade-in">
    <button type="button" className="mandante-proyectos-back" onClick={backToProjects}><ArrowLeft /> Volver a proyectos</button>
    <header className="mandante-proyectos-hero"><div><span>{projectAdministrativeLabel(selected.project)}</span><h1>{selected.project.nombre}</h1><p>{selected.project.estado === 'Borrador' ? 'Completa la configuración antes de comenzar la operación.' : selected.project.estado === 'Archivado' ? 'Expediente histórico del proyecto. La información permanece disponible, sin acciones operativas.' : 'Gestiona la acreditación completa del proyecto desde un espacio dedicado.'}</p></div><div className="mandante-proyectos-hero-actions"><b className={`mandante-proyectos-badge ${stateClass(selected.project.estado === 'Borrador' ? 'Borrador' : selected.state)}`}>{selected.project.estado === 'Borrador' ? 'Borrador' : selected.state}</b><button type="button" onClick={openProjectConfiguration}><Settings2 /> Administrar proyecto</button></div></header>
    <nav className="mandante-proyectos-tabs" aria-label="Secciones del proyecto">{(['resumen', 'contratistas', 'servicios', 'activos', 'requisitos', 'periodos', 'operacion', 'acreditaciones'] as DetailTab[]).map(tab => <button type="button" key={tab} className={detailTab === tab ? 'active' : ''} onClick={() => setActiveProjectTab(tab)}>{tab.charAt(0).toUpperCase() + tab.slice(1)}</button>)}</nav>
    {detailTab === 'resumen' && <SummaryPanel selected={selected} executive={executive} />}
    {detailTab === 'contratistas' && <ContractorsPanel
      selected={selected}
      projects={currentProjects}
      allContractors={contractors}
      projectArchived={selected.project.estado === 'Archivado'}
      onInvite={() => setShowInvitarModal?.(true)}
      onOpen={onOpenContractor}
      onChanged={() => {
        setContractorsVersion(value => value + 1);
        setProjectsVersion(value => value + 1);
      }}
      showToast={showToast}
    />}
    {detailTab === 'servicios' && <ServicesPanel project={selected.project} contractors={selected.contractors} services={getServiciosProyecto(selected.project.id, undefined, true)} onChanged={() => setServicesVersion(value => value + 1)} showToast={showToast} />}
    {detailTab === 'activos' && <AssetsPanel project={selected.project} contractors={selected.contractors} services={getServiciosProyecto(selected.project.id, undefined, true)} showToast={showToast} readOnly={selected.project.estado === 'Archivado'} />}
    {detailTab === 'requisitos' && <RequirementsPanel requirements={requirements} retiredRequirements={retiredRequirements} projectArchived={selected.project.estado === 'Archivado'} onAdd={addRequirement} onChanged={() => setRequirementsVersion(value => value + 1)} showToast={showToast} />}
    {detailTab === 'periodos' && <CompliancePeriodsPanel periods={getCierresDocumentales().filter(item => item.proyectoId === selected.project.id)} onChanged={() => setPeriodsVersion(value => value + 1)} showToast={showToast} readOnly={selected.project.estado === 'Archivado'} />}
    {detailTab === 'operacion' && <OperationsCenter project={selected.project} contractors={selected.contractors} showToast={showToast} focus={operationFocus} />}
    {detailTab === 'acreditaciones' && <AccreditationsPanel selected={selected} requirements={requirements} onOpen={onOpenContractor} />}
  </section>;
}

function ProjectFormFields({ form, setForm, disabled }: { form: ProjectForm; setForm: (value: ProjectForm) => void; disabled: boolean }) {
  return <div className="mandante-proyectos-project-form">
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <label>Nombre del proyecto<input aria-label="Nombre del proyecto" disabled={disabled} value={form.nombre} onChange={event => setForm({ ...form, nombre: event.target.value })} placeholder="Ej. Planta Norte 2026" /></label>
      <label>Ubicación<input aria-label="Ubicación del proyecto" disabled={disabled} value={form.ubicacion} onChange={event => setForm({ ...form, ubicacion: event.target.value })} placeholder="Ej. Quilicura, Región Metropolitana" /></label>
    </div>
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <label>Fecha de inicio<input aria-label="Fecha de inicio" disabled={disabled} type="date" value={form.fechaInicio} onChange={event => setForm({ ...form, fechaInicio: event.target.value })} /></label>
      <label>Fecha de término <span>opcional</span><input aria-label="Fecha de término" disabled={disabled} type="date" min={form.fechaInicio || undefined} value={form.fechaTermino} onChange={event => setForm({ ...form, fechaTermino: event.target.value })} /></label>
    </div>
    <label>Descripción <span>opcional</span><textarea aria-label="Descripción del proyecto" disabled={disabled} value={form.descripcion} onChange={event => setForm({ ...form, descripcion: event.target.value })} placeholder="Breve descripción de la obra, faena o servicio." /></label>
    <div className="mandante-proyectos-form-divider"><span>Responsable principal del Mandante</span></div>
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <label>Nombre<input aria-label="Nombre del responsable" disabled={disabled} value={form.responsableNombre} onChange={event => setForm({ ...form, responsableNombre: event.target.value })} placeholder="Nombre y apellido" /></label>
      <label>Correo<input aria-label="Correo del responsable" disabled={disabled} type="email" value={form.responsableEmail} onChange={event => setForm({ ...form, responsableEmail: event.target.value })} placeholder="responsable@empresa.cl" /></label>
    </div>
    <label>Teléfono <span>opcional</span><input aria-label="Teléfono del responsable" disabled={disabled} value={form.responsableTelefono} onChange={event => setForm({ ...form, responsableTelefono: event.target.value })} placeholder="+56 9 1234 5678" /></label>
  </div>;
}

function SummaryPanel({ selected, executive }: { selected: ProjectPresentation; executive: ReturnType<typeof buildMandanteProjectSummaries>[number] | null }) {
  const historical = selected.project.estado === 'Archivado';
  if (historical) {
    const closedAt = selected.project.archivadoEn
      ? new Intl.DateTimeFormat('es-CL', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(selected.project.archivadoEn))
      : selected.project.fechaTermino || 'Fecha no registrada';
    return <div className="mandante-proyectos-panel">
      <div className="mandante-proyectos-kpis">
        <div><BriefcaseBusiness /><span>Contratistas históricos</span><strong>{selected.contractors.length}</strong></div>
        <div><UsersRound /><span>Trabajadores registrados</span><strong>{selected.workers.length}</strong></div>
        <div><Archive /><span>Estado</span><strong>Histórico</strong></div>
        <div><CalendarDays /><span>Cierre</span><strong>{selected.project.fechaTermino || 'Registrado'}</strong></div>
      </div>
      <article className="mandante-proyectos-section-card">
        <h2>Cierre e historial</h2>
        <p>Este proyecto ya no genera operación, alertas ni nuevas decisiones. Sus antecedentes permanecen disponibles como expediente histórico.</p>
        <dl className="mandante-proyectos-summary-list">
          <div><dt>Fecha de archivo</dt><dd>{closedAt}</dd></div>
          <div><dt>Motivo de cierre</dt><dd>{selected.project.motivoArchivo || 'Proyecto archivado'}</dd></div>
          <div><dt>Obligaciones documentales registradas</dt><dd>{selected.obligations.total}</dd></div>
          <div><dt>Modo</dt><dd>Solo consulta</dd></div>
        </dl>
      </article>
    </div>;
  }

  return <div className="mandante-proyectos-panel"><div className="mandante-proyectos-kpis"><div><BriefcaseBusiness /><span>Contratistas</span><strong>{selected.contractors.length}</strong></div><div><UsersRound /><span>Trabajadores habilitados</span><strong>{selected.workersEnabled}/{selected.workers.length}</strong></div><div className={selected.access === 'Habilitado' ? 'good' : 'bad'}><KeyRound /><span>Acceso</span><strong>{selected.access}</strong></div><div className={selected.payment === 'Habilitado' ? 'good' : 'bad'}><WalletCards /><span>Pago</span><strong>{selected.payment}</strong></div></div>
    <div className="mandante-proyectos-two-columns"><article className="mandante-proyectos-section-card"><h2>Requiere atención</h2><p>Problemas que afectan la operación o el avance de la acreditación.</p><div className="mandante-proyectos-attention-list">{(executive?.priorities || []).map(priority => <div key={priority.key}><span className={priority.kind === 'por_vencer' ? 'yellow' : 'red'}>{priority.kind === 'por_vencer' ? <Clock3 /> : <AlertCircle />}</span><div><strong>{priority.title}</strong><p>{priority.detail}</p></div></div>)}{!executive?.priorities.length && <div className="mandante-proyectos-clear"><CheckCircle2 /> No hay casos que requieran acción.</div>}</div></article>
      <article className="mandante-proyectos-section-card"><h2>Situación general</h2><p>Resumen del estado actual del proyecto.</p><dl className="mandante-proyectos-summary-list"><div><dt>Acreditaciones aprobadas</dt><dd>{selected.approvedAccreditations} de {selected.contractors.length}</dd></div><div><dt>Acreditaciones bloqueadas</dt><dd>{selected.blockedAccreditations}</dd></div><div><dt>Casos que requieren atención</dt><dd>{selected.attentionCount}</dd></div><div><dt>En revisión por Acredita</dt><dd>{selected.inReview}</dd></div></dl></article></div>
  </div>;
}

function ContractorsPanel({
  selected,
  projects,
  allContractors,
  projectArchived,
  onInvite,
  onOpen,
  onChanged,
  showToast,
}: {
  selected: ProjectPresentation;
  projects: Proyecto[];
  allContractors: Contratista[];
  projectArchived: boolean;
  onInvite: () => void;
  onOpen: Props['onOpenContractor'];
  onChanged: () => void;
  showToast: Props['showToast'];
}) {
  const [savingId, setSavingId] = useState<string | null>(null);
  const contractorById = new Map(allContractors.map(item => [item.id, item]));
  const historical = (selected.project.contratistasHistoricos || [])
    .map(id => contractorById.get(id))
    .filter((item): item is Contratista => Boolean(item));

  const parentForProject = (contractor: Contratista) =>
    contractor.contratistaPadrePorProyecto?.[selected.project.id];

  const canBeParent = (candidate: Contratista, childId: string) => {
    if (candidate.id === childId) return false;
    let current: Contratista | undefined = candidate;
    const visited = new Set<string>();
    while (current && !visited.has(current.id)) {
      const parentId = parentForProject(current);
      if (!parentId) break;
      if (parentId === childId) return false;
      visited.add(current.id);
      current = contractorById.get(parentId);
    }
    return true;
  };

  const updateParent = async (contractor: Contratista, parentId: string) => {
    if (savingId || projectArchived) return;
    setSavingId(contractor.id);
    try {
      await setContractorParent(selected.project.id, contractor.id, parentId || undefined);
      onChanged();
      showToast(parentId ? 'Relación de subcontratación actualizada para este proyecto.' : 'Contratista marcado como principal en este proyecto.');
    } catch (error) {
      console.error('No fue posible actualizar la relación del contratista.', error);
      showToast(error instanceof Error ? error.message : 'No fue posible actualizar la relación de subcontratación.', 'error');
    } finally {
      setSavingId(null);
    }
  };

  const finishParticipation = async (contractor: Contratista) => {
    if (savingId || projectArchived) return;
    const confirmed = window.confirm(
      `¿Finalizar la participación de "${contractor.nombre}" en "${selected.project.nombre}"?\n\n` +
      'Se cerrarán sus servicios y asignaciones activas en este proyecto. Los documentos, revisiones y antecedentes históricos se conservarán.'
    );
    if (!confirmed) return;
    setSavingId(contractor.id);
    try {
      await setContractorProjectActive(selected.project.id, contractor.id, false);
      onChanged();
      showToast('Participación finalizada. El historial se conserva.', 'warning');
    } catch (error) {
      console.error('No fue posible finalizar la participación.', error);
      showToast(error instanceof Error ? error.message : 'No fue posible finalizar la participación.', 'error');
    } finally {
      setSavingId(null);
    }
  };

  const reactivateParticipation = async (contractor: Contratista) => {
    if (savingId || projectArchived) return;
    setSavingId(contractor.id);
    try {
      await setContractorProjectActive(selected.project.id, contractor.id, true);
      onChanged();
      showToast('Contratista reactivado en el proyecto. Revisa servicios y trabajadores antes de operar.');
    } catch (error) {
      console.error('No fue posible reactivar la participación.', error);
      showToast(error instanceof Error ? error.message : 'No fue posible reactivar la participación.', 'error');
    } finally {
      setSavingId(null);
    }
  };

  return <>
    <article className="mandante-proyectos-section-card mandante-proyectos-panel">
      <div className="mandante-proyectos-section-head">
        <div>
          <h2>Contratistas del proyecto</h2>
          <p>Administra quién participa en esta obra y la relación entre contratistas principales y subcontratistas.</p>
        </div>
        <button type="button" onClick={onInvite} disabled={projectArchived}><Plus /> {projectArchived ? 'Solo lectura' : 'Invitar contratista'}</button>
      </div>
      {projectArchived && <div className="mandante-proyectos-readonly-note"><Archive /> Proyecto archivado: las relaciones se mantienen solo para consulta.</div>}
      <div className="mandante-proyectos-table-wrap">
        <table>
          <thead><tr><th>Contratista</th><th>Relación en este proyecto</th><th>Acreditación</th><th>Trabajadores</th><th>Acceso</th><th>Pago</th><th>Acciones</th></tr></thead>
          <tbody>{selected.contractors.map(contractor => {
            const accreditation = accreditationLabel(calcularEstadoAcreditacion(contractor, selected.project.id));
            const assigned = (contractor.trabajadores || []).filter(worker => esTrabajadorAsignado(worker, selected.project.id, projects));
            const workerAccess = assigned.map(worker => calcularAccesoTrabajador(worker, selected.project.id, contractor.id));
            const enabled = workerAccess.filter(state => state === 'habilitado').length;
            const result = calcularAccesoPago(contractor, selected.project.id);
            const accessState = result.accesoEstado === 'bloqueado' || workerAccess.some(state => state === 'bloqueado')
              ? 'Con bloqueos'
              : result.accesoEstado === 'pendiente' || workerAccess.some(state => state === 'pendiente')
                ? 'Pendiente'
                : 'Habilitado';
            const currentParentId = parentForProject(contractor) || '';
            return <tr key={contractor.id}>
              <td><strong>{contractor.nombre}</strong><small>{contractor.rut}</small></td>
              <td><select aria-label={`Relación de ${contractor.nombre}`} value={currentParentId} disabled={projectArchived || savingId === contractor.id} onChange={event => void updateParent(contractor, event.target.value)}><option value="">Principal</option>{selected.contractors.filter(item => canBeParent(item, contractor.id)).map(item => <option value={item.id} key={item.id}>Subcontratista de {item.nombre}</option>)}</select></td>
              <td><b className={`mandante-proyectos-badge ${stateClass(accreditation)}`}>{accreditation}</b></td>
              <td>{enabled}/{assigned.length}</td>
              <td>{accessState}</td>
              <td>{result.pagoEstado === 'bloqueado' ? 'Retenido' : result.pagoEstado === 'pendiente' ? 'Pendiente' : 'Habilitado'}</td>
              <td><div className="mandante-proyectos-contractor-actions"><button type="button" onClick={() => onOpen(selected.project.id, contractor.id)}>Ver contratista</button><button type="button" className="danger" disabled={projectArchived || Boolean(savingId)} onClick={() => void finishParticipation(contractor)}><Archive /> {savingId === contractor.id ? 'Actualizando…' : 'Finalizar'}</button></div></td>
            </tr>;
          })}</tbody>
        </table>
      </div>
      {selected.contractors.length === 0 && <div className="mandante-proyectos-empty">Todavía no hay contratistas activos en este proyecto.</div>}
    </article>

    {historical.length > 0 && <article className="mandante-proyectos-section-card mandante-proyectos-panel mandante-proyectos-retired">
      <div className="mandante-proyectos-section-head"><div><h2>Participaciones finalizadas</h2><p>Empresas que ya no operan en el proyecto. Sus documentos, trabajadores y revisiones permanecen en el historial.</p></div></div>
      <div className="mandante-proyectos-retired-list">{historical.map(contractor => <div key={contractor.id}>
        <span><strong>{contractor.nombre}</strong><small>RUT {contractor.rut} · relación finalizada</small></span>
        <div className="mandante-proyectos-history-actions"><button type="button" onClick={() => onOpen(selected.project.id, contractor.id)}>Ver historial</button><button type="button" disabled={projectArchived || Boolean(savingId)} onClick={() => void reactivateParticipation(contractor)}><RotateCcw /> {savingId === contractor.id ? 'Reactivando…' : 'Reactivar'}</button></div>
      </div>)}</div>
    </article>}
  </>;
}

function RequirementsPanel({ requirements, retiredRequirements, projectArchived, onAdd, onChanged, showToast }: {
  requirements: Requisito[];
  retiredRequirements: Requisito[];
  projectArchived: boolean;
  onAdd: () => void;
  onChanged: () => void;
  showToast: Props['showToast'];
}) {
  const [savingRequirementId, setSavingRequirementId] = useState<string | null>(null);
  const [editingRequirement, setEditingRequirement] = useState<Requisito | null>(null);
  const [editForm, setEditForm] = useState<RequirementEditForm | null>(null);

  const uniqueValues = (value: string) => Array.from(new Map(
    value.split(/[,\n]/).map(item => item.trim()).filter(Boolean).map(item => [item.toLocaleLowerCase('es'), item])
  ).values());

  const criticalityLabel = (value: Requisito['criticidad']) => value === 'bloquea_pago'
    ? 'Bloquea pago'
    : value === 'bloquea_acceso'
      ? 'Bloquea ingreso'
      : value === 'bloquea_ambas'
        ? 'Bloquea ingreso y pago'
        : 'Solo advertencia';

  const scopeLabel = (requirement: Requisito) => {
    if (!requirement.servicioId) return 'Todo el proyecto';
    const service = getServiciosProyecto(requirement.proyectoId, undefined, true).find(item => item.id === requirement.servicioId);
    return service ? `${service.codigo} · ${service.nombre}` : 'Servicio histórico';
  };

  const impactLabel = (requirement: Requisito) => {
    const effects: string[] = [];
    if (requirement.criticidad === 'bloquea_acceso' || requirement.criticidad === 'bloquea_ambas') effects.push('ingreso');
    if (requirement.bloqueaTrabajo) effects.push('trabajo');
    if (requirement.bloqueaAsignacion) effects.push('asignación');
    if (requirement.criticidad === 'bloquea_pago' || requirement.criticidad === 'bloquea_ambas') effects.push('pago');
    return effects.length ? `Afecta: ${effects.join(', ')}` : 'Sin bloqueo operativo';
  };

  const hasEquivalentActive = (candidate: Requisito, excludingId?: string) => getRequisitos().some(item =>
    item.id !== excludingId
    && item.activo !== false
    && item.proyectoId === candidate.proyectoId
    && item.destino === candidate.destino
    && (item.servicioId || '') === (candidate.servicioId || '')
    && item.nombre.trim().toLocaleLowerCase('es') === candidate.nombre.trim().toLocaleLowerCase('es')
  );

  const toggleRequired = async (requirement: Requisito) => {
    if (savingRequirementId || projectArchived) return;
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
    if (projectArchived) return;
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
    if (!editingRequirement || !editForm || savingRequirementId || projectArchived) return;
    const list = getRequisitos();
    const index = list.findIndex(item => item.id === editingRequirement.id);
    if (index < 0) return;

    const candidate: Requisito = {
      ...list[index],
      frecuencia: editForm.frequency,
      criticidad: editForm.criticidad,
      alertaDias: Math.min(365, Math.max(0, Number(editForm.alertaDias) || 0)),
      diasPlazo: Math.min(90, Math.max(0, Number(editForm.diasPlazo) || 0)),
      descripcion: editForm.description.trim() || undefined,
      checklistRevision: uniqueValues(editForm.checklist),
      categoriasAplicables: editingRequirement.destino === 'trabajador' ? uniqueValues(editForm.categories) : [],
      bloqueaTrabajo: editForm.bloqueaTrabajo,
      bloqueaAsignacion: editForm.bloqueaAsignacion,
      servicioId: editForm.servicioId || undefined,
    };
    candidate.obligatorio = configuracionRequisitoRequiereObligatoriedad(
      candidate.criticidad,
      Boolean(candidate.bloqueaTrabajo),
      Boolean(candidate.bloqueaAsignacion),
    ) ? true : candidate.obligatorio;

    if (hasEquivalentActive(candidate, editingRequirement.id)) {
      showToast('Ya existe un requisito activo con ese nombre, destino y ámbito.', 'warning');
      return;
    }

    setSavingRequirementId(editingRequirement.id);
    list[index] = candidate;
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

  const retireRequirement = async (requirement: Requisito) => {
    if (savingRequirementId || projectArchived) return;
    const confirmed = window.confirm(`¿Retirar "${requirement.nombre}"?\n\nDejará de generar y bloquear obligaciones nuevas, pero sus documentos e historial se conservarán.`);
    if (!confirmed) return;
    const list = getRequisitos();
    const index = list.findIndex(item => item.id === requirement.id);
    if (index < 0) return;
    list[index] = { ...list[index], activo: false };
    setSavingRequirementId(requirement.id);
    saveRequisitos(list);
    try {
      await confirmBusinessPersistence('core');
      onChanged();
      showToast('Requisito retirado. El historial se conserva.', 'warning');
    } catch (error) {
      onChanged();
      console.error('No fue posible retirar el requisito.', error);
      showToast('No fue posible retirar el requisito.', 'error');
    } finally {
      setSavingRequirementId(null);
    }
  };

  const reactivateRequirement = async (requirement: Requisito) => {
    if (savingRequirementId || projectArchived) return;
    if (hasEquivalentActive(requirement, requirement.id)) {
      showToast('Ya existe un requisito activo equivalente. No es necesario reactivarlo.', 'warning');
      return;
    }
    const list = getRequisitos();
    const index = list.findIndex(item => item.id === requirement.id);
    if (index < 0) return;
    list[index] = { ...list[index], activo: true };
    setSavingRequirementId(requirement.id);
    saveRequisitos(list);
    try {
      await confirmBusinessPersistence('core');
      onChanged();
      showToast('Requisito reactivado');
    } catch (error) {
      onChanged();
      console.error('No fue posible reactivar el requisito.', error);
      showToast('No fue posible reactivar el requisito.', 'error');
    } finally {
      setSavingRequirementId(null);
    }
  };

  return <>
    <article className="mandante-proyectos-section-card mandante-proyectos-panel">
      <div className="mandante-proyectos-section-head">
        <div>
          <h2>Requisitos del proyecto</h2>
          <p>Define qué debe cumplir cada empresa y trabajador, su vigencia y qué efecto tiene un incumplimiento.</p>
        </div>
        <button type="button" onClick={onAdd} disabled={projectArchived}><Plus /> {projectArchived ? 'Solo lectura' : 'Agregar requisito'}</button>
      </div>
      {projectArchived && <div className="mandante-proyectos-readonly-note"><Archive /> Proyecto archivado: la matriz se conserva para consulta e historial.</div>}
      <div className="mandante-proyectos-requirements">
        {requirements.map(requirement => <div className="mandante-proyectos-requirement" key={requirement.id}>
          <div>
            <strong>{requirement.nombre}</strong>
            <span>{requirement.destino === 'empresa' ? 'Empresa' : 'Trabajador'} · {requirement.frecuencia} · {criticalityLabel(requirement.criticidad)}</span>
            <small>Ámbito: {scopeLabel(requirement)} · Alerta {requirement.alertaDias} días · Plazo {requirement.diasPlazo ?? 5} días</small>
            <small>{impactLabel(requirement)}</small>
            {requirement.descripcion && <p>{requirement.descripcion}</p>}
            {Boolean(requirement.checklistRevision?.length) && <small>{requirement.checklistRevision!.length} criterios de revisión</small>}
            {Boolean(requirement.categoriasAplicables?.length) && <small>Aplica a: {requirement.categoriasAplicables!.join(', ')}</small>}
          </div>
          <div className="mandante-proyectos-requirement-actions">
            <button type="button" className="edit" disabled={projectArchived || savingRequirementId === requirement.id} onClick={() => openEdit(requirement)}><Pencil /> Editar</button>
            <button type="button" className="edit danger" disabled={projectArchived || Boolean(savingRequirementId)} onClick={() => void retireRequirement(requirement)}><Archive /> Retirar</button>
            <button type="button" role="switch" aria-checked={requirement.obligatorio} disabled={projectArchived || savingRequirementId === requirement.id} className={`requirement-switch ${requirement.obligatorio ? 'mandatory' : 'optional'}`} onClick={() => void toggleRequired(requirement)}><span className="requirement-switch-track"><i /></span><b>{savingRequirementId === requirement.id ? 'Guardando…' : requirement.obligatorio ? 'Obligatorio' : 'Opcional'}</b></button>
          </div>
        </div>)}
        {requirements.length === 0 && <div className="mandante-proyectos-empty">No hay requisitos activos para este proyecto.</div>}
      </div>
    </article>

    {retiredRequirements.length > 0 && <article className="mandante-proyectos-section-card mandante-proyectos-panel mandante-proyectos-retired">
      <div className="mandante-proyectos-section-head"><div><h2>Requisitos retirados</h2><p>No afectan la operación actual. Se conservan para mantener la trazabilidad histórica.</p></div></div>
      <div className="mandante-proyectos-retired-list">{retiredRequirements.map(requirement => <div key={requirement.id}>
        <span><strong>{requirement.nombre}</strong><small>{requirement.destino === 'empresa' ? 'Empresa' : 'Trabajador'} · {scopeLabel(requirement)} · {requirement.frecuencia}</small></span>
        <button type="button" disabled={projectArchived || Boolean(savingRequirementId)} onClick={() => void reactivateRequirement(requirement)}><RotateCcw /> {savingRequirementId === requirement.id ? 'Reactivando…' : 'Reactivar'}</button>
      </div>)}</div>
    </article>}

    {editingRequirement && editForm && <div className="fixed inset-0 z-[650] flex items-center justify-center bg-black/50 p-4" onClick={() => !savingRequirementId && setEditingRequirement(null)}>
      <div className="max-h-[calc(100vh-24px)] w-full max-w-[560px] overflow-y-auto rounded-xl bg-white shadow-2xl" onClick={event => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-4 border-b border-cream p-4">
          <div><h3 className="text-[17px] font-semibold text-navy">Editar configuración del requisito</h3><p className="mt-1 text-xs text-gray-500">{editingRequirement.nombre} · {editingRequirement.destino === 'empresa' ? 'Empresa' : 'Trabajador'}</p></div>
          <button type="button" className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600" aria-label="Cerrar" disabled={Boolean(savingRequirementId)} onClick={() => setEditingRequirement(null)}><X size={19} /></button>
        </div>
        <div className="flex flex-col gap-4 p-5">
          <div className="rounded-lg border border-cream3 bg-cream2/60 p-3 text-[11px] leading-relaxed text-gray-600"><strong className="text-navy">Identidad protegida.</strong> El nombre y el destino no se editan para conservar la asociación con documentos y obligaciones existentes.</div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="text-[12px] font-medium text-gray-700">Frecuencia<select value={editForm.frequency} onChange={event => setEditForm({ ...editForm, frequency: event.target.value })} className="form-input mt-1.5 w-full rounded-lg border border-cream3 p-2.5"><option>Mensual</option><option>Bimensual</option><option>Trimestral</option><option>Por Proyecto</option><option>6 meses</option><option>1 año</option><option>Indefinido</option></select></label>
            <label className="text-[12px] font-medium text-gray-700">Criticidad<select value={editForm.criticidad} onChange={event => setEditForm({ ...editForm, criticidad: event.target.value as Requisito['criticidad'] })} className="form-input mt-1.5 w-full rounded-lg border border-cream3 p-2.5"><option value="bloquea_pago">Bloquea pago</option><option value="bloquea_acceso">Bloquea ingreso</option><option value="bloquea_ambas">Bloquea ingreso y pago</option><option value="advertencia">Solo advertencia</option></select></label>
          </div>
          <label className="text-[12px] font-medium text-gray-700">Ámbito<select value={editForm.servicioId} onChange={event => setEditForm({ ...editForm, servicioId: event.target.value })} className="form-input mt-1.5 w-full rounded-lg border border-cream3 p-2.5"><option value="">Todo el proyecto</option>{getServiciosProyecto(editingRequirement.proyectoId).map(service => <option key={service.id} value={service.id}>{service.codigo} · {service.nombre}</option>)}</select></label>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="text-[12px] font-medium text-gray-700">Alerta preventiva (días)<input aria-label="Alerta preventiva edición" type="number" min="0" max="365" value={editForm.alertaDias} onChange={event => setEditForm({ ...editForm, alertaDias: Number(event.target.value) })} className="form-input mt-1.5 w-full rounded-lg border border-cream3 p-2.5" /></label>
            <label className="text-[12px] font-medium text-gray-700">Plazo después del período<input aria-label="Plazo después del período edición" type="number" min="0" max="90" value={editForm.diasPlazo} onChange={event => setEditForm({ ...editForm, diasPlazo: Number(event.target.value) })} className="form-input mt-1.5 w-full rounded-lg border border-cream3 p-2.5" /></label>
          </div>
          <label className="text-[12px] font-medium text-gray-700">Descripción para el contratista<textarea value={editForm.description} onChange={event => setEditForm({ ...editForm, description: event.target.value })} className="form-input mt-1.5 min-h-20 w-full rounded-lg border border-cream3 p-2.5" /></label>
          <label className="text-[12px] font-medium text-gray-700">Checklist de revisión<textarea value={editForm.checklist} onChange={event => setEditForm({ ...editForm, checklist: event.target.value })} className="form-input mt-1.5 min-h-24 w-full rounded-lg border border-cream3 p-2.5" placeholder="Un criterio por línea" /></label>
          {editingRequirement.destino === 'trabajador' && <label className="text-[12px] font-medium text-gray-700">Categorías aplicables<input value={editForm.categories} onChange={event => setEditForm({ ...editForm, categories: event.target.value })} className="form-input mt-1.5 w-full rounded-lg border border-cream3 p-2.5" placeholder="Conductor, Trabajo en altura" /><span className="mt-1 block text-[10.5px] font-normal text-gray-500">Sepáralas por coma. Vacío significa que aplica a todos los trabajadores del ámbito.</span></label>}
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
    const accreditation = accreditationLabel(calcularEstadoAcreditacion(contractor, selected.project.id)); const workers = selected.workers.filter(item => item.contractor.id === contractor.id); const workerAccess = workers.map(item => calcularAccesoTrabajador(item.worker, selected.project.id, contractor.id)); const enabled = workerAccess.filter(state => state === 'habilitado').length; const result = calcularAccesoPago(contractor, selected.project.id); const accessState = result.accesoEstado === 'bloqueado' || workerAccess.some(state => state === 'bloqueado') ? 'Con bloqueos' : result.accesoEstado === 'pendiente' || workerAccess.some(state => state === 'pendiente') ? 'Pendiente' : 'Habilitado'; const today = new Date().toISOString().slice(0,10); const obligations = getObligacionesDocumentales().filter(item => item.proyectoId===selected.project.id && item.contratistaId===contractor.id && item.activo && item.periodoInicio<=today && item.estado!=='no_aplica'); const satisfied = obligations.filter(item => item.estado==='aprobado' || item.estado==='por_vencer').length; const reviewCount = obligations.filter(item => item.estado==='revision').length; const compliance = obligations.length ? Math.round((satisfied/obligations.length)*100) : null;
    return <div key={contractor.id}><span><strong>{contractor.nombre}</strong><small>{selected.project.nombre}</small></span><span><small>Estado</small><b className={`mandante-proyectos-badge ${stateClass(accreditation)}`}>{accreditation}</b></span><span><small>Cumplimiento</small><strong>{compliance===null?'Sin obligaciones':`${compliance}%`}</strong><small>{reviewCount ? `${reviewCount} en revisión` : 'Sin revisión pendiente'}</small></span><span><small>Empresa</small><strong>{companyObligationSummary(contractor, selected.project.id, requirements)}</strong></span><span><small>Trabajadores</small><strong>{enabled}/{workers.length}</strong></span><span><small>Acceso</small><strong>{accessState === 'Con bloqueos' ? 'Bloqueado' : accessState}</strong></span><span><small>Pago</small><strong>{result.pagoEstado === 'bloqueado' ? 'Retenido' : result.pagoEstado === 'pendiente' ? 'Pendiente' : 'Habilitado'}</strong></span><button type="button" onClick={() => onOpen(selected.project.id, contractor.id)}>Abrir</button></div>;
  })}</div></article>;
}
