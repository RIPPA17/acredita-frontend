import { useEffect, useState, type FormEvent } from 'react';
import { Check, Clock3, FileText, MessageSquare, Plus, RefreshCw, RotateCcw, XCircle } from 'lucide-react';
import { getPaymentCaseCompliance } from '../data/supabasePaymentState';
import {
  createActionPlan,
  createPaymentApproval,
  listActionPlanAttachments,
  listActionPlanEvents,
  listActionPlans,
  listPaymentApprovals,
  listPaymentCaseEvents,
  listTicketMessages,
  openOperationAttachment,
  reviewActionPlan,
  sendTicketMessage,
  type ActionPlanEventRecord,
  type ActionPlanRecord,
  type EvaluationStatus,
  type OperationAttachmentRecord,
  type PaymentApprovalRecord,
  type PaymentCaseEventRecord,
  type PaymentRecord,
  type TicketMessageRecord,
  type TicketStatus,
} from '../data/supabaseOperations';

const planLabel: Record<ActionPlanRecord['status'], string> = {
  pendiente: 'Pendiente',
  en_progreso: 'En progreso',
  en_revision: 'En revisión',
  completado: 'Completado',
  cancelado: 'Cancelado',
};

const isOverdue = (item: ActionPlanRecord) =>
  Boolean(item.due_date && item.due_date < new Date().toISOString().slice(0, 10) && !['completado', 'cancelado'].includes(item.status));

export function EvaluationActionPlans({
  evaluationId,
  evaluationStatus,
  readOnly = false,
  showToast,
  onChanged,
}: {
  evaluationId: string;
  evaluationStatus: EvaluationStatus;
  readOnly?: boolean;
  showToast: (message: string, type?: 'success'|'error'|'warning') => void;
  onChanged?: () => void;
}) {
  const [items, setItems] = useState<ActionPlanRecord[]>([]);
  const [events, setEvents] = useState<Record<string, ActionPlanEventRecord[]>>({});
  const [attachments, setAttachments] = useState<Record<string, OperationAttachmentRecord[]>>({});
  const [saving, setSaving] = useState(false);
  const [savingId, setSavingId] = useState<string>();
  const [form, setForm] = useState({ title: '', description: '', ownerName: '', dueDate: '' });

  const load = async () => {
    try {
      const next = await listActionPlans(evaluationId);
      setItems(next);
      const details = await Promise.all(next.map(async item => ({
        id: item.id,
        events: await listActionPlanEvents(item.id),
        attachments: await listActionPlanAttachments(item.id),
      })));
      setEvents(Object.fromEntries(details.map(item => [item.id, item.events])));
      setAttachments(Object.fromEntries(details.map(item => [item.id, item.attachments])));
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'No fue posible cargar planes de acción.', 'error');
    }
  };

  useEffect(() => { void load(); }, [evaluationId]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (readOnly || evaluationStatus === 'cerrada' || saving) return;
    if (!form.title.trim() || !form.description.trim() || !form.ownerName.trim() || !form.dueDate) {
      showToast('Título, descripción, responsable y fecha límite son obligatorios.', 'warning');
      return;
    }
    setSaving(true);
    try {
      await createActionPlan(evaluationId, {
        title: form.title.trim(),
        description: form.description.trim(),
        ownerName: form.ownerName.trim(),
        dueDate: form.dueDate,
      });
      setForm({ title: '', description: '', ownerName: '', dueDate: '' });
      await load();
      onChanged?.();
      showToast('Plan de acción creado.');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'No fue posible crear el plan.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const decide = async (item: ActionPlanRecord, decision: 'aprobar' | 'devolver' | 'cancelar' | 'reabrir') => {
    if (readOnly || evaluationStatus === 'cerrada') return;
    let comment: string | undefined;
    if (decision !== 'aprobar') {
      const prompt = decision === 'devolver'
        ? 'Indica qué debe corregir el contratista:'
        : decision === 'cancelar'
          ? 'Motivo de cancelación:'
          : 'Motivo de reapertura:';
      comment = window.prompt(prompt, item.review_comment || '')?.trim();
      if (!comment) return;
    } else {
      comment = window.prompt('Comentario de aprobación (opcional):', '')?.trim() || undefined;
    }
    setSavingId(item.id);
    try {
      await reviewActionPlan(item.id, decision, comment);
      await load();
      onChanged?.();
      showToast(
        decision === 'aprobar' ? 'Evidencia aprobada. El plan quedó completado.'
          : decision === 'devolver' ? 'Plan devuelto al contratista para corrección.'
            : decision === 'cancelar' ? 'Plan cancelado con fundamento.'
              : 'Plan reabierto.'
      );
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'No fue posible actualizar el plan.', 'error');
    } finally {
      setSavingId(undefined);
    }
  };

  const openAttachment = async (item: OperationAttachmentRecord) => {
    try { await openOperationAttachment(item); }
    catch (error) { showToast(error instanceof Error ? error.message : 'No fue posible abrir la evidencia.', 'error'); }
  };

  return <div className="border rounded-xl p-4 mt-3">
    <div className="flex justify-between items-center gap-2">
      <div>
        <h4 className="font-semibold text-navy">Planes de acción</h4>
        <p className="text-sm text-gray-500">El contratista ejecuta y envía evidencia; Mandante/Acredita valida el cierre.</p>
      </div>
      <button type="button" aria-label="Actualizar planes" onClick={() => void load()}><RefreshCw /></button>
    </div>

    {!readOnly && evaluationStatus !== 'cerrada' && <form onSubmit={submit} className="grid grid-cols-1 sm:grid-cols-4 gap-2 mt-3">
      <input required value={form.title} onChange={e=>setForm({...form,title:e.target.value})} className="form-input p-2 border rounded" placeholder="Acción correctiva"/>
      <input required value={form.ownerName} onChange={e=>setForm({...form,ownerName:e.target.value})} className="form-input p-2 border rounded" placeholder="Responsable"/>
      <input required type="date" min={new Date().toISOString().slice(0,10)} value={form.dueDate} onChange={e=>setForm({...form,dueDate:e.target.value})} className="form-input p-2 border rounded"/>
      <input required value={form.description} onChange={e=>setForm({...form,description:e.target.value})} className="form-input p-2 border rounded" placeholder="Descripción"/>
      <button className="btn btn-primary sm:col-span-4" disabled={saving}><Plus/>Agregar plan</button>
    </form>}

    {evaluationStatus === 'cerrada' && <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-600">Evaluación cerrada · planes en modo histórico.</div>}

    <div className="space-y-3 mt-3">
      {items.map(item => {
        const overdue = isOverdue(item);
        return <div key={item.id} className="border rounded-lg p-3">
          <div className="flex flex-col sm:flex-row justify-between gap-3">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <strong>{item.title}</strong>
                <span className="rounded-full bg-cream2 px-2 py-0.5 text-[11px] font-semibold text-gray-600">{planLabel[item.status]}</span>
                {overdue && <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700"><Clock3 size={11}/>Vencido</span>}
              </div>
              <small className="block text-gray-500">{item.owner_name || 'Sin responsable'}{item.due_date ? ` · vence ${item.due_date}` : ''}</small>
              <span className="text-sm">{item.description}</span>
              {item.evidence && <div className="mt-2 rounded-lg border border-green-100 bg-green-50 p-2 text-sm text-green-800"><strong>Evidencia:</strong> {item.evidence}</div>}
              {item.review_comment && <div className="mt-2 rounded-lg border border-orange-100 bg-orange-50 p-2 text-sm text-orange-800"><strong>Última revisión:</strong> {item.review_comment}</div>}
              {(attachments[item.id] || []).length > 0 && <div className="mt-2 flex flex-wrap gap-2">
                {(attachments[item.id] || []).map(file => <button key={file.id} type="button" className="inline-flex items-center gap-1 rounded border px-2 py-1 text-xs text-navy" onClick={() => void openAttachment(file)}><FileText size={12}/>{file.file_name}</button>)}
              </div>}
            </div>
            {!readOnly && evaluationStatus !== 'cerrada' && <div className="flex flex-wrap gap-2 self-start">
              {item.status === 'en_revision' && <>
                <button type="button" className="btn btn-primary" disabled={savingId===item.id} onClick={() => void decide(item,'aprobar')}><Check size={14}/>Aprobar cierre</button>
                <button type="button" className="btn btn-secondary" disabled={savingId===item.id} onClick={() => void decide(item,'devolver')}>Devolver</button>
              </>}
              {['pendiente','en_progreso'].includes(item.status) && <button type="button" className="btn btn-secondary" disabled={savingId===item.id} onClick={() => void decide(item,'cancelar')}><XCircle size={14}/>Cancelar</button>}
              {['completado','cancelado'].includes(item.status) && <button type="button" className="btn btn-secondary" disabled={savingId===item.id} onClick={() => void decide(item,'reabrir')}><RotateCcw size={14}/>Reabrir</button>}
            </div>}
          </div>

          {(events[item.id] || []).length > 0 && <details className="mt-3">
            <summary className="cursor-pointer text-xs font-semibold text-gray-600">Historial del plan · {(events[item.id] || []).length} evento{(events[item.id] || []).length===1?'':'s'}</summary>
            <div className="mt-2 space-y-1">
              {(events[item.id] || []).map(event => <div key={event.id} className="rounded bg-gray-50 px-2 py-1 text-xs text-gray-600">
                <strong className="capitalize">{event.event_type.replaceAll('_',' ')}</strong> · {new Date(event.created_at).toLocaleString('es-CL')}
                {event.comment ? ` · ${event.comment}` : ''}
              </div>)}
            </div>
          </details>}
        </div>;
      })}
      {items.length===0 && <p className="text-sm text-gray-500">Sin planes de acción.</p>}
    </div>
  </div>;
}

export function PaymentApprovals({
  payment,
  readOnly = false,
  showToast,
  onChanged,
}: {
  payment: PaymentRecord;
  readOnly?: boolean;
  showToast: (message: string, type?: 'success'|'error'|'warning') => void;
  onChanged: () => void;
}) {
  const [items,setItems]=useState<PaymentApprovalRecord[]>([]);
  const [events,setEvents]=useState<PaymentCaseEventRecord[]>([]);
  const [compliance,setCompliance]=useState<Record<string, unknown> | null>(null);
  const [decision,setDecision]=useState<PaymentApprovalRecord['decision']>('aprobado');
  const [comment,setComment]=useState('');
  const [saving,setSaving]=useState(false);

  const load=async()=>{
    try{
      const [approvals, history, context]=await Promise.all([
        listPaymentApprovals(payment.id),
        listPaymentCaseEvents(payment.id),
        getPaymentCaseCompliance(payment.id),
      ]);
      setItems(approvals);
      setEvents(history);
      setCompliance(context);
    }catch(error){
      showToast(error instanceof Error?error.message:'No fue posible cargar el detalle del pago.','error');
    }
  };
  useEffect(()=>{void load();},[payment.id,payment.status]);

  const submit=async(event:FormEvent)=>{
    event.preventDefault();
    if(saving || readOnly || !['observado','retenido'].includes(payment.status)) return;
    if(decision!=='aprobado' && comment.trim().length<3){
      showToast('Indica el fundamento de la observación o rechazo.','warning');
      return;
    }
    setSaving(true);
    try{
      await createPaymentApproval(payment.id,decision,comment||undefined);
      setComment('');
      await load();
      onChanged();
      showToast(decision==='aprobado'?'Pago aprobado y liberado.':'Pago observado/retenido.');
    }catch(error){
      showToast(error instanceof Error?error.message:'No fue posible registrar la decisión.','error');
    }finally{setSaving(false);}
  };

  const eligible=compliance?.eligible===true;
  const reason=String(compliance?.eligibleReason || compliance?.reason || '');
  const periodStatus=String(compliance?.periodStatus || '');
  const compliancePercent=Number(compliance?.compliancePercent || 0);
  const blockedCount=Number(compliance?.paymentBlockedCount || 0);
  const pendingCount=Number(compliance?.paymentPendingCount || 0);
  const decisionOpen=!readOnly && ['observado','retenido'].includes(payment.status);

  return <div className="border rounded-xl p-4 mt-3">
    <h4 className="font-semibold text-navy">Aprobaciones y cumplimiento del pago</h4>
    <p className="text-sm text-gray-500">La liberación solo es posible con el período documental cerrado y un snapshot que habilite pago.</p>

    <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
      <div className="rounded-lg bg-cream2 p-2"><span className="block text-gray-500">Período</span><strong className="capitalize">{periodStatus || '—'}</strong></div>
      <div className="rounded-lg bg-cream2 p-2"><span className="block text-gray-500">Cumplimiento</span><strong>{compliancePercent}%</strong></div>
      <div className="rounded-lg bg-cream2 p-2"><span className="block text-gray-500">Bloqueos</span><strong>{blockedCount}</strong></div>
      <div className="rounded-lg bg-cream2 p-2"><span className="block text-gray-500">Pendientes</span><strong>{pendingCount}</strong></div>
    </div>
    <div className={`mt-2 rounded-lg border p-3 text-sm ${eligible?'border-green-200 bg-green-50 text-green-800':'border-orange-200 bg-orange-50 text-orange-800'}`}>
      <strong>{eligible?'Período habilitado para pago.':'Pago aún no habilitado.'}</strong>
      {reason && <span> {reason}</span>}
    </div>

    {decisionOpen && <form onSubmit={submit} className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-3">
      <select value={decision} onChange={e=>setDecision(e.target.value as PaymentApprovalRecord['decision'])} className="form-input p-2 border rounded">
        <option value="aprobado">Aprobar y liberar</option>
        <option value="observado">Observar / retener</option>
        <option value="rechazado">Rechazar / retener</option>
      </select>
      <input value={comment} onChange={e=>setComment(e.target.value)} className="form-input p-2 border rounded sm:col-span-2" placeholder={decision==='aprobado'?'Comentario opcional':'Fundamento obligatorio'}/>
      <button className="btn btn-primary sm:col-span-3" disabled={saving || (decision==='aprobado' && !eligible)}>Registrar decisión</button>
    </form>}

    {!decisionOpen && <div className="mt-3 rounded-lg border bg-gray-50 p-3 text-sm text-gray-600">
      {payment.status==='liberado' ? 'Pago liberado · ya no admite nuevas aprobaciones. Falta registrar el pago efectivo.'
        : payment.status==='pagado' ? 'Pago finalizado · historial inmutable.'
        : payment.status==='anulado' ? 'Pago anulado · historial inmutable.'
        : readOnly ? 'Modo histórico · solo consulta.'
        : 'Este pago no admite una nueva decisión en su estado actual.'}
    </div>}

    <div className="mt-4 grid gap-3 lg:grid-cols-2">
      <div>
        <h5 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Decisiones</h5>
        <div className="space-y-2 mt-2">{items.map(item=><div key={item.id} className="border rounded-lg p-2 text-sm"><strong className="capitalize">{item.decision}</strong><span className="block text-gray-500">{new Date(item.created_at).toLocaleString('es-CL')}{item.comment?` · ${item.comment}`:''}</span></div>)}{items.length===0&&<p className="text-sm text-gray-500">Aún no hay decisiones registradas.</p>}</div>
      </div>
      <div>
        <h5 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Historial</h5>
        <div className="space-y-2 mt-2">{events.map(item=><div key={item.id} className="border rounded-lg p-2 text-sm"><strong className="capitalize">{item.event_type.replaceAll('_',' ')}</strong><span className="block text-gray-500">{new Date(item.created_at).toLocaleString('es-CL')}{item.reason?` · ${item.reason}`:''}</span></div>)}{events.length===0&&<p className="text-sm text-gray-500">Sin eventos todavía.</p>}</div>
      </div>
    </div>
  </div>;
}

export function TicketConversation({
  ticketId,
  status,
  readOnly = false,
  showToast,
  onChanged,
}: {
  ticketId: string;
  status: TicketStatus;
  readOnly?: boolean;
  showToast: (message: string, type?: 'success'|'error'|'warning') => void;
  onChanged?: () => void | Promise<void>;
}) {
  const [items, setItems] = useState<TicketMessageRecord[]>([]);
  const [body, setBody] = useState('');
  const [internal, setInternal] = useState(false);
  const [saving, setSaving] = useState(false);
  const closed = status === 'cerrado';

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
    if (!body.trim() || saving || readOnly || closed) return;
    setSaving(true);
    try {
      await sendTicketMessage(ticketId, body, internal);
      setBody('');
      setInternal(false);
      await load();
      await onChanged?.();
      showToast('Mensaje enviado.');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'No fue posible enviar el mensaje.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return <div className="border rounded-xl p-4 mt-3">
    <div className="flex gap-2 items-center"><MessageSquare/><h4 className="font-semibold text-navy">Conversación del ticket</h4></div>
    <div className="space-y-2 my-3 max-h-56 overflow-y-auto">
      {items.map(item=><div key={item.id} className="border rounded-lg p-2 text-sm"><span>{item.body}</span><small className="block text-gray-500">{new Date(item.created_at).toLocaleString('es-CL')}{item.is_internal?' · Nota interna':''}</small></div>)}
      {items.length===0&&<p className="text-sm text-gray-500">Sin mensajes todavía.</p>}
    </div>
    {closed && <p className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-600">Ticket cerrado. La conversación queda disponible como historial y no admite nuevas respuestas.</p>}
    {status === 'resuelto' && !readOnly && <p className="mb-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">El ticket está resuelto. Reábrelo antes de continuar la conversación.</p>}
    {!readOnly && !closed && status !== 'resuelto' && <form onSubmit={submit} className="grid grid-cols-1 gap-2">
      <textarea required maxLength={5000} value={body} onChange={e=>setBody(e.target.value)} className="form-input p-2 border rounded" placeholder="Escribe una respuesta…"/>
      <label className="text-sm inline-flex gap-2 items-center"><input type="checkbox" checked={internal} onChange={e=>setInternal(e.target.checked)}/> Nota interna para Mandante/Acredita</label>
      <button className="btn btn-primary" disabled={saving || !body.trim()}>Enviar mensaje</button>
    </form>}
  </div>;
}
