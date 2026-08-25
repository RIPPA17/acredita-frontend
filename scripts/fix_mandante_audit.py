from pathlib import Path
import re

# Mandante shell: remove demo-specific presentation and show real project counts.
p = Path('src/pages/Mandante.tsx')
text = p.read_text()
text = re.sub(
    r"\n\s*const PROYECTOS_AJUSTES = misProyectos\.map\(p => \(\{.*?\}\)\);\n",
    "\n",
    text,
    count=1,
    flags=re.S,
)
text = text.replace('<div className="sb-org-sub">Plan Pro · 3 proyectos</div>', '<div className="sb-org-sub">{misProyectos.length} proyecto{misProyectos.length === 1 ? \'\' : \'s\'} visible{misProyectos.length === 1 ? \'\' : \'s\'}</div>')
text = text.replace('                C\n              </div>', "                {mandanteLogueado.nombre[0]?.toUpperCase() || 'M'}\n              </div>")
text = text.replace('<div className="sb-org-sub">Plan Pro · 3 proyectos activos</div>', '<div className="sb-org-sub">{misProyectos.length} proyecto{misProyectos.length === 1 ? \'\' : \'s\'} visible{misProyectos.length === 1 ? \'\' : \'s\'}</div>')
text = text.replace('              PROYECTOS_AJUSTES={PROYECTOS_AJUSTES}\n', '')
p.write_text(text)

# Mandante contractor/document explorer: keep read-only behavior, but allow opening the real private file under Storage RLS.
p = Path('src/pages/mandante/ContratistasTab.tsx')
text = p.read_text()
if "supabaseDocumentStorage" not in text:
    text = text.replace(
        "import { Contratista, Documento, Proyecto, Requisito, Trabajador } from '../../types';\n",
        "import { Contratista, Documento, Proyecto, Requisito, Trabajador } from '../../types';\nimport { openDocumentFile } from '../../data/supabaseDocumentStorage';\n",
        1,
    )
text = text.replace(
    """interface DocumentRow {
  key: string;
  document: Documento;
  associated: string;
  type: 'Empresa' | 'Trabajador';
  project: Proyecto;
  state: string;
  validity: string;
}""",
    """interface DocumentRow {
  key: string;
  document: Documento;
  associated: string;
  type: 'Empresa' | 'Trabajador';
  project: Proyecto;
  requirement?: Requisito;
  workerRut?: string;
  state: string;
  validity: string;
}""",
    1,
)
start = text.find('function DocumentsV5(')
if start < 0:
    raise SystemExit('DocumentsV5 not found')
replacement = r'''function DocumentsV5({
  contractor,
  projects,
  focus,
  selectedContext,
  onSelect,
  onOpenAccreditation,
}: {
  contractor: Contratista;
  projects: Proyecto[];
  focus?: Focus;
  selectedContext: DocumentContext | null;
  onSelect: (value: DocumentContext | null) => void;
  onOpenAccreditation: (id: string) => void;
}) {
  const [search, setSearch] = useState('');
  const [projectFilter, setProjectFilter] = useState(focus?.projectId || 'all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [openingFile, setOpeningFile] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const requirements = getRequisitos();

  const source = [
    ...contractor.documentos.map(document => ({ document, owner: contractor.nombre, type: 'Empresa' as const, workerRut: undefined })),
    ...(contractor.trabajadores || []).flatMap(worker =>
      (worker.documentos || []).map(document => ({ document, owner: worker.nombre, type: 'Trabajador' as const, workerRut: worker.rut })),
    ),
  ];

  const rows: DocumentRow[] = source.flatMap(item => {
    const project = projects.find(projectItem => projectItem.id === item.document.proyectoId);
    if (!project) return [];
    const requirement = requirements.find(requirementItem =>
      requirementItem.proyectoId === project.id &&
      normalizarNombreDocumento(requirementItem.nombre) === normalizarNombreDocumento(item.document.nombre)
    );
    const state = effectiveState(item.document, requirement);
    return [{
      key: `${project.id}:${item.workerRut || 'empresa'}:${item.document.id}`,
      document: item.document,
      associated: item.owner,
      type: item.type,
      project,
      requirement,
      workerRut: item.workerRut,
      state,
      validity: validityLabel(item.document, state),
    }];
  }).filter(row =>
    (projectFilter === 'all' || row.project.id === projectFilter) &&
    (typeFilter === 'all' || row.type === typeFilter) &&
    `${row.document.nombre} ${row.associated}`.toLowerCase().includes(search.toLowerCase())
  );

  const context = selectedContext;
  if (context) {
    const project = projects.find(item => item.id === context.projectId);
    const worker = context.workerRut
      ? (contractor.trabajadores || []).find(item => item.rut === context.workerRut)
      : undefined;
    const documents = worker ? worker.documentos : contractor.documentos;
    const document = (documents || []).find(item => item.id === context.documentId);
    const requirement = requirements.find(item => item.id === context.requirementId)
      || (project && document
        ? requirements.find(item =>
            item.proyectoId === project.id &&
            normalizarNombreDocumento(item.nombre) === normalizarNombreDocumento(document.nombre)
          )
        : undefined);
    const state = document ? effectiveState(document, requirement) : 'Pendiente';

    const abrirArchivo = async () => {
      if (!project || !document || !requirement) {
        setFileError('No fue posible resolver el archivo real de este requisito.');
        return;
      }
      setOpeningFile(true);
      setFileError(null);
      try {
        await openDocumentFile({
          contratistaId: contractor.id,
          proyectoId: project.id,
          requisito: {
            id: requirement.id,
            nombre: requirement.nombre,
            destino: requirement.destino,
          },
          trabajadorRut: worker?.rut,
        });
      } catch (error) {
        setFileError(error instanceof Error ? error.message : 'No fue posible abrir el archivo.');
      } finally {
        setOpeningFile(false);
      }
    };

    return <div className="mandante-contratistas-panel">
      <button type="button" className="mandante-contratistas-back" onClick={() => onSelect(null)}><ArrowLeft /> Volver a documentos</button>
      <div className="mandante-contratistas-document-detail">
        <article className="mandante-contratistas-card">
          <div className="mandante-contratistas-detail-head">
            <div><h2>{document?.nombre || requirement?.nombre || 'Documento faltante'}</h2><p>{worker?.nombre || contractor.nombre} · {project?.nombre}</p></div>
            <b className={`mandante-contratistas-state ${badgeClass(state)}`}>{state}</b>
          </div>
          <dl>
            <div><dt>Asociado a</dt><dd>{worker?.nombre || contractor.nombre}</dd></div>
            <div><dt>Proyecto</dt><dd>{project?.nombre}</dd></div>
            <div><dt>Vencimiento</dt><dd>{document?.vencimiento || '—'}</dd></div>
            <div><dt>Estado actual</dt><dd>{document ? validityLabel(document, state) : 'No se ha cargado un documento para este requisito.'}</dd></div>
          </dl>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {document && requirement && <button type="button" onClick={() => void abrirArchivo()} disabled={openingFile}>{openingFile ? 'Abriendo…' : 'Abrir archivo'}</button>}
            <button type="button" onClick={() => project && onOpenAccreditation(project.id)}>Ver acreditación</button>
          </div>
          {fileError && <p role="alert" style={{ marginTop: 10, color: '#9a2020' }}>{fileError}</p>}
        </article>
        <article className="mandante-contratistas-card">
          <h2>Historial</h2>
          {document?.historial?.length
            ? document.historial.map((event, index) => <div className="mandante-contratistas-history" key={`${event.version}:${index}`}><strong>Versión {event.version} · {event.estado}</strong><small>{event.fecha}</small></div>)
            : <p>No hay historial disponible para este documento.</p>}
        </article>
      </div>
    </div>;
  }

  return <div className="mandante-contratistas-panel">
    <div className="mandante-contratistas-local-filters">
      <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar documento..." />
      <select value={projectFilter} onChange={event => setProjectFilter(event.target.value)}><option value="all">Todos los proyectos</option>{projects.map(project => <option value={project.id} key={project.id}>{project.nombre}</option>)}</select>
      <select value={typeFilter} onChange={event => setTypeFilter(event.target.value)}><option value="all">Todos</option><option value="Empresa">Empresa</option><option value="Trabajador">Trabajadores</option></select>
    </div>
    <article className="mandante-contratistas-card">
      <h2>Documentos</h2>
      <p>Explorador documental de solo lectura. Puedes abrir los archivos autorizados, pero no aprobarlos ni rechazarlos.</p>
      <div className="mandante-contratistas-table-wrap"><table><thead><tr><th>Documento</th><th>Asociado a</th><th>Proyecto</th><th>Estado</th><th>Vencimiento</th></tr></thead><tbody>{rows.map(row => <tr key={row.key} onClick={() => onSelect({
        projectId: row.project.id,
        documentId: row.document.id,
        workerRut: row.workerRut,
        requirementId: row.requirement?.id,
      })}><td><button type="button">{row.document.nombre}</button></td><td>{row.associated}</td><td>{row.project.nombre}</td><td><b className={`mandante-contratistas-state ${badgeClass(row.state)}`}>{row.state}</b></td><td>{row.validity}</td></tr>)}</tbody></table></div>
      {rows.length === 0 && <p>No hay documentos que coincidan con los filtros.</p>}
    </article>
  </div>;
}
'''
text = text[:start] + replacement
p.write_text(text)
