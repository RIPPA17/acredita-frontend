import { useEffect, useState, type FormEvent } from 'react';
import { FileText, Library, Link2, RefreshCw, Upload } from 'lucide-react';
import {
  applyLibraryDocument,
  listLibraryDocuments,
  listLinkableObligations,
  openLibraryDocument,
  uploadLibraryDocument,
  type LibraryDocument,
  type LinkableObligation,
} from '../data/supabaseAssets';

export default function DocumentLibraryPanel({
  projectKey,
  contractorKey,
  showToast,
  onChanged,
}: {
  projectKey: string;
  contractorKey: string;
  showToast: (message: string, type?: 'success' | 'error' | 'warning') => void;
  onChanged?: () => void;
}) {
  const [documents, setDocuments] = useState<LibraryDocument[]>([]);
  const [obligations, setObligations] = useState<LinkableObligation[]>([]);
  const [targets, setTargets] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ type: '', issuedAt: '', expiresAt: '' });
  const [file, setFile] = useState<File>();

  const load = async () => {
    setLoading(true);
    try {
      const [nextDocuments, nextObligations] = await Promise.all([
        listLibraryDocuments(contractorKey),
        listLinkableObligations(projectKey, contractorKey),
      ]);
      setDocuments(nextDocuments);
      setObligations(nextObligations);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'No fue posible cargar la biblioteca documental.', 'error');
    } finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, [projectKey, contractorKey]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!file || !form.type.trim() || saving) return;
    setSaving(true);
    try {
      await uploadLibraryDocument(contractorKey, form.type, file, form.issuedAt || undefined, form.expiresAt || undefined);
      setFile(undefined); setForm({ type: '', issuedAt: '', expiresAt: '' }); await load();
      showToast('Documento guardado en la biblioteca del contratista.');
    } catch (error) { showToast(error instanceof Error ? error.message : 'No fue posible guardar el documento.', 'error'); }
    finally { setSaving(false); }
  };

  const apply = async (document: LibraryDocument) => {
    const obligationId = targets[document.id];
    if (!obligationId) return;
    setSaving(true);
    try {
      await applyLibraryDocument(document.id, obligationId);
      await load(); onChanged?.();
      showToast('Documento reutilizado. Se creó una nueva versión En revisión para esa obligación.');
    } catch (error) { showToast(error instanceof Error ? error.message : 'No fue posible reutilizar el documento.', 'error'); }
    finally { setSaving(false); }
  };

  const actionable = obligations.filter(item => !['aprobado', 'por_vencer'].includes(item.status));

  return (
    <section className="border rounded-xl p-4 mt-5">
      <div className="flex items-start justify-between gap-3 mb-4"><div className="flex gap-2"><Library /><div><h3 className="font-semibold text-navy">Biblioteca documental reutilizable</h3><p className="text-sm text-gray-500">Guarda certificados y documentos de empresa una vez y reutilízalos en obligaciones compatibles sin duplicar archivos.</p></div></div><button type="button" onClick={() => void load()} aria-label="Actualizar biblioteca"><RefreshCw /></button></div>
      <form onSubmit={submit} className="grid grid-cols-1 sm:grid-cols-4 gap-3 mb-4">
        <label className="text-sm">Tipo de documento<input required value={form.type} onChange={event => setForm({ ...form, type: event.target.value })} className="form-input w-full mt-1 p-2 border rounded-lg" placeholder="Ej.: Certificado tributario" /></label>
        <label className="text-sm">Emisión<input type="date" value={form.issuedAt} onChange={event => setForm({ ...form, issuedAt: event.target.value })} className="form-input w-full mt-1 p-2 border rounded-lg" /></label>
        <label className="text-sm">Vencimiento<input type="date" value={form.expiresAt} onChange={event => setForm({ ...form, expiresAt: event.target.value })} className="form-input w-full mt-1 p-2 border rounded-lg" /></label>
        <label className="text-sm">Archivo<input required type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={event => setFile(event.target.files?.[0])} className="form-input w-full mt-1 p-2 border rounded-lg" /></label>
        <button type="submit" className="btn btn-primary sm:col-span-4" disabled={saving || !file}><Upload /> {saving ? 'Guardando…' : 'Guardar en biblioteca'}</button>
      </form>

      {loading ? <p className="text-sm text-gray-500">Cargando biblioteca…</p> : documents.length === 0 ? <p className="text-sm text-gray-500">Aún no hay documentos reutilizables.</p> : <div className="space-y-3">{documents.map(document => <div key={document.id} className="border rounded-lg p-3"><div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3"><div><strong>{document.type}</strong><small className="block text-gray-500">{document.name} · {document.status}{document.expiresAt ? ` · vence ${document.expiresAt}` : ''}</small></div><button type="button" onClick={() => void openLibraryDocument(document)}><FileText /> Ver</button></div>{document.status === 'vigente' && actionable.length > 0 && <div className="flex flex-col sm:flex-row gap-2 mt-3"><select value={targets[document.id] || ''} onChange={event => setTargets({ ...targets, [document.id]: event.target.value })} className="form-input flex-1 p-2 border rounded-lg"><option value="">Reutilizar en una obligación pendiente…</option>{actionable.map(item => <option key={item.id} value={item.id}>{item.requirementName} · {item.target === 'empresa' ? 'Empresa' : 'Trabajador'} · {item.periodStart} — {item.periodEnd} · {item.status}</option>)}</select><button type="button" disabled={saving || !targets[document.id]} onClick={() => void apply(document)} className="btn btn-primary"><Link2 /> Usar documento</button></div>}</div>)}</div>}
    </section>
  );
}
