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
  resolveDecisionReview,
  updatePrivacyImpactAssessment,
  updatePrivacyProcessingActivity,
  updateRequirementPrivacyAssessment,
  updatePrivacyRequest,
  updateRetentionPolicy,
  updateSecurityIncident,
  type IncidentSeverity,
  type IncidentStatus,
  type LegalHoldRow,
  type PrivacyAdminSnapshot,
  type PrivacyImpactAssessmentRow,
  type PrivacyProcessingActivityRow,
  type PrivacyRequestRow,
  type ProcessingRoleAssessment,
  type RequirementPrivacyAssessmentRow,
  type RequirementSummaryRow,
  type MinimizationStrategy,
  type RetentionAction,
  type RetentionPolicyRow,
  type SecurityIncidentRow,
} from '../../../data/supabasePrivacyAdmin';
import type { DecisionReviewRow } from '../../../data/supabaseDecisionReviews';
import {
  ProcessingActivitiesPanel,
  RequirementPrivacyPanel,
  ImpactAssessmentsPanel,
  DecisionReviewsPanel,
  RequestsPanel,
  IncidentsPanel,
  RetentionPanel,
  HoldsPanel,
  ExportPanel,
} from './PrivacyAdminPanels';

type Section = 'resumen' | 'tratamientos' | 'requisitos' | 'impacto' | 'decisiones' | 'solicitudes' | 'incidentes' | 'retencion' | 'holds' | 'exportar';

type ToastFn = (msg: string, type?: 'success' | 'error' | 'warning') => void;

const EMPTY: PrivacyAdminSnapshot = { requests: [], incidents: [], retentionPolicies: [], legalHolds: [], processingActivities: [], impactAssessments: [], requirements: [], requirementAssessments: [], decisionReviews: [] };

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

const roleLabels: Record<ProcessingRoleAssessment, string> = {
  controller: 'Responsable',
  processor: 'Encargado',
  joint_or_mixed: 'Rol mixto',
  tbd: 'Por definir',
};

const impactStatusLabels: Record<PrivacyImpactAssessmentRow['status'], string> = {
  screening: 'Screening',
  draft: 'EIPD en borrador',
  review: 'En revisión',
  approved: 'Aprobada',
  not_required: 'No requerida',
};

const minimizationLabels: Record<MinimizationStrategy, string> = {
  pending: 'Por definir',
  full_document_justified: 'Documento completo justificado',
  extract_fields: 'Extraer solo campos necesarios',
  verification_only: 'Verificar sin conservar documento',
  no_collection: 'No recopilar',
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
    { id: 'tratamientos', label: `Tratamientos (${data.processingActivities.length})` },
    { id: 'requisitos', label: `Requisitos (${data.requirementAssessments.length})` },
    { id: 'impacto', label: `EIPD (${data.impactAssessments.length})` },
    { id: 'decisiones', label: `Revisión humana${data.decisionReviews.filter(item => ['requested', 'in_review'].includes(item.status)).length ? ` (${data.decisionReviews.filter(item => ['requested', 'in_review'].includes(item.status)).length})` : ''}` },
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
          <p className="mt-1 max-w-[820px] text-[12.5px] leading-5 text-gray-500">Gobierno de privacidad para Ley 21.719: registro de tratamientos (ROPA), evaluación de impacto, derechos de titulares, incidentes, retención y bloqueos de conservación. Las bases jurídicas y periodos definitivos permanecen sujetos a revisión antes del go-live.</p>
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
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-7">
            <Card title="Tratamientos" value={data.processingActivities.length} subtitle={`${data.processingActivities.filter(item => item.status === 'draft').length} pendientes de cierre jurídico`} icon={<Database size={18} />} />
            <Card title="Requisitos" value={data.requirementAssessments.length} subtitle={`${data.requirementAssessments.filter(item => item.status !== 'approved').length} sin aprobación de privacidad`} icon={<FileLock2 size={18} />} />
            <Card title="EIPD" value={data.impactAssessments.length} subtitle={`${data.impactAssessments.filter(item => item.required_by_internal_decision).length} requeridas internamente`} icon={<ShieldAlert size={18} />} />
            <Card title="Revisión humana" value={data.decisionReviews.filter(item => ['requested', 'in_review'].includes(item.status)).length} subtitle="Solicitudes abiertas de intervención" icon={<UserRoundCheck size={18} />} />
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

      {section === 'tratamientos' && <ProcessingActivitiesPanel rows={data.processingActivities} busy={busy} setBusy={setBusy} refresh={refresh} showToast={showToast} />}
      {section === 'requisitos' && <RequirementPrivacyPanel assessments={data.requirementAssessments} requirements={data.requirements} busy={busy} setBusy={setBusy} refresh={refresh} showToast={showToast} />}
      {section === 'impacto' && <ImpactAssessmentsPanel rows={data.impactAssessments} activities={data.processingActivities} busy={busy} setBusy={setBusy} refresh={refresh} showToast={showToast} />}
      {section === 'decisiones' && <DecisionReviewsPanel rows={data.decisionReviews} busy={busy} setBusy={setBusy} refresh={refresh} showToast={showToast} />}
      {section === 'solicitudes' && <RequestsPanel rows={data.requests} busy={busy} setBusy={setBusy} refresh={refresh} showToast={showToast} />}
      {section === 'incidentes' && <IncidentsPanel rows={data.incidents} busy={busy} setBusy={setBusy} refresh={refresh} showToast={showToast} />}
      {section === 'retencion' && <RetentionPanel rows={data.retentionPolicies} busy={busy} setBusy={setBusy} refresh={refresh} showToast={showToast} />}
      {section === 'holds' && <HoldsPanel rows={data.legalHolds} busy={busy} setBusy={setBusy} refresh={refresh} showToast={showToast} />}
      {section === 'exportar' && <ExportPanel busy={busy} setBusy={setBusy} showToast={showToast} />}
    </div>
  );
}
