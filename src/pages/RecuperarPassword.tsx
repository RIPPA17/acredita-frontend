import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle, KeyRound, Mail, ShieldCheck } from 'lucide-react';
import { completeSupabasePasswordRecovery, requestSupabasePasswordReset, tokensFromAuthHash } from '../data/supabaseAuth';

export default function RecuperarPasswordPage() {
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const authLink = useMemo(() => tokensFromAuthHash(), []);
  const isInviteLink = authLink?.type === 'invite';
  const isPasswordSetupLink = authLink?.type === 'recovery' || isInviteLink;
  const [email, setEmail] = useState(params.get('email') || '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [changed, setChanged] = useState(false);

  const submitRequest = async (event: React.FormEvent) => {
    event.preventDefault();
    if (loading) return;
    setError('');
    setLoading(true);
    try {
      const redirectTo = `${window.location.origin}/recuperar`;
      await requestSupabasePasswordReset(email, redirectTo);
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible enviar el correo de recuperación.');
    } finally {
      setLoading(false);
    }
  };

  const submitPassword = async (event: React.FormEvent) => {
    event.preventDefault();
    if (loading) return;
    setError('');
    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden.');
      return;
    }
    setLoading(true);
    try {
      await completeSupabasePasswordRecovery(password);
      setChanged(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible actualizar la contraseña.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#faf9f8] flex items-center justify-center p-5">
      <div className="w-full max-w-[460px] bg-white rounded-2xl border border-cream3 shadow-xl overflow-hidden">
        <div className="bg-navy px-7 py-6 text-white">
          <div className="text-[22px] tracking-[2px] mb-4">Acre<b className="text-brown font-normal">dita</b></div>
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[1.5px] text-white/60 mb-2"><ShieldCheck size={14} /> {isInviteLink ? 'Activación segura' : 'Recuperación segura'}</div>
          <h1 className="text-2xl font-semibold">{isPasswordSetupLink ? (isInviteLink ? 'Crea tu contraseña' : 'Crear nueva contraseña') : 'Recuperar acceso'}</h1>
          <p className="text-[13px] text-white/70 mt-2 leading-relaxed">
            {isPasswordSetupLink
              ? isInviteLink
                ? 'Activa tu acceso definiendo la contraseña que usarás para ingresar a Acredita.'
                : 'Define una contraseña nueva para volver a ingresar a Acredita.'
              : 'Te enviaremos un enlace de recuperación al correo asociado a tu cuenta.'}
          </p>
        </div>

        <div className="p-7">
          {changed ? (
            <div className="text-center py-3">
              <CheckCircle size={52} className="mx-auto text-emerald-600 mb-4" />
              <h2 className="text-xl font-semibold text-navy mb-2">{isInviteLink ? 'Acceso activado' : 'Contraseña actualizada'}</h2>
              <p className="text-[13px] text-gray-500 leading-relaxed mb-6">Ya puedes iniciar sesión con tu nueva contraseña.</p>
              <Link to="/login" className="btn btn-primary w-full justify-center">Ir a iniciar sesión</Link>
            </div>
          ) : sent && !isPasswordSetupLink ? (
            <div className="text-center py-3">
              <Mail size={48} className="mx-auto text-brown mb-4" />
              <h2 className="text-xl font-semibold text-navy mb-2">Revisa tu correo</h2>
              <p className="text-[13px] text-gray-500 leading-relaxed mb-6">Si existe una cuenta asociada a <b>{email}</b>, recibirás un enlace para crear una nueva contraseña. Revisa también spam o correo no deseado.</p>
              <button type="button" className="btn btn-secondary w-full justify-center" onClick={() => setSent(false)}>Usar otro correo</button>
              <Link to="/login" className="inline-block mt-4 text-[13px] text-brown font-semibold hover:underline">Volver al inicio de sesión</Link>
            </div>
          ) : isPasswordSetupLink ? (
            <form onSubmit={submitPassword} className="flex flex-col gap-4">
              <div className="rounded-lg border border-blue-100 bg-blue-50 p-3 text-[12px] text-blue-800 flex gap-2"><KeyRound size={16} className="shrink-0 mt-0.5" /><span>Usa al menos 8 caracteres y evita reutilizar una contraseña de otro servicio.</span></div>
              <label className="block"><span className="block text-[12.5px] font-medium text-gray-700 mb-1.5">Nueva contraseña</span><input required minLength={8} type="password" autoComplete="new-password" value={password} onChange={event => setPassword(event.target.value)} className="form-input w-full" placeholder="Mínimo 8 caracteres" /></label>
              <label className="block"><span className="block text-[12.5px] font-medium text-gray-700 mb-1.5">Repetir contraseña</span><input required minLength={8} type="password" autoComplete="new-password" value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} className="form-input w-full" placeholder="Repite la contraseña" /></label>
              {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-[12px] text-red-700">{error}</div>}
              <button disabled={loading} className="btn btn-primary w-full justify-center py-2.5 disabled:opacity-60">{loading ? 'Actualizando…' : isInviteLink ? 'Activar acceso' : 'Guardar nueva contraseña'}</button>
            </form>
          ) : (
            <form onSubmit={submitRequest} className="flex flex-col gap-4">
              <label className="block"><span className="block text-[12.5px] font-medium text-gray-700 mb-1.5">Correo de tu cuenta</span><input required type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} className="form-input w-full" placeholder="tu@empresa.cl" /></label>
              {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-[12px] text-red-700">{error}</div>}
              <button disabled={loading} className="btn btn-primary w-full justify-center py-2.5 disabled:opacity-60">{loading ? 'Enviando…' : 'Enviar enlace de recuperación'}</button>
              <div className="text-center text-[12px] text-gray-500">¿Recordaste tu contraseña? <Link to="/login" className="text-brown font-semibold hover:underline">Inicia sesión</Link></div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
