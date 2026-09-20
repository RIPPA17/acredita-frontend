import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Archive, CarFront, CircleAlert, CircleCheckBig, Construction, Plus, RefreshCw, X } from 'lucide-react';
import type { Contratista, Proyecto, ServicioContrato } from '../types';
import { listAssets, retireAsset, saveAsset, type AssetType, type OperationalAsset } from '../data/supabaseAssets';
import AssetMatrixPanel from './AssetMatrixPanel';
import AssetDetailPanel from './AssetDetailPanel';
import DocumentLibraryPanel from './DocumentLibraryPanel';

type FormState = {
  contractorKey: string;
  serviceKey: string;
  type: AssetType;
  identifier: string;
  name: string;
  brand: string;
  model: string;
  year: string;
  ownerName: string;
  operatorName: string;
  notes: string;
};

const emptyForm: FormState = {
  contractorKey: '', serviceKey: '', type: 'vehiculo', identifier: '', name: '', brand: '', model: '', year: '', ownerName: '', operatorName: '', notes: '',
};
const statusLabel: Record<OperationalAsset['status'], string> = {
  pendiente: 'Pendiente', en_revision: 'En revisión', habilitado: 'Habilitado', bloqueado: 'Bloqueado', inactivo: 'Inactivo',
};

export default function AssetsPanel({
  project,
  contractors,
  services,
  contractorKey,
  readOnly = false,
  showToast,
}: {
  project: Proyecto;
  contractors: Contratista[];
  services: ServicioContrato[];
  contractorKey?: string;
  readOnly?: boolean;
  showToast: (message: string, type?: 'success' | 'error' | 'warning') => void;
}) {
  const [assets, setAssets] = useState<OperationalAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string>();
  const [selectedAsset, setSelectedAsset] = useState<OperationalAsset>();
  const [form, setForm] = useState<FormState>(emptyForm);
  const contractorNames = useMemo(() => new Map(contractors.map(item => [item.id, item.nombre])), [contractors]);

  const load = async () => {
    setLoading(true);
    try { setAssets(await listAssets(project.id, contractorKey, true)); }
    catch (error) { showToast(error instanceof Error ? error.message : 'No fue posible cargar vehículos y equipos.', 'error'); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, [project.id, contractorKey]);

  const startCreate = () => {
    if (readOnly) return;
    setEditingId(undefined);
    setForm({ ...emptyForm, contractorKey: contractorKey || contractors[0]?.id || '' });
    setOpen(true);
  };
  const startEdit = (asset: OperationalAsset) => {
    if (readOnly || !asset.isActive) return;
    setEditingId(asset.id);
    setForm({
      contractorKey: asset.contractorKey,
      serviceKey: asset.serviceKey || '',
      type: asset.type,
      identifier: asset.identifier,
      name: asset.name,
      brand: asset.brand || '',
      model: asset.model || '',
      year: asset.year?.toString() || '',
      ownerName: asset.ownerName || '',
      operatorName: asset.operatorName || '',
      notes: asset.notes || '',
    });
    setOpen(true);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (saving || readOnly) return;
    setSaving(true);
    try {
      await saveAsset({
        id: editingId,
        projectKey: project.id,
        contractorKey: form.contractorKey,
        serviceKey: form.serviceKey || undefined,
        type: form.type,
        identifier: form.identifier,
        name: form.name,
        brand: form.brand || undefined,
        model: form.model || undefined,
        year: form.year ? Number(form.year) : undefined,
        ownerName: form.ownerName || undefined,
        operatorName: form.operatorName || undefined,
        notes: form.notes || undefined,
      });
      setOpen(false);
      await load();
      showToast(editingId ? 'Activo actualizado. Su estado se mantiene gobernado por la matriz documental.' : 'Activo registrado. Quedará habilitado solo cuando cumpla toda la matriz documental.');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'No fue posible guardar el activo.', 'error');
    } finally { setSaving(false); }
  };

  const activeAssets = assets.filter(item => item.isActive);
  const enabled = activeAssets.filter(item => item.status === 'habilitado').length;
  const blocked = activeAssets.filter(item => item.status === 'bloqueado' || item.blockingDocuments > 0).length;
  const historical = assets.filter(item => !item.isActive).length;

  const retire = async (asset: OperationalAsset) => {
    if (readOnly || !asset.isActive) return;
    const reason = window.prompt(`Motivo para retirar ${asset.identifier} · ${asset.name}:`)?.trim();
    if (!reason) return;
    try {
      await retireAsset(asset.id, reason);
      setSelectedAsset(undefined);
      await load();
      showToast('Activo retirado. Se conserva todo su historial documental y operacional.', 'warning');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'No fue posible retirar el activo.', 'error');
    }
  };

  return <article className="mandante-proyectos-section-card mandante-proyectos-panel">
    <div className="mandante-proyectos-section-head"><div><h2>Vehículos, maquinaria y equipos</h2><p>{readOnly ? 'Historial de activos asociados a este proyecto. No se permiten nuevas cargas ni modificaciones.' : 'El acceso ahora se determina automáticamente por la matriz documental, vigencias, inspecciones y trazabilidad operacional.'}</p></div><div className="flex gap-2"><button type="button" onClick={() => void load()} aria-label="Actualizar activos"><RefreshCw /></button>{!readOnly && <button type="button" onClick={startCreate} disabled={contractors.length === 0}><Plus /> Nuevo activo</button>}</div></div>

    {readOnly && <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-800">Proyecto histórico · activos disponibles solo para consulta.</div>}

    {!contractorKey && <AssetMatrixPanel projectKey={project.id} showToast={showToast} onChanged={() => void load()} />}

    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 my-4"><div className="rounded-lg border p-4"><small>Activos vigentes</small><strong className="block text-2xl text-navy">{activeAssets.length}</strong></div><div className="rounded-lg border p-4"><small>Habilitados</small><strong className="block text-2xl text-green-700">{enabled}</strong></div><div className="rounded-lg border p-4"><small>Bloqueados</small><strong className="block text-2xl text-red-700">{blocked}</strong></div><div className="rounded-lg border p-4"><small>Históricos</small><strong className="block text-2xl text-gray-600">{historical}</strong></div></div>

    <div className="mandante-proyectos-table-wrap"><table><thead><tr><th>Tipo</th><th>Identificación</th><th>Contratista / servicio</th><th>Documentación</th><th>Acceso</th><th>Estado automático</th><th></th></tr></thead><tbody>{assets.map(asset => {
      const serviceName = services.find(item => item.id === asset.serviceKey)?.nombre || (asset.serviceKey ? 'Servicio histórico' : 'Sin servicio asignado');
      return <tr key={asset.id} className={!asset.isActive ? 'opacity-75' : undefined}><td>{asset.type === 'vehiculo' ? <span className="inline-flex gap-2"><CarFront />Vehículo</span> : <span className="inline-flex gap-2"><Construction />{asset.type === 'maquinaria' ? 'Maquinaria' : 'Equipo'}</span>}</td><td><strong>{asset.identifier}</strong><small className="block">{asset.name}{asset.brand ? ` · ${asset.brand} ${asset.model || ''}` : ''}</small>{!asset.isActive && <small className="block text-gray-500">Retirado{asset.retiredAt ? ` · ${new Date(asset.retiredAt).toLocaleDateString('es-CL')}` : ''}{asset.retirementReason ? ` · ${asset.retirementReason}` : ''}</small>}</td><td>{contractorNames.get(asset.contractorKey) || asset.contractorKey}<small className="block">{serviceName}</small>{asset.isActive && !asset.serviceOperational && asset.serviceId && <small className="block text-red-700">Servicio no operativo</small>}</td><td><span>{asset.approvedDocuments}/{asset.totalDocuments} obligatorios aprobados</span>{asset.pendingDocuments > 0 && <small className="block text-gray-500">{asset.pendingDocuments} requisito{asset.pendingDocuments === 1 ? '' : 's'} pendiente{asset.pendingDocuments === 1 ? '' : 's'}</small>}{asset.nextExpiry && <small className="block text-gray-500">Próximo vencimiento: {asset.nextExpiry}</small>}</td><td>{!asset.isActive ? <span className="inline-flex gap-1 text-gray-600"><Archive />Histórico</span> : asset.accessAllowed ? <span className="inline-flex gap-1 text-green-700"><CircleCheckBig />Permitido</span> : <span className="inline-flex gap-1 text-red-700"><CircleAlert />No habilitado</span>}</td><td><b className={`mandante-proyectos-badge ${asset.status === 'habilitado' ? 'green' : asset.status === 'bloqueado' ? 'red' : 'yellow'}`}>{statusLabel[asset.status]}</b>{asset.nextInspectionDate && <small className="block text-gray-500">Inspección: {asset.nextInspectionDate}</small>}{asset.nextMaintenanceDate && <small className="block text-gray-500">Mantención: {asset.nextMaintenanceDate}</small>}</td><td><div className="flex gap-2 flex-wrap"><button type="button" onClick={() => setSelectedAsset(asset)}>{readOnly || !asset.isActive ? 'Ver historial' : 'Gestionar'}</button>{!readOnly && asset.isActive && <button type="button" onClick={() => startEdit(asset)}>Editar ficha</button>}{!readOnly && asset.isActive && <button type="button" onClick={() => void retire(asset)}><Archive /> Retirar</button>}</div></td></tr>;
    })}</tbody></table></div>
    {!loading && assets.length === 0 && <div className="mandante-proyectos-empty"><Construction /> No hay vehículos, maquinaria o equipos registrados.</div>}
    {loading && <div className="mandante-proyectos-empty">Cargando activos operacionales…</div>}

    {contractorKey && !readOnly && <DocumentLibraryPanel projectKey={project.id} contractorKey={contractorKey} showToast={showToast} onChanged={() => void load()} />}

    {!readOnly && open && <div className="fixed inset-0 bg-black/50 z-[600] flex items-center justify-center p-4" onClick={() => !saving && setOpen(false)}><form onSubmit={submit} className="bg-white rounded-xl shadow-xl w-full max-w-[700px] max-h-[calc(100vh-24px)] overflow-y-auto" onClick={event => event.stopPropagation()}><header className="flex justify-between items-start p-5 border-b"><div><h3 className="font-semibold text-navy text-lg">{editingId ? 'Editar ficha del activo' : 'Registrar activo operacional'}</h3><p className="text-xs text-gray-500">El estado y el acceso no se editan manualmente: se calculan desde la matriz documental.</p></div><button type="button" onClick={() => setOpen(false)} aria-label="Cerrar"><X /></button></header><div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
      {!contractorKey && <label className="sm:col-span-2 text-sm">Contratista<select required value={form.contractorKey} onChange={event => setForm({ ...form, contractorKey: event.target.value, serviceKey: '' })} className="form-input w-full mt-1 p-2.5 border rounded-lg"><option value="">Seleccionar</option>{contractors.map(item => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select></label>}
      <label className="text-sm">Tipo<select value={form.type} onChange={event => setForm({ ...form, type: event.target.value as AssetType })} className="form-input w-full mt-1 p-2.5 border rounded-lg"><option value="vehiculo">Vehículo</option><option value="maquinaria">Maquinaria</option><option value="equipo">Equipo</option></select></label>
      <label className="text-sm">Identificación<input required value={form.identifier} onChange={event => setForm({ ...form, identifier: event.target.value })} className="form-input w-full mt-1 p-2.5 border rounded-lg" placeholder="Patente, serie o código" /></label>
      <label className="sm:col-span-2 text-sm">Nombre o descripción<input required value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} className="form-input w-full mt-1 p-2.5 border rounded-lg" /></label>
      <label className="text-sm">Marca<input value={form.brand} onChange={event => setForm({ ...form, brand: event.target.value })} className="form-input w-full mt-1 p-2.5 border rounded-lg" /></label><label className="text-sm">Modelo<input value={form.model} onChange={event => setForm({ ...form, model: event.target.value })} className="form-input w-full mt-1 p-2.5 border rounded-lg" /></label>
      <label className="text-sm">Año<input type="number" min="1900" max="2100" value={form.year} onChange={event => setForm({ ...form, year: event.target.value })} className="form-input w-full mt-1 p-2.5 border rounded-lg" /></label><label className="text-sm">Servicio<select value={form.serviceKey} onChange={event => setForm({ ...form, serviceKey: event.target.value })} className="form-input w-full mt-1 p-2.5 border rounded-lg"><option value="">Sin servicio</option>{services.filter(item => item.contratistaId === form.contractorKey).map(item => <option key={item.id} value={item.id}>{item.codigo} · {item.nombre}</option>)}</select></label>
      <label className="text-sm">Propietario<input value={form.ownerName} onChange={event => setForm({ ...form, ownerName: event.target.value })} className="form-input w-full mt-1 p-2.5 border rounded-lg" /></label><label className="text-sm">Responsable / referencia<input value={form.operatorName} onChange={event => setForm({ ...form, operatorName: event.target.value })} className="form-input w-full mt-1 p-2.5 border rounded-lg" /></label>
      <label className="sm:col-span-2 text-sm">Observaciones<textarea value={form.notes} onChange={event => setForm({ ...form, notes: event.target.value })} className="form-input w-full mt-1 p-2.5 border rounded-lg" /></label>
    </div><footer className="flex justify-end gap-2 p-5 border-t"><button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>Cancelar</button><button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Guardando…' : 'Guardar ficha'}</button></footer></form></div>}

    {selectedAsset && <AssetDetailPanel asset={selectedAsset} projectKey={project.id} contractorMode={Boolean(contractorKey)} readOnly={readOnly || !selectedAsset.isActive} onClose={() => setSelectedAsset(undefined)} onChanged={() => void load()} showToast={showToast} />}
  </article>;
}
