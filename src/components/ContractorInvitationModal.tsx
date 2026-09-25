import React from 'react';
import { Copy, RefreshCw, Send, Trash2, X } from 'lucide-react';
import type { Contratista, Proyecto } from '../types';
import { restoreSupabaseSession } from '../data/supabaseAuth';
import {
  contractorInvitationLink,
  getProjectInvitations,
  sendContractorInvitationEmail,
  cancelContractorInvitation,
  type ProjectInvitation,
} from '../data/supabaseInvitations';
import {
  createRegisteredContractorInvitation,
  listAvailableContractorsForProject,
  type AvailableContractor,
} from '../data/supabaseContractorDirectory';

type Props = {
  open: boolean;
  onClose: () => void;
  contractors: Contratista[];
  projects: Proyecto[];
  showToast: (msg: string, type?: 'success' | 'error' | 'warning') => void;
  initialProjectKey?: string;
};

export default function ContractorInvitationModal({ open, onClose, projects, showToast, initialProjectKey }: Props) {
  const [contractorKey, setContractorKey] = React.useState('');
  const [projectKey, setProjectKey] = React.useState('');
  const [message, setMessage] = React.useState('');
  const [available, setAvailable] = React.useState<AvailableContractor[]>([]);
  const [loadingAvailable, setLoadingAvailable] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [inviteLink, setInviteLink] = React.useState<string | null>(null);
  const [mailSent, setMailSent] = React.useState(false);
  const [projectInvitations, setProjectInvitations] = React.useState<ProjectInvitation[]>([]);
  const [loadingInvitations, setLoadingInvitations] = React.useState(false);
  const [cancellingInvitationId, setCancellingInvitationId] = React.useState<string | null>(null);

  const activeProjects = React.useMemo(() => projects.filter(project =>
    ['activo', 'active'].includes(String(project.estado || '').trim().toLocaleLowerCase('es'))
  ), [projects]);

  const selectedContractor = available.find(item => item.contractor_key === contractorKey);

  React.useEffect(() => {
    if (!open) return;
    setContractorKey('');
    setProjectKey(activeProjects.some(project => project.id === initialProjectKey) ? (initialProjectKey || '') : (activeProjects[0]?.id || ''));
    setMessage('');
    setInviteLink(null);
    setMailSent(false);
  }, [open, activeProjects, initialProjectKey]);

  const refreshAvailable = React.useCallback(async () => {
    if (!open || !projectKey) {
      setAvailable([]);
      return;
    }
    setLoadingAvailable(true);
    try {
      const rows = await listAvailableContractorsForProject(projectKey);
      setAvailable(rows);
      if (contractorKey && !rows.some(item => item.contractor_key === contractorKey)) setContractorKey('');
    } catch (error) {
      setAvailable([]);
      showToast(error instanceof Error ? error.message : 'No fue posible cargar el directorio de contratistas.', 'error');
    } finally {
      setLoadingAvailable(false);
    }
  }, [open, projectKey, contractorKey, showToast]);

  const refreshInvitations = React.useCallback(async () => {
    if (!open || !projectKey) {
      setProjectInvitations([]);
      return;
    }
    setLoadingInvitations(true);
    try {
      const session = await restoreSupabaseSession();
      if (!session || (session.role !== 'mandante' && session.role !== 'admin')) {
        setProjectInvitations([]);
        return;
      }
      setProjectInvitations(await getProjectInvitations({ session, projectKey }));
    } catch {
      setProjectInvitations([]);
    } finally {
      setLoadingInvitations(false);
    }
  }, [open, projectKey]);

  React.useEffect(() => {
    void refreshAvailable();
    void refreshInvitations();
  }, [refreshAvailable, refreshInvitations]);

  if (!open) return null;

  const copyLink = async () => {
    if (!inviteLink) return;
    await navigator.clipboard.writeText(inviteLink);
    showToast('Link de invitación copiado');
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!projectKey || !contractorKey || submitting) return;
    if (!selectedContractor?.contact_email) {
      showToast('Este contratista no tiene correo responsable. Administración debe completar su ficha.', 'warning');
      return;
    }

    setSubmitting(true);
    try {
      const session = await restoreSupabaseSession();
      if (!session || (session.role !== 'mandante' && session.role !== 'admin')) throw new Error('Tu sesión autorizada venció');

      const invitation = await createRegisteredContractorInvitation(projectKey, contractorKey, message);
      const link = contractorInvitationLink(invitation.token);
      setInviteLink(link);

      try {
        await sendContractorInvitationEmail(invitation.invitation_id, invitation.token, session._supabase.accessToken);
        setMailSent(true);
        showToast(`Invitación enviada a ${selectedContractor.contact_email}`);
      } catch {
        setMailSent(false);
        showToast('La incorporación quedó registrada, pero el correo no pudo enviarse. Puedes copiar el enlace.', 'warning');
      }
      await Promise.all([refreshAvailable(), refreshInvitations()]);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'No fue posible incorporar el contratista.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const cancelInvitation = async (invitation: ProjectInvitation) => {
    if (cancellingInvitationId || invitation.status !== 'pending') return;
    if (!window.confirm(`¿Cancelar la invitación enviada a ${invitation.invited_email || 'este correo'}?`)) return;
    setCancellingInvitationId(invitation.id);
    try {
      const session = await restoreSupabaseSession();
      if (!session || (session.role !== 'mandante' && session.role !== 'admin')) throw new Error('Tu sesión autorizada venció');
      await cancelContractorInvitation(session, invitation.id);
      await Promise.all([refreshAvailable(), refreshInvitations()]);
      showToast('Invitación cancelada.', 'warning');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'No fue posible cancelar la invitación.', 'error');
    } finally {
      setCancellingInvitationId(null);
    }
  };

  const invitationStatusLabel = (status: ProjectInvitation['status']) =>
    status === 'pending' ? 'Pendiente' :
    status === 'accepted' ? 'Aceptada' :
    status === 'rejected' ? 'Rechazada' :
    status === 'expired' ? 'Vencida' : 'Cancelada';

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
    <div className="w-full max-w-[520px] max-h-[calc(100vh-24px)] overflow-y-auto rounded-xl bg-white shadow-xl">
      <div className="flex items-center justify-between border-b border-cream p-4">
        <div>
          <h3 className="font-medium text-navy text-[17.6px]">Incorporar contratista</h3>
          <p className="mt-0.5 text-xs text-gray-500">Solo puedes seleccionar empresas previamente registradas por Administración Acredita.</p>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
      </div>

      <form onSubmit={submit} className="flex flex-col gap-4 p-6">
        <div>
          <label className="mb-1.5 block text-[13.2px] font-medium text-gray-700">Proyecto</label>
          <select value={projectKey} onChange={e=>{setProjectKey(e.target.value);setContractorKey('');setInviteLink(null);}} className="form-input w-full" required>
            <option value="">Selecciona un proyecto...</option>
            {activeProjects.map(project => <option key={project.id} value={project.id}>{project.nombre}</option>)}
          </select>
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <label className="text-[13.2px] font-medium text-gray-700">Contratista registrado</label>
            <button type="button" onClick={()=>void refreshAvailable()} disabled={loadingAvailable || !projectKey} className="inline-flex items-center gap-1 text-[11px] font-semibold text-brown disabled:opacity-40"><RefreshCw size={12} /> Actualizar</button>
          </div>
          <select aria-label="Contratista registrado" value={contractorKey} onChange={e=>{setContractorKey(e.target.value);setInviteLink(null);}} className="form-input w-full" required disabled={loadingAvailable || !projectKey}>
            <option value="">{loadingAvailable ? 'Cargando directorio…' : 'Selecciona un contratista...'}</option>
            {available.map(item => <option key={item.contractor_key} value={item.contractor_key}>{item.contractor_name} ({item.contractor_rut})</option>)}
          </select>
          {!loadingAvailable && projectKey && available.length === 0 && <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-[11.5px] text-amber-800">No hay contratistas nuevos disponibles para este proyecto. Si la empresa no existe en Acredita, solicita a Administración que la registre.</div>}
        </div>

        {selectedContractor && <div className="rounded-lg border border-cream3 bg-cream2/50 p-3">
          <strong className="text-sm text-navy">{selectedContractor.contractor_name}</strong>
          <div className="mt-1 text-[11.5px] text-gray-600">RUT {selectedContractor.contractor_rut}</div>
          <div className="mt-1 text-[11.5px] text-gray-600">Responsable: {selectedContractor.contact_name || 'No registrado'}</div>
          <div className="text-[11.5px] text-gray-600">Correo: {selectedContractor.contact_email || 'No registrado'}</div>
          {!selectedContractor.contact_email && <div className="mt-2 text-[11px] font-medium text-red-700">Administración debe completar el correo responsable antes de incorporarlo.</div>}
        </div>}

        <div>
          <label className="mb-1.5 block text-[13.2px] font-medium text-gray-700">Mensaje <span className="font-normal text-gray-400">opcional</span></label>
          <textarea value={message} onChange={e=>setMessage(e.target.value)} className="form-input w-full resize-none" rows={3} placeholder="Te invitamos a completar la acreditación para este proyecto." />
        </div>

        <div className="rounded-lg border border-blue-100 bg-blue-50 p-3 text-[11.5px] leading-relaxed text-blue-800">
          El Mandante <strong>no crea la empresa</strong>. La incorporación envía la invitación al responsable registrado por Acredita y, al aceptarla, se activa la relación con el proyecto.
        </div>

        <div className="rounded-lg border border-cream3 bg-cream2/50 p-3">
          <div className="flex items-center justify-between gap-3">
            <div><strong className="text-[12px] text-navy">Invitaciones del proyecto</strong><p className="mt-0.5 text-[10.5px] text-gray-500">Seguimiento de incorporaciones enviadas.</p></div>
            {loadingInvitations && <span className="text-[10px] text-gray-400">Actualizando…</span>}
          </div>
          <div className="mt-2 flex max-h-40 flex-col gap-2 overflow-y-auto">
            {projectInvitations.slice(0,8).map(invitation => <div key={invitation.id} className="flex items-center justify-between gap-3 rounded-md border border-cream3 bg-white px-3 py-2">
              <span className="min-w-0"><strong className="block truncate text-[11px] text-navy">{invitation.contractor_name || invitation.invited_email || 'Contratista'}</strong><small className="block truncate text-[9.5px] text-gray-500">{invitation.invited_email || 'Sin correo'} · {invitationStatusLabel(invitation.status)}</small></span>
              {invitation.status === 'pending' && <button type="button" aria-label={`Cancelar invitación de ${invitation.invited_email || 'contratista'}`} disabled={Boolean(cancellingInvitationId)} onClick={()=>void cancelInvitation(invitation)} className="inline-flex items-center gap-1 rounded-md border border-red-200 px-2 py-1 text-[10px] font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"><Trash2 size={12} /> {cancellingInvitationId===invitation.id?'Cancelando…':'Cancelar'}</button>}
            </div>)}
            {!loadingInvitations && projectInvitations.length===0 && <p className="py-2 text-[10.5px] text-gray-500">No hay invitaciones registradas para este proyecto.</p>}
          </div>
        </div>

        {inviteLink && <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
          <div className="text-sm font-medium text-emerald-800">Incorporación registrada {mailSent ? 'y enviada por correo' : ''}</div>
          <div className="mt-1 break-all text-xs text-emerald-700">{inviteLink}</div>
          <button type="button" onClick={copyLink} className="btn btn-secondary mt-3"><Copy size={15} /> Copiar enlace</button>
        </div>}

        <div className="flex justify-end gap-3 border-t border-cream pt-1">
          <button type="button" onClick={onClose} className="btn btn-secondary">Cerrar</button>
          {!inviteLink && <button type="submit" disabled={submitting || !contractorKey || !selectedContractor?.contact_email} className="btn btn-primary disabled:opacity-60"><Send size={15} /> {submitting ? 'Enviando…' : 'Incorporar contratista'}</button>}
        </div>
      </form>
    </div>
  </div>;
}
