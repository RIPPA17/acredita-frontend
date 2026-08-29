from pathlib import Path

local_db = Path('src/data/localStorageDb.ts')
text = local_db.read_text()

old_import = "import { PLANTILLA_DOCUMENTOS } from './mockData';"
new_import = "import { DEFAULT_DOCUMENT_TEMPLATES } from './defaultTemplates';"
if text.count(old_import) != 1:
    raise SystemExit(f'Import mockData inesperado: {text.count(old_import)} coincidencias')
text = text.replace(old_import, new_import, 1)

old_fallback = "return getRuntimeArray<any>('acredita_plantillas', PLANTILLA_DOCUMENTOS);"
new_fallback = "return getRuntimeArray<any>('acredita_plantillas', DEFAULT_DOCUMENT_TEMPLATES);"
if text.count(old_fallback) != 1:
    raise SystemExit(f'Fallback de plantillas inesperado: {text.count(old_fallback)} coincidencias')
text = text.replace(old_fallback, new_fallback, 1)
local_db.write_text(text)

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
    if 'mockData' in content or 'PLANTILLA_DOCUMENTOS' in content:
        remaining.append(str(path))

if remaining:
    raise SystemExit('Aún existen dependencias de mockData: ' + ', '.join(remaining))

Path('src/data/mockData.ts').unlink()
