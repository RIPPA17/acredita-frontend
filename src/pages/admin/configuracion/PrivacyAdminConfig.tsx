import { FormEvent, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Database,
  Download,
  FileLock2,
  Plus,
  RefreshCw,
  ShieldAlert,
  UserRoundCheck,
} from 'lucide-react';
import {
  buildWorkerPortabilityExport,
  createLegalHold,
  createRetentionPolicy,
  createSecurityIncident,
  downloadJsonFile,
  loadPrivacyAdminSnapshot,
  releaseLegalHold,
  updatePrivacyRequest,
  updateRetentionPolicy,
  updateSecurityIncident,
  type IncidentSeverity,
  type IncidentStatus,
  type LegalHoldRow,
  type PrivacyAdminSnapshot,
  type PrivacyRequestRow,
  type RetentionAction,
  type RetentionPolicyRow,
  type SecurityIncidentRow,
} from '../../../data/supabasePrivacyAdmin';

type Section = 'resumen' | 'solicitudes' | 'incidentes' | 'retencion' | 'holds' | 'exportar';

type ToastFn = (msg: string, type?: 'success' | 'error' | 'warning') => void;

const EMPTY: PrivacyAdminSnapshot = { requests: [], incidents: [], retentionPolicies: [], legalHolds: [] };

const requestLabels: Record<PrivacyRequestRow['request_type'], string> = {
  access: 'Acceso',
  rectification: 'Rectificación',
  deletion: 'Supresión',
  opposition: 'Oposición',
  portability: 'Portabilidad',
  blocking: 'Bloqueo',
};

const requestStatusLabels: Record<PrivacyRequestRow['status'], string> = {
  received: 'Recibida',
  identity_verification: 'Verificando identidad',
  in_review: 'En revisión',
  blocked: 'Bloqueada temporalmente',
  resolved: 'Resuelta',
  rejected: 'Rechazada',
  withdrawn: 'Retirada',
};

const incidentStatusLabels: Record<IncidentStatus, string> = {
  detected: 'Detectado',
  investigating: 'Investigando',
  contained: 'Contenido',
  resolved: 'Resuelto',
  closed: 'Cerrado',
};

function fmt(value: string | null | undefined) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('es-CL', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'good' | 'warn' | 'bad' | 'info' }) {
  const tones = {
    neutral: 'bg-gray-100 text-gray-600',
    good: 'bg-green-100 text-green-700',
    warn: 'bg-amber-100 text-amber-700',
    bad: 'bg-red-100 text-red-700',
    info: 'bg-blue-100 text-blue-700',
  };
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${tones[tone]}`}>{children}</span>;
}

function Card({ title, value, subtitle, icon }: { title: string; value: string | number; subtitle: string; icon: ReactNode }) {
  return (
    <div className="rounded-xl border border-cream3 bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-[1px] text-gray-400">{title}</span>
        <span className="text-brown">{icon}</span>
      </div>
      <div className="text-2xl font-semibold text-navy">{value}</div>
      <div className="mt-1 text-[11.5px] text-gray-400">{subtitle}</div>
    </div>
  );
}

export default function PrivacyAdminConfig({ showToast }: { showToast: ToastFn }) {
  const [section, setSection] = useState<Section>('resumen');
  const [data, setData] = useState<PrivacyAdminSnapshot>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await loadPrivacyAdminSnapshot());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible cargar el centro de privacidad.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void refresh(); }, []);

  const openRequests = data.requests.filter(item => !['resolved', 'rejected', 'withdrawn'].includes(item.status));
  const overdueRequests = openRequests.filter(item => item.due_at && new Date(item.due_at).getTime() < Date.now());
  const openIncidents = data.incidents.filter(item => !['resolved', 'closed'].includes(item.status));
  const activeHolds = data.legalHolds.filter(item => item.active);

  const tabs: Array<{ id: Section; label: string }> = [
    { id: 'resumen', label: 'Resumen' },
    { id: 'solicitudes', label: `Solicitudes${openRequests.length ? ` (${openRequests.length})` : ''}` },
    { id: 'incidentes', label: `Incidentes${openIncidents.length ? ` (${openIncidents.length})` : ''}` },
    { id: 'retencion', label: 'Retención' },
    { id: 'holds', label: 'Legal holds' },
    { id: 'exportar', label: 'Exportar datos' },
  ];

  if (loading) return <div className="py-14 text-center text-[13px] text-gray-400">Cargando gobierno de privacidad desde Supabase…</div>;
  if (error) return (
    <div className="py-12 text-center">
      <p className="font-semibold text-red-700">No fue posible cargar privacidad.</p>
      <p className="mt-1 text-xs text-gray-400">{error}</p>
      <button type="button" className="btn btn-ghost mt-4" onClick={() => void refresh()}><RefreshCw size={15} /> Reintentar</button>
    </div>
  );

  return (
    <div>
      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-brown"><FileLock2 size={18} /><span className="text-[11px] font-semibold uppercase tracking-[1.5px]">Privacidad por diseño</span></div>
          <h3 className="mt-1 text-xl font-semibold text-navy">Centro de privacidad</h3>
          <p className="mt-1 max-w-[760px] text-[12.5px] leading-5 text-gray-500">Gestión operativa de derechos de titulares, incidentes, retención y bloqueos de conservación. Las eliminaciones automáticas permanecen desactivadas hasta aprobar las políticas de retención.</p>
        </div>
        <button type="button" disabled={busy} className="btn btn-ghost shrink-0" onClick={() => void refresh()}><RefreshCw size={15} /> Actualizar</button>
      </div>

      <div className="mb-5 flex gap-1 overflow-x-auto rounded-xl bg-cream2 p-1">
        {tabs.map(item => (
          <button key={item.id} type="button" onClick={() => setSection(item.id)} className={`whitespace-nowrap rounded-lg px-3 py-2 text-[12px] ${section === item.id ? 'bg-white font-semibold text-brown shadow-sm' : 'text-gray-500 hover:text-navy'}`}>{item.label}</button>
        ))}
      </div>

      {section === 'resumen' && (
        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Card title="Solicitudes abiertas" value={openRequests.length} subtitle={`${overdueRequests.length} fuera de plazo configurado`} icon={<UserRoundCheck size={18} />} />
            <Card title="Incidentes abiertos" value={openIncidents.length} subtitle="Detectados, investigando o contenidos" icon={<ShieldAlert size={18} />} />
            <Card title="Políticas" value={data.retentionPolicies.length} subtitle={`${data.retentionPolicies.filter(item => item.active).length} activas`} icon={<Database size={18} />} />
            <Card title="Legal holds" value={activeHolds.length} subtitle="Conservaciones que bloquean eliminación" icon={<FileLock2 size={18} />} />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-cream3 bg-white p-5">
              <h4 className="text-sm font-semibold text-navy">Controles antes de automatizar borrado</h4>
              <div className="mt-4 space-y-3 text-[12px] text-gray-600">
                <div className="flex gap-2"><CheckCircle2 size={16} className="mt-0.5 shrink-0 text-green-600" /><span>RLS activo y tablas de gobierno restringidas a personal Acredita.</span></div>
                <div className="flex gap-2"><CheckCircle2 size={16} className="mt-0.5 shrink-0 text-green-600" /><span>Legal hold disponible para impedir eliminación cuando exista una conservación justificada.</span></div>
                <div className="flex gap-2"><AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-600" /><span>Una política solo puede activarse cuando su revisión jurídica figure como aprobada.</span></div>
                <div className="flex gap-2"><AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-600" /><span>El motor de eliminación real aún no está habilitado; por diseño, primero debe operar en dry-run.</span></div>
              </div>
            </div>
            <div className="rounded-xl border border-cream3 bg-white p-5">
              <h4 className="text-sm font-semibold text-navy">Atención prioritaria</h4>
              <div className="mt-4 space-y-2">
                {overdueRequests.length === 0 && openIncidents.length === 0 ? <p className="text-[12px] text-gray-400">No hay alertas críticas en este momento.</p> : null}
                {overdueRequests.slice(0, 4).map(item => <div key={item.id} className="rounded-lg bg-red-50 p-3 text-[12px] text-red-700"><strong>{item.requester_name}</strong> · {requestLabels[item.request_type]} · venció {fmt(item.due_at)}</div>)}
                {openIncidents.filter(item => ['S3', 'S4'].includes(item.severity)).slice(0, 4).map(item => <div key={item.id} className="rounded-lg bg-amber-50 p-3 text-[12px] text-amber-800"><strong>{item.severity}</strong> · {item.title} · {incidentStatusLabels[item.status]}</div>)}
              </div>
            </div>
          </div>
        </div>
      )}

      {section === 'solicitudes' && <RequestsPanel rows={data.requests} busy={busy} setBusy={setBusy} refresh={refresh} showToast={showToast} />}
      {section === 'incidentes' && <IncidentsPanel rows={data.incidents} busy={busy} setBusy={setBusy} refresh={refresh} showToast={showToast} />}
      {section === 'retencion' && <RetentionPanel rows={data.retentionPolicies} busy={busy} setBusy={setBusy} refresh={refresh} showToast={showToast} />}
      {section === 'holds' && <HoldsPanel rows={data.legalHolds} busy={busy} setBusy={setBusy} refresh={refresh} showToast={showToast} />}
      {section === 'exportar' && <ExportPanel busy={busy} setBusy={setBusy} showToast={showToast} />}
    </div>
  );
}

function RequestsPanel({ rows, busy, setBusy, refresh, showToast }: { rows: PrivacyRequestRow[]; busy: boolean; setBusy: (v: boolean) => void; refresh: () => Promise<void>; showToast: ToastFn }) {
  const [resolution, setResolution] = useState<Record<string, string>>({});
  const act = async (id: string, patch: Parameters<typeof updatePrivacyRequest>[1], success: string) => {
    setBusy(true);
    try { await updatePrivacyRequest(id, patch); showToast(success); await refresh(); }
    catch (err) { showToast(err instanceof Error ? err.message : 'No fue posible actualizar la solicitud.', 'error'); }
    finally { setBusy(false); }
  };

  return (
    <div className="space-y-3">
      {rows.length === 0 ? <div className="rounded-xl border border-cream3 bg-white p-8 text-center text-sm text-gray-400">Aún no hay solicitudes de privacidad.</div> : rows.map(row => {
        const closed = ['resolved', 'rejected', 'withdrawn'].includes(row.status);
        return (
          <div key={row.id} className="rounded-xl border border-cream3 bg-white p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2"><strong className="text-[13.5px] text-navy">{row.requester_name}</strong><Badge tone="info">{requestLabels[row.request_type]}</Badge><Badge tone={closed ? 'good' : row.status === 'blocked' ? 'warn' : 'neutral'}>{requestStatusLabels[row.status]}</Badge>{row.identity_status === 'verified' && <Badge tone="good">Identidad verificada</Badge>}</div>
                <p className="mt-1 text-[11.5px] text-gray-400">{row.requester_email} · recibida {fmt(row.received_at)} · vencimiento {fmt(row.due_at)}</p>
                <p className="mt-3 text-[12.5px] leading-5 text-gray-600"><strong className="text-navy">Alcance:</strong> {row.scope}</p>
                {row.details && <p className="mt-1 text-[12px] leading-5 text-gray-500">{row.details}</p>}
              </div>
            </div>
            {!closed && (
              <div className="mt-4 border-t border-cream3 pt-4">
                <div className="flex flex-wrap gap-2">
                  {row.identity_status !== 'verified' && <button disabled={busy} className="btn btn-ghost" onClick={() => void act(row.id, { identity_status: 'verified', status: 'in_review', acknowledged_at: row.acknowledged_at || new Date().toISOString() }, 'Identidad marcada como verificada.')}>Verificar identidad</button>}
                  {row.identity_status === 'verified' && row.status !== 'in_review' && <button disabled={busy} className="btn btn-ghost" onClick={() => void act(row.id, { status: 'in_review' }, 'Solicitud enviada a revisión.')}>Iniciar revisión</button>}
                  {row.temporary_block_requested && row.temporary_block_status !== 'accepted' && <button disabled={busy} className="btn btn-ghost" onClick={() => void act(row.id, { temporary_block_status: 'accepted', status: 'blocked' }, 'Bloqueo temporal registrado.')}>Aceptar bloqueo</button>}
                </div>
                <div className="mt-3 flex flex-col gap-2 md:flex-row">
                  <input value={resolution[row.id] || ''} onChange={e => setResolution({ ...resolution, [row.id]: e.target.value })} className="form-input min-w-0 flex-1 rounded-lg border border-cream3 px-3 py-2 text-[12.5px]" placeholder="Resumen de respuesta / fundamento" maxLength={5000} />
                  <button disabled={busy || !(resolution[row.id] || '').trim()} className="btn btn-primary" onClick={() => void act(row.id, { status: 'resolved', resolved_at: new Date().toISOString(), response_sent_at: new Date().toISOString(), resolution_summary: resolution[row.id].trim() }, 'Solicitud resuelta y trazada.')}>Resolver</button>
                  <button disabled={busy || !(resolution[row.id] || '').trim()} className="btn btn-ghost" onClick={() => void act(row.id, { status: 'rejected', resolved_at: new Date().toISOString(), response_sent_at: new Date().toISOString(), denial_reason: resolution[row.id].trim() }, 'Rechazo registrado.')}>Rechazar</button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function IncidentsPanel({ rows, busy, setBusy, refresh, showToast }: { rows: SecurityIncidentRow[]; busy: boolean; setBusy: (v: boolean) => void; refresh: () => Promise<void>; showToast: ToastFn }) {
  const [form, setForm] = useState({ title: '', severity: 'S2' as IncidentSeverity, systems: '', categories: '', affected: '' });
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true);
    try {
      await createSecurityIncident({ severity: form.severity, title: form.title, affectedSystems: form.systems.split(',').map(v => v.trim()).filter(Boolean), dataCategories: form.categories.split(',').map(v => v.trim()).filter(Boolean), affectedSubjectsEstimate: form.affected ? Number(form.affected) : null });
      setForm({ title: '', severity: 'S2', systems: '', categories: '', affected: '' }); showToast('Incidente registrado.'); await refresh();
    } catch (err) { showToast(err instanceof Error ? err.message : 'No fue posible registrar el incidente.', 'error'); }
    finally { setBusy(false); }
  };
  const setStatus = async (row: SecurityIncidentRow, status: IncidentStatus) => {
    setBusy(true); try { await updateSecurityIncident(row.id, { status }); showToast('Estado del incidente actualizado.'); await refresh(); } catch (err) { showToast(err instanceof Error ? err.message : 'No fue posible actualizar.', 'error'); } finally { setBusy(false); }
  };
  return (
    <div className="space-y-5">
      <form onSubmit={submit} className="rounded-xl border border-cream3 bg-white p-4">
        <div className="mb-3 flex items-center gap-2"><Plus size={16} className="text-brown" /><h4 className="text-sm font-semibold">Registrar incidente</h4></div>
        <div className="grid gap-3 lg:grid-cols-5">
          <input required minLength={3} maxLength={250} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className="form-input rounded-lg border border-cream3 px-3 py-2 text-sm lg:col-span-2" placeholder="Título del incidente" />
          <select value={form.severity} onChange={e => setForm({ ...form, severity: e.target.value as IncidentSeverity })} className="form-input rounded-lg border border-cream3 px-3 py-2 text-sm"><option>S1</option><option>S2</option><option>S3</option><option>S4</option></select>
          <input value={form.systems} onChange={e => setForm({ ...form, systems: e.target.value })} className="form-input rounded-lg border border-cream3 px-3 py-2 text-sm" placeholder="Sistemas, separados por coma" />
          <input value={form.affected} onChange={e => setForm({ ...form, affected: e.target.value })} type="number" min="0" className="form-input rounded-lg border border-cream3 px-3 py-2 text-sm" placeholder="Afectados estimados" />
        </div>
        <input value={form.categories} onChange={e => setForm({ ...form, categories: e.target.value })} className="form-input mt-3 w-full rounded-lg border border-cream3 px-3 py-2 text-sm" placeholder="Categorías de datos, separadas por coma" />
        <button disabled={busy} className="btn btn-primary mt-3" type="submit">Registrar incidente</button>
      </form>
      <div className="space-y-3">
        {rows.length === 0 ? <div className="rounded-xl border border-cream3 bg-white p-8 text-center text-sm text-gray-400">No hay incidentes registrados.</div> : rows.map(row => <div key={row.id} className="rounded-xl border border-cream3 bg-white p-4"><div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between"><div><div className="flex items-center gap-2"><Badge tone={row.severity === 'S4' ? 'bad' : row.severity === 'S3' ? 'warn' : 'neutral'}>{row.severity}</Badge><strong className="text-[13.5px]">{row.title}</strong></div><p className="mt-1 text-[11.5px] text-gray-400">Detectado {fmt(row.detected_at)} · afectados {row.affected_subjects_estimate ?? 'sin estimar'}</p></div><select disabled={busy} value={row.status} onChange={e => void setStatus(row, e.target.value as IncidentStatus)} className="form-input rounded-lg border border-cream3 px-3 py-2 text-[12px]">{Object.entries(incidentStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>{row.affected_systems.length > 0 && <p className="mt-3 text-[12px] text-gray-500"><strong>Sistemas:</strong> {row.affected_systems.join(', ')}</p>}{row.data_categories.length > 0 && <p className="mt-1 text-[12px] text-gray-500"><strong>Datos:</strong> {row.data_categories.join(', ')}</p>}</div>)}
      </div>
    </div>
  );
}

function RetentionPanel({ rows, busy, setBusy, refresh, showToast }: { rows: RetentionPolicyRow[]; busy: boolean; setBusy: (v: boolean) => void; refresh: () => Promise<void>; showToast: ToastFn }) {
  const [form, setForm] = useState({ category: '', purpose: '', trigger: '', days: '', action: 'review_hold' as RetentionAction, notes: '' });
  const submit = async (event: FormEvent) => { event.preventDefault(); setBusy(true); try { await createRetentionPolicy({ dataCategory: form.category, purpose: form.purpose, triggerEvent: form.trigger, retentionDays: form.days === '' ? null : Number(form.days), finalAction: form.action, legalBasisNotes: form.notes }); setForm({ category: '', purpose: '', trigger: '', days: '', action: 'review_hold', notes: '' }); showToast('Política creada como borrador.'); await refresh(); } catch (err) { showToast(err instanceof Error ? err.message : 'No fue posible crear la política.', 'error'); } finally { setBusy(false); } };
  const patch = async (row: RetentionPolicyRow, value: Partial<RetentionPolicyRow>, success: string) => { setBusy(true); try { await updateRetentionPolicy(row.id, value); showToast(success); await refresh(); } catch (err) { showToast(err instanceof Error ? err.message : 'No fue posible actualizar la política.', 'error'); } finally { setBusy(false); } };
  return <div className="space-y-5"><form onSubmit={submit} className="rounded-xl border border-cream3 bg-white p-4"><h4 className="mb-3 text-sm font-semibold">Nueva política de retención</h4><div className="grid gap-3 lg:grid-cols-2"><input required minLength={2} value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} className="form-input rounded-lg border border-cream3 px-3 py-2 text-sm" placeholder="Categoría de datos" /><input required minLength={2} value={form.trigger} onChange={e => setForm({ ...form, trigger: e.target.value })} className="form-input rounded-lg border border-cream3 px-3 py-2 text-sm" placeholder="Evento inicial (ej. fin de contrato)" /><input required minLength={2} value={form.purpose} onChange={e => setForm({ ...form, purpose: e.target.value })} className="form-input rounded-lg border border-cream3 px-3 py-2 text-sm lg:col-span-2" placeholder="Finalidad y justificación operacional" /><input type="number" min="0" value={form.days} onChange={e => setForm({ ...form, days: e.target.value })} className="form-input rounded-lg border border-cream3 px-3 py-2 text-sm" placeholder="Días de conservación (vacío = por definir)" /><select value={form.action} onChange={e => setForm({ ...form, action: e.target.value as RetentionAction })} className="form-input rounded-lg border border-cream3 px-3 py-2 text-sm"><option value="review_hold">Revisar / conservar</option><option value="anonymize">Anonimizar</option><option value="delete">Eliminar</option></select><textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} className="form-input rounded-lg border border-cream3 px-3 py-2 text-sm lg:col-span-2" rows={2} placeholder="Notas de base legal / criterio de revisión" /></div><button disabled={busy} type="submit" className="btn btn-primary mt-3">Crear borrador</button></form><div className="space-y-3">{rows.length === 0 ? <div className="rounded-xl border border-cream3 bg-white p-8 text-center text-sm text-gray-400">No hay políticas de retención.</div> : rows.map(row => <div key={row.id} className="rounded-xl border border-cream3 bg-white p-4"><div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"><div><strong className="text-[13.5px]">{row.data_category}</strong><p className="mt-1 text-[11.5px] text-gray-400">{row.trigger_event} · {row.retention_days === null ? 'plazo por definir' : `${row.retention_days} días`} · v{row.version}</p><p className="mt-2 text-[12px] text-gray-600">{row.purpose}</p></div><div className="flex flex-wrap items-center gap-2"><select disabled={busy} value={row.legal_review_status} onChange={e => void patch(row, { legal_review_status: e.target.value as any, active: e.target.value === 'approved' ? row.active : false }, 'Estado de revisión actualizado.')} className="form-input rounded-lg border border-cream3 px-2 py-2 text-[12px]"><option value="draft">Borrador</option><option value="approved">Aprobada jurídicamente</option><option value="rejected">Rechazada</option></select><button disabled={busy || row.legal_review_status !== 'approved'} type="button" onClick={() => void patch(row, { active: !row.active }, row.active ? 'Política desactivada.' : 'Política activada.')} className="btn btn-ghost">{row.active ? 'Desactivar' : 'Activar'}</button><Badge tone={row.dry_run_required ? 'warn' : 'good'}>{row.dry_run_required ? 'Dry-run obligatorio' : 'Dry-run cerrado'}</Badge></div></div></div>)}</div></div>;
}

function HoldsPanel({ rows, busy, setBusy, refresh, showToast }: { rows: LegalHoldRow[]; busy: boolean; setBusy: (v: boolean) => void; refresh: () => Promise<void>; showToast: ToastFn }) {
  const [form, setForm] = useState({ scopeType: 'worker' as LegalHoldRow['scope_type'], scopeId: '', reason: '' });
  const submit = async (event: FormEvent) => { event.preventDefault(); setBusy(true); try { await createLegalHold({ scopeType: form.scopeType, scopeId: form.scopeId.trim(), reason: form.reason }); setForm({ scopeType: 'worker', scopeId: '', reason: '' }); showToast('Legal hold creado.'); await refresh(); } catch (err) { showToast(err instanceof Error ? err.message : 'No fue posible crear el legal hold.', 'error'); } finally { setBusy(false); } };
  const release = async (id: string) => { setBusy(true); try { await releaseLegalHold(id); showToast('Legal hold liberado.'); await refresh(); } catch (err) { showToast(err instanceof Error ? err.message : 'No fue posible liberar el legal hold.', 'error'); } finally { setBusy(false); } };
  return <div className="space-y-5"><form onSubmit={submit} className="rounded-xl border border-cream3 bg-white p-4"><h4 className="mb-3 text-sm font-semibold">Crear conservación especial</h4><div className="grid gap-3 lg:grid-cols-[180px_1fr_2fr]"><select value={form.scopeType} onChange={e => setForm({ ...form, scopeType: e.target.value as LegalHoldRow['scope_type'] })} className="form-input rounded-lg border border-cream3 px-3 py-2 text-sm"><option value="profile">Perfil</option><option value="worker">Trabajador</option><option value="project">Proyecto</option><option value="accreditation">Acreditación</option><option value="document">Documento</option><option value="document_version">Versión documental</option><option value="contractor">Contratista</option><option value="other">Otro</option></select><input required value={form.scopeId} onChange={e => setForm({ ...form, scopeId: e.target.value })} className="form-input rounded-lg border border-cream3 px-3 py-2 text-sm" placeholder="UUID del recurso" /><input required minLength={3} maxLength={3000} value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} className="form-input rounded-lg border border-cream3 px-3 py-2 text-sm" placeholder="Motivo de conservación" /></div><button disabled={busy} type="submit" className="btn btn-primary mt-3">Crear legal hold</button></form><div className="space-y-3">{rows.length === 0 ? <div className="rounded-xl border border-cream3 bg-white p-8 text-center text-sm text-gray-400">No hay legal holds.</div> : rows.map(row => <div key={row.id} className="rounded-xl border border-cream3 bg-white p-4"><div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between"><div><div className="flex items-center gap-2"><Badge tone={row.active ? 'warn' : 'neutral'}>{row.active ? 'Activo' : 'Liberado'}</Badge><strong className="text-[13px]">{row.scope_type}</strong><code className="text-[11px] text-gray-400">{row.scope_id}</code></div><p className="mt-2 text-[12px] text-gray-600">{row.reason}</p><p className="mt-1 text-[11px] text-gray-400">Creado {fmt(row.created_at)}{row.released_at ? ` · liberado ${fmt(row.released_at)}` : ''}</p></div>{row.active && <button disabled={busy} type="button" className="btn btn-ghost" onClick={() => void release(row.id)}>Liberar</button>}</div></div>)}</div></div>;
}

function ExportPanel({ busy, setBusy, showToast }: { busy: boolean; setBusy: (v: boolean) => void; showToast: ToastFn }) {
  const [identifier, setIdentifier] = useState('');
  const safeName = useMemo(() => identifier.trim().replace(/[^a-zA-Z0-9_-]+/g, '-').slice(0, 50), [identifier]);
  const exportData = async () => { setBusy(true); try { const payload = await buildWorkerPortabilityExport(identifier); downloadJsonFile(`acredita-portabilidad-${safeName || 'trabajador'}.json`, payload); showToast('Exportación JSON generada.'); } catch (err) { showToast(err instanceof Error ? err.message : 'No fue posible generar la exportación.', 'error'); } finally { setBusy(false); } };
  return <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]"><div className="rounded-xl border border-cream3 bg-white p-5"><div className="flex items-center gap-2"><Download size={17} className="text-brown" /><h4 className="text-sm font-semibold">Portabilidad de trabajador</h4></div><p className="mt-2 text-[12px] leading-5 text-gray-500">Genera un archivo JSON estructurado con el registro del trabajador, asignaciones y metadatos documentales. No descarga automáticamente los archivos binarios del Storage.</p><label className="mt-5 block text-[12px] font-semibold text-gray-600">UUID o RUT verificado del trabajador</label><div className="mt-2 flex flex-col gap-2 sm:flex-row"><input value={identifier} onChange={e => setIdentifier(e.target.value)} className="form-input min-w-0 flex-1 rounded-lg border border-cream3 px-3 py-2 text-sm" placeholder="12.345.678-9 o UUID" /><button disabled={busy || !identifier.trim()} type="button" className="btn btn-primary" onClick={() => void exportData()}><Download size={15} /> Exportar JSON</button></div></div><div className="rounded-xl border border-amber-200 bg-amber-50 p-5"><div className="flex items-center gap-2 text-amber-800"><Clock3 size={17} /><h4 className="text-sm font-semibold">Control humano obligatorio</h4></div><p className="mt-3 text-[12px] leading-5 text-amber-800">Antes de entregar una exportación, Acredita debe verificar identidad, revisar el alcance de la solicitud y confirmar que el archivo no incluya datos de terceros que no correspondan al titular.</p></div></div>;
}
