from pathlib import Path
import re

# --- Admin shell / global search / onboarding truthfulness ---
p = Path('src/pages/Admin.tsx')
text = p.read_text()
text = text.replace("import { GLOBAL_MANDANTES, GLOBAL_PROYECTOS, GLOBAL_CONTRATISTAS } from './admin/globalData';\n", '')
text = text.replace("import DocumentoDetailModal from './admin/DocumentoDetailModal';\n", '')
if "ContractorInvitationModal" not in text:
    text = text.replace(
        "import OperationalNotificationsPanel from '../components/OperationalNotificationsPanel';\n",
        "import OperationalNotificationsPanel from '../components/OperationalNotificationsPanel';\nimport ContractorInvitationModal from '../components/ContractorInvitationModal';\n",
        1,
    )

# Remove fabricated recent-activity dataset.
text = re.sub(
    r"\n  const ACTIVIDAD_RECIENTE: any\[\] = \[\];.*?\n\n  const \[activeTab, setActiveTab\]",
    "\n\n  const [activeTab, setActiveTab]",
    text,
    count=1,
    flags=re.S,
)
text = re.sub(r"\n  const \[actividadSeleccionada, setActividadSeleccionada\][^\n]*", "", text, count=1)
text = re.sub(r"\n  const \[selectedDoc, setSelectedDoc\][^\n]*", "", text, count=1)
text = re.sub(r"\n  const handleSelectDoc = \(doc: any\) => \{.*?\n  \};\n", "\n", text, count=1, flags=re.S)

# Today metrics start from real Supabase snapshot, never demo values.
text = text.replace("const [aprobadosHoy, setAprobadosHoy] = useState(2);", "const [aprobadosHoy, setAprobadosHoy] = useState(0);")
text = text.replace("const [rechazadosHoy, setRechazadosHoy] = useState(1);", "const [rechazadosHoy, setRechazadosHoy] = useState(0);")
snapshot_old = """      setVerificadores(snapshot.verificadores);
      setVerificadorActualIdState(snapshot.currentReviewerId);
      setClaimsRevision(pruneClaimsRevision(snapshot.claims, freshContratistas, freshProyectos));"""
snapshot_new = """      setVerificadores(snapshot.verificadores);
      setVerificadorActualIdState(snapshot.currentReviewerId);
      setClaimsRevision(pruneClaimsRevision(snapshot.claims, freshContratistas, freshProyectos));
      setAprobadosHoy(snapshot.actividad.filter(item => item.accion === 'aprobado').length);
      setRechazadosHoy(snapshot.actividad.filter(item => item.accion === 'rechazado').length);"""
if snapshot_old not in text:
    raise SystemExit('Admin review snapshot block not found')
text = text.replace(snapshot_old, snapshot_new, 1)
text = text.replace('if (activeTab !== "auditoria") return;', 'if (activeTab !== "dashboard" && activeTab !== "auditoria") return;', 1)
text = text.replace('const pendingDocsCount = buildColaDocs(GLOBAL_CONTRATISTAS, GLOBAL_PROYECTOS).length;', 'const pendingDocsCount = buildColaDocs(contratistas, proyectos).length;', 1)

# Mandante creation is an organization-creation action, not a fake email invitation.
text = text.replace('const [invitacionEnviada, setInvitacionEnviada] = useState(false);', 'const [mandanteCreado, setMandanteCreado] = useState(false);', 1)
text = re.sub(
    r"  const \[formInvitacion, setFormInvitacion\] = useState\(\{\n    nombre: \"\",\n    empresa: \"\",\n    rut: \"\",\n    correo: \"\",\n    industria: \"\",\n  \}\);",
    "  const [formInvitacion, setFormInvitacion] = useState({ empresa: \"\", rut: \"\" });",
    text,
    count=1,
)

# Admin contractor onboarding now uses the real invitation flow; remove the simulated add/assign form.
text = re.sub(
    r"  const \[showInvitarContratistaModal, setShowInvitarContratistaModal\] = useState\(false\);.*?\n\n  const \[showNuevoProyectoModal, setShowNuevoProyectoModal\]",
    "  const [showInvitarContratistaModal, setShowInvitarContratistaModal] = useState(false);\n\n  const [showNuevoProyectoModal, setShowNuevoProyectoModal]",
    text,
    count=1,
    flags=re.S,
)

# Real document index for global search. Clicking opens the existing accreditation detail, not a fake preview modal.
marker = """  const indiceBusqueda = [
    ...GLOBAL_MANDANTES.map(m => ({ tipo: \"empresa\", label: m.nombre, sub: \"Mandante\", data: m, esMandante: true })),
    ...GLOBAL_CONTRATISTAS.map(c => ({ tipo: \"empresa\", label: c.nombre, sub: c.isNew ? \"Contratista (Nuevo)\" : \"Contratista\", data: c, esMandante: false })),
    ...ACTIVIDAD_RECIENTE.map(a => ({ tipo: \"documento\", label: a.documento, sub: `${a.empresa} · ${a.estado}`, data: a })),
"""
replacement = """  const DOCUMENTOS_BUSQUEDA = contratistas.flatMap(contratista => [
    ...contratista.documentos.map(documento => ({
      documento: documento.nombre,
      estado: documento.estado,
      contratista,
      proyectoId: documento.proyectoId,
      proyectoNombre: proyectos.find(proyecto => proyecto.id === documento.proyectoId)?.nombre || 'Proyecto no disponible',
      trabajador: null,
    })),
    ...(contratista.trabajadores || []).flatMap(trabajador =>
      (trabajador.documentos || []).map(documento => ({
        documento: documento.nombre,
        estado: documento.estado,
        contratista,
        proyectoId: documento.proyectoId,
        proyectoNombre: proyectos.find(proyecto => proyecto.id === documento.proyectoId)?.nombre || 'Proyecto no disponible',
        trabajador,
      }))
    ),
  ]).filter(item => Boolean(item.proyectoId));

  const indiceBusqueda = [
    ...GLOBAL_MANDANTES.map(m => ({ tipo: \"empresa\", label: m.nombre, sub: \"Mandante\", data: m, esMandante: true })),
    ...contratistas.map(c => ({ tipo: \"empresa\", label: c.nombre, sub: c.isNew ? \"Contratista (Nuevo)\" : \"Contratista\", data: c, esMandante: false })),
    ...DOCUMENTOS_BUSQUEDA.map(item => ({ tipo: \"documento\", label: item.documento, sub: `${item.contratista.nombre} · ${item.proyectoNombre} · ${item.estado}`, data: item })),
"""
if marker not in text:
    raise SystemExit('Admin search index marker not found')
text = text.replace(marker, replacement, 1)
old_doc_click = 'onClick={() => { setActividadSeleccionada(r.data); setBusquedaAbierta(false); setBusquedaGlobal(\"\"); }}'
new_doc_click = """onClick={() => {
                            const item = r.data as any;
                            setSelectedAcreditacionContratista({
                              ...item.contratista,
                              _fichaProyectoId: item.proyectoId,
                              _fichaTrabajador: item.trabajador || undefined,
                            });
                            setBusquedaAbierta(false);
                            setBusquedaGlobal(\"\");
                          }}"""
if old_doc_click not in text:
    raise SystemExit('Admin document search click not found')
text = text.replace(old_doc_click, new_doc_click, 1)

# Dashboard gets the real Mandantes/review operation snapshot.
dash_old = """              GLOBAL_CONTRATISTAS={contratistas}
              GLOBAL_PROYECTOS={proyectos}
              setActiveTab={setActiveTab}
              aprobadosHoy={aprobadosHoy}
              rechazadosHoy={rechazadosHoy}
              setSelectedDocKey={setSelectedDocKey}"""
dash_new = """              GLOBAL_CONTRATISTAS={contratistas}
              GLOBAL_PROYECTOS={proyectos}
              GLOBAL_MANDANTES={GLOBAL_MANDANTES}
              verificadores={verificadores}
              claimsRevision={claimsRevision}
              setActiveTab={setActiveTab}
              aprobadosHoy={aprobadosHoy}
              rechazadosHoy={rechazadosHoy}
              setSelectedDocKey={setSelectedDocKey}"""
if dash_old not in text:
    raise SystemExit('Dashboard props block not found')
text = text.replace(dash_old, dash_new, 1)

# Replace Mandante fake invitation modal with truthful organization creation UI.
start = text.find('      {showInvitarModal && (')
end = text.find('      {showInvitarContratistaModal && (', start)
if start < 0 or end < 0:
    raise SystemExit('Admin Mandante/Contratista modal boundaries not found')
mandante_modal = r'''      {showInvitarModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-[440px] max-h-[calc(100vh-24px)] overflow-y-auto">
            <div className="flex justify-between items-center p-4 border-b border-cream">
              <div>
                <h3 className="font-medium text-navy text-[17.6px]">Crear Mandante</h3>
                <p className="text-xs text-gray-500 mt-0.5">Crea la organización. La cuenta de acceso se habilita por administración.</p>
              </div>
              <button onClick={() => { setShowInvitarModal(false); setMandanteCreado(false); }} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <div className="p-6">
              {mandanteCreado ? (
                <div className="text-center py-4">
                  <div className="bg-green-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"><CheckCircle size={32} className="text-green-600" /></div>
                  <h4 className="text-lg font-medium text-navy mb-2">Mandante creado</h4>
                  <p className="text-gray-600 text-sm leading-relaxed mb-6">La organización <span className="font-medium">{formInvitacion.empresa}</span> quedó disponible para crear proyectos y gestionar acreditaciones.</p>
                  <button onClick={() => { setShowInvitarModal(false); setMandanteCreado(false); setFormInvitacion({ empresa: '', rut: '' }); }} className="btn btn-primary w-full justify-center">Entendido</button>
                </div>
              ) : (
                <form onSubmit={(event) => {
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
                }} className="flex flex-col gap-4">
                  <div><label className="block text-[13.2px] font-medium text-gray-700 mb-1.5">Empresa / Razón social</label><input type="text" value={formInvitacion.empresa} onChange={(event) => setFormInvitacion({ ...formInvitacion, empresa: event.target.value })} className="form-input w-full p-2.5 border border-cream3 rounded-lg" placeholder="Nombre de la organización" required /></div>
                  <div><label className="block text-[13.2px] font-medium text-gray-700 mb-1.5">RUT</label><input type="text" value={formInvitacion.rut} onChange={(event) => setFormInvitacion({ ...formInvitacion, rut: event.target.value })} className="form-input w-full p-2.5 border border-cream3 rounded-lg" placeholder="76.999.999-9" required /></div>
                  <div className="rounded-lg border border-blue-100 bg-blue-50 p-3 text-[11.5px] text-blue-800">Esta acción crea la organización Mandante; no simula el envío de un correo ni la creación de una cuenta de usuario.</div>
                  <div className="flex justify-end gap-3 mt-2 pt-4 border-t border-cream"><button type="button" onClick={() => setShowInvitarModal(false)} className="btn btn-ghost font-medium">Cancelar</button><button type="submit" className="btn btn-primary">Crear mandante</button></div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

'''
contractor_modal = r'''      <ContractorInvitationModal
        open={showInvitarContratistaModal}
        onClose={() => setShowInvitarContratistaModal(false)}
        contractors={contratistas}
        projects={proyectos}
        showToast={showToast}
      />

'''
# Find end of old contractor modal at the new project modal.
project_start = text.find('      {showNuevoProyectoModal && (', end)
if project_start < 0:
    raise SystemExit('Admin new project modal boundary not found')
text = text[:start] + mandante_modal + contractor_modal + text[project_start:]

# Remove obsolete fake document detail modal render.
text = re.sub(
    r"\n      <DocumentoDetailModal\n        actividadSeleccionada=\{actividadSeleccionada\}\n        setActividadSeleccionada=\{setActividadSeleccionada\}\n      />\n",
    "\n",
    text,
    count=1,
)
p.write_text(text)

# --- Dashboard: all operational KPIs must be real ---
p = Path('src/pages/admin/DashboardTab.tsx')
text = p.read_text()
text = text.replace("import { Contratista, Proyecto } from '../../types';", "import { ClaimRevision, Contratista, Mandante, Proyecto, Verificador } from '../../types';")
text = text.replace("import { GLOBAL_MANDANTES } from './globalData';\n", "import { getReviewActivityToday } from '../../data/supabaseReviewOperations';\n")
text = re.sub(r"\nconst VERIFICADORES_HOY = \[.*?\nconst VERIFICADORES_ACTIVOS = 4;\n", "\n", text, count=1, flags=re.S)
text = text.replace(
    """  GLOBAL_PROYECTOS,
  setActiveTab,
  aprobadosHoy,""",
    """  GLOBAL_PROYECTOS,
  GLOBAL_MANDANTES,
  verificadores,
  claimsRevision,
  setActiveTab,
  aprobadosHoy,""",
    1,
)
text = text.replace(
    """  GLOBAL_PROYECTOS: Proyecto[];
  setActiveTab: (v: string) => void;""",
    """  GLOBAL_PROYECTOS: Proyecto[];
  GLOBAL_MANDANTES: Mandante[];
  verificadores: Verificador[];
  claimsRevision: ClaimRevision[];
  setActiveTab: (v: string) => void;""",
    1,
)
old_sim = """  // Mirrors ColaRevisionTab's own illustrative claim simulation (2 of the
  // oldest/highest-priority pending docs shown as \"already taken\" once there
  // are enough of them), so this KPI agrees with what that tab shows.
  const enRevisionCount = dynamicCola.length >= 3 ? 2 : 0;
  const porRevisarCount = dynamicCola.length - enRevisionCount;
  const esperandoCorreccionCount = correctionDocs.length;
"""
new_real = """  const claimedKeys = new Set(claimsRevision.map(item => item.documentoKey));
  const enRevisionCount = dynamicCola.filter(item => claimedKeys.has(item.key)).length;
  const porRevisarCount = dynamicCola.length - enRevisionCount;
  const esperandoCorreccionCount = correctionDocs.length;
  const verificadoresActivos = verificadores.filter(item => item.activo).length;
  const actividadVerificadores = verificadores
    .map(verificador => {
      const actividad = getReviewActivityToday(verificador.id);
      return { verificador, ...actividad, total: actividad.aprobados + actividad.rechazados };
    })
    .filter(item => item.total > 0)
    .sort((a, b) => b.total - a.total || a.verificador.nombre.localeCompare(b.verificador.nombre))
    .slice(0, 3);
"""
if old_sim not in text:
    raise SystemExit('Dashboard simulated claim block not found')
text = text.replace(old_sim, new_real, 1)
text = text.replace('<div className="metric-card"><div className="label">Verificadores activos</div><div className="number">{VERIFICADORES_ACTIVOS}</div></div>', '<div className="metric-card"><div className="label">Verificadores activos</div><div className="number">{verificadoresActivos}</div></div>', 1)
old_active = """            {VERIFICADORES_HOY.map(v => (
              <div className=\"verifier\" key={v.nombre}>
                <div><b>{v.nombre}</b><br /><span>{v.rol}</span></div>
                <span><b>{Math.round(revisadosHoy * v.peso)}</b> revisiones</span>
              </div>
            ))}
            <button className=\"btn\" style={{ width: '100%', marginTop: '12px' }} onClick={() => setActiveTab('auditoria')}>Ver verificadores</button>"""
new_active = """            {actividadVerificadores.length > 0 ? actividadVerificadores.map(item => (
              <div className=\"verifier\" key={item.verificador.id}>
                <div><b>{item.verificador.nombre}</b><br /><span>{item.verificador.rol === 'supervisor' ? 'Supervisor' : 'Verificador'}</span></div>
                <span><b>{item.total}</b> revisiones</span>
              </div>
            )) : <div className=\"muted\">Todavía no hay revisiones registradas hoy.</div>}
            <button className=\"btn\" style={{ width: '100%', marginTop: '12px' }} onClick={() => setActiveTab('verificadores')}>Ver verificadores</button>"""
if old_active not in text:
    raise SystemExit('Dashboard fake verifier block not found')
text = text.replace(old_active, new_active, 1)
p.write_text(text)

# --- Review queue: no hidden 4-second polling; atomic RPC + explicit refresh ---
p = Path('src/pages/admin/ColaRevisionTab.tsx')
text = p.read_text()
text = text.replace('Las tomas y decisiones se comparten en tiempo real entre todos los verificadores.', 'Las tomas se coordinan de forma atómica en Supabase. Usa Actualizar para refrescar la vista compartida.')
old_sync = """      const snapshot = await refreshReviewOperationsCache();
      setClaimsRevision(snapshot.claims);"""
new_sync = """      const snapshot = await refreshReviewOperationsCache();
      setClaimsRevision(snapshot.claims);
      setAprobadosHoy(() => snapshot.actividad.filter(item => item.accion === 'aprobado').length);
      setRechazadosHoy(() => snapshot.actividad.filter(item => item.accion === 'rechazado').length);"""
# Replace first syncClaims occurrence only.
if old_sync not in text:
    raise SystemExit('Queue sync snapshot block not found')
text = text.replace(old_sync, new_sync, 1)
old_effect = re.compile(r"  useEffect\(\(\) => \{\n    let active = true;\n    const refresh = async \(\) => \{.*?\n  \}, \[\]\);", re.S)
new_effect = """  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try {
        const snapshot = await refreshReviewOperationsCache();
        if (!active) return;
        setClaimsRevision(snapshot.claims);
        setAprobadosHoy(() => snapshot.actividad.filter(item => item.accion === 'aprobado').length);
        setRechazadosHoy(() => snapshot.actividad.filter(item => item.accion === 'rechazado').length);
      } catch {
        // Conserva el último snapshot válido; la toma atómica evita dobles revisiones.
      }
    };
    void refresh();
    return () => { active = false; };
    // Setters compartidos del contenedor; la carga se hace una vez al entrar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);"""
text, n = old_effect.subn(new_effect, text, count=1)
if n != 1:
    raise SystemExit('Queue polling effect not found')
# After successful approve/reject, use exact snapshot metrics rather than local increments.
text = text.replace("""      setAprobadosHoy(value => value + 1);
      const snapshot = await refreshReviewOperationsCache();
      setClaimsRevision(snapshot.claims);""", """      const snapshot = await refreshReviewOperationsCache();
      setClaimsRevision(snapshot.claims);
      setAprobadosHoy(() => snapshot.actividad.filter(item => item.accion === 'aprobado').length);
      setRechazadosHoy(() => snapshot.actividad.filter(item => item.accion === 'rechazado').length);""", 1)
text = text.replace("""      setRechazadosHoy(value => value + 1);
      const snapshot = await refreshReviewOperationsCache();
      setClaimsRevision(snapshot.claims);""", """      const snapshot = await refreshReviewOperationsCache();
      setClaimsRevision(snapshot.claims);
      setAprobadosHoy(() => snapshot.actividad.filter(item => item.accion === 'aprobado').length);
      setRechazadosHoy(() => snapshot.actividad.filter(item => item.accion === 'rechazado').length);""", 1)
p.write_text(text)

# --- Real contractor invitation supports both authorized Mandante and Acredita staff ---
p = Path('src/components/ContractorInvitationModal.tsx')
text = p.read_text()
text = text.replace("if (!session || session.role !== 'mandante') throw new Error('Tu sesión de Mandante venció');", "if (!session || (session.role !== 'mandante' && session.role !== 'admin')) throw new Error('Tu sesión autorizada venció');", 1)
p.write_text(text)

# --- Mandantes directory button must match the actual action ---
p = Path('src/pages/admin/MandantesTab.tsx')
text = p.read_text().replace('Invitar mandante', 'Crear mandante')
p.write_text(text)

# --- Remove demo wording from the real review preview fallback ---
p = Path('src/pages/admin/DocumentPreview.tsx')
text = p.read_text()
text = text.replace('Documento demo / legacy', 'Versión sin archivo físico')
text = text.replace('Esta versión proviene de los datos de demostración anteriores y no contiene bytes de archivo. Las nuevas cargas se muestran aquí como PDF o imagen real.', 'Esta versión no contiene bytes de archivo en Storage. Las cargas actuales se muestran aquí como PDF o imagen real.')
text = text.replace('Eso no debe impedir revisar el resto de la demo.', 'Eso no debe impedir revisar otros registros disponibles.')
p.write_text(text)
