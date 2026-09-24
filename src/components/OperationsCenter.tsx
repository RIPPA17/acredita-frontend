import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Archive, Banknote, ClipboardCheck, Headphones, Pencil, Plug, Plus, RefreshCw, RotateCcw, Send, X } from 'lucide-react';
import type { Contratista, Proyecto } from '../types';
import {
  createEvaluation,
  createPayment,
  createTicket,
  listEvaluationEvents,
  loadOperations,
  setEvaluationStatus,
  updateEvaluationDraft,
  updatePaymentDetails,
  updateTicketStatus,
  type CompliancePeriodRecord,
  type EvaluationEventRecord,
  type EvaluationRecord,
  type PaymentRecord,
  type TicketRecord,
  type TicketStatus,
} from '../data/supabaseOperations';
import { closeCompliancePeriod, markPaymentPaid, reopenCompliancePeriod, voidPaymentCase } from '../data/supabasePaymentState';
import { EvaluationActionPlans, PaymentApprovals, TicketConversation } from './OperationsWorkflowPanels';
import IntegrationsPanel from './IntegrationsPanel';
import { proyectoOperativoParaContratista } from '../data/operationalCore';

type Mode = 'evaluacion' | 'pago' | 'ticket' | 'integracion';
export type OperationsCenterFocus = { mode: Exclude<Mode, 'integracion'>; itemId?: string };

const evaluationLabel: Record<EvaluationRecord['status'], string> = {
  borrador: 'Borrador',
  publicada: 'Publicada',
  cerrada: 'Cerrada',
};

function EvaluationHistory({
  evaluationId,
  showToast,
}: {
  evaluationId: string;
  showToast: (message: string, type?: 'success' | 'error' | 'warning') => void;
}) {
  const [events, setEvents] = useState<EvaluationEventRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listEvaluationEvents(evaluationId)
      .then(items => { if (!cancelled) setEvents(items); })
      .catch(error => { if (!cancelled) showToast(error instanceof Error ? error.message : 'No fue posible cargar el historial de evaluación.', 'error'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [evaluationId]);

  if (loading) return <p className="mt-3 text-xs text-gray-500">Cargando historial…</p>;
  if (!events.length) return <p className="mt-3 text-xs text-gray-500">Aún no hay eventos registrados.</p>;

  return <details className="mt-4 rounded-lg border bg-gray-50 p-3">
    <summary className="cursor-pointer text-xs font-semibold text-gray-700">Historial de la evaluación · {events.length} evento{events.length === 1 ? '' : 's'}</summary>
    <div className="mt-2 space-y-1">
      {events.map(event => <div key={event.id} className="rounded bg-white px-2 py-1 text-xs text-gray-600">
        <strong className="capitalize">{event.event_type}</strong> · {new Date(event.created_at).toLocaleString('es-CL')}
        {event.reason ? ` · ${event.reason}` : ''}
      </div>)}
    </div>
  </details>;
}

export default function OperationsCenter({
  project,
  contractors,
  showToast,
  focus,
}: {
  project: Proyecto;
  contractors: Contratista[];
  showToast: (message: string, type?: 'success' | 'error' | 'warning') => void;
  focus?: OperationsCenterFocus | null;
}) {
  const [data, setData] = useState<{ evaluations: EvaluationRecord[]; payments: PaymentRecord[]; periods: CompliancePeriodRecord[]; tickets: TicketRecord[] }>({ evaluations: [], payments: [], periods: [], tickets: [] });
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<Mode>('evaluacion');
  const [expanded, setExpanded] = useState<string>();
  const operationalContractors = useMemo(
    () => contractors.filter(item => proyectoOperativoParaContratista(project, item.id)),
    [contractors, project],
  );
  const readOnlyProject = !['activo', 'active'].includes(String(project.estado || '').trim().toLocaleLowerCase('es'));
  const [contractor, setContractor] = useState(operationalContractors[0]?.id || '');
  const [start, setStart] = useState(new Date().toISOString().slice(0, 8) + '01');
  const [end, setEnd] = useState(new Date().toISOString().slice(0, 10));
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [paymentPeriodId, setPaymentPeriodId] = useState('');
  const [paymentSavingId, setPaymentSavingId] = useState<string>();
  const [scores, setScores] = useState({ safety: 80, quality: 80, labor: 80, compliance: 80 });
  const [editingEvaluationId, setEditingEvaluationId] = useState<string>();
  const [saving, setSaving] = useState(false);
  const [evaluationSavingId, setEvaluationSavingId] = useState<string>();

  const load = async () => {
    setLoading(true);
    try { setData(await loadOperations(project.id)); }
    catch (error) { showToast(error instanceof Error ? error.message : 'No fue posible cargar la operación avanzada.', 'error'); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, [project.id]);
  useEffect(() => {
    if (!operationalContractors.some(item => item.id === contractor)) {
      setContractor(operationalContractors[0]?.id || '');
    }
  }, [operationalContractors, contractor]);
  useEffect(() => {
    if (!focus) return;
    setMode(focus.mode);
    if (!focus.itemId) {
      setExpanded(undefined);
      return;
    }
    const exists = focus.mode === 'pago'
      ? data.payments.some(item => item.id === focus.itemId)
      : focus.mode === 'ticket'
        ? data.tickets.some(item => item.id === focus.itemId)
        : data.evaluations.some(item => item.id === focus.itemId);
    if (!exists) return;
    const prefix = focus.mode === 'pago' ? 'pay' : focus.mode === 'ticket' ? 'ticket' : 'eval';
    setExpanded(`${prefix}:${focus.itemId}`);
  }, [focus?.mode, focus?.itemId, data.evaluations, data.payments, data.tickets]);

  const today = new Date().toISOString().slice(0,10);
  const selectablePeriods = data.periods.filter(period => period.period_start <= today);
  const usedPeriodIds = new Set(data.payments.filter(item => item.contratista_id === contractor && item.status !== 'anulado').map(item => item.compliance_period_id));
  const paymentPeriods = selectablePeriods.filter(period => !usedPeriodIds.has(period.id));
  useEffect(() => {
    if (!paymentPeriods.some(period => period.id === paymentPeriodId)) {
      setPaymentPeriodId(paymentPeriods[0]?.id || '');
    }
  }, [contractor, data.periods.length, data.payments.length]);

  const resetEvaluationForm = () => {
    setEditingEvaluationId(undefined);
    setStart(new Date().toISOString().slice(0, 8) + '01');
    setEnd(new Date().toISOString().slice(0, 10));
    setScores({ safety: 80, quality: 80, labor: 80, compliance: 80 });
    setDescription('');
  };

  const editDraft = (item: EvaluationRecord) => {
    if (item.status !== 'borrador' || readOnlyProject) return;
    setEditingEvaluationId(item.id);
    setStart(item.period_start);
    setEnd(item.period_end);
    setScores({
      safety: Number(item.safety_score),
      quality: Number(item.quality_score),
      labor: Number(item.labor_score),
      compliance: Number(item.compliance_score),
    });
    setDescription(item.observations || '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (saving || mode === 'integracion' || readOnlyProject) return;
    if (mode === 'evaluacion' && !editingEvaluationId && !contractor) {
      showToast('Selecciona un contratista con relación activa en el proyecto.', 'warning');
      return;
    }
    setSaving(true);
    try {
      if (mode === 'evaluacion') {
        if (editingEvaluationId) {
          await updateEvaluationDraft(editingEvaluationId, { start, end, ...scores, observations: description });
        } else {
          await createEvaluation(project.id, contractor, { start, end, ...scores, observations: description });
        }
        resetEvaluationForm();
      } else if (mode === 'pago') {
        const period = data.periods.find(item => item.id === paymentPeriodId);
        if (!period) throw new Error('Selecciona un período documental válido.');
        await createPayment(project.id, contractor, {
          period,
          amount: Number(amount),
          invoiceNumber: invoiceNumber || undefined,
          note: description || undefined,
        });
        setDescription(''); setAmount(''); setInvoiceNumber('');
      } else {
        await createTicket(project.id, contractor || undefined, { subject, description, priority: 'normal', category: 'operacion' });
        setSubject(''); setDescription('');
      }
      await load();
      showToast(
        mode === 'evaluacion'
          ? editingEvaluationId ? 'Borrador actualizado.' : 'Evaluación guardada como borrador. Revísala y publícala cuando esté lista.'
          : mode === 'pago' ? 'Estado de pago creado y pendiente de aprobación.'
            : 'Ticket creado.'
      );
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'No fue posible guardar.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const changeEvaluation = async (item: EvaluationRecord, status: 'publicada' | 'cerrada') => {
    if (readOnlyProject) return;
    let reason: string | undefined;
    if (item.status === 'cerrada' && status === 'publicada') {
      reason = window.prompt('Motivo de reapertura de la evaluación:')?.trim();
      if (!reason) return;
    } else if (item.status === 'borrador' && status === 'publicada') {
      if (!window.confirm('Publicar esta evaluación hará visibles sus resultados y planes al Contratista. ¿Continuar?')) return;
    } else if (item.status === 'publicada' && status === 'cerrada') {
      if (!window.confirm('La evaluación solo se cerrará si todos sus planes están completados o cancelados. ¿Continuar?')) return;
    }
    setEvaluationSavingId(item.id);
    try {
      await setEvaluationStatus(item.id, status, reason);
      await load();
      showToast(item.status === 'cerrada' ? 'Evaluación reabierta.' : status === 'cerrada' ? 'Evaluación cerrada.' : 'Evaluación publicada.');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'No fue posible cambiar el estado de la evaluación.', 'error');
    } finally {
      setEvaluationSavingId(undefined);
    }
  };

  const confirmPaid = async (item: PaymentRecord) => {
    if (readOnlyProject || item.accreditation_active === false) return;
    const reference = window.prompt('Referencia del pago (transferencia, comprobante o egreso):', item.payment_reference || '')?.trim();
    if (!reference) return;
    const note = window.prompt('Nota de pago (opcional):', item.payment_note || '')?.trim() || undefined;
    setPaymentSavingId(item.id);
    try {
      await markPaymentPaid(item.id, reference, note);
      await load();
      showToast('Pago marcado como pagado con referencia registrada.');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'No fue posible marcar el pago como pagado.', 'error');
    } finally {
      setPaymentSavingId(undefined);
    }
  };

  const voidPayment = async (item: PaymentRecord) => {
    if (readOnlyProject || item.accreditation_active === false || item.status === 'pagado') return;
    const reason = window.prompt('Motivo de anulación del estado de pago:')?.trim();
    if (!reason) return;
    setPaymentSavingId(item.id);
    try {
      await voidPaymentCase(item.id, reason);
      await load();
      showToast('Estado de pago anulado con trazabilidad.');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'No fue posible anular el pago.', 'error');
    } finally {
      setPaymentSavingId(undefined);
    }
  };

  const editPayment = async (item: PaymentRecord) => {
    if (readOnlyProject || item.accreditation_active === false || !['observado','retenido'].includes(item.status)) return;
    const rawAmount = window.prompt('Monto CLP:', String(item.amount || ''))?.trim();
    if (!rawAmount) return;
    const nextAmount = Number(rawAmount);
    const ref = window.prompt('N° factura / referencia (opcional):', item.invoice_number || '')?.trim() || undefined;
    const note = window.prompt('Nota del estado de pago (opcional):', item.submission_note || '')?.trim() || undefined;
    setPaymentSavingId(item.id);
    try {
      await updatePaymentDetails(item.id, { amount: nextAmount, invoiceNumber: ref, note });
      await load();
      showToast('Datos del estado de pago actualizados.');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'No fue posible actualizar el pago.', 'error');
    } finally {
      setPaymentSavingId(undefined);
    }
  };

  const closePeriod = async (period: CompliancePeriodRecord) => {
    if (readOnlyProject) return;
    if (!window.confirm(`Cerrar el período ${period.period_start} — ${period.period_end} congelará el cumplimiento documental usado para decidir pagos. ¿Continuar?`)) return;
    try {
      await closeCompliancePeriod(period.id);
      await load();
      showToast('Período documental cerrado y snapshot generado.');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'No fue posible cerrar el período.', 'error');
    }
  };

  const reopenPeriod = async (period: CompliancePeriodRecord) => {
    if (readOnlyProject) return;
    const reason = window.prompt('Motivo de reapertura del período:')?.trim();
    if (!reason) return;
    try {
      await reopenCompliancePeriod(period.id, reason);
      await load();
      showToast('Período reabierto. Los pagos liberados de este período volvieron a retenido.');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'No fue posible reabrir el período.', 'error');
    }
  };

  const changeTicket = async (item: TicketRecord, status: TicketStatus) => {
    if (readOnlyProject || item.status === 'cerrado') return;
    const resolution = status === 'resuelto' || status === 'cerrado' ? window.prompt('Resolución aplicada:')?.trim() || '' : undefined;
    if ((status === 'resuelto' || status === 'cerrado') && !resolution) return;
    try {
      await updateTicketStatus(item.id, status, resolution);
      await load();
      const labels: Record<TicketStatus, string> = {
        abierto: 'abierto',
        en_progreso: 'en progreso',
        esperando_usuario: 'esperando respuesta',
        resuelto: 'resuelto',
        cerrado: 'cerrado',
      };
      showToast(`Ticket ${labels[status]}.`);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'No fue posible actualizar el ticket.', 'error');
    }
  };

  const openDetail = (key: string) => setExpanded(current => current === key ? undefined : key);

  return <article className="mandante-proyectos-section-card mandante-proyectos-panel">
    <div className="mandante-proyectos-section-head">
      <div>
        <h2>Operación avanzada</h2>
        <p>Evaluaciones publicadas, planes de acción con validación, pagos gobernados por aprobaciones, soporte e integraciones auditables.</p>
      </div>
      <button type="button" onClick={() => void load()}><RefreshCw />Actualizar</button>
    </div>

    {readOnlyProject && <div className="my-4 rounded-xl border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800"><strong>Proyecto histórico · modo consulta.</strong> Las evaluaciones, planes, pagos y soporte permanecen visibles, pero no admiten nuevas decisiones.</div>}

    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 my-4">
      <button type="button" onClick={() => { setMode('evaluacion'); setExpanded(undefined); }} className="rounded-lg border p-4 text-left"><ClipboardCheck /><strong className="block">Evaluaciones</strong><span>{data.evaluations.length} registradas</span></button>
      <button type="button" onClick={() => { setMode('pago'); setExpanded(undefined); }} className="rounded-lg border p-4 text-left"><Banknote /><strong className="block">Estados de pago</strong><span>{data.payments.length} períodos</span></button>
      <button type="button" onClick={() => { setMode('ticket'); setExpanded(undefined); }} className="rounded-lg border p-4 text-left"><Headphones /><strong className="block">Soporte</strong><span>{data.tickets.filter(item => !['resuelto', 'cerrado'].includes(item.status)).length} abiertos</span></button>
      <button type="button" onClick={() => { setMode('integracion'); setExpanded(undefined); }} className="rounded-lg border p-4 text-left"><Plug /><strong className="block">Integraciones</strong><span>Configuración e historial</span></button>
    </div>

    {!readOnlyProject && mode !== 'integracion' && <form onSubmit={submit} className="border rounded-xl p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div className="sm:col-span-2 flex items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold text-navy">{mode === 'evaluacion' ? editingEvaluationId ? 'Editar borrador de evaluación' : 'Nueva evaluación' : mode === 'pago' ? 'Nuevo estado de pago' : 'Nuevo ticket'}</h3>
          {mode === 'evaluacion' && <p className="mt-1 text-xs text-gray-500">Se guarda primero como borrador. El Contratista solo la verá después de publicarla.</p>}
        </div>
        {mode === 'evaluacion' && editingEvaluationId && <button type="button" className="btn btn-secondary" onClick={resetEvaluationForm}><X size={14}/>Cancelar edición</button>}
      </div>

      {mode === 'evaluacion' && !editingEvaluationId && <label className="text-sm">Contratista
        <select required value={contractor} onChange={event => setContractor(event.target.value)} className="form-input w-full mt-1 p-2 border rounded">
          <option value="">Selecciona</option>
          {operationalContractors.map(item => <option key={item.id} value={item.id}>{item.nombre}</option>)}
        </select>
      </label>}
      {mode === 'pago' && <label className="text-sm">Contratista
        <select required value={contractor} onChange={event => setContractor(event.target.value)} className="form-input w-full mt-1 p-2 border rounded">
          <option value="">Selecciona</option>
          {operationalContractors.map(item => <option key={item.id} value={item.id}>{item.nombre}</option>)}
        </select>
      </label>}
      {mode === 'ticket' && <label className="text-sm">Contratista
        <select value={contractor} onChange={event => setContractor(event.target.value)} className="form-input w-full mt-1 p-2 border rounded">
          <option value="">Proyecto general</option>
          {operationalContractors.map(item => <option key={item.id} value={item.id}>{item.nombre}</option>)}
        </select>
      </label>}

      {mode === 'evaluacion' && <><label className="text-sm">Inicio<input type="date" required value={start} onChange={event => setStart(event.target.value)} className="form-input w-full mt-1 p-2 border rounded" /></label><label className="text-sm">Término<input type="date" required value={end} onChange={event => setEnd(event.target.value)} className="form-input w-full mt-1 p-2 border rounded" /></label></>}
      {mode === 'pago' && <label className="text-sm sm:col-span-2">Período documental
        <select required value={paymentPeriodId} onChange={event => setPaymentPeriodId(event.target.value)} className="form-input w-full mt-1 p-2 border rounded">
          <option value="">Selecciona un período</option>
          {paymentPeriods.map(period => <option key={period.id} value={period.id}>{period.period_start} — {period.period_end} · {period.status}</option>)}
        </select>
      </label>}
      {mode === 'evaluacion' && <div className="sm:col-span-2 grid grid-cols-2 sm:grid-cols-4 gap-2">{Object.entries(scores).map(([key, value]) => <label className="text-sm" key={key}>{key === 'safety' ? 'Seguridad' : key === 'quality' ? 'Calidad' : key === 'labor' ? 'Laboral' : 'Cumplimiento'}<input type="number" min="0" max="100" value={value} onChange={event => setScores({ ...scores, [key]: Number(event.target.value) })} className="form-input w-full mt-1 p-2 border rounded" /></label>)}</div>}
      {mode === 'pago' && <><label className="text-sm">Monto CLP<input required type="number" min="1" value={amount} onChange={event => setAmount(event.target.value)} className="form-input w-full mt-1 p-2 border rounded" /></label><label className="text-sm">N° factura / referencia<input value={invoiceNumber} onChange={event => setInvoiceNumber(event.target.value)} className="form-input w-full mt-1 p-2 border rounded" /></label><p className="sm:col-span-2 text-xs text-gray-500">El pago nace observado y vinculado al período seleccionado. Solo puede liberarse con el período cerrado, cumplimiento habilitado y una aprobación registrada.</p></>}
      {mode === 'ticket' && <label className="sm:col-span-2 text-sm">Asunto<input required value={subject} onChange={event => setSubject(event.target.value)} className="form-input w-full mt-1 p-2 border rounded" /></label>}
      <label className="sm:col-span-2 text-sm">{mode === 'ticket' ? 'Descripción' : 'Observaciones'}<textarea required={mode === 'ticket'} value={description} onChange={event => setDescription(event.target.value)} className="form-input w-full mt-1 p-2 border rounded" /></label>
      <button className="btn btn-primary sm:col-span-2" type="submit" disabled={saving || (mode !== 'ticket' && !editingEvaluationId && !contractor) || (mode === 'pago' && (!paymentPeriodId || !amount || Number(amount)<=0))}><Plus />{saving ? 'Guardando…' : mode === 'evaluacion' ? editingEvaluationId ? 'Guardar cambios del borrador' : 'Guardar borrador' : 'Guardar'}</button>
    </form>}

    {mode === 'pago' && <section className="mt-5 rounded-xl border border-cream3 bg-white p-4">
      <div className="flex items-center justify-between gap-3"><div><h3 className="font-semibold text-navy">Períodos documentales</h3><p className="text-sm text-gray-500">Cerrar un período congela el cumplimiento usado para decidir pagos. Reabrirlo vuelve a retener pagos liberados de ese período.</p></div></div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {selectablePeriods.slice(0,12).map(period => <div key={period.id} className="rounded-lg border p-3 text-sm">
          <strong>{period.period_start} — {period.period_end}</strong>
          <span className="block capitalize text-gray-500">{period.status}</span>
          {period.reopen_reason && <small className="block text-orange-700">Reapertura: {period.reopen_reason}</small>}
          {!readOnlyProject && period.status !== 'cerrado' && period.period_end <= today && <button type="button" className="mt-2" onClick={() => void closePeriod(period)}>Cerrar período</button>}
          {!readOnlyProject && period.status === 'cerrado' && <button type="button" className="mt-2" onClick={() => void reopenPeriod(period)}>Reabrir período</button>}
        </div>)}
      </div>
    </section>}

    {mode === 'integracion' ? <IntegrationsPanel projectKey={project.id} showToast={showToast} readOnly={readOnlyProject} /> : <div className="mt-5 mandante-proyectos-table-wrap">
      <table><thead><tr><th>Tipo</th><th>Período / asunto</th><th>Resultado</th><th>Estado y acciones</th></tr></thead><tbody>
        {mode === 'evaluacion' && data.evaluations.map(item => {
          const evaluationReadOnly = readOnlyProject || item.accreditation_active === false;
          const contractorName = contractors.find(candidate => candidate.id === item.contratista_id)?.nombre || 'Contratista';
          return <tr key={item.id}>
            <td>Evaluación<small className="block text-gray-500">{contractorName}</small></td>
            <td>{item.period_start} — {item.period_end}{item.observations && <small className="block text-gray-500">{item.observations}</small>}</td>
            <td>{item.total_score}% · Riesgo {item.risk_level}</td>
            <td>
              <strong className="block capitalize">{evaluationLabel[item.status]}</strong>
              {item.accreditation_active === false && <small className="block text-gray-500">Relación histórica · solo consulta</small>}
              <div className="mt-1 flex flex-wrap gap-2">
                <button type="button" onClick={() => openDetail(`eval:${item.id}`)}>{expanded === `eval:${item.id}` ? 'Ocultar detalle' : 'Detalle y planes'}</button>
                {!evaluationReadOnly && item.status === 'borrador' && <button type="button" onClick={() => editDraft(item)}><Pencil size={13}/>Editar</button>}
                {!evaluationReadOnly && item.status === 'borrador' && <button type="button" disabled={evaluationSavingId===item.id} onClick={() => void changeEvaluation(item,'publicada')}><Send size={13}/>Publicar</button>}
                {!evaluationReadOnly && item.status === 'publicada' && <button type="button" disabled={evaluationSavingId===item.id} onClick={() => void changeEvaluation(item,'cerrada')}><Archive size={13}/>Cerrar</button>}
                {!evaluationReadOnly && item.status === 'cerrada' && <button type="button" disabled={evaluationSavingId===item.id} onClick={() => void changeEvaluation(item,'publicada')}><RotateCcw size={13}/>Reabrir</button>}
              </div>
              {expanded === `eval:${item.id}` && <div className="mt-4 min-w-[520px]">
                <EvaluationActionPlans evaluationId={item.id} evaluationStatus={item.status} readOnly={evaluationReadOnly} showToast={showToast} onChanged={() => void load()} />
                <EvaluationHistory evaluationId={item.id} showToast={showToast} />
              </div>}
            </td>
          </tr>;
        })}
        {mode === 'pago' && data.payments.map(item => {
          const paymentReadOnly = readOnlyProject || item.accreditation_active === false || ['pagado','anulado'].includes(item.status);
          const contractorName = contractors.find(candidate => candidate.id === item.contratista_id)?.nombre || 'Contratista';
          return <tr key={item.id}>
            <td>Pago<small className="block text-gray-500">{contractorName}</small></td>
            <td>{item.period_start} — {item.period_end}{item.invoice_number && <small className="block text-gray-500">Ref. {item.invoice_number}</small>}{item.submission_note && <small className="block text-gray-500">{item.submission_note}</small>}</td>
            <td>{item.amount ? `${Number(item.amount).toLocaleString('es-CL')} ${item.currency}` : 'Sin monto'}{item.block_reason && <small className="block text-red-700">{item.block_reason}</small>}{item.payment_reference && <small className="block text-green-700">Pago: {item.payment_reference}</small>}</td>
            <td>
              <strong className="block capitalize">{item.status}</strong>
              {item.accreditation_active === false && <small className="block text-gray-500">Relación histórica · solo consulta</small>}
              <div className="flex flex-wrap gap-2 mt-1">
                <button type="button" onClick={() => openDetail(`pay:${item.id}`)}>{expanded === `pay:${item.id}` ? 'Ocultar detalle' : 'Detalle e historial'}</button>
                {!paymentReadOnly && ['observado','retenido'].includes(item.status) && <button type="button" disabled={paymentSavingId===item.id} onClick={() => void editPayment(item)}>Editar datos</button>}
                {!readOnlyProject && item.accreditation_active !== false && item.status === 'liberado' && <button type="button" disabled={paymentSavingId===item.id} onClick={() => void confirmPaid(item)}>Registrar pago</button>}
                {!readOnlyProject && item.accreditation_active !== false && item.status !== 'pagado' && item.status !== 'anulado' && <button type="button" disabled={paymentSavingId===item.id} onClick={() => void voidPayment(item)}>Anular</button>}
              </div>
              {expanded === `pay:${item.id}` && <PaymentApprovals payment={item} readOnly={paymentReadOnly} showToast={showToast} onChanged={() => void load()} />}
            </td>
          </tr>;
        })}
        {mode === 'ticket' && data.tickets.map(item => <tr key={item.id}>
          <td>{item.category}</td>
          <td>{item.subject}<small className="block text-gray-500">{item.resolution || item.description}</small></td>
          <td>{item.priority}</td>
          <td>
            <strong className="block capitalize">{item.status === 'esperando_usuario' ? 'Esperando respuesta' : item.status.replace('_', ' ')}</strong>
            {item.assigned_to && <small className="block text-gray-500">Ticket asignado</small>}
            <div className="flex flex-wrap gap-2 mt-1">
              <button type="button" onClick={() => openDetail(`ticket:${item.id}`)}>Conversación</button>
              {!readOnlyProject && item.status === 'abierto' && <button type="button" onClick={() => void changeTicket(item, 'en_progreso')}>Tomar</button>}
              {!readOnlyProject && item.status === 'en_progreso' && <>
                <button type="button" onClick={() => void changeTicket(item, 'esperando_usuario')}>Esperar respuesta</button>
                <button type="button" onClick={() => void changeTicket(item, 'resuelto')}>Resolver</button>
              </>}
              {!readOnlyProject && item.status === 'esperando_usuario' && <>
                <button type="button" onClick={() => void changeTicket(item, 'en_progreso')}>Retomar</button>
                <button type="button" onClick={() => void changeTicket(item, 'resuelto')}>Resolver</button>
              </>}
              {!readOnlyProject && item.status === 'resuelto' && <>
                <button type="button" onClick={() => void changeTicket(item, 'en_progreso')}>Reabrir</button>
                <button type="button" onClick={() => void changeTicket(item, 'cerrado')}>Cerrar</button>
              </>}
            </div>
            {expanded === `ticket:${item.id}` && <TicketConversation ticketId={item.id} status={item.status} readOnly={readOnlyProject} showToast={showToast} onChanged={load} />}
          </td>
        </tr>)}
      </tbody></table>
      {loading && <p className="p-4 text-sm text-gray-500">Cargando operación…</p>}
      {!loading && mode === 'evaluacion' && data.evaluations.length===0 && <p className="p-4 text-sm text-gray-500">Aún no hay evaluaciones para este proyecto.</p>}
    </div>}
  </article>;
}
