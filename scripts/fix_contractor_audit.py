from pathlib import Path
import re


def replace_once(path: str, old: str, new: str):
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f'Pattern not found in {path}: {old[:100]!r}')
    p.write_text(text.replace(old, new, 1))

# 1) Never fall back to another contractor when the authenticated identity cannot be resolved.
p = Path('src/pages/Contratista.tsx')
text = p.read_text()
old = """  const session = getCurrentSession();
  const contratistaLogueado = allContratistas.find(c => c.id === session?.contratistaId) || allContratistas[0];
  const [notificacionesLeidas, setNotificacionesLeidas] = useState<Set<string>>(new Set());
"""
new = """  const session = getCurrentSession();
  const contratistaEncontrado = allContratistas.find(c => c.id === session?.contratistaId);
  const contratistaLogueado: Contratista = contratistaEncontrado || {
    id: session?.contratistaId || '__unresolved__',
    nombre: session?.nombre || 'Contratista',
    rut: '',
    proyectos: [],
    documentos: [],
    trabajadores: [],
  };
  const [notificacionesLeidas, setNotificacionesLeidas] = useState<Set<string>>(new Set());
"""
if old in text:
    text = text.replace(old, new, 1)
text = text.replace("return misProyectos[0]?.id || 'costanera';", "return misProyectos[0]?.id || '';", 1)
anchor = """  const [documentosData, setDocumentosData] = useState<Documento[]>([]);

  React.useEffect(() => {
"""
if anchor in text and "Mantiene el proyecto activo dentro del alcance" not in text:
    sync = """  const [documentosData, setDocumentosData] = useState<Documento[]>([]);

  React.useEffect(() => {
    if (misProyectos.length === 0) {
      if (selectedProyectoId) setSelectedProyectoId('');
      return;
    }
    if (!misProyectos.some(proyecto => proyecto.id === selectedProyectoId)) {
      setSelectedProyectoId(misProyectos[0].id);
      setSelectedWorkerForDocs(null);
    }
  }, [misProyectos, selectedProyectoId]);

  React.useEffect(() => {
"""
    text = text.replace(anchor, sync, 1)
return_anchor = """  return (
    <div className=\"h-screen flex flex-col font-sans bg-cream2 text-navy\">"""
if return_anchor in text and "No fue posible cargar tu empresa" not in text:
    safe_return = """  if (!contratistaEncontrado) {
    return (
      <div className=\"min-h-screen flex items-center justify-center bg-cream2 px-6 text-navy\">
        <div className=\"max-w-md rounded-2xl border border-cream3 bg-white p-6 text-center shadow-sm\">
          <h1 className=\"text-xl font-semibold\">No fue posible cargar tu empresa</h1>
          <p className=\"mt-2 text-sm text-gray-500\">La sesión es válida, pero no encontramos el contratista asociado dentro de los datos autorizados. Vuelve a iniciar sesión para resincronizar tu acceso.</p>
          <button className=\"btn btn-primary mt-5\" onClick={handleLogout}>Volver a iniciar sesión</button>
        </div>
      </div>
    );
  }

  return (
    <div className=\"h-screen flex flex-col font-sans bg-cream2 text-navy\">"""
    text = text.replace(return_anchor, safe_return, 1)
p.write_text(text)

# 2) Worker detail must upload/open the real file through private Supabase Storage.
p = Path('src/pages/contratista/TrabajadoresTab.tsx')
text = p.read_text()
text = text.replace("import { useState } from 'react';", "import { useRef, useState, type ChangeEvent } from 'react';", 1)
if "supabaseDocumentStorage" not in text:
    text = text.replace("import { Contratista, Documento, Mandante, Proyecto, Requisito, Trabajador } from '../../types';\n", "import { Contratista, Documento, Mandante, Proyecto, Requisito, Trabajador } from '../../types';\nimport { openDocumentFile, uploadDocumentFile } from '../../data/supabaseDocumentStorage';\n", 1)
text = text.replace("  normalizarNombreDocumento,\n  subirDocumentoRequisito,\n", "  normalizarNombreDocumento,\n", 1)
state_anchor = """  const [search, setSearch] = useState('');
  const [filtro, setFiltro] = useState<FiltroEstado>('todos');
"""
if state_anchor in text and "uploadTarget" not in text:
    text = text.replace(state_anchor, """  const [search, setSearch] = useState('');
  const [filtro, setFiltro] = useState<FiltroEstado>('todos');
  const [uploadTarget, setUploadTarget] = useState<{ item: ChecklistItem; trabajador: Trabajador } | null>(null);
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
""", 1)
old_action = re.compile(r"  const ejecutarAccion = \(item: ChecklistItem, trabajador: Trabajador\) => \{.*?\n  \};\n\n  if \(!proyecto\)", re.S)
new_action = """  const contextoDocumento = (item: ChecklistItem, trabajador: Trabajador) => ({
    contratistaId: contratistaLogueado.id,
    proyectoId: proyecto?.id || selectedProyectoId,
    requisito: {
      id: item.requisito.id,
      nombre: item.requisito.nombre,
      destino: item.requisito.destino,
    },
    trabajadorRut: trabajador.rut,
  });

  const ejecutarAccion = async (item: ChecklistItem, trabajador: Trabajador) => {
    const action = accionDocumento(item);
    if (!action.actionable) {
      try {
        await openDocumentFile(contextoDocumento(item, trabajador));
      } catch (error) {
        showToast(error instanceof Error ? error.message : 'No fue posible abrir el documento.', 'error');
      }
      return;
    }
    setUploadTarget({ item, trabajador });
    fileInputRef.current?.click();
  };

  const procesarArchivo = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    const target = uploadTarget;
    setUploadTarget(null);
    if (!file || !target) return;
    const key = `${target.trabajador.rut}:${target.item.requisito.id}`;
    setUploadingKey(key);
    try {
      const result = await uploadDocumentFile(contextoDocumento(target.item, target.trabajador), file);
      onDataChanged();
      showToast(`${result.filename} enviado a revisión (versión ${result.version}).`, 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'No fue posible subir el archivo.', 'error');
    } finally {
      setUploadingKey(null);
    }
  };

  const fileInput = <input
    ref={fileInputRef}
    type=\"file\"
    accept=\"application/pdf,image/jpeg,image/png,.pdf,.jpg,.jpeg,.png\"
    style={{ display: 'none' }}
    onChange={procesarArchivo}
  />;

  if (!proyecto)"""
text, count = old_action.subn(new_action, text, count=1)
if count != 1 and "const procesarArchivo = async" not in text:
    raise SystemExit('Worker action block not found')
# Put the real file input in both render paths.
text = text.replace("""    return (
      <section className=\"tw-detail tw-card\">""", """    return (
      <>
      {fileInput}
      <section className=\"tw-detail tw-card\">""", 1)
text = text.replace("""      </section>
    );
  }

  const habilitados""", """      </section>
      </>
    );
  }

  const habilitados""", 1)
text = text.replace("""  return (
    <div className=\"tw-page\">""", """  return (
    <>
    {fileInput}
    <div className=\"tw-page\">""", 1)
# close final fragment at file end
stripped = text.rstrip()
if stripped.endswith("  );\n}") and "{fileInput}\n    <div className=\"tw-page\">" in text:
    idx = stripped.rfind("  );\n}")
    before = stripped[:idx]
    # only add fragment close if main JSX currently ends with </div>
    if before.rstrip().endswith('</div>'):
        stripped = before + "</>\n  );\n}"
        text = stripped + "\n"
# Show upload progress and prevent duplicate click for the selected worker checklist.
old_button = """<button className={`tw-doc-action ${action.className}`} onClick={() => ejecutarAccion(item, selected.trabajador)}>{action.label}</button>"""
new_button = """<button
                      className={`tw-doc-action ${action.className}`}
                      disabled={uploadingKey === `${selected.trabajador.rut}:${item.requisito.id}`}
                      onClick={() => void ejecutarAccion(item, selected.trabajador)}
                    >{uploadingKey === `${selected.trabajador.rut}:${item.requisito.id}` ? 'Subiendo…' : action.label}</button>"""
text = text.replace(old_button, new_button, 1)
p.write_text(text)

# 3) Remove the obsolete simulated-upload helper so there is only one upload path.
p = Path('src/pages/contratista/documentosUtils.ts')
text = p.read_text()
text = text.replace("  calcularEstadoTrabajador,\n  getBusinessToday,\n", "", 1)
text = text.replace("  getContratistas,\n  saveContratistas,\n", "", 1)
text = text.replace("import { Documento, Requisito, Trabajador } from '../../types';", "import { Documento, Requisito } from '../../types';", 1)
text = re.sub(r"\nfunction fechaCargaDemo\(\): string \{.*?\n\}\n", "\n", text, count=1, flags=re.S)
start = text.find('\nexport interface SubirDocumentoRequisitoParams')
if start >= 0:
    text = text[:start].rstrip() + '\n'
p.write_text(text)
