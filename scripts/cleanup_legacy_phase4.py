from pathlib import Path
import re

# ---- Mandante portal: remove unreachable fake onboarding and obsolete local invitation/template imports.
p=Path('src/pages/Mandante.tsx')
t=p.read_text()
for token in ['getPlantillas, ', 'savePlantillas, ', 'getInvitaciones, ', 'saveInvitaciones, ', 'crearInvitacion, ']:
    t=t.replace(token, '')
t=t.replace('  const allPlantillas = getPlantillas();\n', '')
# Protected MandanteRoute already handles the real first-project onboarding.
t=re.sub(r"  const \[onboardingStep, setOnboardingStep\] = useState<number \| null>\(\(\) => \{\n    return misProyectos\.length === 0 \? 1 : null;\n  \}\);\n", '', t)
start=t.find('  if (onboardingStep !== null) {')
final_return=t.find('  return (\n    <div className="h-screen', start)
if start != -1 and final_return != -1:
    t=t[:start]+t[final_return:]
    print('removed fake Mandante onboarding')
p.write_text(t)

# ---- Contractor portal: real invitation acceptance occurs on /invitacion before entering protected portal.
p=Path('src/pages/Contratista.tsx')
t=p.read_text()
for token in ['getPlantillas, ', 'getInvitaciones, ', 'saveInvitaciones, ', 'aceptarInvitacion, ']:
    t=t.replace(token, '')
t=t.replace("  const [invitacionAceptada, setInvitacionAceptada] = useState(false);\n", '')
t=t.replace("  const [tieneProyecto, setTieneProyecto] = useState(false);\n", '')
# Remove effect that looked for browser-local invitations.
t=re.sub(r"\n  React\.useEffect\(\(\) => \{\n    const invs = getInvitaciones\(\);.*?\n  \}, \[\]\);\n", '\n', t, flags=re.S)
# Remove the obsolete invitation acceptance/rejection screen.
start=t.find('  if (tieneProyecto && !invitacionAceptada) {')
final_return=t.find('  return (\n    <div className="h-screen', start)
if start != -1 and final_return != -1:
    t=t[:start]+t[final_return:]
    print('removed local Contractor invitation screen')
p.write_text(t)

# ---- localStorageDb: remove browser-local invitations entirely; preserve Supabase session compatibility.
p=Path('src/data/localStorageDb.ts')
t=p.read_text()
t=t.replace(', Invitacion,', ',')
# get/save local invitations only.
t=re.sub(r"export function getInvitaciones\(\): Invitacion\[\] \{.*?\n\}\n\nexport function saveInvitaciones\(list: Invitacion\[\]\): void \{.*?\n\}\n\n", '', t, flags=re.S)
# Legacy invitation validation/create/accept/reject block.
start=t.find('export function validarCrearInvitacion(')
end=t.find('export function actualizarEstadoDocumento(', start)
if start != -1 and end != -1:
    t=t[:start]+t[end:]
    print('removed local invitation backend')
p.write_text(t)

# ---- Mandante Config: eliminate fake browser-persisted organization/team/notification settings.
Path('src/pages/mandante/config/configUtils.ts').write_text("export type ConfigTabId = 'empresa';\n")
Path('src/pages/mandante/ConfigTab.tsx').write_text("""import { Building2, Folder, ShieldCheck } from 'lucide-react';
import type { Mandante, Proyecto } from '../../types';
import type { ConfigTabId } from './config/configUtils';
import './ConfigTab.css';

interface Props {
  activeConfigTab: ConfigTabId;
  setActiveConfigTab: (tab: ConfigTabId) => void;
  showToast: (message: string, type?: 'success' | 'error' | 'warning') => void;
  misProyectos: Proyecto[];
  mandante: Mandante;
  onDirtyChange?: (dirty: boolean) => void;
}

export default function ConfigTab({ mandante, misProyectos, onDirtyChange }: Props) {
  onDirtyChange?.(false);
  const activos = misProyectos.filter(project => project.estado === 'active').length;
  return (
    <div className="mandante-config fade-in">
      <header className="mandante-config-head">
        <h2>Configuración</h2>
        <p>Información de tu organización conectada a Acredita.</p>
      </header>
      <div className="mandante-config-content" style={{ maxWidth: 820 }}>
        <section className="mandante-config-card">
          <div className="mandante-config-title">
            <div>
              <h3>Mi empresa</h3>
              <p>Estos datos provienen del backend y no se guardan en este navegador.</p>
            </div>
            <Building2 size={20} />
          </div>
          <div className="mandante-config-grid">
            <div><div className="mandante-config-label">Razón social</div><strong>{mandante.nombre}</strong></div>
            <div><div className="mandante-config-label">RUT</div><strong>{mandante.rut}</strong></div>
          </div>
        </section>
        <section className="mandante-config-card">
          <div className="mandante-config-title">
            <div><h3>Proyectos</h3><p>Resumen de proyectos visibles para esta organización.</p></div>
            <Folder size={20} />
          </div>
          <div className="mandante-config-grid">
            <div><div className="mandante-config-label">Total</div><strong>{misProyectos.length}</strong></div>
            <div><div className="mandante-config-label">Activos</div><strong>{activos}</strong></div>
          </div>
        </section>
        <section className="mandante-config-card">
          <div className="mandante-config-title">
            <div><h3>Acceso y permisos</h3><p>Los permisos efectivos se aplican desde Supabase mediante membresías y RLS.</p></div>
            <ShieldCheck size={20} />
          </div>
        </section>
      </div>
    </div>
  );
}
""")
print('replaced Mandante fake config with backend-backed read-only view')
