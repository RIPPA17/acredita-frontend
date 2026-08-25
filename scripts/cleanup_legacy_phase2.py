from pathlib import Path
import re

p=Path('src/data/localStorageDb.ts')
t=p.read_text()

# Drop demo-only dependencies and use the real Supabase session cache.
t=t.replace("import { CONTRATISTAS, PROYECTOS, MANDANTES, PLANTILLA_DOCUMENTOS, VERIFICADORES } from './mockData';", "import { PLANTILLA_DOCUMENTOS } from './mockData';")
t=t.replace("import { Contratista, Proyecto, Mandante, Documento, Trabajador, Requisito, Invitacion, HistorialVersionDocumento, Verificador, ClaimRevision, ActividadVerificador, PreferenciasNotificacionesContratista } from '../types';", "import { Contratista, Proyecto, Mandante, Documento, Trabajador, Requisito, Invitacion, HistorialVersionDocumento, PreferenciasNotificacionesContratista } from '../types';")
t=t.replace("import { clearRuntimeBusinessData, getRuntimeArray, setRuntimeArray } from './runtimeDataStore';", "import { getRuntimeArray, setRuntimeArray } from './runtimeDataStore';")
if "from './supabaseAuth'" not in t:
    t=t.replace("import { requestBusinessPersistence } from './supabasePersistence';", "import { requestBusinessPersistence } from './supabasePersistence';\nimport { clearSupabaseSession, getStoredSupabaseSession, type SupabaseUserSession } from './supabaseAuth';")

# The old browser DB bootstrap/migrations are unreachable since ProtectedRoute hydrates from Supabase.
start=t.find('// Versión del esquema de datos guardados en localStorage.')
end=t.find('export function getContratistas(): Contratista[]')
if start != -1 and end != -1 and end > start:
    t=t[:start] + '// Datos de negocio: memoria efímera hidratada desde Supabase.\n\n' + t[end:]
    print('removed browser seed/migrations')

# Template compatibility is memory-only. Admin catalog itself lives in Supabase.
t=re.sub(r"export function getPlantillas\(\): any\[\] \{.*?\n\}\n\nexport function savePlantillas\(data: any\[\]\) \{.*?\n\}", "export function getPlantillas(): any[] {\n  return getRuntimeArray<any>('acredita_plantillas', PLANTILLA_DOCUMENTOS);\n}\n\nexport function savePlantillas(data: any[]) {\n  setRuntimeArray('acredita_plantillas', data);\n}", t, flags=re.S)

# Legacy global rules are read-only defaults. Project requirements are authoritative.
t=re.sub(r"export function getReglas\(\): any\[\] \{.*?\n\}\n\nexport function saveReglas\(data: any\[\]\) \{.*?\n\}", "function getReglas(): any[] {\n  return REGLAS_DEFAULT;\n}", t, flags=re.S)

# Reviewers, claims and review activity now live exclusively in Supabase.
start=t.find('export function getVerificadores():')
end=t.find('const DEFAULT_PREFERENCIAS_NOTIFICACIONES_CONTRATISTA')
if start != -1 and end != -1 and end > start:
    t=t[:start] + t[end:]
    print('removed local review operation store')

# Delete obsolete demo-reset tools and date override; keep only user-facing notification preferences for Point 2.
start=t.find('// Herramienta de desarrollo: vuelve a cargar el estado inicial del MVP.')
end=t.find('const BUSINESS_TODAY_OVERRIDE_KEY')
if start != -1 and end != -1 and end > start:
    t=t[:start] + t[end:]
t=re.sub(r"const BUSINESS_TODAY_OVERRIDE_KEY = 'acredita_business_today_override';\n\nexport function getBusinessToday\(\): Date \{.*?\n\}", "export function getBusinessToday(): Date {\n  const now = new Date();\n  return new Date(now.getFullYear(), now.getMonth(), now.getDate());\n}", t, flags=re.S)

# Remove the legacy hardcoded credential system. Compatibility helpers now proxy real Supabase Auth.
start=t.find('export interface UserSession {')
end=t.find('export function validarCrearInvitacion(')
if start != -1 and end != -1 and end > start:
    replacement="export type UserSession = SupabaseUserSession;\n\nexport function getCurrentSession(): UserSession | null {\n  return getStoredSupabaseSession();\n}\n\nexport function logoutUser(): void {\n  clearDerivedStateCache();\n  clearSupabaseSession();\n}\n\n"
    t=t[:start]+replacement+t[end:]
    print('removed hardcoded browser login/logout')

p.write_text(t)

# Diagnostics: old invitation helpers may still be imported by large portal files; report real references before removing them.
for filename in ['src/pages/Mandante.tsx','src/pages/Contratista.tsx']:
    text=Path(filename).read_text()
    print('USAGE', filename)
    for name in ['getInvitaciones','saveInvitaciones','crearInvitacion','aceptarInvitacion','savePlantillas','getPlantillas','limpiarDatosLocales','resetDemoData']:
        print(name, len(re.findall(rf'\\b{re.escape(name)}\\b', text)))
