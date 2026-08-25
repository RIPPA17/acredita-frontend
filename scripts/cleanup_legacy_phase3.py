from pathlib import Path
import re

# Collapse any duplicated snapshot helper block created by repeated cleanup runs.
p=Path('src/data/supabaseReviewOperations.ts')
t=p.read_text()
start=t.find('export function getReviewOperationsSnapshot():')
end=t.find('function writeReviewCache(snapshot: ReviewOperationsSnapshot): void {')
if start != -1 and end != -1 and end > start:
    block="""export function getReviewOperationsSnapshot(): ReviewOperationsSnapshot | null {
  return runtimeReviewSnapshot;
}

export function getReviewActivityToday(reviewerId: string): { aprobados: number; rechazados: number } {
  const activity = runtimeReviewSnapshot?.actividad || [];
  return {
    aprobados: activity.filter(item => item.verificadorId === reviewerId && item.accion === 'aprobado').length,
    rechazados: activity.filter(item => item.verificadorId === reviewerId && item.accion === 'rechazado').length,
  };
}

"""
    t=t[:start]+block+t[end:]
p.write_text(t)

# Print real usage counts for remaining legacy compatibility APIs.
for filename in ['src/pages/Mandante.tsx','src/pages/Contratista.tsx','src/pages/Admin.tsx']:
    text=Path(filename).read_text()
    print('USAGE', filename)
    for name in ['getInvitaciones','saveInvitaciones','crearInvitacion','aceptarInvitacion','getPlantillas','savePlantillas']:
        print(name, len(re.findall(rf'\b{re.escape(name)}\b', text)))
