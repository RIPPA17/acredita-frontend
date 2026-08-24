import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, ArrowLeft, Building2, CheckCircle2, FileText, Search, ShieldCheck, Users } from 'lucide-react';
import {
  calcularAccesoPago,
  calcularEstadoAcreditacion,
  calcularEstadoTrabajador,
  esPorVencerPorFecha,
  esTrabajadorAsignado,
  esVencidoPorFecha,
  getRequisitos,
  obtenerDiasRestantes,
} from '../../data/localStorageDb';
import { Contratista, Documento, Proyecto, Requisito, Trabajador } from '../../types';
import { getEstadoDocumentoEfectivo, normalizarNombreDocumento } from '../contratista/documentosUtils';
import { companyObligationSummary } from './proyectos/proyectosUtils';
import {
  accreditationState,
  buildContractorMatrix,
  ContractorMatrixRow,
  MatrixState,
  summarizeContractorMatrix,
} from './contratistas/contratistasUtils';
import './ContratistasTab.css';

type ContractorTab = 'resumen' | 'acreditaciones' | 'trabajadores' | 'documentos';
type AttentionFilter = 'Todos' | 'Con problemas' | 'Al día';
type Focus = { projectId: string; workerRut?: string } | null;
type WorkerContext = { projectId: string; workerRut: string };
type DocumentContext = { projectId: string; documentId?: string; workerRut?: string; requirementId?: string };

interface Props {
  misProyectos: Proyecto[];
  allContratistas: Contratista[];
  selectedContratista: string | null;
  setSelectedContratista: (id: string | null) => void;
  focus?: Focus;
  onClearFocus: () => void;
  onSetFocus: (focus: Exclude<Focus, null>) => void;
  onOpenProject: (projectId: string) => void;
}

interface DocumentRow {
  key: string;
  document: Documento;
  associated: string;
  type: 'Empresa' | 'Trabajador';
  project: Proyecto;
  state: string;
  validity: string;
}

const badgeClass = (state: string) => state === 'Acreditado' || state === 'Aprobado'
  ? 'green'
  : state === 'Bloqueado' || state === 'Rechazado' || state === 'Vencido'
    ? 'red'
    : state === '—'
      ? 'gray'
      : 'yellow';

const workerStateLabel = (state: ReturnType<typeof calcularEstadoTrabajador>) => state === 'aprobado'
  ? 'Acreditado'
  : state === 'por_vencer'
    ? 'Por vencer'
    : state === 'rechazado'
      ? 'Bloqueado'
      : 'En proceso';

const effectiveState = (document: Documento, requirement?: Requisito) => {
  if (requirement) return getEstadoDocumentoEfectivo(document, requirement);
  if (document.estado === 'rechazado') return 'Rechazado';
  if (esVencidoPorFecha(document.vencimiento)) return 'Vencido';
  if (document.estado === 'revision') return 'En revisión';
  if (document.estado === 'pendiente') return 'Pendiente';
  if (document.estado === 'por_vencer' || esPorVencerPorFecha(document.vencimiento, 30)) return 'Por vencer';
  return 'Aprobado';
};

const validityLabel = (document: Documento, state: string) => {
  if (!document.vencimiento || document.vencimiento === '—') return 'Sin vigencia registrada';
  if (state === 'Vencido') return 'Vencido';
  const days = obtenerDiasRestantes(document.vencimiento);
  return days >= 0 ? `Vence en ${days} día${days === 1 ? '' : 's'}` : document.vencimiento;
};

export default function ContratistasTab({
  misProyectos,
  allContratistas,
  selectedContratista,
  setSelectedContratista,
  focus,
  onClearFocus,
  onSetFocus,
  onOpenProject,
}: Props) {
  const [activeTab, setActiveTab] = useState<ContractorTab>('resumen');
  const [search, setSearch] = useState('');
  const [projectFilter, setProjectFilter] = useState('all');
  const [attentionFilter, setAttentionFilter] = useState<AttentionFilter>('Todos');
  const [selectedAccreditationProjectId, setSelectedAccreditationProjectId] = useState<string | null>(null);
  const [selectedWorkerContext, setSelectedWorkerContext] = useState<WorkerContext | null>(null);
  const [selectedDocumentContext, setSelectedDocumentContext] = useState<DocumentContext | null>(null);
  const scopeProjects = useMemo(
    () => projectFilter === 'all' ? misProyectos : misProyectos.filter(project => project.id === projectFilter),
    [misProyectos, projectFilter],
  );
  const matrixRows = useMemo(
    () => buildContractorMatrix(scopeProjects, allContratistas),
    [scopeProjects, allContratistas],
  );
  const executive = summarizeContractorMatrix(matrixRows);
  const visibleRows = matrixRows.filter(row => {
    const query = search.trim().toLocaleLowerCase('es');
    const textMatches = !query || `${row.contractor.nombre} ${row.contractor.rut}`.toLocaleLowerCase('es').includes(query);
    const stateMatches = attentionFilter === 'Todos' || (attentionFilter === 'Con problemas' ? row.hasProblems : row.allGood);
    return textMatches && stateMatches;
  });
  const contractorIds = new Set(misProyectos.flatMap(project => project.contratistas));
  const selected = allContratistas.find(contractor => contractor.id === selectedContratista && contractorIds.has(contractor.id));

  useEffect(() => {
    if (!focus) return;
    if (focus.workerRut) {
      setActiveTab('trabajadores');
      setSelectedWorkerContext({ projectId: focus.projectId, workerRut: focus.workerRut });
    } else {
      setActiveTab('acreditaciones');
      setSelectedAccreditationProjectId(focus.projectId);
    }
  }, [focus]);

  const openGeneral = (contractorId: string) => {
    onClearFocus();
    setSelectedContratista(contractorId);
    setActiveTab('resumen');
  };

  const openAccreditation = (contractorId: string, projectId: string) => {
    setSelectedContratista(contractorId);
    onSetFocus({ projectId });
    setActiveTab('acreditaciones');
    setSelectedAccreditationProjectId(projectId);
  };

  if (!selected) {
    if (misProyectos.length === 0) return <div className="mandante-contratistas-empty">No hay proyectos disponibles para construir la matriz de contratistas.</div>;
    return <section className="mandante-contratistas fade-in">
      <header className="mandante-contratistas-page-head">
        <div><h1>Contratistas</h1><p>Compara rápidamente cómo se encuentra cada empresa en todos tus proyectos.</p></div>
        <div className="mandante-contratistas-filters">
          <label className="mandante-contratistas-search"><Search /><span className="sr-only">Buscar contratista</span><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar contratista..." /></label>
          <label><span className="sr-only">Filtrar proyecto</span><select value={projectFilter} onChange={event => setProjectFilter(event.target.value)}><option value="all">Todos los proyectos</option>{misProyectos.map(project => <option value={project.id} key={project.id}>{project.nombre}</option>)}</select></label>
          <label><span className="sr-only">Filtrar estado</span><select value={attentionFilter} onChange={event => setAttentionFilter(event.target.value as AttentionFilter)}><option>Todos</option><option>Con problemas</option><option>Al día</option></select></label>
        </div>
      </header>
      <div className="mandante-contratistas-executive">
        <ShieldCheck />
        <div><strong>{executive.contractorsAttention} de {executive.contractorsTotal} contratistas requieren atención en {executive.projectsAttention} proyecto{executive.projectsAttention === 1 ? '' : 's'}.</strong><span>Hay {executive.retainedPayments} pagos retenidos y {executive.workersWithoutAccess} trabajadores sin acceso.</span></div>
      </div>
      <div className="mandante-contratistas-legend"><span><i className="green" />Acreditado</span><span><i className="yellow" />En proceso</span><span><i className="red" />Bloqueado</span><span><i className="gray" />No participa</span></div>
      {matrixRows.length === 0 ? <div className="mandante-contratistas-empty">No hay contratistas asociados a los proyectos del Mandante.</div> : visibleRows.length === 0 ? <div className="mandante-contratistas-empty">No hay contratistas que coincidan con estos filtros.</div> : <Matrix rows={visibleRows} projects={scopeProjects} onOpenGeneral={openGeneral} onOpenAccreditation={openAccreditation} />}
      <p className="mandante-contratistas-note">Cada celda representa una acreditación distinta: Contratista + Proyecto. Nombre de empresa = ficha general · estado = acreditación exacta.</p>
    </section>;
  }

  const associatedProjects = misProyectos.filter(project => project.contratistas.includes(selected.id));
  const uniqueWorkers = new Set(associatedProjects.flatMap(project => (selected.trabajadores || []).filter(worker => esTrabajadorAsignado(worker, project.id, misProyectos)).map(worker => worker.rut))).size;
  const tabs = [
    { id: 'resumen' as const, label: 'Resumen', icon: Building2 }, { id: 'acreditaciones' as const, label: 'Acreditaciones', icon: ShieldCheck },
    { id: 'trabajadores' as const, label: 'Trabajadores', icon: Users }, { id: 'documentos' as const, label: 'Documentos', icon: FileText },
  ];
  const clearDetails = () => { setSelectedAccreditationProjectId(null); setSelectedWorkerContext(null); setSelectedDocumentContext(null); };
  const clearAndShowGeneral = () => { onClearFocus(); clearDetails(); setActiveTab('resumen'); };
  const showAccreditation = (projectId: string) => { setSelectedAccreditationProjectId(projectId); setActiveTab('acreditaciones'); };
  const showWorker = (context: WorkerContext) => { setSelectedWorkerContext(context); setActiveTab('trabajadores'); };
  const showDocument = (context: DocumentContext) => { setSelectedDocumentContext(context); setActiveTab('documentos'); };

  return <section className="mandante-contratistas mandante-contratistas-detail fade-in">
    <button type="button" className="mandante-contratistas-back" onClick={() => { onClearFocus(); clearDetails(); setSelectedContratista(null); }}><ArrowLeft /> Volver a contratistas</button>
    <header className="mandante-contratistas-hero"><div><span>Relación con el Mandante</span><h1>{selected.nombre}</h1><p>RUT {selected.rut} · {associatedProjects.length} proyecto{associatedProjects.length === 1 ? '' : 's'} · {uniqueWorkers} trabajador{uniqueWorkers === 1 ? '' : 'es'}</p></div></header>
    <nav className="mandante-contratistas-tabs" aria-label="Secciones del contratista">{tabs.map(tab => <button type="button" key={tab.id} className={activeTab === tab.id ? 'active' : ''} onClick={() => { if (tab.id === 'resumen') clearAndShowGeneral(); else setActiveTab(tab.id); }}><tab.icon /> <span>{tab.label}</span></button>)}</nav>
    {focus && <div className="mandante-contratistas-context"><span><strong>{associatedProjects.find(project => project.id === focus.projectId)?.nombre}</strong> · {focus.workerRut ? 'trabajador seleccionado' : 'acreditación seleccionada'}</span><button type="button" onClick={clearAndShowGeneral}>Ver ficha general</button></div>}
    {activeTab === 'resumen' && <ContractorSummaryV5 contractor={selected} projects={associatedProjects} allProjects={misProyectos} allContractors={allContratistas} onOpenAccreditation={showAccreditation} onOpenWorker={showWorker} onOpenDocument={showDocument} />}
    {activeTab === 'acreditaciones' && <AccreditationsV5 contractor={selected} projects={associatedProjects} allProjects={misProyectos} selectedProjectId={selectedAccreditationProjectId} focus={focus} onShowGeneral={clearAndShowGeneral} onSelectProject={setSelectedAccreditationProjectId} onOpenWorker={showWorker} onOpenDocument={showDocument} />}
    {activeTab === 'trabajadores' && <WorkersV5 contractor={selected} projects={associatedProjects} allProjects={misProyectos} focus={focus} selectedContext={selectedWorkerContext} onSelect={setSelectedWorkerContext} onOpenDocument={showDocument} />}
    {activeTab === 'documentos' && <DocumentsV5 contractor={selected} projects={associatedProjects} focus={focus} selectedContext={selectedDocumentContext} onSelect={setSelectedDocumentContext} onOpenAccreditation={showAccreditation} />}
  </section>;
}

function Matrix({ rows, projects, onOpenGeneral, onOpenAccreditation }: { rows: ContractorMatrixRow[]; projects: Proyecto[]; onOpenGeneral: (id: string) => void; onOpenAccreditation: (contractorId: string, projectId: string) => void }) {
  return <div className="mandante-contratistas-matrix-wrap"><table className="mandante-contratistas-matrix"><thead><tr><th>Contratista</th>{projects.map(project => <th key={project.id}>{project.nombre}</th>)}<th>Atención</th></tr></thead><tbody>{rows.map(row => <tr key={row.contractor.id}><td><button type="button" onClick={() => onOpenGeneral(row.contractor.id)} aria-label={`Abrir ficha de ${row.contractor.nombre}`}><strong>{row.contractor.nombre}</strong><span>RUT {row.contractor.rut} · {row.uniqueWorkers} trabajador{row.uniqueWorkers === 1 ? '' : 'es'}</span></button></td>{projects.map(project => {
    const context = row.contexts.find(item => item.project.id === project.id);
    return <td key={project.id}>{context ? <button type="button" className={`mandante-contratistas-state ${badgeClass(context.state)}`} onClick={() => onOpenAccreditation(row.contractor.id, project.id)} aria-label={`Abrir acreditación de ${row.contractor.nombre} en ${project.nombre}`}>{context.state}</button> : <span className="mandante-contratistas-state gray">—</span>}</td>;
  })}<td><Attention row={row} /></td></tr>)}</tbody></table></div>;
}

function Attention({ row }: { row: ContractorMatrixRow }) {
  if (row.criticalImpacts > 0) return <div className="mandante-contratistas-attention red"><strong>{row.criticalImpacts} crítico{row.criticalImpacts === 1 ? '' : 's'}</strong><span>{row.accessImpacts ? `${row.accessImpacts} acceso${row.accessImpacts === 1 ? '' : 's'}` : ''}{row.accessImpacts && row.paymentImpacts ? ' · ' : ''}{row.paymentImpacts ? `${row.paymentImpacts} pago${row.paymentImpacts === 1 ? '' : 's'}` : ''}</span></div>;
  if (row.priorities.length > 0) return <div className="mandante-contratistas-attention yellow"><strong>{row.priorities.length} alerta{row.priorities.length === 1 ? '' : 's'}</strong><span>Sin bloqueo operativo</span></div>;
  return <div className="mandante-contratistas-attention green"><strong>Todo al día</strong><span>Sin bloqueos</span></div>;
}

function ContractorSummary({ contractor, projects, allProjects, allContractors, onOpenAccreditation }: { contractor: Contratista; projects: Proyecto[]; allProjects: Proyecto[]; allContractors: Contratista[]; onOpenAccreditation: (projectId: string) => void }) {
  const priorities = buildContractorMatrix(projects, allContractors).find(row => row.contractor.id === contractor.id)?.priorities || [];
  return <div className="mandante-contratistas-summary mandante-contratistas-panel"><article className="mandante-contratistas-card"><h2>Participación por proyecto</h2><p>Una acreditación independiente para cada relación Contratista + Proyecto.</p><div className="mandante-contratistas-participation">{projects.map(project => {
    const workers = (contractor.trabajadores || []).filter(worker => esTrabajadorAsignado(worker, project.id, allProjects)); const state = accreditationState(calcularEstadoAcreditacion(contractor, project.id)); const result = calcularAccesoPago(contractor, project.id);
    return <div key={project.id}><span><strong>{project.nombre}</strong><small>{workers.length} trabajador{workers.length === 1 ? '' : 'es'} asignado{workers.length === 1 ? '' : 's'}</small></span><b className={`mandante-contratistas-state ${badgeClass(state)}`}>{state}</b><span><small>Acceso</small><strong>{result.accesoEstado === 'bloqueado' ? 'Con bloqueos' : result.accesoEstado === 'pendiente' ? 'Pendiente' : 'Habilitado'}</strong></span><span><small>Pago</small><strong>{result.pagoEstado === 'bloqueado' ? 'Retenido' : result.pagoEstado === 'pendiente' ? 'Pendiente' : 'Habilitado'}</strong></span><button type="button" onClick={() => onOpenAccreditation(project.id)}>Ver acreditación</button></div>;
  })}</div></article><article className="mandante-contratistas-card"><h2>Requiere atención</h2><p>Casos de esta empresa que requieren una acción del Mandante.</p><div className="mandante-contratistas-priorities">{priorities.map(priority => <div key={priority.key}><span className={priority.kind === 'por_vencer' ? 'yellow' : 'red'}><AlertCircle /></span><div><strong>{priority.projectName} · {priority.title.split(' · ')[0]}</strong><p>{priority.detail}</p></div></div>)}{priorities.length === 0 && <div className="mandante-contratistas-ok"><CheckCircle2 /> <span><strong>Todo al día</strong><small>Esta empresa no presenta bloqueos ni alertas relevantes en tus proyectos.</small></span></div>}</div></article></div>;
}

function Accreditations({ contractor, projects, allProjects, focus, onShowGeneral, onOpenProject }: { contractor: Contratista; projects: Proyecto[]; allProjects: Proyecto[]; focus?: Focus; onShowGeneral: () => void; onOpenProject: (projectId: string) => void }) {
  const requirements = getRequisitos();
  return <div className="mandante-contratistas-panel">{focus && <div className="mandante-contratistas-context"><span><strong>{projects[0]?.nombre}</strong> · acreditación seleccionada</span><button type="button" onClick={onShowGeneral}>Ver ficha general</button></div>}<article className="mandante-contratistas-card"><h2>Acreditaciones por proyecto</h2><p>Cada fila corresponde únicamente a esta empresa dentro de un proyecto.</p><div className="mandante-contratistas-table-wrap"><table><thead><tr><th>Proyecto</th><th>Estado</th><th>Empresa</th><th>Trabajadores</th><th>Acceso</th><th>Pago</th><th></th></tr></thead><tbody>{projects.map(project => {
    const state = accreditationState(calcularEstadoAcreditacion(contractor, project.id)); const workers = (contractor.trabajadores || []).filter(worker => esTrabajadorAsignado(worker, project.id, allProjects)); const enabled = workers.filter(worker => ['aprobado', 'por_vencer'].includes(calcularEstadoTrabajador(worker, project.id))).length; const result = calcularAccesoPago(contractor, project.id);
    return <tr key={project.id} className={focus?.projectId === project.id ? 'selected' : ''}><td><strong>{project.nombre}</strong></td><td><b className={`mandante-contratistas-state ${badgeClass(state)}`}>{state}</b></td><td>{companyObligationSummary(contractor, project.id, requirements.filter(requirement => requirement.proyectoId === project.id))}</td><td>{enabled}/{workers.length} habilitados</td><td>{result.accesoEstado === 'bloqueado' ? 'Bloqueado' : result.accesoEstado === 'pendiente' ? 'Pendiente' : 'Habilitado'}</td><td>{result.pagoEstado === 'bloqueado' ? 'Retenido' : result.pagoEstado === 'pendiente' ? 'Pendiente' : 'Habilitado'}</td><td><button type="button" onClick={() => onOpenProject(project.id)}>Ver proyecto</button></td></tr>;
  })}</tbody></table></div></article></div>;
}

function Workers({ contractor, projects, allProjects, focus, onClearFocus }: { contractor: Contratista; projects: Proyecto[]; allProjects: Proyecto[]; focus?: Focus; onClearFocus: () => void }) {
  const [projectFilter, setProjectFilter] = useState(focus?.projectId || 'all'); const [stateFilter, setStateFilter] = useState('all');
  const rows = projects.flatMap(project => (contractor.trabajadores || []).filter(worker => esTrabajadorAsignado(worker, project.id, allProjects)).map(worker => ({ project, worker, state: calcularEstadoTrabajador(worker, project.id) }))).filter(row => (projectFilter === 'all' || row.project.id === projectFilter) && (stateFilter === 'all' || row.state === stateFilter));
  return <div className="mandante-contratistas-panel"><div className="mandante-contratistas-local-filters"><select value={projectFilter} onChange={event => { setProjectFilter(event.target.value); if (focus) onClearFocus(); }}><option value="all">Todos los proyectos</option>{projects.map(project => <option value={project.id} key={project.id}>{project.nombre}</option>)}</select><select value={stateFilter} onChange={event => setStateFilter(event.target.value)}><option value="all">Todos los estados</option><option value="aprobado">Acreditado</option><option value="por_vencer">Por vencer</option><option value="pendiente">En proceso</option><option value="rechazado">Bloqueado</option></select></div><article className="mandante-contratistas-card"><h2>Trabajadores por proyecto</h2><p>El estado y el acceso se calculan dentro de cada proyecto.</p><div className="mandante-contratistas-table-wrap"><table><thead><tr><th>Trabajador</th><th>RUT</th><th>Proyecto</th><th>Cargo</th><th>Estado</th><th>Acceso</th></tr></thead><tbody>{rows.map(({ project, worker, state }) => { const label = workerStateLabel(state); const enabled = state === 'aprobado' || state === 'por_vencer'; return <tr key={`${project.id}:${worker.rut}`} className={project.id === focus?.projectId && worker.rut === focus?.workerRut ? 'worker-focus' : ''}><td><strong>{worker.nombre}</strong></td><td>{worker.rut}</td><td>{project.nombre}</td><td>{worker.cargo || 'Sin cargo registrado'}</td><td><b className={`mandante-contratistas-state ${badgeClass(label)}`}>{label}</b></td><td className={enabled ? 'positive' : 'negative'}>{enabled ? 'Habilitado' : 'Sin acceso'}</td></tr>; })}</tbody></table></div></article></div>;
}

function Documents({ contractor, projects, focus }: { contractor: Contratista; projects: Proyecto[]; focus?: Focus }) {
  const [projectFilter, setProjectFilter] = useState(focus?.projectId || 'all'); const [typeFilter, setTypeFilter] = useState('all'); const [stateFilter, setStateFilter] = useState('all'); const projectIds = new Set(projects.map(project => project.id)); const requirements = getRequisitos();
  const buildRow = (document: Documento, associated: string, type: DocumentRow['type'], suffix: string): DocumentRow | null => { const project = projects.find(item => item.id === document.proyectoId); if (!project) return null; const requirement = requirements.find(item => item.proyectoId === project.id && normalizarNombreDocumento(item.nombre) === normalizarNombreDocumento(document.nombre)); const state = effectiveState(document, requirement); return { key: `${project.id}:${suffix}:${document.id}`, document, associated, type, project, state, validity: validityLabel(document, state) }; };
  const rows = [
    ...contractor.documentos.filter(document => document.proyectoId && projectIds.has(document.proyectoId)).map(document => buildRow(document, contractor.nombre, 'Empresa', 'empresa')),
    ...(contractor.trabajadores || []).flatMap(worker => (worker.documentos || []).filter(document => document.proyectoId && projectIds.has(document.proyectoId)).map(document => buildRow(document, worker.nombre, 'Trabajador', worker.rut))),
  ].filter((row): row is DocumentRow => row !== null).filter(row => (projectFilter === 'all' || row.project.id === projectFilter) && (typeFilter === 'all' || row.type === typeFilter) && (stateFilter === 'all' || row.state === stateFilter));
  const states = [...new Set(rows.map(row => row.state))];
  return <div className="mandante-contratistas-panel"><div className="mandante-contratistas-local-filters"><select value={projectFilter} onChange={event => setProjectFilter(event.target.value)}><option value="all">Todos los proyectos</option>{projects.map(project => <option value={project.id} key={project.id}>{project.nombre}</option>)}</select><select value={typeFilter} onChange={event => setTypeFilter(event.target.value)}><option value="all">Empresa y trabajadores</option><option value="Empresa">Empresa</option><option value="Trabajador">Trabajadores</option></select><select value={stateFilter} onChange={event => setStateFilter(event.target.value)}><option value="all">Todos los estados</option>{states.map(state => <option value={state} key={state}>{state}</option>)}</select></div><article className="mandante-contratistas-card"><h2>Documentos</h2><p>Consulta de solo lectura para el Mandante.</p><div className="mandante-contratistas-table-wrap"><table><thead><tr><th>Documento</th><th>Asociado a</th><th>Proyecto</th><th>Estado</th><th>Vigencia</th></tr></thead><tbody>{rows.map(row => <tr key={row.key}><td><strong>{row.document.nombre}</strong></td><td>{row.associated}<small>{row.type}</small></td><td>{row.project.nombre}</td><td><b className={`mandante-contratistas-state ${badgeClass(row.state)}`}>{row.state}</b></td><td>{row.validity}</td></tr>)}</tbody></table></div></article></div>;
}

const findRequirementDocument = (contractor: Contratista, requirement: Requisito, projectId: string, worker?: Trabajador) => {
  const documents = worker ? worker.documentos : contractor.documentos;
  return (documents || []).find(document => document.proyectoId === projectId && normalizarNombreDocumento(document.nombre) === normalizarNombreDocumento(requirement.nombre));
};

function ContractorSummaryV5({ contractor, projects, allProjects, allContractors, onOpenAccreditation, onOpenWorker, onOpenDocument }: { contractor: Contratista; projects: Proyecto[]; allProjects: Proyecto[]; allContractors: Contratista[]; onOpenAccreditation: (id: string) => void; onOpenWorker: (value: WorkerContext) => void; onOpenDocument: (value: DocumentContext) => void }) {
  const priorities = buildContractorMatrix(projects, allContractors).find(row => row.contractor.id === contractor.id)?.priorities || [];
  return <div className="mandante-contratistas-summary mandante-contratistas-panel"><article className="mandante-contratistas-card"><h2>Participación por proyecto</h2><p>Estado real del contratista dentro de cada obra.</p><div className="mandante-contratistas-participation">{projects.map(project => { const workers=(contractor.trabajadores||[]).filter(worker=>esTrabajadorAsignado(worker,project.id,allProjects)); const enabled=workers.filter(worker=>['aprobado','por_vencer'].includes(calcularEstadoTrabajador(worker,project.id))).length; const state=accreditationState(calcularEstadoAcreditacion(contractor,project.id)); const result=calcularAccesoPago(contractor,project.id); return <div key={project.id}><span><strong>{project.nombre}</strong><small>{enabled}/{workers.length} trabajadores habilitados</small></span><b className={`mandante-contratistas-state ${badgeClass(state)}`}>{state}</b><span><small>Acceso</small><strong>{result.accesoEstado==='bloqueado'?'Con bloqueos':result.accesoEstado==='pendiente'?'Pendiente':'Habilitado'}</strong></span><span><small>Pago</small><strong>{result.pagoEstado==='bloqueado'?'Retenido':result.pagoEstado==='pendiente'?'Pendiente':'Habilitado'}</strong></span><button type="button" onClick={()=>onOpenAccreditation(project.id)}>Ver acreditación</button></div>;})}</div></article><article className="mandante-contratistas-card"><h2>Requiere atención</h2><p>Casos de esta empresa que requieren una acción.</p><div className="mandante-contratistas-priorities">{priorities.map(priority=><div key={priority.key}><span className={priority.kind==='por_vencer'?'yellow':'red'}><AlertCircle/></span><div><strong>{priority.title}</strong><p>{priority.detail}</p></div><button type="button" onClick={()=>{if(priority.workerRut) onOpenWorker({projectId:priority.projectId,workerRut:priority.workerRut}); else onOpenDocument({projectId:priority.projectId,requirementId:priority.key.split(':empresa:')[1]});}}>{priority.workerRut?'Ver trabajador':'Ver documento'}</button></div>)}{priorities.length===0&&<div className="mandante-contratistas-ok"><CheckCircle2/><span><strong>Todo al día</strong><small>No hay asuntos que requieran atención.</small></span></div>}</div></article></div>;
}

function AccreditationsV5({ contractor, projects, allProjects, selectedProjectId, focus, onShowGeneral, onSelectProject, onOpenWorker, onOpenDocument }: { contractor: Contratista; projects: Proyecto[]; allProjects: Proyecto[]; selectedProjectId: string|null; focus?: Focus; onShowGeneral:()=>void; onSelectProject:(id:string|null)=>void; onOpenWorker:(v:WorkerContext)=>void; onOpenDocument:(v:DocumentContext)=>void }) {
  const requirements=getRequisitos(); const project=projects.find(item=>item.id===selectedProjectId);
  if(project){const state=accreditationState(calcularEstadoAcreditacion(contractor,project.id)); const companyReqs=requirements.filter(req=>req.proyectoId===project.id&&req.activo!==false&&req.obligatorio&&req.destino==='empresa'); const workers=(contractor.trabajadores||[]).filter(worker=>esTrabajadorAsignado(worker,project.id,allProjects)); return <div className="mandante-contratistas-panel"><button type="button" className="mandante-contratistas-back" onClick={()=>onSelectProject(null)}><ArrowLeft/> Volver a acreditaciones</button><article className="mandante-contratistas-card"><div className="mandante-contratistas-detail-head"><div><h2>{project.nombre} · {contractor.nombre}</h2><p>Acreditación exacta Contratista + Proyecto.</p></div><b className={`mandante-contratistas-state ${badgeClass(state)}`}>{state}</b></div><div className="mandante-contratistas-accreditation-detail"><section><h3>Empresa</h3>{companyReqs.map(req=>{const doc=findRequirementDocument(contractor,req,project.id);const state=doc?getEstadoDocumentoEfectivo(doc,req):'Pendiente';return <button type="button" key={req.id} onClick={()=>onOpenDocument({projectId:project.id,documentId:doc?.id,requirementId:req.id})}><span><strong>{req.nombre}</strong><small>{doc?validityLabel(doc,state):'No se ha cargado un documento para este requisito.'}</small></span><b className={`mandante-contratistas-state ${badgeClass(state)}`}>{state}</b></button>})}</section><section><h3>Trabajadores</h3>{workers.map(worker=>{const raw=calcularEstadoTrabajador(worker,project.id);const label=workerStateLabel(raw);return <button type="button" key={worker.rut} onClick={()=>onOpenWorker({projectId:project.id,workerRut:worker.rut})}><span><strong>{worker.nombre}</strong><small>{worker.cargo||'Sin cargo registrado'}</small></span><b className={`mandante-contratistas-state ${badgeClass(label)}`}>{label}</b><small>{raw==='aprobado'||raw==='por_vencer'?'Acceso habilitado':'Sin acceso'}</small></button>})}{workers.length===0&&<p>No hay trabajadores asociados a este proyecto.</p>}</section></div></article></div>}
  return <div className="mandante-contratistas-panel">{focus&&<div className="mandante-contratistas-context"><span><strong>{projects.find(p=>p.id===focus.projectId)?.nombre}</strong> · acreditación seleccionada</span><button type="button" onClick={onShowGeneral}>Ver ficha general</button></div>}<article className="mandante-contratistas-card"><h2>Acreditaciones</h2><p>Una acreditación independiente por proyecto.</p><div className="mandante-contratistas-accreditation-list">{projects.map(project=>{const state=accreditationState(calcularEstadoAcreditacion(contractor,project.id));const workers=(contractor.trabajadores||[]).filter(worker=>esTrabajadorAsignado(worker,project.id,allProjects));const enabled=workers.filter(worker=>['aprobado','por_vencer'].includes(calcularEstadoTrabajador(worker,project.id))).length;const result=calcularAccesoPago(contractor,project.id);const row=buildContractorMatrix([project],[contractor])[0];return <div key={project.id}><span><strong>{project.nombre}</strong><small>Contratista + Proyecto</small></span><b className={`mandante-contratistas-state ${badgeClass(state)}`}>{state}</b><span><small>Empresa</small><strong>{companyObligationSummary(contractor,project.id,requirements.filter(r=>r.proyectoId===project.id))}</strong></span><span><small>Trabajadores</small><strong>{enabled}/{workers.length}</strong></span><span><small>Acceso</small><strong>{result.accesoEstado==='bloqueado'?'Con bloqueos':result.accesoEstado==='pendiente'?'Pendiente':'Habilitado'}</strong></span><span><small>Pago</small><strong>{result.pagoEstado==='bloqueado'?'Retenido':result.pagoEstado==='pendiente'?'Pendiente':'Habilitado'}</strong></span><span><small>Críticos</small><strong>{row?.criticalImpacts||0}</strong></span><button type="button" onClick={()=>onSelectProject(project.id)}>Abrir acreditación</button></div>})}</div></article></div>;
}

function WorkersV5({contractor,projects,allProjects,focus,selectedContext,onSelect,onOpenDocument}:{contractor:Contratista;projects:Proyecto[];allProjects:Proyecto[];focus?:Focus;selectedContext:WorkerContext|null;onSelect:(v:WorkerContext|null)=>void;onOpenDocument:(v:DocumentContext)=>void}){const [search,setSearch]=useState('');const [projectFilter,setProjectFilter]=useState(focus?.projectId||'all');const [stateFilter,setStateFilter]=useState('all');const context=selectedContext;const project=context?projects.find(p=>p.id===context.projectId):undefined;const worker=context?(contractor.trabajadores||[]).find(w=>w.rut===context.workerRut):undefined;if(project&&worker){const state=calcularEstadoTrabajador(worker,project.id);const reqs=getRequisitos().filter(r=>r.proyectoId===project.id&&r.activo!==false&&r.obligatorio&&r.destino==='trabajador');return <div className="mandante-contratistas-panel"><button type="button" className="mandante-contratistas-back" onClick={()=>onSelect(null)}><ArrowLeft/> Volver a trabajadores</button><div className="mandante-contratistas-worker-detail"><aside><strong>{worker.nombre}</strong><span>{worker.rut}</span><span>{worker.cargo||'Sin cargo registrado'}</span><span>{project.nombre}</span><b className={`mandante-contratistas-state ${badgeClass(workerStateLabel(state))}`}>{workerStateLabel(state)}</b><em>{state==='aprobado'||state==='por_vencer'?'Acceso habilitado':'Sin acceso'}</em></aside><article className="mandante-contratistas-card"><h2>Documentación del trabajador</h2>{reqs.map(req=>{const doc=findRequirementDocument(contractor,req,project.id,worker);const s=doc?getEstadoDocumentoEfectivo(doc,req):'Pendiente';return <button type="button" className="mandante-contratistas-doc-row" key={req.id} onClick={()=>onOpenDocument({projectId:project.id,workerRut:worker.rut,documentId:doc?.id,requirementId:req.id})}><span><strong>{req.nombre}</strong><small>{project.nombre}</small></span><b className={`mandante-contratistas-state ${badgeClass(s)}`}>{s}</b><span>Ver documento</span></button>})}</article></div></div>};const rows=projects.flatMap(p=>(contractor.trabajadores||[]).filter(w=>esTrabajadorAsignado(w,p.id,allProjects)).map(w=>({project:p,worker:w,state:calcularEstadoTrabajador(w,p.id)}))).filter(r=>(projectFilter==='all'||r.project.id===projectFilter)&&(stateFilter==='all'||r.state===stateFilter)&&`${r.worker.nombre} ${r.worker.rut}`.toLowerCase().includes(search.toLowerCase()));return <div className="mandante-contratistas-panel"><div className="mandante-contratistas-local-filters"><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar trabajador..."/><select value={projectFilter} onChange={e=>setProjectFilter(e.target.value)}><option value="all">Todos los proyectos</option>{projects.map(p=><option value={p.id} key={p.id}>{p.nombre}</option>)}</select><select value={stateFilter} onChange={e=>setStateFilter(e.target.value)}><option value="all">Todos los estados</option><option value="aprobado">Acreditado</option><option value="por_vencer">Por vencer</option><option value="pendiente">En proceso</option><option value="rechazado">Bloqueado</option></select></div><article className="mandante-contratistas-card"><h2>Trabajadores</h2><div className="mandante-contratistas-table-wrap"><table><thead><tr><th>Trabajador</th><th>RUT</th><th>Proyecto</th><th>Cargo</th><th>Estado</th><th>Acceso</th></tr></thead><tbody>{rows.map(r=><tr key={`${r.project.id}:${r.worker.rut}`} className={r.project.id===focus?.projectId&&r.worker.rut===focus?.workerRut?'worker-focus':''} onClick={()=>onSelect({projectId:r.project.id,workerRut:r.worker.rut})}><td><button type="button">{r.worker.nombre}</button></td><td>{r.worker.rut}</td><td>{r.project.nombre}</td><td>{r.worker.cargo||'—'}</td><td><b className={`mandante-contratistas-state ${badgeClass(workerStateLabel(r.state))}`}>{workerStateLabel(r.state)}</b></td><td>{r.state==='aprobado'||r.state==='por_vencer'?'Habilitado':'Sin acceso'}</td></tr>)}</tbody></table></div></article></div>}

function DocumentsV5({contractor,projects,focus,selectedContext,onSelect,onOpenAccreditation}:{contractor:Contratista;projects:Proyecto[];focus?:Focus;selectedContext:DocumentContext|null;onSelect:(v:DocumentContext|null)=>void;onOpenAccreditation:(id:string)=>void}){const [search,setSearch]=useState('');const [projectFilter,setProjectFilter]=useState(focus?.projectId||'all');const [typeFilter,setTypeFilter]=useState('all');const requirements=getRequisitos();const rows:DocumentRow[]=[...contractor.documentos.map(d=>({d,owner:contractor.nombre,type:'Empresa' as const,suffix:'empresa'})),...(contractor.trabajadores||[]).flatMap(w=>(w.documentos||[]).map(d=>({d,owner:w.nombre,type:'Trabajador' as const,suffix:w.rut})))].flatMap(item=>{const project=projects.find(p=>p.id===item.d.proyectoId);if(!project)return[];const req=requirements.find(r=>r.proyectoId===project.id&&normalizarNombreDocumento(r.nombre)===normalizarNombreDocumento(item.d.nombre));const state=effectiveState(item.d,req);return[{key:`${project.id}:${item.suffix}:${item.d.id}`,document:item.d,associated:item.owner,type:item.type,project,state,validity:validityLabel(item.d,state)}]}).filter(r=>(projectFilter==='all'||r.project.id===projectFilter)&&(typeFilter==='all'||r.type===typeFilter)&&`${r.document.nombre} ${r.associated}`.toLowerCase().includes(search.toLowerCase()));const ctx=selectedContext;if(ctx){const project=projects.find(p=>p.id===ctx.projectId);const worker=ctx.workerRut?(contractor.trabajadores||[]).find(w=>w.rut===ctx.workerRut):undefined;const docs=worker?worker.documentos:contractor.documentos;const doc=(docs||[]).find(d=>d.id===ctx.documentId);const req=requirements.find(r=>r.id===ctx.requirementId);const state=doc?effectiveState(doc,req):'Pendiente';return <div className="mandante-contratistas-panel"><button type="button" className="mandante-contratistas-back" onClick={()=>onSelect(null)}><ArrowLeft/> Volver a documentos</button><div className="mandante-contratistas-document-detail"><article className="mandante-contratistas-card"><div className="mandante-contratistas-detail-head"><div><h2>{doc?.nombre||req?.nombre||'Documento faltante'}</h2><p>{worker?.nombre||contractor.nombre} · {project?.nombre}</p></div><b className={`mandante-contratistas-state ${badgeClass(state)}`}>{state}</b></div><dl><div><dt>Asociado a</dt><dd>{worker?.nombre||contractor.nombre}</dd></div><div><dt>Proyecto</dt><dd>{project?.nombre}</dd></div><div><dt>Vencimiento</dt><dd>{doc?.vencimiento||'—'}</dd></div><div><dt>Estado actual</dt><dd>{doc?validityLabel(doc,state):'No se ha cargado un documento para este requisito.'}</dd></div></dl><button type="button" onClick={()=>project&&onOpenAccreditation(project.id)}>Ver acreditación</button></article><article className="mandante-contratistas-card"><h2>Historial</h2>{doc?.historial?.length?doc.historial.map((event,index)=><div className="mandante-contratistas-history" key={`${event.version}:${index}`}><strong>Versión {event.version} · {event.estado}</strong><small>{event.fecha}</small></div>):<p>No hay historial disponible para este documento.</p>}</article></div></div>};return <div className="mandante-contratistas-panel"><div className="mandante-contratistas-local-filters"><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar documento..."/><select value={projectFilter} onChange={e=>setProjectFilter(e.target.value)}><option value="all">Todos los proyectos</option>{projects.map(p=><option value={p.id} key={p.id}>{p.nombre}</option>)}</select><select value={typeFilter} onChange={e=>setTypeFilter(e.target.value)}><option value="all">Todos</option><option value="Empresa">Empresa</option><option value="Trabajador">Trabajadores</option></select></div><article className="mandante-contratistas-card"><h2>Documentos</h2><p>Explorador documental de solo lectura.</p><div className="mandante-contratistas-table-wrap"><table><thead><tr><th>Documento</th><th>Asociado a</th><th>Proyecto</th><th>Estado</th><th>Vencimiento</th></tr></thead><tbody>{rows.map(r=><tr key={r.key} onClick={()=>onSelect({projectId:r.project.id,documentId:r.document.id,workerRut:r.type==='Trabajador'?r.key.split(':')[1]:undefined})}><td><button type="button">{r.document.nombre}</button></td><td>{r.associated}</td><td>{r.project.nombre}</td><td><b className={`mandante-contratistas-state ${badgeClass(r.state)}`}>{r.state}</b></td><td>{r.validity}</td></tr>)}</tbody></table></div>{rows.length===0&&<p>No hay documentos que coincidan con los filtros.</p>}</article></div>}
