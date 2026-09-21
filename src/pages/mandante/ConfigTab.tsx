import { useEffect } from 'react';
import { Building2, Folder, KeyRound, Mail, ShieldCheck, UserRound } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { SupabaseUserSession } from '../../data/supabaseAuth';
import type { Mandante, Proyecto } from '../../types';
import type { ConfigTabId } from './config/configUtils';
import './ConfigTab.css';

interface Props {
  activeConfigTab: ConfigTabId;
  setActiveConfigTab: (tab: ConfigTabId) => void;
  showToast: (message: string, type?: 'success' | 'error' | 'warning') => void;
  misProyectos: Proyecto[];
  mandante: Mandante;
  onDirtyChange?: (dirty: boolean) => void;
  session: SupabaseUserSession | null;
}

export default function ConfigTab({ mandante, misProyectos, onDirtyChange, session }: Props) {
  useEffect(() => {
    onDirtyChange?.(false);
  }, [onDirtyChange]);

  const activos = misProyectos.filter(project => {
    const estado = String(project.estado || '').toLowerCase();
    return estado === 'active' || estado === 'activo';
  }).length;

  return (
    <div className="mandante-config fade-in">
      <header className="mandante-config-head">
        <h2>Mi organización</h2>
        <p>Información de tu empresa, proyectos visibles y alcance de acceso dentro de Acredita.</p>
      </header>
      <div className="mandante-config-content" style={{ maxWidth: 820 }}>
        <section className="mandante-config-card">
          <div className="mandante-config-title">
            <div>
              <h3>Mi empresa</h3>
              <p>Estos datos provienen del backend y no se guardan en este navegador.</p>
            </div>
            <Building2 size={20} />
          </div>
          <div className="mandante-config-grid">
            <div><div className="mandante-config-label">Razón social</div><strong>{mandante.nombre}</strong></div>
            <div><div className="mandante-config-label">RUT</div><strong>{mandante.rut}</strong></div>
          </div>
        </section>
        <section className="mandante-config-card">
          <div className="mandante-config-title">
            <div><h3>Proyectos</h3><p>Resumen de proyectos visibles para esta organización.</p></div>
            <Folder size={20} />
          </div>
          <div className="mandante-config-grid">
            <div><div className="mandante-config-label">Total</div><strong>{misProyectos.length}</strong></div>
            <div><div className="mandante-config-label">Activos</div><strong>{activos}</strong></div>
          </div>
        </section>
        <section className="mandante-config-card">
          <div className="mandante-config-title">
            <div><h3>Acceso y permisos</h3><p>Los permisos efectivos se aplican desde Supabase mediante membresías y RLS.</p></div>
            <ShieldCheck size={20} />
          </div>
          <div className="mandante-config-grid">
            <div><div className="mandante-config-label">Tipo de acceso</div><strong>Administrador Mandante</strong></div>
            <div><div className="mandante-config-label">Estado</div><strong>Activo</strong></div>
          </div>
        </section>
        <section className="mandante-config-card">
          <div className="mandante-config-title">
            <div><h3>Mi cuenta</h3><p>Datos de la cuenta autenticada y recuperación segura de contraseña.</p></div>
            <UserRound size={20} />
          </div>
          <div className="mandante-config-grid">
            <div><div className="mandante-config-label">Correo de acceso</div><strong className="inline-flex items-center gap-2"><Mail size={14} />{session?.email || '—'}</strong></div>
            <div><div className="mandante-config-label">Sesión</div><strong>Autenticada</strong></div>
          </div>
          {session?.email && <div className="mt-4">
            <Link className="btn btn-ghost inline-flex items-center gap-2" to={`/recuperar?email=${encodeURIComponent(session.email)}`}><KeyRound size={14} />Cambiar contraseña</Link>
          </div>}
        </section>
      </div>
    </div>
  );
}
