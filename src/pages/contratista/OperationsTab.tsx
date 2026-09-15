import { useEffect, useState, type FormEvent } from 'react';
import {
  Banknote,
  CheckCircle2,
  ClipboardCheck,
  Headphones,
  MessageSquare,
  PlayCircle,
  RefreshCw,
  Send,
} from 'lucide-react';
import type { Contratista, Proyecto } from '../../types';
import {
  createTicket,
  listActionPlans,
  listTicketMessages,
  loadOperations,
  sendTicketMessage,
  type ActionPlanRecord,
  type EvaluationRecord,
  type PaymentRecord,
  type TicketMessageRecord,
  type TicketRecord,
} from '../../data/supabaseOperations';
import { updateContractorActionPlan } from '../../data/contractorOperations';

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
  completado: 'Completado',
  cancelado: 'Cancelado',
};

function ContractorActionPlans({
  evaluationId,
  showToast,
}: {
  evaluationId: string;
  showToast: (message: string, type?: 'success' | 'error' | 'warning') => void;
}) {
  const [items, setItems] = useState<ActionPlanRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string>();
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
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'No fue posible cargar los planes de acción.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [evaluationId]);

  const change = async (item: ActionPlanRecord, status: 'en_progreso' | 'completado') => {
    const comment = evidence[item.id]?.trim() || '';
    if (status === 'completado' && comment.length < 3) {
      showToast('Agrega evidencia o un comentario de cierre antes de completar el plan.', 'warning');
      return;
    }
    setSavingId(item.id);
    try {
      await updateContractorActionPlan(item.id, status, comment || undefined);
      await load();
      showToast(status === 'completado' ? 'Plan de acción completado con evidencia.' : 'Plan de acción marcado en progreso.');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'No fue posible actualizar el plan de acción.', 'error');
    } finally {
      setSavingId(undefined);
    }
  };

  const saveEvidence = async (item: ActionPlanRecord) => {
    const comment = evidence[item.id]?.trim() || '';
    if (!comment) {
      showToast('Escribe una evidencia o comentario antes de guardar.', 'warning');
      return;
    }
    setSavingId(item.id);
    try {
      await updateContractorActionPlan(item.id, 'en_progreso', comment);
      await load();
      showToast('Evidencia guardada.');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'No fue posible guardar la evidencia.', 'error');
    } finally {
      setSavingId(undefined);
    }
  };

  if (loading) return <div className="rounded-lg border p-3 text-sm text-gray-500">Cargando planes de acción…</div>;
  if (items.length === 0) return <div className="rounded-lg border p-3 text-sm text-gray-500">Esta evaluación no tiene planes de acción asociados.</div>;

  return (
    <div className="space-y-3">
      {items.map(item => {
        const editable = item.status === 'pendiente' || item.status === 'en_progreso';
        return (
          <div key={item.id} className="rounded-xl border border-cream3 bg-white p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <strong className="text-navy">{item.title}</strong>
                  <span className="rounded-full bg-cream2 px-2 py-0.5 text-[11px] font-semibold text-gray-600">{planLabel[item.status]}</span>
                </div>
                <p className="mt-1 text-sm text-gray-600">{item.description}</p>
                <small className="mt-1 block text-gray-500">
                  {item.owner_name ? `Responsable: ${item.owner_name}` : 'Sin responsable definido'}
                  {item.due_date ? ` · vence ${item.due_date}` : ''}
                </small>
              </div>
              {item.status === 'pendiente' && (
                <button type="button" className="btn btn-secondary" disabled={savingId === item.id} onClick={() => void change(item, 'en_progreso')}>
                  <PlayCircle size={15} /> Iniciar
                </button>
              )}
            </div>

            {editable && (
              <div className="mt-3 rounded-lg bg-cream2/60 p-3">
                <label className="block text-xs font-semibold text-gray-600">Evidencia o comentario de avance</label>
                <textarea
                  value={evidence[item.id] || ''}
                  maxLength={4000}
                  onChange={event => setEvidence(current => ({ ...current, [item.id]: event.target.value }))}
                  className="form-input mt-1 min-h-[84px] w-full"
                  placeholder="Describe la acción realizada, adjunta una referencia o deja el comentario de cierre…"
                />
                <div className="mt-2 flex flex-wrap justify-end gap-2">
                  <button type="button" className="btn btn-secondary" disabled={savingId === item.id || !(evidence[item.id] || '').trim()} onClick={() => void saveEvidence(item)}>Guardar evidencia</button>
                  <button type="button" className="btn btn-primary" disabled={savingId === item.id || (evidence[item.id] || '').trim().length < 3} onClick={() => void change(item, 'completado')}>
                    <CheckCircle2 size={15} /> Completar
                  </button>
                </div>
              </div>
            )}

            {!editable && item.evidence && (
              <div className="mt-3 rounded-lg border border-green-100 bg-green-50 p-3 text-sm text-green-800">
                <strong>Evidencia:</strong> {item.evidence}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ContractorTicketConversation({
  ticketId,
  showToast,
}: {
  ticketId: string;
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
    if (!body.trim() || saving) return;
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
      <form onSubmit={submit} className="mt-3 flex flex-col gap-2 sm:flex-row">
        <textarea required maxLength={3000} value={body} onChange={event => setBody(event.target.value)} className="form-input min-h-[70px] flex-1" placeholder="Escribe una respuesta para Mandante/Acredita…" />
        <button className="btn btn-primary self-end" disabled={saving || !body.trim()}><Send size={15} /> Enviar</button>
      </form>
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
  const [expandedTicket, setExpandedTicket] = useState<string>();
  const [ticketForm, setTicketForm] = useState({ subject: '', description: '', priority: 'normal' });
  const [savingTicket, setSavingTicket] = useState(false);

  const project = proyectos.find(item => item.id === selectedProyectoId) || proyectos[0];

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

  const submitTicket = async (event: FormEvent) => {
    event.preventDefault();
    if (!project || !ticketForm.subject.trim() || !ticketForm.description.trim() || savingTicket) return;
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
              <select value={project.id} onChange={event => { setSelectedProyectoId(event.target.value); setExpandedEvaluation(undefined); setExpandedTicket(undefined); }} className="form-input mt-1 block min-w-[220px]">
                {proyectos.map(item => <option key={item.id} value={item.id}>{item.nombre}</option>)}
              </select>
            </label>
            <button type="button" aria-label="Actualizar operación" className="mt-5 p-2 text-gray-500 hover:text-navy" onClick={() => void load()}><RefreshCw size={17} /></button>
          </div>
        </div>
      </section>

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
                    <div className="mt-1 text-sm text-gray-500">Puntaje total: {item.total_score}% · Riesgo {item.risk_level || 'sin clasificar'} · {item.status}</div>
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
                {expandedEvaluation === item.id && <div className="mt-4"><ContractorActionPlans evaluationId={item.id} showToast={showToast} /></div>}
              </article>
            ))}
            {data.evaluations.length === 0 && <div className="rounded-xl border bg-white p-6 text-sm text-gray-500">Todavía no hay evaluaciones publicadas para este proyecto.</div>}
          </section>}

          {mode === 'pagos' && <section className="rounded-xl border border-cream3 bg-white p-4">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] text-left text-sm">
                <thead><tr className="border-b text-xs uppercase tracking-wide text-gray-500"><th className="p-2">Período</th><th className="p-2">Monto</th><th className="p-2">Referencia</th><th className="p-2">Estado</th><th className="p-2">Observación</th></tr></thead>
                <tbody>{data.payments.map(item => <tr key={item.id} className="border-b last:border-0"><td className="p-2">{item.period_start} — {item.period_end}</td><td className="p-2">{item.amount ? `$${Number(item.amount).toLocaleString('es-CL')} ${item.currency}` : 'Sin monto'}</td><td className="p-2">{item.invoice_number || '—'}</td><td className="p-2"><strong>{paymentLabel[item.status] || item.status}</strong></td><td className="p-2 text-gray-500">{item.block_reason || (item.status === 'pagado' ? 'Pago registrado' : 'Sin observaciones')}</td></tr>)}</tbody>
              </table>
            </div>
            {data.payments.length === 0 && <p className="p-4 text-center text-sm text-gray-500">Todavía no hay estados de pago registrados para este proyecto.</p>}
          </section>}

          {mode === 'soporte' && <div className="grid grid-cols-1 gap-4 lg:grid-cols-[0.9fr_1.4fr]">
            <form onSubmit={submitTicket} className="rounded-xl border border-cream3 bg-white p-4">
              <h3 className="font-semibold text-navy">Nuevo ticket</h3>
              <p className="mt-1 text-sm text-gray-500">Solicita ayuda dejando el contexto dentro del proyecto activo.</p>
              <label className="mt-3 block text-xs font-semibold text-gray-600">Asunto<input required maxLength={160} value={ticketForm.subject} onChange={event => setTicketForm(current => ({ ...current, subject: event.target.value }))} className="form-input mt-1 w-full" /></label>
              <label className="mt-3 block text-xs font-semibold text-gray-600">Prioridad<select value={ticketForm.priority} onChange={event => setTicketForm(current => ({ ...current, priority: event.target.value }))} className="form-input mt-1 w-full"><option value="baja">Baja</option><option value="normal">Normal</option><option value="alta">Alta</option></select></label>
              <label className="mt-3 block text-xs font-semibold text-gray-600">Descripción<textarea required maxLength={3000} value={ticketForm.description} onChange={event => setTicketForm(current => ({ ...current, description: event.target.value }))} className="form-input mt-1 min-h-[120px] w-full" /></label>
              <button className="btn btn-primary mt-3 w-full justify-center" disabled={savingTicket || !ticketForm.subject.trim() || !ticketForm.description.trim()}><Headphones size={15} /> {savingTicket ? 'Enviando…' : 'Crear ticket'}</button>
            </form>

            <section className="space-y-3">
              {data.tickets.map(item => (
                <article key={item.id} className="rounded-xl border border-cream3 bg-white p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div><div className="flex flex-wrap items-center gap-2"><strong className="text-navy">{item.subject}</strong><span className="rounded-full bg-cream2 px-2 py-0.5 text-[11px] font-semibold text-gray-600">{ticketLabel[item.status] || item.status}</span></div><p className="mt-1 text-sm text-gray-600">{item.resolution || item.description}</p><small className="mt-1 block text-gray-500">Prioridad {item.priority} · creado {new Date(item.created_at).toLocaleString('es-CL')}</small></div>
                    <button type="button" className="btn btn-secondary" onClick={() => setExpandedTicket(current => current === item.id ? undefined : item.id)}>{expandedTicket === item.id ? 'Ocultar' : 'Conversación'}</button>
                  </div>
                  {expandedTicket === item.id && <ContractorTicketConversation ticketId={item.id} showToast={showToast} />}
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
