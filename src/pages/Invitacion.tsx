import React from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import {
  finishEmailInvite,
  getContractorInvitationPreview,
  loginAndAcceptContractorInvitation,
  signupAndAcceptContractorInvitation,
  tokensFromAuthHash,
  type InvitationPreview,
} from '../data/supabaseInvitations';

type Mode = 'choose' | 'login' | 'signup' | 'email-invite' | 'email-existing';

export default function InvitacionPage() {
  const navigate = useNavigate();
  const token = React.useMemo(() => new URLSearchParams(window.location.search).get('token') || '', []);
  const emailAuth = React.useMemo(() => tokensFromAuthHash(), []);
  const [preview, setPreview] = React.useState<InvitationPreview | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [mode, setMode] = React.useState<Mode>(() => emailAuth?.type === 'invite' ? 'email-invite' : emailAuth ? 'email-existing' : 'choose');
  const [fullName, setFullName] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');

  React.useEffect(() => {
    let active = true;
    if (!token) {
      setError('El enlace de invitación no contiene un token válido.');
      setLoading(false);
      return;
    }
    getContractorInvitationPreview(token)
      .then((data) => { if (active) setPreview(data); })
      .catch((err) => { if (active) setError(err instanceof Error ? err.message : 'Invitación no disponible'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [token]);

  const finish = async (action: () => Promise<unknown>) => {
    setSubmitting(true);
    setError(null);
    try {
      await action();
      navigate('/contratista', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible aceptar la invitación');
    } finally {
      setSubmitting(false);
    }
  };

  const submitExisting = (event: React.FormEvent) => {
    event.preventDefault();
    if (!preview) return;
    void finish(() => loginAndAcceptContractorInvitation(token, preview.invited_email, password));
  };

  const submitSignup = (event: React.FormEvent) => {
    event.preventDefault();
    if (!preview) return;
    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden.');
      return;
    }
    void finish(() => signupAndAcceptContractorInvitation(token, preview.invited_email, fullName, password));
  };

  const submitEmailInvite = (event: React.FormEvent) => {
    event.preventDefault();
    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden.');
      return;
    }
    void finish(async () => {
      const session = await finishEmailInvite(token, fullName, password);
      if (!session) throw new Error('El enlace de autenticación no contiene una sesión válida');
    });
  };

  const acceptExistingEmailLink = () => {
    void finish(async () => {
      const session = await finishEmailInvite(token, undefined, undefined);
      if (!session) throw new Error('El enlace de autenticación no contiene una sesión válida');
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cream2 p-4">
        <div className="card w-full max-w-[480px] p-8 text-center">
          <Loader2 className="animate-spin mx-auto mb-3 text-brown" size={28} />
          <div className="font-medium text-navy">Validando invitación…</div>
        </div>
      </div>
    );
  }

  if (!preview) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cream2 p-4">
        <div className="card w-full max-w-[480px] p-8 text-center">
          <AlertCircle className="mx-auto mb-3 text-red-500" size={30} />
          <h1 className="text-lg font-semibold text-navy mb-2">Invitación no disponible</h1>
          <p className="text-sm text-gray-500 mb-5">{error || 'El enlace venció o ya fue utilizado.'}</p>
          <button className="btn btn-secondary" onClick={() => navigate('/')}>Volver a Acredita</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-cream2 p-4">
      <div className="card w-full max-w-[500px] p-8">
        <div className="text-center mb-6">
          <div className="text-[22px] tracking-[2px] text-navy mb-1">Acre<b className="text-brown font-normal">dita</b></div>
          <span className="badge b-blue">Invitación a proyecto</span>
        </div>

        <div className="bg-cream2 rounded-xl p-4 mb-6">
          <p className="text-sm text-gray-500 mb-1">Te invita</p>
          <p className="font-semibold text-navy">{preview.mandante_name}</p>
          <div className="grid grid-cols-2 gap-4 mt-3">
            <div>
              <p className="text-sm text-gray-500 mb-1">Proyecto</p>
              <p className="font-medium text-sm">{preview.project_name}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 mb-1">Empresa</p>
              <p className="font-medium text-sm">{preview.contractor_name}</p>
            </div>
          </div>
          {preview.message && <p className="text-sm text-gray-600 mt-3 border-t border-cream3 pt-3">{preview.message}</p>}
          <p className="text-sm text-gray-500 mt-3 mb-2">Requisitos obligatorios</p>
          <div className="flex flex-col gap-1.5 max-h-28 overflow-y-auto">
            {(preview.requirement_names || []).slice(0, 8).map((doc) => (
              <div key={doc} className="flex items-center gap-2 text-sm"><CheckCircle size={14} className="text-green-500 shrink-0" /> {doc}</div>
            ))}
            {preview.requirement_names.length === 0 && <div className="text-sm text-gray-400">Aún no hay requisitos configurados.</div>}
          </div>
        </div>

        {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 text-red-700 text-sm p-3">{error}</div>}

        {mode === 'choose' && (
          <div>
            <p className="text-center text-sm text-gray-500 mb-4">La invitación está asociada a <strong>{preview.invited_email}</strong>.</p>
            <div className="flex gap-3">
              <button className="btn btn-secondary flex-1 justify-center" onClick={() => { setError(null); setMode('signup'); }}>Crear cuenta</button>
              <button className="btn btn-primary flex-1 justify-center" onClick={() => { setError(null); setMode('login'); }}>Ya tengo cuenta</button>
            </div>
          </div>
        )}

        {mode === 'login' && (
          <form className="flex flex-col gap-4" onSubmit={submitExisting}>
            <div>
              <label className="block text-[13.2px] font-medium text-gray-700 mb-1.5">Correo</label>
              <input value={preview.invited_email} readOnly className="form-input w-full bg-gray-50" />
            </div>
            <div>
              <label className="block text-[13.2px] font-medium text-gray-700 mb-1.5">Contraseña</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className="form-input w-full" autoComplete="current-password" />
            </div>
            <button disabled={submitting} className="btn btn-primary w-full justify-center">{submitting ? 'Aceptando…' : 'Entrar y aceptar invitación'}</button>
            <button type="button" className="text-sm text-gray-500" onClick={() => setMode('choose')}>Volver</button>
          </form>
        )}

        {mode === 'signup' && (
          <form className="flex flex-col gap-4" onSubmit={submitSignup}>
            <div>
              <label className="block text-[13.2px] font-medium text-gray-700 mb-1.5">Nombre completo</label>
              <input value={fullName} onChange={(e) => setFullName(e.target.value)} required className="form-input w-full" />
            </div>
            <div>
              <label className="block text-[13.2px] font-medium text-gray-700 mb-1.5">Correo</label>
              <input value={preview.invited_email} readOnly className="form-input w-full bg-gray-50" />
            </div>
            <div>
              <label className="block text-[13.2px] font-medium text-gray-700 mb-1.5">Contraseña</label>
              <input type="password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} required className="form-input w-full" autoComplete="new-password" />
            </div>
            <div>
              <label className="block text-[13.2px] font-medium text-gray-700 mb-1.5">Repetir contraseña</label>
              <input type="password" minLength={8} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required className="form-input w-full" autoComplete="new-password" />
            </div>
            <button disabled={submitting} className="btn btn-primary w-full justify-center">{submitting ? 'Creando cuenta…' : 'Crear cuenta y aceptar'}</button>
            <button type="button" className="text-sm text-gray-500" onClick={() => setMode('choose')}>Volver</button>
          </form>
        )}

        {mode === 'email-invite' && (
          <form className="flex flex-col gap-4" onSubmit={submitEmailInvite}>
            <p className="text-sm text-gray-600">Tu correo ya fue validado por el enlace. Crea una contraseña para terminar el alta.</p>
            <div>
              <label className="block text-[13.2px] font-medium text-gray-700 mb-1.5">Nombre completo</label>
              <input value={fullName} onChange={(e) => setFullName(e.target.value)} required className="form-input w-full" />
            </div>
            <div>
              <label className="block text-[13.2px] font-medium text-gray-700 mb-1.5">Contraseña</label>
              <input type="password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} required className="form-input w-full" autoComplete="new-password" />
            </div>
            <div>
              <label className="block text-[13.2px] font-medium text-gray-700 mb-1.5">Repetir contraseña</label>
              <input type="password" minLength={8} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required className="form-input w-full" autoComplete="new-password" />
            </div>
            <button disabled={submitting} className="btn btn-primary w-full justify-center">{submitting ? 'Activando…' : 'Activar cuenta y aceptar'}</button>
          </form>
        )}

        {mode === 'email-existing' && (
          <div>
            <p className="text-sm text-gray-600 mb-4">Ya validaste tu identidad con el enlace recibido por correo.</p>
            <button disabled={submitting} className="btn btn-primary w-full justify-center" onClick={acceptExistingEmailLink}>{submitting ? 'Aceptando…' : 'Aceptar invitación'}</button>
          </div>
        )}

        <div className="text-center mt-6 text-xs text-gray-400">La invitación vence el {preview.expires_at ? new Date(preview.expires_at).toLocaleDateString('es-CL') : 'plazo indicado'}.</div>
      </div>
    </div>
  );
}
