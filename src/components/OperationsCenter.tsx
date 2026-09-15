import { useEffect, useState, type FormEvent } from 'react';
import { Banknote, ClipboardCheck, Headphones, Plug, Plus, RefreshCw } from 'lucide-react';
import type { Contratista, Proyecto } from '../types';
import {
  createEvaluation,
  createPayment,
  createTicket,
  loadOperations,
  updatePaymentStatus,
  updateTicketStatus,
  type EvaluationRecord,
  type PaymentRecord,
  type TicketRecord,
} from '../data/supabaseOperations';
import { EvaluationActionPlans, PaymentApprovals, TicketConversation } from './OperationsWorkflowPanels';
import IntegrationsPanel from './IntegrationsPanel';

type Mode = 'evaluacion' | 'pago' | 'ticket' | 'integracion';

export default function OperationsCenter({
  project,
  contractors,
  showToast,
}: {
  project: Proyecto;
  contractors: Contratista[];
  showToast: (message: string, type?: 'success' | 'error' | 'warning') => void;
}) {
  const [data, setData] = useState<{ evaluations: EvaluationRecord[]; payments: PaymentRecord[]; tickets: TicketRecord[] }>({ evaluations: [], payments: [], tickets: [] });
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<Mode>('evaluacion');
  const [expanded, setExpanded] = useState<string>();
  const [contractor, setContractor] = useState(contractors[0]?.id || '');
  const [start, setStart] = useState(new Date().toISOString().slice(0, 8) + '01');
  const [end, setEnd] = useState(new Date().toISOString().slice(0, 10));
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [scores, setScores] = useState({ safety: 80, quality: 80, labor: 80, compliance: 80 });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try { setData(await loadOperations(project.id)); }
    catch (error) { showToast(error instanceof Error ? error.message : 'No fue posible cargar la operación avanzada.', 'error'); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, [project.id]);
  useEffect(() => { if (!contractor && contractors[0]) setContractor(contractors[0].id); }, [contractors, contractor]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (saving || mode === 'integracion') return;
    setSaving(true);
    try {
      if (mode === 'evaluacion') {
        await createEvaluation(project.id, contractor, { start, end, ...scores, observations: description });
      } else if (mode === 'pago') {
        await createPayment(project.id, contractor, { start, end, amount: amount ? Number(amount) : undefined, status: 'observado', reason: description, invoiceNumber: invoiceNumber || undefined });
      } else {
        await createTicket(project.id, contractor || undefined, { subject, description, priority: 'normal', category: 'operacion' });
      }
      setSubject(''); setDescription(''); setAmount(''); setInvoiceNumber('');
      await load();
      showToast(mode === 'evaluacion' ? 'Evaluación publicada.' : mode === 'pago' ? 'Estado de pago creado y pendiente de decisión.' : 'Ticket creado.');
    } catch (error) { showToast(error instanceof Error ? error.message : 'No fue posible guardar.', 'error'); }
    finally { setSaving(false); }
  };

  const changePayment = async (id: string, status: 'retenido' | 'liberado' | 'pagado') => {
    const reason = status === 'retenido' ? window.prompt('Motivo de la retención:') || '' : undefined;
    if (status === 'retenido' && !reason) return;
    try { await updatePaymentStatus(id, status, reason); await load(); showToast(`Estado de pago ${status}.`); }
    catch (error) { showToast(error instanceof Error ? error.message : 'No fue posible actualizar el pago.', 'error'); }
  };

  const changeTicket = async (id: string, status: 'en_progreso' | 'resuelto' | 'cerrado') => {
    const resolution = status === 'resuelto' || status === 'cerrado' ? window.prompt('Resolución aplicada:') || '' : undefined;
    if ((status === 'resuelto' || status === 'cerrado') && !resolution) return;
    try { await updateTicketStatus(id, status, resolution); await load(); showToast(`Ticket ${status.replace('_', ' ')}.`); }
    catch (error) { showToast(error instanceof Error ? error.message : 'No fue posible actualizar el ticket.', 'error'); }
  };

  const openDetail = (key: string) => setExpanded(current => current === key ? undefined : key);

  return <article className="mandante-proyectos-section-card mandante-proyectos-panel">
    <div className="mandante-proyectos-section-head"><div><h2>Operación avanzada</h2><p>Evaluación y riesgo, planes de acción, pagos con aprobaciones, soporte conversacional e integraciones auditables.</p></div><button type="button" onClick={() => void load()}><RefreshCw />Actualizar</button></div>

    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 my-4">
      <button type="button" onClick={() => { setMode('evaluacion'); setExpanded(undefined); }} className="rounded-lg border p-4 text-left"><ClipboardCheck /><strong className="block">Evaluaciones</strong><span>{data.evaluations.length} registradas</span></button>
      <button type="button" onClick={() => { setMode('pago'); setExpanded(undefined); }} className="rounded-lg border p-4 text-left"><Banknote /><strong className="block">Estados de pago</strong><span>{data.payments.length} períodos</span></button>
      <button type="button" onClick={() => { setMode('ticket'); setExpanded(undefined); }} className="rounded-lg border p-4 text-left"><Headphones /><strong className="block">Soporte</strong><span>{data.tickets.filter(item => !['resuelto', 'cerrado'].includes(item.status)).length} abiertos</span></button>
      <button type="button" onClick={() => { setMode('integracion'); setExpanded(undefined); }} className="rounded-lg border p-4 text-left"><Plug /><strong className="block">Integraciones</strong><span>Configuración e historial</span></button>
    </div>

    {mode !== 'integracion' && <form onSubmit={submit} className="border rounded-xl p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
      <h3 className="sm:col-span-2 font-semibold text-navy">{mode === 'evaluacion' ? 'Nueva evaluación' : mode === 'pago' ? 'Nuevo estado de pago' : 'Nuevo ticket'}</h3>
      <label className="text-sm">Contratista<select required={mode !== 'ticket'} value={contractor} onChange={event => setContractor(event.target.value)} className="form-input w-full mt-1 p-2 border rounded"><option value="">Proyecto general</option>{contractors.map(item => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select></label>
      {mode !== 'ticket' && <><label className="text-sm">Inicio<input type="date" required value={start} onChange={event => setStart(event.target.value)} className="form-input w-full mt-1 p-2 border rounded" /></label><label className="text-sm">Término<input type="date" required value={end} onChange={event => setEnd(event.target.value)} className="form-input w-full mt-1 p-2 border rounded" /></label></>}
      {mode === 'evaluacion' && <div className="sm:col-span-2 grid grid-cols-2 sm:grid-cols-4 gap-2">{Object.entries(scores).map(([key, value]) => <label className="text-sm" key={key}>{key === 'safety' ? 'Seguridad' : key === 'quality' ? 'Calidad' : key === 'labor' ? 'Laboral' : 'Cumplimiento'}<input type="number" min="0" max="100" value={value} onChange={event => setScores({ ...scores, [key]: Number(event.target.value) })} className="form-input w-full mt-1 p-2 border rounded" /></label>)}</div>}
      {mode === 'pago' && <><label className="text-sm">Monto CLP<input type="number" min="0" value={amount} onChange={event => setAmount(event.target.value)} className="form-input w-full mt-1 p-2 border rounded" /></label><label className="text-sm">N° factura / referencia<input value={invoiceNumber} onChange={event => setInvoiceNumber(event.target.value)} className="form-input w-full mt-1 p-2 border rounded" /></label></>}
      {mode === 'ticket' && <label className="sm:col-span-2 text-sm">Asunto<input required value={subject} onChange={event => setSubject(event.target.value)} className="form-input w-full mt-1 p-2 border rounded" /></label>}
      <label className="sm:col-span-2 text-sm">{mode === 'ticket' ? 'Descripción' : 'Observaciones'}<textarea required={mode === 'ticket'} value={description} onChange={event => setDescription(event.target.value)} className="form-input w-full mt-1 p-2 border rounded" /></label>
      <button className="btn btn-primary sm:col-span-2" type="submit" disabled={saving}><Plus />{saving ? 'Guardando…' : 'Guardar'}</button>
    </form>}

    {mode === 'integracion' ? <IntegrationsPanel projectKey={project.id} showToast={showToast} /> : <div className="mt-5 mandante-proyectos-table-wrap"><table><thead><tr><th>Tipo</th><th>Período / asunto</th><th>Resultado</th><th>Estado y acciones</th></tr></thead><tbody>
      {mode === 'evaluacion' && data.evaluations.map(item => <tr key={item.id}><td>Evaluación</td><td>{item.period_start} — {item.period_end}</td><td>{item.total_score}% · Riesgo {item.risk_level}</td><td><strong className="block capitalize">{item.status}</strong><button type="button" onClick={() => openDetail(`eval:${item.id}`)}>Planes de acción</button>{expanded === `eval:${item.id}` && <EvaluationActionPlans evaluationId={item.id} showToast={showToast} />}</td></tr>)}
      {mode === 'pago' && data.payments.map(item => <tr key={item.id}><td>Pago</td><td>{item.period_start} — {item.period_end}{item.invoice_number && <small className="block text-gray-500">Ref. {item.invoice_number}</small>}</td><td>{item.amount ? `${Number(item.amount).toLocaleString('es-CL')} ${item.currency}` : 'Sin monto'}{item.block_reason && <small className="block text-red-700">{item.block_reason}</small>}</td><td><strong className="block capitalize">{item.status}</strong><div className="flex flex-wrap gap-2 mt-1"><button type="button" onClick={() => openDetail(`pay:${item.id}`)}>Aprobaciones</button><button type="button" onClick={() => void changePayment(item.id, 'retenido')}>Retener</button><button type="button" onClick={() => void changePayment(item.id, 'liberado')}>Liberar</button><button type="button" onClick={() => void changePayment(item.id, 'pagado')}>Pagado</button></div>{expanded === `pay:${item.id}` && <PaymentApprovals paymentId={item.id} showToast={showToast} onChanged={() => void load()} />}</td></tr>)}
      {mode === 'ticket' && data.tickets.map(item => <tr key={item.id}><td>{item.category}</td><td>{item.subject}<small className="block text-gray-500">{item.resolution || item.description}</small></td><td>{item.priority}</td><td><strong className="block capitalize">{item.status.replace('_', ' ')}</strong><div className="flex flex-wrap gap-2 mt-1"><button type="button" onClick={() => openDetail(`ticket:${item.id}`)}>Conversación</button><button type="button" onClick={() => void changeTicket(item.id, 'en_progreso')}>Tomar</button><button type="button" onClick={() => void changeTicket(item.id, 'resuelto')}>Resolver</button><button type="button" onClick={() => void changeTicket(item.id, 'cerrado')}>Cerrar</button></div>{expanded === `ticket:${item.id}` && <TicketConversation ticketId={item.id} showToast={showToast} />}</td></tr>)}
    </tbody></table>{loading && <p className="p-4 text-sm text-gray-500">Cargando operación…</p>}</div>}
  </article>;
}
