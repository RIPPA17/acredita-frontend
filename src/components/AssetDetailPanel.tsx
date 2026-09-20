import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Check, ClipboardCheck, FileText, Plus, RefreshCw, Upload, UserRound, Wrench, X, XCircle } from 'lucide-react';
import {
  assignAssetOperator,
  createAssetInspection,
  createAssetMaintenance,
  listAssetDocuments,
  listAssetInspections,
  listAssetMaintenance,
  listAssetOperators,
  listAssetRequirementStatuses,
  listOperatorCandidates,
  openAssetDocument,
  reviewAssetDocument,
  updateAssetOperatorStatus,
  uploadAssetDocument,
  type AssetDocument,
  type AssetInspection,
  type AssetMaintenanceRecord,
  type AssetOperatorAssignment,
  type AssetOperatorCandidate,
  type AssetRequirementStatus,
  type OperationalAsset,
} from '../data/supabaseAssets';

const statusLabel: Record<string, string> = {
  pendiente: 'Pendiente', en_revision: 'En revisión', aprobado: 'Aprobado', rechazado: 'Rechazado', vencido: 'Vencido',
};

export default function AssetDetailPanel({
  asset,
  projectKey,
  contractorMode,
  readOnly = false,
  onClose,
  onChanged,
  showToast,
}: {
  asset: OperationalAsset;
  projectKey: string;
  contractorMode: boolean;
  readOnly?: boolean;
  onClose: () => void;
  onChanged: () => void;
  showToast: (message: string, type?: 'success' | 'error' | 'warning') => void;
}) {
  const [requirements, setRequirements] = useState<AssetRequirementStatus[]>([]);
  const [documents, setDocuments] = useState<AssetDocument[]>([]);
  const [inspections, setInspections] = useState<AssetInspection[]>([]);
  const [maintenance, setMaintenance] = useState<AssetMaintenanceRecord[]>([]);
  const [operators, setOperators] = useState<AssetOperatorAssignment[]>([]);
  const [candidates, setCandidates] = useState<AssetOperatorCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [requirementId, setRequirementId] = useState('');
  const [file, setFile] = useState<File>();
  const [issuedAt, setIssuedAt] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [inspection, setInspection] = useState({ result: 'aprobado' as AssetInspection['result'], observations: '', next: '' });
  const [maintenanceForm, setMaintenanceForm] = useState({ type: '', date: new Date().toISOString().slice(0, 10), next: '', provider: '', notes: '' });
  const [operatorForm, setOperatorForm] = useState({ workerAssignmentId: '', validFrom: new Date().toISOString().slice(0, 10), validUntil: '' });

  const documentMap = useMemo(() => new Map(documents.map(item => [item.id, item])), [documents]);
  const selectedRequirement = requirements.find(item => item.id === requirementId);

  const load = async () => {
    setLoading(true);
    try {
      const [nextRequirements, nextDocuments, nextInspections, nextMaintenance, nextOperators, nextCandidates] = await Promise.all([
        listAssetRequirementStatuses(asset.id),
        listAssetDocuments(asset.id),
        listAssetInspections(asset.id),
        listAssetMaintenance(asset.id),
        listAssetOperators(asset.id),
        listOperatorCandidates(projectKey, asset.contractorKey),
      ]);
      setRequirements(nextRequirements);
      setDocuments(nextDocuments);
      setInspections(nextInspections);
      setMaintenance(nextMaintenance);
      setOperators(nextOperators);
      setCandidates(nextCandidates);
      setRequirementId(current => current || nextRequirements[0]?.id || '');
      setOperatorForm(current => ({ ...current, workerAssignmentId: current.workerAssignmentId || nextCandidates[0]?.workerAssignmentId || '' }));
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'No fue posible cargar el detalle operacional.', 'error');
    } finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, [asset.id, projectKey]);

  const changeRequirement = (id: string) => {
    setRequirementId(id);
    const requirement = requirements.find(item => item.id === id);
    if (requirement?.validityDays && issuedAt) {
      const date = new Date(`${issuedAt}T12:00:00Z`);
      date.setUTCDate(date.getUTCDate() + requirement.validityDays);
      setExpiresAt(date.toISOString().slice(0, 10));
    }
  };

  const changeIssuedAt = (value: string) => {
    setIssuedAt(value);
    if (selectedRequirement?.validityDays && value) {
      const date = new Date(`${value}T12:00:00Z`);
      date.setUTCDate(date.getUTCDate() + selectedRequirement.validityDays);
      setExpiresAt(date.toISOString().slice(0, 10));
    }
  };

  const submitDocument = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedRequirement || !file || saving || readOnly) return;
    setSaving(true);
    try {
      await uploadAssetDocument(asset.id, selectedRequirement.documentType, file, issuedAt || undefined, expiresAt || undefined);
      setFile(undefined); setIssuedAt(''); setExpiresAt('');
      await load(); onChanged();
      showToast('Documento enviado a revisión. El acceso se recalculará al aprobarse.');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'No fue posible subir el documento.', 'error');
    } finally { setSaving(false); }
  };

  const review = async (documentId: string, status: 'aprobado' | 'rechazado') => {
    const reason = status === 'rechazado' ? window.prompt('Motivo del rechazo:') || '' : undefined;
    if (status === 'rechazado' && !reason) return;
    try {
      await reviewAssetDocument(documentId, status, reason);
      await load(); onChanged();
      showToast(status === 'aprobado' ? 'Documento aprobado. Estado del activo recalculado.' : 'Documento rechazado. El activo quedó sin acceso.');
    } catch (error) { showToast(error instanceof Error ? error.message : 'No fue posible revisar el documento.', 'error'); }
  };

  const view = async (documentId?: string) => {
    const document = documentId ? documentMap.get(documentId) : undefined;
    if (!document) return;
    try { await openAssetDocument(document); }
    catch (error) { showToast(error instanceof Error ? error.message : 'No fue posible abrir el documento.', 'error'); }
  };

  const submitInspection = async (event: FormEvent) => {
    event.preventDefault(); if (saving || readOnly) return; setSaving(true);
    try {
      await createAssetInspection(asset.id, { result: inspection.result, observations: inspection.observations || undefined, nextInspectionDate: inspection.next || undefined });
      setInspection({ result: 'aprobado', observations: '', next: '' }); await load();
      showToast('Inspección registrada.');
    } catch (error) { showToast(error instanceof Error ? error.message : 'No fue posible registrar la inspección.', 'error'); }
    finally { setSaving(false); }
  };

  const submitMaintenance = async (event: FormEvent) => {
    event.preventDefault(); if (!maintenanceForm.type.trim() || saving || readOnly) return; setSaving(true);
    try {
      await createAssetMaintenance(asset.id, { type: maintenanceForm.type, performedAt: maintenanceForm.date, nextDueAt: maintenanceForm.next || undefined, provider: maintenanceForm.provider || undefined, notes: maintenanceForm.notes || undefined });
      setMaintenanceForm({ type: '', date: new Date().toISOString().slice(0, 10), next: '', provider: '', notes: '' }); await load();
      showToast('Mantención registrada.');
    } catch (error) { showToast(error instanceof Error ? error.message : 'No fue posible registrar la mantención.', 'error'); }
    finally { setSaving(false); }
  };

  const submitOperator = async (event: FormEvent) => {
    event.preventDefault(); if (!operatorForm.workerAssignmentId || saving || readOnly) return; setSaving(true);
    try {
      await assignAssetOperator(asset.id, operatorForm.workerAssignmentId, operatorForm.validFrom, operatorForm.validUntil || undefined);
      await load(); showToast('Operador asignado al activo.');
    } catch (error) { showToast(error instanceof Error ? error.message : 'No fue posible asignar el operador.', 'error'); }
    finally { setSaving(false); }
  };

  const changeOperatorStatus = async (id: string, status: AssetOperatorAssignment['status']) => {
    if (readOnly) return;
    try { await updateAssetOperatorStatus(id, status); await load(); showToast('Asignación de operador actualizada.'); }
    catch (error) { showToast(error instanceof Error ? error.message : 'No fue posible actualizar el operador.', 'error'); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-[610] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-[980px] max-h-[calc(100vh-24px)] overflow-y-auto" onClick={event => event.stopPropagation()}>
        <header className="flex justify-between items-start p-5 border-b">
          <div><h3 className="font-semibold text-navy text-lg">{readOnly ? 'Historial del activo' : 'Gestión operacional'} · {asset.identifier}</h3><p className="text-xs text-gray-500">{asset.name} · Estado registrado: {asset.status} · Acceso {readOnly ? 'histórico' : asset.accessAllowed ? 'habilitado' : 'no habilitado'}</p></div>
          <div className="flex gap-2"><button type="button" onClick={() => void load()} aria-label="Actualizar"><RefreshCw /></button><button type="button" onClick={onClose} aria-label="Cerrar"><X /></button></div>
        </header>

        {loading ? <div className="p-6 text-sm text-gray-500">Cargando gestión operacional…</div> : <div className="p-5 space-y-6">
          {readOnly && <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-800"><strong>Modo consulta.</strong> Puedes revisar documentos, inspecciones, mantenciones y operadores registrados, pero no modificar el activo ni agregar nuevos antecedentes.</div>}
          <section>
            <div className="flex items-center gap-2 mb-3"><FileText /><div><h4 className="font-semibold text-navy">Matriz documental</h4><p className="text-sm text-gray-500">Todos los obligatorios deben estar aprobados y vigentes para habilitar acceso.</p></div></div>
            {requirements.length === 0 ? <div className="rounded-lg border p-4 text-sm text-gray-600">El Mandante todavía no configuró requisitos para este tipo de activo. El acceso permanece pendiente.</div> : <>
              <div className="space-y-2 mb-4">{requirements.map(item => <div key={item.id} className="border rounded-lg p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3"><div><strong>{item.documentType}</strong><small className="block text-gray-500">{item.required ? 'Obligatorio' : 'Opcional'}{item.validityDays ? ` · Vigencia ${item.validityDays} días` : ''} · {statusLabel[item.status] || item.status}</small>{item.rejectionReason && <small className="block text-red-700">{item.rejectionReason}</small>}{item.checklist.length > 0 && <small className="block text-gray-500">Revisar: {item.checklist.join(' · ')}</small>}</div><div className="flex gap-2 items-center">{item.satisfied ? <span className="text-green-700"><Check /> Cumple</span> : <span className="text-red-700">No cumple</span>}{item.documentId && <><button type="button" onClick={() => void view(item.documentId)}><FileText /> Ver</button>{!contractorMode && <><button type="button" onClick={() => void review(item.documentId!, 'aprobado')} aria-label="Aprobar"><Check /></button><button type="button" onClick={() => void review(item.documentId!, 'rechazado')} aria-label="Rechazar"><XCircle /></button></>}</>}</div></div>)}</div>
              {!readOnly && <form onSubmit={submitDocument} className="grid grid-cols-1 sm:grid-cols-4 gap-3 border rounded-xl p-4">
                <label className="text-sm sm:col-span-2">Requisito<select required value={requirementId} onChange={event => changeRequirement(event.target.value)} className="form-input w-full mt-1 p-2 border rounded-lg">{requirements.map(item => <option key={item.id} value={item.id}>{item.documentType} · {statusLabel[item.status] || item.status}</option>)}</select></label>
                <label className="text-sm">Emisión<input type="date" value={issuedAt} onChange={event => changeIssuedAt(event.target.value)} className="form-input w-full mt-1 p-2 border rounded-lg" /></label>
                <label className="text-sm">Vencimiento<input type="date" value={expiresAt} onChange={event => setExpiresAt(event.target.value)} className="form-input w-full mt-1 p-2 border rounded-lg" /></label>
                <label className="text-sm sm:col-span-3">Archivo<input required type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={event => setFile(event.target.files?.[0])} className="form-input w-full mt-1 p-2 border rounded-lg" /></label>
                <button type="submit" disabled={saving || !file} className="btn btn-primary"><Upload /> Enviar a revisión</button>
              </form>}
            </>}
          </section>

          <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="border rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3"><ClipboardCheck /><h4 className="font-semibold text-navy">Inspecciones</h4></div>
              {!contractorMode && !readOnly && <form onSubmit={submitInspection} className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3"><select value={inspection.result} onChange={event => setInspection({ ...inspection, result: event.target.value as AssetInspection['result'] })} className="form-input p-2 border rounded"><option value="aprobado">Aprobado</option><option value="observado">Observado</option><option value="rechazado">Rechazado</option></select><input type="date" value={inspection.next} onChange={event => setInspection({ ...inspection, next: event.target.value })} className="form-input p-2 border rounded" aria-label="Próxima inspección" /><textarea value={inspection.observations} onChange={event => setInspection({ ...inspection, observations: event.target.value })} className="form-input p-2 border rounded sm:col-span-2" placeholder="Observaciones" /><button className="btn btn-primary sm:col-span-2" disabled={saving}><Plus /> Registrar inspección</button></form>}
              <div className="space-y-2">{inspections.slice(0, 6).map(item => <div key={item.id} className="border rounded-lg p-2 text-sm"><strong>{item.inspectionDate} · {item.result}</strong>{item.nextInspectionDate && <span className="block text-gray-500">Próxima: {item.nextInspectionDate}</span>}{item.observations && <span className="block text-gray-500">{item.observations}</span>}</div>)}{inspections.length === 0 && <p className="text-sm text-gray-500">Sin inspecciones registradas.</p>}</div>
            </div>

            <div className="border rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3"><Wrench /><h4 className="font-semibold text-navy">Mantenciones</h4></div>
              {!readOnly && <form onSubmit={submitMaintenance} className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3"><input required value={maintenanceForm.type} onChange={event => setMaintenanceForm({ ...maintenanceForm, type: event.target.value })} className="form-input p-2 border rounded" placeholder="Tipo de mantención" /><input type="date" required value={maintenanceForm.date} onChange={event => setMaintenanceForm({ ...maintenanceForm, date: event.target.value })} className="form-input p-2 border rounded" /><input value={maintenanceForm.provider} onChange={event => setMaintenanceForm({ ...maintenanceForm, provider: event.target.value })} className="form-input p-2 border rounded" placeholder="Proveedor" /><input type="date" value={maintenanceForm.next} onChange={event => setMaintenanceForm({ ...maintenanceForm, next: event.target.value })} className="form-input p-2 border rounded" aria-label="Próxima mantención" /><textarea value={maintenanceForm.notes} onChange={event => setMaintenanceForm({ ...maintenanceForm, notes: event.target.value })} className="form-input p-2 border rounded sm:col-span-2" placeholder="Notas" /><button className="btn btn-primary sm:col-span-2" disabled={saving}><Plus /> Registrar mantención</button></form>}
              <div className="space-y-2">{maintenance.slice(0, 6).map(item => <div key={item.id} className="border rounded-lg p-2 text-sm"><strong>{item.performedAt} · {item.type}</strong>{item.provider && <span className="block text-gray-500">{item.provider}</span>}{item.nextDueAt && <span className="block text-gray-500">Próxima: {item.nextDueAt}</span>}</div>)}{maintenance.length === 0 && <p className="text-sm text-gray-500">Sin mantenciones registradas.</p>}</div>
            </div>
          </section>

          <section className="border rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3"><UserRound /><div><h4 className="font-semibold text-navy">Operadores asignados</h4><p className="text-sm text-gray-500">Solo trabajadores de la misma acreditación pueden vincularse al activo.</p></div></div>
            {!readOnly && candidates.length > 0 && <form onSubmit={submitOperator} className="grid grid-cols-1 sm:grid-cols-4 gap-2 mb-4"><select required value={operatorForm.workerAssignmentId} onChange={event => setOperatorForm({ ...operatorForm, workerAssignmentId: event.target.value })} className="form-input p-2 border rounded sm:col-span-2">{candidates.map(item => <option key={item.workerAssignmentId} value={item.workerAssignmentId}>{item.fullName} · {item.rut} · {item.accessStatus}</option>)}</select><input type="date" required value={operatorForm.validFrom} onChange={event => setOperatorForm({ ...operatorForm, validFrom: event.target.value })} className="form-input p-2 border rounded" /><input type="date" value={operatorForm.validUntil} onChange={event => setOperatorForm({ ...operatorForm, validUntil: event.target.value })} className="form-input p-2 border rounded" /><button className="btn btn-primary sm:col-span-4" disabled={saving}><Plus /> Asignar operador</button></form>}
            <div className="mandante-proyectos-table-wrap"><table><thead><tr><th>Trabajador</th><th>Vigencia</th><th>Estado</th><th></th></tr></thead><tbody>{operators.map(item => <tr key={item.id}><td><strong>{item.fullName}</strong><small>{item.rut}{item.jobTitle ? ` · ${item.jobTitle}` : ''}</small></td><td>{item.validFrom} — {item.validUntil || 'Sin término'}</td><td>{item.status}</td><td>{!readOnly && item.status === 'activo' && <button type="button" onClick={() => void changeOperatorStatus(item.id, 'finalizado')}>Finalizar</button>}</td></tr>)}</tbody></table></div>
            {operators.length === 0 && <p className="text-sm text-gray-500 mt-2">Sin operadores asignados.</p>}
          </section>
        </div>}
      </div>
    </div>
  );
}
