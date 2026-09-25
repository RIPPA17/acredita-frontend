import React from 'react';
import { Copy, Send, Trash2, X } from 'lucide-react';
import type { Proyecto } from '../types';
import { restoreSupabaseSession } from '../data/supabaseAuth';
import {
  cancelContractorInvitation,
  contractorInvitationLink,
  createContractorInvitation,
  getProjectInvitations,
  listAvailableContractorsForProject,
  sendContractorInvitationEmail,
  type AvailableProjectContractor,
  type ProjectInvitation,
} from '../data/supabaseInvitations';

type Props = {
  open: boolean;
  onClose: () => void;
  projects: Proyecto[];
  showToast: (msg: string, type?: 'success' | 'error' | 'warning') => void;
  initialProjectKey?: string;
};

export default function ContractorInvitationModal({ open, onClose, projects, showToast, initialProjectKey }: Props) {
  const [contractorKey, setContractorKey] = React.useState('');
  const [projectKey, setProjectKey] = React.useState('');
  const [message, setMessage] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const [inviteLink, setInviteLink] = React.useState<string | null>(null);
  const [mailSent, setMailSent] = React.useState(false);
  const [availableContractors, setAvailableContractors] = React.useState<AvailableProjectContractor[]>([]);
  const [loadingContractors, setLoadingContractors] = React.useState(false);
  const [projectInvitations, setProjectInvitations] = React.useState<ProjectInvitation[]>([]);
  const [loadingInvitations, setLoadingInvitations] = React.useState(false);
  const [cancellingInvitationId, setCancellingInvitationId] = React.useState<string | null>(null);

  const activeProjects = React.useMemo(() => projects.filter(project =>
    ['activo', 'active'].includes(String(project.estado || '').trim().toLocaleLowerCase('es'))
  ), [projects]);

  const selectedContractor = availableContractors.find(item => item.contractor_key === contractorKey);

  React.useEffect(() => {
    if (!open) return;
    setContractorKey('');
    setProjectKey(activeProjects.some(project => project.id === initialProjectKey)
      ? (initialProjectKey || '')
      : (activeProjects[0]?.id || ''));
    setMessage('');
    setInviteLink(null);
    setMailSent(false);
  }, [open, activeProjects, initialProjectKey]);

  const refreshAvailable = React.useCallback(async () => {
    if (!open || !projectKey) {
      setAvailableContractors([]);
      return;
    }
    setLoadingContractors(true);
    try {
      const session = await restoreSupabaseSession();
      if (!session || (session.role !== 'mandante' && session.role !== 'admin')) {
        setAvailableContractors([]);
        return;
      }
      const rows = await listAvailableContractorsForProject({ session, projectKey });
      setAvailableContractors(rows);
      setContractorKey(current => rows.some(item => item.contractor_key === current) ? current : '');
    } catch (error) {
      console.error('No fue posible cargar el directorio de contratistas.', error);
      setAvailableContractors([]);
    } finally {
      setLoadingContractors(false);
    }
  }, [open, projectKey]);

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
    } catch (error) {
      console.error('No fue posible cargar las invitaciones del proyecto.', error);
      setProjectInvitations([]);
    } finally {
      setLoadingInvitations(false);
    }
  }, [open, projectKey]);

  React.useEffect(() => {
    void Promise.all([refreshAvailable(), refreshInvitations()]);
  }, [refreshAvailable, refreshInvitations]);

  if (!open) return null;

  const copyLink = async () => {
    if (!inviteLink) return;
    await navigator.clipboard.writeText(inviteLink);
    showToast('Link de invitación copiado');
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!projectKey || !selectedContractor || submitting) return;
    if (!selectedContractor.contact_email) {
      showToast('Este contratista no tiene un responsable habilitado. Pide a Administración de Acredita completar sus datos.', 'warning');
      return;
    }

    setSubmitting(true);
    try {
      const session = await restoreSupabaseSession();
      if (!session || (session.role !== 'mandante' && session.role !== 'admin')) throw new Error('Tu sesión autorizada venció');

      const invitation = await createContractorInvitation({
        session,
        projectKey,
        contractorKey: selectedContractor.contractor_key,
        message,
      });
      const link = contractorInvitationLink(invitation.token);
      setInviteLink(link);

      try {
        await sendContractorInvitationEmail(invitation.invitation_id, invitation.token, session._supabase.accessToken);
        setMailSent(true);
        showToast(`Invitación enviada a ${selectedContractor.contact_email}`);
      } catch {
        setMailSent(false);
        showToast('Invitación creada. El correo no pudo enviarse; puedes copiar el enlace.', 'warning');
      }
      await Promise.all([refreshAvailable(), refreshInvitations()]);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'No fue posible crear la invitación', 'error');
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
      showToast(error instanceof Error ? error.message : 'No fue posible cancelar la invitación', 'error');
    } finally {
      setCancellingInvitationId(null);
    }
  };

  const invitationStatusLabel = (status: ProjectInvitation['status']) =>
    status === 'pending' ? 'Pendiente' :
    status === 'accepted' ? 'Aceptada' :
    status === 'rejected' ? 'Rechazada' :
    status === 'expired' ? 'Vencida' : 'Cancelada';

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-[500px] max-h-[calc(100vh-24px)] overflow-y-auto">
        <div className="flex justify-between items-start p-4 border-b border-cream">
          <div>
            <h3 className="font-medium text-navy text-[17.6px]">Incorporar contratista</h3>
            <p className="text-xs text-gray-500 mt-0.5">Selecciona una empresa creada previamente por Administración de Acredita.</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>

        <form onSubmit={submit} className="p-6 flex flex-col gap-4">
          <div className="rounded-lg border border-blue-100 bg-blue-50 p-3 text-[11.5px] leading-relaxed text-blue-800">
            El Mandante no crea empresas. Si el contratista no aparece en el directorio, Administración de Acredita debe registrarlo primero.
          </div>

          <div>
            <label className="block text-[13.2px] font-medium text-gray-700 mb-1.5">Proyecto</label>
            <select value={projectKey} onChange={(e) => { setProjectKey(e.target.value); setContractorKey(''); setInviteLink(null); }} className="form-input w-full" required>
              <option value="">Selecciona un proyecto...</option>
              {activeProjects.map((project) => <option key={project.id} value={project.id}>{project.nombre}</option>)}
            </select>
          </div>

          <div>
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <label className="block text-[13.2px] font-medium text-gray-700">Contratista registrado</label>
              {loadingContractors && <span className="text-[10.5px] text-gray-400">Cargando directorio…</span>}
            </div>
            <select value={contractorKey} onChange={(e) => { setContractorKey(e.target.value); setInviteLink(null); }} className="form-input w-full" required disabled={!projectKey || loadingContractors}>
              <option value="">Selecciona un contratista...</option>
              {availableContractors.map((contractor) => (
                <option key={contractor.contractor_key} value={contractor.contractor_key} disabled={!contractor.contact_email}>
                  {contractor.contractor_name} ({contractor.contractor_rut}){contractor.contact_email ? '' : ' · falta responsable'}
                </option>
              ))}
            </select>
            {!loadingContractors && projectKey && availableContractors.length === 0 && (
              <p className="mt-1.5 text-[11px] text-gray-500">No hay contratistas disponibles para incorporar. Administración puede crear uno nuevo.</p>
            )}
          </div>

          {selectedContractor && (
            <div className="rounded-lg border border-cream3 bg-cream2/60 p-3 text-[11.5px] leading-relaxed text-gray-600">
              <strong className="block text-navy">{selectedContractor.contractor_name}</strong>
              <span>{selectedContractor.contractor_rut}</span>
              <div className="mt-1">Responsable: <strong>{selectedContractor.contact_name || 'Sin nombre registrado'}</strong></div>
              <div>Correo de invitación: <strong>{selectedContractor.contact_email || 'Pendiente de Administración'}</strong></div>
              {selectedContractor.contact_phone && <div>Teléfono: {selectedContractor.contact_phone}</div>}
            </div>
          )}

          <div>
            <label className="block text-[13.2px] font-medium text-gray-700 mb-1.5">Mensaje opcional</label>
            <textarea value={message} onChange={(e) => setMessage(e.target.value)} className="form-input w-full resize-none" rows={3} placeholder="Te invitamos a completar la acreditación para este proyecto." />
          </div>

          <div className="rounded-lg border border-cream3 bg-cream2/50 p-3">
            <div className="flex items-center justify-between gap-3">
              <div><strong className="text-[12px] text-navy">Invitaciones de este proyecto</strong><p className="mt-0.5 text-[10.5px] text-gray-500">Revisa el estado y cancela las que aún no fueron aceptadas.</p></div>
              {loadingInvitations && <span className="text-[10px] text-gray-400">Actualizando…</span>}
            </div>
            <div className="mt-2 flex max-h-44 flex-col gap-2 overflow-y-auto">
              {projectInvitations.slice(0, 8).map(invitation => <div key={invitation.id} className="flex items-center justify-between gap-3 rounded-md border border-cream3 bg-white px-3 py-2">
                <span className="min-w-0"><strong className="block truncate text-[11px] text-navy">{invitation.contractor_name || invitation.invited_email || 'Contratista'}</strong><small className="block truncate text-[9.5px] text-gray-500">{invitation.invited_email || 'Sin correo'} · {invitationStatusLabel(invitation.status)}</small></span>
                {invitation.status === 'pending' && <button type="button" aria-label={`Cancelar invitación de ${invitation.invited_email || 'contratista'}`} disabled={Boolean(cancellingInvitationId)} onClick={() => void cancelInvitation(invitation)} className="inline-flex items-center gap-1 rounded-md border border-red-200 px-2 py-1 text-[10px] font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"><Trash2 size={12} /> {cancellingInvitationId === invitation.id ? 'Cancelando…' : 'Cancelar'}</button>}
              </div>)}
              {!loadingInvitations && projectInvitations.length === 0 && <p className="py-2 text-[10.5px] text-gray-500">No hay invitaciones registradas para este proyecto.</p>}
            </div>
          </div>

          {inviteLink && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
              <div className="text-sm font-medium text-emerald-800">Invitación creada {mailSent ? 'y enviada por correo' : ''}</div>
              <div className="text-xs text-emerald-700 mt-1 break-all">{inviteLink}</div>
              <button type="button" onClick={copyLink} className="btn btn-secondary mt-3"><Copy size={15} /> Copiar enlace</button>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-1">
            <button type="button" onClick={onClose} className="btn btn-secondary">Cerrar</button>
            {!inviteLink && (
              <button type="submit" disabled={submitting || !selectedContractor?.contact_email} className="btn btn-primary disabled:opacity-60">
                <Send size={15} /> {submitting ? 'Enviando…' : 'Enviar invitación'}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
