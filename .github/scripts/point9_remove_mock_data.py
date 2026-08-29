from pathlib import Path
import re


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: se esperaba 1 coincidencia y se encontraron {count}')
    return text.replace(old, new, 1)

# La única plantilla local legítima se mueve a un archivo mínimo de defaults.
local_db = Path('src/data/localStorageDb.ts')
text = local_db.read_text()
text = replace_once(
    text,
    "import { PLANTILLA_DOCUMENTOS } from './mockData';",
    "import { DEFAULT_DOCUMENT_TEMPLATES } from './defaultTemplates';",
    'import localStorageDb',
)
text = replace_once(
    text,
    "return getRuntimeArray<any>('acredita_plantillas', PLANTILLA_DOCUMENTOS);",
    "return getRuntimeArray<any>('acredita_plantillas', DEFAULT_DOCUMENT_TEMPLATES);",
    'fallback plantillas',
)
local_db.write_text(text)

# Los datos core deben provenir de Supabase/runtime, nunca de empresas demo.
core = Path('src/data/supabaseCoreData.ts')
text = core.read_text()
text = replace_once(
    text,
    "import { CONTRATISTAS, MANDANTES, PROYECTOS } from './mockData';\n",
    '',
    'import supabaseCoreData',
)
text = replace_once(
    text,
    "function fallbackMandante(id: string): Mandante | undefined {\n  return readArray<Mandante>('acredita_mandantes').find(item => item.id === id)\n    || MANDANTES.find(item => item.id === id);\n}",
    "function fallbackMandante(id: string): Mandante | undefined {\n  return readArray<Mandante>('acredita_mandantes').find(item => item.id === id);\n}",
    'fallback mandante',
)
text = replace_once(
    text,
    "function fallbackProject(id: string): Proyecto | undefined {\n  return readArray<Proyecto>('acredita_proyectos').find(item => item.id === id)\n    || PROYECTOS.find(item => item.id === id);\n}",
    "function fallbackProject(id: string): Proyecto | undefined {\n  return readArray<Proyecto>('acredita_proyectos').find(item => item.id === id);\n}",
    'fallback project',
)
text = replace_once(
    text,
    "function fallbackContractor(id: string): Contratista | undefined {\n  return readArray<Contratista>('acredita_contratistas').find(item => item.id === id)\n    || CONTRATISTAS.find(item => item.id === id);\n}",
    "function fallbackContractor(id: string): Contratista | undefined {\n  return readArray<Contratista>('acredita_contratistas').find(item => item.id === id);\n}",
    'fallback contractor',
)
core.write_text(text)

# No se borra el archivo hasta comprobar que no quedan imports/usos reales.
remaining = []
for path in Path('src').rglob('*'):
    if not path.is_file() or path == Path('src/data/mockData.ts'):
        continue
    if path.suffix not in {'.ts', '.tsx', '.js', '.jsx'}:
        continue
    try:
        content = path.read_text()
    except UnicodeDecodeError:
        continue
    if 'mockData' in content or re.search(r'\bPLANTILLA_DOCUMENTOS\b', content):
        remaining.append(str(path))

if remaining:
    raise SystemExit('Aún existen dependencias de mockData: ' + ', '.join(remaining))

Path('src/data/mockData.ts').unlink()
