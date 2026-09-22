import React from 'react';
import { Copy, Send, Trash2, X } from 'lucide-react';
import type { Contratista, Proyecto } from '../types';
import { restoreSupabaseSession } from '../data/supabaseAuth';
import { isValidRut } from '../utils/rut';
import {
  cancelContractorInvitation,
  contractorInvitationLink,
  createContractorInvitation,
  getProjectInvitations,
  sendContractorInvitationEmail,
  type ProjectInvitation,
} from '../data/supabaseInvitations';

type Props = {
  open: boolean;
  onClose: () => void;
  contractors: Contratista[];
  projects: Proyecto[];
  showToast: (msg: string, type?: 'success' | 'error' | 'warning') => void;
  initialProjectKey?: string;
};

export default function ContractorInvitationModal({ open, onClose, contractors, projects, showToast, initialProjectKey }: Props) {
  const [mode, setMode] = React.useState<'existing' | 'new'>('new');
  const [contractorKey, setContractorKey] = React.useState('');
  const [name, setName] = React.useState('');
  const [rut, setRut] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [projectKey, setProjectKey] = React.useState('');
  const [message, setMessage] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const [inviteLink, setInviteLink] = React.useState<string | null>(null);
  const [mailSent, setMailSent] = React.useState(false);
  const [projectInvitations, setProjectInvitations] = React.useState<ProjectInvitation[]>([]);
  const [loadingInvitations, setLoadingInvitations] = React.useState(false);
  const [cancellingInvitationId, setCancellingInvitationId] = React.useState<string | null>(null);

  const activeProjects = React.useMemo(() => projects.filter(project =>
    ['activo', 'active'].includes(String(project.estado || '').trim().toLocaleLowerCase('es'))
  ), [projects]);
  const selectedProject = activeProjects.find(project => project.id === projectKey);
  const activeContractorIds = new Set(selectedProject?.contratistasActivos ?? selectedProject?.contratistas ?? []);
  const availableContractors = contractors.filter(contractor => !activeContractorIds.has(contractor.id));

  React.useEffect(() => {
    if (!open) return;
    setMode('new');
    setContractorKey('');
    setName('');
    setRut('');
    setEmail('');
    setProjectKey(activeProjects.some(project => project.id === initialProjectKey) ? (initialProjectKey || '') : (activeProjects[0]?.id || ''));
    setMessage('');
    setInviteLink(null);
    setMailSent(false);
  }, [open, activeProjects, initialProjectKey]);

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
    void refreshInvitations();
  }, [refreshInvitations]);

  React.useEffect(() => {
    if (contractorKey && activeContractorIds.has(contractorKey)) setContractorKey('');
  }, [projectKey, contractorKey, activeContractorIds]);

  if (!open) return null;

  const copyLink = async () => {
    if (!inviteLink) return;
    await navigator.clipboard.writeText(inviteLink);
    showToast('Link de invitación copiado');
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!email.trim() || !projectKey) return;
    if (mode === 'existing' && !contractorKey) return;
    if (mode === 'new' && (!name.trim() || !rut.trim())) return;
    if (mode === 'new' && !isValidRut(rut)) {
      showToast('El RUT del contratista no es válido. Revisa el número y dígito verificador.', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const session = await restoreSupabaseSession();
      if (!session || (session.role !== 'mandante' && session.role !== 'admin')) throw new Error('Tu sesión autorizada venció');

      const invitation = await createContractorInvitation({
        session,
        projectKey,
        email,
        contractorKey: mode === 'existing' ? contractorKey : undefined,
        contractorName: mode === 'new' ? name : undefined,
        contractorRut: mode === 'new' ? rut : undefined,
        message,
      });
      const link = contractorInvitationLink(invitation.token);
      setInviteLink(link);

      try {
        await sendContractorInvitationEmail(invitation.invitation_id, invitation.token, session._supabase.accessToken);
        setMailSent(true);
        showToast(`Invitación enviada a ${email.trim().toLowerCase()}`);
        await refreshInvitations();
      } catch {
        setMailSent(false);
        showToast('Invitación creada. El correo no pudo enviarse; puedes copiar el enlace.', 'warning');
        await refreshInvitations();
      }
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
      await refreshInvitations();
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
      <div className="bg-white rounded-xl shadow-xl w-full max-w-[480px] max-h-[calc(100vh-24px)] overflow-y-auto">
        <div className="flex justify-between items-center p-4 border-b border-cream">
          <div>
            <h3 className="font-medium text-navy text-[17.6px]">Invitar contratista</h3>
            <p className="text-xs text-gray-500 mt-0.5">La aceptación crea la acreditación automáticamente.</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>

        <form onSubmit={submit} className="p-6 flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-2 p-1 bg-cream2 rounded-lg">
            <button type="button" onClick={() => setMode('new')} className={`px-3 py-2 rounded-md text-sm ${mode === 'new' ? 'bg-white text-navy shadow-sm font-medium' : 'text-gray-500'}`}>Nuevo contratista</button>
            <button type="button" onClick={() => setMode('existing')} className={`px-3 py-2 rounded-md text-sm ${mode === 'existing' ? 'bg-white text-navy shadow-sm font-medium' : 'text-gray-500'}`}>Ya existe</button>
          </div>

          {mode === 'existing' ? (
            <div>
              <label className="block text-[13.2px] font-medium text-gray-700 mb-1.5">Contratista</label>
              <select value={contractorKey} onChange={(e) => setContractorKey(e.target.value)} className="form-input w-full" required>
                <option value="">Selecciona un contratista...</option>
                {availableContractors.map((contractor) => <option key={contractor.id} value={contractor.id}>{contractor.nombre} ({contractor.rut})</option>)}
              </select>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[13.2px] font-medium text-gray-700 mb-1.5">Empresa</label>
                <input value={name} onChange={(e) => setName(e.target.value)} className="form-input w-full" placeholder="Servicios Ejemplo SpA" required />
              </div>
              <div>
                <label className="block text-[13.2px] font-medium text-gray-700 mb-1.5">RUT</label>
                <input value={rut} onChange={(e) => setRut(e.target.value)} className="form-input w-full" placeholder="76.123.456-7" required />
                {rut.trim() && !isValidRut(rut) && <p className="text-[11px] text-red-600 mt-1">RUT inválido.</p>}
              </div>
            </div>
          )}

          <div>
            <label className="block text-[13.2px] font-medium text-gray-700 mb-1.5">Correo del responsable</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="form-input w-full" placeholder="documentos@empresa.cl" required />
          </div>

          <div>
            <label className="block text-[13.2px] font-medium text-gray-700 mb-1.5">Proyecto</label>
            <select value={projectKey} onChange={(e) => setProjectKey(e.target.value)} className="form-input w-full" required>
              <option value="">Selecciona un proyecto...</option>
              {activeProjects.map((project) => <option key={project.id} value={project.id}>{project.nombre}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-[13.2px] font-medium text-gray-700 mb-1.5">Mensaje opcional</label>
            <textarea value={message} onChange={(e) => setMessage(e.target.value)} className="form-input w-full resize-none" rows={3} placeholder="Te invitamos a completar la acreditación para este proyecto." />
          </div>

          <div className="rounded-lg border border-cream3 bg-cream2/50 p-3">
            <div className="flex items-center justify-between gap-3">
              <div><strong className="text-[12px] text-navy">Invitaciones de este proyecto</strong><p className="mt-0.5 text-[10.5px] text-gray-500">Puedes revisar el estado y cancelar las que aún no fueron aceptadas.</p></div>
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
            {!inviteLink && <button type="submit" disabled={submitting || (mode === 'new' && !!rut.trim() && !isValidRut(rut))} className="btn btn-primary"><Send size={15} /> {submitting ? 'Enviando…' : 'Enviar invitación'}</button>}
          </div>
        </form>
      </div>
    </div>
  );
}
