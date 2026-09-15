import { useEffect, useState, type FormEvent } from 'react';
import { Check, MessageSquare, Plus, RefreshCw } from 'lucide-react';
import {
  createActionPlan,
  createPaymentApproval,
  listActionPlans,
  listPaymentApprovals,
  listTicketMessages,
  sendTicketMessage,
  updateActionPlan,
  type ActionPlanRecord,
  type PaymentApprovalRecord,
  type TicketMessageRecord,
} from '../data/supabaseOperations';

export function EvaluationActionPlans({ evaluationId, showToast }: { evaluationId: string; showToast: (message: string, type?: 'success'|'error'|'warning') => void }) {
  const [items, setItems] = useState<ActionPlanRecord[]>([]);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', ownerName: '', dueDate: '' });
  const load = async () => { try { setItems(await listActionPlans(evaluationId)); } catch (error) { showToast(error instanceof Error ? error.message : 'No fue posible cargar planes de acción.', 'error'); } };
  useEffect(() => { void load(); }, [evaluationId]);
  const submit = async (event: FormEvent) => {
    event.preventDefault(); if (!form.title.trim() || !form.description.trim() || saving) return; setSaving(true);
    try { await createActionPlan(evaluationId, form); setForm({ title: '', description: '', ownerName: '', dueDate: '' }); await load(); showToast('Plan de acción creado.'); }
    catch (error) { showToast(error instanceof Error ? error.message : 'No fue posible crear el plan.', 'error'); }
    finally { setSaving(false); }
  };
  const complete = async (item: ActionPlanRecord) => {
    const evidence = window.prompt('Evidencia o comentario de cierre:', item.evidence || '') || undefined;
    try { await updateActionPlan(item.id, 'completado', evidence); await load(); showToast('Plan de acción completado.'); }
    catch (error) { showToast(error instanceof Error ? error.message : 'No fue posible completar el plan.', 'error'); }
  };
  return <div className="border rounded-xl p-4 mt-3"><div className="flex justify-between items-center gap-2"><div><h4 className="font-semibold text-navy">Planes de acción</h4><p className="text-sm text-gray-500">Convierte hallazgos de la evaluación en compromisos con responsable y fecha.</p></div><button type="button" onClick={() => void load()}><RefreshCw /></button></div><form onSubmit={submit} className="grid grid-cols-1 sm:grid-cols-4 gap-2 mt-3"><input required value={form.title} onChange={e=>setForm({...form,title:e.target.value})} className="form-input p-2 border rounded" placeholder="Acción correctiva"/><input value={form.ownerName} onChange={e=>setForm({...form,ownerName:e.target.value})} className="form-input p-2 border rounded" placeholder="Responsable"/><input type="date" value={form.dueDate} onChange={e=>setForm({...form,dueDate:e.target.value})} className="form-input p-2 border rounded"/><input required value={form.description} onChange={e=>setForm({...form,description:e.target.value})} className="form-input p-2 border rounded" placeholder="Descripción"/><button className="btn btn-primary sm:col-span-4" disabled={saving}><Plus/>Agregar plan</button></form><div className="space-y-2 mt-3">{items.map(item=><div key={item.id} className="border rounded-lg p-3 flex flex-col sm:flex-row justify-between gap-3"><div><strong>{item.title}</strong><small className="block text-gray-500">{item.owner_name||'Sin responsable'}{item.due_date?` · vence ${item.due_date}`:''} · {item.status}</small><span className="text-sm">{item.description}</span>{item.evidence&&<small className="block text-green-700">Evidencia: {item.evidence}</small>}</div>{item.status!=='completado'&&item.status!=='cancelado'&&<button type="button" onClick={()=>void complete(item)}><Check/>Completar</button>}</div>)}{items.length===0&&<p className="text-sm text-gray-500">Sin planes de acción.</p>}</div></div>;
}

export function PaymentApprovals({ paymentId, showToast, onChanged }: { paymentId: string; showToast: (message: string, type?: 'success'|'error'|'warning') => void; onChanged: () => void }) {
  const [items,setItems]=useState<PaymentApprovalRecord[]>([]); const [decision,setDecision]=useState<PaymentApprovalRecord['decision']>('aprobado'); const [comment,setComment]=useState(''); const [saving,setSaving]=useState(false);
  const load=async()=>{try{setItems(await listPaymentApprovals(paymentId));}catch(error){showToast(error instanceof Error?error.message:'No fue posible cargar aprobaciones.','error');}};
  useEffect(()=>{void load();},[paymentId]);
  const submit=async(event:FormEvent)=>{event.preventDefault();if(saving)return;setSaving(true);try{await createPaymentApproval(paymentId,decision,comment||undefined);setComment('');await load();onChanged();showToast(decision==='aprobado'?'Pago aprobado y liberado.':'Pago observado/retenido.');}catch(error){showToast(error instanceof Error?error.message:'No fue posible registrar la aprobación.','error');}finally{setSaving(false);}};
  return <div className="border rounded-xl p-4 mt-3"><h4 className="font-semibold text-navy">Aprobaciones de pago</h4><p className="text-sm text-gray-500">Cada decisión queda trazada y actualiza automáticamente el estado del pago.</p><form onSubmit={submit} className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-3"><select value={decision} onChange={e=>setDecision(e.target.value as PaymentApprovalRecord['decision'])} className="form-input p-2 border rounded"><option value="aprobado">Aprobar</option><option value="observado">Observar</option><option value="rechazado">Rechazar</option></select><input value={comment} onChange={e=>setComment(e.target.value)} className="form-input p-2 border rounded sm:col-span-2" placeholder="Comentario o fundamento"/><button className="btn btn-primary sm:col-span-3" disabled={saving}>Registrar decisión</button></form><div className="space-y-2 mt-3">{items.map(item=><div key={item.id} className="border rounded-lg p-2 text-sm"><strong>{item.decision}</strong><span className="block text-gray-500">{new Date(item.created_at).toLocaleString('es-CL')}{item.comment?` · ${item.comment}`:''}</span></div>)}{items.length===0&&<p className="text-sm text-gray-500">Aún no hay decisiones registradas.</p>}</div></div>;
}

export function TicketConversation({ ticketId, showToast }: { ticketId: string; showToast: (message: string, type?: 'success'|'error'|'warning') => void }) {
  const [items,setItems]=useState<TicketMessageRecord[]>([]); const [body,setBody]=useState(''); const [internal,setInternal]=useState(false); const [saving,setSaving]=useState(false);
  const load=async()=>{try{setItems(await listTicketMessages(ticketId));}catch(error){showToast(error instanceof Error?error.message:'No fue posible cargar la conversación.','error');}};
  useEffect(()=>{void load();},[ticketId]);
  const submit=async(event:FormEvent)=>{event.preventDefault();if(!body.trim()||saving)return;setSaving(true);try{await sendTicketMessage(ticketId,body,internal);setBody('');setInternal(false);await load();}catch(error){showToast(error instanceof Error?error.message:'No fue posible enviar el mensaje.','error');}finally{setSaving(false);}};
  return <div className="border rounded-xl p-4 mt-3"><div className="flex gap-2 items-center"><MessageSquare/><h4 className="font-semibold text-navy">Conversación del ticket</h4></div><div className="space-y-2 my-3 max-h-56 overflow-y-auto">{items.map(item=><div key={item.id} className="border rounded-lg p-2 text-sm"><span>{item.body}</span><small className="block text-gray-500">{new Date(item.created_at).toLocaleString('es-CL')}{item.is_internal?' · Nota interna':''}</small></div>)}{items.length===0&&<p className="text-sm text-gray-500">Sin mensajes todavía.</p>}</div><form onSubmit={submit} className="grid grid-cols-1 gap-2"><textarea required value={body} onChange={e=>setBody(e.target.value)} className="form-input p-2 border rounded" placeholder="Escribe una respuesta…"/><label className="text-sm inline-flex gap-2 items-center"><input type="checkbox" checked={internal} onChange={e=>setInternal(e.target.checked)}/> Nota interna para Mandante/Acredita</label><button className="btn btn-primary" disabled={saving}>Enviar mensaje</button></form></div>;
}
