import React from 'react';
import { Copy, Send, X } from 'lucide-react';
import type { Contratista, Proyecto } from '../types';
import { restoreSupabaseSession } from '../data/supabaseAuth';
import {
  contractorInvitationLink,
  createContractorInvitation,
  sendContractorInvitationEmail,
} from '../data/supabaseInvitations';

type Props = {
  open: boolean;
  onClose: () => void;
  contractors: Contratista[];
  projects: Proyecto[];
  showToast: (msg: string, type?: 'success' | 'error' | 'warning') => void;
};

export default function ContractorInvitationModal({ open, onClose, contractors, projects, showToast }: Props) {
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

  React.useEffect(() => {
    if (!open) return;
    setMode('new');
    setContractorKey('');
    setName('');
    setRut('');
    setEmail('');
    setProjectKey(projects[0]?.id || '');
    setMessage('');
    setInviteLink(null);
    setMailSent(false);
  }, [open]);

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

    setSubmitting(true);
    try {
      const session = await restoreSupabaseSession();
      if (!session || session.role !== 'mandante') throw new Error('Tu sesión de Mandante venció');

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
      } catch (mailError) {
        setMailSent(false);
        showToast('Invitación creada. El correo no pudo enviarse; puedes copiar el enlace.', 'warning');
      }
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'No fue posible crear la invitación', 'error');
    } finally {
      setSubmitting(false);
    }
  };

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
                {contractors.map((contractor) => <option key={contractor.id} value={contractor.id}>{contractor.nombre} ({contractor.rut})</option>)}
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
              {projects.map((project) => <option key={project.id} value={project.id}>{project.nombre}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-[13.2px] font-medium text-gray-700 mb-1.5">Mensaje opcional</label>
            <textarea value={message} onChange={(e) => setMessage(e.target.value)} className="form-input w-full resize-none" rows={3} placeholder="Te invitamos a completar la acreditación para este proyecto." />
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
            {!inviteLink && <button type="submit" disabled={submitting} className="btn btn-primary"><Send size={15} /> {submitting ? 'Enviando…' : 'Enviar invitación'}</button>}
          </div>
        </form>
      </div>
    </div>
  );
}
