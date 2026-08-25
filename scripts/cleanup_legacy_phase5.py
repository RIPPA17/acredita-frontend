from pathlib import Path
import re

# Contractor empty-state should derive from real project membership, not deleted invitation state.
p=Path('src/pages/Contratista.tsx')
t=p.read_text().replace('{!tieneProyecto && (', '{misProyectos.length === 0 && (')
p.write_text(t)

# Remove obsolete local document-review mutation helpers, example seeding and local audit backend.
p=Path('src/data/localStorageDb.ts')
t=p.read_text()
start=t.find('export function actualizarEstadoDocumento(')
end=t.find('export function vigenciaRequeridaLabel(', start)
if start != -1 and end != -1:
    t=t[:start]+t[end:]
    print('removed local review mutation helpers')
start=t.find('export function sembrarDocumentosEjemplo(): number {')
if start != -1:
    t=t[:start].rstrip()+"\n"
    print('removed demo queue seeding and local audit backend')
t=re.sub(r"\nfunction safeParseStorageArray<T>\(key: string, fallback: T\[\]\): T\[\] \{\n  return safeParseStorageValue<T\[\]>\(key, fallback, Array\.isArray\);\n\}\n", '\n', t)
p.write_text(t)
