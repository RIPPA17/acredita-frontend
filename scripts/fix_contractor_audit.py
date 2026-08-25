from pathlib import Path

p = Path('src/pages/Contratista.tsx')
text = p.read_text()
old = "import { Documento, Trabajador } from '../types';"
new = "import { Contratista, Documento, Trabajador } from '../types';"
if old in text:
    text = text.replace(old, new, 1)
p.write_text(text)

# Guardas de idempotencia: las correcciones funcionales deben existir y el flujo simulado no debe volver.
contractor = Path('src/pages/Contratista.tsx').read_text()
workers = Path('src/pages/contratista/TrabajadoresTab.tsx').read_text()
doc_utils = Path('src/pages/contratista/documentosUtils.ts').read_text()

required = [
    ('contratistaEncontrado', contractor),
    ("misProyectos[0]?.id || ''", contractor),
    ('uploadDocumentFile', workers),
    ('openDocumentFile', workers),
    ('procesarArchivo', workers),
]
for marker, source in required:
    if marker not in source:
        raise SystemExit(f'Missing expected contractor audit fix: {marker}')

if 'subirDocumentoRequisito' in workers or 'export function subirDocumentoRequisito' in doc_utils:
    raise SystemExit('Legacy simulated worker upload is still present')
