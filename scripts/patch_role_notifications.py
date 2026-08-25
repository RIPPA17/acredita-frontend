from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f'Pattern not found: {label}')
    return text.replace(old, new, 1)

# ADMIN
p = Path('src/pages/Admin.tsx')
text = p.read_text()
if 'buildAdminNotifications' not in text:
    text = text.replace('getAlertasVigencia, esVencidoPorFecha, obtenerDiasRestantes, logoutUser }', 'getAlertasVigencia, esVencidoPorFecha, obtenerDiasRestantes, logoutUser, getCurrentSession }')
    anchor = "import { refreshReviewOperationsCache } from '../data/supabaseReviewOperations';\n"
    text = replace_once(text, anchor, anchor + "import OperationalNotificationsPanel from '../components/OperationalNotificationsPanel';\nimport { buildAdminNotifications, type OperationalNotification } from '../data/operationalNotifications';\nimport { loadReadNotificationKeys, markNotificationKeysRead } from '../data/supabaseNotifications';\n", 'admin imports')
    text = replace_once(text, '  const navigate = useNavigate();\n', "  const navigate = useNavigate();\n  const session = getCurrentSession();\n", 'admin session')
    text = replace_once(text, '  const [showNotif, setShowNotif] = useState(false);\n', "  const [showNotif, setShowNotif] = useState(false);\n  const [notificacionesLeidas, setNotificacionesLeidas] = useState<Set<string>>(new Set());\n\n  useEffect(() => {\n    if (!session?.profileId) return;\n    let cancelled = false;\n    loadReadNotificationKeys(session.profileId, session)\n      .then(keys => { if (!cancelled) setNotificacionesLeidas(keys); })\n      .catch(() => { if (!cancelled) setNotificacionesLeidas(new Set()); });\n    return () => { cancelled = true; };\n  }, [session?.profileId]);\n", 'admin notif state')
    anchor = '  const pendingDocsCount = buildColaDocs(GLOBAL_CONTRATISTAS, GLOBAL_PROYECTOS).length;\n'
    extra = """  const notificacionesOperativas = buildAdminNotifications(contratistas, proyectos, pendingDocsCount);\n  const notificacionesSinLeer = notificacionesOperativas.filter(item => !notificacionesLeidas.has(item.id)).length;\n\n  const marcarNotificacionesLeidas = (ids: string[]) => {\n    setNotificacionesLeidas(actual => {\n      const next = new Set(actual);\n      ids.forEach(id => next.add(id));\n      return next;\n    });\n    if (session?.profileId) void markNotificationKeysRead(session.profileId, ids, session).catch(() => undefined);\n  };\n\n  const abrirNotificacionOperativa = (notificacion: OperationalNotification) => {\n    marcarNotificacionesLeidas([notificacion.id]);\n    if (notificacion.destino === 'cola') setActiveTab('cola');\n    else if (notificacion.destino === 'acreditacion') setActiveTab('acreditaciones');\n    else {\n      setActiveTab('proyectos');\n      if (notificacion.proyectoId) {\n        const proyecto = proyectos.find(item => item.id === notificacion.proyectoId);\n        if (proyecto) setProyectoSeleccionado(proyecto);\n      }\n    }\n    setShowNotif(false);\n  };\n\n"""
    text = replace_once(text, anchor, anchor + '\n' + extra, 'admin notification handlers')
    start_marker = '          <div className="relative">\n            <button\n              onClick={() => setShowNotif(!showNotif)}'
    start = text.index(start_marker, text.index('{/* TOPBAR */}'))
    end_marker = '          <div className="flex min-w-0 max-w-[55vw] items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity">'
    end = text.index(end_marker, start)
    new_block = """          <div className=\"relative\">\n            <button\n              onClick={() => setShowNotif(!showNotif)}\n              aria-label={showNotif ? 'Cerrar notificaciones' : 'Abrir notificaciones'}\n              aria-expanded={showNotif}\n              className=\"flex items-center justify-center relative w-8 h-8 rounded-md bg-white/10 text-cream hover:bg-white/20 transition-colors\"\n            >\n              <Bell size={18} />\n              {notificacionesSinLeer > 0 && <span className=\"absolute -top-1.5 -right-1.5 min-w-[17px] h-[17px] px-1 flex items-center justify-center bg-[#c73b3b] text-white text-[8px] font-extrabold rounded-full border-2 border-navy\">{notificacionesSinLeer}</span>}\n            </button>\n            {showNotif && <div className=\"fixed inset-0 z-[299]\" onClick={() => setShowNotif(false)} />}\n            {showNotif && <OperationalNotificationsPanel\n              contextLabel=\"Equipo Acredita\"\n              notificaciones={notificacionesOperativas}\n              leidas={notificacionesLeidas}\n              onMarcarLeida={id => marcarNotificacionesLeidas([id])}\n              onMarcarTodas={() => marcarNotificacionesLeidas(notificacionesOperativas.map(item => item.id))}\n              onAbrir={abrirNotificacionOperativa}\n            />}\n          </div>\n"""
    text = text[:start] + new_block + text[end:]
    p.write_text(text)

# MANDANTE
p = Path('src/pages/Mandante.tsx')
text = p.read_text()
if 'buildMandanteNotifications' not in text:
    anchor = "import ContractorInvitationModal from '../components/ContractorInvitationModal';\n"
    text = replace_once(text, anchor, anchor + "import OperationalNotificationsPanel from '../components/OperationalNotificationsPanel';\nimport { buildMandanteNotifications, type OperationalNotification } from '../data/operationalNotifications';\nimport { loadReadNotificationKeys, markNotificationKeysRead } from '../data/supabaseNotifications';\n", 'mandante imports')
    text = replace_once(text, "function MandantePortalContent({ mandanteLogueado }: { mandanteLogueado: Mandante }) {\n  const navigate = useNavigate();\n", "function MandantePortalContent({ mandanteLogueado }: { mandanteLogueado: Mandante }) {\n  const navigate = useNavigate();\n  const session = getCurrentSession();\n", 'mandante session')
    text = replace_once(text, '  const [showNotif, setShowNotif] = useState(false);\n', "  const [showNotif, setShowNotif] = useState(false);\n  const [notificacionesLeidas, setNotificacionesLeidas] = useState<Set<string>>(new Set());\n", 'mandante notif state')
    anchor = '  const misProyectos = allProyectos.filter(p => p.mandanteId === mandanteLogueado.id);\n'
    extra = """  const notificacionesOperativas = buildMandanteNotifications(mandanteLogueado.id, allContratistas, allProyectos);\n  const notificacionesSinLeer = notificacionesOperativas.filter(item => !notificacionesLeidas.has(item.id)).length;\n\n  React.useEffect(() => {\n    if (!session?.profileId) return;\n    let cancelled = false;\n    loadReadNotificationKeys(session.profileId, session)\n      .then(keys => { if (!cancelled) setNotificacionesLeidas(keys); })\n      .catch(() => { if (!cancelled) setNotificacionesLeidas(new Set()); });\n    return () => { cancelled = true; };\n  }, [session?.profileId]);\n\n  const marcarNotificacionesLeidas = (ids: string[]) => {\n    setNotificacionesLeidas(actual => {\n      const next = new Set(actual);\n      ids.forEach(id => next.add(id));\n      return next;\n    });\n    if (session?.profileId) void markNotificationKeysRead(session.profileId, ids, session).catch(() => undefined);\n  };\n\n"""
    text = replace_once(text, anchor, anchor + '\n' + extra, 'mandante notification data')
    go_anchor = """  const goToProject = (projectId: string) => {\n    setSelectedProjectId(projectId);\n    setProyectoSeleccionadoAjustes(projectId);\n    setActiveTab('proyectos');\n    setActiveProjectTab('resumen');\n  };\n"""
    go_extra = """\n  const abrirNotificacionOperativa = (notificacion: OperationalNotification) => {\n    marcarNotificacionesLeidas([notificacion.id]);\n    if (notificacion.proyectoId) goToProject(notificacion.proyectoId);\n    else setActiveTab('proyectos');\n    setShowNotif(false);\n  };\n"""
    text = replace_once(text, go_anchor, go_anchor + go_extra, 'mandante open handler')
    start_marker = '          <div className="relative">\n            <button \n              onClick={() => setShowNotif(!showNotif)}'
    start = text.index(start_marker, text.index('{/* TOPBAR */}'))
    end_marker = '          <div className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition">'
    end = text.index(end_marker, start)
    new_block = """          <div className=\"relative\">\n            <button\n              onClick={() => setShowNotif(!showNotif)}\n              aria-label={showNotif ? 'Cerrar notificaciones' : 'Abrir notificaciones'}\n              aria-expanded={showNotif}\n              className=\"flex items-center justify-center relative w-8 h-8 rounded-md bg-white/10 text-cream hover:bg-white/20 transition-colors\"\n            >\n              <Bell size={18} />\n              {notificacionesSinLeer > 0 && <span className=\"absolute -top-1.5 -right-1.5 min-w-[17px] h-[17px] px-1 flex items-center justify-center bg-[#c73b3b] text-white text-[8px] font-extrabold rounded-full border-2 border-navy\">{notificacionesSinLeer}</span>}\n            </button>\n            {showNotif && <div className=\"fixed inset-0 z-[299]\" onClick={() => setShowNotif(false)} />}\n            {showNotif && <OperationalNotificationsPanel\n              contextLabel={mandanteLogueado.nombre}\n              notificaciones={notificacionesOperativas}\n              leidas={notificacionesLeidas}\n              onMarcarLeida={id => marcarNotificacionesLeidas([id])}\n              onMarcarTodas={() => marcarNotificacionesLeidas(notificacionesOperativas.map(item => item.id))}\n              onAbrir={abrirNotificacionOperativa}\n            />}\n          </div>\n"""
    text = text[:start] + new_block + text[end:]
    p.write_text(text)
