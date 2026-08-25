from pathlib import Path


def replace_once(path: str, old: str, new: str):
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f'Pattern not found in {path}: {old[:100]!r}')
    p.write_text(text.replace(old, new, 1))

# localStorageDb: remove notification preferences from browser storage.
p = Path('src/data/localStorageDb.ts')
text = p.read_text()
text = text.replace(', PreferenciasNotificacionesContratista', '')
start = text.index('const DEFAULT_PREFERENCIAS_NOTIFICACIONES_CONTRATISTA')
end = text.index('export function getBusinessToday', start)
text = text[:start] + text[end:]
p.write_text(text)

# Contractor portal: read state and preferences from Supabase.
p = Path('src/pages/Contratista.tsx')
text = p.read_text()
text = text.replace(', getPreferenciasNotificacionesContratista', '')
text = text.replace("import { buildNotificacionesContratista, NotificacionContratista } from './contratista/notificacionesUtils';\n", "import { buildNotificacionesContratista, NotificacionContratista } from './contratista/notificacionesUtils';\nimport { DEFAULT_NOTIFICATION_PREFERENCES, loadNotificationPreferences, loadReadNotificationKeys, markNotificationKeysRead, saveNotificationPreferences } from '../data/supabaseNotifications';\n")
start = text.index("const NOTIFICACIONES_LEIDAS_KEY")
end = text.index('export default function ContratistaPortal()', start)
text = text[:start] + text[end:]
old = """  const session = getCurrentSession();\n  const contratistaLogueado = allContratistas.find(c => c.id === session?.contratistaId) || allContratistas[0];\n  const [notificacionesLeidas, setNotificacionesLeidas] = useState<Set<string>>(() => getNotificacionesLeidas(contratistaLogueado.id));\n  const misProyectos = allProyectos.filter(p => p.contratistas.includes(contratistaLogueado.id));\n  const notificaciones = buildNotificacionesContratista({\n    contratista: contratistaLogueado,\n    proyectos: misProyectos,\n    requisitos: getRequisitos(),\n    preferencias: getPreferenciasNotificacionesContratista(contratistaLogueado.id),\n  });\n  const notificacionesSinLeer = notificaciones.filter(item => !notificacionesLeidas.has(item.id)).length;\n\n  const marcarLeidas = (ids: string[]) => {\n    setNotificacionesLeidas(actual => {\n      const next = new Set<string>(actual);\n      ids.forEach(id => next.add(id));\n      saveNotificacionesLeidas(contratistaLogueado.id, next);\n      return next;\n    });\n  };\n\n  const abrirNotificaciones = () => {\n    setNotificacionesLeidas(getNotificacionesLeidas(contratistaLogueado.id));\n    setShowNotif(actual => !actual);\n  };\n"""
new = """  const session = getCurrentSession();\n  const contratistaLogueado = allContratistas.find(c => c.id === session?.contratistaId) || allContratistas[0];\n  const [notificacionesLeidas, setNotificacionesLeidas] = useState<Set<string>>(new Set());\n  const [preferenciasNotificaciones, setPreferenciasNotificaciones] = useState({ ...DEFAULT_NOTIFICATION_PREFERENCES });\n  const misProyectos = allProyectos.filter(p => p.contratistas.includes(contratistaLogueado.id));\n\n  React.useEffect(() => {\n    if (!session?.profileId) return;\n    let cancelled = false;\n    Promise.all([\n      loadNotificationPreferences(session.profileId, session),\n      loadReadNotificationKeys(session.profileId, session),\n    ]).then(([preferencias, leidas]) => {\n      if (cancelled) return;\n      setPreferenciasNotificaciones(preferencias);\n      setNotificacionesLeidas(leidas);\n    }).catch(() => {\n      if (!cancelled) setNotificacionesLeidas(new Set());\n    });\n    return () => { cancelled = true; };\n  }, [session?.profileId]);\n\n  const notificaciones = buildNotificacionesContratista({\n    contratista: contratistaLogueado,\n    proyectos: misProyectos,\n    requisitos: getRequisitos(),\n    preferencias: preferenciasNotificaciones,\n  });\n  const notificacionesSinLeer = notificaciones.filter(item => !notificacionesLeidas.has(item.id)).length;\n\n  const marcarLeidas = (ids: string[]) => {\n    setNotificacionesLeidas(actual => {\n      const next = new Set<string>(actual);\n      ids.forEach(id => next.add(id));\n      return next;\n    });\n    if (session?.profileId) void markNotificationKeysRead(session.profileId, ids, session).catch(() => undefined);\n  };\n\n  const guardarPreferenciasNotificaciones = async (preferencias: typeof preferenciasNotificaciones) => {\n    if (!session?.profileId) throw new Error('Sesión inválida');\n    await saveNotificationPreferences(session.profileId, preferencias, session);\n    setPreferenciasNotificaciones(preferencias);\n  };\n\n  const abrirNotificaciones = () => setShowNotif(actual => !actual);\n"""
if old not in text:
    raise SystemExit('Contractor notification block not found')
text = text.replace(old, new, 1)
text = text.replace("              showToast={showToast}\n            />\n          )}\n\n          {/* MOBILE NAVBAR */}", "              showToast={showToast}\n              preferenciasNotificaciones={preferenciasNotificaciones}\n              onGuardarPreferencias={guardarPreferenciasNotificaciones}\n            />\n          )}\n\n          {/* MOBILE NAVBAR */}", 1)
p.write_text(text)

# Contractor ConfigTab: persist preferences to Supabase through parent.
p = Path('src/pages/contratista/ConfigTab.tsx')
text = p.read_text()
text = text.replace("import { useState } from 'react';", "import { useEffect, useState } from 'react';")
old_import = """import {\n  getPreferenciasNotificacionesContratista,\n  savePreferenciasNotificacionesContratista,\n  UserSession,\n} from '../../data/localStorageDb';\n"""
text = text.replace(old_import, "import type { SupabaseUserSession as UserSession } from '../../data/supabaseAuth';\n")
old_props = """  showToast: (msg: string, type?: 'success' | 'error' | 'warning') => void;\n}) {\n  const [activeTab, setActiveTab] = useState<ConfigSubTab>('empresa');\n  const [preferencias, setPreferencias] = useState<PreferenciasNotificacionesContratista>(() => getPreferenciasNotificacionesContratista(contratistaLogueado.id));\n  const [guardadas, setGuardadas] = useState<PreferenciasNotificacionesContratista>(() => getPreferenciasNotificacionesContratista(contratistaLogueado.id));\n  const hayCambios = PREFERENCIAS.some(([key]) => preferencias[key] !== guardadas[key]);\n\n  const guardarPreferencias = () => {\n    savePreferenciasNotificacionesContratista(contratistaLogueado.id, preferencias);\n    setGuardadas(preferencias);\n    showToast('Preferencias guardadas');\n  };\n"""
new_props = """  showToast: (msg: string, type?: 'success' | 'error' | 'warning') => void;\n  preferenciasNotificaciones: PreferenciasNotificacionesContratista;\n  onGuardarPreferencias: (preferencias: PreferenciasNotificacionesContratista) => Promise<void>;\n}) {\n  const [activeTab, setActiveTab] = useState<ConfigSubTab>('empresa');\n  const [preferencias, setPreferencias] = useState<PreferenciasNotificacionesContratista>(preferenciasNotificaciones);\n  const [guardadas, setGuardadas] = useState<PreferenciasNotificacionesContratista>(preferenciasNotificaciones);\n  const [guardando, setGuardando] = useState(false);\n  const hayCambios = PREFERENCIAS.some(([key]) => preferencias[key] !== guardadas[key]);\n\n  useEffect(() => {\n    setPreferencias(preferenciasNotificaciones);\n    setGuardadas(preferenciasNotificaciones);\n  }, [preferenciasNotificaciones]);\n\n  const guardarPreferencias = async () => {\n    setGuardando(true);\n    try {\n      await onGuardarPreferencias(preferencias);\n      setGuardadas(preferencias);\n      showToast('Preferencias guardadas');\n    } catch (error) {\n      showToast(error instanceof Error ? error.message : 'No fue posible guardar las preferencias', 'error');\n    } finally {\n      setGuardando(false);\n    }\n  };\n"""
if old_props not in text:
    raise SystemExit('Config props block not found')
text = text.replace(old_props, new_props, 1)
text = text.replace('export default function ConfigTab({ contratistaLogueado, misProyectos, allMandantes, session, onLogout, showToast }: {', 'export default function ConfigTab({ contratistaLogueado, misProyectos, allMandantes, session, onLogout, showToast, preferenciasNotificaciones, onGuardarPreferencias }: {', 1)
text = text.replace('Los cambios se guardan localmente para esta cuenta en el frontend MVP.', 'Los cambios se guardan en tu cuenta y se aplican en cualquier dispositivo.')
text = text.replace('<button className="cfg-save" disabled={!hayCambios} onClick={guardarPreferencias}>Guardar preferencias</button>', '<button className="cfg-save" disabled={!hayCambios || guardando} onClick={guardarPreferencias}>{guardando ? \'Guardando…\' : \'Guardar preferencias\'}</button>')
p.write_text(text)
