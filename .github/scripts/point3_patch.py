from pathlib import Path


def must_replace(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f"{label} anchor not found")
    return text.replace(old, new, 1)


# Admin.tsx
path = Path("src/pages/Admin.tsx")
text = path.read_text()
anchor = "import { loadReadNotificationKeys, markNotificationKeysRead } from '../data/supabaseNotifications';"
if "confirmBusinessPersistence" not in text:
    text = must_replace(
        text,
        anchor,
        anchor + "\nimport { confirmBusinessPersistence } from '../data/supabasePersistence';",
        "Admin import",
    )
state_anchor = '  const [showNuevoProyectoModal, setShowNuevoProyectoModal] = useState(false);\n  const [formNuevoProyecto, setFormNuevoProyecto] = useState({ nombre: "", mandanteId: "" });'
if "const [creatingProject" not in text:
    text = must_replace(
        text,
        state_anchor,
        state_anchor + "\n  const [creatingProject, setCreatingProject] = useState(false);\n  const [creatingMandante, setCreatingMandante] = useState(false);",
        "Admin state",
    )
start = text.find("  const handleCrearProyecto = (e: React.FormEvent) => {")
if start < 0:
    raise SystemExit("Admin project handler start not found")
end = text.find("\n\n\n  const hayAccesosFallidos", start)
if end < 0:
    end = text.find("\n\n  const hayAccesosFallidos", start)
if end < 0:
    raise SystemExit("Admin project handler end not found")
new_handler = """  const handleCrearProyecto = async (e: React.FormEvent) => {
    e.preventDefault();
    const { nombre, mandanteId } = formNuevoProyecto;
    if (!nombre.trim() || !mandanteId || creatingProject) return;

    setCreatingProject(true);
    try {
      const nuevoProyecto: Proyecto = {
        id: `p_${Date.now()}`,
        nombre: nombre.trim(),
        mandanteId,
        estado: 'Activo',
        contratistas: [],
      };
      const listaProyectos = getProyectos();
      listaProyectos.push(nuevoProyecto);
      saveProyectos(listaProyectos);

      const listaMandantes = getMandantes();
      const mandante = listaMandantes.find(m => m.id === mandanteId);
      if (mandante && !mandante.proyectos.includes(nuevoProyecto.id)) {
        mandante.proyectos.push(nuevoProyecto.id);
        saveMandantes(listaMandantes);
      }

      await confirmBusinessPersistence('core');
      setProyectos([...getProyectos()]);
      resetFormNuevoProyecto();
      showToast('Proyecto creado correctamente');
    } catch (error) {
      setProyectos([...getProyectos()]);
      console.error('No fue posible crear el proyecto.', error);
      showToast('No fue posible guardar el proyecto. Intenta nuevamente.', 'error');
    } finally {
      setCreatingProject(false);
    }
  };"""
text = text[:start] + new_handler + text[end:]
old_mandante_form = """                <form onSubmit={(event) => {
                  event.preventDefault();
                  const empresa = formInvitacion.empresa.trim();
                  const rut = formInvitacion.rut.trim();
                  if (!empresa || !rut) return;
                  const list = getMandantes();
                  if (list.some(item => item.rut.trim().toLowerCase() === rut.toLowerCase())) {
                    showToast('Ya existe un mandante con este RUT.', 'warning');
                    return;
                  }
                  list.push({ id: `m_${Date.now()}`, nombre: empresa, rut, proyectos: [] });
                  saveMandantes(list);
                  setMandanteCreado(true);
                }} className=\"flex flex-col gap-4\">"""
new_mandante_form = """                <form onSubmit={async (event) => {
                  event.preventDefault();
                  const empresa = formInvitacion.empresa.trim();
                  const rut = formInvitacion.rut.trim();
                  if (!empresa || !rut || creatingMandante) return;
                  const list = getMandantes();
                  if (list.some(item => item.rut.trim().toLowerCase() === rut.toLowerCase())) {
                    showToast('Ya existe un mandante con este RUT.', 'warning');
                    return;
                  }
                  setCreatingMandante(true);
                  try {
                    list.push({ id: `m_${Date.now()}`, nombre: empresa, rut, proyectos: [] });
                    saveMandantes(list);
                    await confirmBusinessPersistence('core');
                    setMandanteCreado(true);
                  } catch (error) {
                    console.error('No fue posible crear el mandante.', error);
                    showToast('No fue posible guardar el mandante. Intenta nuevamente.', 'error');
                  } finally {
                    setCreatingMandante(false);
                  }
                }} className=\"flex flex-col gap-4\">"""
text = must_replace(text, old_mandante_form, new_mandante_form, "Admin mandante form")
text = must_replace(
    text,
    '<button type="submit" className="btn btn-primary">Crear mandante</button>',
    '<button type="submit" disabled={creatingMandante} className="btn btn-primary disabled:opacity-60 disabled:cursor-not-allowed">{creatingMandante ? \'Guardando…\' : \'Crear mandante\'}</button>',
    "Admin mandante submit",
)
old_project_button = """                  <button type=\"submit\" className=\"btn btn-primary\">
                    Crear proyecto
                  </button>"""
new_project_button = """                  <button type=\"submit\" disabled={creatingProject} className=\"btn btn-primary disabled:opacity-60 disabled:cursor-not-allowed\">
                    {creatingProject ? 'Guardando…' : 'Crear proyecto'}
                  </button>"""
text = must_replace(text, old_project_button, new_project_button, "Admin project submit")
path.write_text(text)


# Contratista.tsx
path = Path("src/pages/Contratista.tsx")
text = path.read_text()
anchor = "import { DEFAULT_NOTIFICATION_PREFERENCES, loadNotificationPreferences, loadReadNotificationKeys, markNotificationKeysRead, saveNotificationPreferences } from '../data/supabaseNotifications';"
if "confirmBusinessPersistence" not in text:
    text = must_replace(
        text,
        anchor,
        anchor + "\nimport { confirmBusinessPersistence } from '../data/supabasePersistence';",
        "Contratista import",
    )
if "const [savingWorker" not in text:
    text = must_replace(
        text,
        "  const [showAddWorkerModal, setShowAddWorkerModal] = useState(false);",
        "  const [showAddWorkerModal, setShowAddWorkerModal] = useState(false);\n  const [savingWorker, setSavingWorker] = useState(false);",
        "Contratista saving state",
    )
start = text.find("  const handleAddWorkerSubmit = (e: React.FormEvent) => {")
if start < 0:
    raise SystemExit("Contratista worker handler start not found")
end = text.find("\n\n  if (!contratistaEncontrado)", start)
if end < 0:
    raise SystemExit("Contratista worker handler end not found")
new_worker_handler = """  const handleAddWorkerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWorkerForm.nombre || !newWorkerForm.rut || savingWorker) return;
    if (!isValidRut(newWorkerForm.rut)) {
      showToast('RUT inválido, revisa el formato y dígito verificador', 'error');
      return;
    }

    const projectReqs = getRequisitos().filter(r => r.proyectoId === selectedProyectoId && r.destino === 'trabajador' && r.activo !== false);
    const list = getContratistas();
    const currentIdx = list.findIndex(c => c.id === contratistaLogueado.id);
    if (currentIdx === -1) {
      showToast('No fue posible encontrar al contratista.', 'error');
      return;
    }

    const contratista = list[currentIdx];
    contratista.trabajadores ||= [];
    const existingWorker = contratista.trabajadores.find(w => w.rut === newWorkerForm.rut);
    if (existingWorker && esTrabajadorAsignado(existingWorker, selectedProyectoId, misProyectos)) {
      showToast('Este trabajador ya está asignado a este proyecto.', 'warning');
      return;
    }

    const workerDocs = crearDocumentosPendientesProyecto(projectReqs, contratista.id, selectedProyectoId, newWorkerForm.rut);

    setSavingWorker(true);
    try {
      if (existingWorker) {
        existingWorker.documentos = [...(existingWorker.documentos || []), ...workerDocs];
        existingWorker.estado = calcularEstadoTrabajador(existingWorker, selectedProyectoId);
      } else {
        contratista.trabajadores.push({
          nombre: newWorkerForm.nombre,
          rut: newWorkerForm.rut,
          estado: 'pendiente',
          cargo: newWorkerForm.cargo || undefined,
          faena: misProyectos.find(p => p.id === selectedProyectoId)?.nombre || selectedProyectoId,
          cumplimiento: 0,
          documentos: workerDocs,
        });
      }
      saveContratistas(list);
      await confirmBusinessPersistence('all');
      setDataRevision(value => value + 1);
      setNewWorkerForm({ nombre: '', rut: '', cargo: '' });
      setShowAddWorkerModal(false);
      showToast('Trabajador agregado con éxito');
    } catch (error) {
      setDataRevision(value => value + 1);
      console.error('No fue posible agregar el trabajador.', error);
      showToast('No fue posible guardar el trabajador. Intenta nuevamente.', 'error');
    } finally {
      setSavingWorker(false);
    }
  };"""
text = text[:start] + new_worker_handler + text[end:]
old_worker_button = """                <button 
                  type=\"submit\"
                  className=\"flex-1 btn btn-primary py-2.5 font-medium rounded-lg text-sm\"
                >
                  Agregar trabajador
                </button>"""
new_worker_button = """                <button 
                  type=\"submit\"
                  disabled={savingWorker}
                  className=\"flex-1 btn btn-primary py-2.5 font-medium rounded-lg text-sm disabled:opacity-60 disabled:cursor-not-allowed\"
                >
                  {savingWorker ? 'Guardando…' : 'Agregar trabajador'}
                </button>"""
text = must_replace(text, old_worker_button, new_worker_button, "Contratista worker submit")
path.write_text(text)


# Mandante.tsx
path = Path("src/pages/Mandante.tsx")
text = path.read_text()
anchor = "import { loadReadNotificationKeys, markNotificationKeysRead } from '../data/supabaseNotifications';"
if "confirmBusinessPersistence" not in text:
    text = must_replace(
        text,
        anchor,
        anchor + "\nimport { confirmBusinessPersistence } from '../data/supabasePersistence';",
        "Mandante import",
    )
if "const [savingRequirement" not in text:
    text = must_replace(
        text,
        "  const [isAddDocModalOpen, setIsAddDocModalOpen] = useState(false);",
        "  const [isAddDocModalOpen, setIsAddDocModalOpen] = useState(false);\n  const [savingRequirement, setSavingRequirement] = useState(false);",
        "Mandante requirement state",
    )
start = text.find("  const handleAddRequirement = () => {")
if start < 0:
    raise SystemExit("Mandante requirement handler start not found")
end = text.find("\n\n  const menuItems", start)
if end < 0:
    raise SystemExit("Mandante requirement handler end not found")
new_req_handler = """  const handleAddRequirement = async () => {
    if (!newDocForm.name.trim() || !activeProjectId || savingRequirement) return;
    const newId = `${activeProjectId}_${newDocForm.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
    const newReq = {
      id: newId,
      nombre: newDocForm.name,
      categoria: (newDocForm.category === 'Prevención de Riesgos' ? 'Prevención' : newDocForm.category) as 'Laboral' | 'Tributario' | 'Prevención',
      destino: newDocForm.destino as 'empresa' | 'trabajador',
      obligatorio: newDocForm.obligatorio,
      frecuencia: newDocForm.frequency,
      alertaDias: newDocForm.destino === 'trabajador' ? 15 : 7,
      criticidad: newDocForm.criticidad as 'bloquea_pago' | 'bloquea_acceso' | 'advertencia',
      proyectoId: activeProjectId,
      activo: true
    };
    setSavingRequirement(true);
    try {
      const currentReqs = getRequisitos();
      saveRequisitos([...currentReqs, newReq]);
      await confirmBusinessPersistence('core');
      const updatedReqs = getRequisitos().filter(r => r.proyectoId === activeProjectId && r.activo !== false);
      setDocumentRequirements(updatedReqs.map(r => ({ id: r.id, name: r.nombre, category: r.categoria, frequency: r.frecuencia, obligatorio: r.obligatorio, destino: r.destino, criticidad: r.criticidad, alertaDias: r.alertaDias })));
      setContractorsData(buildContractorsData(allContratistas, activeProjectId));
      setIsAddDocModalOpen(false);
      setNewDocForm({ name: '', category: 'Laboral', frequency: 'Mensual', destino: 'empresa', obligatorio: true, criticidad: 'bloquea_pago' });
      showToast('Requisito agregado con éxito');
    } catch (error) {
      const restored = getRequisitos().filter(r => r.proyectoId === activeProjectId && r.activo !== false);
      setDocumentRequirements(restored.map(r => ({ id: r.id, name: r.nombre, category: r.categoria, frequency: r.frecuencia, obligatorio: r.obligatorio, destino: r.destino, criticidad: r.criticidad, alertaDias: r.alertaDias })));
      console.error('No fue posible agregar el requisito.', error);
      showToast('No fue posible guardar el requisito. Intenta nuevamente.', 'error');
    } finally {
      setSavingRequirement(false);
    }
  };"""
text = text[:start] + new_req_handler + text[end:]
modal = """
      {isAddDocModalOpen && (
        <div className=\"fixed inset-0 bg-black/50 z-[500] flex items-center justify-center p-4\" onClick={() => !savingRequirement && setIsAddDocModalOpen(false)}>
          <div className=\"bg-white rounded-xl shadow-xl w-full max-w-[460px] max-h-[calc(100vh-24px)] overflow-y-auto\" onClick={event => event.stopPropagation()}>
            <div className=\"flex justify-between items-center p-4 border-b border-cream\">
              <div><h3 className=\"font-medium text-navy text-[17.6px]\">Agregar requisito</h3><p className=\"text-xs text-gray-500 mt-0.5\">Configura una obligación para este proyecto.</p></div>
              <button type=\"button\" disabled={savingRequirement} onClick={() => setIsAddDocModalOpen(false)} className=\"text-gray-400 hover:text-gray-600 disabled:opacity-50\"><X size={20} /></button>
            </div>
            <div className=\"p-6 flex flex-col gap-4\">
              <div><label className=\"block text-[13.2px] font-medium text-gray-700 mb-1.5\">Nombre</label><input value={newDocForm.name} onChange={event => setNewDocForm({ ...newDocForm, name: event.target.value })} className=\"form-input w-full p-2.5 border border-cream3 rounded-lg\" placeholder=\"Ej. F30 SII\" /></div>
              <div className=\"grid grid-cols-1 sm:grid-cols-2 gap-3\">
                <div><label className=\"block text-[13.2px] font-medium text-gray-700 mb-1.5\">Categoría</label><select value={newDocForm.category} onChange={event => setNewDocForm({ ...newDocForm, category: event.target.value })} className=\"form-input w-full p-2.5 border border-cream3 rounded-lg\"><option>Laboral</option><option>Tributario</option><option>Prevención de Riesgos</option></select></div>
                <div><label className=\"block text-[13.2px] font-medium text-gray-700 mb-1.5\">Destino</label><select value={newDocForm.destino} onChange={event => setNewDocForm({ ...newDocForm, destino: event.target.value })} className=\"form-input w-full p-2.5 border border-cream3 rounded-lg\"><option value=\"empresa\">Empresa</option><option value=\"trabajador\">Trabajador</option></select></div>
              </div>
              <div className=\"grid grid-cols-1 sm:grid-cols-2 gap-3\">
                <div><label className=\"block text-[13.2px] font-medium text-gray-700 mb-1.5\">Frecuencia</label><select value={newDocForm.frequency} onChange={event => setNewDocForm({ ...newDocForm, frequency: event.target.value })} className=\"form-input w-full p-2.5 border border-cream3 rounded-lg\"><option>Mensual</option><option>Por Proyecto</option><option>6 meses</option><option>1 año</option><option>Indefinido</option></select></div>
                <div><label className=\"block text-[13.2px] font-medium text-gray-700 mb-1.5\">Criticidad</label><select value={newDocForm.criticidad} onChange={event => setNewDocForm({ ...newDocForm, criticidad: event.target.value })} className=\"form-input w-full p-2.5 border border-cream3 rounded-lg\"><option value=\"bloquea_pago\">Bloquea pago</option><option value=\"bloquea_acceso\">Bloquea acceso</option><option value=\"advertencia\">Advertencia</option></select></div>
              </div>
              <label className=\"flex items-center gap-2 text-sm text-navy\"><input type=\"checkbox\" checked={newDocForm.obligatorio} onChange={event => setNewDocForm({ ...newDocForm, obligatorio: event.target.checked })} /> Requisito obligatorio</label>
              <div className=\"flex justify-end gap-3 pt-4 border-t border-cream\"><button type=\"button\" disabled={savingRequirement} onClick={() => setIsAddDocModalOpen(false)} className=\"btn btn-ghost\">Cancelar</button><button type=\"button\" disabled={savingRequirement || !newDocForm.name.trim()} onClick={() => void handleAddRequirement()} className=\"btn btn-primary disabled:opacity-60 disabled:cursor-not-allowed\">{savingRequirement ? 'Guardando…' : 'Agregar requisito'}</button></div>
            </div>
          </div>
        </div>
      )}

"""
if "{isAddDocModalOpen && (" not in text:
    text = must_replace(text, "      <ContractorInvitationModal\n", modal + "      <ContractorInvitationModal\n", "Mandante modal insertion")
path.write_text(text)


# Mandante ProyectosTab.tsx
path = Path("src/pages/mandante/ProyectosTab.tsx")
text = path.read_text()
if "confirmBusinessPersistence" not in text:
    text = must_replace(
        text,
        "import './ProyectosTab.css';",
        "import { confirmBusinessPersistence } from '../../data/supabasePersistence';\nimport './ProyectosTab.css';",
        "ProyectosTab import",
    )
old_archive = """  const archiveProject = () => {
    if (!selected) return;
    const projects = getProyectos(); const index = projects.findIndex(project => project.id === selected.project.id);
    if (index < 0) return;
    projects[index].estado = 'Archivado'; saveProyectos(projects); setProyectoArchivado(true); showToast('Proyecto archivado', 'warning');
  };"""
new_archive = """  const archiveProject = async () => {
    if (!selected) return;
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
  };"""
text = must_replace(text, old_archive, new_archive, "ProyectosTab archive")
start = text.find("function RequirementsPanel(")
end = text.find("\n\nfunction AccreditationsPanel", start)
if start < 0 or end < 0:
    raise SystemExit("ProyectosTab RequirementsPanel bounds not found")
new_panel = """function RequirementsPanel({ requirements, onAdd, onChanged, showToast }: { requirements: Requisito[]; onAdd: () => void; onChanged: () => void; showToast: Props['showToast'] }) {
  const [savingRequirementId, setSavingRequirementId] = useState<string | null>(null);
  const toggleRequired = async (requirement: Requisito) => {
    if (savingRequirementId) return;
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
  return <article className=\"mandante-proyectos-section-card mandante-proyectos-panel\"><div className=\"mandante-proyectos-section-head\"><div><h2>Requisitos del proyecto</h2><p>Define qué debe cumplir cada empresa y trabajador.</p></div><button type=\"button\" onClick={onAdd}><Plus /> Agregar requisito</button></div><div className=\"mandante-proyectos-requirements\">{requirements.map(requirement => <div className=\"mandante-proyectos-requirement\" key={requirement.id}><div><strong>{requirement.nombre}</strong><span>{requirement.destino === 'empresa' ? 'Empresa' : 'Trabajador'} · {requirement.frecuencia} · {requirement.criticidad.replaceAll('_', ' ')} · Alerta {requirement.alertaDias} días</span></div><button type=\"button\" disabled={savingRequirementId === requirement.id} className={requirement.obligatorio ? 'mandatory' : 'optional'} onClick={() => void toggleRequired(requirement)}>{savingRequirementId === requirement.id ? 'Guardando…' : requirement.obligatorio ? 'Obligatorio' : 'Opcional'}</button></div>)}{requirements.length === 0 && <div className=\"mandante-proyectos-empty\">No hay requisitos activos para este proyecto.</div>}</div></article>;
}"""
text = text[:start] + new_panel + text[end:]
path.write_text(text)


# Admin ProyectoDetailDrawer.tsx
path = Path("src/pages/admin/ProyectoDetailDrawer.tsx")
text = path.read_text()
text = must_replace(
    text,
    "import { saveRequisitos, getPlantillas } from '../../data/localStorageDb';",
    "import { saveRequisitos, getPlantillas, getRequisitos } from '../../data/localStorageDb';",
    "ProyectoDetail localStorage import",
)
anchor = "import { buildAcreditacionRows, AcredRow, estadoUILabel, badgeClass } from './acreditacionUtils';"
if "confirmBusinessPersistence" not in text:
    text = must_replace(
        text,
        anchor,
        anchor + "\nimport { confirmBusinessPersistence } from '../../data/supabasePersistence';",
        "ProyectoDetail confirm import",
    )
if "const [savingRequirement" not in text:
    text = must_replace(
        text,
        "  const [plantillaSeleccionadaId, setPlantillaSeleccionadaId] = useState('');",
        "  const [plantillaSeleccionadaId, setPlantillaSeleccionadaId] = useState('');\n  const [savingRequirement, setSavingRequirement] = useState(false);\n  const [requirementSaveError, setRequirementSaveError] = useState('');",
        "ProyectoDetail state",
    )
text = must_replace(
    text,
    "    setPlantillaSeleccionadaId('');\n    setShowRequisitoModal(true);\n  };\n\n  const abrirEditarRequisito",
    "    setPlantillaSeleccionadaId('');\n    setRequirementSaveError('');\n    setShowRequisitoModal(true);\n  };\n\n  const abrirEditarRequisito",
    "ProyectoDetail new modal clear",
)
text = must_replace(
    text,
    "    setPlantillaSeleccionadaId('');\n    setShowRequisitoModal(true);\n  };\n\n  const cerrarModalRequisito",
    "    setPlantillaSeleccionadaId('');\n    setRequirementSaveError('');\n    setShowRequisitoModal(true);\n  };\n\n  const cerrarModalRequisito",
    "ProyectoDetail edit modal clear",
)
start = text.find("  const guardarRequisito = (e: React.FormEvent) => {")
end = text.find("\n\n  const tabs:", start)
if start < 0 or end < 0:
    raise SystemExit("ProyectoDetail save block bounds not found")
new_save_block = """  const guardarRequisito = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nombre.trim() || !form.frecuencia.trim() || savingRequirement) return;
    const nuevaLista = editingRequisito
      ? requisitos.map(r => r.id === editingRequisito.id ? { ...r, ...form, nombre: form.nombre.trim(), frecuencia: form.frecuencia.trim() } : r)
      : [...requisitos, { id: `req_${proyecto.id}_${Date.now()}`, nombre: form.nombre.trim(), categoria: form.categoria, destino: form.destino, obligatorio: form.obligatorio, frecuencia: form.frecuencia.trim(), alertaDias: form.alertaDias, criticidad: form.criticidad, proyectoId: proyecto.id, activo: true } as Requisito];
    setSavingRequirement(true);
    setRequirementSaveError('');
    saveRequisitos(nuevaLista);
    try {
      await confirmBusinessPersistence('core');
      setRequisitos([...getRequisitos()]);
      cerrarModalRequisito();
    } catch (error) {
      setRequisitos([...getRequisitos()]);
      console.error('No fue posible guardar el requisito.', error);
      setRequirementSaveError('No fue posible guardar el requisito. Revisa tu conexión e intenta nuevamente.');
    } finally {
      setSavingRequirement(false);
    }
  };

  const toggleActivoRequisito = async (r: Requisito) => {
    if (savingRequirement) return;
    const nuevaLista = requisitos.map(x => x.id === r.id ? { ...x, activo: x.activo === false ? true : false } : x);
    setSavingRequirement(true);
    saveRequisitos(nuevaLista);
    try {
      await confirmBusinessPersistence('core');
      setRequisitos([...getRequisitos()]);
    } catch (error) {
      setRequisitos([...getRequisitos()]);
      console.error('No fue posible actualizar el requisito.', error);
    } finally {
      setSavingRequirement(false);
    }
  };"""
text = text[:start] + new_save_block + text[end:]
text = must_replace(
    text,
    '            <form onSubmit={guardarRequisito} className="p-6 flex flex-col gap-4">',
    '            <form onSubmit={guardarRequisito} className="p-6 flex flex-col gap-4">\n              {requirementSaveError && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-700">{requirementSaveError}</div>}',
    "ProyectoDetail error banner",
)
text = must_replace(
    text,
    '<button type="button" onClick={cerrarModalRequisito} className="btn btn-ghost font-medium">',
    '<button type="button" disabled={savingRequirement} onClick={cerrarModalRequisito} className="btn btn-ghost font-medium disabled:opacity-50">',
    "ProyectoDetail cancel",
)
old_submit = """                <button type=\"submit\" className=\"btn btn-primary\">
                  {editingRequisito ? 'Guardar cambios' : 'Agregar requisito'}
                </button>"""
new_submit = """                <button type=\"submit\" disabled={savingRequirement} className=\"btn btn-primary disabled:opacity-60 disabled:cursor-not-allowed\">
                  {savingRequirement ? 'Guardando…' : editingRequisito ? 'Guardar cambios' : 'Agregar requisito'}
                </button>"""
text = must_replace(text, old_submit, new_submit, "ProyectoDetail submit")
path.write_text(text)

print("patched")
