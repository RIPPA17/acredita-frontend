import { useEffect, useState, type FormEvent } from 'react';
import { Archive, Plus, RefreshCw } from 'lucide-react';
import {
  retireAssetRequirementTemplate,
  listAssetRequirementTemplates,
  saveAssetRequirementTemplate,
  type AssetRequirementTemplate,
  type AssetType,
} from '../data/supabaseAssets';

const typeLabel: Record<AssetType, string> = { vehiculo: 'Vehículo', maquinaria: 'Maquinaria', equipo: 'Equipo' };

export default function AssetMatrixPanel({
  projectKey,
  showToast,
  onChanged,
}: {
  projectKey: string;
  showToast: (message: string, type?: 'success' | 'error' | 'warning') => void;
  onChanged?: () => void;
}) {
  const [items, setItems] = useState<AssetRequirementTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    type: 'vehiculo' as AssetType,
    documentType: '',
    validityDays: '',
    checklist: '',
    required: true,
    blocksAccess: true,
  });

  const load = async () => {
    setLoading(true);
    try { setItems(await listAssetRequirementTemplates(projectKey)); }
    catch (error) { showToast(error instanceof Error ? error.message : 'No fue posible cargar la matriz de activos.', 'error'); }
    finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, [projectKey]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (saving || !form.documentType.trim()) return;
    setSaving(true);
    try {
      await saveAssetRequirementTemplate(projectKey, {
        type: form.type,
        documentType: form.documentType.trim(),
        validityDays: form.validityDays ? Number(form.validityDays) : undefined,
        blocksAccess: form.required && form.blocksAccess,
        required: form.required,
        checklist: form.checklist.split('\n').map(value => value.trim()).filter(Boolean),
      });
      setForm(value => ({ ...value, documentType: '', validityDays: '', checklist: '' }));
      await load();
      onChanged?.();
      showToast('Requisito de activo agregado. La habilitación se recalculó automáticamente.');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'No fue posible guardar el requisito.', 'error');
    } finally { setSaving(false); }
  };

  const retire = async (item: AssetRequirementTemplate) => {
    const reason = window.prompt(`Motivo para retirar “${item.documentType}” de la matriz de ${typeLabel[item.type].toLowerCase()}:`);
    if (!reason?.trim()) return;
    try {
      await retireAssetRequirementTemplate(item.id, reason);
      await load();
      onChanged?.();
      showToast('Requisito retirado. Se conserva como histórico y los activos fueron recalculados.', 'warning');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'No fue posible retirar el requisito.', 'error');
    }
  };

  return (
    <section className="border rounded-xl p-4 my-4">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="font-semibold text-navy">Matriz documental de activos</h3>
          <p className="text-sm text-gray-500">Define documentos por tipo, su vigencia y si bloquean acceso. Los requisitos retirados se conservan como historial.</p>
        </div>
        <button type="button" onClick={() => void load()} aria-label="Actualizar matriz"><RefreshCw /></button>
      </div>

      <form onSubmit={submit} className="grid grid-cols-1 sm:grid-cols-4 gap-3 mb-4">
        <label className="text-sm">Tipo
          <select value={form.type} onChange={event => setForm({ ...form, type: event.target.value as AssetType })} className="form-input w-full mt-1 p-2 border rounded-lg">
            <option value="vehiculo">Vehículo</option><option value="maquinaria">Maquinaria</option><option value="equipo">Equipo</option>
          </select>
        </label>
        <label className="text-sm sm:col-span-2">Documento obligatorio
          <input required value={form.documentType} onChange={event => setForm({ ...form, documentType: event.target.value })} className="form-input w-full mt-1 p-2 border rounded-lg" placeholder="Ej.: Revisión técnica" />
        </label>
        <label className="text-sm">Vigencia (días)
          <input type="number" min="1" value={form.validityDays} onChange={event => setForm({ ...form, validityDays: event.target.value })} className="form-input w-full mt-1 p-2 border rounded-lg" placeholder="Opcional" />
        </label>
        <div className="sm:col-span-4 flex flex-wrap gap-4 rounded-lg border p-3">
          <label className="inline-flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.required} onChange={event => setForm({ ...form, required: event.target.checked, blocksAccess: event.target.checked ? form.blocksAccess : false })} />
            Requisito obligatorio
          </label>
          <label className="inline-flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.blocksAccess} disabled={!form.required} onChange={event => setForm({ ...form, blocksAccess: event.target.checked })} />
            Bloquea acceso si no cumple
          </label>
        </div>
        <label className="text-sm sm:col-span-4">Criterios de revisión, uno por línea
          <textarea value={form.checklist} onChange={event => setForm({ ...form, checklist: event.target.value })} className="form-input w-full mt-1 p-2 border rounded-lg" rows={2} placeholder="Patente coincide con el activo\nDocumento legible y vigente" />
        </label>
        <button type="submit" className="btn btn-primary sm:col-span-4" disabled={saving}><Plus /> {saving ? 'Guardando…' : 'Agregar requisito'}</button>
      </form>

      {loading ? <p className="text-sm text-gray-500">Cargando matriz…</p> : items.length === 0 ? (
        <div className="rounded-lg border p-4 text-sm text-gray-600">Aún no hay matriz configurada. Mientras no existan requisitos obligatorios, ningún activo puede habilitar acceso automáticamente.</div>
      ) : (
        <div className="mandante-proyectos-table-wrap"><table><thead><tr><th>Tipo</th><th>Documento</th><th>Vigencia</th><th>Criterios</th><th>Estado</th><th></th></tr></thead><tbody>
          {items.map(item => <tr key={item.id}><td>{typeLabel[item.type]}</td><td><strong>{item.documentType}</strong><small className="block text-gray-500">Obligatorio · bloquea acceso</small></td><td>{item.validityDays ? `${item.validityDays} días` : 'Sin plazo fijo'}</td><td>{item.checklist.length ? item.checklist.join(' · ') : 'Sin checklist adicional'}</td><td>{item.active ? <strong className="text-green-700">Activo</strong> : <span className="text-gray-500">Histórico{item.retiredAt ? ` · ${item.retiredAt.slice(0, 10)}` : ''}{item.retirementReason ? <small className="block">{item.retirementReason}</small> : null}</span>}</td><td>{item.active && <button type="button" onClick={() => void retire(item)} aria-label="Retirar requisito" title="Retirar requisito"><Archive /></button>}</td></tr>)}
        </tbody></table></div>
      )}
    </section>
  );
}
