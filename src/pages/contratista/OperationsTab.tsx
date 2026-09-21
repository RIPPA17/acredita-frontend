import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import {
  Banknote,
  ClipboardCheck,
  Clock3,
  FileText,
  Headphones,
  History,
  MessageSquare,
  PlayCircle,
  RefreshCw,
  Send,
  Upload,
} from 'lucide-react';
import type { Contratista, Proyecto } from '../../types';
import {
  createTicket,
  getActionPlanContext,
  listActionPlanAttachments,
  listActionPlanEvents,
  listActionPlans,
  listPaymentCaseEvents,
  listTicketMessages,
  loadOperations,
  openOperationAttachment,
  sendTicketMessage,
  uploadActionPlanAttachment,
  type ActionPlanEventRecord,
  type ActionPlanRecord,
  type EvaluationRecord,
  type OperationAttachmentRecord,
  type PaymentCaseEventRecord,
  type PaymentRecord,
  type TicketMessageRecord,
  type TicketRecord,
} from '../../data/supabaseOperations';
import { updateContractorActionPlan } from '../../data/contractorOperations';
import { getPaymentCaseCompliance } from '../../data/supabasePaymentState';
import { proyectoOperativoParaContratista } from '../../data/operationalCore';

type Mode = 'evaluaciones' | 'pagos' | 'soporte';

type OperationsData = {
  evaluations: EvaluationRecord[];
  payments: PaymentRecord[];
  tickets: TicketRecord[];
};

const paymentLabel: Record<string, string> = {
  observado: 'Observado',
  retenido: 'Retenido',
  liberado: 'Liberado',
  pagado: 'Pagado',
  anulado: 'Anulado',
};

const ticketLabel: Record<string, string> = {
  abierto: 'Abierto',
  en_progreso: 'En progreso',
  resuelto: 'Resuelto',
  cerrado: 'Cerrado',
};

const planLabel: Record<ActionPlanRecord['status'], string> = {
  pendiente: 'Pendiente',
  en_progreso: 'En progreso',
  en_revision: 'En revisión',
  completado: 'Completado',
  cancelado: 'Cancelado',
};

const planOverdue = (item: ActionPlanRecord) =>
  Boolean(item.due_date && item.due_date < new Date().toISOString().slice(0, 10) && !['completado', 'cancelado'].includes(item.status));

function ContractorActionPlans({
  evaluationId,
  readOnly = false,
  focusPlanId,
  showToast,
}: {
  evaluationId: string;
  readOnly?: boolean;
  focusPlanId?: string;
  showToast: (message: string, type?: 'success' | 'error' | 'warning') => void;
}) {
  const [items, setItems] = useState<ActionPlanRecord[]>([]);
  const [events, setEvents] = useState<Record<string, ActionPlanEventRecord[]>>({});
  const [attachments, setAttachments] = useState<Record<string, OperationAttachmentRecord[]>>({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string>();
  const [uploadingId, setUploadingId] = useState<string>();
  const [evidence, setEvidence] = useState<Record<string, string>>({});

  const load = async () => {
    setLoading(true);
    try {
      const next = await listActionPlans(evaluationId);
      setItems(next);
      setEvidence(current => {
        const copy = { ...current };
        next.forEach(item => {
          if (copy[item.id] === undefined) copy[item.id] = item.evidence || '';
        });
        return copy;
      });
      const details = await Promise.all(next.map(async item => ({
        id: item.id,
        events: await listActionPlanEvents(item.id),
        attachments: await listActionPlanAttachments(item.id),
      })));
      setEvents(Object.fromEntries(details.map(item => [item.id, item.events])));
      setAttachments(Object.fromEntries(details.map(item => [item.id, item.attachments])));
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'No fue posible cargar los planes de acción.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [evaluationId]);

  useEffect(() => {
    if (!focusPlanId || loading) return;
    const target = document.getElementById(`action-plan-${focusPlanId}`);
    target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [focusPlanId, loading, items.length]);

  const start = async (item: ActionPlanRecord) => {
    if (readOnly) return;
    setSavingId(item.id);
    try {
      await updateContractorActionPlan(item.id, 'en_progreso', evidence[item.id]?.trim() || undefined);
      await load();
      showToast('Plan de acción iniciado.');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'No fue posible iniciar el plan.', 'error');
    } finally {
      setSavingId(undefined);
    }
  };

  const saveEvidence = async (item: ActionPlanRecord) => {
    if (readOnly || item.status !== 'en_progreso') return;
    const comment = evidence[item.id]?.trim() || '';
    if (!comment) {
      showToast('Escribe una evidencia o comentario antes de guardar.', 'warning');
      return;
    }
    setSavingId(item.id);
    try {
      await updateContractorActionPlan(item.id, 'en_progreso', comment);
      await load();
      showToast('Avance guardado.');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'No fue posible guardar el avance.', 'error');
    } finally {
      setSavingId(undefined);
    }
  };

  const submitForReview = async (item: ActionPlanRecord) => {
    if (readOnly || !['pendiente', 'en_progreso'].includes(item.status)) return;
    const comment = evidence[item.id]?.trim() || '';
    const fileCount = (attachments[item.id] || []).length;
    if (comment.length < 3 && fileCount === 0) {
      showToast('Agrega un comentario o archivo de evidencia antes de enviar a revisión.', 'warning');
      return;
    }
    setSavingId(item.id);
    try {
      await updateContractorActionPlan(item.id, 'en_revision', comment || undefined);
      await load();
      showToast('Evidencia enviada a revisión. Mandante/Acredita debe validar el cierre.');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'No fue posible enviar el plan a revisión.', 'error');
    } finally {
      setSavingId(undefined);
    }
  };

  const uploadEvidence = async (item: ActionPlanRecord, event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || readOnly || !['pendiente', 'en_progreso'].includes(item.status)) return;
    setUploadingId(item.id);
    try {
      await uploadActionPlanAttachment(item.id, file);
      await load();
      showToast('Archivo de evidencia adjuntado.');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'No fue posible adjuntar la evidencia.', 'error');
    } finally {
      setUploadingId(undefined);
    }
  };

  const openAttachment = async (item: OperationAttachmentRecord) => {
    try { await openOperationAttachment(item); }
    catch (error) { showToast(error instanceof Error ? error.message : 'No fue posible abrir la evidencia.', 'error'); }
  };

  if (loading) return <div className="rounded-lg border p-3 text-sm text-gray-500">Cargando planes de acción…</div>;
  if (items.length === 0) return <div className="rounded-lg border p-3 text-sm text-gray-500">Esta evaluación no tiene planes de acción asociados.</div>;

  return <div className="space-y-3">
    {items.map(item => {
      const editable = !readOnly && ['pendiente', 'en_progreso'].includes(item.status);
      const overdue = planOverdue(item);
      const focused = focusPlanId === item.id;
      return <div id={`action-plan-${item.id}`} key={item.id} className={`rounded-xl border bg-white p-4 ${focused ? 'ring-2 ring-brown/40' : 'border-cream3'}`}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <strong className="text-navy">{item.title}</strong>
              <span className="rounded-full bg-cream2 px-2 py-0.5 text-[11px] font-semibold text-gray-600">{planLabel[item.status]}</span>
              {overdue && <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700"><Clock3 size={11}/>Vencido</span>}
            </div>
            <p className="mt-1 text-sm text-gray-600">{item.description}</p>
            <small className="mt-1 block text-gray-500">
              {item.owner_name ? `Responsable: ${item.owner_name}` : 'Sin responsable definido'}
              {item.due_date ? ` · vence ${item.due_date}` : ''}
            </small>
          </div>
          {!readOnly && item.status === 'pendiente' && <button type="button" className="btn btn-secondary" disabled={savingId === item.id} onClick={() => void start(item)}><PlayCircle size={15}/>Iniciar</button>}
        </div>

        {item.review_comment && <div className="mt-3 rounded-lg border border-orange-200 bg-orange-50 p-3 text-sm text-orange-800"><strong>Observación del revisor:</strong> {item.review_comment}</div>}

        {editable && <div className="mt-3 rounded-lg bg-cream2/60 p-3">
          <label className="block text-xs font-semibold text-gray-600">Evidencia o comentario de avance</label>
          <textarea
            value={evidence[item.id] || ''}
            maxLength={4000}
            onChange={event => setEvidence(current => ({ ...current, [item.id]: event.target.value }))}
            className="form-input mt-1 min-h-[84px] w-full"
            placeholder="Describe la acción realizada, cambios aplicados o referencia de la evidencia…"
          />
          <div className="mt-2 flex flex-wrap gap-2">
            <label className="btn btn-secondary cursor-pointer">
              <Upload size={15}/> {uploadingId === item.id ? 'Subiendo…' : 'Adjuntar evidencia'}
              <input
                type="file"
                className="sr-only"
                disabled={uploadingId === item.id}
                accept=".pdf,.jpg,.jpeg,.png,.xlsx,application/pdf,image/jpeg,image/png,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                onChange={event => void uploadEvidence(item, event)}
              />
            </label>
            {item.status === 'en_progreso' && <button type="button" className="btn btn-secondary" disabled={savingId === item.id || !(evidence[item.id] || '').trim()} onClick={() => void saveEvidence(item)}>Guardar avance</button>}
            <button type="button" className="btn btn-primary" disabled={savingId === item.id || uploadingId === item.id} onClick={() => void submitForReview(item)}><Send size={15}/>Enviar a revisión</button>
          </div>
        </div>}

        {(attachments[item.id] || []).length > 0 && <div className="mt-3 flex flex-wrap gap-2">
          {(attachments[item.id] || []).map(file => <button key={file.id} type="button" className="inline-flex items-center gap-1 rounded border px-2 py-1 text-xs text-navy" onClick={() => void openAttachment(file)}><FileText size={12}/>{file.file_name}</button>)}
        </div>}

        {!editable && item.evidence && <div className="mt-3 rounded-lg border border-green-100 bg-green-50 p-3 text-sm text-green-800"><strong>Evidencia:</strong> {item.evidence}</div>}
        {item.status === 'en_revision' && <div className="mt-3 rounded-lg border border-blue-100 bg-blue-50 p-3 text-sm text-blue-800"><strong>Esperando validación.</strong> Mandante/Acredita debe aprobar o devolver la evidencia; el Contratista no puede cerrar el plan por sí mismo.</div>}
        {item.status === 'completado' && <div className="mt-3 rounded-lg border border-green-100 bg-green-50 p-3 text-sm text-green-800"><strong>Cierre validado.</strong>{item.reviewed_at ? ` Revisado ${new Date(item.reviewed_at).toLocaleString('es-CL')}.` : ''}</div>}
        {item.status === 'cancelado' && <div className="mt-3 rounded-lg border bg-gray-50 p-3 text-sm text-gray-600"><strong>Plan cancelado.</strong>{item.review_comment ? ` ${item.review_comment}` : ''}</div>}

        {(events[item.id] || []).length > 0 && <details className="mt-3">
          <summary className="inline-flex cursor-pointer items-center gap-1 text-xs font-semibold text-gray-600"><History size={13}/>Historial · {(events[item.id] || []).length}</summary>
          <div className="mt-2 space-y-1">
            {(events[item.id] || []).map(event => <div key={event.id} className="rounded bg-gray-50 px-2 py-1 text-xs text-gray-600">
              <strong className="capitalize">{event.event_type.replaceAll('_',' ')}</strong> · {new Date(event.created_at).toLocaleString('es-CL')}{event.comment ? ` · ${event.comment}` : ''}
            </div>)}
          </div>
        </details>}
      </div>;
    })}
  </div>;
}

function ContractorPaymentDetail({
  payment,
  showToast,
}: {
  payment: PaymentRecord;
  showToast: (message: string, type?: 'success' | 'error' | 'warning') => void;
}) {
  const [events,setEvents]=useState<PaymentCaseEventRecord[]>([]);
  const [compliance,setCompliance]=useState<Record<string, unknown> | null>(null);
  const [loading,setLoading]=useState(true);

  useEffect(()=>{
    let cancelled=false;
    setLoading(true);
    Promise.all([
      listPaymentCaseEvents(payment.id),
      getPaymentCaseCompliance(payment.id),
    ]).then(([history,context])=>{
      if(cancelled)return;
      setEvents(history);
      setCompliance(context);
    }).catch(error=>{
      if(!cancelled) showToast(error instanceof Error?error.message:'No fue posible cargar el detalle del pago.','error');
    }).finally(()=>{if(!cancelled)setLoading(false);});
    return()=>{cancelled=true;};
  },[payment.id,payment.status]);

  if(loading) return <div className="mt-3 rounded-lg border bg-gray-50 p-3 text-sm text-gray-500">Cargando detalle del pago…</div>;

  const eligible=compliance?.eligible===true;
  const reason=String(compliance?.eligibleReason || compliance?.reason || '');
  const percent=Number(compliance?.compliancePercent || 0);
  const blockers=Number(compliance?.paymentBlockedCount || 0);
  const pending=Number(compliance?.paymentPendingCount || 0);

  return <div className="mt-3 rounded-xl border bg-cream2/30 p-4">
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 text-xs">
      <div className="rounded bg-white p-2"><span className="block text-gray-500">Cumplimiento</span><strong>{percent}%</strong></div>
      <div className="rounded bg-white p-2"><span className="block text-gray-500">Bloqueos</span><strong>{blockers}</strong></div>
      <div className="rounded bg-white p-2"><span className="block text-gray-500">Pendientes</span><strong>{pending}</strong></div>
      <div className="rounded bg-white p-2"><span className="block text-gray-500">Período</span><strong className="capitalize">{String(compliance?.periodStatus || '—')}</strong></div>
    </div>
    <div className={`mt-2 rounded-lg border p-3 text-sm ${eligible?'border-green-200 bg-green-50 text-green-800':'border-orange-200 bg-orange-50 text-orange-800'}`}>
      <strong>{eligible?'Snapshot habilitado para pago.':'Pago no habilitado por cumplimiento.'}</strong>{reason && <span> {reason}</span>}
    </div>

    {payment.submission_note && <p className="mt-3 text-sm text-gray-600"><strong>Nota del estado de pago:</strong> {payment.submission_note}</p>}
    {payment.payment_reference && <p className="mt-2 text-sm text-green-800"><strong>Referencia de pago:</strong> {payment.payment_reference}{payment.paid_at?` · ${new Date(payment.paid_at).toLocaleString('es-CL')}`:''}</p>}
    {payment.payment_note && <p className="mt-1 text-sm text-gray-600">{payment.payment_note}</p>}
    {payment.void_reason && <p className="mt-2 text-sm text-red-700"><strong>Anulado:</strong> {payment.void_reason}</p>}

    <details className="mt-3">
      <summary className="inline-flex cursor-pointer items-center gap-1 text-xs font-semibold text-gray-600"><History size={13}/>Historial del pago · {events.length}</summary>
      <div className="mt-2 space-y-1">
        {events.map(event=><div key={event.id} className="rounded bg-white px-2 py-1 text-xs text-gray-600">
          <strong className="capitalize">{event.event_type.replaceAll('_',' ')}</strong> · {new Date(event.created_at).toLocaleString('es-CL')}
          {event.reason?` · ${event.reason}`:''}
        </div>)}
      </div>
    </details>
  </div>;
}

function ContractorTicketConversation({
  ticketId,
  readOnly = false,
  showToast,
}: {
  ticketId: string;
  readOnly?: boolean;
  showToast: (message: string, type?: 'success' | 'error' | 'warning') => void;
}) {
  const [items, setItems] = useState<TicketMessageRecord[]>([]);
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      setItems(await listTicketMessages(ticketId));
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'No fue posible cargar la conversación.', 'error');
    }
  };

  useEffect(() => { void load(); }, [ticketId]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!body.trim() || saving || readOnly) return;
    setSaving(true);
    try {
      await sendTicketMessage(ticketId, body, false);
      setBody('');
      await load();
      showToast('Mensaje enviado.');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'No fue posible enviar el mensaje.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-3 rounded-xl border bg-cream2/40 p-3">
      <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-navy"><MessageSquare size={15} /> Conversación</div>
      <div className="max-h-56 space-y-2 overflow-y-auto">
        {items.map(item => (
          <div key={item.id} className="rounded-lg border bg-white p-2 text-sm">
            <span>{item.body}</span>
            <small className="mt-1 block text-gray-500">{new Date(item.created_at).toLocaleString('es-CL')}</small>
          </div>
        ))}
        {items.length === 0 && <p className="text-sm text-gray-500">Sin mensajes todavía.</p>}
      </div>
      {!readOnly && <form onSubmit={submit} className="mt-3 flex flex-col gap-2 sm:flex-row">
        <textarea required maxLength={3000} value={body} onChange={event => setBody(event.target.value)} className="form-input min-h-[70px] flex-1" placeholder="Escribe una respuesta para Mandante/Acredita…" />
        <button className="btn btn-primary self-end" disabled={saving || !body.trim()}><Send size={15} /> Enviar</button>
      </form>}
    </div>
  );
}

export default function OperationsTab({
  contratista,
  proyectos,
  selectedProyectoId,
  setSelectedProyectoId,
  showToast,
}: {
  contratista: Contratista;
  proyectos: Proyecto[];
  selectedProyectoId: string;
  setSelectedProyectoId: (id: string) => void;
  showToast: (message: string, type?: 'success' | 'error' | 'warning') => void;
}) {
  const [mode, setMode] = useState<Mode>('evaluaciones');
  const [data, setData] = useState<OperationsData>({ evaluations: [], payments: [], tickets: [] });
  const [loading, setLoading] = useState(true);
  const [expandedEvaluation, setExpandedEvaluation] = useState<string>();
  const [expandedPayment, setExpandedPayment] = useState<string>();
  const [expandedTicket, setExpandedTicket] = useState<string>();
  const [ticketForm, setTicketForm] = useState({ subject: '', description: '', priority: 'normal' });
  const [savingTicket, setSavingTicket] = useState(false);
  const operationParams = new URLSearchParams(window.location.search);
  const requestedPlanId = operationParams.get('plan') || undefined;
  const requestedEvaluationId = operationParams.get('evaluacion') || undefined;
  const requestedPaymentId = operationParams.get('pago') || undefined;

  const project = proyectos.find(item => item.id === selectedProyectoId) || proyectos[0];
  const readOnly = !proyectoOperativoParaContratista(project, contratista.id);

  const load = async () => {
    if (!project) {
      setData({ evaluations: [], payments: [], tickets: [] });
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      setData(await loadOperations(project.id));
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'No fue posible cargar la operación del proyecto.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [project?.id]);

  useEffect(() => {
    if (requestedEvaluationId && project) {
      setMode('evaluaciones');
      setExpandedEvaluation(requestedEvaluationId);
    }
  }, [requestedEvaluationId, project?.id]);

  useEffect(() => {
    if (requestedPaymentId && project) {
      setMode('pagos');
      setExpandedPayment(requestedPaymentId);
    }
  }, [requestedPaymentId, project?.id]);

  useEffect(() => {
    if (!requestedPlanId || !project) return;
    let cancelled = false;
    getActionPlanContext(requestedPlanId)
      .then(context => {
        if (cancelled || !context) return;
        setMode('evaluaciones');
        setExpandedEvaluation(context.evaluationId);
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [requestedPlanId, project?.id]);

  const submitTicket = async (event: FormEvent) => {
    event.preventDefault();
    if (!project || readOnly || !ticketForm.subject.trim() || !ticketForm.description.trim() || savingTicket) return;
    setSavingTicket(true);
    try {
      await createTicket(project.id, contratista.id, {
        subject: ticketForm.subject.trim(),
        description: ticketForm.description.trim(),
        priority: ticketForm.priority,
        category: 'operacion',
      });
      setTicketForm({ subject: '', description: '', priority: 'normal' });
      await load();
      showToast('Ticket enviado al equipo responsable.');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'No fue posible crear el ticket.', 'error');
    } finally {
      setSavingTicket(false);
    }
  };

  if (!project) {
    return <div className="rounded-xl border bg-white p-5 text-sm text-gray-500">Todavía no tienes proyectos asociados para consultar operación.</div>;
  }

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-cream3 bg-white p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[1.2px] text-brown">Seguimiento del proyecto</div>
            <h2 className="mt-1 text-lg font-semibold text-navy">Evaluaciones, pagos y soporte</h2>
            <p className="mt-1 text-sm text-gray-500">Consulta decisiones operativas del Mandante, responde planes de acción y conversa con soporte sin modificar decisiones de evaluación o pago.</p>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500">Proyecto
              <select value={project.id} onChange={event => { setSelectedProyectoId(event.target.value); setExpandedEvaluation(undefined); setExpandedPayment(undefined); setExpandedTicket(undefined); }} className="form-input mt-1 block min-w-[220px]">
                {proyectos.map(item => <option key={item.id} value={item.id}>{item.nombre}</option>)}
              </select>
            </label>
            <button type="button" aria-label="Actualizar operación" className="mt-5 p-2 text-gray-500 hover:text-navy" onClick={() => void load()}><RefreshCw size={17} /></button>
          </div>
        </div>
      </section>

      {readOnly && <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800"><strong>Proyecto histórico · modo consulta.</strong> Puedes revisar evaluaciones, estados de pago y conversaciones existentes, pero no modificar planes de acción ni crear nuevos mensajes o tickets.</div>}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <button type="button" onClick={() => setMode('evaluaciones')} className={`rounded-xl border p-4 text-left ${mode === 'evaluaciones' ? 'border-brown bg-orange-50/40' : 'bg-white'}`}>
          <ClipboardCheck size={19} className="text-brown" /><strong className="mt-2 block text-navy">Evaluaciones</strong><span className="text-sm text-gray-500">{data.evaluations.length} registrada{data.evaluations.length === 1 ? '' : 's'}</span>
        </button>
        <button type="button" onClick={() => setMode('pagos')} className={`rounded-xl border p-4 text-left ${mode === 'pagos' ? 'border-brown bg-orange-50/40' : 'bg-white'}`}>
          <Banknote size={19} className="text-brown" /><strong className="mt-2 block text-navy">Estados de pago</strong><span className="text-sm text-gray-500">{data.payments.length} período{data.payments.length === 1 ? '' : 's'}</span>
        </button>
        <button type="button" onClick={() => setMode('soporte')} className={`rounded-xl border p-4 text-left ${mode === 'soporte' ? 'border-brown bg-orange-50/40' : 'bg-white'}`}>
          <Headphones size={19} className="text-brown" /><strong className="mt-2 block text-navy">Soporte</strong><span className="text-sm text-gray-500">{data.tickets.filter(item => !['resuelto', 'cerrado'].includes(item.status)).length} abierto{data.tickets.filter(item => !['resuelto', 'cerrado'].includes(item.status)).length === 1 ? '' : 's'}</span>
        </button>
      </div>

      {loading ? <div className="rounded-xl border bg-white p-6 text-sm text-gray-500">Cargando operación…</div> : (
        <>
          {mode === 'evaluaciones' && <section className="space-y-3">
            {data.evaluations.map(item => (
              <article key={item.id} className="rounded-xl border border-cream3 bg-white p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <strong className="text-navy">Evaluación {item.period_start} — {item.period_end}</strong>
                    <div className="mt-1 text-sm text-gray-500">Puntaje total: {item.total_score}% · Riesgo {item.risk_level || 'sin clasificar'} · {item.status === 'cerrada' ? 'cerrada' : 'publicada'}</div>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs text-gray-600">
                      <span className="rounded bg-cream2 px-2 py-1">Seguridad {item.safety_score}%</span>
                      <span className="rounded bg-cream2 px-2 py-1">Calidad {item.quality_score}%</span>
                      <span className="rounded bg-cream2 px-2 py-1">Laboral {item.labor_score}%</span>
                      <span className="rounded bg-cream2 px-2 py-1">Cumplimiento {item.compliance_score}%</span>
                    </div>
                    {item.observations && <p className="mt-2 text-sm text-gray-600">{item.observations}</p>}
                  </div>
                  <button type="button" className="btn btn-secondary" onClick={() => setExpandedEvaluation(current => current === item.id ? undefined : item.id)}>
                    {expandedEvaluation === item.id ? 'Ocultar planes' : 'Planes de acción'}
                  </button>
                </div>
                {item.status === 'cerrada' && <div className="mt-3 rounded-lg border bg-gray-50 p-3 text-sm text-gray-600"><strong>Evaluación cerrada.</strong> Sus resultados y planes quedan conservados como historial.</div>}
                {expandedEvaluation === item.id && <div className="mt-4"><ContractorActionPlans evaluationId={item.id} readOnly={readOnly || item.status === 'cerrada'} focusPlanId={requestedPlanId} showToast={showToast} /></div>}
              </article>
            ))}
            {data.evaluations.length === 0 && <div className="rounded-xl border bg-white p-6 text-sm text-gray-500">Todavía no hay evaluaciones publicadas para este proyecto.</div>}
          </section>}

          {mode === 'pagos' && <section className="space-y-3">
            {data.payments.map(item => <article id={`payment-case-${item.id}`} key={item.id} className={`rounded-xl border bg-white p-4 ${requestedPaymentId===item.id?'ring-2 ring-brown/40':'border-cream3'}`}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <strong className="text-navy">{item.period_start} — {item.period_end}</strong>
                  <p className="mt-1 text-sm text-gray-600">{item.amount ? `${Number(item.amount).toLocaleString('es-CL')} ${item.currency}` : 'Sin monto'}{item.invoice_number?` · Ref. ${item.invoice_number}`:''}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <span className="rounded-full bg-cream2 px-2 py-1 text-xs font-semibold">{paymentLabel[item.status] || item.status}</span>
                    {item.payment_reference && <span className="rounded-full bg-green-50 px-2 py-1 text-xs font-semibold text-green-700">Pago {item.payment_reference}</span>}
                  </div>
                  {item.block_reason && <p className="mt-2 text-sm text-red-700">{item.block_reason}</p>}
                </div>
                <button type="button" className="btn btn-secondary" onClick={() => setExpandedPayment(current => current===item.id?undefined:item.id)}>{expandedPayment===item.id?'Ocultar detalle':'Ver detalle'}</button>
              </div>
              {expandedPayment===item.id && <ContractorPaymentDetail payment={item} showToast={showToast}/>}
            </article>)}
            {data.payments.length === 0 && <div className="rounded-xl border bg-white p-6 text-center text-sm text-gray-500">Todavía no hay estados de pago registrados para este proyecto.</div>}
          </section>}

          {mode === 'soporte' && <div className="grid grid-cols-1 gap-4 lg:grid-cols-[0.9fr_1.4fr]">
            {!readOnly && <form onSubmit={submitTicket} className="rounded-xl border border-cream3 bg-white p-4">
              <h3 className="font-semibold text-navy">Nuevo ticket</h3>
              <p className="mt-1 text-sm text-gray-500">Solicita ayuda dejando el contexto dentro del proyecto activo.</p>
              <label className="mt-3 block text-xs font-semibold text-gray-600">Asunto<input required maxLength={160} value={ticketForm.subject} onChange={event => setTicketForm(current => ({ ...current, subject: event.target.value }))} className="form-input mt-1 w-full" /></label>
              <label className="mt-3 block text-xs font-semibold text-gray-600">Prioridad<select value={ticketForm.priority} onChange={event => setTicketForm(current => ({ ...current, priority: event.target.value }))} className="form-input mt-1 w-full"><option value="baja">Baja</option><option value="normal">Normal</option><option value="alta">Alta</option></select></label>
              <label className="mt-3 block text-xs font-semibold text-gray-600">Descripción<textarea required maxLength={3000} value={ticketForm.description} onChange={event => setTicketForm(current => ({ ...current, description: event.target.value }))} className="form-input mt-1 min-h-[120px] w-full" /></label>
              <button className="btn btn-primary mt-3 w-full justify-center" disabled={savingTicket || !ticketForm.subject.trim() || !ticketForm.description.trim()}><Headphones size={15} /> {savingTicket ? 'Enviando…' : 'Crear ticket'}</button>
            </form>}

            <section className="space-y-3">
              {data.tickets.map(item => (
                <article key={item.id} className="rounded-xl border border-cream3 bg-white p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div><div className="flex flex-wrap items-center gap-2"><strong className="text-navy">{item.subject}</strong><span className="rounded-full bg-cream2 px-2 py-0.5 text-[11px] font-semibold text-gray-600">{ticketLabel[item.status] || item.status}</span></div><p className="mt-1 text-sm text-gray-600">{item.resolution || item.description}</p><small className="mt-1 block text-gray-500">Prioridad {item.priority} · creado {new Date(item.created_at).toLocaleString('es-CL')}</small></div>
                    <button type="button" className="btn btn-secondary" onClick={() => setExpandedTicket(current => current === item.id ? undefined : item.id)}>{expandedTicket === item.id ? 'Ocultar' : 'Conversación'}</button>
                  </div>
                  {expandedTicket === item.id && <ContractorTicketConversation ticketId={item.id} readOnly={readOnly} showToast={showToast} />}
                </article>
              ))}
              {data.tickets.length === 0 && <div className="rounded-xl border bg-white p-6 text-sm text-gray-500">No tienes tickets en este proyecto.</div>}
            </section>
          </div>}
        </>
      )}
    </div>
  );
}
