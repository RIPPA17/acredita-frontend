import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { CarFront, Check, CircleAlert, CircleCheckBig, Construction, FileText, Plus, RefreshCw, Upload, X, XCircle } from 'lucide-react';
import type { Contratista, Proyecto, ServicioContrato } from '../types';
import { listAssetDocuments, listAssets, openAssetDocument, reviewAssetDocument, saveAsset, uploadAssetDocument, type AssetDocument, type AssetStatus, type AssetType, type OperationalAsset } from '../data/supabaseAssets';

type FormState = { contractorKey: string; serviceKey: string; type: AssetType; identifier: string; name: string; brand: string; model: string; year: string; ownerName: string; operatorName: string; status: AssetStatus; notes: string };
const emptyForm: FormState = { contractorKey: '', serviceKey: '', type: 'vehiculo', identifier: '', name: '', brand: '', model: '', year: '', ownerName: '', operatorName: '', status: 'pendiente', notes: '' };
const statusLabel: Record<AssetStatus, string> = { pendiente: 'Pendiente', en_revision: 'En revisión', habilitado: 'Habilitado', bloqueado: 'Bloqueado', inactivo: 'Inactivo' };

export default function AssetsPanel({ project, contractors, services, contractorKey, showToast }: { project: Proyecto; contractors: Contratista[]; services: ServicioContrato[]; contractorKey?: string; showToast: (message: string, type?: 'success' | 'error' | 'warning') => void }) {
  const [assets, setAssets] = useState<OperationalAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string>();
  const [form, setForm] = useState<FormState>(emptyForm);
  const [documentAsset, setDocumentAsset] = useState<OperationalAsset>();
  const [documents, setDocuments] = useState<AssetDocument[]>([]);
  const [documentType, setDocumentType] = useState('Revisión técnica');
  const [documentFile, setDocumentFile] = useState<File>();
  const [documentExpiry, setDocumentExpiry] = useState('');
  const contractorNames = useMemo(() => new Map(contractors.map(item => [item.id, item.nombre])), [contractors]);

  const load = async () => {
    setLoading(true);
    try { setAssets(await listAssets(project.id, contractorKey)); }
    catch (error) { console.error(error); showToast('No fue posible cargar vehículos y equipos.', 'error'); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, [project.id, contractorKey]);

  const startCreate = () => {
    setEditingId(undefined);
    setForm({ ...emptyForm, contractorKey: contractorKey || contractors[0]?.id || '' });
    setOpen(true);
  };
  const startEdit = (asset: OperationalAsset) => {
    setEditingId(asset.id);
    setForm({ contractorKey: asset.contractorKey, serviceKey: asset.serviceKey || '', type: asset.type, identifier: asset.identifier, name: asset.name, brand: asset.brand || '', model: asset.model || '', year: asset.year?.toString() || '', ownerName: asset.ownerName || '', operatorName: asset.operatorName || '', status: asset.status, notes: asset.notes || '' });
    setOpen(true);
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      await saveAsset({ id: editingId, projectKey: project.id, contractorKey: form.contractorKey, serviceKey: form.serviceKey || undefined, type: form.type, identifier: form.identifier, name: form.name, brand: form.brand || undefined, model: form.model || undefined, year: form.year ? Number(form.year) : undefined, ownerName: form.ownerName || undefined, operatorName: form.operatorName || undefined, status: form.status, accessAllowed: form.status === 'habilitado', notes: form.notes || undefined, nextExpiry: undefined });
      setOpen(false); await load(); showToast(editingId ? 'Activo actualizado.' : 'Activo registrado correctamente.');
    } catch (error) { console.error(error); showToast(error instanceof Error ? error.message : 'No fue posible guardar el activo.', 'error'); }
    finally { setSaving(false); }
  };
  const openDocuments = async (asset:OperationalAsset) => { setDocumentAsset(asset); setDocuments(await listAssetDocuments(asset.id)); };
  const submitDocument = async (event:FormEvent) => { event.preventDefault(); if(!documentAsset||!documentFile||saving)return; setSaving(true); try{await uploadAssetDocument(documentAsset.id,documentType,documentFile,undefined,documentExpiry||undefined);setDocuments(await listAssetDocuments(documentAsset.id));setDocumentFile(undefined);setDocumentExpiry('');await load();showToast('Documento enviado a revisión.');}catch(error){showToast(error instanceof Error?error.message:'No fue posible subir el documento.','error');}finally{setSaving(false);} };
  const review = async (document:AssetDocument,status:'aprobado'|'rechazado') => { const reason=status==='rechazado'?window.prompt('Motivo del rechazo:')||'':undefined;if(status==='rechazado'&&!reason)return;await reviewAssetDocument(document.id,status,reason);if(documentAsset)setDocuments(await listAssetDocuments(documentAsset.id));await load();showToast(status==='aprobado'?'Documento aprobado.':'Documento rechazado.'); };
  const viewDocument = async (document:AssetDocument) => { try { await openAssetDocument(document); } catch(error) { showToast(error instanceof Error?error.message:'No fue posible abrir el documento.','error'); } };

  const enabled = assets.filter(item => item.status === 'habilitado').length;
  const blocked = assets.filter(item => item.status === 'bloqueado' || item.blockingDocuments > 0).length;
  return <article className="mandante-proyectos-section-card mandante-proyectos-panel">
    <div className="mandante-proyectos-section-head"><div><h2>Vehículos, maquinaria y equipos</h2><p>Registro operacional vinculado al contratista y al servicio correspondiente.</p></div><div className="flex gap-2"><button type="button" onClick={() => void load()} aria-label="Actualizar activos"><RefreshCw /></button><button type="button" onClick={startCreate} disabled={contractors.length === 0}><Plus /> Nuevo activo</button></div></div>
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 my-4"><div className="rounded-lg border p-4"><small>Total registrados</small><strong className="block text-2xl text-navy">{assets.length}</strong></div><div className="rounded-lg border p-4"><small>Habilitados</small><strong className="block text-2xl text-green-700">{enabled}</strong></div><div className="rounded-lg border p-4"><small>Bloqueados</small><strong className="block text-2xl text-red-700">{blocked}</strong></div></div>
    <div className="mandante-proyectos-table-wrap"><table><thead><tr><th>Tipo</th><th>Identificación</th><th>Contratista / servicio</th><th>Documentos</th><th>Acceso</th><th>Estado</th><th></th></tr></thead><tbody>{assets.map(asset => <tr key={asset.id}><td>{asset.type === 'vehiculo' ? <span className="inline-flex gap-2"><CarFront />Vehículo</span> : <span className="inline-flex gap-2"><Construction />{asset.type === 'maquinaria' ? 'Maquinaria' : 'Equipo'}</span>}</td><td><strong>{asset.identifier}</strong><small>{asset.name}{asset.brand ? ` · ${asset.brand} ${asset.model || ''}` : ''}</small></td><td>{contractorNames.get(asset.contractorKey) || asset.contractorKey}<small>{services.find(item => item.id === asset.serviceKey)?.nombre || 'Sin servicio asignado'}</small></td><td><button type="button" onClick={() => void openDocuments(asset)}><FileText /> {asset.approvedDocuments}/{asset.totalDocuments} aprobados</button>{asset.blockingDocuments > 0 && <small className="text-red-700">{asset.blockingDocuments} con bloqueo</small>}</td><td>{asset.accessAllowed ? <span className="inline-flex gap-1 text-green-700"><CircleCheckBig />Permitido</span> : <span className="inline-flex gap-1 text-red-700"><CircleAlert />No habilitado</span>}</td><td><b className={`mandante-proyectos-badge ${asset.status === 'habilitado' ? 'green' : asset.status === 'bloqueado' ? 'red' : 'yellow'}`}>{statusLabel[asset.status]}</b></td><td><button type="button" onClick={() => startEdit(asset)}>Editar</button></td></tr>)}</tbody></table></div>
    {!loading && assets.length === 0 && <div className="mandante-proyectos-empty"><Construction /> No hay vehículos, maquinaria o equipos registrados.</div>}
    {loading && <div className="mandante-proyectos-empty">Cargando activos operacionales…</div>}
    {open && <div className="fixed inset-0 bg-black/50 z-[600] flex items-center justify-center p-4" onClick={() => !saving && setOpen(false)}><form onSubmit={submit} className="bg-white rounded-xl shadow-xl w-full max-w-[700px] max-h-[calc(100vh-24px)] overflow-y-auto" onClick={event => event.stopPropagation()}><header className="flex justify-between items-start p-5 border-b"><div><h3 className="font-semibold text-navy text-lg">{editingId ? 'Editar activo' : 'Registrar activo operacional'}</h3><p className="text-xs text-gray-500">{project.nombre}</p></div><button type="button" onClick={() => setOpen(false)} aria-label="Cerrar"><X /></button></header><div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
      {!contractorKey && <label className="sm:col-span-2 text-sm">Contratista<select required value={form.contractorKey} onChange={e => setForm({ ...form, contractorKey: e.target.value, serviceKey: '' })} className="form-input w-full mt-1 p-2.5 border rounded-lg"><option value="">Seleccionar</option>{contractors.map(item => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select></label>}
      <label className="text-sm">Tipo<select value={form.type} onChange={e => setForm({ ...form, type: e.target.value as AssetType })} className="form-input w-full mt-1 p-2.5 border rounded-lg"><option value="vehiculo">Vehículo</option><option value="maquinaria">Maquinaria</option><option value="equipo">Equipo</option></select></label>
      <label className="text-sm">Identificación<input required value={form.identifier} onChange={e => setForm({ ...form, identifier: e.target.value })} className="form-input w-full mt-1 p-2.5 border rounded-lg" placeholder="Patente, serie o código" /></label>
      <label className="sm:col-span-2 text-sm">Nombre o descripción<input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="form-input w-full mt-1 p-2.5 border rounded-lg" /></label>
      <label className="text-sm">Marca<input value={form.brand} onChange={e => setForm({ ...form, brand: e.target.value })} className="form-input w-full mt-1 p-2.5 border rounded-lg" /></label><label className="text-sm">Modelo<input value={form.model} onChange={e => setForm({ ...form, model: e.target.value })} className="form-input w-full mt-1 p-2.5 border rounded-lg" /></label>
      <label className="text-sm">Año<input type="number" min="1900" max="2100" value={form.year} onChange={e => setForm({ ...form, year: e.target.value })} className="form-input w-full mt-1 p-2.5 border rounded-lg" /></label><label className="text-sm">Servicio<select value={form.serviceKey} onChange={e => setForm({ ...form, serviceKey: e.target.value })} className="form-input w-full mt-1 p-2.5 border rounded-lg"><option value="">Sin servicio</option>{services.filter(item => item.contratistaId === form.contractorKey).map(item => <option key={item.id} value={item.id}>{item.codigo} · {item.nombre}</option>)}</select></label>
      <label className="text-sm">Propietario<input value={form.ownerName} onChange={e => setForm({ ...form, ownerName: e.target.value })} className="form-input w-full mt-1 p-2.5 border rounded-lg" /></label><label className="text-sm">Operador responsable<input value={form.operatorName} onChange={e => setForm({ ...form, operatorName: e.target.value })} className="form-input w-full mt-1 p-2.5 border rounded-lg" /></label>
      <label className="text-sm">Estado<select disabled={Boolean(contractorKey)} value={form.status} onChange={e => setForm({ ...form, status: e.target.value as AssetStatus })} className="form-input w-full mt-1 p-2.5 border rounded-lg"><option value="pendiente">Pendiente</option><option value="en_revision">En revisión</option><option value="habilitado">Habilitado</option><option value="bloqueado">Bloqueado</option><option value="inactivo">Inactivo</option></select>{contractorKey && <small className="block mt-1 text-gray-500">El estado lo determina el mandante o Acredita.</small>}</label><label className="text-sm">Observaciones<input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} className="form-input w-full mt-1 p-2.5 border rounded-lg" /></label>
    </div><footer className="flex justify-end gap-2 p-5 border-t"><button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>Cancelar</button><button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Guardando…' : 'Guardar activo'}</button></footer></form></div>}
    {documentAsset && <div className="fixed inset-0 bg-black/50 z-[610] flex items-center justify-center p-4" onClick={()=>setDocumentAsset(undefined)}><div className="bg-white rounded-xl shadow-xl w-full max-w-[760px] max-h-[calc(100vh-24px)] overflow-y-auto" onClick={e=>e.stopPropagation()}><header className="flex justify-between p-5 border-b"><div><h3 className="font-semibold text-navy text-lg">Documentos · {documentAsset.identifier}</h3><p className="text-xs text-gray-500">Cada nueva carga conserva una versión.</p></div><button type="button" onClick={()=>setDocumentAsset(undefined)} aria-label="Cerrar"><X /></button></header><form onSubmit={submitDocument} className="p-5 grid grid-cols-1 sm:grid-cols-3 gap-3 border-b"><label className="text-sm">Tipo<input required value={documentType} onChange={e=>setDocumentType(e.target.value)} className="form-input w-full mt-1 p-2 border rounded" /></label><label className="text-sm">Vencimiento<input type="date" value={documentExpiry} onChange={e=>setDocumentExpiry(e.target.value)} className="form-input w-full mt-1 p-2 border rounded" /></label><label className="text-sm">Archivo<input required type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={e=>setDocumentFile(e.target.files?.[0])} className="form-input w-full mt-1 p-2 border rounded" /></label><button type="submit" disabled={saving||!documentFile} className="btn btn-primary sm:col-span-3"><Upload /> Enviar a revisión</button></form><div className="p-5 space-y-2">{documents.map(doc=><div key={doc.id} className="border rounded-lg p-3 flex items-center justify-between gap-3"><div><strong>{doc.type}</strong><small className="block text-gray-500">{doc.name||'Sin archivo'} · {doc.expiresAt?`Vence ${doc.expiresAt}`:'Sin vencimiento'} · {doc.status}</small>{doc.rejectionReason&&<small className="block text-red-700">{doc.rejectionReason}</small>}</div><div className="flex gap-2"><button type="button" onClick={()=>void viewDocument(doc)}><FileText /> Ver</button>{!contractorKey&&<><button type="button" onClick={()=>void review(doc,'aprobado')} aria-label="Aprobar"><Check /></button><button type="button" onClick={()=>void review(doc,'rechazado')} aria-label="Rechazar"><XCircle /></button></>}</div></div>)}{documents.length===0&&<p className="text-sm text-gray-500">Todavía no hay documentos.</p>}</div></div></div>}
  </article>;
}
