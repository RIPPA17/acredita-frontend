import { useEffect } from 'react';
import { Building2, Folder, ShieldCheck } from 'lucide-react';
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
}

export default function ConfigTab({ mandante, misProyectos, onDirtyChange }: Props) {
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
        <h2>Configuración</h2>
        <p>Información de tu organización conectada a Acredita.</p>
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
        </section>
      </div>
    </div>
  );
}
