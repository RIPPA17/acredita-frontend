from pathlib import Path
import re


def read(path): return Path(path).read_text()
def write(path, text): Path(path).write_text(text)
def replace(path, old, new):
    text=read(path)
    if old not in text:
        print(f'SKIP exact {path}: pattern absent')
        return False
    write(path, text.replace(old,new))
    print(f'PATCH {path}')
    return True

def regex(path, pattern, repl, flags=0):
    text=read(path)
    new,n=re.subn(pattern,repl,text,flags=flags)
    if not n:
        print(f'SKIP regex {path}: {pattern[:50]}')
        return False
    write(path,new)
    print(f'PATCH {path} x{n}')
    return True

# Type-only React namespace fixes.
replace('src/components/MandanteRoute.tsx', "import { useState } from 'react';", "import { useState, type FormEvent, type ReactNode } from 'react';")
replace('src/components/MandanteRoute.tsx', 'event: React.FormEvent', 'event: FormEvent')
replace('src/components/MandanteRoute.tsx', 'icon: React.ReactNode', 'icon: ReactNode')
replace('src/pages/contratista/SubirTab.tsx', "import { useRef, useState } from 'react';", "import { useRef, useState, type ChangeEvent } from 'react';")
replace('src/pages/contratista/SubirTab.tsx', 'event: React.ChangeEvent<HTMLInputElement>', 'event: ChangeEvent<HTMLInputElement>')

# Derived state becomes ephemeral memory. Supabase remains source of truth.
p='src/data/supabaseDerivedState.ts'
t=read(p)
t=t.replace("const CACHE_KEY = 'acredita_backend_derived_state_v1';\n", '')
t=t.replace("type DerivedStateCache = {\n", "type DerivedStateCache = {\n")
needle="type DerivedStateCache = {\n  profileId: string;\n  updatedAt: string;\n  accreditations: Record<string, DerivedAccreditationState>;\n  workers: Record<string, DerivedWorkerState>;\n};\n"
if needle in t and 'let runtimeCache:' not in t:
    t=t.replace(needle, needle+"\nlet runtimeCache: DerivedStateCache | null = null;\n")
t=re.sub(r"function readCache\(\): DerivedStateCache \| null \{.*?\n\}", "function readCache(): DerivedStateCache | null {\n  return runtimeCache;\n}", t, flags=re.S)
t=re.sub(r"export function clearDerivedStateCache\(\): void \{.*?\n\}", "export function clearDerivedStateCache(): void {\n  runtimeCache = null;\n}", t, flags=re.S)
t=t.replace("  localStorage.setItem(CACHE_KEY, JSON.stringify(cache));", "  runtimeCache = cache;")
write(p,t)
print('PATCH',p)

# Review operations snapshot stays in module memory, not localStorage.
p='src/data/supabaseReviewOperations.ts'
t=read(p)
marker="export interface ReviewDecisionInput {"
if 'let runtimeReviewSnapshot:' not in t:
    t=t.replace(marker, "let runtimeReviewSnapshot: ReviewOperationsSnapshot | null = null;\n\n"+marker)
t=re.sub(r"function writeReviewCache\(snapshot: ReviewOperationsSnapshot\): void \{.*?\n\}", "export function getReviewOperationsSnapshot(): ReviewOperationsSnapshot | null {\n  return runtimeReviewSnapshot;\n}\n\nexport function getReviewActivityToday(reviewerId: string): { aprobados: number; rechazados: number } {\n  const activity = runtimeReviewSnapshot?.actividad || [];\n  return {\n    aprobados: activity.filter(item => item.verificadorId === reviewerId && item.accion === 'aprobado').length,\n    rechazados: activity.filter(item => item.verificadorId === reviewerId && item.accion === 'rechazado').length,\n  };\n}\n\nfunction writeReviewCache(snapshot: ReviewOperationsSnapshot): void {\n  runtimeReviewSnapshot = snapshot;\n}", t, flags=re.S)
write(p,t)
print('PATCH',p)

# Reviewer UI reads activity from the Supabase snapshot.
replace('src/pages/admin/VerificadoresTab.tsx', "import { getActividadHoyPorVerificador } from '../../data/localStorageDb';", "import { getReviewActivityToday } from '../../data/supabaseReviewOperations';")
replace('src/pages/admin/VerificadoresTab.tsx', 'getActividadHoyPorVerificador(verificador.id)', 'getReviewActivityToday(verificador.id)')
replace('src/pages/admin/VerificadorDetailDrawer.tsx', "import { getActividadHoyPorVerificador } from '../../data/localStorageDb';", "import { getReviewActivityToday } from '../../data/supabaseReviewOperations';")
replace('src/pages/admin/VerificadorDetailDrawer.tsx', 'getActividadHoyPorVerificador(verificador.id)', 'getReviewActivityToday(verificador.id)')

# Queue identity is the authenticated reviewer only; no browser fallback.
replace('src/pages/admin/ColaRevisionTab.tsx', "import { getContratistas, getMandantes, getProyectos, getVerificadorActual } from '../../data/localStorageDb';", "import { getContratistas, getMandantes, getProyectos } from '../../data/localStorageDb';")
replace('src/pages/admin/ColaRevisionTab.tsx', "  const currentReviewer = verificadores.find(item => item.id === verificadorActualId) || getVerificadorActual();", "  const currentReviewer = verificadores.find(item => item.id === verificadorActualId);")

# Admin review state is hydrated directly from Supabase, no local review cache or local audit fallback.
p='src/pages/Admin.tsx'
t=read(p)
old='import { getContratistas, saveContratistas, getProyectos, saveProyectos, getMandantes, saveMandantes, getRequisitos, saveRequisitos, getVerificadores, saveVerificadores, getVerificadorActualId, setVerificadorActual, getVerificadorActual, getClaimsRevision, saveClaimsRevision, calcularEstadoAcreditacion, calcularEstadoTrabajador, getAlertasVigencia, esVencidoPorFecha, obtenerDiasRestantes, logoutUser, getAuditLogs } from "../data/localStorageDb";'
new='import { getContratistas, saveContratistas, getProyectos, saveProyectos, getMandantes, saveMandantes, getRequisitos, saveRequisitos, calcularEstadoAcreditacion, calcularEstadoTrabajador, getAlertasVigencia, esVencidoPorFecha, obtenerDiasRestantes, logoutUser } from "../data/localStorageDb";'
t=t.replace(old,new)
if "from '../data/supabaseReviewOperations'" not in t:
    t=t.replace("import { loadSupabaseAuditLogs } from '../data/supabaseAuditData';", "import { loadSupabaseAuditLogs } from '../data/supabaseAuditData';\nimport { refreshReviewOperationsCache } from '../data/supabaseReviewOperations';")
t=t.replace("  const [verificadores, setVerificadores] = useState<Verificador[]>(() => getVerificadores());\n  const [claimsRevision, setClaimsRevisionState] = useState<ClaimRevision[]>(() => getClaimsRevision());\n  const setClaimsRevision = (next: ClaimRevision[]) => {\n    saveClaimsRevision(next);\n    setClaimsRevisionState(next);\n  };", "  const [verificadores, setVerificadores] = useState<Verificador[]>([]);\n  const [claimsRevision, setClaimsRevisionState] = useState<ClaimRevision[]>([]);\n  const setClaimsRevision = (next: ClaimRevision[]) => setClaimsRevisionState(next);")
t=t.replace("    setVerificadores(getVerificadores());\n    setVerificadorActualIdState(getVerificadorActualId());\n    // Red de seguridad: al cambiar de pestaña, descarta claims cuyo\n    // documento ya no esté en la cola (p. ej. modificado por otro flujo).\n    setClaimsRevision(pruneClaimsRevision(getClaimsRevision(), freshContratistas, freshProyectos));", "    void refreshReviewOperationsCache().then(snapshot => {\n      setVerificadores(snapshot.verificadores);\n      setVerificadorActualIdState(snapshot.currentReviewerId);\n      setClaimsRevision(pruneClaimsRevision(snapshot.claims, freshContratistas, freshProyectos));\n    }).catch(() => {\n      // Conserva el último snapshot válido si Supabase tiene una interrupción breve.\n    });")
t=re.sub(r"  // Verificador operativo actual \(Configuración → General\): estado reactivo.*?  const topbarVerificador = useMemo\(\(\) => getVerificadorActual\(\), \[verificadores, verificadorActualId\]\);", "  // El revisor operativo es la identidad Acredita autenticada que devuelve Supabase.\n  const [verificadorActualId, setVerificadorActualIdState] = useState<string | null>(null);\n  const topbarVerificador = useMemo(\n    () => verificadores.find(item => item.id === verificadorActualId) || null,\n    [verificadores, verificadorActualId],\n  );", t, flags=re.S)
t=re.sub(r"      \.catch\(\(\) => \{\n        if \(cancelled\) return;\n        const legacy = getAuditLogs\(\)\.map\(log => \(\{.*?        setAuditoriaLogs\(legacy\);\n      \}\);", "      .catch(() => {\n        if (!cancelled) setAuditoriaLogs([]);\n      });", t, flags=re.S)
t=t.replace("              onSetVerificadorActual={handleSetVerificadorActual}\n", '')
write(p,t)
print('PATCH',p)

# Configuration no longer exposes a fake manual reviewer setter.
p='src/pages/admin/ConfiguracionTab.tsx'
t=read(p)
t=t.replace("  onSetVerificadorActual: (id: string) => void;\n", '')
t=t.replace("<GeneralConfig verificadores={verificadores} verificadorActualId={verificadorActualId} onSetVerificadorActual={() => undefined} />", "<GeneralConfig verificadores={verificadores} verificadorActualId={verificadorActualId} />")
write(p,t)
p='src/pages/admin/configuracion/GeneralConfig.tsx'
t=read(p).replace("  onSetVerificadorActual: (id: string) => void;\n", '')
write(p,t)
print('PATCH admin config')

# Remove imports of the old demo reset panel from active code is separate; the dead file can be deleted later.
